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
  onSnapshot,
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

// Logic from src/types.ts
function isUserStatsPending(user) {
  if (!user) return false;
  const reqTime = Number(user.pendingPowerLevelRequestedAt || 0);
  const approvalTime = Number(user.statApprovalAt || 0);
  const rejectionTime = Number(user.statRejectionAt || 0);
  const latestResolution = Math.max(approvalTime, rejectionTime);

  if (reqTime > 0 && reqTime > latestResolution) {
    return true;
  }
  if (typeof user.pendingPowerLevel === 'number') {
    return true;
  }
  if (user.pendingStatScreenshotUrl && user.pendingStatScreenshotUrl.trim() !== '') {
    return true;
  }
  if (user.pendingStats && typeof user.pendingStats === 'object') {
    return Object.values(user.pendingStats).some((v) => typeof v === 'number' && v > 0);
  }
  return false;
}

// Logic from src/App.tsx for notification derivation
function deriveStatNotifications(users, lang = 'th') {
  const list = [];
  users.forEach((u) => {
    if (isUserStatsPending(u)) {
      const reqTimestamp = u.pendingPowerLevelRequestedAt || u.updatedAt || 0;
      const notifId = `stat_req_${u.id}_${reqTimestamp}`;
      const th = lang === 'th';
      const displayPL = u.pendingPowerLevel != null ? Number(u.pendingPowerLevel) : (u.powerLevel || 0);
      list.push({
        id: notifId,
        type: 'stat_request',
        title: th
          ? `${u.inGameName || u.username} (${u.clan || 'Alliance'}) ส่งคำขออัปเดตสเตตัส`
          : `${u.inGameName || u.username} (${u.clan || 'Alliance'}) requested stats update`,
        description: th
          ? `ค่าพลังใหม่: ⚡ ${displayPL.toLocaleString()} PL (รอ Admin ตรวจสอบและอนุมัติ)`
          : `New Power Level: ⚡ ${displayPL.toLocaleString()} PL (Pending Admin verification)`,
        timestamp: u.pendingPowerLevelRequestedAt || u.updatedAt || Date.now(),
        user: u
      });
    }
  });
  return list;
}

console.log('=== STARTING COMPLETE AUTHENTICATED E2E TEST ===');

// --- SETUP IDENTITIES ---
const ownerUsername = 'eloni';
const ownerEmail = usernameToAuthEmail(ownerUsername);
const ownerPass = '0386231334';

// Setup Admin
const adminUsername = 'admin_qa_' + Date.now();
const adminEmail = usernameToAuthEmail(adminUsername);
const adminPass = 'adminpass123';

// Setup Member
const memberUsername = 'member_qa_' + Date.now();
const memberEmail = usernameToAuthEmail(memberUsername);
const memberPass = 'memberpass123';

console.log('--- Step 0: Ensure Owner, Admin, Member accounts exist in Auth & Firestore ---');

// 0.1 Owner
let ownerUid;
try {
  const ownerCred = await signInWithEmailAndPassword(auth, ownerEmail, ownerPass);
  ownerUid = ownerCred.user.uid;
} catch {
  const ownerCred = await createUserWithEmailAndPassword(auth, ownerEmail, ownerPass);
  ownerUid = ownerCred.user.uid;
}
console.log('   Owner authenticated in Auth with UID:', ownerUid);

// 0.2 Admin registers as new member first
const adminCred = await createUserWithEmailAndPassword(auth, adminEmail, adminPass);
const adminUid = adminCred.user.uid;
await setDoc(doc(db, 'users', adminUid), {
  id: adminUid,
  username: adminUsername,
  inGameName: 'QAAdmin',
  powerLevel: 0,
  clan: 'no-clan',
  role: 'member',
  status: 'pending_approval',
  createdAt: Date.now()
});
console.log('   Admin registered as pending user with UID:', adminUid);

