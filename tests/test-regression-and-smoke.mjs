import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  connectAuthEmulator
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  connectFirestoreEmulator
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
connectFirestoreEmulator(db, '127.0.0.1', 8080);

function usernameToAuthEmail(username) {
  const clean = username.trim().toLowerCase();
  const encoded = Buffer.from(clean, 'utf8').toString('hex');
  return `${encoded}@auth.k7-clan.local`;
}

function isUserStatsPending(user) {
  if (!user) return false;
  const reqTime = Number(user.pendingPowerLevelRequestedAt || 0);
  const approvalTime = Number(user.statApprovalAt || 0);
  const rejectionTime = Number(user.statRejectionAt || 0);
  const latestResolution = Math.max(approvalTime, rejectionTime);
  const hasPendingPL = typeof user.pendingPowerLevel === 'number' && user.pendingPowerLevel > 0;
  const hasPendingStats = Boolean(user.pendingStats && Object.keys(user.pendingStats).length > 0);
  const hasPendingSpirits = Boolean(user.pendingSpiritEnhancements && Object.keys(user.pendingSpiritEnhancements).length > 0);
  const hasPendingClasses = Array.isArray(user.pendingClasses) && user.pendingClasses.length > 0;
  const hasPendingLevel = typeof user.pendingLevel === 'number' && user.pendingLevel > 0;
  const hasPendingData = hasPendingPL || hasPendingStats || hasPendingSpirits || hasPendingClasses || hasPendingLevel;
  return hasPendingData && reqTime > latestResolution;
}

function deriveStatNotifications(users) {
  const pendingUsers = (users || []).filter(isUserStatsPending);
  return pendingUsers.map((u) => ({
    id: `stat_req_${u.id}_${u.pendingPowerLevelRequestedAt || 0}`,
    title: `${u.inGameName || u.username} (${u.clan || 'No Clan'}) ส่งคำขออัปเดตสเตตัส`,
    desc: `ค่าพลังใหม่: ⚡ ${(u.pendingPowerLevel || 0).toLocaleString()} PL (รอ Admin ตรวจสอบและอนุมัติ)`,
    userId: u.id,
    type: 'stat_request'
  }));
}

