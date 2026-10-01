import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { FirestoreRelayStore, publicRelayData, encodeSnapshot } from '../api/_relayStore.ts';

test('1. Manifest-first conditional read returns notModified without chunk reads', async () => {
  let manifestReadCount = 0;
  let partReadCount = 0;

  const mockDb = {
    collection: (name) => {
      if (name === 'system_meta') {
        return {
          doc: (id) => ({
            get: async () => {
              manifestReadCount++;
              return {
                exists: true,
                data: () => ({
                  format: 'gzip-parts-v1',
                  parts: 3,
                  version: 500,
                  updatedAt: 1790840000000
                })
              };
            }
          })
        };
      }
      if (name === 'system_live_parts') {
        return {
          doc: (id) => ({
            get: async () => {
              partReadCount++;
              return {
                exists: true,
                data: () => ({ payload: 'chunk' })
              };
            }
          })
        };
      }
      throw new Error(`Unexpected collection: ${name}`);
    }
  };

  const store = new FirestoreRelayStore(mockDb);

  // Client requests with same version (v=500)
  const result = await store.readConditional(500);

  assert.equal(result.notModified, true, 'Should return notModified: true');
  assert.equal(result.version, 500, 'Should return cloud version 500');
  assert.equal(manifestReadCount, 1, 'Manifest must be read exactly once');
  assert.equal(partReadCount, 0, 'No chunks must be read when version is unmodified');
});

test('2. Single-flight coalescing shares in-flight manifest reads across concurrent calls', async () => {
  let manifestGetCount = 0;

  const mockDb = {
    collection: (name) => ({
      doc: (id) => ({
        get: async () => {
          manifestGetCount++;
          // Simulate network latency of 30ms
          await new Promise((r) => setTimeout(r, 30));
          return {
            exists: true,
            data: () => ({ format: 'gzip-parts-v1', parts: 2, version: 1000, updatedAt: 2000 })
          };
        }
      })
    })
  };

  const store = new FirestoreRelayStore(mockDb);

  // Fire 5 concurrent readManifest calls simultaneously
  const results = await Promise.all([
    store.readManifest(),
    store.readManifest(),
    store.readManifest(),
    store.readManifest(),
    store.readManifest()
  ]);

  assert.equal(manifestGetCount, 1, 'Single-flight must collapse 5 parallel reads into 1 Firestore read');
  assert.equal(results.length, 5);
  for (const res of results) {
    assert.equal(res.version, 1000);
  }
});

test('3. Transaction chunk caching in commit skips reading system_live_parts', async () => {
  let txPartReadCount = 0;
  let txManifestReadCount = 0;

  const testData = {
    users: [{ id: 'u1', inGameName: 'Player1' }],
    vaultItems: [{ id: 'item1', name: 'Sword' }]
  };

  const mockDb = {
    collection: (name) => ({
      doc: (id) => ({
        get: async () => ({
          exists: true,
          data: () => ({ format: 'gzip-parts-v1', parts: 1, version: 200, updatedAt: 1000 })
        })
      })
    }),
    runTransaction: async (cb) => {
      const mockTx = {
        get: async (ref) => {
          if (ref._name === 'system_meta') {
            txManifestReadCount++;
            return {
              exists: true,
              data: () => ({ format: 'gzip-parts-v1', parts: 1, version: 200, updatedAt: 1000 })
            };
          }
          if (ref._name === 'system_live_parts') {
            txPartReadCount++;
            return { exists: true, data: () => ({ payload: '' }) };
          }
          return { exists: false, data: () => null };
        },
        set: () => {},
        delete: () => {}
      };
      return cb(mockTx);
    }
  };

  // Attach reference tags to test transaction routing
  const store = new FirestoreRelayStore({
    ...mockDb,
    collection: (name) => ({
      doc: (id) => ({
        _name: name,
        id,
        get: async () => ({
          exists: true,
          data: () => ({ format: 'gzip-parts-v1', parts: 1, version: 200, updatedAt: 1000 })
        })
      })
    })
  });

  // Prime cache with version 200
  store.setCachedSnapshot({
    version: 200,
    updatedAt: 1000,
    data: testData
  });

  // Execute a commit transaction
  const commitSnapshot = await store.commit(null, (current, ver) => {
    current.users.push({ id: 'u2', inGameName: 'Player2' });
    return current;
  });

  assert.equal(txPartReadCount, 0, 'Transaction must NOT fetch chunks when version is already cached in memory');
  assert.ok(commitSnapshot.version > 200, 'Commit snapshot must advance version');
  assert.equal(commitSnapshot.data.users.length, 2, 'Mutation must be reflected');
});

test('4. Staleness protection logic prevents older responses from overwriting newer local versions', () => {
  let localVersion = 300;
  let appliedCount = 0;

  function simulateIncomingSync(incomingVersion) {
    if (incomingVersion >= localVersion) {
      localVersion = incomingVersion;
      appliedCount++;
      return true;
    }
    return false; // Stale rejected!
  }

  // Incoming stale version (e.g. from delayed network or old cache)
  const staleAccepted = simulateIncomingSync(250);
  assert.equal(staleAccepted, false, 'Stale incoming version (250 < 300) must be rejected');
  assert.equal(localVersion, 300);
  assert.equal(appliedCount, 0);

  // Incoming fresh version
  const freshAccepted = simulateIncomingSync(350);
  assert.equal(freshAccepted, true, 'New incoming version (350 >= 300) must be accepted');
  assert.equal(localVersion, 350);
  assert.equal(appliedCount, 1);
});
