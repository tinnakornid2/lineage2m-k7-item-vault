import { after, before, beforeEach, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { readFile } from 'node:fs/promises';

const projectId = 'k7-local-security-tests';
let testEnv;

const memberProfile = (id, overrides = {}) => ({
  id,
  username: id,
  inGameName: id,
  powerLevel: 0,
  clan: 'no-clan',
  characterClass: 'Orb',
  role: 'member',
  status: 'pending_approval',
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
    await setDoc(doc(db, 'users', 'owner-2'), memberProfile('owner-2', {
      username: 'owner2', inGameName: 'Owner Two', role: 'owner', status: 'active'
    }));
    await setDoc(doc(db, 'users', 'admin-1'), memberProfile('admin-1', {
      username: 'admin', inGameName: 'Admin', role: 'admin', status: 'active'
    }));
    await setDoc(doc(db, 'users', 'member-1'), memberProfile('member-1', {
      username: 'member', inGameName: 'Member', status: 'active'
    }));
    await setDoc(doc(db, 'users', 'leader-1'), memberProfile('leader-1', {
      username: 'leader', inGameName: 'Leader', role: 'party_leader', status: 'active'
    }));
    await setDoc(doc(db, 'items', 'item-1'), { name: 'Sword', status: 'available' });
    await setDoc(doc(db, 'app_settings', 'gemini_ai'), { apiKey: 'must-not-be-readable' });
  });
});

after(async () => {
  await testEnv?.cleanup();
});

test('anonymous users cannot read clan data', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, 'users', 'member-1')));
  await assertFails(getDoc(doc(db, 'items', 'item-1')));
});

test('pending accounts can read only their own profile', async () => {
  const db = testEnv.authenticatedContext('pending-reader').firestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', 'pending-reader'), memberProfile('pending-reader'));
  });
  await assertSucceeds(getDoc(doc(db, 'users', 'pending-reader')));
  await assertFails(getDoc(doc(db, 'users', 'member-1')));
  await assertFails(getDoc(doc(db, 'items', 'item-1')));
  await assertFails(getDoc(doc(db, 'clans', 'any-clan')));
});

test('new account can create only its own pending member profile', async () => {
  const db = testEnv.authenticatedContext('new-member').firestore();
  await assertSucceeds(setDoc(doc(db, 'users', 'new-member'), memberProfile('new-member')));
  await assertFails(setDoc(doc(db, 'users', 'forged-owner'), memberProfile('forged-owner', {
    role: 'owner', status: 'active'
  })));
  const eloniNamedDb = testEnv.authenticatedContext('name-spoof').firestore();
  await assertFails(setDoc(doc(eloniNamedDb, 'users', 'name-spoof'), memberProfile('name-spoof', {
    username: 'Eloni', inGameName: 'Eloni', role: 'owner', status: 'active'
  })));
  await assertSucceeds(setDoc(doc(eloniNamedDb, 'users', 'name-spoof'), memberProfile('name-spoof', {
    username: 'Eloni', inGameName: 'Eloni'
  })));
  const invalidNameDb = testEnv.authenticatedContext('invalid-name').firestore();
  await assertFails(setDoc(doc(invalidNameDb, 'users', 'invalid-name'), memberProfile('invalid-name', {
    username: 'ชื่อไม่ถูกต้อง'
  })));
  const shortNameDb = testEnv.authenticatedContext('short-name').firestore();
  await assertFails(setDoc(doc(shortNameDb, 'users', 'short-name'), memberProfile('short-name', {
    username: 'ab'
  })));
});

