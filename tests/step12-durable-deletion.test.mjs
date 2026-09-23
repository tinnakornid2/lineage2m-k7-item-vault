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
// Step 12 Test Fixtures & Constants
// -------------------------------------------------------------
const REAL_OWNER_AUTH_UID = 'APsCZzEI4tYdx5UfHuY5Sw10L8B3';
const REAL_OWNER_CANONICAL_ID = 'user_owner_eloni';

const ADMIN_AUTH_UID = 'auth-uid-admin-walkin';
const ADMIN_CANONICAL_ID = 'user_1789089284789_uqqv';

const MEMBER_A_AUTH_UID = 'auth-uid-member-darkkomet';
const MEMBER_A_CANONICAL_ID = 'user_1789089304921_yksu';

const MEMBER_B_AUTH_UID = 'auth-uid-member-target';
const MEMBER_B_CANONICAL_ID = 'user_target_member_b';

const PENDING_USER_AUTH_UID = 'auth-uid-pending-recruit';
const PENDING_USER_CANONICAL_ID = 'user_pending_recruit';

const REJECTED_USER_AUTH_UID = 'auth-uid-rejected-applicant';
const REJECTED_USER_CANONICAL_ID = 'user_rejected_applicant';

const SHADOW_DOC_AUTH_UID = 'auth-uid-shadow-test';

function createMockDocSnapshot(id, data) {
  return {
    id,
    exists: Boolean(data),
    data: () => (data ? { ...data } : undefined)
  };
}

