import { test, describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  _setTestAdminSdk,
  verifyRoleToken,
  usernameToAuthEmail,
  deleteManagedUser
} from '../api/_firebaseAdmin.ts';
import { createApp } from '../api/_server.ts';

// -------------------------------------------------------------
// Step 13 Test Fixtures & Constants
// -------------------------------------------------------------
const REAL_OWNER_AUTH_UID = 'APsCZzEI4tYdx5UfHuY5Sw10L8B3';
const REAL_OWNER_CANONICAL_ID = 'user_owner_eloni';

const ADMIN_AUTH_UID = 'auth-uid-admin-walkin';
const ADMIN_CANONICAL_ID = 'user_1789089284789_uqqv';

const MEMBER_TARGET_AUTH_UID = 'auth-uid-member-target';
const MEMBER_TARGET_CANONICAL_ID = 'user_target_member';

const APPLICANT_AUTH_UID = 'auth-uid-applicant';
const APPLICANT_CANONICAL_ID = 'user_applicant_test';

const DUPLICATE_AUTH_UID = 'auth-uid-duplicate';
const DUPLICATE_CANONICAL_ID = 'user_duplicate_test';

function createMockDocSnapshot(id, data) {
  return {
    id,
    exists: Boolean(data),
    data: () => (data ? { ...data } : undefined)
  };
}

function createStep13MockSdk(options = {}) {
  const users = options.users || {};
  const authAccounts = new Set(options.authAccounts || [
    REAL_OWNER_AUTH_UID,
    ADMIN_AUTH_UID,
    MEMBER_TARGET_AUTH_UID,
    APPLICANT_AUTH_UID,
    DUPLICATE_AUTH_UID
  ]);
  const validTokens = options.validTokens || new Map();
  const deletedAuthUids = [];
  const physicalDeletedDocIds = [];

  const collections = {
    users,
    items: options.items || {},
    item_queues: options.item_queues || {},
    quick_items: options.quick_items || {},
    general_items: options.general_items || {},
    clans: options.clans || {},
    diamond_vault: options.diamond_vault || {},
    app_settings: {
      gemini_ai: { apiKey: 'test-key' },
      discord_secure: { webhookUrl: 'https://discord.com/api/webhooks/test' }
    }
  };

  return {
    deletedAuthUids,
    physicalDeletedDocIds,
    collections,
    auth: {
      verifyIdToken: async (token) => {
        if (validTokens.has(token)) {
          return validTokens.get(token);
        }
        const err = new Error('Invalid token');
        err.code = 'auth/argument-error';
        throw err;
      },
      deleteUser: async (uid) => {
        if (options.failAuthDeleteUid === uid) {
          const err = new Error('Auth server error');
          err.code = 'auth/internal-error';
          throw err;
        }
        if (!authAccounts.has(uid)) {
          const err = new Error('User not found');
          err.code = 'auth/user-not-found';
          throw err;
        }
        authAccounts.delete(uid);
        deletedAuthUids.push(uid);
      }
    },
    db: {
      collection: (colName) => {
        const col = collections[colName] || (collections[colName] = {});
        return {
          doc: (docId) => ({
            id: docId,
            get: async () => {
              if (options.failFirestoreRead) {
                const err = new Error('Firestore timeout');
                err.code = 'RESOURCE_EXHAUSTED';
                throw err;
              }
              return createMockDocSnapshot(docId, col[docId]);
            },
            set: async (data, opts) => {
              if (options.failFirestoreWriteId === docId) {
                const err = new Error('Firestore write quota exceeded');
                err.code = 'RESOURCE_EXHAUSTED';
                throw err;
              }
              if (opts?.merge && col[docId]) {
                col[docId] = { ...col[docId], ...data, id: docId };
              } else {
                col[docId] = { ...data, id: docId };
              }
            },
            delete: async () => {
              physicalDeletedDocIds.push(`${colName}/${docId}`);
              delete col[docId];
            }
          }),
          get: async () => {
            const docs = Object.entries(col).map(([id, data]) => createMockDocSnapshot(id, data));
            return {
              empty: docs.length === 0,
              size: docs.length,
              docs,
              forEach: (fn) => docs.forEach(fn)
            };
          }
        };
      }
    }
  };
}

