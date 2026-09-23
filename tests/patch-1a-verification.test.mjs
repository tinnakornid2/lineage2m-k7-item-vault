// Setup localStorage polyfill for Node.js test environment BEFORE any imports
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear()
};

// Force emulator environment so it NEVER connects to production Firebase
process.env.VITE_USE_FIREBASE_EMULATORS = 'true';
process.env.VITE_LOCAL_SAFE_MODE = 'true';
process.env.LOCAL_SAFE_MODE = 'true';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

import assert from 'node:assert';
import { test, before, after, beforeEach } from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

// Import local services functions for testing immunity removal
import {
  isQueueItemDeleted,
  markQueueItemAsDeleted,
  mergeQueueItems,
  getDeletedQueueItemIds
} from '../src/services/firebase.ts';

console.log('======================================================================');
console.log('🧪 RUNNING PATCH 1A VERIFICATION SUITE (ISOLATED EMULATOR / IN-MEMORY)');
console.log('   Tests: 1) T2 Armor Delete, 2) Standard Queue Delete,');
console.log('          3) General Item Rules updatedAt, 4) User Rules statApprovalAt');
console.log('======================================================================\n');

// ──────────────────────────────────────────────────────────────────
// PART 1: QUEUE ITEM DELETION TESTS (T2 Armor & Standard Queue)
// ──────────────────────────────────────────────────────────────────

test('1. Test T2 Armor delete: marks deleted, does not unmark, does not resurrect', () => {
  const t2ArmorId = 'queue_1790010776111_vfa6';
  
  // 1.1 Initially mark as deleted
  markQueueItemAsDeleted(t2ArmorId);

  // 1.2 Verify isQueueItemDeleted returns true (was previously hardcoded false)
  const isDeleted = isQueueItemDeleted(t2ArmorId);
  assert.strictEqual(isDeleted, true, 'isQueueItemDeleted must return true for T2 Armor');

  // 1.3 Verify it is in deleted ids
  const deletedIds = getDeletedQueueItemIds();
  assert.strictEqual(deletedIds.has(t2ArmorId), true, 'T2 Armor must be in deletedQueueItemIds set');

  // 1.4 Verify mergeQueueItems does NOT resurrect it when incoming from another source
  const currentQueues = [];
  const incomingQueues = [
    {
      id: t2ArmorId,
      name: 'T2 Armor',
      rarity: 'EPIC',
      price: 1500,
      createdAt: 1790010776111,
      updatedAt: 1790010776111 // older than tombstone
    }
  ];

  const merged = mergeQueueItems(currentQueues, incomingQueues);
  assert.strictEqual(merged.length, 0, 'mergeQueueItems MUST NOT resurrect deleted T2 Armor');
  console.log('   ✓ Test 1 Passed: T2 Armor deletion and non-resurrection verified.');
});

test('2. Test standard queue item delete: consistent with T2 Armor behavior', () => {
  const standardQueueId = 'queue_standard_test_item_999';

  // 2.1 Mark standard item as deleted
  markQueueItemAsDeleted(standardQueueId);

  // 2.2 Verify isQueueItemDeleted returns true
  const isDeleted = isQueueItemDeleted(standardQueueId);
  assert.strictEqual(isDeleted, true, 'isQueueItemDeleted must return true for standard queue item');

  // 2.3 Verify it is in deleted ids
  const deletedIds = getDeletedQueueItemIds();
  assert.strictEqual(deletedIds.has(standardQueueId), true, 'Standard queue item must be in deletedQueueItemIds set');

  // 2.4 Verify mergeQueueItems does NOT resurrect it
  const currentQueues = [];
  const incomingQueues = [
    {
      id: standardQueueId,
      name: 'Standard Bow',
      rarity: 'RARE',
      price: 500,
      createdAt: Date.now() - 50000,
      updatedAt: Date.now() - 50000
    }
  ];

  const merged = mergeQueueItems(currentQueues, incomingQueues);
  assert.strictEqual(merged.length, 0, 'mergeQueueItems MUST NOT resurrect deleted standard queue item');
  console.log('   ✓ Test 2 Passed: Standard queue item deletion verified.');
});

