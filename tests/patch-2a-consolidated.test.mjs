import { test, describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  _setTestAdminSdk,
  usernameToAuthEmail
} from '../api/_firebaseAdmin.ts';
import { createApp } from '../api/_server.ts';

// -------------------------------------------------------------
// Test Fixtures: Production-representative user profiles
// -------------------------------------------------------------
const mockUserDatabase = {
  'user_owner_eloni': {
    id: 'user_owner_eloni',
    username: 'eloni',
    inGameName: 'ELONI',
    role: 'owner',
    clan: 'VoltZ',
    powerLevel: 3722,
    status: 'active'
  },
  'user_1789089284789_uqqv': {
    id: 'user_1789089284789_uqqv',
    username: 'w4lk1n9',
    inGameName: 'W4LK1N9',
    role: 'admin',
    clan: 'VoltZ',
    powerLevel: 3200,
    status: 'active'
  },
  'user_1789089304921_yksu': {
    id: 'user_1789089304921_yksu',
    username: 'darkkomet',
    inGameName: 'DarkKomet',
    role: 'member',
    clan: 'VoltZ',
    powerLevel: 2500,
    status: 'active'
  },
  'user_legacy_member_999': {
    id: 'user_legacy_member_999',
    username: 'legacymember',
    inGameName: 'LegacyMember',
    role: 'member',
    clan: 'VoltZ',
    powerLevel: 1800,
    status: 'active'
  }
};

function createMockDocSnapshot(id, data) {
  return {
    id,
    exists: Boolean(data),
    data: () => (data ? { ...data } : undefined)
  };
}

