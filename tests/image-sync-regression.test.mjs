import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { compressBase64, compressImageFile, shrinkEmbeddedImages } from '../src/utils/imageCompressor.ts';
import { prepareApiPayload, MAX_API_WIRE_BYTES } from '../src/services/apiPayload.ts';
import { drainOutbox, setTokenProvider, setSessionProvider } from '../src/services/centralApi.ts';

// Canvas codec fixture: model noisy images whose size depends on dimensions and quality.
// These tests exercise the production pipeline, not browser codec visual fidelity.
function canvasFixture() {
  const originals = new Map(['Image', 'document', 'FileReader'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let decoded = 0;
  let encodes = 0;
  class FixtureImage {
    width = 2400;
    height = 1600;
    set src(value) {
      decoded++;
      queueMicrotask(() => value === 'data:image/jpeg;base64,broken' ? this.onerror?.() : this.onload?.());
    }
  }
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: FixtureImage });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => ({
      width: 0, height: 0,
      getContext: () => ({ drawImage() {}, fillRect() {} }),
      toDataURL(type, quality) {
        encodes++;
        return `data:${type};base64,${randomBytes(Math.max(1, Math.floor(this.width * this.height * quality * 0.45))).toString('base64')}`;
      }
    })
  } });
  Object.defineProperty(globalThis, 'FileReader', { configurable: true, value: class {
    readAsDataURL() { this.result = 'data:image/jpeg;base64,fixture'; queueMicrotask(() => this.onload?.()); }
  } });
  return {
    counts: () => ({ decoded, encodes }),
    restore() { for (const [key, descriptor] of originals) descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key]; }
  };
}

test('New uploads reduce repeatedly toward a size budget, not only one quality pass', async () => {
  const fixture = canvasFixture();
  try {
    const reduced = await compressImageFile({}, { maxWidth: 1280, maxHeight: 1280, maxDataUrlChars: 180000 });
    assert.ok(reduced.length <= 180000);
    assert.ok(fixture.counts().encodes > 1);
  } finally { fixture.restore(); }
});

test('Embedded image traversal deduplicates pictures and preserves URLs, receipts and metadata', async () => {
  const fixture = canvasFixture();
  try {
    const image = 'data:image/jpeg;base64,' + 'A'.repeat(300000);
    const original = { users: [{ proof: image }], receipts: [{ id: 'receipt-1', images: [image] }], url: 'https://example.test/image.png', count: 5 };
    const reduced = await shrinkEmbeddedImages(original, { maxWidth: 960, maxHeight: 960, maxDataUrlChars: 100000 });
    assert.equal(reduced.users[0].proof, reduced.receipts[0].images[0]);
    assert.equal(reduced.receipts[0].id, 'receipt-1');
    assert.equal(reduced.url, original.url);
    assert.equal(reduced.count, 5);
    assert.equal(original.users[0].proof, image);
    assert.equal(fixture.counts().decoded, 1);
  } finally { fixture.restore(); }
});

test('Broken images are retained, never silently removed', async () => {
  const fixture = canvasFixture();
  try {
    const original = 'data:image/jpeg;base64,broken';
    assert.equal(await compressBase64(original), original);
  } finally { fixture.restore(); }
});

const oversizedImage = () => 'data:image/jpeg;base64,' + randomBytes(6 * 1024 * 1024).toString('base64');

test('An oversized pending JSON request shrinks its image and fits the wire limit', async () => {
  const fixture = canvasFixture();
  try {
    const body = JSON.stringify({ data: { vaultItems: [{ id: 'keep-id', imageUrl: oversizedImage() }] }, performedBy: 'Owner' });
    const init = { method: 'POST', body, headers: { 'X-Client-Op-Id': 'stable-id' } };
    const wire = await prepareApiPayload(init);
    const bytes = wire.body instanceof Blob ? Buffer.from(await wire.body.arrayBuffer()) : Buffer.from(wire.body);
    const data = JSON.parse(new Headers(wire.headers).get('Content-Encoding') === 'gzip' ? gunzipSync(bytes).toString() : bytes.toString());
    assert.ok(bytes.length < MAX_API_WIRE_BYTES);
    assert.equal(data.data.vaultItems[0].id, 'keep-id');
    assert.ok(data.data.vaultItems[0].imageUrl.length < 180001);
    assert.equal(init.body, body);
  } finally { fixture.restore(); }
});

test('Real outbox drain resizes an old picture, keeps the operation ID and removes it only after acknowledgement', async () => {
  const fixture = canvasFixture();
  const fetchOriginal = globalThis.fetch;
  const storageOriginal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const windowOriginal = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const onlineOriginal = Object.getOwnPropertyDescriptor(globalThis.navigator, 'onLine');
  const store = new Map();
  const body = JSON.stringify({ data: { imageUrl: oversizedImage(), itemId: 'keep-item-id' } });
  store.set('k7_api_outbox_queue_v1', JSON.stringify([{ id: 'pending-original-op', path: '/api/live-state', method: 'POST', body, userId: 'test-user', createdAt: Date.now(), retries: 0 }]));
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent: () => true } });
  Object.defineProperty(globalThis.navigator, 'onLine', { configurable: true, value: true });
  setSessionProvider(() => ({ id: 'test-user' }));
  setTokenProvider(async () => 'test-token');
  let sent = false;
  globalThis.fetch = async (_path, init) => {
    if (_path === '/api/upload-image') {
      assert.equal(JSON.parse(store.get('k7_api_outbox_queue_v1'))[0].body, body);
      return Response.json({ success: true, url: 'https://firebasestorage.googleapis.com/v0/b/clan-hub-7645f.firebasestorage.app/o/test?alt=media&token=test' });
    }
    assert.equal(init.headers.get('X-Client-Op-Id'), 'pending-original-op');
    assert.equal(JSON.parse(store.get('k7_api_outbox_queue_v1'))[0].body, body);
    const bytes = init.body instanceof Blob ? Buffer.from(await init.body.arrayBuffer()) : Buffer.from(init.body);
    assert.ok(bytes.length < MAX_API_WIRE_BYTES);
    assert.equal(JSON.parse(bytes.toString()).data.imageUrl.startsWith('https://firebasestorage.googleapis.com/'), true);
    sent = true;
    return Response.json({ success: true });
  };
  try {
    await drainOutbox();
    assert.equal(sent, true);
    assert.deepEqual(JSON.parse(store.get('k7_api_outbox_queue_v1') || '[]'), []);
  } finally {
    globalThis.fetch = fetchOriginal;
    storageOriginal ? Object.defineProperty(globalThis, 'localStorage', storageOriginal) : delete globalThis.localStorage;
    windowOriginal ? Object.defineProperty(globalThis, 'window', windowOriginal) : delete globalThis.window;
    onlineOriginal ? Object.defineProperty(globalThis.navigator, 'onLine', onlineOriginal) : delete globalThis.navigator.onLine;
    fixture.restore();
  }
});