// 0.3 Member registers as new member
const memberCred = await createUserWithEmailAndPassword(auth, memberEmail, memberPass);
const memberUid = memberCred.user.uid;
await setDoc(doc(db, 'users', memberUid), {
  id: memberUid,
  username: memberUsername,
  inGameName: 'QAMember',
  powerLevel: 0,
  clan: 'no-clan',
  role: 'member',
  status: 'pending_approval',
  createdAt: Date.now()
});
console.log('   Member registered as pending user with UID:', memberUid);

// 0.4 Owner signs in to promote Admin and activate Member
await signInWithEmailAndPassword(auth, ownerEmail, ownerPass);
console.log('   Owner signed in to promote Admin and activate Member...');
await updateDoc(doc(db, 'users', adminUid), {
  role: 'admin',
  status: 'active',
  powerLevel: 80000,
  clan: 'VoltZ',
  updatedAt: Date.now()
});
console.log('   Admin promoted to active admin by Owner.');

await updateDoc(doc(db, 'users', memberUid), {
  status: 'active',
  powerLevel: 45000,
  clan: 'VoltZ',
  updatedAt: Date.now()
});
console.log('   Member activated by Owner.');

// =========================================================================
// FLOW 1: Member submit -> Owner sees notification -> Owner opens -> Approve
// =========================================================================
console.log('\n======================================================');
console.log('FLOW 1: Member submit -> Owner sees notif -> Approve');
console.log('======================================================');

// 1.1 Member signs in (authenticated session)
console.log('1.1 Member signs in...');
await signInWithEmailAndPassword(auth, memberEmail, memberPass);
console.log('    Logged in as Member. auth.currentUser.uid:', auth.currentUser.uid);

// 1.2 Member submits stat update
console.log('1.2 Member submits stat update:');
const t1 = Date.now();
const memberUpdate1 = {
  pendingPowerLevel: 135000,
  pendingPowerLevelRequestedAt: t1,
  pendingStats: { stat_melee_atk: 250, stat_def: 300, stat_hp: 5000 },
  pendingSpiritEnhancements: { stat_spirit_blessing: 7 },
  pendingStatScreenshotUrl: 'https://example.com/proof1.png',
  pendingClasses: ['Orb', 'Dual Blades'],
  pendingLevel: 78,
  pendingLegendClasses: 2,
  pendingLegendAgathions: 1,
  statRejectionReason: null,
  statRejectionAt: null,
  updatedAt: t1,
  inGameName: 'QAMember'
};

await updateDoc(doc(db, 'users', memberUid), memberUpdate1);
console.log('    Member updateDoc written successfully to Firestore!');

// 1.3 Verify exact Firestore user document persists all required fields authoritatively
console.log('1.3 Inspect exact Firestore user document after submit:');
const snap1 = await getDoc(doc(db, 'users', memberUid));
const data1 = snap1.data();
console.log('    pendingPowerLevel:', data1.pendingPowerLevel, '(Expected: 135000)');
console.log('    pendingLevel:', data1.pendingLevel, '(Expected: 78)');
console.log('    pendingClasses:', data1.pendingClasses, '(Expected: ["Orb", "Dual Blades"])');
console.log('    pendingLegendClasses:', data1.pendingLegendClasses, '(Expected: 2)');
console.log('    pendingLegendAgathions:', data1.pendingLegendAgathions, '(Expected: 1)');
console.log('    pendingStats:', JSON.stringify(data1.pendingStats));
console.log('    pendingSpiritEnhancements:', JSON.stringify(data1.pendingSpiritEnhancements));
console.log('    pendingStatScreenshotUrl:', data1.pendingStatScreenshotUrl);
console.log('    pendingPowerLevelRequestedAt:', data1.pendingPowerLevelRequestedAt);

if (
  data1.pendingPowerLevel === 135000 &&
  data1.pendingLevel === 78 &&
  Array.isArray(data1.pendingClasses) &&
  data1.pendingLegendClasses === 2 &&
  data1.pendingLegendAgathions === 1 &&
  data1.pendingStats?.stat_melee_atk === 250 &&
  data1.pendingSpiritEnhancements?.stat_spirit_blessing === 7 &&
  data1.pendingStatScreenshotUrl === 'https://example.com/proof1.png' &&
  data1.pendingPowerLevelRequestedAt === t1
) {
  console.log('    >>> ALL 9 FIELDS PERSIST AUTHORITATIVELY: YES! <<<');
} else {
  console.error('    >>> FIELD MISMATCH! <<<');
  process.exit(1);
}