test('active member can read but cannot promote or verify itself', async () => {
  const db = testEnv.authenticatedContext('member-1').firestore();
  await assertSucceeds(getDoc(doc(db, 'items', 'item-1')));
  await assertSucceeds(updateDoc(doc(db, 'users', 'member-1'), {
    pendingPowerLevel: 123456,
    pendingPowerLevelRequestedAt: Date.now()
  }));
  await assertFails(updateDoc(doc(db, 'users', 'member-1'), { powerLevel: 123456 }));
  await assertFails(updateDoc(doc(db, 'users', 'member-1'), { role: 'owner' }));
  await assertFails(updateDoc(doc(db, 'users', 'member-1'), { pendingPowerLevel: -1 }));
  await assertFails(updateDoc(doc(db, 'users', 'member-1'), { pendingPowerLevel: 'not-a-number' }));
  await assertFails(updateDoc(doc(db, 'users', 'member-1'), { pendingLevel: 999 }));
  await assertFails(updateDoc(doc(db, 'users', 'member-1'), { pendingStats: 'not-a-stat-map' }));
  await assertFails(updateDoc(doc(db, 'users', 'member-1'), { pendingClasses: 'not-a-class-list' }));
  await assertFails(setDoc(doc(db, 'items', 'member-item'), { name: 'Forbidden' }));
  await assertSucceeds(setDoc(doc(db, 'item_claims', 'item-1__member-1'), {
    itemId: 'item-1', userId: 'member-1', inGameName: 'Member', clan: 'no-clan',
    powerLevel: 0, claimedAt: Date.now()
  }));
  await assertSucceeds(deleteDoc(doc(db, 'item_claims', 'item-1__member-1')));
  await assertFails(setDoc(doc(db, 'item_claims', 'missing-item__member-1'), {
    itemId: 'missing-item', userId: 'member-1', inGameName: 'Member', clan: 'no-clan',
    powerLevel: 0, claimedAt: Date.now()
  }));
  await assertFails(setDoc(doc(db, 'item_claims', 'item-1__member-1'), {
    itemId: 'item-1', userId: 'member-1', inGameName: 'Member', clan: 'no-clan',
    powerLevel: 999999, claimedAt: Date.now()
  }));
  await assertFails(setDoc(doc(db, 'item_claims', 'item-1__owner-1'), {
    itemId: 'item-1', userId: 'owner-1', inGameName: 'Owner', clan: 'no-clan',
    powerLevel: 999999, claimedAt: Date.now()
  }));
});

test('admin can approve member data and manage vault data', async () => {
  const db = testEnv.authenticatedContext('admin-1').firestore();
  await assertSucceeds(updateDoc(doc(db, 'users', 'member-1'), {
    powerLevel: 123456,
    pendingPowerLevel: null
  }));
  await assertSucceeds(setDoc(doc(db, 'items', 'admin-item'), { name: 'Allowed' }));
});

test('party leader cannot administer other users', async () => {
  const db = testEnv.authenticatedContext('leader-1').firestore();
  await assertFails(updateDoc(doc(db, 'users', 'member-1'), { role: 'owner' }));
  await assertFails(updateDoc(doc(db, 'users', 'owner-1'), { inGameName: 'Hijacked' }));
  await assertFails(updateDoc(doc(db, 'users', 'admin-1'), { inGameName: 'Hijacked Admin' }));
  await assertFails(deleteDoc(doc(db, 'users', 'admin-1')));
  await assertFails(updateDoc(doc(db, 'users', 'member-1'), { status: 'pending_approval' }));
});

test('admin cannot modify owner but can manage lower roles', async () => {
  const db = testEnv.authenticatedContext('admin-1').firestore();
  await assertFails(updateDoc(doc(db, 'users', 'owner-1'), { inGameName: 'Hijacked Owner' }));
  await assertFails(deleteDoc(doc(db, 'users', 'owner-1')));
  await assertSucceeds(updateDoc(doc(db, 'users', 'leader-1'), { inGameName: 'Managed' }));
  await assertSucceeds(deleteDoc(doc(db, 'users', 'leader-1')));
});

test('owner cannot delete or rewrite another owner account', async () => {
  const db = testEnv.authenticatedContext('owner-1').firestore();
  await assertFails(updateDoc(doc(db, 'users', 'owner-2'), { inGameName: 'Changed Owner' }));
  await assertFails(deleteDoc(doc(db, 'users', 'owner-2')));
  await assertFails(updateDoc(doc(db, 'users', 'member-1'), { role: 'owner' }));
  await assertSucceeds(updateDoc(doc(db, 'users', 'admin-1'), { inGameName: 'Managed Admin' }));
});

test('client users cannot read or write protected secret settings', async () => {
  const memberDb = testEnv.authenticatedContext('member-1').firestore();
  const ownerDb = testEnv.authenticatedContext('owner-1').firestore();
  await assertFails(getDoc(doc(memberDb, 'app_settings', 'gemini_ai')));
  await assertSucceeds(getDoc(doc(ownerDb, 'app_settings', 'gemini_ai')));
  await assertSucceeds(setDoc(doc(ownerDb, 'app_settings', 'gemini_ai'), { apiKey: 'new-secret' }));
});

test('unknown collections remain denied even to owner', async () => {
  const db = testEnv.authenticatedContext('owner-1').firestore();
  await assertFails(setDoc(doc(db, 'unexpected', 'document'), { allowed: true }));
});
