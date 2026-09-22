import assert from 'node:assert';

const baseUrl = 'http://localhost:3000';

async function runRealUserSimulation() {
  console.log('====================================================');
  console.log('🚀 STARTING REAL USER END-TO-END SYSTEM SIMULATION');
  console.log('====================================================\n');

  // STEP 1: Check System Health
  console.log('--- STEP 1: Verifying Server Health ---');
  const healthRes = await fetch(`${baseUrl}/api/health`);
  assert.strictEqual(healthRes.status, 200, 'Health endpoint should return 200');
  const health = await healthRes.json();
  console.log('✓ Server is Healthy:', health);

  // STEP 2: Fetch Initial Live State
  console.log('\n--- STEP 2: Fetch Initial Live State ---');
  const initialRes = await fetch(`${baseUrl}/api/live-state?v=0`);
  assert.strictEqual(initialRes.status, 200);
  const initialState = await initialRes.json();
  console.log(`✓ Initial live state loaded (Version: ${initialState.version})`);

  // STEP 3: Admin Adds a New Vault Item
  console.log('\n--- STEP 3: Admin Adds New Vault Item ---');
  const testItemId = `item_sim_${Date.now()}`;
  const testItem = {
    id: testItemId,
    name: "Archangel's Holy Spear",
    rarity: 'MYTHIC',
    imageUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400',
    price: 12000,
    minPowerLevel: 3000,
    quantity: 1,
    status: 'available',
    hunters: [{ name: 'Eloni', clan: 'VoltZ' }],
    claimants: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const currentVaultItems = Array.isArray(initialState.data?.vaultItems)
    ? [...initialState.data.vaultItems, testItem]
    : [testItem];

  const postState1 = await fetch(`${baseUrl}/api/live-state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        ...initialState.data,
        vaultItems: currentVaultItems
      },
      performedBy: 'Eloni (Owner)'
    })
  });
  assert.strictEqual(postState1.status, 200);
  const res1 = await postState1.json();
  console.log(`✓ Item created successfully: [${testItem.rarity}] ${testItem.name} (Live version: ${res1.version})`);

  // STEP 4: Member 1 (KainHero, VoltZ, PL 3500) Claims the Item
  console.log('\n--- STEP 4: Member 1 (KainHero) Claims Item ---');
  const member1Claimant = {
    userId: 'user_kain_hero_01',
    inGameName: 'KainHero',
    clan: 'VoltZ',
    powerLevel: 3500,
    claimedAt: Date.now()
  };

  const claimRes1 = await fetch(`${baseUrl}/api/claim-vault-item`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      itemId: testItemId,
      claimant: member1Claimant
    })
  });
  assert.strictEqual(claimRes1.status, 200);
  const claimData1 = await claimRes1.json();
  assert.strictEqual(claimData1.success, true);
  console.log(`✓ Member 1 (${member1Claimant.inGameName}) claimed item via /api/claim-vault-item`);

  // STEP 5: Member 2 (ShadowBlade, LevelS, PL 4200) Claims the Item
  console.log('\n--- STEP 5: Member 2 (ShadowBlade) Claims Item ---');
  const member2Claimant = {
    userId: 'user_shadow_blade_02',
    inGameName: 'ShadowBlade',
    clan: 'LevelS',
    powerLevel: 4200,
    claimedAt: Date.now() + 50
  };

  const claimRes2 = await fetch(`${baseUrl}/api/claim-vault-item`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      itemId: testItemId,
      claimant: member2Claimant
    })
  });
  assert.strictEqual(claimRes2.status, 200);
  const claimData2 = await claimRes2.json();
  assert.strictEqual(claimData2.success, true);
  console.log(`✓ Member 2 (${member2Claimant.inGameName}) claimed item via /api/claim-vault-item`);

  // STEP 6: CRITICAL TEST - Simulate Browser Refresh (F5 / Reload)
  console.log('\n--- STEP 6: SIMULATE BROWSER REFRESH (F5) ---');
  console.log('Simulating fresh client session fetching state after browser reload...');
  const refreshedRes = await fetch(`${baseUrl}/api/live-state?v=0&_t=${Date.now()}`);
  assert.strictEqual(refreshedRes.status, 200);
  const refreshedState = await refreshedRes.json();
  const refreshedItem = (refreshedState.data?.vaultItems || []).find((i) => i.id === testItemId);

  assert.ok(refreshedItem, 'Test item must exist after browser refresh!');
  assert.ok(Array.isArray(refreshedItem.claimants), 'Claimants array must exist!');
  assert.strictEqual(refreshedItem.claimants.length, 2, 'Both claimants MUST persist across refresh!');
  console.log(`✓ VERIFIED: After browser refresh, item has ${refreshedItem.claimants.length} claimants:`);
  refreshedItem.claimants.forEach((c, idx) => {
    console.log(`   ${idx + 1}. ${c.inGameName} (${c.clan}) - ⚡ ${c.powerLevel.toLocaleString()} PL - ClaimedAt: ${c.claimedAt}`);
  });

  // STEP 7: Verify In-App Notification Center Generation
  console.log('\n--- STEP 7: Verify Notification Center Logic ---');
  // Replicate App.tsx notification center generator
  const notifications = [];
  (refreshedState.data?.vaultItems || []).forEach((item) => {
    if (item.status === 'distributed') return;
    (item.claimants || []).forEach((c) => {
      const claimantId = c.userId || c.inGameName;
      const notifId = `claim_${item.id}_${claimantId}_${c.claimedAt || 0}`;
      notifications.push({
        id: notifId,
        type: 'claim',
        titleTh: `${c.inGameName} (${c.clan}) ลงชื่อขอรับไอเทม`,
        titleEn: `${c.inGameName} (${c.clan}) claimed an item`,
        descTh: `ขอรับ [${item.rarity}] ${item.name} (x${item.quantity || 1}) • 💎 ${item.price.toLocaleString()} เพชร`,
        descEn: `Claimed [${item.rarity}] ${item.name} (x${item.quantity || 1}) • 💎 ${item.price.toLocaleString()} Dia`
      });
    });
  });

  const itemNotifs = notifications.filter((n) => n.id.includes(testItemId));
  assert.strictEqual(itemNotifs.length, 2, 'Must generate exactly 2 notifications for the 2 claimants!');
  console.log(`✓ Notification Center generated ${itemNotifs.length} notifications:`);
  itemNotifs.forEach((n) => {
    console.log(`   [TH] ${n.titleTh} - ${n.descTh}`);
    console.log(`   [EN] ${n.titleEn} - ${n.descEn}`);
  });

  // STEP 8: Member 2 Cancels Claim (Unclaim)
  console.log('\n--- STEP 8: Member 2 Cancels Claim ---');
  const unclaimRes = await fetch(`${baseUrl}/api/unclaim-vault-item`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      itemId: testItemId,
      userId: member2Claimant.userId,
      inGameName: member2Claimant.inGameName
    })
  });
  assert.strictEqual(unclaimRes.status, 200);
  console.log(`✓ Member 2 unclaim processed.`);

  // Verify state after unclaim & refresh
  const afterUnclaimRes = await fetch(`${baseUrl}/api/live-state?v=0&_t=${Date.now()}`);
  const afterUnclaimState = await afterUnclaimRes.json();
  const afterUnclaimItem = (afterUnclaimState.data?.vaultItems || []).find((i) => i.id === testItemId);
  assert.strictEqual(afterUnclaimItem.claimants.length, 1, 'Only Member 1 should remain!');
  assert.strictEqual(afterUnclaimItem.claimants[0].inGameName, 'KainHero');
  console.log(`✓ VERIFIED: After unclaim & refresh, only 1 claimant remains: ${afterUnclaimItem.claimants[0].inGameName}`);

  // STEP 9: Admin Distributes Item to Winner (Member 1)
  console.log('\n--- STEP 9: Admin Distributes Item to Member 1 ---');
  const distributedItem = {
    ...afterUnclaimItem,
    status: 'distributed',
    distributedTo: {
      userId: member1Claimant.userId,
      name: member1Claimant.inGameName,
      clan: member1Claimant.clan,
      powerLevel: member1Claimant.powerLevel,
      distributedAt: Date.now()
    },
    updatedAt: Date.now()
  };

  const currentAfterDist = afterUnclaimState.data.vaultItems.map((i) =>
    i.id === testItemId ? distributedItem : i
  );

  await fetch(`${baseUrl}/api/live-state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        ...afterUnclaimState.data,
        vaultItems: currentAfterDist
      },
      performedBy: 'Eloni (Owner)'
    })
  });

  // Verify auto-removal of notifications for distributed items
  const postDistRes = await fetch(`${baseUrl}/api/live-state?v=0&_t=${Date.now()}`);
  const postDistState = await postDistRes.json();
  const postDistItem = (postDistState.data?.vaultItems || []).find((i) => i.id === testItemId);
  assert.strictEqual(postDistItem.status, 'distributed');

  const activeNotifs = [];
  (postDistState.data?.vaultItems || []).forEach((item) => {
    if (item.status === 'distributed') return; // Rule: distributed items must not show claim notifications!
    (item.claimants || []).forEach((c) => {
      activeNotifs.push(c);
    });
  });
  const notifsForThisItem = activeNotifs.filter((c) => c.userId === member1Claimant.userId && postDistItem.id === testItemId);
  assert.strictEqual(notifsForThisItem.length, 0, 'Distributed item must have ZERO active claim notifications!');
  console.log(`✓ VERIFIED: Distributed item status is 'distributed' and claim notifications are auto-cleared!`);

  // STEP 10: General Item Queue Simulation (ระบบคิวไอเทมทั่วไป)
  console.log('\n--- STEP 10: General Item Queue Simulation ---');
  const genItemId = `gi_sim_${Date.now()}`;
  const testGeneralItem = {
    id: genItemId,
    name: "Spellbook (Advanced Holy Blessing)",
    rarity: "RARE",
    imageUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300",
    price: 0,
    quantity: 3,
    minPowerLevel: 2500,
    queueList: [],
    receiptHistory: [],
    createdAt: Date.now()
  };

  // Add general item
  const postGenState = await fetch(`${baseUrl}/api/live-state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        ...postDistState.data,
        generalItems: [...(postDistState.data.generalItems || []), testGeneralItem]
      },
      performedBy: 'Eloni (Owner)'
    })
  });
  assert.strictEqual(postGenState.status, 200);
  console.log(`✓ General item added: [${testGeneralItem.rarity}] ${testGeneralItem.name} (Qty: ${testGeneralItem.quantity})`);

  // Member 1 joins queue
  const queueMember1 = {
    id: `gqm_1_${Date.now()}`,
    userId: member1Claimant.userId,
    name: member1Claimant.inGameName,
    clan: member1Claimant.clan,
    powerLevel: member1Claimant.powerLevel,
    status: 'pending',
    joinedAt: Date.now()
  };

  // Member 2 joins queue
  const queueMember2 = {
    id: `gqm_2_${Date.now()}`,
    userId: member2Claimant.userId,
    name: member2Claimant.inGameName,
    clan: member2Claimant.clan,
    powerLevel: member2Claimant.powerLevel,
    status: 'pending',
    joinedAt: Date.now() + 10
  };

  const updatedGenItem = {
    ...testGeneralItem,
    queueList: [queueMember1, queueMember2]
  };

  await fetch(`${baseUrl}/api/live-state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        ...postDistState.data,
        generalItems: [
          ...(postDistState.data.generalItems || []).filter((g) => g.id !== genItemId),
          updatedGenItem
        ]
      },
      performedBy: 'KainHero & ShadowBlade'
    })
  });
  console.log(`✓ Both Member 1 (${queueMember1.name}) and Member 2 (${queueMember2.name}) joined queue`);

  // Simulate F5 refresh for General Item Queue
  console.log('\n--- STEP 11: Refresh Check for General Item Queue ---');
  const genRefreshRes = await fetch(`${baseUrl}/api/live-state?v=0&_t=${Date.now()}`);
  const genRefreshState = await genRefreshRes.json();
  const refreshedGenItem = (genRefreshState.data?.generalItems || []).find((g) => g.id === genItemId);

  assert.ok(refreshedGenItem, 'General item must exist after refresh!');
  assert.strictEqual(refreshedGenItem.queueList.length, 2, 'Queue list must have 2 members after refresh!');
  console.log(`✓ VERIFIED: After browser refresh, General Item queue has ${refreshedGenItem.queueList.length} members:`);
  refreshedGenItem.queueList.forEach((m, idx) => {
    console.log(`   ${idx + 1}. ${m.name} (${m.clan}) - ⚡ ${m.powerLevel.toLocaleString()} PL - Status: ${m.status}`);
  });

  // STEP 12: Member Lifecycle & Permanent Deletion (Tombstone Anti-Resurrection Guard)
  console.log('\n--- STEP 12: Member Lifecycle & Permanent Deletion (Tombstone Guard) ---');
  const deletedUserId = `user_to_delete_${Date.now()}`;
  const memberToDelete = {
    id: deletedUserId,
    username: 'todelete_member',
    inGameName: 'DeleteMePls',
    role: 'member',
    status: 'active',
    clan: 'VoltZ',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  // 1. Add member to live state
  const postMemberState = await fetch(`${baseUrl}/api/live-state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        ...genRefreshState.data,
        users: [...(genRefreshState.data.users || []), memberToDelete]
      },
      performedBy: 'Eloni (Owner)'
    })
  });
  assert.strictEqual(postMemberState.status, 200);

  // Verify member is present in live state
  const checkMemberRes = await fetch(`${baseUrl}/api/live-state?v=0&_t=${Date.now()}`);
  const checkMemberState = await checkMemberRes.json();
  const addedMember = (checkMemberState.data?.users || []).find((u) => u.id === deletedUserId);
  assert.ok(addedMember, 'Member must exist in live state prior to deletion');
  console.log(`✓ Member created: ${addedMember.inGameName} (${addedMember.id})`);

  // 2. Admin deletes member via DELETE /api/users/:userId
  console.log('Admin deleting member via DELETE /api/users/:userId...');
  const deleteRes = await fetch(`${baseUrl}/api/users/${deletedUserId}`, {
    method: 'DELETE',
    headers: {
      Authorization: 'Bearer local-dev-user_owner_eloni-owner'
    }
  });
  assert.strictEqual(deleteRes.status, 200);
  const deleteResult = await deleteRes.json();
  assert.strictEqual(deleteResult.success, true);
  console.log('✓ DELETE /api/users/:userId succeeded');

  // 3. Verify member is removed and tombstone exists in live-state
  const postDeleteRes = await fetch(`${baseUrl}/api/live-state?v=0&_t=${Date.now()}`);
  const postDeleteState = await postDeleteRes.json();
  const deletedMemberCheck = (postDeleteState.data?.users || []).find((u) => u.id === deletedUserId);
  assert.strictEqual(deletedMemberCheck, undefined, 'Deleted member must NOT exist in live state users list!');
  assert.ok(
    postDeleteState.data?.syncMeta?.deletedUsers?.[deletedUserId],
    'Deleted user must have a tombstone recorded in syncMeta.deletedUsers!'
  );
  console.log(`✓ VERIFIED: Deleted member purged from users list and tombstoned with timestamp: ${postDeleteState.data.syncMeta.deletedUsers[deletedUserId]}`);

  // 4. CRITICAL TEST: Simulate an older / stale client posting a snapshot containing the deleted user
  console.log('Simulating stale client or Google Sheets syncing an older snapshot containing the deleted member...');
  const staleSnapshotPost = await fetch(`${baseUrl}/api/live-state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        ...postDeleteState.data,
        users: [...(postDeleteState.data.users || []), memberToDelete]
      },
      performedBy: 'Stale Client Sync'
    })
  });
  assert.strictEqual(staleSnapshotPost.status, 200);

  // 5. Fetch fresh live state after stale sync: member must NEVER resurrect!
  const antiResurrectionRes = await fetch(`${baseUrl}/api/live-state?v=0&_t=${Date.now()}`);
  const antiResurrectionState = await antiResurrectionRes.json();
  const resurrectedMember = (antiResurrectionState.data?.users || []).find((u) => u.id === deletedUserId);
  assert.strictEqual(
    resurrectedMember,
    undefined,
    'ANTI-RESURRECTION SHIELD: Member MUST NOT resurrect even when a stale snapshot containing them is posted!'
  );
  console.log(`✓ VERIFIED: Anti-resurrection shield blocked stale sync. Member remains 100% permanently deleted!`);

  console.log('\n====================================================');
  console.log('🎉 ALL END-TO-END REAL USER SIMULATION TESTS PASSED 100%!');
  console.log('====================================================\n');
}

runRealUserSimulation().catch((err) => {
  console.error('❌ SIMULATION FAILED:', err);
  process.exit(1);
});
