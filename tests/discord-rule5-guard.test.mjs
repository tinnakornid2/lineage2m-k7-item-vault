import assert from 'node:assert';
import { createApp } from '../api/_server.ts';

const app = await createApp({ serveFrontend: false });
const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;
const authHeader = {
  Authorization: 'Bearer local-dev-user_owner_eloni-owner',
  'Content-Type': 'application/json'
};

try {
  console.log('Testing Rule 5 Discord Hard Guard on /api/discord-webhook...');

  // Test Case 1: Legacy stat request embed title
  const res1 = await fetch(`${baseUrl}/api/discord-webhook`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({
      payload: {
        embeds: [{
          title: '⚡ New Stats and Power Level Update Request!',
          description: 'Zenkaii submitted updated stats'
        }]
      }
    })
  });
  assert.strictEqual(res1.status, 200, 'Stat payload should return 200 dropped');
  const data1 = await res1.json();
  assert.strictEqual(data1.success, true);
  assert.strictEqual(data1.dropped, true);
  console.log('✓ Test Case 1 passed: Legacy stat request title was dropped.');

  // Test Case 2: Explicit event === 'stat_request'
  const res2 = await fetch(`${baseUrl}/api/discord-webhook`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({
      event: 'stat_request',
      payload: {
        embeds: [{ title: 'Some Title', description: 'Some description' }]
      }
    })
  });
  assert.strictEqual(res2.status, 200);
  const data2 = await res2.json();
  assert.strictEqual(data2.success, true);
  assert.strictEqual(data2.dropped, true);
  console.log('✓ Test Case 2 passed: event=stat_request was dropped.');

  // Test Case 3: Explicit event === 'stat_approval'
  const res3 = await fetch(`${baseUrl}/api/discord-webhook`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({
      event: 'stat_approval',
      payload: {
        embeds: [{ title: 'Approval Title', description: 'Approved stats' }]
      }
    })
  });
  assert.strictEqual(res3.status, 200);
  const data3 = await res3.json();
  assert.strictEqual(data3.success, true);
  assert.strictEqual(data3.dropped, true);
  console.log('✓ Test Case 3 passed: event=stat_approval was dropped.');

  // Test Case 4: Footer containing 'Stat Verification'
  const res4 = await fetch(`${baseUrl}/api/discord-webhook`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({
      payload: {
        embeds: [{
          title: 'Arbitrary Title',
          footer: { text: 'Lineage 2M Clan Hub • Stat Verification' }
        }]
      }
    })
  });
  assert.strictEqual(res4.status, 200);
  const data4 = await res4.json();
  assert.strictEqual(data4.success, true);
  assert.strictEqual(data4.dropped, true);
  console.log('✓ Test Case 4 passed: Footer containing Stat Verification was dropped.');

  // Test Case 5: Power Level Update Request in description
  const res5 = await fetch(`${baseUrl}/api/discord-webhook`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({
      payload: {
        embeds: [{
          title: 'Notification',
          description: 'Member submitted updated stats for a new Power Level calculation'
        }]
      }
    })
  });
  assert.strictEqual(res5.status, 200);
  const data5 = await res5.json();
  assert.strictEqual(data5.success, true);
  assert.strictEqual(data5.dropped, true);
  console.log('✓ Test Case 5 passed: Description with power level calculation was dropped.');

  console.log('\nAll 5 Rule 5 Discord Hard Guard tests PASSED successfully! 🛡️');
} finally {
  server.close();
}
