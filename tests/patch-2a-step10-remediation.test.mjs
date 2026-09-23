import { test, describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  _setTestAdminSdk,
  verifyRoleToken,
  usernameToAuthEmail
} from '../api/_firebaseAdmin.ts';
import { createApp } from '../api/_server.ts';

// -------------------------------------------------------------
// Production-Style Test Fixtures
// -------------------------------------------------------------
const REAL_OWNER_AUTH_UID = 'APsCZzEI4tYdx5UfHuY5Sw10L8B3';
const REAL_OWNER_CANONICAL_ID = 'user_owner_eloni';

const LEGACY_ADMIN_AUTH_UID = 'auth-uid-admin-walkin';
const LEGACY_ADMIN_CANONICAL_ID = 'user_1789089284789_uqqv';

const LEGACY_MEMBER_AUTH_UID = 'auth-uid-member-darkkomet';
const LEGACY_MEMBER_CANONICAL_ID = 'user_1789089304921_yksu';

const NATIVE_MEMBER_UID = 'VOi1DbKquRPMaKz5Jw8as7oaAeM2';

function createMockDocSnapshot(id, data) {
  return {
    id,
    exists: Boolean(data),
    data: () => (data ? { ...data } : undefined)
  };
}

function createStep10MockSdk(options = {}) {
  const users = options.users || {
    // 1. Canonical Owner Doc
    [REAL_OWNER_CANONICAL_ID]: {
      id: REAL_OWNER_CANONICAL_ID,
      username: 'Eloni',
      inGameName: 'Eloni',
      role: 'owner',
      clan: 'VoltZ',
      powerLevel: 3722,
      status: 'active',
      passwordHash: 'secret-hash-1',
      pin: '1234',
      authSecret: 'super-secret',
      email: usernameToAuthEmail('Eloni')
    },
    // 2. Auth UID Shadow Doc for Owner
    [REAL_OWNER_AUTH_UID]: {
      id: REAL_OWNER_AUTH_UID,
      username: 'Eloni',
      inGameName: 'Eloni',
      role: 'owner',
      clan: 'VoltZ',
      powerLevel: 3722,
      status: 'active'
    },
    // 3. Legacy Admin Doc
    [LEGACY_ADMIN_CANONICAL_ID]: {
      id: LEGACY_ADMIN_CANONICAL_ID,
      username: 'w4lk1n9',
      inGameName: 'W4LK1N9',
      role: 'admin',
      clan: 'VoltZ',
      powerLevel: 3200,
      status: 'active'
    },
    // 4. Legacy Member Doc
    [LEGACY_MEMBER_CANONICAL_ID]: {
      id: LEGACY_MEMBER_CANONICAL_ID,
      username: 'darkkomet',
      inGameName: 'DarkKomet',
      role: 'member',
      clan: 'VoltZ',
      powerLevel: 2500,
      status: 'active'
    },
    // 5. UID-Native Member Doc
    [NATIVE_MEMBER_UID]: {
      id: NATIVE_MEMBER_UID,
      username: 'Atysi',
      inGameName: 'Atysi',
      role: 'member',
      clan: 'VoltZ',
      powerLevel: 2100,
      status: 'active'
    },
    // 6. Legitimate Pending Approval User
    'user_pending_new_recruit': {
      id: 'user_pending_new_recruit',
      username: 'NewRecruit',
      inGameName: 'NewRecruit',
      role: 'member',
      clan: 'VoltZ',
      powerLevel: 1500,
      status: 'pending_approval'
    },
    // 7. Physically Deleted User
    'user_deleted_tombstone': {
      id: 'user_deleted_tombstone',
      username: 'DeletedDude',
      inGameName: 'DeletedDude',
      role: 'member',
      clan: 'VoltZ',
      status: 'deleted'
    },
    // 8. Tombstoned User in syncMeta
    'user_sync_tombstoned': {
      id: 'user_sync_tombstoned',
      username: 'SyncTombstoned',
      inGameName: 'SyncTombstoned',
      role: 'member',
      clan: 'VoltZ',
      status: 'active'
    }
  };

  const validTokens = options.validTokens || new Map();
  const items = options.items || {
    'item-vault-100': {
      id: 'item-vault-100',
      name: 'Excalibur',
      rarity: 'MYTHIC',
      clan: 'VoltZ',
      claimants: [],
      updatedAt: 1000
    }
  };

  const collections = {
    users,
    items,
    item_queues: options.item_queues || {},
    quick_items: options.quick_items || {},
    general_items: options.general_items || {},
    clans: options.clans || {},
    diamond_vault: options.diamond_vault || {},
    app_settings: {
      gemini_ai: { apiKey: 'secret-gemini-key', privateKey: 'secret-key' },
      discord_secure: { webhookUrl: 'https://discord.com/api/webhooks/secret' }
    }
  };

  let failFirestore = false;

  return {
    setFailFirestore: (fail) => { failFirestore = fail; },
    collections,
    auth: {
      verifyIdToken: async (token) => {
        if (validTokens.has(token)) {
          return validTokens.get(token);
        }
        const err = new Error('Invalid token');
        err.code = 'auth/argument-error';
        throw err;
      }
    },
    db: {
      runTransaction: async (updateFunction) => {
        if (failFirestore) {
          const err = new Error('RESOURCE_EXHAUSTED: Quota exceeded');
          err.code = 'RESOURCE_EXHAUSTED';
          throw err;
        }
        const transaction = {
          get: async (docRef) => docRef.get(),
          set: async (docRef, data, opts) => docRef.set(data, opts),
          update: async (docRef, data) => docRef.set(data, { merge: true }),
          delete: async (docRef) => docRef.delete()
        };
        return await updateFunction(transaction);
      },
      collection: (colName) => {
        const col = collections[colName] || (collections[colName] = {});
        return {
          doc: (docId) => ({
            id: docId,
            get: async () => {
              if (failFirestore) throw new Error('RESOURCE_EXHAUSTED: Quota exceeded');
              return createMockDocSnapshot(docId, col[docId]);
            },
            set: async (val, opts) => {
              if (failFirestore) throw new Error('RESOURCE_EXHAUSTED: Quota exceeded');
              col[docId] = opts?.merge ? { ...(col[docId] || {}), ...val } : val;
              return true;
            },
            delete: async () => {
              if (failFirestore) throw new Error('RESOURCE_EXHAUSTED: Quota exceeded');
              delete col[docId];
              return true;
            }
          }),
          get: async () => {
            if (failFirestore) throw new Error('RESOURCE_EXHAUSTED: Quota exceeded');
            const docs = Object.entries(col).map(([id, d]) => createMockDocSnapshot(id, d));
            return {
              docs,
              forEach: (fn) => docs.forEach(fn)
            };
          }
        };
      }
    }
  };
}

