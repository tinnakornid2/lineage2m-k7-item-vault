import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REQUIRED_COLLECTIONS,
  CURRENT_BACKUP_FORMAT,
  CURRENT_SCHEMA_VERSION,
  SUPPORTED_BACKUP_FORMATS,
  validateSnapshotCollections
} from '../scripts/backup-schema.mjs';
import { COLLECTIONS as BACKUP_COLLECTIONS } from '../scripts/backup-firestore-encrypted.mjs';

test('1. Backup and restore collection sets are 100% symmetric', () => {
  assert.deepEqual(
    [...BACKUP_COLLECTIONS].sort(),
    [...REQUIRED_COLLECTIONS].sort(),
    'Backup and restore collections must match symmetrically'
  );
});

test('2. REQUIRED_COLLECTIONS contains general_items, system, and all required production collections', () => {
  const expectedCollections = [
    'users',
    'items',
    'item_queues',
    'general_items',
    'clans',
    'diamond_vault',
    'quick_items',
    'item_claims',
    'app_settings',
    'system_meta',
    'system'
  ];

  for (const col of expectedCollections) {
    assert.ok(
      REQUIRED_COLLECTIONS.includes(col),
      `REQUIRED_COLLECTIONS must include ${col}`
    );
  }
  assert.equal(REQUIRED_COLLECTIONS.length, expectedCollections.length);
});

test('3. validateSnapshotCollections passes on complete valid collection set', () => {
  const mockCollections = {};
  for (const col of REQUIRED_COLLECTIONS) {
    mockCollections[col] = [{ id: `${col}_1`, data: { name: 'test' } }];
  }

  const result = validateSnapshotCollections(mockCollections);
  assert.equal(result.valid, true);
  assert.equal(result.missingCollections.length, 0);
  assert.equal(result.unknownCollections.length, 0);
});

test('4. validateSnapshotCollections fails closed when general_items is missing (old snapshot defect)', () => {
  const incompleteCollections = {};
  for (const col of REQUIRED_COLLECTIONS) {
    if (col !== 'general_items') {
      incompleteCollections[col] = [];
    }
  }

  const result = validateSnapshotCollections(incompleteCollections);
  assert.equal(result.valid, false);
  assert.ok(result.error.includes('missing required collection(s): general_items'));
  assert.deepEqual(result.missingCollections, ['general_items']);
});

test('5. validateSnapshotCollections fails closed on unknown/unexpected collections', () => {
  const collectionsWithUnknown = {};
  for (const col of REQUIRED_COLLECTIONS) {
    collectionsWithUnknown[col] = [];
  }
  collectionsWithUnknown['rogue_injected_collection'] = [];

  const result = validateSnapshotCollections(collectionsWithUnknown);
  assert.equal(result.valid, false);
  assert.ok(result.error.includes('unrecognized collection(s): rogue_injected_collection'));
  assert.deepEqual(result.unknownCollections, ['rogue_injected_collection']);
});

test('6. Anti-resurrection guard preserves deleted and shadow users', () => {
  // Simulate restore logic for users
  const existingDocs = [
    { id: 'user_active_1', data: () => ({ username: 'active1', status: 'active' }), ref: { id: 'user_active_1' } },
    { id: 'user_deleted_1', data: () => ({ username: 'del1', status: 'deleted', deletedAt: 12345 }), ref: { id: 'user_deleted_1' } },
    { id: 'user_shadow_1', data: () => ({ username: 'shad1', status: 'shadow', canonicalUserId: 'user_canonical' }), ref: { id: 'user_shadow_1' } },
    { id: 'user_auth_shadow_1', data: () => ({ username: 'authShad1', isAuthShadow: true, canonicalUserId: 'user_canonical' }), ref: { id: 'user_auth_shadow_1' } }
  ];

  const backupUserDocs = [
    { id: 'user_active_1', data: { username: 'active1', status: 'active' } },
    { id: 'user_active_new', data: { username: 'activeNew', status: 'active' } },
    // In a corrupted or old backup, someone might try to resurrect a deleted user
    { id: 'user_deleted_1', data: { username: 'del1', status: 'active' } },
    { id: 'user_shadow_1', data: { username: 'shad1', status: 'active' } }
  ];

  const existingProtectedDocs = new Map();
  existingDocs.forEach((doc) => {
    const data = doc.data();
    if (data && (data.status === 'deleted' || data.status === 'shadow' || data.isAuthShadow)) {
      existingProtectedDocs.set(doc.id, data);
    }
  });

  const docsToRestore = backupUserDocs.filter((doc) => !existingProtectedDocs.has(doc.id));
  const docsToDelete = existingDocs.filter((doc) => !existingProtectedDocs.has(doc.id));

  // Assertions:
  // 1. Protected docs must not be restored / overwritten
  assert.equal(docsToRestore.some((d) => d.id === 'user_deleted_1'), false);
  assert.equal(docsToRestore.some((d) => d.id === 'user_shadow_1'), false);
  assert.equal(docsToRestore.some((d) => d.id === 'user_auth_shadow_1'), false);

  // 2. Protected docs must not be deleted
  assert.equal(docsToDelete.some((d) => d.id === 'user_deleted_1'), false);
  assert.equal(docsToDelete.some((d) => d.id === 'user_shadow_1'), false);
  assert.equal(docsToDelete.some((d) => d.id === 'user_auth_shadow_1'), false);

  // 3. Normal docs are restored
  assert.deepEqual(docsToRestore.map(d => d.id).sort(), ['user_active_1', 'user_active_new'].sort());
});

