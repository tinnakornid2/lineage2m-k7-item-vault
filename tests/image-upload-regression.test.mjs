import test from 'node:test';
import assert from 'node:assert/strict';
import { setTokenProvider, setSessionProvider } from '../src/services/centralApi.ts';
import { uploadEmbeddedImage, uploadImagesInPayload, imageForOcr } from '../src/services/imageUpload.ts';

const image = 'data:image/png;base64,iVBORw0KGgo=';
const url = 'https://firebasestorage.googleapis.com/v0/b/clan-hub-7645f.firebasestorage.app/o/app-images%2Fa?alt=media&token=test';
setTokenProvider(async () => 'test-token');
Object.defineProperty(globalThis.navigator, 'onLine', { configurable: true, value: true });
setSessionProvider(() => ({ id: 'alice', inGameName: 'Alice' }));

test('Upload returns only acknowledged Storage URL with authenticated request', async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async (path, init) => {
    assert.equal(path, '/api/upload-image');
    assert.equal(init.headers.get('Authorization'), 'Bearer test-token');
    assert.equal(JSON.parse(init.body).imageBase64, image);
    return Response.json({ success: true, url });
  };
  try { assert.equal(await uploadEmbeddedImage(image, 'alice'), url); }
  finally { globalThis.fetch = previous; }
});

test('Migration deduplicates images and preserves original request metadata', async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ success: true, url }); };
  const source = { id: 'receipt', images: [image, image], quantity: 3 };
  try {
    assert.deepEqual(await uploadImagesInPayload(source, 'alice'), { ...source, images: [url, url] });
    assert.equal(calls, 1);
    assert.equal(source.images[0], image);
  } finally { globalThis.fetch = previous; }
});

test('Upload failure never falls back to embedded image or queues a false success', async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ error: 'STORAGE_UNAVAILABLE' }, { status: 503 });
  try { await assert.rejects(uploadEmbeddedImage(image)); }
  finally { globalThis.fetch = previous; }
});

test('OCR rejects arbitrary remote URLs before downloading', async () => {
  await assert.rejects(imageForOcr('https://example.com/image.png'), /INVALID_OCR_IMAGE_URL/);
});