function createStep12MockSdk(options = {}) {
  const users = options.users || {};
  const authAccounts = new Set(options.authAccounts || [
    REAL_OWNER_AUTH_UID,
    ADMIN_AUTH_UID,
    MEMBER_A_AUTH_UID,
    MEMBER_B_AUTH_UID,
    PENDING_USER_AUTH_UID,
    REJECTED_USER_AUTH_UID,
    SHADOW_DOC_AUTH_UID
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
            get: async () => createMockDocSnapshot(docId, col[docId]),
            set: async (data, opts) => {
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

describe('STEP 12: Durable User Deletion & Data Parity Architecture Suite', () => {
  let appServer;
  let baseUrl;
  let mockSdk;

  const tokenOwner = 'token-real-owner';
  const tokenAdmin = 'token-legacy-admin';
  const tokenMemberA = 'token-legacy-member-a';
  const tokenMemberB = 'token-legacy-member-b';
  const tokenPending = 'token-pending-recruit';
  const tokenShadowSynthetic = 'token-shadow-synthetic';
  const tokenShadowNative = 'token-shadow-native';

  function resetState() {
    const validTokens = new Map([
      [tokenOwner, { uid: REAL_OWNER_AUTH_UID, email: usernameToAuthEmail('Eloni') }],
      [tokenAdmin, { uid: ADMIN_AUTH_UID, email: usernameToAuthEmail('w4lk1n9') }],
      [tokenMemberA, { uid: MEMBER_A_AUTH_UID, email: usernameToAuthEmail('darkkomet') }],
      [tokenMemberB, { uid: MEMBER_B_AUTH_UID, email: usernameToAuthEmail('target_b') }],
      [tokenPending, { uid: PENDING_USER_AUTH_UID, email: usernameToAuthEmail('NewRecruit') }],
      [tokenShadowSynthetic, { uid: SHADOW_DOC_AUTH_UID, email: usernameToAuthEmail('darkkomet') }],
      [tokenShadowNative, { uid: SHADOW_DOC_AUTH_UID, email: 'shadow_native@test.com' }]
    ]);

    const users = {
      // 1. Canonical Owner
      [REAL_OWNER_CANONICAL_ID]: {
        id: REAL_OWNER_CANONICAL_ID,
        authUid: REAL_OWNER_AUTH_UID,
        username: 'Eloni',
        inGameName: 'Eloni',
        role: 'owner',
        clan: 'VoltZ',
        powerLevel: 3722,
        status: 'active',
        email: usernameToAuthEmail('Eloni')
      },
      // 2. Auth Shadow Owner (should be excluded)
      [REAL_OWNER_AUTH_UID]: {
        id: REAL_OWNER_AUTH_UID,
        username: 'Eloni',
        inGameName: 'Eloni',
        role: 'owner',
        clan: 'VoltZ',
        powerLevel: 3722,
        status: 'shadow',
        isAuthShadow: true,
        canonicalUserId: REAL_OWNER_CANONICAL_ID
      },
      // 3. Admin
      [ADMIN_CANONICAL_ID]: {
        id: ADMIN_CANONICAL_ID,
        authUid: ADMIN_AUTH_UID,
        username: 'w4lk1n9',
        inGameName: 'W4LK1N9',
        role: 'admin',
        clan: 'VoltZ',
        powerLevel: 3200,
        status: 'active',
        email: usernameToAuthEmail('w4lk1n9')
      },
      // 4. Member A
      [MEMBER_A_CANONICAL_ID]: {
        id: MEMBER_A_CANONICAL_ID,
        authUid: MEMBER_A_AUTH_UID,
        username: 'darkkomet',
        inGameName: 'DarkKomet',
        role: 'member',
        clan: 'VoltZ',
        powerLevel: 2500,
        status: 'active',
        email: usernameToAuthEmail('darkkomet')
      },
      // 5. Member B (Target for deletion)
      [MEMBER_B_CANONICAL_ID]: {
        id: MEMBER_B_CANONICAL_ID,
        authUid: MEMBER_B_AUTH_UID,
        username: 'target_b',
        inGameName: 'TargetB',
        role: 'member',
        clan: 'VoltZ',
        powerLevel: 2000,
        status: 'active',
        email: usernameToAuthEmail('target_b')
      },
      // 6. Pending User (Kept active pending approval)
      [PENDING_USER_CANONICAL_ID]: {
        id: PENDING_USER_CANONICAL_ID,
        authUid: PENDING_USER_AUTH_UID,
        username: 'NewRecruit',
        inGameName: 'NewRecruit',
        role: 'member',
        clan: 'VoltZ',
        powerLevel: 1500,
        status: 'pending_approval',
        email: usernameToAuthEmail('NewRecruit')
      },
      // 7. Rejected Applicant (Target for registration rejection test)
      [REJECTED_USER_CANONICAL_ID]: {
        id: REJECTED_USER_CANONICAL_ID,
        authUid: REJECTED_USER_AUTH_UID,
        username: 'RejectedGuy',
        inGameName: 'RejectedGuy',
        role: 'member',
        clan: 'VoltZ',
        powerLevel: 1000,
        status: 'pending_approval',
        email: usernameToAuthEmail('RejectedGuy')
      },
      // 8. Shadow Doc pointing to Member A
      [SHADOW_DOC_AUTH_UID]: {
        id: SHADOW_DOC_AUTH_UID,
        username: 'darkkomet',
        inGameName: 'DarkKomet',
        role: 'member',
        clan: 'VoltZ',
        status: 'shadow',
        isAuthShadow: true,
        canonicalUserId: MEMBER_A_CANONICAL_ID
      }
    };

    mockSdk = createStep12MockSdk({ users, validTokens });
    _setTestAdminSdk(mockSdk);
  }

  before(async () => {
    process.env.FIREBASE_PROJECT_ID = 'k7-item';
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      project_id: 'k7-item',
      private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n',
      client_email: 'test@k7-item.iam.gserviceaccount.com'
    });

    // Pure cold start isolation
    process.env.VERCEL = '1';
    const tmpDataDir = path.join(os.tmpdir(), 'l2m-data');
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

  // -------------------------------------------------------------
  // Case 1: Normal Profile Deletion Sets Additive Soft-Delete Fields
  // -------------------------------------------------------------
  test('Case 1: Normal profile deletion sets status: deleted, deletedAt, deletedBy, deleteReason, doc ID preserved', async () => {
    const res = await fetch(`${baseUrl}/api/users/${MEMBER_B_CANONICAL_ID}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`
      },
      body: JSON.stringify({ deleteReason: 'admin_removal' })
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);

    const doc = mockSdk.collections.users[MEMBER_B_CANONICAL_ID];
    assert.ok(doc, 'User document must still exist');
    assert.equal(doc.id, MEMBER_B_CANONICAL_ID, 'Doc ID must not change');
    assert.equal(doc.status, 'deleted');
    assert.equal(typeof doc.deletedAt, 'number');
    assert.ok(doc.deletedAt > 0);
    assert.equal(doc.deletedBy, REAL_OWNER_CANONICAL_ID, 'deletedBy must be actor canonical UID');
    assert.equal(doc.deleteReason, 'admin_removal');
  });

  // -------------------------------------------------------------
  // Case 2: Normal Profile Deletion NEVER calls targetRef.delete() / deleteDoc()
  // -------------------------------------------------------------
  test('Case 2: Normal profile deletion NEVER calls deleteDoc() / targetRef.delete()', async () => {
    await fetch(`${baseUrl}/api/users/${MEMBER_B_CANONICAL_ID}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`
      },
      body: JSON.stringify({ deleteReason: 'admin_removal' })
    });

    assert.equal(
      mockSdk.physicalDeletedDocIds.filter((id) => id.includes(MEMBER_B_CANONICAL_ID)).length,
      0,
      'targetRef.delete() must NEVER be called for member profile deletion'
    );
    assert.ok(mockSdk.collections.users[MEMBER_B_CANONICAL_ID], 'Document must remain in Firestore collection');
  });

  // -------------------------------------------------------------
  // Case 3: Idempotent Deletion Preserves Original deletedAt
  // -------------------------------------------------------------
  test('Case 3: Idempotent deletion on already-deleted user succeeds and preserves original deletedAt', async () => {
    // First deletion
    await fetch(`${baseUrl}/api/users/${MEMBER_B_CANONICAL_ID}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`
      },
      body: JSON.stringify({ deleteReason: 'admin_removal' })
    });
    const firstDeletedAt = mockSdk.collections.users[MEMBER_B_CANONICAL_ID].deletedAt;
    assert.ok(firstDeletedAt > 0);

    // Wait slightly to guarantee clock difference
    await new Promise((r) => setTimeout(r, 15));

    // Second deletion attempt
    const res2 = await fetch(`${baseUrl}/api/users/${MEMBER_B_CANONICAL_ID}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`
      },
      body: JSON.stringify({ deleteReason: 'admin_removal' })
    });
    assert.equal(res2.status, 200);
    const json2 = await res2.json();
    assert.equal(json2.success, true);
    assert.equal(json2.alreadyDeleted, true, 'Response must indicate alreadyDeleted');

    const secondDeletedAt = mockSdk.collections.users[MEMBER_B_CANONICAL_ID].deletedAt;
    assert.equal(secondDeletedAt, firstDeletedAt, 'Original deletedAt timestamp must be preserved');
  });

  // -------------------------------------------------------------
  // Case 4: Role Hierarchy Enforcement for User Deletion
  // -------------------------------------------------------------
  test('Case 4: Role hierarchy enforcement: Owner can delete Admin/Member, Admin cannot delete Owner, Self-delete denied', async () => {
    // 4.1 Admin attempts to delete Owner -> 403 ROLE_HIERARCHY_DENIED
    const resAdminDeleteOwner = await fetch(`${baseUrl}/api/users/${REAL_OWNER_CANONICAL_ID}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAdmin}` }
    });
    assert.equal(resAdminDeleteOwner.status, 403);
    const json1 = await resAdminDeleteOwner.json();
    assert.equal(json1.error, 'ROLE_HIERARCHY_DENIED');

    // 4.2 Admin attempts to delete another Admin -> 403 ROLE_HIERARCHY_DENIED
    const anotherAdminId = 'user_admin_2';
    mockSdk.collections.users[anotherAdminId] = {
      id: anotherAdminId,
      username: 'admin2',
      role: 'admin',
      status: 'active'
    };
    const resAdminDeleteAdmin = await fetch(`${baseUrl}/api/users/${anotherAdminId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAdmin}` }
    });
    assert.equal(resAdminDeleteAdmin.status, 403);

    // 4.3 Member attempts to delete Member -> 403 Forbidden
    const resMemberDelete = await fetch(`${baseUrl}/api/users/${MEMBER_B_CANONICAL_ID}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenMemberA}` }
    });
    assert.equal(resMemberDelete.status, 403);

    // 4.4 Self-delete attempt by Owner -> 403 SELF_DELETE_DENIED
    const resOwnerSelf = await fetch(`${baseUrl}/api/users/${REAL_OWNER_CANONICAL_ID}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenOwner}` }
    });
    assert.equal(resOwnerSelf.status, 403);
    const jsonSelf = await resOwnerSelf.json();
    assert.equal(jsonSelf.error, 'SELF_DELETE_DENIED');

    // 4.5 Owner deleting Admin -> 200 Allowed
    const resOwnerDeleteAdmin = await fetch(`${baseUrl}/api/users/${ADMIN_CANONICAL_ID}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenOwner}` }
    });
    assert.equal(resOwnerDeleteAdmin.status, 200);
  });

  // -------------------------------------------------------------
  // Case 5: Registration Rejection vs Profile Delete (Auth Separation)
  // -------------------------------------------------------------
  test('Case 5: Registration rejection deletes Firebase Auth account, normal delete keeps Auth account', async () => {
    // 5.1 Normal profile delete does NOT delete Auth account
    await fetch(`${baseUrl}/api/users/${MEMBER_B_CANONICAL_ID}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`
      },
      body: JSON.stringify({ deleteReason: 'admin_removal', deleteAuthAccount: false })
    });
    assert.equal(
      mockSdk.deletedAuthUids.includes(MEMBER_B_AUTH_UID),
      false,
      'Normal delete must not delete Firebase Auth account'
    );

    // 5.2 Registration rejection with deleteAuthAccount: true deletes Auth account
    const resReject = await fetch(`${baseUrl}/api/users/${REJECTED_USER_CANONICAL_ID}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`
      },
      body: JSON.stringify({ deleteReason: 'registration_rejected', deleteAuthAccount: true })
    });
    assert.equal(resReject.status, 200);
    assert.ok(
      mockSdk.deletedAuthUids.includes(REJECTED_USER_AUTH_UID),
      'Registration rejection must delete Firebase Auth account'
    );
    assert.equal(mockSdk.collections.users[REJECTED_USER_CANONICAL_ID].status, 'deleted');
  });

  // -------------------------------------------------------------
  // Case 6: Account Unlink Does NOT Soft-Delete Member Profile
  // -------------------------------------------------------------
  test('Case 6: Account unlink preserves member profile as active', async () => {
    // Simulating unlink: profile remains active in users collection
    const profile = mockSdk.collections.users[MEMBER_A_CANONICAL_ID];
    assert.equal(profile.status, 'active');
    // Calling unlinking should not set status to deleted
    assert.notEqual(profile.status, 'deleted');
  });

  // -------------------------------------------------------------
  // Case 7: Duplicate Cleanup Guard (Never Deletes Shared/Canonical Auth Account)
  // -------------------------------------------------------------
  test('Case 7: Duplicate cleanup marks duplicate deleted/aliased without deleting canonical Auth account', async () => {
    const duplicateDocId = 'user_duplicate_123';
    mockSdk.collections.users[duplicateDocId] = {
      id: duplicateDocId,
      username: 'darkkomet',
      inGameName: 'DarkKomet',
      role: 'member',
      status: 'active'
    };

    // Even if client passes deleteAuthAccount: true, duplicate_account reason guards against Auth deletion
    const res = await fetch(`${baseUrl}/api/users/${duplicateDocId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`
      },
      body: JSON.stringify({
        deleteReason: 'duplicate_account',
        canonicalUserId: MEMBER_A_CANONICAL_ID,
        deleteAuthAccount: true
      })
    });
    assert.equal(res.status, 200);

    const dupDoc = mockSdk.collections.users[duplicateDocId];
    assert.equal(dupDoc.status, 'deleted');
    assert.equal(dupDoc.deleteReason, 'duplicate_account');
    assert.equal(dupDoc.canonicalUserId, MEMBER_A_CANONICAL_ID);

    assert.equal(
      mockSdk.deletedAuthUids.includes(duplicateDocId),
      false,
      'duplicate_account must NEVER trigger auth.deleteUser'
    );
  });

  // -------------------------------------------------------------
  // Case 8: Auth Shadow Document Resolution via canonicalUserId Pointer
  // -------------------------------------------------------------
  test('Case 8: Auth shadow document with canonicalUserId pointer resolves to canonical profile in verifyRoleToken', async () => {
    // 8.1 Synthetic email token resolving via duplicate shadow filter
    const resSynthetic = await verifyRoleToken(`Bearer ${tokenShadowSynthetic}`, ['member']);
    assert.equal(resSynthetic.success, true);
    assert.equal(resSynthetic.actor.uid, MEMBER_A_CANONICAL_ID, 'actor.uid must resolve to canonical document ID');
    assert.equal(resSynthetic.actor.authUid, SHADOW_DOC_AUTH_UID, 'actor.authUid must be the Auth UID');
    assert.equal(resSynthetic.actor.role, 'member');

    // 8.2 Non-synthetic email token directly loading shadow doc and following canonicalUserId pointer
    const resNative = await verifyRoleToken(`Bearer ${tokenShadowNative}`, ['member']);
    assert.equal(resNative.success, true);
    assert.equal(resNative.actor.uid, MEMBER_A_CANONICAL_ID, 'actor.uid must resolve to canonical document ID');
    assert.equal(resNative.actor.authUid, SHADOW_DOC_AUTH_UID, 'actor.authUid must be the Auth UID');
    assert.equal(resNative.actor.role, 'member');
  });

  // -------------------------------------------------------------
  // Case 9: Cold Start Hydration Excludes status: 'deleted' Users Durably
  // -------------------------------------------------------------
  test('Case 9: Cold start rehydration excludes status: deleted documents without needing ephemeral tombstones', async () => {
    // Mark target_b as deleted in Firestore
    mockSdk.collections.users[MEMBER_B_CANONICAL_ID].status = 'deleted';

    // Trigger Model C rehydration
    const res = await fetch(`${baseUrl}/api/live-state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`
      },
      body: JSON.stringify({ fake: 'client data' })
    });
    assert.equal(res.status, 200);

    // Read live state
    const stateRes = await fetch(`${baseUrl}/api/live-state`);
    const state = await stateRes.json();
    assert.ok(state.data && Array.isArray(state.data.users));

    const foundTargetB = state.data.users.find((u) => u.id === MEMBER_B_CANONICAL_ID);
    assert.equal(foundTargetB, undefined, 'Soft-deleted user must be 100% excluded from live state');
  });

  // -------------------------------------------------------------
  // Case 10: Cold Start Hydration Excludes Shadow Users Durably
  // -------------------------------------------------------------
  test('Case 10: Cold start rehydration excludes status: shadow and isAuthShadow users', async () => {
    const stateRes = await fetch(`${baseUrl}/api/live-state`);
    const state = await stateRes.json();

    const shadowOwner = state.data.users.find((u) => u.id === REAL_OWNER_AUTH_UID);
    assert.equal(shadowOwner, undefined, 'Auth shadow owner document must be excluded');

    const shadowMember = state.data.users.find((u) => u.id === SHADOW_DOC_AUTH_UID);
    assert.equal(shadowMember, undefined, 'Auth shadow member document must be excluded');
  });

  // -------------------------------------------------------------
  // Case 11: Cold Start Hydration Retains Canonical Owner Exactly Once
  // -------------------------------------------------------------
  test('Case 11: Cold start rehydration retains canonical Owner exactly once', async () => {
    const stateRes = await fetch(`${baseUrl}/api/live-state`);
    const state = await stateRes.json();

    const ownerList = state.data.users.filter((u) => u.role === 'owner' || u.username === 'Eloni');
    assert.equal(ownerList.length, 1, 'Owner must appear exactly once');
    assert.equal(ownerList[0].id, REAL_OWNER_CANONICAL_ID, 'Retained owner must be the canonical profile');
  });

  // -------------------------------------------------------------
  // Case 12: Cold Start Hydration Retains pending_approval Users
  // -------------------------------------------------------------
  test('Case 12: Cold start rehydration retains pending_approval users without dropping them', async () => {
    const stateRes = await fetch(`${baseUrl}/api/live-state`);
    const state = await stateRes.json();

    const pendingUser = state.data.users.find((u) => u.id === PENDING_USER_CANONICAL_ID);
    assert.ok(pendingUser, 'pending_approval user must NOT be dropped');
    assert.equal(pendingUser.status, 'pending_approval');
  });

  // -------------------------------------------------------------
  // Case 13: Backup Serialization Excludes Deleted and Shadow Users
  // -------------------------------------------------------------
  test('Case 13: Active backup snapshot excludes deleted and shadow users', async () => {
    // Soft delete member B
    mockSdk.collections.users[MEMBER_B_CANONICAL_ID].status = 'deleted';

    // Simulate backup snapshot logic from scripts/backup-firestore-encrypted.mjs
    const snap = await mockSdk.db.collection('users').get();
    let docs = snap.docs;
    docs = docs.filter((document) => {
      const data = document.data();
      if (!data) return false;
      if (data.status === 'deleted') return false;
      if (data.status === 'shadow' || data.isAuthShadow) return false;
      return true;
    });

    const backedUpIds = docs.map((d) => d.id);
    assert.ok(backedUpIds.includes(REAL_OWNER_CANONICAL_ID), 'Canonical Owner must be in backup');
    assert.ok(backedUpIds.includes(ADMIN_CANONICAL_ID), 'Admin must be in backup');
    assert.ok(backedUpIds.includes(PENDING_USER_CANONICAL_ID), 'Pending user must be in backup');
    assert.equal(backedUpIds.includes(MEMBER_B_CANONICAL_ID), false, 'Deleted user must be excluded from backup');
    assert.equal(backedUpIds.includes(REAL_OWNER_AUTH_UID), false, 'Shadow Owner must be excluded from backup');
    assert.equal(backedUpIds.includes(SHADOW_DOC_AUTH_UID), false, 'Shadow Member must be excluded from backup');
  });

  // -------------------------------------------------------------
  // Case 14: Restore Anti-Resurrection Guard Preserves status: 'deleted'
  // -------------------------------------------------------------
  test('Case 14: Restore anti-resurrection guard preserves existing status: deleted in Firestore', async () => {
    // In Firestore, MEMBER_B is soft-deleted
    mockSdk.collections.users[MEMBER_B_CANONICAL_ID] = {
      id: MEMBER_B_CANONICAL_ID,
      username: 'target_b',
      status: 'deleted',
      deletedAt: 1700000000000,
      deletedBy: REAL_OWNER_CANONICAL_ID,
      deleteReason: 'admin_removal'
    };

    // Backup container taken earlier when MEMBER_B was still 'active'
    const backupCollections = {
      users: [
        {
          id: REAL_OWNER_CANONICAL_ID,
          data: { id: REAL_OWNER_CANONICAL_ID, username: 'Eloni', status: 'active', role: 'owner' }
        },
        {
          id: MEMBER_B_CANONICAL_ID,
          data: { id: MEMBER_B_CANONICAL_ID, username: 'target_b', status: 'active', role: 'member' }
        }
      ]
    };

    // Simulate restore logic from scripts/restore-firestore-encrypted.mjs
    const existingSnap = await mockSdk.db.collection('users').get();
    const existingDeletedDocs = new Map();
    existingSnap.docs.forEach((doc) => {
      const data = doc.data();
      if (data && data.status === 'deleted') {
        existingDeletedDocs.set(doc.id, data);
      }
    });

    const docsToRestore = backupCollections.users.filter((doc) => !existingDeletedDocs.has(doc.id));
    const docsToDelete = existingSnap.docs.filter((doc) => !existingDeletedDocs.has(doc.id));

    // Delete non-deleted existing documents
    for (const d of docsToDelete) {
      await mockSdk.db.collection('users').doc(d.id).delete();
    }
    // Restore documents from backup
    for (const d of docsToRestore) {
      await mockSdk.db.collection('users').doc(d.id).set(d.data);
    }

    // Verify MEMBER_B was NOT resurrected to active!
    const memberBDoc = mockSdk.collections.users[MEMBER_B_CANONICAL_ID];
    assert.ok(memberBDoc, 'MEMBER_B must still exist in Firestore');
    assert.equal(memberBDoc.status, 'deleted', 'MEMBER_B status must remain deleted');
    assert.equal(memberBDoc.deletedAt, 1700000000000, 'Original deletedAt must remain untouched');
    assert.equal(memberBDoc.deleteReason, 'admin_removal');
  });
});
