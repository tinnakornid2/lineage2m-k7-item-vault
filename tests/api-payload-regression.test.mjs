import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { randomBytes } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { prepareApiPayload, MAX_API_WIRE_BYTES } from '../src/services/apiPayload.ts';
import { centralApi, getSyncStatus, setSessionProvider } from '../src/services/centralApi.ts';

// Node's navigator has no browser connectivity flag. Explicit browser fixture.
Object.defineProperty(globalThis.navigator, 'onLine', { configurable: true, value: true });

test('Small JSON retains its original body and operation headers', async () => {
  const init = { method: 'POST', body: JSON.stringify({ text: 'ไทย' }), headers: { 'X-Client-Op-Id': 'stable-op' } };
  assert.equal(await prepareApiPayload(init), init);
});

test('Oversized full snapshot compresses losslessly without mutating the outbox JSON', async () => {
  const body = JSON.stringify({ data: { receiptHistory: Array.from({ length: 45000 }, (_, i) => ({ id: String(i), description: 'แจกไอเทม / Item distribution '.repeat(4) })) } });
  assert.ok(Buffer.byteLength(body) > MAX_API_WIRE_BYTES);
  const init = { body, headers: new Headers({ 'X-Client-Op-Id': 'stable-op' }) };
  const wire = await prepareApiPayload(init);
  assert.equal(wire.headers.get('Content-Encoding'), 'gzip');
  assert.equal(wire.headers.get('X-Client-Op-Id'), 'stable-op');
  assert.ok(wire.body.size < MAX_API_WIRE_BYTES);
  assert.equal(gunzipSync(Buffer.from(await wire.body.arrayBuffer())).toString(), body);
  assert.equal(init.body, body);
});

test('Incompressible payload is rejected before sending instead of retrying HTTP 413', async () => {
  const body = JSON.stringify({ image: randomBytes(6 * 1024 * 1024).toString('base64') });
  await assert.rejects(prepareApiPayload({ body }), { code: 'PAYLOAD_TOO_LARGE', isBusinessError: true });
});

test('Browser gzip request is decoded by the same Express JSON configuration locally', async () => {
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.post('/api/live-state', (req, res) => res.json({ count: req.body.data.length, op: req.get('X-Client-Op-Id') }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const wire = await prepareApiPayload({ method: 'POST', body: JSON.stringify({ data: 'ข้อมูล'.repeat(350000) }), headers: { 'X-Client-Op-Id': 'same-op' } });
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/live-state`, wire);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { count: 6 * 350000, op: 'same-op' });
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('Real centralApi sends gzip with authentication and stable operation ID', async () => {
  const originalFetch = globalThis.fetch;
  setSessionProvider(() => ({ id: 'local-test-user' }));
  const body = JSON.stringify({ data: 'ไทย'.repeat(500000) });
  globalThis.fetch = async (path, init) => {
    assert.equal(path, '/api/live-state');
    assert.equal(init.headers.get('Authorization'), 'Bearer test-token');
    assert.equal(init.headers.get('X-Client-Op-Id'), 'original-op');
    assert.equal(init.headers.get('Content-Encoding'), 'gzip');
    assert.equal(gunzipSync(Buffer.from(await init.body.arrayBuffer())).toString(), body);
    return Response.json({ success: true });
  };
  try {
    await centralApi('/api/live-state', { method: 'POST', body, headers: new Headers({ 'X-Client-Op-Id': 'original-op' }) }, 'test-token');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Real centralApi normalizes platform HTML 413 into an explicit non-retryable size error', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('FUNCTION_PAYLOAD_TOO_LARGE', { status: 413 });
  try {
    await assert.rejects(centralApi('/api/live-state', { method: 'POST', body: '{}' }, 'test-token'), { code: 'PAYLOAD_TOO_LARGE', isBusinessError: true });
    assert.equal(getSyncStatus().error, 'PAYLOAD_TOO_LARGE');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
