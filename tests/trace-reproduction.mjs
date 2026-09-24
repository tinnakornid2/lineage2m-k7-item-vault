import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { readFile } from 'node:fs/promises';

const projectId = 'k7-repro-trace';
const testEnv = await initializeTestEnvironment({
  projectId,
  firestore: {
    host: '127.0.0.1',
    port: 8080,
    rules: await readFile('firestore.rules', 'utf8')
  }
});

console.log('--- TEST ENVIRONMENT INITIALIZED ---');

await testEnv.withSecurityRulesDisabled(async (context) => {
  const db = context.firestore();
  await setDoc(doc(db, 'users', 'member-1'), {
    id: 'member-1',
    username: 'member1',
    inGameName: 'MemberOne',
    powerLevel: 50000,
    clan: 'VoltZ',
    role: 'member',
    status: 'active',
    createdAt: 1700000000000
  });
  await setDoc(doc(db, 'users', 'owner-1'), {
    id: 'owner-1',
    username: 'owner',
    inGameName: 'Owner',
    powerLevel: 100000,
    clan: 'VoltZ',
    role: 'owner',
    status: 'active',
    createdAt: 1700000000000
  });
});

// Helper for sanitizeForFirestore
function sanitizeForFirestore(obj) {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = sanitizeForFirestore(value);
    }
  }
  return clean;
}

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
  inGameName: 'MemberOne'
};

const cleanUpdates = sanitizeForFirestore(docUpdates);

console.log('1. Testing Unauthenticated Update (request.auth == null):');
try {
  const unauthDb = testEnv.unauthenticatedContext().firestore();
  await updateDoc(doc(unauthDb, 'users', 'member-1'), cleanUpdates);
  console.log('   UNAUTH WRITE: SUCCESS');
} catch (err) {
  console.log('   UNAUTH WRITE: FAILED ->', err.code, err.message);
}

console.log('2. Testing Authenticated Member Update (request.auth.uid == "member-1"):');
try {
  const authDb = testEnv.authenticatedContext('member-1').firestore();
  await updateDoc(doc(authDb, 'users', 'member-1'), cleanUpdates);
  console.log('   AUTH MEMBER WRITE: SUCCESS');
} catch (err) {
  console.log('   AUTH MEMBER WRITE: FAILED ->', err.code, err.message);
}

console.log('3. Inspect Firestore User Doc after Authenticated Member Update:');
const checkDb = testEnv.authenticatedContext('owner-1').firestore();
const snap = await getDoc(doc(checkDb, 'users', 'member-1'));
console.log('   Doc data in Firestore:', JSON.stringify(snap.data(), null, 2));

console.log('4. Testing Update with null vs undefined / missing fields in profileData:');
// What if profileData was empty or screenshotUrl was empty?
const docUpdatesEmptyScreenshot = {
  pendingPowerLevel: 130000,
  pendingPowerLevelRequestedAt: Date.now(),
  pendingStats: {},
  pendingSpiritEnhancements: {},
  pendingStatScreenshotUrl: null,
  pendingClasses: null,
  pendingLevel: null,
  pendingLegendClasses: null,
  pendingLegendAgathions: null,
  statRejectionReason: null,
  statRejectionAt: null,
  updatedAt: Date.now()
};
try {
  const authDb = testEnv.authenticatedContext('member-1').firestore();
  await updateDoc(doc(authDb, 'users', 'member-1'), sanitizeForFirestore(docUpdatesEmptyScreenshot));
  console.log('   EMPTY SCREENSHOT WRITE: SUCCESS');
} catch (err) {
  console.log('   EMPTY SCREENSHOT WRITE: FAILED ->', err.code, err.message);
}

await testEnv.cleanup();
console.log('--- TEST FINISHED ---');