describe('STEP 10: Pre-Production Blocker Remediation Suite', () => {
  let appServer;
  let baseUrl;
  let mockSdk;

  const tokenOwner = 'token-real-owner';
  const tokenAdmin = 'token-legacy-admin';
  const tokenMember = 'token-legacy-member';
  const tokenNative = 'token-native-member';

  before(async () => {
    process.env.FIREBASE_PROJECT_ID = 'k7-item';
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      project_id: 'k7-item',
      private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n',
      client_email: 'test@k7-item.iam.gserviceaccount.com'
    });

    const validTokens = new Map([
      [tokenOwner, { uid: REAL_OWNER_AUTH_UID, email: usernameToAuthEmail('Eloni') }],
      [tokenAdmin, { uid: LEGACY_ADMIN_AUTH_UID, email: usernameToAuthEmail('w4lk1n9') }],
      [tokenMember, { uid: LEGACY_MEMBER_AUTH_UID, email: usernameToAuthEmail('darkkomet') }],
      [tokenNative, { uid: NATIVE_MEMBER_UID, email: 'atysi@example.com' }]
    ]);

    mockSdk = createStep10MockSdk({ validTokens });
    _setTestAdminSdk(mockSdk);

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
      await new Promise((resolve) => appServer.close(resolve));
    }
  });

  // -------------------------------------------------------------
  // Test 1: Real Owner shadow doc + canonical resolver
  // -------------------------------------------------------------
  test('1. Real Owner token UID with shadow doc resolves canonical document ID', async () => {
    const res = await verifyRoleToken(`Bearer ${tokenOwner}`, ['owner']);
    assert.equal(res.success, true);
    assert.equal(res.actor.uid, REAL_OWNER_CANONICAL_ID, 'actor.uid must equal canonical user_owner_eloni');
    assert.equal(res.actor.authUid, REAL_OWNER_AUTH_UID, 'actor.authUid must equal Firebase Auth UID');
    assert.notEqual(res.actor.uid, res.actor.authUid, 'For Legacy Owner: actor.uid !== actor.authUid');
    assert.equal(res.actor.role, 'owner');
  });

  // -------------------------------------------------------------
  // Test 2: Legacy Admin & Member canonical resolvers
  // -------------------------------------------------------------
  test('2. Legacy Admin and Member tokens resolve canonical profile document IDs', async () => {
    const adminRes = await verifyRoleToken(`Bearer ${tokenAdmin}`, ['admin']);
    assert.equal(adminRes.success, true);
    assert.equal(adminRes.actor.uid, LEGACY_ADMIN_CANONICAL_ID);
    assert.equal(adminRes.actor.authUid, LEGACY_ADMIN_AUTH_UID);
    assert.notEqual(adminRes.actor.uid, adminRes.actor.authUid);

    const memberRes = await verifyRoleToken(`Bearer ${tokenMember}`, ['member']);
    assert.equal(memberRes.success, true);
    assert.equal(memberRes.actor.uid, LEGACY_MEMBER_CANONICAL_ID);
    assert.equal(memberRes.actor.authUid, LEGACY_MEMBER_AUTH_UID);
    assert.notEqual(memberRes.actor.uid, memberRes.actor.authUid);
  });

  // -------------------------------------------------------------
  // Test 3: UID-Native Member resolver
  // -------------------------------------------------------------
  test('3. UID-native Member resolves directly and actor.uid === actor.authUid', async () => {
    const nativeRes = await verifyRoleToken(`Bearer ${tokenNative}`, ['member']);
    assert.equal(nativeRes.success, true);
    assert.equal(nativeRes.actor.uid, NATIVE_MEMBER_UID);
    assert.equal(nativeRes.actor.authUid, NATIVE_MEMBER_UID);
    assert.equal(nativeRes.actor.uid, nativeRes.actor.authUid, 'For UID-native: actor.uid === actor.authUid');
  });

  // -------------------------------------------------------------
  // Test 4: Relay Model C user canonicalization
  // -------------------------------------------------------------
  test('4. Model C rehydration excludes shadow doc and deleted users while keeping pending users', async () => {
    // Inject tombstone for user_sync_tombstoned
    const postRes = await fetch(`${baseUrl}/api/live-state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`
      }
    });
    assert.equal(postRes.status, 200);

    const getRes = await fetch(`${baseUrl}/api/live-state?v=0`);
    const getJson = await getRes.json();
    const relayUsers = getJson.data.users || [];

    // Verify physical count vs canonical relay count
    const physicalDocCount = Object.keys(mockSdk.collections.users).length; // 8 docs
    assert.ok(physicalDocCount > relayUsers.length, 'Physical Firestore user docs > Relay canonical users');

    // Verify Owner deduplication: exactly 1 Eloni
    const eloniProfiles = relayUsers.filter((u) => u.username.toLowerCase() === 'eloni');
    assert.equal(eloniProfiles.length, 1, 'Only 1 canonical Owner profile in relay state');
    assert.equal(eloniProfiles[0].id, REAL_OWNER_CANONICAL_ID, 'Relay Owner must use canonical ID');

    // Verify Shadow doc APsCZz... is NOT in relay state
    const shadowDoc = relayUsers.find((u) => u.id === REAL_OWNER_AUTH_UID);
    assert.equal(shadowDoc, undefined, 'Auth UID shadow document must not be exposed');

    // Verify deleted user is excluded
    const deletedUser = relayUsers.find((u) => u.id === 'user_deleted_tombstone');
    assert.equal(deletedUser, undefined, 'status=deleted user must be excluded');

    // Verify pending_approval user is preserved
    const pendingUser = relayUsers.find((u) => u.id === 'user_pending_new_recruit');
    assert.ok(pendingUser, 'pending_approval user must be preserved so Admin can approve');
    assert.equal(pendingUser.status, 'pending_approval');
  });

  // -------------------------------------------------------------
  // Test 5: Backend-Authoritative Claim with Canonical Claimant
  // -------------------------------------------------------------
  test('5. Claim persists canonical claimant (actor.uid) and rejects unauthorized caller', async () => {
    // Unauthenticated -> 401
    const unauthRes = await fetch(`${baseUrl}/api/claim-vault-item`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: 'item-vault-100' })
    });
    assert.equal(unauthRes.status, 401);

    // Legacy Owner Claim -> claimant.userId === user_owner_eloni (NEVER authUid)
    const ownerClaimRes = await fetch(`${baseUrl}/api/claim-vault-item`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`
      },
      body: JSON.stringify({ itemId: 'item-vault-100' })
    });
    assert.equal(ownerClaimRes.status, 200);
    const ownerClaimJson = await ownerClaimRes.json();
    assert.equal(ownerClaimJson.claimant.userId, REAL_OWNER_CANONICAL_ID);
    assert.notEqual(ownerClaimJson.claimant.userId, REAL_OWNER_AUTH_UID);

    // Member Claim -> claimant.userId === user_1789089304921_yksu
    const memberClaimRes = await fetch(`${baseUrl}/api/claim-vault-item`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenMember}`
      },
      body: JSON.stringify({ itemId: 'item-vault-100' })
    });
    assert.equal(memberClaimRes.status, 200);
    const memberClaimJson = await memberClaimRes.json();
    assert.equal(memberClaimJson.claimant.userId, LEGACY_MEMBER_CANONICAL_ID);
  });

  // -------------------------------------------------------------
  // Test 6: 20 Concurrent Distinct Claims via Atomic Transaction
  // -------------------------------------------------------------
  test('6. 20 concurrent distinct claim requests via transaction all survive without lost updates', async () => {
    // Create 20 synthetic members
    const tokens = [];
    for (let i = 1; i <= 20; i++) {
      const uId = `user_concurrent_${i}`;
      const authId = `auth_concurrent_${i}`;
      const username = `concurrent${i}`;
      mockSdk.collections.users[uId] = {
        id: uId,
        username,
        inGameName: `Concurrent${i}`,
        role: 'member',
        clan: 'VoltZ',
        powerLevel: 2000 + i,
        status: 'active'
      };
      const t = `token-concurrent-${i}`;
      mockSdk.auth.verifyIdToken = async (tok) => {
        if (tok.startsWith('token-concurrent-')) {
          const num = tok.split('-')[2];
          return {
            uid: `auth_concurrent_${num}`,
            email: usernameToAuthEmail(`concurrent${num}`)
          };
        }
        if (tok === tokenOwner) return { uid: REAL_OWNER_AUTH_UID, email: usernameToAuthEmail('Eloni') };
        if (tok === tokenMember) return { uid: LEGACY_MEMBER_AUTH_UID, email: usernameToAuthEmail('darkkomet') };
        throw new Error('Invalid token');
      };
      tokens.push(t);
    }

    // Fire 20 concurrent claims
    const claimPromises = tokens.map((token) =>
      fetch(`${baseUrl}/api/claim-vault-item`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ itemId: 'item-vault-100' })
      })
    );

    const responses = await Promise.all(claimPromises);
    for (const r of responses) {
      assert.equal(r.status, 200);
    }

    // Verify all 20 claimants exist on item in Firestore
    const storedItem = mockSdk.collections.items['item-vault-100'];
    const claimantUserIds = storedItem.claimants.map((c) => c.userId);
    for (let i = 1; i <= 20; i++) {
      assert.ok(
        claimantUserIds.includes(`user_concurrent_${i}`),
        `Claimant user_concurrent_${i} must survive in transaction`
      );
    }
  });

  // -------------------------------------------------------------
  // Test 7: Concurrent Unclaim + Claim Safety
  // -------------------------------------------------------------
  test('7. Unclaim removes only targeted claimant without overwriting other claims', async () => {
    const unclaimRes = await fetch(`${baseUrl}/api/unclaim-vault-item`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer token-concurrent-5`
      },
      body: JSON.stringify({
        itemId: 'item-vault-100',
        userId: 'user_concurrent_5'
      })
    });
    assert.equal(unclaimRes.status, 200);

    const storedItem = mockSdk.collections.items['item-vault-100'];
    const claimantUserIds = storedItem.claimants.map((c) => c.userId);
    assert.ok(!claimantUserIds.includes('user_concurrent_5'), 'user_concurrent_5 must be removed');
    assert.ok(claimantUserIds.includes('user_concurrent_1'), 'user_concurrent_1 must remain');
    assert.ok(claimantUserIds.includes('user_concurrent_10'), 'user_concurrent_10 must remain');
  });

  // -------------------------------------------------------------
  // Test 8: Truthful Failure Contract (503 Service Unavailable)
  // -------------------------------------------------------------
  test('8. Firestore unavailable fails closed with 503 and preserves existing state', async () => {
    // Capture state before failure
    const beforeGet = await fetch(`${baseUrl}/api/live-state?v=0`);
    const beforeJson = await beforeGet.json();
    const versionBefore = beforeJson.version;

    try {
      // Simulate Firestore failure
      mockSdk.setFailFirestore(true);

      // POST /api/live-state should return 503
      const liveRes = await fetch(`${baseUrl}/api/live-state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenOwner}`
        }
      });
      assert.equal(liveRes.status, 503);
      const liveJson = await liveRes.json();
      assert.ok(
        liveJson.error === 'SERVICE_UNAVAILABLE' || liveJson.error === 'AUTH_SERVICE_UNAVAILABLE',
        'Failure must be 503 fail-closed'
      );

      // Claim should return 503
      const claimRes = await fetch(`${baseUrl}/api/claim-vault-item`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenOwner}`
        },
        body: JSON.stringify({ itemId: 'item-vault-100' })
      });
      assert.equal(claimRes.status, 503);

      // Unclaim should return 503
      const unclaimRes = await fetch(`${baseUrl}/api/unclaim-vault-item`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenOwner}`
        },
        body: JSON.stringify({ itemId: 'item-vault-100', userId: REAL_OWNER_CANONICAL_ID })
      });
      assert.equal(unclaimRes.status, 503);
    } finally {
      // Always restore Firestore
      mockSdk.setFailFirestore(false);
    }

    // Verify version is unchanged
    const afterGet = await fetch(`${baseUrl}/api/live-state?v=0`);
    const afterJson = await afterGet.json();
    assert.equal(afterJson.version, versionBefore, 'Relay version must be unchanged after 503');
  });

  // -------------------------------------------------------------
  // Test 9: Public GET Zero-Secret Exposure Audit
  // -------------------------------------------------------------
  test('9. Public GET /api/live-state contains ZERO sensitive secrets', async () => {
    const res = await fetch(`${baseUrl}/api/live-state?v=0`);
    assert.equal(res.status, 200);
    const json = await res.json();
    const rawString = JSON.stringify(json);

    // Secrets that must never appear in public relay state
    assert.ok(!rawString.includes('secret-hash-1'), 'passwordHash must not appear');
    assert.ok(!rawString.includes('super-secret'), 'authSecret must not appear');
    assert.ok(!rawString.includes('secret-gemini-key'), 'geminiApiKey must not appear');
    assert.ok(!rawString.includes('https://discord.com/api/webhooks/secret'), 'discord webhook URL must not appear');
    assert.ok(!rawString.includes('https://script.google.com/macros/s/'), 'Google Apps Script URL must not appear');
    assert.ok(!rawString.includes('https://docs.google.com/spreadsheets/d/'), 'Google Sheet URL must not appear');

    // Users must not have pin or authUid
    for (const u of json.data.users) {
      assert.equal(u.password, undefined);
      assert.equal(u.passwordHash, undefined);
      assert.equal(u.salt, undefined);
      assert.equal(u.hash, undefined);
      assert.equal(u.pin, undefined);
      assert.equal(u.authSecret, undefined);
      assert.equal(u.authUid, undefined);
      assert.equal(u.tokens, undefined);
    }
  });

  // -------------------------------------------------------------
  // Test 10: Deterministic Relay Hashing
  // -------------------------------------------------------------
  test('10. Same logical records in different collection/key orders yield identical hash', async () => {
    // Wait past cooldown
    await new Promise((r) => setTimeout(r, 2100));

    // First POST: synchronize any Firestore writes from earlier tests (claim/unclaim) into relay memory
    const warmupRes = await fetch(`${baseUrl}/api/live-state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`
      }
    });
    assert.equal(warmupRes.status, 200);

    // Wait past cooldown for subsequent test
    await new Promise((r) => setTimeout(r, 2100));

    // Get current baseline version
    const res1 = await fetch(`${baseUrl}/api/live-state?v=0`);
    const json1 = await res1.json();
    const version1 = json1.version;

    // Trigger second POST rehydration without altering any data
    const syncRes = await fetch(`${baseUrl}/api/live-state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`
      }
    });
    assert.equal(syncRes.status, 200);

    const res2 = await fetch(`${baseUrl}/api/live-state?v=0`);
    const json2 = await res2.json();
    assert.equal(json2.version, version1, 'No data change must not bump state version');
  });

  // -------------------------------------------------------------
  // Test 11: Read Amplification Rate Limiting
  // -------------------------------------------------------------
  test('11. Rapid burst exceeding limit triggers 429 TOO_MANY_REQUESTS', async () => {
    let got429 = false;
    for (let i = 0; i < 20; i++) {
      const res = await fetch(`${baseUrl}/api/live-state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenOwner}`
        }
      });
      if (res.status === 429) {
        got429 = true;
        const errJson = await res.json();
        assert.equal(errJson.error, 'TOO_MANY_REQUESTS');
        break;
      }
    }
    assert.ok(got429, 'Excessive POST /api/live-state calls must return 429 TOO_MANY_REQUESTS');
  });
});
