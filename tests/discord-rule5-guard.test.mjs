import assert from 'node:assert';
import { createApp } from '../api/_server.ts';

const app = await createApp({
  serveFrontend: false,
  isolatedTest: true,
  testActor: { uid: 'test-owner', role: 'owner' }
});
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
  assert.strictEqual(res1.status, 400, 'Payload without an allowed item event must be rejected');
  const data1 = await res1.json();
  assert.strictEqual(data1.error, 'DISCORD_EVENT_NOT_ALLOWED');
  console.log('✓ Test Case 1 passed: Payload without an item event was rejected.');

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
  assert.strictEqual(res2.status, 400);
  const data2 = await res2.json();
  assert.strictEqual(data2.error, 'DISCORD_EVENT_NOT_ALLOWED');
  console.log('✓ Test Case 2 passed: event=stat_request was rejected.');

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
  assert.strictEqual(res3.status, 400);
  const data3 = await res3.json();
  assert.strictEqual(data3.error, 'DISCORD_EVENT_NOT_ALLOWED');
  console.log('✓ Test Case 3 passed: event=stat_approval was rejected.');

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
  assert.strictEqual(res4.status, 400);
  const data4 = await res4.json();
  assert.strictEqual(data4.error, 'DISCORD_EVENT_NOT_ALLOWED');
  console.log('✓ Test Case 4 passed: Non-item footer payload was rejected.');

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
  assert.strictEqual(res5.status, 400);
  const data5 = await res5.json();
  assert.strictEqual(data5.error, 'DISCORD_EVENT_NOT_ALLOWED');
  console.log('✓ Test Case 5 passed: Power-level payload was rejected.');

  console.log('\nAll 5 Rule 5 Discord Hard Guard tests PASSED successfully! 🛡️');
} finally {
  server.close();
}