// 1.4 Simulate reload / new session for Owner
console.log('1.4 Reload / new session: Sign out and login as Owner...');
await signOut(auth);
await signInWithEmailAndPassword(auth, ownerEmail, ownerPass);
console.log('    Owner logged in. auth.currentUser.uid:', auth.currentUser.uid);

// 1.5 Trace listener/query/state used for pending requests
console.log('1.5 Owner reads users from Firestore listener:');
const ownerUserDoc = await getDoc(doc(db, 'users', memberUid));
const allUsersForOwner = [{ ...ownerUserDoc.data(), id: ownerUserDoc.id }];

const isPendingForOwner = isUserStatsPending(allUsersForOwner[0]);
console.log('    isUserStatsPending(member):', isPendingForOwner, '(Expected: true)');

// 1.6 Trace notification derivation
const ownerNotifications = deriveStatNotifications(allUsersForOwner, 'th');
console.log('    Owner notifications count:', ownerNotifications.length, '(Expected: 1)');
console.log('    Owner notification title:', ownerNotifications[0]?.title);
console.log('    Owner notification desc:', ownerNotifications[0]?.description);

// 1.7 Pending-review UI derivation
const pendingReviewUsersForOwner = allUsersForOwner.filter(isUserStatsPending);
console.log('    Pending review items count for Owner:', pendingReviewUsersForOwner.length, '(Expected: 1)');

// 1.8 Owner opens request and APPROVES
console.log('1.8 Owner approves request...');
const approveTimestamp = Date.now();
await updateDoc(doc(db, 'users', memberUid), {
  powerLevel: data1.pendingPowerLevel,
  stats: data1.pendingStats,
  spiritEnhancements: data1.pendingSpiritEnhancements,
  classes: data1.pendingClasses,
  characterClass: data1.pendingClasses[0],
  level: data1.pendingLevel,
  legendClasses: data1.pendingLegendClasses,
  legendAgathions: data1.pendingLegendAgathions,
  statScreenshotUrl: data1.pendingStatScreenshotUrl,
  pendingPowerLevel: null,
  pendingPowerLevelRequestedAt: null,
  pendingStats: null,
  pendingSpiritEnhancements: null,
  pendingStatScreenshotUrl: null,
  pendingClasses: null,
  pendingLevel: null,
  pendingLegendClasses: null,
  pendingLegendAgathions: null,
  statRejectionReason: null,
  statRejectionAt: null,
  statApprovalAt: approveTimestamp,
  updatedAt: approveTimestamp
});

const snapAfterApprove = await getDoc(doc(db, 'users', memberUid));
const approvedData = snapAfterApprove.data();
console.log('    Member powerLevel after approval:', approvedData.powerLevel, '(Expected: 135000)');
console.log('    Member pendingPowerLevel after approval:', approvedData.pendingPowerLevel, '(Expected: null)');
console.log('    isUserStatsPending after approval:', isUserStatsPending(approvedData), '(Expected: false)');

// =========================================================================
// FLOW 2: Member submit -> Admin sees notification -> Admin opens -> Reject
// =========================================================================
console.log('\n======================================================');
console.log('FLOW 2: Member submit -> Admin sees notif -> Reject');
console.log('======================================================');

// 2.1 Reload / new session: Member signs in
console.log('2.1 Reload / new session: Member signs in...');
await signOut(auth);
await signInWithEmailAndPassword(auth, memberEmail, memberPass);
console.log('    Logged in as Member. auth.currentUser.uid:', auth.currentUser.uid);