function createMockSdk(options = {}) {
  const users = options.users ? { ...options.users } : { ...mockUserDatabase };
  const validTokens = options.validTokens || new Map();
  const items = options.items || {
    'item-test-1': {
      id: 'item-test-1',
      name: 'Archangel Blade',
      rarity: 'MYTHIC',
      clan: 'VoltZ',
      claimants: [],
      updatedAt: 1000
    },
    'item-other-clan': {
      id: 'item-other-clan',
      name: 'Dragon Slayer',
      rarity: 'LEGEND',
      clan: 'OtherClan',
      claimants: [
        {
          userId: 'user_other_clan_member',
          inGameName: 'OtherClanMember',
          clan: 'OtherClan',
          powerLevel: 3000,
          claimedAt: 1000
        }
      ],
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
      gemini_ai: { apiKey: 'test-gemini-key' },
      discord_secure: { webhookUrl: 'https://discord.com/api/webhooks/123/secret_token' }
    }
  };

  const readStats = {
    users: 0,
    items: 0,
    item_queues: 0,
    quick_items: 0,
    general_items: 0,
    clans: 0,
    diamond_vault: 0
  };

  return {
    readStats,
    collections,
    auth: {
      verifyIdToken: async (token) => {
        if (validTokens.has(token)) {
          return validTokens.get(token);
        }
        const err = new Error('Firebase ID token has invalid signature or is expired');
        err.code = 'auth/argument-error';
        throw err;
      }
    },
    db: {
      runTransaction: async (updateFunction) => {
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
            get: async () => createMockDocSnapshot(docId, col[docId]),
            set: async (val, opts) => {
              col[docId] = opts?.merge ? { ...(col[docId] || {}), ...val } : val;
              return true;
            },
            delete: async () => {
              delete col[docId];
              return true;
            }
          }),
          get: async () => {
            if (readStats[colName] !== undefined) {
              readStats[colName]++;
            }
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

describe('PATCH 2A-CONSOLIDATED: Model C Live-State, Zero-Trust Claims, Scoped Unclaims & Config Hardening', () => {
  let appServer;
  let serverPort;
  let baseUrl;
  let mockSdk;

  const validOwnerToken = 'valid-token-owner-eloni';
  const validAdminToken = 'valid-token-admin-walkin';
  const validMemberToken = 'valid-token-member-darkkomet';
  const legacyMemberToken = 'valid-token-legacy-member-999';

  before(async () => {
    process.env.FIREBASE_PROJECT_ID = 'k7-item';
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      project_id: 'k7-item',
      private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n',
      client_email: 'test@k7-item.iam.gserviceaccount.com'
    });

    const validTokens = new Map([
      [validOwnerToken, { uid: 'auth-owner-uid', email: usernameToAuthEmail('eloni') }],
      [validAdminToken, { uid: 'auth-admin-uid', email: usernameToAuthEmail('w4lk1n9') }],
      [validMemberToken, { uid: 'auth-member-uid', email: usernameToAuthEmail('darkkomet') }],
      [legacyMemberToken, { uid: 'auth-legacy-uid', email: usernameToAuthEmail('legacymember') }]
    ]);

    mockSdk = createMockSdk({ validTokens });
    _setTestAdminSdk(mockSdk);

    const expressApp = await createApp();
    appServer = http.createServer(expressApp);
    await new Promise((resolve) => {
      appServer.listen(0, '127.0.0.1', () => {
        serverPort = appServer.address().port;
        baseUrl = `http://127.0.0.1:${serverPort}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (appServer) {
      if (typeof appServer.closeAllConnections === 'function') {
        appServer.closeAllConnections();
      }
      await new Promise((resolve) => appServer.close(resolve));
    }
    _setTestAdminSdk(null);
    setTimeout(() => process.exit(0), 50);
  });

  beforeEach(() => {
    // Reset SDK read counters and state before each test
    mockSdk.readStats.users = 0;
    mockSdk.readStats.items = 0;
    mockSdk.collections.items['item-test-1'] = {
      id: 'item-test-1',
      name: 'Archangel Blade',
      rarity: 'MYTHIC',
      clan: 'VoltZ',
      claimants: [],
      updatedAt: 1000
    };
    mockSdk.collections.items['item-other-clan'] = {
      id: 'item-other-clan',
      name: 'Dragon Slayer',
      rarity: 'LEGEND',
      clan: 'OtherClan',
      claimants: [
        {
          userId: 'user_other_clan_member',
          inGameName: 'OtherClanMember',
          clan: 'OtherClan',
          powerLevel: 3000,
          claimedAt: 1000
        }
      ],
      updatedAt: 1000
    };
  });

  // -------------------------------------------------------------
  // Condition 1: POST /api/live-state without token -> 401
  // -------------------------------------------------------------
  test('Condition 1: POST /api/live-state without token returns 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/live-state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { dummy: 'test' } })
    });
    assert.equal(res.status, 401, 'Unauthenticated POST /api/live-state must return 401');
    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error, 'UNAUTHORIZED');
  });

  // -------------------------------------------------------------
  // Condition 2: POST /api/live-state with forged member payload -> ignores payload, reflects Firestore only
  // -------------------------------------------------------------
  test('Condition 2: POST /api/live-state with forged member payload ignores payload 100%', async () => {
    const forgedPayload = {
      data: {
        users: [
          { id: 'hacked_user', username: 'hacker', role: 'owner' }
        ],
        vaultItems: [
          { id: 'forged_item_999', name: 'Hacked Weapon', claimants: [{ userId: 'hacker' }] }
        ],
        syncMeta: {
          deletedUsers: { 'user_owner_eloni': 9999999999 }
        }
      }
    };

    const res = await fetch(`${baseUrl}/api/live-state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validMemberToken}`
      },
      body: JSON.stringify(forgedPayload)
    });
    assert.equal(res.status, 200, 'Authenticated POST /api/live-state must succeed');

    // Read back state via GET /api/live-state
    const getRes = await fetch(`${baseUrl}/api/live-state?v=0`);
    assert.equal(getRes.status, 200);
    const getJson = await getRes.json();

    assert.ok(getJson.data, 'Data must be present');
    // Ensure forged user was NOT accepted
    const hackedUser = (getJson.data.users || []).find((u) => u.id === 'hacked_user');
    assert.equal(hackedUser, undefined, 'Forged user must not exist in live-state');

    // Ensure forged item was NOT accepted
    const forgedItem = (getJson.data.vaultItems || []).find((i) => i.id === 'forged_item_999');
    assert.equal(forgedItem, undefined, 'Forged item must not exist in live-state');

    // Ensure authentic items from Firestore ARE present
    const realItem = (getJson.data.vaultItems || []).find((i) => i.id === 'item-test-1');
    assert.ok(realItem, 'Authoritative Firestore item must be present');
    assert.equal(realItem.name, 'Archangel Blade');
  });

  // -------------------------------------------------------------
  // Condition 3: POST /api/live-state with member token -> 200, triggers rehydration
  // -------------------------------------------------------------
  test('Condition 3: POST /api/live-state with member token returns 200 and rehydrates state', async () => {
    // Add an item directly to Firestore
    mockSdk.collections.items['new-item-live'] = {
      id: 'new-item-live',
      name: 'Staff of Eva',
      rarity: 'EPIC',
      clan: 'VoltZ',
      claimants: [],
      updatedAt: 2000
    };

    // Wait slightly past cooldown to ensure rehydration executes
    await new Promise((r) => setTimeout(r, 2100));

    const res = await fetch(`${baseUrl}/api/live-state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validMemberToken}`
      }
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.version > 0);

    // Verify GET receives newly rehydrated item
    const getRes = await fetch(`${baseUrl}/api/live-state?v=0`);
    const getJson = await getRes.json();
    const evaStaff = (getJson.data.vaultItems || []).find((i) => i.id === 'new-item-live');
    assert.ok(evaStaff, 'New Firestore item must appear after rehydration');
  });

  // -------------------------------------------------------------
  // Condition 4: POST /api/live-state rapid burst -> throttled / coalesced into 1 read batch
  // -------------------------------------------------------------
  test('Condition 4: POST /api/live-state rapid burst is coalesced to 1 Firestore read batch', async () => {
    // Wait for cooldown
    await new Promise((r) => setTimeout(r, 2100));
    const initialReads = mockSdk.readStats.items;

    // Fire 5 concurrent requests simultaneously
    const requests = Array.from({ length: 5 }, () =>
      fetch(`${baseUrl}/api/live-state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validMemberToken}`
        }
      })
    );

    const responses = await Promise.all(requests);
    for (const res of responses) {
      assert.equal(res.status, 200);
    }

    const totalNewReads = mockSdk.readStats.items - initialReads;
    assert.equal(totalNewReads, 1, `Burst must execute exactly 1 Firestore read batch, but got ${totalNewReads}`);
  });

  // -------------------------------------------------------------
  // Condition 5: POST /api/claim-vault-item without token -> 401
  // -------------------------------------------------------------
  test('Condition 5: POST /api/claim-vault-item without token returns 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/claim-vault-item`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: 'item-test-1' })
    });
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error, 'UNAUTHORIZED');
  });

  // -------------------------------------------------------------
  // Condition 6: POST /api/claim-vault-item with member token & mismatched claimant ID -> forces canonical member ID
  // -------------------------------------------------------------
  test('Condition 6: POST /api/claim-vault-item forces canonical actor identity and power', async () => {
    const res = await fetch(`${baseUrl}/api/claim-vault-item`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validMemberToken}`
      },
      body: JSON.stringify({
        itemId: 'item-test-1',
        claimant: {
          userId: 'spoofed_user_id',
          inGameName: 'SpoofedName',
          powerLevel: 999999
        }
      })
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);

    // Verify response claimant matches verified actor profile, NOT spoofed values
    assert.equal(json.claimant.userId, 'user_1789089304921_yksu', 'Must use canonical user ID');
    assert.equal(json.claimant.inGameName, 'DarkKomet', 'Must use verified inGameName');
    assert.equal(json.claimant.powerLevel, 2500, 'Must use verified powerLevel');

    // Verify Firestore was updated with the canonical claimant
    const itemInDb = mockSdk.collections.items['item-test-1'];
    assert.ok(itemInDb.claimants.length === 1);
    assert.equal(itemInDb.claimants[0].userId, 'user_1789089304921_yksu');
    assert.equal(itemInDb.claimants[0].powerLevel, 2500);
  });

  // -------------------------------------------------------------
  // Condition 7: POST /api/claim-vault-item with legacy profile ID -> correctly matches legacy user, writes canonical ID
  // -------------------------------------------------------------
  test('Condition 7: POST /api/claim-vault-item with legacy user resolves canonical profile ID', async () => {
    const res = await fetch(`${baseUrl}/api/claim-vault-item`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${legacyMemberToken}`
      },
      body: JSON.stringify({
        itemId: 'item-test-1'
      })
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);

    // Canonical ID must be user_legacy_member_999 (not auth-legacy-uid)
    assert.equal(json.claimant.userId, 'user_legacy_member_999');
    assert.equal(json.claimant.inGameName, 'LegacyMember');
    assert.equal(json.claimant.powerLevel, 1800);

    const itemInDb = mockSdk.collections.items['item-test-1'];
    assert.ok(itemInDb.claimants.some((c) => c.userId === 'user_legacy_member_999'));
  });

  // -------------------------------------------------------------
  // Condition 8: POST /api/unclaim-vault-item without token -> 401
  // -------------------------------------------------------------
  test('Condition 8: POST /api/unclaim-vault-item without token returns 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/unclaim-vault-item`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: 'item-test-1' })
    });
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error, 'UNAUTHORIZED');
  });

  // -------------------------------------------------------------
  // Condition 9: POST /api/unclaim-vault-item member attempting other user -> 403 CANNOT_UNCLAIM_OTHER_USER
  // -------------------------------------------------------------
  test('Condition 9: POST /api/unclaim-vault-item member attempting other user returns 403', async () => {
    // Add another claimant to item-test-1
    mockSdk.collections.items['item-test-1'].claimants = [
      { userId: 'user_owner_eloni', inGameName: 'ELONI', clan: 'VoltZ', powerLevel: 3722, claimedAt: 1000 }
    ];

    const res = await fetch(`${baseUrl}/api/unclaim-vault-item`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validMemberToken}`
      },
      body: JSON.stringify({
        itemId: 'item-test-1',
        userId: 'user_owner_eloni',
        inGameName: 'ELONI'
      })
    });
    assert.equal(res.status, 403, 'Member must not be allowed to unclaim another user');
    const json = await res.json();
    assert.equal(json.error, 'CANNOT_UNCLAIM_OTHER_USER');

    // Ensure owner claimant is STILL in Firestore
    const itemInDb = mockSdk.collections.items['item-test-1'];
    assert.equal(itemInDb.claimants.length, 1);
  });

  // -------------------------------------------------------------
  // Condition 10: POST /api/unclaim-vault-item member self unclaim -> 200, removes from Firestore
  // -------------------------------------------------------------
  test('Condition 10: POST /api/unclaim-vault-item member self unclaim returns 200 and removes claimant', async () => {
    // Setup member's claim on item-test-1
    mockSdk.collections.items['item-test-1'].claimants = [
      { userId: 'user_1789089304921_yksu', inGameName: 'DarkKomet', clan: 'VoltZ', powerLevel: 2500, claimedAt: 1000 }
    ];

    const res = await fetch(`${baseUrl}/api/unclaim-vault-item`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validMemberToken}`
      },
      body: JSON.stringify({
        itemId: 'item-test-1',
        userId: 'user_1789089304921_yksu'
      })
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);

    // Verify claimant was removed in Firestore
    const itemInDb = mockSdk.collections.items['item-test-1'];
    assert.equal(itemInDb.claimants.length, 0, 'Claimant must be removed from Firestore');
  });

  // -------------------------------------------------------------
  // Condition 11: POST /api/unclaim-vault-item admin targeting other user -> 200 within scope, 403 out of scope
  // -------------------------------------------------------------
  test('Condition 11: POST /api/unclaim-vault-item admin targeting other user enforces clan scope', async () => {
    // 1. Admin (VoltZ) unclaims member on item-test-1 (VoltZ) -> ALLOWED (200)
    mockSdk.collections.items['item-test-1'].claimants = [
      { userId: 'user_1789089304921_yksu', inGameName: 'DarkKomet', clan: 'VoltZ', powerLevel: 2500, claimedAt: 1000 }
    ];

    const resWithinScope = await fetch(`${baseUrl}/api/unclaim-vault-item`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validAdminToken}`
      },
      body: JSON.stringify({
        itemId: 'item-test-1',
        userId: 'user_1789089304921_yksu'
      })
    });
    assert.equal(resWithinScope.status, 200, 'Admin can unclaim item in their own clan');
    assert.equal(mockSdk.collections.items['item-test-1'].claimants.length, 0);

    // 2. Admin (VoltZ) attempts to unclaim on item-other-clan (OtherClan) -> FORBIDDEN (403)
    const resOutOfScope = await fetch(`${baseUrl}/api/unclaim-vault-item`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validAdminToken}`
      },
      body: JSON.stringify({
        itemId: 'item-other-clan',
        userId: 'user_other_clan_member'
      })
    });
    assert.equal(resOutOfScope.status, 403, 'Admin cannot unclaim item outside their clan scope');
    const outJson = await resOutOfScope.json();
    assert.equal(outJson.error, 'CLAN_SCOPE_DENIED');
  });

  // -------------------------------------------------------------
  // Condition 12: POST /api/google-backup-config: without token -> 401; member -> 403; owner -> 200
  // -------------------------------------------------------------
  test('Condition 12: POST /api/google-backup-config requires Owner role strictly', async () => {
    // 1. Unauthenticated -> 401
    const resNoAuth = await fetch(`${baseUrl}/api/google-backup-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webAppUrl: 'https://script.google.com/macros/s/test/exec' })
    });
    assert.equal(resNoAuth.status, 401);

    // 2. Member token -> 403
    const resMember = await fetch(`${baseUrl}/api/google-backup-config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validMemberToken}`
      },
      body: JSON.stringify({ webAppUrl: 'https://script.google.com/macros/s/test/exec' })
    });
    assert.equal(resMember.status, 403);
    const memberJson = await resMember.json();
    assert.equal(memberJson.error, 'FORBIDDEN');

    // 3. Owner token -> 200
    const resOwner = await fetch(`${baseUrl}/api/google-backup-config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validOwnerToken}`
      },
      body: JSON.stringify({
        webAppUrl: 'https://script.google.com/macros/s/owner-script/exec',
        sheetUrl: 'https://docs.google.com/spreadsheets/d/owner-sheet/edit'
      })
    });
    assert.equal(resOwner.status, 200);
    const ownerJson = await resOwner.json();
    assert.equal(ownerJson.success, true);
    assert.equal(ownerJson.webAppUrl, 'https://script.google.com/macros/s/owner-script/exec');
    assert.equal(ownerJson.sheetUrl, 'https://docs.google.com/spreadsheets/d/owner-sheet/edit');
  });
});
