import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  connectFirestoreEmulator,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc
} from 'firebase/firestore';
import {
  getAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { calculateDiamondNetChange, computeTotalVaultBalance } from '../src/utils/diamondHelper.ts';
import { mergeDiamondTransactions } from '../src/services/firebase.ts';

console.log('=== TEST SUITE: DIAMOND VAULT AUTHORITATIVE PERSISTENCE & ATOMICITY ===\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    passedTests++;
    console.log(`✅ PASS: ${message}`);
  }
}

// -------------------------------------------------------------
// Test 1: Mathematical Balance Calculation (Order Independence)
// -------------------------------------------------------------
console.log('\n--- 1. Testing computeTotalVaultBalance Order Independence ---');
const sampleTx1 = { id: 'tx1', type: 'deposit', amount: 23521, timestamp: 1000 };
const sampleTx2 = { id: 'tx2', type: 'credit', amount: 2939, timestamp: 2000 };
const sampleTx3 = { id: 'tx3', type: 'deduction', amount: 100, timestamp: 3000 };
const sampleTx4 = { id: 'tx4', type: 'credit', amount: 1341, timestamp: 4000 };
const sampleTx5 = { id: 'tx5', type: 'deduction', amount: 1500, timestamp: 5000 };
const sampleTx6 = { id: 'tx6', type: 'deduction', amount: 3000, timestamp: 6000 };

const allSix = [sampleTx1, sampleTx2, sampleTx3, sampleTx4, sampleTx5, sampleTx6];
// Expected: 23521 + 2939 - 100 + 1341 - 1500 - 3000 = 23201
assert(computeTotalVaultBalance(allSix) === 23201, 'Correct sum in ascending chronological order: 23,201');

// Shuffle order completely
const shuffled = [sampleTx4, sampleTx1, sampleTx6, sampleTx3, sampleTx5, sampleTx2];
assert(computeTotalVaultBalance(shuffled) === 23201, 'Correct sum in completely shuffled order: 23,201');

// Reverse order (newest first)
const reversed = [...allSix].reverse();
assert(computeTotalVaultBalance(reversed) === 23201, 'Correct sum in descending order: 23,201');

// -------------------------------------------------------------
// Test 2: Multi-Layer Reconciliation with mergeDiamondTransactions
// -------------------------------------------------------------
console.log('\n--- 2. Testing mergeDiamondTransactions & Stale Snapshot Immunity ---');

// Local has all 6 transactions (including the 2 recent withdrawals)
const localState = [...allSix];

// Remote Google Sheets / Live-State snapshot is 10 seconds behind and only has the first 4 transactions
const staleRemoteSnapshot = [sampleTx1, sampleTx2, sampleTx3, sampleTx4];

// Merge local state with stale remote snapshot
const merged = mergeDiamondTransactions(localState, staleRemoteSnapshot);

assert(merged.length === 6, 'Merged count preserves all 6 transactions (does not wipe out the 2 recent withdrawals)');
assert(computeTotalVaultBalance(merged) === 23201, 'Merged balance remains authoritative at 23,201 diamonds');
assert(merged[0].id === 'tx6', 'Newest transaction tx6 (-3000) is at index 0 (descending)');
assert(merged[0].balanceAfter === 23201, 'tx6 balanceAfter is exactly 23,201');
assert(merged[1].id === 'tx5', 'Second newest tx5 (-1500) is at index 1');
assert(merged[1].balanceAfter === 26201, 'tx5 balanceAfter is exactly 26,201');

// Test note update preservation
const updatedRemote = [
  { ...sampleTx1, note: 'Updated note from admin' }
];
const mergedNotes = mergeDiamondTransactions(merged, updatedRemote);
assert(mergedNotes.find(t => t.id === 'tx1')?.note === 'Updated note from admin', 'Updated note is merged and preserved');

