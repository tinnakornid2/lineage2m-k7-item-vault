import { test, describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  verifyRoleToken,
  _setTestAdminSdk,
  usernameToAuthEmail,
  deleteManagedUser,
  changeManagedUserPassword,
  saveStoredGeminiApiKey,
  saveStoredDiscordWebhookUrls
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
    status: 'active'
  },
  'user_1789089284789_uqqv': {
    id: 'user_1789089284789_uqqv',
    username: 'w4lk1n9',
    inGameName: 'W4LK1N9',
    role: 'admin',
    status: 'active'
  },
  'user_1789089304921_yksu': {
    id: 'user_1789089304921_yksu',
    username: 'darkkomet',
    inGameName: 'DarkKomet',
    role: 'member',
    status: 'active'
  },
  'native-uid-123': {
    id: 'native-uid-123',
    username: 'nativemember',
    inGameName: 'NativeMember',
    role: 'member',
    status: 'active'
  },
  'suspended-uid-456': {
    id: 'suspended-uid-456',
    username: 'suspendeduser',
    inGameName: 'SuspendedUser',
    role: 'member',
    status: 'suspended'
  },
  'deleted-uid-789': {
    id: 'deleted-uid-789',
    username: 'deleteduser',
    inGameName: 'DeletedUser',
    role: 'member',
    status: 'deleted'
  }
};

// Helper to create a mock Firestore doc
function createMockDocSnapshot(id, data) {
  return {
    id,
    exists: Boolean(data),
    data: () => (data ? { ...data } : undefined)
  };
}

// Helper to build a mock Admin SDK
function createMockSdk(options = {}) {
  const users = options.users || mockUserDatabase;
  const validTokens = options.validTokens || new Map();
  const dbData = { ...users };
  const settingsData = {
    gemini_ai: { apiKey: 'existing-gemini-key-123' },
    discord_secure: { webhookUrl: 'https://discord.com/api/webhooks/123/abc' }
  };

  return {
    auth: {
      verifyIdToken: async (token) => {
        if (options.authThrow) throw options.authThrow;
        if (options.authTimeout) {
          await new Promise((r) => setTimeout(r, 5000));
          return null;
        }
        if (validTokens.has(token)) {
          return validTokens.get(token);
        }
        const err = new Error('Firebase ID token has invalid signature or is expired');
        err.code = 'auth/argument-error';
        throw err;
      },
      deleteUser: async (uid) => {
        if (!dbData[uid]) {
          const err = new Error('User not found in Auth');
          err.code = 'auth/user-not-found';
          throw err;
        }
        return true;
      },
      updateUser: async (uid, data) => {
        if (!dbData[uid]) {
          const err = new Error('User not found in Auth');
          err.code = 'auth/user-not-found';
          throw err;
        }
        return true;
      }
    },
    db: {
      collection: (colName) => {
        if (colName === 'users') {
          return {
            doc: (docId) => ({
              get: async () => createMockDocSnapshot(docId, dbData[docId]),
              set: async (val, opts) => {
                dbData[docId] = opts?.merge ? { ...(dbData[docId] || {}), ...val } : val;
                return true;
              },
              delete: async () => {
                delete dbData[docId];
                return true;
              }
            }),
            get: async () => {
              if (options.firestoreThrow) throw options.firestoreThrow;
              const docs = Object.entries(dbData).map(([id, d]) => createMockDocSnapshot(id, d));
              return { docs };
            }
          };
        }
        if (colName === 'app_settings') {
          return {
            doc: (docId) => ({
              get: async () => createMockDocSnapshot(docId, settingsData[docId]),
              set: async (val, opts) => {
                settingsData[docId] = opts?.merge ? { ...(settingsData[docId] || {}), ...val } : val;
                return true;
              }
            })
          };
        }
        return {
          doc: (docId) => ({
            get: async () => createMockDocSnapshot(docId, null),
            set: async () => true,
            delete: async () => true
          })
        };
      }
    }
  };
}

