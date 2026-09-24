import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { readFile } from 'node:fs/promises';

const projectId = 'k7-queue-rules-test';
let testEnv;

const memberProfile = (id, overrides = {}) => ({
  id,
  username: id,
  inGameName: id,
  powerLevel: 100000,
  clan: 'VoltZ',
  characterClass: 'Orb',
  role: 'member',
  status: 'active',
  createdAt: Date.now(),
  ...overrides
});

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: await readFile('firestore.rules', 'utf8')
    }
  });
});

beforeEach(async () => {
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
      username: 'member', inGameName: 'Member', status: 'active'
    }));
    await setDoc(doc(db, 'items', 'vault-item-1'), {
      name: 'Legendary Staff',
      status: 'available',
      price: 500,
      quantity: 1,
      rarity: 'LEGEND'
    });
    await setDoc(doc(db, 'general_items', 'gen-item-1'), {
      id: 'gen-item-1',
      name: 'Healing Potion',
      imageUrl: 'https://example.com/potion.png',
      price: 100,
      quantity: 10,
      minPowerLevel: 0,
      rarity: 'RARE',
      queueList: [],
      receiptHistory: [],
      createdAt: 1700000000000,
      updatedAt: 1700000000000
    });
  });
});

after(async () => {
  await testEnv?.cleanup();
});

test('1. Member direct general_items.queueList mutation is strictly DENIED', async () => {
  const memberDb = testEnv.authenticatedContext('member-1').firestore();
  await assertFails(updateDoc(doc(memberDb, 'general_items', 'gen-item-1'), {
    queueList: [{ id: 'qm-hack', name: 'Hacker', powerLevel: 999999 }]
  }));
});

test('2. Admin direct general_items.queueList mutation is strictly DENIED (backend-only design)', async () => {
  const adminDb = testEnv.authenticatedContext('admin-1').firestore();
  await assertFails(updateDoc(doc(adminDb, 'general_items', 'gen-item-1'), {
    queueList: [{ id: 'qm-admin', name: 'AdminDirect', powerLevel: 100000 }]
  }));
});

test('3. Admin direct update of permitted general_items fields (price, quantity) SUCCEEDS', async () => {
  const adminDb = testEnv.authenticatedContext('admin-1').firestore();
  await assertSucceeds(updateDoc(doc(adminDb, 'general_items', 'gen-item-1'), {
    price: 150,
    quantity: 12,
    updatedAt: Date.now()
  }));
});

test('4. Member direct update of permitted general_items fields is DENIED (only admin/owner)', async () => {
  const memberDb = testEnv.authenticatedContext('member-1').firestore();
  await assertFails(updateDoc(doc(memberDb, 'general_items', 'gen-item-1'), {
    price: 50
  }));
});

test('5. Backend Admin SDK (bypassing rules) join/leave/add/remove queueList SUCCEEDS', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    const updated = await updateDoc(doc(adminDb, 'general_items', 'gen-item-1'), {
      queueList: [{ id: 'qm-backend', name: 'AuthoritativeMember', powerLevel: 100000 }]
    });
    const snap = await getDoc(doc(adminDb, 'general_items', 'gen-item-1'));
    assert.equal(snap.data()?.queueList?.[0]?.name, 'AuthoritativeMember');
  });
});

test('6. Normal unrelated permitted flows remain PASS (e.g. read items, member stat request)', async () => {
  const memberDb = testEnv.authenticatedContext('member-1').firestore();
  // Member read general items -> PASS
  await assertSucceeds(getDoc(doc(memberDb, 'general_items', 'gen-item-1')));
  // Member read vault items -> PASS
  await assertSucceeds(getDoc(doc(memberDb, 'items', 'vault-item-1')));
  // Member submit stat update -> PASS
  await assertSucceeds(updateDoc(doc(memberDb, 'users', 'member-1'), {
    pendingPowerLevel: 150000,
    pendingPowerLevelRequestedAt: Date.now()
  }));
});