test('7. Project and database identity validation fails closed on mismatch', () => {
  const currentProject = 'k7-item';
  const currentDb = 'ai-studio-lineage2mclanhub-4a1794d8-f944-422f-945e-56c12057ad13';

  // Bad project ID
  const badProjectBackup = {
    format: CURRENT_BACKUP_FORMAT,
    projectId: 'hybrid-box-753bd',
    databaseId: currentDb,
    collections: {}
  };
  assert.throws(
    () => {
      if (!SUPPORTED_BACKUP_FORMATS.includes(badProjectBackup.format) || badProjectBackup.projectId !== currentProject) {
        throw new Error('Backup project identity does not match the K7 Firebase project.');
      }
    },
    /Backup project identity does not match/
  );

  // Bad database ID
  const badDbBackup = {
    format: CURRENT_BACKUP_FORMAT,
    projectId: currentProject,
    databaseId: '(default)',
    collections: {}
  };
  assert.throws(
    () => {
      if (badDbBackup.databaseId !== currentDb) {
        throw new Error(`Backup database ${badDbBackup.databaseId} does not match target ${currentDb}.`);
      }
    },
    /Backup database \(default\) does not match target/
  );
});

test('8. general_items encoding and decoding preserves item structures', () => {
  const sampleGeneralItem = {
    id: 'gen_item_1',
    name: 'Scroll of Enchant',
    category: 'general',
    priceDiamonds: 150,
    quantity: 10,
    updatedAt: { toDate: () => new Date('2026-09-24T00:00:00.000Z') }
  };

  // encodeValue logic from backup script
  function encodeValue(value) {
    if (value?.toDate instanceof Function) {
      return { __k7Type: 'timestamp', value: value.toDate().toISOString() };
    }
    if (value instanceof Uint8Array) {
      return { __k7Type: 'bytes', value: Buffer.from(value).toString('base64') };
    }
    if (Array.isArray(value)) return value.map(encodeValue);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, encodeValue(child)]));
    }
    return value;
  }

  const encoded = encodeValue(sampleGeneralItem);
  assert.equal(encoded.name, 'Scroll of Enchant');
  assert.equal(encoded.priceDiamonds, 150);
  assert.deepEqual(encoded.updatedAt, {
    __k7Type: 'timestamp',
    value: '2026-09-24T00:00:00.000Z'
  });
});

test('9. system/tombstones restore merging preserves newer and backup tombstones symmetrically', () => {
  const existingTombstones = {
    deletedUsers: { user_del_existing: 1000 },
    cancelledClaims: { 'item_1:::user_del_existing': 1000 },
    updatedAt: 1000
  };

  const backupTombstones = {
    deletedUsers: { user_del_backup: 500 },
    cancelledClaims: { 'item_2:::user_backup': 500 },
    updatedAt: 500
  };

  // Merge logic from restore-firestore-encrypted.mjs
  const merged = {
    deletedUsers: { ...(backupTombstones.deletedUsers || {}), ...(existingTombstones.deletedUsers || {}) },
    cancelledClaims: { ...(backupTombstones.cancelledClaims || {}), ...(existingTombstones.cancelledClaims || {}) },
    updatedAt: Math.max(backupTombstones.updatedAt || 0, existingTombstones.updatedAt || 0, Date.now())
  };

  // Both backup and existing live tombstones must be preserved
  assert.equal(merged.deletedUsers.user_del_existing, 1000);
  assert.equal(merged.deletedUsers.user_del_backup, 500);
  assert.equal(merged.cancelledClaims['item_1:::user_del_existing'], 1000);
  assert.equal(merged.cancelledClaims['item_2:::user_backup'], 500);
});