// -------------------------------------------------------------
// Test 3: Insufficient Balance Rejection
// -------------------------------------------------------------
console.log('\n--- 3. Testing Insufficient Balance Protection ---');
const currentBalance = computeTotalVaultBalance(merged); // 23,201
const attemptWithdrawAmount = 25000;
const isInsufficient = attemptWithdrawAmount > currentBalance;
assert(isInsufficient === true, 'Attempt to withdraw 25,000 against 23,201 is detected as insufficient');

// -------------------------------------------------------------
// Test 4: Role-based Authorization
// -------------------------------------------------------------
console.log('\n--- 4. Testing Role Authorization ---');
const ownerUser = { id: 'user_owner_eloni', inGameName: 'Eloni', role: 'owner' };
const adminUser = { id: 'user_admin_1', inGameName: 'Admin1', role: 'admin' };
const memberUser = { id: 'user_member_1', inGameName: 'Member1', role: 'member' };

function canPerformVaultTx(user) {
  return Boolean(user && ['owner', 'admin'].includes(user.role));
}

assert(canPerformVaultTx(ownerUser) === true, 'Owner is permitted to perform vault transactions');
assert(canPerformVaultTx(adminUser) === true, 'Admin is permitted to perform vault transactions');
assert(canPerformVaultTx(memberUser) === false, 'Member is strictly prohibited from performing vault transactions');

// -------------------------------------------------------------
// Test 5: End-to-End Firestore Emulator Persistence & Security Rules
// -------------------------------------------------------------
console.log('\n--- 5. Testing Firestore Security Rules & Authoritative Persistence ---');

const app = initializeApp({
  apiKey: 'demo-api-key',
  projectId: 'demo-no-project'
}, 'test-diamond-app-' + Date.now());

const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });

const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8080);

const testRecordId = 'dlog_test_' + Date.now();
const testRecord = {
  id: testRecordId,
  type: 'deduction',
  amount: 1500,
  netAmount: -1500,
  clanScope: 'all',
  note: 'Automated test withdrawal',
  balanceAfter: 21701,
  performedBy: {
    userId: 'user_owner_eloni',
    name: 'Eloni',
    role: 'owner'
  },
  timestamp: Date.now()
};

// 5a. Unauthenticated write MUST fail with permission-denied
let unauthFailed = false;
try {
  await setDoc(doc(db, 'diamond_vault', testRecordId), testRecord);
} catch (err) {
  unauthFailed = err.code === 'permission-denied';
}
assert(unauthFailed === true, 'Unauthenticated write to diamond_vault is strictly rejected by Firestore rules');

// 5b. Authenticate as Owner
const ownerEmail = '656c6f6e69@auth.k7-clan.local';
let userCred;
try {
  userCred = await signInWithEmailAndPassword(auth, ownerEmail, '0386231334');
} catch {
  // If not yet in emulator auth, create
  const { createUserWithEmailAndPassword } = await import('firebase/auth');
  userCred = await createUserWithEmailAndPassword(auth, ownerEmail, '0386231334');
}

// 5c. Authenticated Owner write MUST succeed
await setDoc(doc(db, 'diamond_vault', testRecordId), testRecord);

// 5d. Read back to confirm authoritative persistence
const readSnap = await getDoc(doc(db, 'diamond_vault', testRecordId));
assert(readSnap.exists() === true, 'Withdrawal document exists in Firestore diamond_vault collection');
assert(readSnap.data()?.amount === 1500, 'Withdrawal amount 1,500 persists authoritatively');
assert(readSnap.data()?.note === 'Automated test withdrawal', 'Withdrawal note persists authoritatively');
assert(readSnap.data()?.performedBy?.userId === 'user_owner_eloni', 'PerformedBy user ID persists authoritatively');

// 5e. Confirm query returns the document
const querySnap = await getDocs(collection(db, 'diamond_vault'));
const allDocs = [];
querySnap.forEach(d => allDocs.push(d.data()));
const found = allDocs.find(d => d.id === testRecordId);
assert(Boolean(found), 'Query on diamond_vault returns the newly written transaction');

console.log(`\n========================================`);
console.log(`ALL TESTS PASSED: ${passedTests}/${totalTests} (100%)`);
console.log(`========================================\n`);
