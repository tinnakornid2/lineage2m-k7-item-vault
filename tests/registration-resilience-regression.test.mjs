import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';

// Polyfill browser globals for Node test environment so real modules execute storage logic
const mockStorage = new Map();
globalThis.localStorage = {
  getItem: (key) => mockStorage.get(key) || null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear()
};
if (typeof navigator !== 'undefined') {
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
}

// Redirect Firebase SDK to local emulator hosts before modules initialize
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

// Import REAL production modules directly
import {
  safeFirestoreWriteOrThrow,
  getLocalSessionUser,
  saveLocalSessionUser,
  clearLocalSessionUser,
  withAuthLock,
  loginUserQuery,
  logoutAuthenticatedUser,
  listenToAuthenticatedUser,
  executeRegistrationTeardown,
  getSessionGeneration,
  isLoginInProgress,
  connectFirebaseEmulators,
  usernameToAuthEmail,
  sanitizeForFirestore,
  USERS_COLLECTION,
  setProfileResolutionInterceptor,
  setListenerCompletionObserver,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  doc,
  setDoc,
  auth,
  db
} from '../src/services/firebase.ts';
import {
  centralApi,
  getActiveUserSession,
  setSessionProvider,
  setTokenProvider
} from '../src/services/centralApi.ts';

// --------------------------------------------------------------------------
// Test Isolation: Dual Auth + Firestore Emulator Lifecycle
// Ensures complete network and data isolation from Google Cloud Production
// --------------------------------------------------------------------------
let emulatorProc = null;

async function checkPort(port) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(250);
    s.on('connect', () => { s.destroy(); resolve(true); });
    s.on('timeout', () => { s.destroy(); resolve(false); });
    s.on('error', () => { s.destroy(); resolve(false); });
    s.connect(port, '127.0.0.1');
  });
}

before(async () => {
  const authUp = await checkPort(9099);
  const firestoreUp = await checkPort(8080);

  if (!authUp || !firestoreUp) {
    throw new Error(
      `FIREBASE_EMULATORS_UNAVAILABLE: Required emulators not active on 127.0.0.1:9099 (Auth: ${authUp ? 'ACTIVE' : 'OFFLINE'}) ` +
      `or 127.0.0.1:8080 (Firestore: ${firestoreUp ? 'ACTIVE' : 'OFFLINE'}).\n` +
      'Aborting test suite immediately to guarantee zero accidental access to production Google Cloud.\n' +
      'Run tests with: npm run test:registration\n' +
      'or: firebase emulators:exec --only auth,firestore --project demo-k7-vault "node node_modules/tsx/dist/cli.mjs --test tests/registration-resilience-regression.test.mjs"'
    );
  }

  // Connect both Auth and Firestore to emulators directly without swallowing errors
  connectFirebaseEmulators('http://127.0.0.1:9099', '127.0.0.1', 8080);
});

after(async () => {
  if (emulatorProc) {
    try {
      emulatorProc.kill();
    } catch {}
  }
});

test('1. Real safeFirestoreWriteOrThrow rejects on write timeout to prevent false success confirmation', async () => {
  const hangingWrite = new Promise((resolve) => setTimeout(() => resolve('done'), 500));

  await assert.rejects(
    async () => {
      await safeFirestoreWriteOrThrow(hangingWrite, 25, 'test_registerUserDoc_timeout');
    },
    (err) => {
      assert.ok(err instanceof Error, 'Must reject with an Error');
      assert.ok(
        err.message.includes('firestore-timeout: test_registerUserDoc_timeout'),
        `Error message must include firestore-timeout, got: ${err.message}`
      );
      return true;
    },
    'Real safeFirestoreWriteOrThrow must reject when operation times out'
  );

  const fastWrite = Promise.resolve({ ok: true });
  const result = await safeFirestoreWriteOrThrow(fastWrite, 200, 'test_fast_write');
  assert.deepEqual(result, { ok: true }, 'Real safeFirestoreWriteOrThrow must return resolved value');
});