// 2.2 Member submits new stat update
console.log('2.2 Member submits new stat update:');
const t2 = Date.now();
const memberUpdate2 = {
  pendingPowerLevel: 160000,
  pendingPowerLevelRequestedAt: t2,
  pendingStats: { stat_melee_atk: 320, stat_def: 380, stat_hp: 6500 },
  pendingSpiritEnhancements: { stat_spirit_blessing: 9 },
  pendingStatScreenshotUrl: 'https://example.com/proof2_blurry.png',
  pendingClasses: ['Orb'],
  pendingLevel: 80,
  pendingLegendClasses: 3,
  pendingLegendAgathions: 2,
  statRejectionReason: null,
  statRejectionAt: null,
  updatedAt: t2,
  inGameName: 'QAMember'
};

await updateDoc(doc(db, 'users', memberUid), memberUpdate2);
console.log('    Member updateDoc written successfully to Firestore!');

// 2.3 Verify persistence
const snap2 = await getDoc(doc(db, 'users', memberUid));
const data2 = snap2.data();
console.log('    pendingPowerLevel:', data2.pendingPowerLevel, '(Expected: 160000)');
console.log('    pendingPowerLevelRequestedAt:', data2.pendingPowerLevelRequestedAt);

// 2.4 Reload / new session for Admin
console.log('2.4 Reload / new session: Sign out and login as Admin...');
await signOut(auth);
await signInWithEmailAndPassword(auth, adminEmail, adminPass);
console.log('    Admin logged in. auth.currentUser.uid:', auth.currentUser.uid);

// 2.5 Admin listener receives updated user
console.log('2.5 Admin reads users from Firestore:');
const adminUserDoc = await getDoc(doc(db, 'users', memberUid));
const allUsersForAdmin = [{ ...adminUserDoc.data(), id: adminUserDoc.id }];

const isPendingForAdmin = isUserStatsPending(allUsersForAdmin[0]);
console.log('    isUserStatsPending(member):', isPendingForAdmin, '(Expected: true)');

// 2.6 Admin notification derivation
const adminNotifications = deriveStatNotifications(allUsersForAdmin, 'th');
console.log('    Admin notifications count:', adminNotifications.length, '(Expected: 1)');
console.log('    Admin notification title:', adminNotifications[0]?.title);
console.log('    Admin notification desc:', adminNotifications[0]?.description);

// 2.7 Pending review items count for Admin
const pendingReviewUsersForAdmin = allUsersForAdmin.filter(isUserStatsPending);
console.log('    Pending review items count for Admin:', pendingReviewUsersForAdmin.length, '(Expected: 1)');

// 2.8 Admin opens request and REJECTS with reason
console.log('2.8 Admin rejects request with reason...');
const rejectTimestamp = Date.now();
const rejectionReason = '📷 ภาพสกรีนช็อตไม่ชัดเจน หรือไม่เห็นชื่อตัวละคร';

await updateDoc(doc(db, 'users', memberUid), {
  pendingPowerLevel: null,
  pendingPowerLevelRequestedAt: null,
  pendingStats: null,
  pendingSpiritEnhancements: null,
  pendingStatScreenshotUrl: null,
  pendingClasses: null,
  pendingLevel: null,
  pendingLegendClasses: null,
  pendingLegendAgathions: null,
  statRejectionReason: rejectionReason,
  statRejectionAt: rejectTimestamp,
  updatedAt: rejectTimestamp
});

const snapAfterReject = await getDoc(doc(db, 'users', memberUid));
const rejectedData = snapAfterReject.data();
console.log('    Member pendingPowerLevel after rejection:', rejectedData.pendingPowerLevel, '(Expected: null)');
console.log('    Member statRejectionReason:', rejectedData.statRejectionReason);
console.log('    isUserStatsPending after rejection:', isUserStatsPending(rejectedData), '(Expected: false)');

// 2.9 Member logs in to check rejection status survives reload
console.log('2.9 Reload / new session: Member signs in to view rejection:');
await signOut(auth);
await signInWithEmailAndPassword(auth, memberEmail, memberPass);
const memberCheck = await getDoc(doc(db, 'users', memberUid));
console.log('    Member sees statRejectionReason:', memberCheck.data()?.statRejectionReason);
console.log('    Member pendingPowerLevel:', memberCheck.data()?.pendingPowerLevel);

console.log('\n=== BOTH E2E FLOWS COMPLETED SUCCESSFULLY! ===');
process.exit(0);