describe('PATCH 2A-1: Backend Token Verification & Fail-Closed Security', () => {
  let appServer;
  let serverPort;
  let validTokens;

  before(async () => {
    validTokens = new Map();

    // 1. Legacy Owner Token (Auth UID != Firestore Doc ID)
    const ownerAuthUid = 'firebase-auth-uid-owner-eloni-xyz';
    validTokens.set('token_legacy_owner', {
      uid: ownerAuthUid,
      email: usernameToAuthEmail('eloni'),
      sub: ownerAuthUid
    });

    // 2. Legacy Admin Token (Auth UID != Firestore Doc ID)
    const adminAuthUid = 'firebase-auth-uid-admin-walk-xyz';
    validTokens.set('token_legacy_admin', {
      uid: adminAuthUid,
      email: usernameToAuthEmail('w4lk1n9'),
      sub: adminAuthUid
    });

    // 3. Legacy Member Token (Auth UID != Firestore Doc ID)
    const memberAuthUid = 'firebase-auth-uid-member-dark-xyz';
    validTokens.set('token_legacy_member', {
      uid: memberAuthUid,
      email: usernameToAuthEmail('darkkomet'),
      sub: memberAuthUid
    });

    // 4. UID-Native Member Token (Auth UID == Firestore Doc ID)
    validTokens.set('token_native_member', {
      uid: 'native-uid-123',
      email: 'nativemember@k7.local',
      sub: 'native-uid-123'
    });

    // Edge Cases:
    // Token with odd-length hex email local-part (9 hex chars before @auth.k7-clan.local)
    validTokens.set('token_odd_hex_email', {
      uid: 'auth-odd-1',
      email: '656c6f6e1@auth.k7-clan.local',
      sub: 'auth-odd-1'
    });

    // Token whose decoded username does not match any profile
    validTokens.set('token_unmatched_user', {
      uid: 'auth-ghost-user',
      email: usernameToAuthEmail('ghostuser999'),
      sub: 'auth-ghost-user'
    });

    // Token for suspended user
    validTokens.set('token_suspended_user', {
      uid: 'suspended-uid-456',
      email: usernameToAuthEmail('suspendeduser'),
      sub: 'suspended-uid-456'
    });

    // Setup Express App
    _setTestAdminSdk(createMockSdk({ validTokens }));
    const expressApp = await createApp();
    appServer = http.createServer(expressApp);
    await new Promise((resolve) => {
      appServer.listen(0, '127.0.0.1', () => {
        serverPort = appServer.address().port;
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
    // Reset to default working mock SDK
    _setTestAdminSdk(createMockSdk({ validTokens }));
  });

  // Helper to make HTTP requests
  function makeRequest({ method = 'GET', path, headers = {}, body = null }) {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : null;
      const reqHeaders = { ...headers };
      if (payload) {
        reqHeaders['Content-Type'] = 'application/json';
        reqHeaders['Content-Length'] = Buffer.byteLength(payload);
      }
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: serverPort,
          path,
          method,
          headers: reqHeaders
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            let json = null;
            try { json = JSON.parse(data); } catch {}
            resolve({ status: res.statusCode, headers: res.headers, body: json, rawBody: data });
          });
        }
      );
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  // -------------------------------------------------------------
  // Test Case 1: Valid ID Token for Legacy Owner
  // -------------------------------------------------------------
  test('Case 1: Valid ID Token for Legacy Owner resolves to owner role', async () => {
    const res = await verifyRoleToken('Bearer token_legacy_owner', ['owner', 'admin']);
    assert.equal(res.success, true);
    assert.equal(res.actor.uid, 'user_owner_eloni');
    assert.equal(res.actor.role, 'owner');
    assert.equal(res.actor.username, 'eloni');

    // HTTP Endpoint test: save-gemini-key requires owner
    const httpRes = await makeRequest({
      method: 'POST',
      path: '/api/save-gemini-key',
      headers: { Authorization: 'Bearer token_legacy_owner' },
      body: { apiKey: 'AIzaSyFakeKey1234567890abcdef' }
    });
    // Either 200 (if Gemini mocked) or 400 (if invalid Google AI key), but NOT 401 or 403 or 503
    assert.notEqual(httpRes.status, 401, 'Should not be 401 Unauthorized');
    assert.notEqual(httpRes.status, 403, 'Should not be 403 Forbidden for Owner');
  });

  // -------------------------------------------------------------
  // Test Case 2: Valid ID Token for Legacy Admin
  // -------------------------------------------------------------
  test('Case 2: Valid ID Token for Legacy Admin resolves to admin role', async () => {
    const res = await verifyRoleToken('Bearer token_legacy_admin', ['owner', 'admin']);
    assert.equal(res.success, true);
    assert.equal(res.actor.uid, 'user_1789089284789_uqqv');
    assert.equal(res.actor.role, 'admin');
    assert.equal(res.actor.username, 'w4lk1n9');

    // HTTP Endpoint test: gemini-status allows admin
    const httpRes = await makeRequest({
      method: 'GET',
      path: '/api/gemini-status',
      headers: { Authorization: 'Bearer token_legacy_admin' }
    });
    assert.equal(httpRes.status, 200);
    assert.equal(httpRes.body.configured, true);
  });

  // -------------------------------------------------------------
  // Test Case 3: Valid ID Token for Legacy Member
  // -------------------------------------------------------------
  test('Case 3: Valid ID Token for Legacy Member resolves to member role', async () => {
    const res = await verifyRoleToken('Bearer token_legacy_member', ['member', 'party_leader']);
    assert.equal(res.success, true);
    assert.equal(res.actor.uid, 'user_1789089304921_yksu');
    assert.equal(res.actor.role, 'member');
    assert.equal(res.actor.username, 'darkkomet');
  });

  // -------------------------------------------------------------
  // Test Case 4: Valid ID Token for UID-Native Member
  // -------------------------------------------------------------
  test('Case 4: Valid ID Token for UID-Native Member resolves directly via doc.id', async () => {
    const res = await verifyRoleToken('Bearer token_native_member', ['member', 'party_leader']);
    assert.equal(res.success, true);
    assert.equal(res.actor.uid, 'native-uid-123');
    assert.equal(res.actor.role, 'member');
  });

  // -------------------------------------------------------------
  // Test Case 5: Fake/Forged ID Token
  // -------------------------------------------------------------
  test('Case 5: Fake/Forged ID Token is rejected with 401 Unauthorized', async () => {
    const res = await verifyRoleToken('Bearer fake.forged.jwt.token', ['owner', 'admin', 'member']);
    assert.equal(res.success, false);
    assert.equal(res.status, 401);
    assert.equal(res.code, 'UNAUTHORIZED');

    const httpRes = await makeRequest({
      method: 'GET',
      path: '/api/gemini-status',
      headers: { Authorization: 'Bearer fake.forged.jwt.token' }
    });
    assert.equal(httpRes.status, 401);
    assert.equal(httpRes.body.error, 'UNAUTHORIZED');
  });

  // -------------------------------------------------------------
  // Test Case 6: Tampered JWT
  // -------------------------------------------------------------
  test('Case 6: Tampered JWT signature is rejected with 401 Unauthorized', async () => {
    // Construct a tampered 3-part string imitating header.payload.bad_sig
    const payload = Buffer.from(JSON.stringify({ uid: 'user_owner_eloni', role: 'owner' })).toString('base64');
    const tampered = `eyJhbGciOiJSUzI1NiJ9.${payload}.bad_signature_bytes`;

    const res = await verifyRoleToken(`Bearer ${tampered}`, ['owner', 'admin']);
    assert.equal(res.success, false);
    assert.equal(res.status, 401);
    assert.equal(res.code, 'UNAUTHORIZED');

    const httpRes = await makeRequest({
      method: 'POST',
      path: '/api/save-gemini-key',
      headers: { Authorization: `Bearer ${tampered}` },
      body: { apiKey: 'AIzaSyFakeKey1234567890abcdef' }
    });
    assert.equal(httpRes.status, 401);
  });

  // -------------------------------------------------------------
  // Test Case 7: Expired ID Token
  // -------------------------------------------------------------
  test('Case 7: Expired ID Token is rejected with 401 Unauthorized', async () => {
    const expiredSdk = createMockSdk({
      authThrow: Object.assign(new Error('Firebase ID token has expired'), { code: 'auth/id-token-expired' })
    });
    _setTestAdminSdk(expiredSdk);

    const res = await verifyRoleToken('Bearer token_expired', ['owner', 'admin', 'member']);
    assert.equal(res.success, false);
    assert.equal(res.status, 401);
    assert.equal(res.code, 'UNAUTHORIZED');

    const httpRes = await makeRequest({
      method: 'GET',
      path: '/api/gemini-status',
      headers: { Authorization: 'Bearer token_expired' }
    });
    assert.equal(httpRes.status, 401);
  });

  // -------------------------------------------------------------
  // Test Case 8: local-dev-*-owner token is rejected with 401
  // -------------------------------------------------------------
  test('Case 8: local-dev-*-owner token is strictly rejected with 401 (no backdoor)', async () => {
    const bypassToken = 'local-dev-user_owner_eloni-owner';
    const res = await verifyRoleToken(`Bearer ${bypassToken}`, ['owner']);
    assert.equal(res.success, false);
    assert.equal(res.status, 401);
    assert.equal(res.code, 'UNAUTHORIZED');

    const httpRes = await makeRequest({
      method: 'POST',
      path: '/api/save-gemini-key',
      headers: { Authorization: `Bearer ${bypassToken}` },
      body: { apiKey: 'AIzaSyFakeKey1234567890abcdef' }
    });
    assert.equal(httpRes.status, 401);
    assert.equal(httpRes.body.error, 'UNAUTHORIZED');
  });

  // -------------------------------------------------------------
  // Test Case 9: Member attempting to call Owner-only endpoint
  // -------------------------------------------------------------
  test('Case 9: Member attempting to call Owner-only endpoint is rejected with 403 Forbidden', async () => {
    const res = await verifyRoleToken('Bearer token_legacy_member', ['owner']);
    assert.equal(res.success, false);
    assert.equal(res.status, 403);
    assert.equal(res.code, 'FORBIDDEN');

    const httpRes = await makeRequest({
      method: 'POST',
      path: '/api/save-gemini-key',
      headers: { Authorization: 'Bearer token_legacy_member' },
      body: { apiKey: 'AIzaSyFakeKey1234567890abcdef' }
    });
    assert.equal(httpRes.status, 403);
    assert.equal(httpRes.body.error, 'FORBIDDEN');
  });

  // -------------------------------------------------------------
  // Test Case 10: Admin attempting to call Owner-only endpoint
  // -------------------------------------------------------------
  test('Case 10: Admin attempting to call Owner-only endpoint is rejected with 403 Forbidden', async () => {
    const res = await verifyRoleToken('Bearer token_legacy_admin', ['owner']);
    assert.equal(res.success, false);
    assert.equal(res.status, 403);
    assert.equal(res.code, 'FORBIDDEN');

    const httpRes = await makeRequest({
      method: 'POST',
      path: '/api/save-gemini-key',
      headers: { Authorization: 'Bearer token_legacy_admin' },
      body: { apiKey: 'AIzaSyFakeKey1234567890abcdef' }
    });
    assert.equal(httpRes.status, 403);
    assert.equal(httpRes.body.error, 'FORBIDDEN');
  });

  // -------------------------------------------------------------
  // Test Case 11: Firebase Admin SDK credentials unavailable -> fail-closed (503)
  // -------------------------------------------------------------
  test('Case 11: Firebase Admin SDK credentials unavailable fails closed with 503', async () => {
    // Explicitly set mock SDK to null
    _setTestAdminSdk(null);
    const savedSa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const savedEmu = process.env.FIREBASE_AUTH_EMULATOR_HOST;
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;

    try {
      const res = await verifyRoleToken('Bearer token_legacy_owner', ['owner']);
      assert.equal(res.success, false);
      assert.equal(res.status, 503);
      assert.equal(res.code, 'AUTH_SERVICE_UNAVAILABLE');

      const httpRes = await makeRequest({
        method: 'GET',
        path: '/api/gemini-status',
        headers: { Authorization: 'Bearer token_legacy_owner' }
      });
      assert.equal(httpRes.status, 503);
      assert.equal(httpRes.body.error, 'AUTH_SERVICE_UNAVAILABLE');

      // deleteManagedUser fail-closed check
      const deleteRes = await deleteManagedUser({ uid: 'user_owner_eloni', role: 'owner' }, 'some_user');
      assert.equal(deleteRes.allowed, false);
      assert.equal(deleteRes.status, 503);
      assert.equal(deleteRes.reason, 'AUTH_SERVICE_UNAVAILABLE');

      // changeManagedUserPassword fail-closed check
      const pwRes = await changeManagedUserPassword({ uid: 'user_owner_eloni', role: 'owner' }, 'some_user', 'newpass123');
      assert.equal(pwRes.allowed, false);
      assert.equal(pwRes.status, 503);
      assert.equal(pwRes.reason, 'AUTH_SERVICE_UNAVAILABLE');

      // saveStoredGeminiApiKey fail-closed check
      await assert.rejects(
        async () => { await saveStoredGeminiApiKey('key123', 'owner'); },
        { message: 'AUTH_SERVICE_UNAVAILABLE' }
      );

      // saveStoredDiscordWebhookUrls fail-closed check
      await assert.rejects(
        async () => { await saveStoredDiscordWebhookUrls('https://discord.com/api/webhooks/1/2', '', 'owner'); },
        { message: 'AUTH_SERVICE_UNAVAILABLE' }
      );
    } finally {
      if (savedSa) process.env.FIREBASE_SERVICE_ACCOUNT_JSON = savedSa;
      if (savedEmu) process.env.FIREBASE_AUTH_EMULATOR_HOST = savedEmu;
    }
  });

  // -------------------------------------------------------------
  // Test Case 12: Resolver edge case: odd length hex email
  // -------------------------------------------------------------
  test('Case 12: Email local-part with odd length (invalid hex) is rejected', async () => {
    const res = await verifyRoleToken('Bearer token_odd_hex_email', ['owner', 'admin', 'member']);
    assert.equal(res.success, false);
    assert.equal(res.status, 403);
    assert.equal(res.code, 'INVALID_AUTH_IDENTITY');
  });

  // -------------------------------------------------------------
  // Test Case 13: Resolver edge case: valid token whose decoded username does not match any profile
  // -------------------------------------------------------------
  test('Case 13: Decoded username with no matching Firestore profile is rejected with 403', async () => {
    const res = await verifyRoleToken('Bearer token_unmatched_user', ['owner', 'admin', 'member']);
    assert.equal(res.success, false);
    assert.equal(res.status, 403);
    assert.equal(res.code, 'USER_PROFILE_NOT_FOUND');
  });

  // -------------------------------------------------------------
  // Extra Case 14: Suspended user token is rejected with 403
  // -------------------------------------------------------------
  test('Extra: Suspended user token is rejected with 403 USER_ACCOUNT_INACTIVE', async () => {
    const res = await verifyRoleToken('Bearer token_suspended_user', ['member']);
    assert.equal(res.success, false);
    assert.equal(res.status, 403);
    assert.equal(res.code, 'USER_ACCOUNT_INACTIVE');
  });
});