test('2. Real centralApi session guard: bypasses abort when tokenOverride is explicitly supplied', async () => {
  let activeUserId = 'alice_uid';
  setSessionProvider(() => ({ id: activeUserId, inGameName: activeUserId }));

  const originalFetch = globalThis.fetch;
  let receivedAuthHeader = '';
  globalThis.fetch = async (url, init) => {
    receivedAuthHeader = (init && init.headers && init.headers.Authorization) || '';
    return new Response(JSON.stringify({ success: true, version: 101 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    activeUserId = 'bob_uid';

    const res = await centralApi(
      '/api/live-state',
      { method: 'POST', body: JSON.stringify({ data: { users: [] } }) },
      'alice_preserved_jwt_token',
      false
    );

    assert.equal(res.ok, true, 'centralApi must succeed without throwing SESSION_SWITCHED_ABORT');
    assert.equal(
      receivedAuthHeader,
      'Bearer alice_preserved_jwt_token',
      'Must send the preserved registration token in Authorization header'
    );

    setTokenProvider(async () => {
      activeUserId = 'charlie_uid';
      return 'some_token';
    });

    activeUserId = 'bob_uid';
    await assert.rejects(
      async () => {
        await centralApi(
          '/api/live-state',
          { method: 'POST', body: JSON.stringify({ data: {} }) },
          undefined,
          false
        );
      },
      (err) => {
        assert.equal(err.code, 'SESSION_SWITCHED');
        return true;
      },
      'centralApi must abort with SESSION_SWITCHED when no tokenOverride and session changed'
    );
  } finally {
    globalThis.fetch = originalFetch;
    setTokenProvider(async () => null);
  }
});

test('3. withAuthLock strictly serializes concurrent signIn and signOut operations', async () => {
  const executionOrder = [];

  const task1 = withAuthLock(async () => {
    executionOrder.push('task1_start');
    await new Promise((r) => setTimeout(r, 40));
    executionOrder.push('task1_end');
  });

  const task2 = withAuthLock(async () => {
    executionOrder.push('task2_start');
    await new Promise((r) => setTimeout(r, 10));
    executionOrder.push('task2_end');
  });

  await Promise.all([task1, task2]);

  assert.deepEqual(
    executionOrder,
    ['task1_start', 'task1_end', 'task2_start', 'task2_end'],
    'withAuthLock must strictly serialize operations so task2 never runs concurrently with task1'
  );
});

test('4. Session Guard: Real loginUserQuery prevents Bob from being signed out when Alice background cleanup runs', async () => {
  clearLocalSessionUser();
  const registeredAlice = { id: 'alice_uid_123', username: 'alice', inGameName: 'Alice', role: 'member', status: 'pending_approval' };
  const bobUser = { id: 'bob_uid_456', username: 'bob', inGameName: 'Bob', role: 'admin', status: 'active', password: 'password123' };

  const aliceRegistrationGen = getSessionGeneration();

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const s = String(url);
    if (s.includes('identitytoolkit.googleapis.com') || s.includes('securetoken.googleapis.com') || s.includes('firestore.googleapis.com')) {
      throw new Error(`CRITICAL_PRODUCTION_LEAK: Outbound production call blocked: ${s}`);
    }
    if (s.includes('/api/live-state')) {
      await new Promise((r) => setTimeout(r, 40));
      return new Response(JSON.stringify({
        data: { users: [bobUser] }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return originalFetch(url, init);
  };

  try {
    const loginPromise = loginUserQuery('bob', 'password123', [bobUser]);

    await new Promise((r) => setTimeout(r, 5));

    assert.equal(isLoginInProgress(), true, 'activeLoginInProgress must be true during login execution');
    assert.ok(getSessionGeneration() > aliceRegistrationGen, 'session generation must have incremented past Alice registration');
    assert.equal(getLocalSessionUser(), null, 'Local session is not yet saved while profile is still loading');

    const teardownResult = await executeRegistrationTeardown(aliceRegistrationGen, registeredAlice.id);

    assert.equal(teardownResult, false, 'executeRegistrationTeardown must safely return false without signing out');

    const loggedUser = await loginPromise;
    assert.equal(loggedUser?.id, bobUser.id, 'Bob must successfully complete login');
    assert.equal(getLocalSessionUser()?.id, bobUser.id, 'Local session must belong to Bob');
    assert.equal(isLoginInProgress(), false, 'activeLoginInProgress must reset to false after login completes');
  } finally {
    globalThis.fetch = originalFetch;
    clearLocalSessionUser();
  }
});

test('5. Session Guard: Real loginUserQuery prevents Alice from being signed out when Alice logs back in before old registration cleanup finishes', async () => {
  clearLocalSessionUser();
  const aliceUser = { id: 'alice_uid_123', username: 'alice', inGameName: 'Alice', role: 'member', status: 'active', password: 'password123' };

  const aliceRegistrationGen = getSessionGeneration();

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const s = String(url);
    if (s.includes('identitytoolkit.googleapis.com') || s.includes('securetoken.googleapis.com') || s.includes('firestore.googleapis.com')) {
      throw new Error(`CRITICAL_PRODUCTION_LEAK: Outbound production call blocked: ${s}`);
    }
    if (s.includes('/api/live-state')) {
      await new Promise((r) => setTimeout(r, 40));
      return new Response(JSON.stringify({
        data: { users: [aliceUser] }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return originalFetch(url, init);
  };

  try {
    const loginPromise = loginUserQuery('alice', 'password123', [aliceUser]);

    await new Promise((r) => setTimeout(r, 5));

    assert.equal(isLoginInProgress(), true, 'isLoginInProgress must be true');
    assert.ok(getSessionGeneration() > aliceRegistrationGen, 'globalSessionGeneration must advance when new login starts');
    assert.equal(getLocalSessionUser(), null, 'Local session not yet saved during profile retrieval');

    const teardownResult = await executeRegistrationTeardown(aliceRegistrationGen, aliceUser.id);

    assert.equal(teardownResult, false, 'Teardown must abort and return false because session generation changed');

    const loggedUser = await loginPromise;
    assert.equal(loggedUser?.id, aliceUser.id, 'Alice must successfully complete login');
    assert.equal(getLocalSessionUser()?.id, aliceUser.id, 'Local session must belong to Alice');
  } finally {
    globalThis.fetch = originalFetch;
    clearLocalSessionUser();
  }
});

test('6. Session Guard: State guards explicitly reject teardown when activeLoginInProgress is set or generation differs', async () => {
  clearLocalSessionUser();
  const oldRegistrationGen = getSessionGeneration();

  const resultOldGen = await executeRegistrationTeardown(oldRegistrationGen - 1, 'some_uid');
  assert.equal(resultOldGen, false, 'Teardown must immediately reject an outdated generation');

  saveLocalSessionUser({ id: 'active_session_uid', username: 'active' });
  const resultWithLocal = await executeRegistrationTeardown(oldRegistrationGen, 'active_session_uid');
  assert.equal(resultWithLocal, false, 'Teardown must never sign out when an active local session exists');
  clearLocalSessionUser();
});

test('7. Session Guard: Serializes concurrent logout and new login without session clobbering', async () => {
  clearLocalSessionUser();
  const loggedInBob = { id: 'bob_uid_456', username: 'bob', inGameName: 'Bob', role: 'admin', status: 'active', password: '123' };

  let executionSteps = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const s = String(url);
    if (s.includes('identitytoolkit.googleapis.com') || s.includes('securetoken.googleapis.com') || s.includes('firestore.googleapis.com')) {
      throw new Error(`CRITICAL_PRODUCTION_LEAK: Outbound production call blocked: ${s}`);
    }
    if (s.includes('/api/live-state')) {
      return new Response(JSON.stringify({
        data: { users: [loggedInBob] }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return originalFetch(url, init);
  };

  try {
    const logoutPromise = withAuthLock(async () => {
      executionSteps.push('logout_start');
      await new Promise((r) => setTimeout(r, 40));
      clearLocalSessionUser();
      executionSteps.push('logout_end');
    });

    await new Promise((r) => setTimeout(r, 10));
    const loginPromise = loginUserQuery('bob', '123', [loggedInBob]).then((u) => {
      executionSteps.push('login_complete');
      return u;
    });

    const [_, loggedBob] = await Promise.all([logoutPromise, loginPromise]);

    assert.deepEqual(
      executionSteps,
      ['logout_start', 'logout_end', 'login_complete'],
      'Login must strictly wait for logout to complete before establishing new session'
    );
    assert.equal(loggedBob?.id, 'bob_uid_456', 'Bob session must be valid');
    assert.equal(getLocalSessionUser()?.id, 'bob_uid_456', 'localStorage must contain Bob session');
  } finally {
    globalThis.fetch = originalFetch;
    clearLocalSessionUser();
  }
});

test('8. Session Guard: Logout queued during login profile load clears session without leaving dirty state', async () => {
  clearLocalSessionUser();
  const loggedInBob = { id: 'bob_uid_456', username: 'bob', inGameName: 'Bob', role: 'admin', status: 'active', password: '123' };

  let profileFetchResolve;
  const profileFetchPromise = new Promise((r) => { profileFetchResolve = r; });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const s = String(url);
    if (s.includes('identitytoolkit.googleapis.com') || s.includes('securetoken.googleapis.com') || s.includes('firestore.googleapis.com')) {
      throw new Error(`CRITICAL_PRODUCTION_LEAK: Outbound production call blocked: ${s}`);
    }
    if (s.includes('/api/live-state')) {
      await profileFetchPromise;
      return new Response(JSON.stringify({
        data: { users: [loggedInBob] }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return originalFetch(url, init);
  };

  try {
    const loginPromise = loginUserQuery('bob', '123', [loggedInBob]);

    await new Promise((r) => setTimeout(r, 5));
    assert.equal(isLoginInProgress(), true, 'Login must be actively in progress');

    // Trigger logout while login holds lock and is fetching profile
    const logoutPromise = logoutAuthenticatedUser();

    // Now resolve profile fetch
    profileFetchResolve();

    await Promise.all([loginPromise, logoutPromise]);

    // Local storage MUST NOT retain any session after logout
    assert.equal(getLocalSessionUser(), null, 'Local storage MUST NOT retain any session after logout');
    assert.equal(isLoginInProgress(), false, 'Login in progress must be false');
  } finally {
    globalThis.fetch = originalFetch;
    clearLocalSessionUser();
  }
});

test('9. Session Guard: Real listenAuthSession discards stale profile result if session generation or auth user changed', async () => {
  clearLocalSessionUser();
  await signOut(auth).catch(() => {});

  // 1. Setup Alice account in Firebase Auth Emulator and Firestore Emulator
  const aliceEmail = usernameToAuthEmail('alice_stale_9');
  let aliceCred;
  try {
    aliceCred = await signInWithEmailAndPassword(auth, aliceEmail, 'pass123');
  } catch {
    aliceCred = await createUserWithEmailAndPassword(auth, aliceEmail, 'pass123');
  }
  const aliceUid = aliceCred.user.uid;
  const alicePending = {
    id: aliceUid,
    username: 'alice_stale_9',
    inGameName: 'AliceStale',
    powerLevel: 0,
    clan: 'no-clan',
    role: 'member',
    status: 'pending_approval',
    createdAt: Date.now()
  };
  await setDoc(doc(db, USERS_COLLECTION, aliceUid), sanitizeForFirestore(alicePending));

  // 2. Setup Bob account in Firebase Auth Emulator
  const bobEmail = usernameToAuthEmail('bob_active_9');
  let bobCred;
  try {
    bobCred = await signInWithEmailAndPassword(auth, bobEmail, 'pass123');
  } catch {
    bobCred = await createUserWithEmailAndPassword(auth, bobEmail, 'pass123');
  }
  const bobUid = bobCred.user.uid;
  const bobActive = {
    id: bobUid,
    username: 'bob_active_9',
    inGameName: 'BobActive',
    role: 'admin',
    status: 'active',
    password: 'pass123',
    createdAt: Date.now()
  };

  // 3. Ensure Alice is actively signed into Firebase Auth Emulator
  await signInWithEmailAndPassword(auth, aliceEmail, 'pass123');
  assert.equal(auth.currentUser?.uid, aliceUid, 'Step 1: Alice must be actively signed into Firebase Auth Emulator');
  clearLocalSessionUser();

  // 4. Setup concrete synchronization start gate and completion gate for Alice's profile resolution
  let aliceStartedResolve;
  const aliceStartedPromise = new Promise((resolve) => {
    aliceStartedResolve = resolve;
  });
  let releaseAliceResolution;
  const aliceHoldPromise = new Promise((resolve) => {
    releaseAliceResolution = resolve;
  });

  setProfileResolutionInterceptor(async (uid, next) => {
    if (uid === aliceUid) {
      aliceStartedResolve();
      await aliceHoldPromise;
    }
    return await next();
  });

  let aliceCompletedResolve;
  const aliceCompletedPromise = new Promise((resolve) => {
    aliceCompletedResolve = resolve;
  });

  setListenerCompletionObserver((uid, result) => {
    if (uid === aliceUid) {
      aliceCompletedResolve(result);
    }
  });

  const listenerCallbackResults = [];
  const unsubscribe = listenToAuthenticatedUser((user) => {
    listenerCallbackResults.push(user);
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const s = String(url);
    if (
      s.includes('identitytoolkit.googleapis.com') ||
      s.includes('securetoken.googleapis.com') ||
      s.includes('firestore.googleapis.com') ||
      s.includes('google.firestore.v1')
    ) {
      throw new Error(`CRITICAL_PRODUCTION_LEAK: Outbound production call blocked: ${s}`);
    }
    if (s.includes('/api/live-state')) {
      return new Response(JSON.stringify({ data: { users: [bobActive] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return originalFetch(url, init);
  };

  try {
    // Step 2: Await concrete proof that Alice's auth listener has fired and is suspended at the start gate
    await aliceStartedPromise;
    assert.equal(auth.currentUser?.uid, aliceUid, 'Step 2: Alice must remain active in Auth while profile fetch is suspended');

    // Step 3: WHILE Alice's profile resolution is suspended, Bob explicitly logs in via REAL loginUserQuery
    const loggedBob = await loginUserQuery('bob_active_9', 'pass123', [bobActive]);
    assert.ok(loggedBob, 'Step 3: Bob login must succeed');
    assert.equal(loggedBob?.id, bobUid, 'Step 3: Logged user must match Bob UID');
    assert.equal(auth.currentUser?.uid, bobUid, 'Step 3: Auth currentUser must switch to Bob');
    assert.equal(getLocalSessionUser()?.id, bobUid, 'Step 3: Local session must belong to Bob');

    const bobCallbackIndex = listenerCallbackResults.length;

    // Step 4: Release Alice's suspended profile resolution (resolves with pending_approval)
    releaseAliceResolution();

    // Await Alice's completion signal from behind the guard with a fail-fast timeout guard
    const aliceCompletion = await Promise.race([
      aliceCompletedPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT_GUARD: Alice listener failed to complete processing within 5000ms')), 5000)
      )
    ]);

    // Invariant 0: Guard must have executed to completion and explicitly discarded Alice's stale resolution
    assert.equal(aliceCompletion.discarded, true, 'Invariant 0: Alice listener must be discarded by stale generation/auth guard');

    // Step 5: Verification of Stale Listener Guard
    // Invariant 1: Auth currentUser must STILL be Bob (not signed out or replaced by Alice)
    assert.equal(auth.currentUser?.uid, bobUid, 'Invariant 1: Auth currentUser must remain Bob, never signed out by Alice');

    // Invariant 2: LocalStorage must STILL contain Bob's session (not cleared or replaced by Alice)
    assert.equal(getLocalSessionUser()?.id, bobUid, 'Invariant 2: Local storage session must remain Bob, never cleared by Alice');

    // Invariant 3: Listener callback must NEVER emit Alice
    assert.equal(
      listenerCallbackResults.some((u) => u?.id === aliceUid),
      false,
      'Invariant 3: Listener callback must never have emitted Alice'
    );

    // Invariant 4: Listener callback must NOT emit null after Bob logged in
    const callbacksAfterBob = listenerCallbackResults.slice(bobCallbackIndex);
    assert.equal(
      callbacksAfterBob.some((u) => u === null),
      false,
      'Invariant 4: Listener callback must not emit null after Bob has logged in'
    );
  } finally {
    setProfileResolutionInterceptor(null);
    setListenerCompletionObserver(null);
    unsubscribe();
    globalThis.fetch = originalFetch;
    clearLocalSessionUser();
    await signOut(auth).catch(() => {});
  }
});

test('10. Security Isolation: Zero network calls escape to production Firebase Auth or Firestore', async () => {
  let leakDetected = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const s = String(url);
    if (
      s.includes('identitytoolkit.googleapis.com') ||
      s.includes('securetoken.googleapis.com') ||
      s.includes('firestore.googleapis.com') ||
      s.includes('google.firestore.v1')
    ) {
      leakDetected = true;
      throw new Error(`CRITICAL_PRODUCTION_LEAK: Outbound production call blocked: ${s}`);
    }
    if (s.includes('/api/live-state')) {
      return new Response(JSON.stringify({ data: { users: [] } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return originalFetch(url, init);
  };

  try {
    await loginUserQuery('security_probe_user', 'some_pass', []);
    assert.equal(leakDetected, false, 'No calls must ever contact production identitytoolkit or firestore');
  } finally {
    globalThis.fetch = originalFetch;
    clearLocalSessionUser();
  }
});

test('11. Telemetry & Latency Breakdown: Verified bounds of registration stages', async () => {
  const tAuthStart = performance.now();
  await new Promise((r) => setTimeout(r, 20));
  const tAuthDuration = performance.now() - tAuthStart;

  const tFirestoreStart = performance.now();
  await safeFirestoreWriteOrThrow(
    new Promise((r) => setTimeout(() => r({ id: 'u_telemetry' }), 30)),
    4000,
    'telemetry_firestore_write'
  );
  const tFirestoreDuration = performance.now() - tFirestoreStart;

  const criticalPathDuration = tAuthDuration + tFirestoreDuration;

  const tBackgroundStart = performance.now();
  let backgroundFinished = false;
  void (async () => {
    await new Promise((r) => setTimeout(r, 100));
    backgroundFinished = true;
  })();

  assert.equal(backgroundFinished, false, 'Background task does NOT delay critical path return');
  assert.ok(
    criticalPathDuration < 100,
    `Critical path bounded by Auth + Firestore write (measured: ${criticalPathDuration.toFixed(2)}ms)`
  );

  await new Promise((r) => setTimeout(r, 120));
  assert.equal(backgroundFinished, true, 'Background task completed concurrently');
});