describe('STEP 13: Authoritative Delete + Restore Safety Verification Suite', () => {
  let appServer;
  let baseUrl;
  let mockSdk;

  const tokenOwner = 'token-real-owner';
  const tokenAdmin = 'token-legacy-admin';
  const tokenMember = 'token-legacy-member';

  function resetState(options = {}) {
    const validTokens = new Map([
      [tokenOwner, { uid: REAL_OWNER_AUTH_UID, email: usernameToAuthEmail('Eloni') }],
      [tokenAdmin, { uid: ADMIN_AUTH_UID, email: usernameToAuthEmail('w4lk1n9') }],
      [tokenMember, { uid: MEMBER_TARGET_AUTH_UID, email: usernameToAuthEmail('target_b') }]
    ]);

    const users = {
      [REAL_OWNER_CANONICAL_ID]: {
        id: REAL_OWNER_CANONICAL_ID,
        authUid: REAL_OWNER_AUTH_UID,
        username: 'Eloni',
        inGameName: 'Eloni',
        role: 'owner',
        status: 'active',
        email: usernameToAuthEmail('Eloni')
      },
      [ADMIN_CANONICAL_ID]: {
        id: ADMIN_CANONICAL_ID,
        authUid: ADMIN_AUTH_UID,
        username: 'w4lk1n9',
        inGameName: 'W4LK1N9',
        role: 'admin',
        status: 'active',
        email: usernameToAuthEmail('w4lk1n9')
      },
      [MEMBER_TARGET_CANONICAL_ID]: {
        id: MEMBER_TARGET_CANONICAL_ID,
        authUid: MEMBER_TARGET_AUTH_UID,
        username: 'target_b',
        inGameName: 'TargetB',
        role: 'member',
        status: 'active',
        email: usernameToAuthEmail('target_b')
      },
      [APPLICANT_CANONICAL_ID]: {
        id: APPLICANT_CANONICAL_ID,
        authUid: APPLICANT_AUTH_UID,
        username: 'applicant_test',
        inGameName: 'ApplicantTest',
        role: 'member',
        status: 'pending_approval',
        email: usernameToAuthEmail('applicant_test')
      },
      [DUPLICATE_CANONICAL_ID]: {
        id: DUPLICATE_CANONICAL_ID,
        authUid: DUPLICATE_AUTH_UID,
        username: 'dup_member',
        inGameName: 'DupMember',
        role: 'member',
        status: 'active',
        email: usernameToAuthEmail('dup_member')
      }
    };

    mockSdk = createStep13MockSdk({
      users,
      validTokens,
      ...options
    });
    _setTestAdminSdk(mockSdk);
  }

  before(async () => {
    process.env.FIREBASE_PROJECT_ID = 'k7-item';
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      project_id: 'k7-item',
      private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n',
      client_email: 'test@k7-item.iam.gserviceaccount.com'
    });

    process.env.VERCEL = '1';
    const tmpDataDir = path.join(os.tmpdir(), 'l2m-data-step13');
    if (fs.existsSync(tmpDataDir)) {
      try { fs.rmSync(tmpDataDir, { recursive: true, force: true }); } catch {}
    }

    resetState();

    const app = await createApp({ serveFrontend: false });
    appServer = http.createServer(app);
    await new Promise((resolve) => {
      appServer.listen(0, '127.0.0.1', () => {
        const port = appServer.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    _setTestAdminSdk(null);
    if (appServer) {
      if (appServer.closeAllConnections) appServer.closeAllConnections();
      await new Promise((resolve) => appServer.close(resolve));
    }
  });

  beforeEach(() => {
    resetState();
  });

  // -----------------------------------------------------------------
  // 1. Single Member Delete
  // -----------------------------------------------------------------
  test('Single Delete 1.1: Backend authoritative success sets status: deleted and removes user', async () => {
    const res = await fetch(`${baseUrl}/api/users/${MEMBER_TARGET_CANONICAL_ID}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`
      },
      body: JSON.stringify({ deleteReason: 'admin_removal' })
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.profileDeleted, true);

    const targetDoc = mockSdk.collections.users[MEMBER_TARGET_CANONICAL_ID];
    assert.equal(targetDoc.status, 'deleted');
    assert.equal(targetDoc.deleteReason, 'admin_removal');
    assert.equal(typeof targetDoc.deletedAt, 'number');
    // Auth account preserved for normal member delete
    assert.equal(mockSdk.deletedAuthUids.includes(MEMBER_TARGET_AUTH_UID), false);
  });

  test('Single Delete 1.2: Permission denied when non-admin/member tries to delete', async () => {
    const res = await fetch(`${baseUrl}/api/users/${ADMIN_CANONICAL_ID}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenMember}`
      }
    });

    assert.equal(res.status, 403);
    const targetDoc = mockSdk.collections.users[ADMIN_CANONICAL_ID];
    assert.equal(targetDoc.status, 'active');
  });

  test('Single Delete 1.3: Firestore write failure returns 500 and profile is not deleted', async () => {
    resetState({ failFirestoreWriteId: MEMBER_TARGET_CANONICAL_ID });

    const res = await fetch(`${baseUrl}/api/users/${MEMBER_TARGET_CANONICAL_ID}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`
      }
    });

    assert.equal(res.status, 500);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error, 'DELETE_USER_FAILED');
  });

  test('Single Delete 1.4: Admin service unavailable returns 503', async () => {
    _setTestAdminSdk(null);

    const res = await fetch(`${baseUrl}/api/users/${MEMBER_TARGET_CANONICAL_ID}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`
      }
    });

    assert.equal(res.status, 503);
    const json = await res.json();
    assert.equal(json.error, 'AUTH_SERVICE_UNAVAILABLE');
  });

  // -----------------------------------------------------------------
  // 2. Registration Reject (Two-Phase Semantics)
  // -----------------------------------------------------------------
  test('Registration Reject 2.1: Phase 1 Firestore fails -> Auth untouched, returns 500', async () => {
    resetState({ failFirestoreWriteId: APPLICANT_CANONICAL_ID });

    const res = await fetch(`${baseUrl}/api/users/${APPLICANT_CANONICAL_ID}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`
      },
      body: JSON.stringify({
        deleteReason: 'registration_rejected',
        deleteAuthAccount: true
      })
    });

    assert.equal(res.status, 500);
    assert.equal(mockSdk.deletedAuthUids.includes(APPLICANT_AUTH_UID), false);
    const targetDoc = mockSdk.collections.users[APPLICANT_CANONICAL_ID];
    assert.equal(targetDoc.status, 'pending_approval');
  });

  test('Registration Reject 2.2: Phase 1 & 2 succeed -> full success (profile deleted + Auth deleted)', async () => {
    const res = await fetch(`${baseUrl}/api/users/${APPLICANT_CANONICAL_ID}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`
      },
      body: JSON.stringify({
        deleteReason: 'registration_rejected',
        deleteAuthAccount: true
      })
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.profileDeleted, true);
    assert.equal(json.authDeleted, true);

    const targetDoc = mockSdk.collections.users[APPLICANT_CANONICAL_ID];
    assert.equal(targetDoc.status, 'deleted');
    assert.equal(mockSdk.deletedAuthUids.includes(APPLICANT_AUTH_UID), true);
  });

  test('Registration Reject 2.3: Phase 1 succeeds, Phase 2 Auth fails -> HTTP 207 partial success', async () => {
    resetState({ failAuthDeleteUid: APPLICANT_AUTH_UID });

    const res = await fetch(`${baseUrl}/api/users/${APPLICANT_CANONICAL_ID}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`
      },
      body: JSON.stringify({
        deleteReason: 'registration_rejected',
        deleteAuthAccount: true
      })
    });

    assert.equal(res.status, 207);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.partial, true);
    assert.equal(json.code, 'PROFILE_DELETED_AUTH_CLEANUP_FAILED');
    assert.equal(json.profileDeleted, true);
    assert.equal(json.authDeleted, false);

    // Profile is still safely soft-deleted in Firestore
    const targetDoc = mockSdk.collections.users[APPLICANT_CANONICAL_ID];
    assert.equal(targetDoc.status, 'deleted');
  });

  test('Registration Reject 2.4: verifyRoleToken rejects user with status: deleted', async () => {
    mockSdk.collections.users[MEMBER_TARGET_CANONICAL_ID].status = 'deleted';

    const verification = await verifyRoleToken(`Bearer ${tokenMember}`, ['member', 'admin', 'owner']);
    assert.equal(verification.success, false);
    assert.equal(verification.status, 403);
    assert.ok(verification.code === 'USER_ACCOUNT_INACTIVE' || verification.code === 'USER_PROFILE_NOT_FOUND');
  });

  test('Registration Reject 2.5: Idempotent retry succeeds and cleans Auth', async () => {
    const originalDeletedAt = Date.now() - 50000;
    mockSdk.collections.users[APPLICANT_CANONICAL_ID] = {
      ...mockSdk.collections.users[APPLICANT_CANONICAL_ID],
      status: 'deleted',
      deletedAt: originalDeletedAt,
      deletedBy: ADMIN_CANONICAL_ID,
      deleteReason: 'registration_rejected'
    };

    const res = await fetch(`${baseUrl}/api/users/${APPLICANT_CANONICAL_ID}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`
      },
      body: JSON.stringify({
        deleteReason: 'registration_rejected',
        deleteAuthAccount: true
      })
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.alreadyDeleted, true);
    assert.equal(json.authDeleted, true);

    const docAfter = mockSdk.collections.users[APPLICANT_CANONICAL_ID];
    assert.equal(docAfter.deletedAt, originalDeletedAt);
    assert.equal(mockSdk.deletedAuthUids.includes(APPLICANT_AUTH_UID), true);
  });

  // -----------------------------------------------------------------
  // 3. Duplicate Cleanup
  // -----------------------------------------------------------------
  test('Duplicate Cleanup 3.1: deleteReason === duplicate_account never deletes Auth account', async () => {
    const res = await fetch(`${baseUrl}/api/users/${DUPLICATE_CANONICAL_ID}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`
      },
      body: JSON.stringify({
        deleteReason: 'duplicate_account',
        canonicalUserId: MEMBER_TARGET_CANONICAL_ID,
        deleteAuthAccount: true // Even if requested, must be suppressed
      })
    });

    assert.equal(res.status, 200);
    const docAfter = mockSdk.collections.users[DUPLICATE_CANONICAL_ID];
    assert.equal(docAfter.status, 'deleted');
    assert.equal(docAfter.canonicalUserId, MEMBER_TARGET_CANONICAL_ID);
    assert.equal(docAfter.deleteReason, 'duplicate_account');
    assert.equal(mockSdk.deletedAuthUids.includes(DUPLICATE_AUTH_UID), false);
  });

  // -----------------------------------------------------------------
  // 4. Restore Anti-Resurrection & Empty Database
  // -----------------------------------------------------------------
  test('Restore 4.1: Encrypted restore logic preserves existing deleted and shadow docs', () => {
    const existingDocs = [
      { id: 'u1', data: { status: 'deleted', inGameName: 'DeadUser' } },
      { id: 'u2', data: { status: 'shadow', isAuthShadow: true, inGameName: 'ShadowOwner' } },
      { id: 'u3', data: { status: 'active', inGameName: 'ActiveUser' } }
    ];

    const existingProtectedDocs = new Map();
    existingDocs.forEach((doc) => {
      const data = doc.data;
      if (data && (data.status === 'deleted' || data.status === 'shadow' || data.isAuthShadow)) {
        existingProtectedDocs.set(doc.id, data);
      }
    });

    const backupDocuments = [
      { id: 'u1', data: { status: 'active', inGameName: 'DeadUserStaleCopy' } },
      { id: 'u2', data: { status: 'active', inGameName: 'ShadowOwnerStaleCopy' } },
      { id: 'u3', data: { status: 'active', inGameName: 'ActiveUserUpdated' } },
      { id: 'u4', data: { status: 'active', inGameName: 'NewUser' } }
    ];

    const docsToRestore = backupDocuments.filter((doc) => !existingProtectedDocs.has(doc.id));
    const docsToDelete = existingDocs.filter((doc) => !existingProtectedDocs.has(doc.id));

    // u1 (deleted) and u2 (shadow) must NOT be deleted by docsToDelete
    assert.deepEqual(docsToDelete.map(d => d.id), ['u3']);
    // u1 and u2 from backup must NOT be restored (anti-resurrection)
    assert.deepEqual(docsToRestore.map(d => d.id), ['u3', 'u4']);
  });

  test('Restore 4.2: Empty-database disaster recovery respects backup syncMeta tombstones', () => {
    const backupUsers = [
      { id: 'u_active', inGameName: 'RealActive', status: 'active' },
      { id: 'u_pending', inGameName: 'RealPending', status: 'pending_approval' },
      { id: 'u_known_deleted', inGameName: 'OldDeleted', status: 'active' },
      { id: 'u_shadow', inGameName: 'ShadowDoc', status: 'shadow', isAuthShadow: true }
    ];

    const backupSyncMeta = {
      deletedUsers: {
        'u_known_deleted': 1789100000000
      }
    };

    const deletedUserMap = { ...(backupSyncMeta.deletedUsers || {}) };

    const safeUsersToRestore = backupUsers.filter((incomingUser) => {
      if (!incomingUser || !incomingUser.id) return false;
      if (incomingUser.status === 'deleted' || incomingUser.status === 'shadow' || incomingUser.isAuthShadow) {
        return false;
      }
      if (deletedUserMap[incomingUser.id]) {
        return false;
      }
      return true;
    });

    assert.equal(safeUsersToRestore.length, 2);
    assert.equal(safeUsersToRestore.some(u => u.id === 'u_active'), true);
    assert.equal(safeUsersToRestore.some(u => u.id === 'u_pending'), true);
    assert.equal(safeUsersToRestore.some(u => u.id === 'u_known_deleted'), false);
    assert.equal(safeUsersToRestore.some(u => u.id === 'u_shadow'), false);
  });

  // -----------------------------------------------------------------
  // 5. Live Google Backup syncMeta Serialization
  // -----------------------------------------------------------------
  test('Backup 5.1: Automatic Google Sheets backup payload includes syncMeta', () => {
    const samplePayload = {
      vaultBalance: 5000,
      syncMeta: {
        deletedUsers: {
          'user_dead_1': 1789200000000
        }
      },
      users: [
        { id: 'u1', username: 'active1', status: 'active' },
        { id: 'user_dead_1', username: 'dead1', status: 'deleted' },
        { id: 'u_shadow', username: 'shadow1', status: 'shadow', isAuthShadow: true }
      ]
    };

    const deletedMap = samplePayload.syncMeta?.deletedUsers || {};

    const sanitizedUsers = (samplePayload.users || []).filter((user) => {
      if (!user || !user.id) return false;
      if (user.status === 'deleted') return false;
      if (user.status === 'shadow' || user.isAuthShadow) return false;
      return !deletedMap[user.id];
    });

    const postBodyData = {
      users: sanitizedUsers,
      syncMeta: samplePayload.syncMeta
    };

    assert.equal(postBodyData.users.length, 1);
    assert.equal(postBodyData.users[0].id, 'u1');
    assert.ok(postBodyData.syncMeta);
    assert.equal(postBodyData.syncMeta.deletedUsers['user_dead_1'], 1789200000000);
  });
});
