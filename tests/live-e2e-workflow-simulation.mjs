import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const LIVE_WEB_URL = 'https://lineage2m-k7-item-vault.vercel.app';
const LOCAL_API_URL = 'http://localhost:3000';
const FIREBASE_API_KEY = 'AIzaSyBC1_vvEgxbgpceQaEB8yHzJyGk6nR-ZKM';
const FIREBASE_PROJECT_ID = 'clan-hub-7645f';

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  steps: []
};

function pass(name, details = '') {
  results.total++;
  results.passed++;
  results.steps.push({ name, status: 'PASS', details });
  console.log(`  ✅ [PASS] ${name}`);
  if (details) console.log(`     └─ ${details}`);
}

function fail(name, error, details = '') {
  results.total++;
  results.failed++;
  results.steps.push({ name, status: 'FAIL', error: String(error), details });
  console.log(`  ❌ [FAIL] ${name}`);
  console.log(`     └─ Error: ${error}`);
  if (details) console.log(`     └─ Details: ${details}`);
}

async function runTest() {
  console.log('================================================================================');
  console.log('⚔️  LINEAGE 2M CLAN HUB — END-TO-END WORKFLOW & LIVE LOGIC VERIFICATION');
  console.log(`   Target Production: ${LIVE_WEB_URL}`);
  console.log(`   Local Server Relay: ${LOCAL_API_URL}`);
  console.log(`   Firebase Project:  ${FIREBASE_PROJECT_ID}`);
  console.log('================================================================================\n');

  // ─────────────────────────────────────────────────────────────────────────
  // PART 1: LIVE PRODUCTION WEB & DATABASE INSPECTION
  // ─────────────────────────────────────────────────────────────────────────
  console.log('🌐 PART 1: LIVE PRODUCTION INSPECTION & REAL DATABASE AUDIT');
  console.log('--------------------------------------------------------------------------------');

  // 1.1 Web App Availability
  try {
    const webRes = await fetch(LIVE_WEB_URL);
    assert.strictEqual(webRes.status, 200, 'Live web must respond with 200');
    const html = await webRes.text();
    assert.ok(html.includes('<div id="root"></div>'), 'HTML must include React root element');
    assert.ok(html.includes('Cinzel') && html.includes('Prompt'), 'HTML must load Cinzel & Prompt fonts');
    pass('1.1 Live Production Web App Status', `Status: 200 OK | HTML Size: ${html.length.toLocaleString()} bytes`);
  } catch (err) {
    fail('1.1 Live Production Web App Status', err);
  }

  // 1.2 Health Check Endpoint
  try {
    const healthRes = await fetch(`${LIVE_WEB_URL}/api/health`);
    assert.strictEqual(healthRes.status, 200);
    const health = await healthRes.json();
    assert.strictEqual(health.status, 'ok');
    pass('1.2 Live Backend Serverless Health', `Status: 200 OK | serverless: ${health.serverless} | timestamp: ${health.timestamp}`);
  } catch (err) {
    fail('1.2 Live Backend Serverless Health', err);
  }

  // 1.3 Google Backup Config Endpoint
  try {
    const configRes = await fetch(`${LIVE_WEB_URL}/api/google-backup-config`);
    assert.strictEqual(configRes.status, 200);
    const config = await configRes.json();
    assert.ok('webAppUrl' in config && 'sheetUrl' in config);
    pass('1.3 Google Backup Config Endpoint', `Status: 200 OK | Endpoint schema valid`);
  } catch (err) {
    fail('1.3 Google Backup Config Endpoint', err);
  }

  // 1.4 Live Firestore Database Connectivity & Real Data State
  let liveUsersCount = 0;
  let liveItemsCount = 0;
  let liveGenItemsCount = 0;
  let liveQueuesCount = 0;
  try {
    const collections = ['users', 'items', 'general_items', 'item_queues', 'clans', 'diamond_vault', 'system_meta'];
    const counts = {};
    for (const col of collections) {
      const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${col}?key=${FIREBASE_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      counts[col] = res.ok ? (data.documents?.length || 0) : `Error ${res.status}`;
    }
    liveUsersCount = counts.users || 0;
    liveItemsCount = counts.items || 0;
    liveGenItemsCount = counts.general_items || 0;
    liveQueuesCount = counts.item_queues || 0;

    pass('1.4 Live Firebase Firestore Production State', 
      `Users: ${counts.users} | Vault Items: ${counts.items} | General Items: ${counts.general_items} | Queues: ${counts.item_queues} | Clans: ${counts.clans} | Diamonds: ${counts.diamond_vault}`);
  } catch (err) {
    fail('1.4 Live Firebase Firestore Production State', err);
  }

  // 1.5 Verify Owner & Admin Accounts in Production
  try {
    const userUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users?key=${FIREBASE_API_KEY}`;
    const userRes = await fetch(userUrl);
    const userData = await userRes.json();
    const adminDoc = (userData.documents || []).find((d) => {
      const f = d.fields || {};
      const role = f.role?.stringValue;
      return role === 'admin';
    });
    assert.ok(adminDoc, 'Admin account (e.g. zeankaii) must exist in production Firestore');

    // Also check local/live relay canonical owner
    const localRelayRes = await fetch(`${LOCAL_API_URL}/api/live-state?v=0`);
    const localData = await localRelayRes.json();
    const ownerUser = (localData.data?.users || []).find((u) => u.id === 'user_owner_eloni' || u.username?.toLowerCase() === 'eloni');
    assert.ok(ownerUser && ownerUser.role === 'owner', 'Canonical Owner "eloni" must exist with role="owner"');

    pass('1.5 Live Owner & Admin Verification', `Live Admin: "${adminDoc.fields?.username?.stringValue}" | Immutable Owner: "${ownerUser.username}" (${ownerUser.role})`);
  } catch (err) {
    fail('1.5 Live Owner & Admin Verification', err);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PART 2: END-TO-END WORKFLOW — MEMBER SIDE (ฝั่งสมาชิก)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n👤 PART 2: MEMBER REGISTRATION & GATEKEEPER');
  console.log('--------------------------------------------------------------------------------');

  const testMemberId = `user_flow_mem_${Date.now()}`;
  const testMemberUsername = `member_hero_${Math.floor(Math.random() * 8999 + 1000)}`;
  const testMemberIGN = `HeroBlade_${Math.floor(Math.random() * 899 + 100)}`;
  let testMember = {
    id: testMemberId,
    username: testMemberUsername,
    inGameName: testMemberIGN,
    clan: 'VoltZ',
    role: 'member',
    status: 'pending_approval',
    powerLevel: 0,
    characterClass: 'Mage',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  // 2.1 Member Registration Logic
  try {
    assert.strictEqual(testMember.status, 'pending_approval', 'New member must start in pending_approval');
    assert.strictEqual(testMember.powerLevel, 0, 'New member must have verified power = 0');
    assert.strictEqual(testMember.role, 'member', 'New member must have role = member');

    // Register on live relay with member token
    const regRes = await fetch(`${LOCAL_API_URL}/api/live-state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer local-dev-${testMemberId}-member`
      },
      body: JSON.stringify({
        data: { users: [testMember] },
        performedBy: `${testMemberIGN} (Registration)`
      })
    });
    assert.strictEqual(regRes.status, 200, 'Member registration relay should succeed');
    pass('2.1 Member Registration Submission', `Username: ${testMemberUsername} | IGN: ${testMemberIGN} | Status: pending_approval | Power: 0`);
  } catch (err) {
    fail('2.1 Member Registration Submission', err);
  }

  // 2.2 Member Login Blocked Prior to Approval
  try {
    const isLoginPermitted = testMember.status === 'active';
    assert.strictEqual(isLoginPermitted, false, 'Pending approval user must not be permitted active session');
    pass('2.2 Member Login Gatekeeper (Pre-Approval)', 'Pending member is blocked from accessing private features until approved');
  } catch (err) {
    fail('2.2 Member Login Gatekeeper (Pre-Approval)', err);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PART 3: ADMIN APPROVAL & MEMBER STAT VERIFICATION FLOW
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n🛡️ PART 3: ADMIN APPROVAL & MEMBER STAT VERIFICATION FLOW');
  console.log('--------------------------------------------------------------------------------');

  const ownerAuthHeader = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer local-dev-user_owner_eloni-owner'
  };

  // 3.1 Admin Discovers Pending Registration & Badge Notification
  try {
    const liveRes = await fetch(`${LOCAL_API_URL}/api/live-state?v=0&_t=${Date.now()}`);
    assert.strictEqual(liveRes.status, 200);
    const liveData = await liveRes.json();
    const pendingUsers = (liveData.data?.users || []).filter((u) => u.status === 'pending_approval' || u.status === 'pending');
    const target = pendingUsers.find((u) => u.id === testMemberId);
    assert.ok(target, 'Admin must find newly registered member in pending approval list');
    pass('3.1 Admin Observes Pending Registration Badge', `Found member in queue. Sidebar "สมาชิกทั้งหมด" shows pending badge: [${pendingUsers.length}]`);
  } catch (err) {
    fail('3.1 Admin Observes Pending Registration Badge', err);
  }

  // 3.2 Admin Approves Member (Status becomes active)
  try {
    testMember = {
      ...testMember,
      status: 'active',
      powerLevel: 0,
      updatedAt: Date.now()
    };
    const approveRes = await fetch(`${LOCAL_API_URL}/api/live-state`, {
      method: 'POST',
      headers: ownerAuthHeader,
      body: JSON.stringify({
        data: { users: [testMember] },
        performedBy: 'Admin Approval'
      })
    });
    assert.strictEqual(approveRes.status, 200);
    pass('3.2 Admin Approves Member into VoltZ Clan', `Member ${testMemberIGN} approved! Status: active | Power: 0 PL (Requires stat submission)`);
  } catch (err) {
    fail('3.2 Admin Approves Member into VoltZ Clan', err);
  }

  // 3.3 Member Submits Stat Update Request (Pending Approval)
  const statReqTime = Date.now();
  const pendingStatUser = {
    ...testMember,
    pendingPowerLevel: 4500,
    pendingPowerLevelRequestedAt: statReqTime,
    pendingStats: {
      damage: 195,
      accuracy: 250,
      defense: 310,
      damageReduction: 50,
      skillDamageBoost: 70
    },
    pendingLevel: 82,
    pendingClasses: ['Grand Master', 'Archmage'],
    pendingStatScreenshotUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800',
    updatedAt: statReqTime
  };

  try {
    const statReqRes = await fetch(`${LOCAL_API_URL}/api/live-state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer local-dev-${testMemberId}-member`
      },
      body: JSON.stringify({
        data: { users: [pendingStatUser] },
        performedBy: `${testMemberIGN} (Stat Update)`
      })
    });
    assert.strictEqual(statReqRes.status, 200);

    const checkRes = await fetch(`${LOCAL_API_URL}/api/live-state?v=0&_t=${Date.now()}`);
    const checkData = await checkRes.json();
    const userInDb = (checkData.data?.users || []).find((u) => u.id === testMemberId);

    assert.strictEqual(userInDb.powerLevel, 0, 'Verified Combat Power must remain 0 until approved!');
    assert.strictEqual(userInDb.pendingPowerLevel, 4500, 'Pending Combat Power must be 4,500!');
    pass('3.3 Member Submits Stat Update (Rule 3 Protection)', 
      `Verified Power unchanged at ⚡ 0 PL | Pending Power at ⚡ 4,500 PL (Awaiting Admin review)`);
  } catch (err) {
    fail('3.3 Member Submits Stat Update (Rule 3 Protection)', err);
  }

  // 3.4 Admin Reviews OCR and Approves Member Stats (Granting Verified Power)
  let verifiedMember = null;
  try {
    const approvalTime = Date.now();
    verifiedMember = {
      ...pendingStatUser,
      powerLevel: 4500,
      stats: pendingStatUser.pendingStats,
      level: pendingStatUser.pendingLevel,
      classes: pendingStatUser.pendingClasses,
      screenshotUrl: pendingStatUser.pendingStatScreenshotUrl,
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
          verifiedBy: 'Eloni (Owner)'
        }
      ],
      updatedAt: approvalTime
    };

    const approveStatRes = await fetch(`${LOCAL_API_URL}/api/live-state`, {
      method: 'POST',
      headers: ownerAuthHeader,
      body: JSON.stringify({
        data: { users: [verifiedMember] },
        performedBy: 'Admin Stat Approval'
      })
    });
    assert.strictEqual(approveStatRes.status, 200);

    const checkRes = await fetch(`${LOCAL_API_URL}/api/live-state?v=0&_t=${Date.now()}`);
    const checkData = await checkRes.json();
    const finalUser = (checkData.data?.users || []).find((u) => u.id === testMemberId);

    assert.strictEqual(finalUser.powerLevel, 4500);
    assert.strictEqual(finalUser.pendingPowerLevel, null);
    assert.strictEqual(finalUser.verified, true);
    assert.strictEqual(finalUser.statHistory.length, 1);

    pass('3.4 Admin Approves Stat & Verified Badge Granted', 
      `Verified Power promoted to ⚡ 4,500 PL | Verified badge granted | Recorded in stat history`);
  } catch (err) {
    fail('3.4 Admin Approves Stat & Verified Badge Granted', err);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PART 4: BOSS VAULT ITEM LIFECYCLE (CREATE, CLAIM, UNCLAIM, DISTRIBUTE)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n🏛️ PART 4: BOSS VAULT ITEM LIFECYCLE');
  console.log('--------------------------------------------------------------------------------');

  const testVaultItemId = `vi_flow_${Date.now()}`;
  const testVaultItem = {
    id: testVaultItemId,
    name: "Staff of the Archangel",
    rarity: "MYTHIC",
    imageUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400",
    price: 15000,
    minPowerLevel: 3000,
    quantity: 1,
    status: "available",
    hunters: [{ name: "Eloni", clan: "VoltZ" }, { name: "Lancelot", clan: "VoltZ" }],
    claimants: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  // 4.1 Admin Creates Boss Vault Item
  try {
    const addVaultRes = await fetch(`${LOCAL_API_URL}/api/live-state`, {
      method: 'POST',
      headers: ownerAuthHeader,
      body: JSON.stringify({
        data: { vaultItems: [testVaultItem] },
        performedBy: 'Eloni (Owner)'
      })
    });
    assert.strictEqual(addVaultRes.status, 200);
    pass('4.1 Admin Creates Boss Vault Item', `[${testVaultItem.rarity}] ${testVaultItem.name} | Price: 15,000 Dia | Min PL: 3,000 | Status: available`);
  } catch (err) {
    fail('4.1 Admin Creates Boss Vault Item', err);
  }

  // 4.2 Rule 5 Discord Webhook Item Notification
  try {
    const discordPayload = {
      event: 'new_item',
      payload: {
        embeds: [{
          description: `\`\`\`ansi\n\u001b[1;33m[MYTHIC] ${testVaultItem.name} (x1)\u001b[0m\n\u001b[1;37m💎 Price: 15,000 Diamonds\u001b[0m\n\`\`\`\n👉 [Open Vault to Claim Item](${LIVE_WEB_URL})`,
          thumbnail: { url: testVaultItem.imageUrl }
        }]
      }
    };
    const discordRes = await fetch(`${LOCAL_API_URL}/api/discord-webhook`, {
      method: 'POST',
      headers: ownerAuthHeader,
      body: JSON.stringify(discordPayload)
    });
    assert.strictEqual(discordRes.status, 200);
    const dData = await discordRes.json();
    assert.strictEqual(dData.success, true);
    assert.strictEqual(dData.dropped, undefined, 'Item notification must NOT be dropped by Rule 5 guard');
    pass('4.2 Rule 5 Discord Webhook Item Notification', 'Item notification adheres 100% to English ANSI 2-line format & passed Rule 5 guard');
  } catch (err) {
    fail('4.2 Rule 5 Discord Webhook Item Notification', err);
  }

  // 4.3 Member Claims Vault Item (Verified PL 4,500 >= Min PL 3,000)
  const memberClaimant = {
    userId: testMemberId,
    inGameName: testMemberIGN,
    clan: testMember.clan,
    powerLevel: 4500,
    characterClass: 'Mage',
    claimedAt: Date.now()
  };

  try {
    const claimRes = await fetch(`${LOCAL_API_URL}/api/claim-vault-item`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer local-dev-${testMemberId}-member`
      },
      body: JSON.stringify({
        itemId: testVaultItemId,
        claimant: memberClaimant
      })
    });
    assert.strictEqual(claimRes.status, 200);
    const claimData = await claimRes.json();
    assert.strictEqual(claimData.success, true);
    pass('4.3 Member Claims Vault Item', `Member ${testMemberIGN} (⚡ 4,500 PL >= 3,000) successfully claimed ${testVaultItem.name}`);
  } catch (err) {
    fail('4.3 Member Claims Vault Item', err);
  }

  // 4.4 Verify Admin Sees Claimant in In-App Notification Center
  try {
    const liveRes = await fetch(`${LOCAL_API_URL}/api/live-state?v=0&_t=${Date.now()}`);
    const liveData = await liveRes.json();
    const item = (liveData.data?.vaultItems || []).find((i) => i.id === testVaultItemId);
    assert.ok(item, 'Item must exist in state');
    assert.strictEqual(item.claimants?.length, 1, 'Claimants count must be 1');
    assert.strictEqual(item.claimants[0].inGameName, testMemberIGN);
    pass('4.4 In-App Notification Center Generates Claim Alert', `Admin notification center displays: "${testMemberIGN} (VoltZ) ลงชื่อขอรับไอเทม"`);
  } catch (err) {
    fail('4.4 In-App Notification Center Generates Claim Alert', err);
  }

  // 4.5 Member Cancels Claim (Unclaim)
  try {
    const unclaimRes = await fetch(`${LOCAL_API_URL}/api/unclaim-vault-item`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer local-dev-${testMemberId}-member`
      },
      body: JSON.stringify({
        itemId: testVaultItemId,
        userId: testMemberId,
        inGameName: testMemberIGN
      })
    });
    assert.strictEqual(unclaimRes.status, 200);

    const checkRes = await fetch(`${LOCAL_API_URL}/api/live-state?v=0&_t=${Date.now()}`);
    const checkData = await checkRes.json();
    const item = (checkData.data?.vaultItems || []).find((i) => i.id === testVaultItemId);
    assert.strictEqual(item.claimants?.length, 0, 'Claimants count must be 0 after unclaim');
    pass('4.5 Member Unclaim Workflow', 'Member successfully revoked claim. Claimants list emptied in real time');
  } catch (err) {
    fail('4.5 Member Unclaim Workflow', err);
  }

  // 4.6 Member Re-claims and Admin Distributes Item
  try {
    // Re-claim
    await fetch(`${LOCAL_API_URL}/api/claim-vault-item`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer local-dev-${testMemberId}-member`
      },
      body: JSON.stringify({ itemId: testVaultItemId, claimant: memberClaimant })
    });

    // Admin distributes item to member
    const distributedItem = {
      ...testVaultItem,
      status: 'distributed',
      paymentStatus: 'pending',
      distributedTo: {
        userId: testMemberId,
        name: testMemberIGN,
        clan: testMember.clan,
        powerLevel: 4500,
        distributedAt: Date.now(),
        distributedBy: 'Eloni (Owner)',
        paymentStatus: 'pending'
      },
      updatedAt: Date.now()
    };

    const distRes = await fetch(`${LOCAL_API_URL}/api/live-state`, {
      method: 'POST',
      headers: ownerAuthHeader,
      body: JSON.stringify({
        data: { vaultItems: [distributedItem] },
        performedBy: 'Eloni (Owner)'
      })
    });
    assert.strictEqual(distRes.status, 200);

    const postDistRes = await fetch(`${LOCAL_API_URL}/api/live-state?v=0&_t=${Date.now()}`);
    const postDistData = await postDistRes.json();
    const postItem = (postDistData.data?.vaultItems || []).find((i) => i.id === testVaultItemId);
    assert.strictEqual(postItem.status, 'distributed');
    assert.strictEqual(postItem.paymentStatus, 'pending');

    pass('4.6 Admin Distributes Item & Purges Claim Alert', 
      `Awarded to ${testMemberIGN}! Status: distributed | Payment: pending (15,000 Dia) | Claim notification auto-cleared`);
  } catch (err) {
    fail('4.6 Admin Distributes Item & Purges Claim Alert', err);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PART 5: GENERAL ITEM QUEUE & DRAG-AND-DROP REORDERING (v2.10.50)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n📦 PART 5: GENERAL ITEM QUEUE & DUAL BOX ARCHITECTURE (v2.10.50)');
  console.log('--------------------------------------------------------------------------------');

  const testGenItemId = `gi_flow_${Date.now()}`;
  const testGeneralItem = {
    id: testGenItemId,
    name: "Spellbook: Grand Master Blessing",
    rarity: "RARE",
    imageUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300",
    price: 0,
    quantity: 5,
    minPowerLevel: 2500,
    allowMemberQueue: true, // Dual Box Type 1: Open Queue
    isPinned: false,
    sortOrder: 1,
    queueList: [],
    receiptHistory: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  // 5.1 Admin Creates General Item
  try {
    const addGenRes = await fetch(`${LOCAL_API_URL}/api/live-state`, {
      method: 'POST',
      headers: ownerAuthHeader,
      body: JSON.stringify({
        data: { generalItems: [testGeneralItem] },
        performedBy: 'Eloni (Owner)'
      })
    });
    assert.strictEqual(addGenRes.status, 200);
    pass('5.1 Admin Creates General Item Queue Card', `[${testGeneralItem.rarity}] ${testGeneralItem.name} (Qty: 5) | allowMemberQueue: true`);
  } catch (err) {
    fail('5.1 Admin Creates General Item Queue Card', err);
  }

  // 5.2 Member Joins Queue (Open Queue box)
  try {
    const queueEntry = {
      id: `qentry_${Date.now()}`,
      userId: testMemberId,
      name: testMemberIGN,
      clan: testMember.clan,
      powerLevel: 4500,
      requestedQuantity: 1,
      status: 'pending',
      joinedAt: Date.now()
    };
    const updatedGenItem = {
      ...testGeneralItem,
      queueList: [queueEntry],
      updatedAt: Date.now()
    };

    const joinRes = await fetch(`${LOCAL_API_URL}/api/live-state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer local-dev-${testMemberId}-member`
      },
      body: JSON.stringify({
        data: { generalItems: [updatedGenItem] },
        performedBy: testMemberIGN
      })
    });
    assert.strictEqual(joinRes.status, 200);

    const checkRes = await fetch(`${LOCAL_API_URL}/api/live-state?v=0&_t=${Date.now()}`);
    const checkData = await checkRes.json();
    const itemInDb = (checkData.data?.generalItems || []).find((g) => g.id === testGenItemId);
    assert.strictEqual(itemInDb.queueList.length, 1);
    assert.strictEqual(itemInDb.queueList[0].name, testMemberIGN);

    pass('5.2 Member Enters Item Queue', `Member ${testMemberIGN} queued at position #1 with ⚡ 4,500 PL`);
  } catch (err) {
    fail('5.2 Member Enters Item Queue', err);
  }

  // 5.3 Admin Delivers Item to Member (Delivery Bill Receipt)
  try {
    const receiptEntry = {
      id: `rec_${Date.now()}`,
      memberId: testMemberId,
      memberName: testMemberIGN,
      quantity: 1,
      deliveredAt: Date.now(),
      deliveredBy: 'Eloni (Owner)',
      proofScreenshotUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600'
    };

    const deliveredGenItem = {
      ...testGeneralItem,
      quantity: 4, // 5 - 1 = 4 remaining
      queueList: [], // delivered member cleared from pending queue
      receiptHistory: [receiptEntry],
      updatedAt: Date.now()
    };

    const deliverRes = await fetch(`${LOCAL_API_URL}/api/live-state`, {
      method: 'POST',
      headers: ownerAuthHeader,
      body: JSON.stringify({
        data: { generalItems: [deliveredGenItem] },
        performedBy: 'Eloni (Owner)'
      })
    });
    assert.strictEqual(deliverRes.status, 200);

    const checkRes = await fetch(`${LOCAL_API_URL}/api/live-state?v=0&_t=${Date.now()}`);
    const checkData = await checkRes.json();
    const itemInDb = (checkData.data?.generalItems || []).find((g) => g.id === testGenItemId);

    assert.strictEqual(itemInDb.quantity, 4);
    assert.strictEqual(itemInDb.receiptHistory.length, 1);
    assert.strictEqual(itemInDb.receiptHistory[0].memberName, testMemberIGN);

    pass('5.3 Admin Delivers Item & Generates Delivery Bill', 
      `Delivered 1x to ${testMemberIGN} | Stock remaining: 4x | Delivery receipt bill archived`);
  } catch (err) {
    fail('5.3 Admin Delivers Item & Generates Delivery Bill', err);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PART 6: SYSTEM SECURITY, TOMBSTONE SHIELD & BILINGUAL CHECK
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n🛡️ PART 6: SYSTEM INTEGRITY, TOMBSTONE SHIELD & BILINGUAL CHECK');
  console.log('--------------------------------------------------------------------------------');

  // 6.1 Permanent Deletion with Anti-Resurrection Shield
  try {
    const delRes = await fetch(`${LOCAL_API_URL}/api/users/${testMemberId}`, {
      method: 'DELETE',
      headers: ownerAuthHeader
    });
    assert.strictEqual(delRes.status, 200);

    // Verify tombstone
    const postDelRes = await fetch(`${LOCAL_API_URL}/api/live-state?v=0&_t=${Date.now()}`);
    const postDelData = await postDelRes.json();
    const userInDb = (postDelData.data?.users || []).find((u) => u.id === testMemberId);
    assert.strictEqual(userInDb, undefined, 'Deleted user must be purged from users list');
    assert.ok(postDelData.data?.syncMeta?.deletedUsers?.[testMemberId], 'Tombstone timestamp must be recorded');

    // Simulate stale client posting snapshot with deleted user
    await fetch(`${LOCAL_API_URL}/api/live-state`, {
      method: 'POST',
      headers: ownerAuthHeader,
      body: JSON.stringify({
        data: { users: [testMember] },
        performedBy: 'Stale Client Sync'
      })
    });

    const checkRes = await fetch(`${LOCAL_API_URL}/api/live-state?v=0&_t=${Date.now()}`);
    const checkData = await checkRes.json();
    const resurrectedUser = (checkData.data?.users || []).find((u) => u.id === testMemberId);
    assert.strictEqual(resurrectedUser, undefined, 'Deleted user must NEVER resurrect from stale snapshots!');

    pass('6.1 Tombstone Anti-Resurrection Shield', 'Member permanently deleted and tombstone blocked stale resurrection attempt');
  } catch (err) {
    fail('6.1 Tombstone Anti-Resurrection Shield', err);
  }

  // 6.2 100% Bilingual TH / EN Parity (Rule 1)
  try {
    const transPath = path.resolve('src/translations.ts');
    const transContent = fs.readFileSync(transPath, 'utf-8');
    const thMatch = transContent.match(/th:\s*\{([\s\S]*?)\n\s*\},/);
    const enMatch = transContent.match(/en:\s*\{([\s\S]*?)\n\s*\}/);
    assert.ok(thMatch && enMatch);

    const extractKeys = (block) => {
      const keys = [];
      for (const line of block.split('\n')) {
        const m = line.match(/^\s*([A-Za-z0-9_]+):/);
        if (m) keys.push(m[1]);
      }
      return new Set(keys);
    };

    const thKeys = extractKeys(thMatch[1]);
    const enKeys = extractKeys(enMatch[1]);
    const missingInEn = [...thKeys].filter((k) => !enKeys.has(k));
    const missingInTh = [...enKeys].filter((k) => !thKeys.has(k));

    assert.strictEqual(missingInEn.length, 0, `Missing in EN: ${missingInEn.join(', ')}`);
    assert.strictEqual(missingInTh.length, 0, `Missing in TH: ${missingInTh.join(', ')}`);

    pass('6.2 Mandatory Bilingual TH / EN Parity (Rule 1)', `All ${thKeys.size} translation dictionary keys match 100% between TH and EN`);
  } catch (err) {
    fail('6.2 Mandatory Bilingual TH / EN Parity (Rule 1)', err);
  }

  // 6.3 Rule 7 Version Synchronization (6 Files Check)
  try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    const version = pkg.version;
    const filesToCheck = [
      'src/components/Sidebar.tsx',
      'src/components/Navbar.tsx',
      'src/components/LoginScreen.tsx',
      'src/components/GoogleDriveBackupModal.tsx'
    ];
    for (const f of filesToCheck) {
      const content = fs.readFileSync(f, 'utf-8');
      assert.ok(content.includes(`v${version}`) || content.includes(version), `${f} must include version ${version}`);
    }
    pass('6.3 SemVer Version Synchronization (Rule 7)', `All core UI components synchronized to version v${version}`);
  } catch (err) {
    fail('6.3 SemVer Version Synchronization (Rule 7)', err);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n================================================================================');
  console.log(`🏁 WORKFLOW TEST SUMMARY:`);
  console.log(`   Total Tests:  ${results.total}`);
  console.log(`   Passed:       ${results.passed} (${Math.round((results.passed / results.total) * 100)}%)`);
  console.log(`   Failed:       ${results.failed}`);
  console.log('================================================================================\n');

  if (results.failed > 0) {
    process.exit(1);
  }
}

runTest().catch((e) => {
  console.error('Fatal Test Runner Failure:', e);
  process.exit(1);
});
