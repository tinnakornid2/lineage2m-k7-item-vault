import assert from 'node:assert';
import { createApp } from '../dist/server.js';
import http from 'node:http';

async function runQueueUserResurrectionTests() {
  console.log('======================================================================');
  console.log('🧪 VERIFYING ANTI-RESURRECTION ARCHITECTURE (v2.10.7)');
  console.log('   Testing: Queue Member, Queue Item, General Item, and User Deletion');
  console.log('======================================================================\n');

  // Start internal test server on ephemeral port
  const app = await createApp({ serveFrontend: false });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`✓ Test server running on port ${port}`);

  try {
    // ──────────────────────────────────────────────────────────────────
    // TEST 1: QUEUE MEMBER REMOVAL & PERMANENCE
    // ──────────────────────────────────────────────────────────────────
    console.log('\n>>> [TEST 1: Queue Member Removal & Non-Resurrection]');
    const queueItemId = `queue_test_${Date.now()}`;
    const memberA = { id: 'qm_a', userId: 'user_a', name: 'MemberA', status: 'pending', joinedAt: Date.now() - 50000 };
    const memberB = { id: 'qm_b', userId: 'user_b', name: 'MemberB', status: 'pending', joinedAt: Date.now() - 40000 };

    // 1.1 Initial broadcast with 2 queue members
    const initPayload = {
      queueItems: [
        {
          id: queueItemId,
          name: 'Epic Bow',
          queueList: [memberA, memberB],
          updatedAt: Date.now() - 10000
        }
      ]
    };
    let res = await fetch(`${baseUrl}/api/live-state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: initPayload, performedBy: 'Admin' })
    });
    assert.strictEqual(res.status, 200);

    // 1.2 Admin removes MemberA (and registers tombstone)
    console.log('1.2 Admin removes MemberA...');
    const memberKey = `${queueItemId}:::qm_a`;
    const userKey = `${queueItemId}:::user_a`;
    const nameKey = `${queueItemId}:::membera`;
    const removePayload = {
      queueItems: [
        {
          id: queueItemId,
          name: 'Epic Bow',
          queueList: [memberB], // MemberA is removed
          updatedAt: Date.now()
        }
      ],
      syncMeta: {
        removedQueueMembers: {
          [memberKey]: Date.now(),
          [userKey]: Date.now(),
          [nameKey]: Date.now()
        }
      }
    };
    res = await fetch(`${baseUrl}/api/live-state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: removePayload, performedBy: 'Admin' })
    });
    assert.strictEqual(res.status, 200);

    // 1.3 Simulate a stale / concurrent client syncing older state containing MemberA
    console.log('1.3 Stale client broadcasts older state with MemberA...');
    const stalePayload = {
      queueItems: [
        {
          id: queueItemId,
          name: 'Epic Bow',
          queueList: [memberA, memberB], // Stale client still has MemberA
          updatedAt: Date.now() - 5000
        }
      ]
    };
    res = await fetch(`${baseUrl}/api/live-state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: stalePayload, performedBy: 'StaleClient' })
    });
    assert.strictEqual(res.status, 200);

    // 1.4 Fetch live state and verify MemberA is GONE and NEVER resurrected!
    const getRes = await fetch(`${baseUrl}/api/live-state?v=0`);
    const liveData = (await getRes.json()).data;
    const targetQueue = liveData.queueItems.find((q) => q.id === queueItemId);
    assert(targetQueue, 'Queue item must exist');
    const memberNames = targetQueue.queueList.map((m) => m.name);
    console.log('   Current Queue members:', memberNames);
    assert(!memberNames.includes('MemberA'), 'FAILED: MemberA resurrected!');
    assert(memberNames.includes('MemberB'), 'MemberB must remain');
    console.log('✓ TEST 1 PASSED: Removed queue member stays removed permanently across syncs.');

    // ──────────────────────────────────────────────────────────────────
    // TEST 2: GENERAL ITEM QUEUE MEMBER REMOVAL & NON-RESURRECTION
    // ──────────────────────────────────────────────────────────────────
    console.log('\n>>> [TEST 2: General Item Queue Member Removal]');
    const gItemId = `gi_test_${Date.now()}`;
    const gMember1 = { id: 'gm_1', userId: 'user_1', name: 'Hunter1', status: 'pending', joinedAt: Date.now() - 30000 };
    const gMember2 = { id: 'gm_2', userId: 'user_2', name: 'Hunter2', status: 'pending', joinedAt: Date.now() - 25000 };

    // 2.1 Initial general item
    res = await fetch(`${baseUrl}/api/live-state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          generalItems: [{ id: gItemId, name: 'Blessed Stone', queueList: [gMember1, gMember2], updatedAt: Date.now() - 5000 }]
        },
        performedBy: 'Admin'
      })
    });
    assert.strictEqual(res.status, 200);

    // 2.2 Remove Hunter1
    const gMemberKey = `${gItemId}:::gm_1`;
    res = await fetch(`${baseUrl}/api/live-state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          generalItems: [{ id: gItemId, name: 'Blessed Stone', queueList: [gMember2], updatedAt: Date.now() }],
          syncMeta: { removedQueueMembers: { [gMemberKey]: Date.now() } }
        },
        performedBy: 'Admin'
      })
    });
    assert.strictEqual(res.status, 200);

    // 2.3 Stale client attempts to re-add Hunter1 with older payload
    res = await fetch(`${baseUrl}/api/live-state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          generalItems: [{ id: gItemId, name: 'Blessed Stone', queueList: [gMember1, gMember2], updatedAt: Date.now() - 2000 }]
        },
        performedBy: 'StaleClient'
      })
    });
    assert.strictEqual(res.status, 200);

    // 2.4 Verify Hunter1 is permanently removed
    const gState = (await (await fetch(`${baseUrl}/api/live-state?v=0`)).json()).data;
    const targetGItem = gState.generalItems.find((g) => g.id === gItemId);
    const gNames = targetGItem.queueList.map((m) => m.name);
    console.log('   General Item Queue members:', gNames);
    assert(!gNames.includes('Hunter1'), 'FAILED: Hunter1 resurrected in general item queue!');
    assert(gNames.includes('Hunter2'), 'Hunter2 must remain');
    console.log('✓ TEST 2 PASSED: General item queue member stays removed permanently.');

    // ──────────────────────────────────────────────────────────────────
    // TEST 3: USER DELETION & ZERO-CLOCK-SKEW RESURRECTION
    // ──────────────────────────────────────────────────────────────────
    console.log('\n>>> [TEST 3: User Deletion & Anti-Resurrection]');
    const testUserId = `user_del_test_${Date.now()}`;
    const testUser = {
      id: testUserId,
      inGameName: 'DeleteMeUser',
      username: 'deleteme',
      role: 'member',
      status: 'active',
      updatedAt: Date.now() + 5000 // Clock skew: in the future!
    };

    // 3.1 Create user
    res = await fetch(`${baseUrl}/api/live-state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: { users: [testUser] },
        performedBy: 'Admin'
      })
    });
    assert.strictEqual(res.status, 200);

    // 3.2 Admin deletes user (registers tombstone)
    console.log('3.2 Admin deletes user...');
    res = await fetch(`${baseUrl}/api/live-state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          users: [],
          syncMeta: { deletedUsers: { [testUserId]: Date.now() } }
        },
        performedBy: 'Admin'
      })
    });
    assert.strictEqual(res.status, 200);

    // 3.3 Stale client attempts to broadcast user back with future updatedAt (clock skew)
    console.log('3.3 Stale client broadcasts deleted user with clock-skewed timestamp...');
    res = await fetch(`${baseUrl}/api/live-state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          users: [{ ...testUser, updatedAt: Date.now() + 60000 }] // Future timestamp
        },
        performedBy: 'StalePeer'
      })
    });
    assert.strictEqual(res.status, 200);

    // 3.4 Verify user is NOT in live-state!
    const uState = (await (await fetch(`${baseUrl}/api/live-state?v=0`)).json()).data;
    const foundUser = (uState.users || []).find((u) => u.id === testUserId);
    assert(!foundUser, 'FAILED: Deleted user resurrected due to clock skew!');
    console.log('✓ TEST 3 PASSED: Deleted user never resurrects regardless of clock skew.');

    // ──────────────────────────────────────────────────────────────────
    // TEST 4: DELETED QUEUE ITEM & GENERAL ITEM ANTI-RESURRECTION
    // ──────────────────────────────────────────────────────────────────
    console.log('\n>>> [TEST 4: Deleted Queue Item & General Item Non-Resurrection]');
    // Delete queueItemId
    res = await fetch(`${baseUrl}/api/live-state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          queueItems: [],
          generalItems: [],
          syncMeta: {
            deletedQueueItems: { [queueItemId]: Date.now() },
            deletedGeneralItems: { [gItemId]: Date.now() }
          }
        },
        performedBy: 'Admin'
      })
    });
    assert.strictEqual(res.status, 200);

    // Stale client sends them back
    res = await fetch(`${baseUrl}/api/live-state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          queueItems: [{ id: queueItemId, name: 'Epic Bow', updatedAt: Date.now() + 30000 }],
          generalItems: [{ id: gItemId, name: 'Blessed Stone', updatedAt: Date.now() + 30000 }]
        },
        performedBy: 'StaleClient'
      })
    });
    assert.strictEqual(res.status, 200);

    const finalState = (await (await fetch(`${baseUrl}/api/live-state?v=0`)).json()).data;
    assert(!finalState.queueItems?.some((q) => q.id === queueItemId), 'FAILED: Deleted queue item resurrected!');
    assert(!finalState.generalItems?.some((g) => g.id === gItemId), 'FAILED: Deleted general item resurrected!');
    console.log('✓ TEST 4 PASSED: Deleted queue & general items cannot resurrect.');

    console.log('\n======================================================================');
    console.log('🎉 ALL ANTI-RESURRECTION TESTS PASSED 100%!');
    console.log('======================================================================\n');
  } finally {
    server.close();
  }
}

runQueueUserResurrectionTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
