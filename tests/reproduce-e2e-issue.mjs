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

console.log('--- REPRODUCING PRODUCTION FLOW ---');

// Step 1: Create a Member account conforming to validNewMember
const memberUsername = 'member_qa_' + Date.now();
const memberEmail = usernameToAuthEmail(memberUsername);
const memberPass = 'password123';

console.log('1. Registering Member in Auth & Firestore (pending_approval, powerLevel: 0)...');
const cred = await createUserWithEmailAndPassword(auth, memberEmail, memberPass);
const memberUid = cred.user.uid;

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
console.log('   Member registered with UID:', memberUid);

// Step 2: Sign in as Owner to approve the member to active
console.log('2. Owner signs in to approve member to active:');
// Owner in emulator
try {
  await signInWithEmailAndPassword(auth, usernameToAuthEmail('eloni'), 'emulator_test_pass_123');
} catch {
  // If owner not in auth emulator yet, create owner
  const ownerCred = await createUserWithEmailAndPassword(auth, usernameToAuthEmail('eloni'), 'emulator_test_pass_123');
  await setDoc(doc(db, 'users', ownerCred.user.uid), {
    id: ownerCred.user.uid,
    username: 'eloni',
    inGameName: 'Eloni',
    powerLevel: 100000,
    clan: 'VoltZ',
    role: 'owner',
    status: 'active',
    createdAt: Date.now()
  });
}

// Owner approves member
await updateDoc(doc(db, 'users', memberUid), {
  status: 'active',
  powerLevel: 50000,
  clan: 'VoltZ',
  updatedAt: Date.now()
});
console.log('   Member approved by Owner to active.');

// Step 3: Simulate Member logged in WITHOUT Firebase Auth (e.g. In-memory / localStorage match)
console.log('3. Member session active in UI, but Firebase Auth is signed out:');
await signOut(auth); // auth.currentUser is null
console.log('   auth.currentUser is:', auth.currentUser);

const timestamp = Date.now();
const docUpdates = {
  pendingPowerLevel: 125000,
  pendingPowerLevelRequestedAt: timestamp,
  pendingStats: { stat_melee_atk: 100, stat_def: 200 },
  pendingSpiritEnhancements: { stat_spirit_blessing: 5 },
  pendingStatScreenshotUrl: 'https://example.com/screenshot.png',
  pendingClasses: ['Orb'],
  pendingLevel: 75,
  pendingLegendClasses: 1,
  pendingLegendAgathions: 1,
  statRejectionReason: null,
  statRejectionAt: null,
  updatedAt: timestamp,
  inGameName: 'QAMember'
};

console.log('4. Member submits stat update while auth.currentUser is null:');
try {
  await updateDoc(doc(db, 'users', memberUid), docUpdates);
  console.log('   Result: UNEXPECTED SUCCESS');
} catch (err) {
  console.log('   Result: FAILED ->', err.code, err.message);
}

const snapAfterFailed = await getDoc(doc(db, 'users', memberUid));
console.log('   Firestore pendingPowerLevel after failed submit:', snapAfterFailed.data()?.pendingPowerLevel);

// Step 4: Now Member signs into Firebase Auth and submits
console.log('5. Member signs in to Firebase Auth and submits:');
await signInWithEmailAndPassword(auth, memberEmail, memberPass);
console.log('   auth.currentUser.uid is:', auth.currentUser.uid);

try {
  await updateDoc(doc(db, 'users', memberUid), docUpdates);
  console.log('   Result: SUCCESS!');
} catch (err) {
  console.log('   Result: FAILED ->', err.code, err.message);
}

const snapAfterSuccess = await getDoc(doc(db, 'users', memberUid));
console.log('   Firestore pending fields after authenticated submit:');
console.log('     pendingPowerLevel:', snapAfterSuccess.data()?.pendingPowerLevel);
console.log('     pendingLevel:', snapAfterSuccess.data()?.pendingLevel);
console.log('     pendingClasses:', snapAfterSuccess.data()?.pendingClasses);
console.log('     pendingLegendClasses:', snapAfterSuccess.data()?.pendingLegendClasses);
console.log('     pendingLegendAgathions:', snapAfterSuccess.data()?.pendingLegendAgathions);
console.log('     pendingStats:', snapAfterSuccess.data()?.pendingStats);
console.log('     pendingSpiritEnhancements:', snapAfterSuccess.data()?.pendingSpiritEnhancements);
console.log('     pendingStatScreenshotUrl:', snapAfterSuccess.data()?.pendingStatScreenshotUrl);
console.log('     pendingPowerLevelRequestedAt:', snapAfterSuccess.data()?.pendingPowerLevelRequestedAt);

// Step 5: Test Owner/Admin receiving and approving/rejecting
console.log('6. Owner logs in and checks pending users:');
await signInWithEmailAndPassword(auth, usernameToAuthEmail('eloni'), '0386231334');
const ownerSnap = await getDoc(doc(db, 'users', memberUid));
const ownerUserData = ownerSnap.data();

console.log('   Owner sees member pendingPowerLevel:', ownerUserData?.pendingPowerLevel);

// Owner approves
console.log('7. Owner approves the pending stat update:');
await updateDoc(doc(db, 'users', memberUid), {
  powerLevel: ownerUserData.pendingPowerLevel,
  stats: ownerUserData.pendingStats,
  spiritEnhancements: ownerUserData.pendingSpiritEnhancements,
  classes: ownerUserData.pendingClasses,
  level: ownerUserData.pendingLevel,
  legendClasses: ownerUserData.pendingLegendClasses,
  legendAgathions: ownerUserData.pendingLegendAgathions,
  pendingPowerLevel: null,
  pendingPowerLevelRequestedAt: null,
  pendingStats: null,
  pendingSpiritEnhancements: null,
  pendingStatScreenshotUrl: null,
  pendingClasses: null,
  pendingLevel: null,
  pendingLegendClasses: null,
  pendingLegendAgathions: null,
  statApprovalAt: Date.now(),
  updatedAt: Date.now()
});
console.log('   Approved in Firestore!');

const snapAfterApproved = await getDoc(doc(db, 'users', memberUid));
console.log('   Member powerLevel after approval:', snapAfterApproved.data()?.powerLevel);
console.log('   Member pendingPowerLevel after approval:', snapAfterApproved.data()?.pendingPowerLevel);

process.exit(0);
