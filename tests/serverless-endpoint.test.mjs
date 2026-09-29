import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

test('Vercel Serverless Function (api/index.js) correctly routes /api requests without 405', async () => {
  const { default: handler } = await import('../api/index.js');
  assert.equal(typeof handler, 'function', 'api/index.js should export a default handler function');

  const server = http.createServer((req, res) => {
    handler(req, res);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Test /api/health
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200, '/api/health should return 200');
    const healthJson = await healthRes.json();
    assert.equal(healthJson.status, 'ok');
    assert.equal(healthJson.serverless, true);

    // 2. Test Vercel rewrite with __path param: POST /api/index?__path=/api/users/mock-user-123/change-password
    const changePassRes = await fetch(`${baseUrl}/api/index?__path=/api/users/mock-user-123/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ newPassword: 'new-secure-password-123' })
    });

    // Without an auth token, requireRoles middleware returns 401/403.
    // The critical check is that it does NOT return 405 Method Not Allowed!
    assert.notEqual(changePassRes.status, 405, 'Route should NOT return 405 Method Not Allowed');
    assert.ok([401, 403].includes(changePassRes.status), `Expected 401 or 403, got ${changePassRes.status}`);
    const changePassJson = await changePassRes.json();
    assert.equal(changePassJson.success, false);

    // 3. Test Vercel x-invoke-path header without __path param
    const headerRes = await fetch(`${baseUrl}/api/index`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-invoke-path': '/api/users/mock-user-123/change-password'
      },
      body: JSON.stringify({ newPassword: 'new-secure-password-123' })
    });
    assert.notEqual(headerRes.status, 405);
    assert.ok([401, 403].includes(headerRes.status));

    console.log('✅ Serverless handler correctly handles rewritten API routes without 405!');
  } finally {
    server.close();
  }
});
