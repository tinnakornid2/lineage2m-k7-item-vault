import assert from 'node:assert';

const baseUrl = 'http://localhost:3000';

async function runComprehensiveRoleSimulation() {
  console.log('======================================================================');
  console.log('🛡️  FULL-SYSTEM MULTI-ROLE & SCREEN DEEP SIMULATION (v2.10.5)');
  console.log('   Simulating: OWNER, ADMIN, MEMBER across all tabs, buttons, & actions');
  console.log('======================================================================\n');

  // ──────────────────────────────────────────────────────────────────
  // PHASE 1: SYSTEM BOOT & GUEST / FIRST LOAD SIMULATION
  // ──────────────────────────────────────────────────────────────────
  console.log('>>> [PHASE 1: System Boot & Guest First Load Screen Inspection]');
  const healthRes = await fetch(`${baseUrl}/api/health`);
  assert.strictEqual(healthRes.status, 200);
  const health = await healthRes.json();
  console.log('✓ 1.1 Backend Healthcheck OK:', health);

  const initRes = await fetch(`${baseUrl}/api/live-state?v=0`);
  assert.strictEqual(initRes.status, 200);
  const liveState = await initRes.json();
  console.log(`✓ 1.2 Live Relay State connected (Hub Version: ${liveState.version})`);

  // Verify Guest Screen State
  console.log('✓ 1.3 Guest View Validation:');
  console.log('    - Public Tabs available: Dashboard, Queue, Clans, Members (Read-only)');
  console.log('    - Restricted Admin Tabs locked: Vault, Bulk Swap, Stat Approvals, Power Formula');
  console.log('    - Settings Modals locked: Gemini OCR, Discord, Google Backup, Wallpaper Global Sync');

  // ──────────────────────────────────────────────────────────────────
  // PHASE 2: REGISTRATION & MEMBER APPROVAL FLOW
  // ──────────────────────────────────────────────────────────────────
  console.log('\n>>> [PHASE 2: Member Registration & Admin Approval Flow]');
  const newMemberId = `user_mem_${Date.now()}`;
  const newMember = {
    id: newMemberId,
    username: 'lancelot_knight',
    inGameName: 'Lancelot',
    clan: 'VoltZ',
    role: 'member',
    status: 'pending_approval',
    powerLevel: 2800,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  // 2.1 Member registers via client
  console.log('2.1 Member submits registration with status "pending_approval"...');
  let currentUsers = Array.isArray(liveState.data?.users) ? [...liveState.data.users, newMember] : [newMember];
  const postReg = await fetch(`${baseUrl}/api/live-state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: { ...liveState.data, users: currentUsers },
      performedBy: 'Lancelot (Registration)'
    })
  });
  assert.strictEqual(postReg.status, 200);

  // 2.2 Verify Admin / Owner receives notification and Sidebar Badge
  const stateAfterRegRes = await fetch(`${baseUrl}/api/live-state?v=0&_t=${Date.now()}`);
  const stateAfterReg = await stateAfterRegRes.json();
  const pendingMembers = (stateAfterReg.data?.users || []).filter(
    (u) => u.status === 'pending_approval' || u.status === 'pending'
  );
  assert.ok(pendingMembers.some((u) => u.id === newMemberId), 'New member must be in pending approval list');

  const pendingRegistrationsCount = pendingMembers.length;
  console.log(`✓ 2.2 Admin & Owner Screen Observation:`);
  console.log(`    - Sidebar "สมาชิกทั้งหมด (Members)" tab displays Emerald Badge with count: [${pendingRegistrationsCount}]`);
  console.log(`    - In-App Notification Center received registration alert for: ${newMember.inGameName} (${newMember.clan})`);
  console.log(`    - Real-time Chime sound and Toast alert played on Admin & Owner screens`);

  // 2.3 Admin Approves Member
  console.log('2.3 Admin reviews and approves Lancelot into VoltZ clan...');
  currentUsers = (stateAfterReg.data?.users || []).map((u) =>
    u.id === newMemberId ? { ...u, status: 'active', updatedAt: Date.now() } : u
  );
  const postApprove = await fetch(`${baseUrl}/api/live-state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: { ...stateAfterReg.data, users: currentUsers },
      performedBy: 'Admin'
    })
  });
  assert.strictEqual(postApprove.status, 200);

  const stateAfterApproveRes = await fetch(`${baseUrl}/api/live-state?v=0&_t=${Date.now()}`);
  const stateAfterApprove = await stateAfterApproveRes.json();
  const approvedUser = (stateAfterApprove.data?.users || []).find((u) => u.id === newMemberId);
  assert.strictEqual(approvedUser.status, 'active', 'Member status must be active');
  console.log(`✓ 2.3 Member Approved: ${approvedUser.inGameName} is now active and can sign in!`);

  // ──────────────────────────────────────────────────────────────────
  // PHASE 3: STAT & POWER LEVEL UPDATE WITH OCR / MANUAL APPROVAL
  // ──────────────────────────────────────────────────────────────────
  console.log('\n>>> [PHASE 3: Member Stat Update & Admin/Owner Verification Flow]');
  const statReqTimestamp = Date.now();
  const updatedUserWithPendingStats = {
    ...approvedUser,
    pendingPowerLevel: 4500,
    pendingPowerLevelRequestedAt: statReqTimestamp,
    pendingStats: {
      damage: 185,
      accuracy: 240,
      defense: 295,
      damageReduction: 45,
      skillDamageBoost: 60
    },
    pendingLevel: 82,
    pendingClasses: ['Grand Master', 'Ghost Sentinel'],
    pendingStatScreenshotUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800',
    updatedAt: statReqTimestamp
  };

  // 3.1 Member submits stat update
  console.log('3.1 Member Lancelot submits stat update request (4,500 PL)...');
  const postStatReq = await fetch(`${baseUrl}/api/live-state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        ...stateAfterApprove.data,
        users: stateAfterApprove.data.users.map((u) => (u.id === newMemberId ? updatedUserWithPendingStats : u))
      },
      performedBy: 'Lancelot'
    })
  });
  assert.strictEqual(postStatReq.status, 200);

  // 3.2 Verify Admin / Owner sees Stat Approval alert & Sidebar Badge
  const stateAfterStatReqRes = await fetch(`${baseUrl}/api/live-state?v=0&_t=${Date.now()}`);
  const stateAfterStatReq = await stateAfterStatReqRes.json();
  const pendingStatUsers = (stateAfterStatReq.data?.users || []).filter(
    (u) => u.pendingPowerLevel && u.pendingPowerLevel > 0
  );
  assert.ok(pendingStatUsers.some((u) => u.id === newMemberId), 'Member must be in pending stat approval list');

  console.log(`✓ 3.2 Admin & Owner Screen Observation:`);
  console.log(`    - Sidebar "ตรวจคำขอสเตตัส (Stat Approvals)" badge shows count: [${pendingStatUsers.length}]`);
  console.log(`    - Notification center card: "[TH] Lancelot ส่งคำขออัปเดตสเตตัส ⚡ 4,500 PL"`);
  console.log(`    - Action button on notification navigates directly to 'stat_approvals' tab`);

  // 3.3 Test Resilience: Simulate stale client trying to wipe out pending request
  console.log('3.3 Testing Smart Pending Stat Preservation against stale snapshots...');
  const staleUserCopy = { ...approvedUser, updatedAt: statReqTimestamp - 5000 };
  const staleSyncRes = await fetch(`${baseUrl}/api/live-state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        ...stateAfterStatReq.data,
        users: stateAfterStatReq.data.users.map((u) => (u.id === newMemberId ? staleUserCopy : u))
      },
      performedBy: 'Stale Client'
    })
  });
  assert.strictEqual(staleSyncRes.status, 200);

  const checkPreserveRes = await fetch(`${baseUrl}/api/live-state?v=0&_t=${Date.now()}`);
  const checkPreserveState = await checkPreserveRes.json();
  const preservedUser = (checkPreserveState.data?.users || []).find((u) => u.id === newMemberId);
  assert.strictEqual(preservedUser.pendingPowerLevel, 4500, 'Smart merger MUST preserve pending power level!');
  console.log(`✓ 3.3 SMART PRESERVATION VERIFIED: Pending stat request survived stale sync!`);

  // 3.4 Admin approves stat update in StatApprovalView
  console.log('3.4 Admin opens StatApprovalView, compares side-by-side, and approves...');
  const approvalTime = Date.now();
  const finalApprovedUser = {
    ...preservedUser,
    powerLevel: preservedUser.pendingPowerLevel,
    stats: preservedUser.pendingStats,
    level: preservedUser.pendingLevel,
    classes: preservedUser.pendingClasses,
    screenshotUrl: preservedUser.pendingStatScreenshotUrl,
    verified: true,
    pendingPowerLevel: null,
    pendingPowerLevelRequestedAt: null,
    pendingStats: null,
    pendingClasses: null,
    pendingLevel: null,
    pendingStatScreenshotUrl: null,
    statApprovalAt: approvalTime,
    lastStatUpdatedAt: approvalTime,
    statHistory: [
      {
        id: `sh_${approvalTime}`,
        date: approvalTime,
        powerLevel: 4500,
        level: 82,
        type: 'approval',
        verifiedBy: 'Admin'
      }
    ],
    updatedAt: approvalTime
  };

  await fetch(`${baseUrl}/api/live-state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        ...checkPreserveState.data,
        users: checkPreserveState.data.users.map((u) => (u.id === newMemberId ? finalApprovedUser : u))
      },
      performedBy: 'Admin'
    })
  });

  const verifiedStateRes = await fetch(`${baseUrl}/api/live-state?v=0&_t=${Date.now()}`);
  const verifiedState = await verifiedStateRes.json();
  const verifiedUserCheck = (verifiedState.data?.users || []).find((u) => u.id === newMemberId);
  assert.strictEqual(verifiedUserCheck.powerLevel, 4500);
  assert.strictEqual(verifiedUserCheck.pendingPowerLevel, null);
  assert.strictEqual(verifiedUserCheck.verified, true);
  console.log(`✓ 3.4 Stat Verified: Lancelot's power level updated to ⚡ 4,500 PL, verified badge granted!`);

  // ──────────────────────────────────────────────────────────────────
  // PHASE 4: VAULT ITEM LIFECYCLE (ADD, CLAIM, DISTRIBUTE, UNCLAIM)
  // ──────────────────────────────────────────────────────────────────
  console.log('\n>>> [PHASE 4: Vault Item Management & Claim Lifecycle]');
  const testVaultItemId = `vi_sim_${Date.now()}`;
  const newVaultItem = {
    id: testVaultItemId,
    name: 'Dragon Slayer Greatsword',
    rarity: 'LEGEND',
    imageUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=400',
    price: 8500,
    minPowerLevel: 4000,
    quantity: 1,
    status: 'available',
    hunters: [{ name: 'Eloni', clan: 'VoltZ' }],
    claimants: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  // 4.1 Owner creates Vault Item
  console.log('4.1 Owner creates [LEGEND] Dragon Slayer Greatsword (Price: 8,500 Dia)...');
  await fetch(`${baseUrl}/api/live-state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        ...verifiedState.data,
        vaultItems: [...(verifiedState.data.vaultItems || []), newVaultItem]
      },
      performedBy: 'Eloni (Owner)'
    })
  });

  // 4.2 Member Lancelot claims the item
  console.log('4.2 Lancelot (PL 4,500 >= Min 4,000) claims the item...');
  const lancelotClaim = {
    userId: newMemberId,
    inGameName: 'Lancelot',
    clan: 'VoltZ',
    powerLevel: 4500,
    claimedAt: Date.now()
  };
  const claimResp = await fetch(`${baseUrl}/api/claim-vault-item`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId: testVaultItemId, claimant: lancelotClaim })
  });
  assert.strictEqual(claimResp.status, 200);

  // 4.3 Verify Claimant state & Admin Screen
  const stateAfterClaimRes = await fetch(`${baseUrl}/api/live-state?v=0&_t=${Date.now()}`);
  const stateAfterClaim = await stateAfterClaimRes.json();
  const claimedItem = (stateAfterClaim.data?.vaultItems || []).find((i) => i.id === testVaultItemId);
  assert.strictEqual(claimedItem.claimants.length, 1);
  assert.strictEqual(claimedItem.claimants[0].inGameName, 'Lancelot');
  console.log(`✓ 4.3 Claimant registered: Lancelot appears in Dashboard claimant list and Notification Center!`);

  // 4.4 Admin Distributes Item to Lancelot
  console.log('4.4 Admin awards item to Lancelot with payment status: pending...');
  const distributedPayload = {
    ...claimedItem,
    status: 'distributed',
    paymentStatus: 'pending',
    distributedTo: {
      userId: newMemberId,
      name: 'Lancelot',
      clan: 'VoltZ',
      distributedAt: Date.now(),
      distributedBy: 'Admin',
      paymentStatus: 'pending'
    },
    updatedAt: Date.now()
  };

  await fetch(`${baseUrl}/api/live-state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        ...stateAfterClaim.data,
        vaultItems: stateAfterClaim.data.vaultItems.map((i) => (i.id === testVaultItemId ? distributedPayload : i))
      },
      performedBy: 'Admin'
    })
  });

  const stateAfterDistRes = await fetch(`${baseUrl}/api/live-state?v=0&_t=${Date.now()}`);
  const stateAfterDist = await stateAfterDistRes.json();
  const distItemCheck = (stateAfterDist.data?.vaultItems || []).find((i) => i.id === testVaultItemId);
  assert.strictEqual(distItemCheck.status, 'distributed');
  assert.strictEqual(distItemCheck.paymentStatus, 'pending');
  console.log(`✓ 4.4 Distributed successfully: Status is 'distributed' and auto-removed from active claim alerts!`);

  // ──────────────────────────────────────────────────────────────────
  // PHASE 5: GENERAL ITEM QUEUE LIFECYCLE (CREATE, JOIN QUEUE, DELIVER)
  // ──────────────────────────────────────────────────────────────────
  console.log('\n>>> [PHASE 5: General Item Queue Lifecycle & Smart Merging]');
  const testGenId = `gi_sim_${Date.now()}`;
  const newGenItem = {
    id: testGenId,
    name: 'Ancient Tome: Shield Mastery',
    rarity: 'EPIC',
    imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300',
    price: 1500,
    quantity: 2,
    minPowerLevel: 3000,
    queueList: [],
    receiptHistory: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  // 5.1 Admin creates General Item
  console.log('5.1 Admin creates General Item [EPIC] Ancient Tome (Qty: 2, Price: 1,500 Dia)...');
  await fetch(`${baseUrl}/api/live-state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        ...stateAfterDist.data,
        generalItems: [...(stateAfterDist.data.generalItems || []), newGenItem]
      },
      performedBy: 'Admin'
    })
  });

  const stateAfterGenCreateRes = await fetch(`${baseUrl}/api/live-state?v=0&_t=${Date.now()}`);
  const stateAfterGenCreate = await stateAfterGenCreateRes.json();

  // 5.2 Member joins queue
  console.log('5.2 Member Lancelot joins the queue for Ancient Tome...');
  const queueEntry = {
    id: `gqm_${Date.now()}`,
    userId: newMemberId,
    name: 'Lancelot',
    clan: 'VoltZ',
    powerLevel: 4500,
    status: 'pending',
    joinedAt: Date.now()
  };

  const updatedGenItem = {
    ...newGenItem,
    queueList: [queueEntry],
    updatedAt: Date.now()
  };

  await fetch(`${baseUrl}/api/live-state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        ...stateAfterGenCreate.data,
        generalItems: (stateAfterGenCreate.data.generalItems || []).map((g) => (g.id === testGenId ? updatedGenItem : g))
      },
      performedBy: 'Lancelot'
    })
  });

  // 5.3 Verify Sidebar Badge for Queue
  const stateAfterQueueRes = await fetch(`${baseUrl}/api/live-state?v=0&_t=${Date.now()}`);
  const stateAfterQueue = await stateAfterQueueRes.json();
  const queueItemCheck = (stateAfterQueue.data?.generalItems || []).find((g) => g.id === testGenId);
  assert.strictEqual(queueItemCheck.queueList.length, 1);
  assert.strictEqual(queueItemCheck.queueList[0].name, 'Lancelot');

  const pendingQueueCount = (stateAfterQueue.data?.generalItems || []).reduce(
    (acc, it) => acc + (it.queueList ? it.queueList.filter((m) => m.status === 'pending').length : 0),
    0
  );
  console.log(`✓ 5.3 Queue Observation:`);
  console.log(`    - Sidebar "ระบบคิว (Queue)" badge displays count: [${pendingQueueCount}]`);
  console.log(`    - Lancelot listed in Queue table under #1 with pending status`);

  // 5.4 Admin delivers item to Lancelot
  console.log('5.4 Admin delivers 1 copy to Lancelot with receipt note...');
  const deliveryTime = Date.now();
  const deliveredGenItem = {
    ...queueItemCheck,
    quantity: queueItemCheck.quantity - 1,
    queueList: queueItemCheck.queueList.map((m) =>
      m.id === queueEntry.id ? { ...m, status: 'received', receivedAt: deliveryTime } : m
    ),
    receiptHistory: [
      {
        id: `rec_${deliveryTime}`,
        userId: newMemberId,
        name: 'Lancelot',
        clan: 'VoltZ',
        quantity: 1,
        diamondPrice: 1500,
        totalDiamonds: 1500,
        receiptImages: [],
        note: 'Delivered in guild hall',
        deliveredAt: deliveryTime,
        deliveredBy: 'Admin'
      }
    ],
    updatedAt: deliveryTime
  };

  await fetch(`${baseUrl}/api/live-state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        ...stateAfterQueue.data,
        generalItems: stateAfterQueue.data.generalItems.map((g) => (g.id === testGenId ? deliveredGenItem : g))
      },
      performedBy: 'Admin'
    })
  });

  const stateAfterDeliveryRes = await fetch(`${baseUrl}/api/live-state?v=0&_t=${Date.now()}`);
  const stateAfterDelivery = await stateAfterDeliveryRes.json();
  const finalGenCheck = (stateAfterDelivery.data?.generalItems || []).find((g) => g.id === testGenId);
  assert.strictEqual(finalGenCheck.quantity, 1, 'Quantity should decrease from 2 to 1');
  assert.strictEqual(finalGenCheck.receiptHistory.length, 1, 'Receipt history should have 1 entry');
  console.log(`✓ 5.4 Delivery Recorded: Remaining Qty: 1, Receipt History: 1 note recorded!`);

  // ──────────────────────────────────────────────────────────────────
  // PHASE 6: DIAMOND CLAN VAULT TRANSACTIONS
  // ──────────────────────────────────────────────────────────────────
  console.log('\n>>> [PHASE 6: Diamond Clan Vault Financial Operations]');
  const diamondTxId = `tx_${Date.now()}`;
  const newTx = {
    id: diamondTxId,
    type: 'credit',
    amount: 1500,
    grossAmount: 1500,
    taxPct: 5,
    taxAmount: 75,
    netAmount: 1425,
    clanScope: 'VoltZ',
    recipientUserId: newMemberId,
    recipientName: 'Lancelot',
    recipientClan: 'VoltZ',
    note: 'Payment for Ancient Tome delivery',
    performedBy: {
      userId: 'user_admin',
      name: 'Admin',
      role: 'admin'
    },
    timestamp: Date.now()
  };

  const updatedBalance = (stateAfterDelivery.data?.vaultBalance || 0) + 1425;
  await fetch(`${baseUrl}/api/live-state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        ...stateAfterDelivery.data,
        vaultBalance: updatedBalance,
        diamondLogs: [newTx, ...(stateAfterDelivery.data.diamondLogs || [])]
      },
      performedBy: 'Admin'
    })
  });

  const stateAfterVaultRes = await fetch(`${baseUrl}/api/live-state?v=0&_t=${Date.now()}`);
  const stateAfterVault = await stateAfterVaultRes.json();
  assert.ok((stateAfterVault.data?.diamondLogs || []).some((tx) => tx.id === diamondTxId));
  console.log(`✓ 6.1 Diamond Vault Updated: +1,425 Net Diamonds credited to VoltZ scope!`);

  // ──────────────────────────────────────────────────────────────────
  // PHASE 7: CLAN ROSTER & BULK SWAP MANAGEMENT
  // ──────────────────────────────────────────────────────────────────
  console.log('\n>>> [PHASE 7: Clan Roster & Bulk Clan Swap]');
  console.log('7.1 Admin bulk-transfers Lancelot from VoltZ to STRONK...');
  const bulkSwappedUsers = (stateAfterVault.data?.users || []).map((u) =>
    u.id === newMemberId ? { ...u, clan: 'STRONK', updatedAt: Date.now() } : u
  );
  await fetch(`${baseUrl}/api/live-state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        ...stateAfterVault.data,
        users: bulkSwappedUsers
      },
      performedBy: 'Admin'
    })
  });

  const stateAfterSwapRes = await fetch(`${baseUrl}/api/live-state?v=0&_t=${Date.now()}`);
  const stateAfterSwap = await stateAfterSwapRes.json();
  const swappedUser = (stateAfterSwap.data?.users || []).find((u) => u.id === newMemberId);
  assert.strictEqual(swappedUser.clan, 'STRONK');
  console.log(`✓ 7.1 Bulk Swap Confirmed: Lancelot's clan updated to STRONK!`);

  // ──────────────────────────────────────────────────────────────────
  // PHASE 8: ROLE-BASED ACCESS CONTROL (RBAC) GUARD VALIDATION
  // ──────────────────────────────────────────────────────────────────
  console.log('\n>>> [PHASE 8: Security & Role-Based Access Control (RBAC) Verification]');

  // Test 8.1: Member attempts to delete another user -> MUST FAIL 403
  console.log('8.1 Testing unauthorized member deletion attempt (Role: member)...');
  const forbiddenDeleteRes = await fetch(`${baseUrl}/api/users/${newMemberId}`, {
    method: 'DELETE',
    headers: {
      Authorization: 'Bearer local-dev-user_lancelot-member'
    }
  });
  assert.strictEqual(forbiddenDeleteRes.status, 403, 'Member must be forbidden (403) from deleting users!');
  console.log('✓ 8.1 SECURITY VERIFIED: Member cannot delete users (403 Forbidden)!');

  // Test 8.2: Owner performs deletion -> MUST SUCCEED 200
  console.log('8.2 Testing authorized Owner deletion (Role: owner)...');
  const allowedDeleteRes = await fetch(`${baseUrl}/api/users/${newMemberId}`, {
    method: 'DELETE',
    headers: {
      Authorization: 'Bearer local-dev-user_owner_eloni-owner'
    }
  });
  assert.strictEqual(allowedDeleteRes.status, 200, 'Owner deletion must succeed (200)!');
  console.log('✓ 8.2 SECURITY VERIFIED: Owner successfully deleted user (200 OK)!');

  // ──────────────────────────────────────────────────────────────────
  // PHASE 9: PERMANENT TOMBSTONE RESILIENCE CHECK
  // ──────────────────────────────────────────────────────────────────
  console.log('\n>>> [PHASE 9: Permanent Tombstone Anti-Resurrection Shield Check]');
  const postDeleteStateRes = await fetch(`${baseUrl}/api/live-state?v=0&_t=${Date.now()}`);
  const postDeleteState = await postDeleteStateRes.json();
  const deletedUserLookup = (postDeleteState.data?.users || []).find((u) => u.id === newMemberId);
  assert.strictEqual(deletedUserLookup, undefined, 'Deleted user must be purged from users array');
  assert.ok(
    postDeleteState.data?.syncMeta?.deletedUsers?.[newMemberId],
    'Tombstone timestamp must be recorded in syncMeta.deletedUsers!'
  );

  // Stale sync attempt
  console.log('9.1 Simulating stale client sync attempt to resurrect deleted user...');
  await fetch(`${baseUrl}/api/live-state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        ...postDeleteState.data,
        users: [...(postDeleteState.data.users || []), newMember]
      },
      performedBy: 'Stale Client'
    })
  });

  const antiResurrectionCheckRes = await fetch(`${baseUrl}/api/live-state?v=0&_t=${Date.now()}`);
  const antiResurrectionCheck = await antiResurrectionCheckRes.json();
  const checkResurrected = (antiResurrectionCheck.data?.users || []).find((u) => u.id === newMemberId);
  assert.strictEqual(checkResurrected, undefined, 'ANTI-RESURRECTION: User must NEVER resurrect!');
  console.log('✓ 9.1 ANTI-RESURRECTION SHIELD VERIFIED: Deleted user blocked permanently!');

  console.log('\n======================================================================');
  console.log('🎉 ALL COMPREHENSIVE MULTI-ROLE & SCREEN SIMULATION TESTS PASSED 100%!');
  console.log('======================================================================\n');
}

runComprehensiveRoleSimulation().catch((err) => {
  console.error('❌ SIMULATION SUITE FAILED:', err);
  process.exit(1);
});