// ──────────────────────────────────────────────────────────────────
// PART 2: FIRESTORE RULES SCHEMA TESTS (updatedAt & statApprovalAt)
// ──────────────────────────────────────────────────────────────────

const projectId = 'k7-patch1a-rules-test';
let testEnv;

const validGeneralItemData = (overrides = {}) => ({
  id: 'gen_item_001',
  name: 'Health Potion',
  imageUrl: 'https://example.com/potion.png',
  price: 50,
  quantity: 5,
  minPowerLevel: 100,
  rarity: 'RARE',
  queueList: [],
  receiptHistory: [],
  createdAt: 1780000000000,
  ...overrides
});

const memberProfile = (id, overrides = {}) => ({
  id,
  username: id,
  inGameName: id,
  powerLevel: 1000,
  clan: 'VoltZ',
  characterClass: 'Orb',
  role: 'member',
  status: 'active',
  createdAt: 1780000000000,
  ...overrides
});

before(async () => {
  try {
    testEnv = await initializeTestEnvironment({
      projectId,
      firestore: {
        host: '127.0.0.1',
        port: 8080,
        rules: await readFile('firestore.rules', 'utf8')
      }
    });
  } catch (err) {
    console.warn('Notice: Firebase rules emulator environment notice:', err?.message);
  }
});

beforeEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'users', 'owner-1'), memberProfile('owner-1', {
        username: 'owner', inGameName: 'Owner', role: 'owner', status: 'active'
      }));
      await setDoc(doc(db, 'users', 'admin-1'), memberProfile('admin-1', {
        username: 'admin', inGameName: 'Admin', role: 'admin', status: 'active'
      }));
      await setDoc(doc(db, 'users', 'member-1'), memberProfile('member-1', {
        username: 'member1', inGameName: 'Member One', role: 'member', status: 'active'
      }));
    });
  }
});

after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

test('3. Test updatedAt in General Item Rules: allowed and rejected if invalid extra key', async () => {
  if (!testEnv) {
    throw new Error('TestEnv is not available: Firestore emulator is required on 127.0.0.1:8080');
  }
  const adminDb = testEnv.authenticatedContext('admin-1').firestore();

  // 3.1 Create general item WITH updatedAt -> MUST SUCCEED with new rule
  const itemWithUpdatedAt = validGeneralItemData({
    updatedAt: 1780000010000
  });
  await assertSucceeds(
    setDoc(doc(adminDb, 'general_items', 'gen_item_001'), itemWithUpdatedAt)
  );

  // 3.2 Create general item WITH unauthorized field -> MUST FAIL
  const itemWithIllegalField = validGeneralItemData({
    id: 'gen_item_002',
    updatedAt: 1780000010000,
    hackedField: 'exploit'
  });
  await assertFails(
    setDoc(doc(adminDb, 'general_items', 'gen_item_002'), itemWithIllegalField)
  );
  console.log('   ✓ Test 3 Passed: General Item updatedAt rule verified.');
});

test('4. Test statApprovalAt in User Rules: allowed on profile update', async () => {
  if (!testEnv) {
    throw new Error('TestEnv is not available: Firestore emulator is required on 127.0.0.1:8080');
  }
  const ownerDb = testEnv.authenticatedContext('owner-1').firestore();

  // 4.1 Update member profile including statApprovalAt -> MUST SUCCEED with new rule
  await assertSucceeds(
    updateDoc(doc(ownerDb, 'users', 'member-1'), {
      powerLevel: 1200,
      statApprovalAt: Date.now(),
      updatedAt: Date.now()
    })
  );

  // 4.2 Update member profile WITH unauthorized field -> MUST FAIL
  await assertFails(
    updateDoc(doc(ownerDb, 'users', 'member-1'), {
      unauthorizedKey: 'shouldFail'
    })
  );
  console.log('   ✓ Test 4 Passed: User statApprovalAt rule verified.');
});