async function runRegressionAndSmokeTests() {
  console.log('=== STARTING REGRESSION & SMOKE TEST SUITE ===');

  // --- Step 0: Accounts setup ---
  console.log('\n--- 0. Setup accounts in Emulator Auth & Firestore ---');
  // Ensure unique usernames
  const timestamp = Date.now();
  const ownerEmail = usernameToAuthEmail('eloni');
  const ownerPass = '0386231334';
  const adminUsername = 'admin_reg_' + timestamp;
  const adminEmail = usernameToAuthEmail(adminUsername);
  const adminPass = 'password123';
  const memberUsername = 'member_reg_' + timestamp;
  const memberEmail = usernameToAuthEmail(memberUsername);
  const memberPass = 'password123';

  // 0.1 Owner
  let ownerAuthUid;
  try {
    const ownerCred = await signInWithEmailAndPassword(auth, ownerEmail, ownerPass);
    ownerAuthUid = ownerCred.user.uid;
  } catch {
    const ownerCred = await createUserWithEmailAndPassword(auth, ownerEmail, ownerPass);
    ownerAuthUid = ownerCred.user.uid;
  }
  console.log('  Owner authenticated in Auth. UID:', ownerAuthUid);

  // 0.2 Admin registers own pending document
  const adminCred = await createUserWithEmailAndPassword(auth, adminEmail, adminPass);
  const adminAuthUid = adminCred.user.uid;
  await setDoc(doc(db, 'users', adminAuthUid), {
    id: adminAuthUid,
    username: adminUsername,
    inGameName: 'SmokeAdmin',
    role: 'member',
    status: 'pending_approval',
    clan: 'no-clan',
    powerLevel: 0,
    createdAt: Date.now()
  });
  console.log('  Admin registered as pending. UID:', adminAuthUid);

  // 0.3 Member registers own pending document
  const memberCred = await createUserWithEmailAndPassword(auth, memberEmail, memberPass);
  const memberAuthUid = memberCred.user.uid;
  await setDoc(doc(db, 'users', memberAuthUid), {
    id: memberAuthUid,
    username: memberUsername,
    inGameName: 'SmokeMember',
    role: 'member',
    status: 'pending_approval',
    clan: 'no-clan',
    powerLevel: 0,
    createdAt: Date.now()
  });
  console.log('  Member registered as pending. UID:', memberAuthUid);

  // 0.4 Owner signs in to promote Admin & activate Member
  await signInWithEmailAndPassword(auth, ownerEmail, ownerPass);
  await updateDoc(doc(db, 'users', adminAuthUid), {
    role: 'admin',
    status: 'active',
    clan: 'VoltZ',
    powerLevel: 200000,
    updatedAt: Date.now()
  });
  await updateDoc(doc(db, 'users', memberAuthUid), {
    status: 'active',
    clan: 'VoltZ',
    powerLevel: 100000,
    updatedAt: Date.now()
  });
  console.log('  Admin promoted and Member activated by Owner in Emulator.');

  // ==========================================
  // Test 1: Member login & auth.currentUser != null
  // ==========================================
  console.log('\n--- 1. Member login: auth.currentUser != null ---');
  await signInWithEmailAndPassword(auth, memberEmail, 'password123');
  if (!auth.currentUser || auth.currentUser.uid !== memberAuthUid) {
    throw new Error('FAIL: Member is not authenticated in Firebase Auth');
  }
  console.log('  PASS: Member login succeeded. UID:', auth.currentUser.uid);

  // ==========================================
  // Test 2 & 3: Member submits stat update & all 9 fields persist
  // ==========================================
  console.log('\n--- 2 & 3. Member submits stat update & all 9 fields persist authoritatively ---');
  const reqTimestamp = Date.now();
  const docUpdates = {
    pendingPowerLevel: 145000,
    pendingPowerLevelRequestedAt: reqTimestamp,
    pendingStats: { stat_melee_atk: 300, stat_def: 350 },
    pendingSpiritEnhancements: { stat_spirit_blessing: 8 },
    pendingStatScreenshotUrl: 'https://example.com/screenshot_smoke.png',
    pendingClasses: ['Dual Blades', 'Spear'],
    pendingLevel: 80,
    pendingLegendClasses: 3,
    pendingLegendAgathions: 2,
    statRejectionReason: null,
    statRejectionAt: null,
    updatedAt: reqTimestamp
  };
  await updateDoc(doc(db, 'users', memberAuthUid), docUpdates);

  const memberSnap = await getDoc(doc(db, 'users', memberAuthUid));
  const memberData = memberSnap.data();
  const requiredFields = [
    'pendingPowerLevel',
    'pendingPowerLevelRequestedAt',
    'pendingStats',
    'pendingSpiritEnhancements',
    'pendingStatScreenshotUrl',
    'pendingClasses',
    'pendingLevel',
    'pendingLegendClasses',
    'pendingLegendAgathions'
  ];
  for (const field of requiredFields) {
    if (memberData[field] === undefined || memberData[field] === null) {
      throw new Error(`FAIL: Field ${field} did not persist!`);
    }
  }
  console.log('  PASS: All 9 fields persisted authoritatively in Firestore doc:');
  console.log('    pendingPowerLevel:', memberData.pendingPowerLevel);
  console.log('    pendingClasses:', memberData.pendingClasses);
  console.log('    pendingStats:', JSON.stringify(memberData.pendingStats));

  // ==========================================
  // Test 4 & 5: Reload / Owner receives pending + bell notification
  // ==========================================
  console.log('\n--- 4 & 5. Reload / Owner signs in & receives pending + bell notification ---');
  await signOut(auth);
  await signInWithEmailAndPassword(auth, usernameToAuthEmail('eloni'), '0386231334');
  console.log('  Owner signed in. UID:', auth.currentUser.uid);

  const ownerViewSnap = await getDoc(doc(db, 'users', memberAuthUid));
  const ownerViewUser = ownerViewSnap.data();
  if (!isUserStatsPending(ownerViewUser)) {
    throw new Error('FAIL: isUserStatsPending returned false for Owner view');
  }
  const notifs = deriveStatNotifications([ownerViewUser]);
  if (notifs.length !== 1) {
    throw new Error(`FAIL: Expected 1 notification for Owner, got ${notifs.length}`);
  }
  console.log('  PASS: Notification derived successfully:');
  console.log('    Title:', notifs[0].title);
  console.log('    Desc:', notifs[0].desc);

  // ==========================================
  // Test 6: Owner approves request
  // ==========================================
  console.log('\n--- 6. Owner approves request ---');
  const approvalTimestamp = Date.now();
  await updateDoc(doc(db, 'users', memberAuthUid), {
    powerLevel: ownerViewUser.pendingPowerLevel,
    stats: ownerViewUser.pendingStats,
    spiritEnhancements: ownerViewUser.pendingSpiritEnhancements,
    classes: ownerViewUser.pendingClasses,
    level: ownerViewUser.pendingLevel,
    legendClasses: ownerViewUser.pendingLegendClasses,
    legendAgathions: ownerViewUser.pendingLegendAgathions,
    pendingPowerLevel: null,
    pendingPowerLevelRequestedAt: null,
    pendingStats: null,
    pendingSpiritEnhancements: null,
    pendingStatScreenshotUrl: null,
    pendingClasses: null,
    pendingLevel: null,
    pendingLegendClasses: null,
    pendingLegendAgathions: null,
    statApprovalAt: approvalTimestamp,
    updatedAt: approvalTimestamp
  });
  const approvedSnap = await getDoc(doc(db, 'users', memberAuthUid));
  const approvedUser = approvedSnap.data();
  if (approvedUser.powerLevel !== 145000 || isUserStatsPending(approvedUser)) {
    throw new Error('FAIL: Approval did not apply stats or clear pending');
  }
  console.log('  PASS: Owner approved successfully. Member powerLevel is now:', approvedUser.powerLevel);

  // ==========================================
  // Test 7 & 8: New Member request & Admin receives pending + notif
  // ==========================================
  console.log('\n--- 7 & 8. New Member request & Admin receives pending + notif ---');
  await signOut(auth);
  await signInWithEmailAndPassword(auth, memberEmail, 'password123');
  const req2Timestamp = Date.now();
  await updateDoc(doc(db, 'users', memberAuthUid), {
    pendingPowerLevel: 180000,
    pendingPowerLevelRequestedAt: req2Timestamp,
    updatedAt: req2Timestamp
  });

  await signOut(auth);
  await signInWithEmailAndPassword(auth, adminEmail, 'password123');
  const adminViewSnap = await getDoc(doc(db, 'users', memberAuthUid));
  const adminViewUser = adminViewSnap.data();
  if (!isUserStatsPending(adminViewUser)) {
    throw new Error('FAIL: isUserStatsPending returned false for Admin view');
  }
  const adminNotifs = deriveStatNotifications([adminViewUser]);
  if (adminNotifs.length !== 1) {
    throw new Error(`FAIL: Expected 1 notification for Admin, got ${adminNotifs.length}`);
  }
  console.log('  PASS: Admin received pending review item and notification successfully');

  // ==========================================
  // Test 9 & 10: Admin rejects & Member reload sees rejection reason
  // ==========================================
  console.log('\n--- 9 & 10. Admin rejects & Member reload sees rejection reason ---');
  const rejectionTimestamp = Date.now();
  const reasonText = '📷 ภาพสกรีนช็อตไม่ชัดเจน หรือไม่เห็นชื่อตัวละคร';
  await updateDoc(doc(db, 'users', memberAuthUid), {
    pendingPowerLevel: null,
    pendingPowerLevelRequestedAt: null,
    pendingStats: null,
    pendingSpiritEnhancements: null,
    pendingStatScreenshotUrl: null,
    pendingClasses: null,
    pendingLevel: null,
    pendingLegendClasses: null,
    pendingLegendAgathions: null,
    statRejectionReason: reasonText,
    statRejectionAt: rejectionTimestamp,
    updatedAt: rejectionTimestamp
  });

  await signOut(auth);
  await signInWithEmailAndPassword(auth, memberEmail, 'password123');
  const memberRejectionSnap = await getDoc(doc(db, 'users', memberAuthUid));
  const memberRejected = memberRejectionSnap.data();
  if (memberRejected.statRejectionReason !== reasonText || isUserStatsPending(memberRejected)) {
    throw new Error('FAIL: Rejection reason not visible to member');
  }
  console.log('  PASS: Member reloaded and sees rejection reason:', memberRejected.statRejectionReason);

  // ==========================================
  // Test 11: Firestore failure simulation produces error, never success
  // ==========================================
  console.log('\n--- 11. Firestore failure simulation: unauthorized write fails ---');
  // Member attempts to write to Admin's user document
  let writeFailedAsExpected = false;
  try {
    await updateDoc(doc(db, 'users', adminAuthUid), {
      powerLevel: 999999
    });
  } catch (err) {
    writeFailedAsExpected = true;
    console.log('  PASS: Unauthorized write was rejected by Firestore rules as expected:', err.code);
  }
  if (!writeFailedAsExpected) {
    throw new Error('FAIL: Unauthorized write did NOT throw error!');
  }

  // ==========================================
  // ==========================================
  // Test 12: Smoke test member delete
  // ==========================================
  console.log('\n--- 12. Smoke test: Member delete ---');
  const delUsername = 'to_delete_' + Date.now();
  const delEmail = usernameToAuthEmail(delUsername);
  const delCred = await createUserWithEmailAndPassword(auth, delEmail, 'password123');
  const delUid = delCred.user.uid;
  await setDoc(doc(db, 'users', delUid), {
    id: delUid,
    username: delUsername,
    inGameName: 'ToDelete',
    role: 'member',
    status: 'pending_approval',
    clan: 'no-clan',
    powerLevel: 0,
    createdAt: Date.now()
  });

  await signInWithEmailAndPassword(auth, ownerEmail, ownerPass);
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, 'users', delUid));
  const deletedSnap = await getDoc(doc(db, 'users', delUid));
  if (deletedSnap.exists()) {
    throw new Error('FAIL: Member was not deleted from Firestore');
  }
  console.log('  PASS: Member deleted from Firestore successfully by Owner.');

  // ==========================================
  // Test 13: Smoke test queue create & delete
  // ==========================================
  console.log('\n--- 13. Smoke test: Queue create & delete ---');
  const queueItemId = 'queue_smoke_' + Date.now();
  await setDoc(doc(db, 'item_queues', queueItemId), {
    id: queueItemId,
    name: 'Smoke Boss Drop',
    createdAt: Date.now()
  });
  const queueSnap = await getDoc(doc(db, 'item_queues', queueItemId));
  if (!queueSnap.exists()) throw new Error('FAIL: Queue item create failed');
  await deleteDoc(doc(db, 'item_queues', queueItemId));
  const queueDeletedSnap = await getDoc(doc(db, 'item_queues', queueItemId));
  if (queueDeletedSnap.exists()) throw new Error('FAIL: Queue item delete failed');
  console.log('  PASS: Queue created and deleted successfully by Owner.');

  // ==========================================
  // Test 14: Smoke test claim & unclaim
  // ==========================================
  console.log('\n--- 14. Smoke test: Vault Item Claim & Unclaim ---');
  await signInWithEmailAndPassword(auth, ownerEmail, ownerPass);
  const vaultItemId = 'item_smoke_' + Date.now();
  await setDoc(doc(db, 'items', vaultItemId), {
    id: vaultItemId,
    name: 'Smoke Weapon',
    status: 'available',
    price: 0,
    claimants: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  });

  await signInWithEmailAndPassword(auth, memberEmail, memberPass);
  const claimTimestamp = Date.now();
  await updateDoc(doc(db, 'items', vaultItemId), {
    claimants: [{
      userId: memberAuthUid,
      inGameName: 'SmokeMember',
      claimedAt: claimTimestamp
    }],
    updatedAt: claimTimestamp
  });
  const claimedSnap = await getDoc(doc(db, 'items', vaultItemId));
  if (claimedSnap.data()?.claimants?.length !== 1) {
    throw new Error('FAIL: Claim failed to record claimant');
  }
  console.log('  PASS: Member claimed item successfully.');

  // Member unclaims item
  const unclaimTimestamp = Date.now();
  await updateDoc(doc(db, 'items', vaultItemId), {
    claimants: [],
    updatedAt: unclaimTimestamp
  });
  const unclaimedSnap = await getDoc(doc(db, 'items', vaultItemId));
  if (unclaimedSnap.data()?.claimants?.length !== 0) {
    throw new Error('FAIL: Unclaim failed to remove claimant');
  }
  console.log('  PASS: Member unclaimed item successfully.');

  // ==========================================
  // Test 15: Smoke test general queue join & leave
  // ==========================================
  console.log('\n--- 15. Smoke test: General queue item creation & management ---');
  await signInWithEmailAndPassword(auth, ownerEmail, ownerPass);
  const genItemId = 'gen_smoke_' + Date.now();
  await setDoc(doc(db, 'general_items', genItemId), {
    id: genItemId,
    name: 'General Smoke Potion',
    imageUrl: 'https://example.com/potion.png',
    price: 10,
    quantity: 5,
    minPowerLevel: 0,
    rarity: 'RARE',
    queueList: [],
    receiptHistory: [],
    createdAt: Date.now()
  });
  const genSnap = await getDoc(doc(db, 'general_items', genItemId));
  if (!genSnap.exists()) throw new Error('FAIL: General item creation failed');
  await deleteDoc(doc(db, 'general_items', genItemId));
  const genDeletedSnap = await getDoc(doc(db, 'general_items', genItemId));
  if (genDeletedSnap.exists()) throw new Error('FAIL: General item deletion failed');
  console.log('  PASS: General queue item created and deleted successfully.');

  // ==========================================
  // Test 16: Smoke test Owner/Admin login
  // ==========================================
  console.log('\n--- 16. Smoke test: Owner & Admin login ---');
  await signOut(auth);
  await signInWithEmailAndPassword(auth, adminEmail, adminPass);
  if (!auth.currentUser || auth.currentUser.uid !== adminAuthUid) throw new Error('FAIL: Admin login failed');
  console.log('  PASS: Admin login verified. UID:', auth.currentUser.uid);

  await signOut(auth);
  await signInWithEmailAndPassword(auth, ownerEmail, ownerPass);
  if (!auth.currentUser || auth.currentUser.uid !== ownerAuthUid) throw new Error('FAIL: Owner login failed');
  console.log('  PASS: Owner login verified. UID:', auth.currentUser.uid);

  console.log('\n=== ALL REGRESSION & SMOKE TESTS PASSED (16/16) ===');
}

runRegressionAndSmokeTests().catch((err) => {
  console.error('\n*** TEST FAILED ***', err);
  process.exit(1);
});
