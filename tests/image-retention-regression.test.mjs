import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { authorizedCron, collectImageReferences, retentionDecision, managedImage, IMAGE_RETENTION_MS, readAllImageReferences, runImageRetention } from '../api/_imageRetention.ts';

const bucket = 'clan-hub-7645f.firebasestorage.app';
const url = name => `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(name)}?alt=media&token=x`;
const now = 1800000000000;
test('First unreferenced observation starts 60 days, never the upload age', () => {
  assert.deepEqual(retentionDecision(false, '1', null, now), { orphanSince: now, deleteEligible: false });
});
test('Deletes only at the complete 60-day threshold', () => {
  const previous = { generation: '1', orphanSince: now - IMAGE_RETENTION_MS };
  assert.equal(retentionDecision(false, '1', previous, now - 1).deleteEligible, false);
  assert.equal(retentionDecision(false, '1', previous, now).deleteEligible, true);
});
test('Referenced history cancels the timer even after 60 days', () => {
  assert.deepEqual(retentionDecision(true, '1', { generation: '1', orphanSince: 1 }, now), { orphanSince: null, deleteEligible: false });
});
test('Re-upload and changed generation restart the timer', () => {
  assert.equal(retentionDecision(false, '2', { generation: '1', orphanSince: 1 }, now).orphanSince, now);
  assert.equal(retentionDecision(false, '1', { generation: '1', orphanSince: 1, lastUsedAt: now }, now).orphanSince, now);
});
test('Invalid and future timestamps never allow deletion', () => {
  for (const orphanSince of [NaN, -1, '1', now + 1]) assert.equal(retentionDecision(false, '1', { generation: '1', orphanSince }, now).deleteEligible, false);
});
test('References include archived receipts, pending stats and background but not foreign buckets', () => {
  const refs = collectImageReferences({ receipts: [{ proof: url('app-images/a/receipt') }], pendingStats: { screenshot: url('app-images/b/stat') }, background: `gs://${bucket}/app-backgrounds/a.png`, foreign: url('app-images/c/x').replace(bucket, 'other-bucket') }, bucket);
  assert.deepEqual([...refs].sort(), ['app-backgrounds/a.png', 'app-images/a/receipt', 'app-images/b/stat']);
});
test('Only app-owned folders qualify; cron requires a configured exact secret', () => {
  assert.equal(managedImage('other-data/user.png'), false);
  assert.equal(managedImage('app-images/../secret'), false);
  assert.equal(managedImage('app-images/user/hash'), true);
  assert.equal(authorizedCron(undefined, undefined), false);
  assert.equal(authorizedCron('Bearer wrong', 'secret'), false);
  assert.equal(authorizedCron('Bearer secret', 'secret'), true);
});
test('A missing authoritative manifest aborts, not an empty reference list', async () => {
  const db = { collection: () => ({ doc: () => ({ get: async () => ({ exists: false }) }) }) };
  await assert.rejects(readAllImageReferences(db, bucket, Date.now() + 1000), /REFERENCE_MANIFEST_MISSING/);
});
test('Firestore read failure aborts safely', async () => {
  const db = { collection: () => ({ doc: () => ({ get: async () => { throw new Error('PERMISSION_DENIED'); } }) }) };
  await assert.rejects(readAllImageReferences(db, bucket, Date.now() + 1000), /PERMISSION_DENIED/);
});

function retentionFixture({ orphanSince, referenced = false, failRead = false, resetBeforeDelete = false } = {}) {
  const name = 'app-images/alice/picture';
  const recordId = createHash('sha256').update(`${bucket}/${name}`).digest('hex');
  const records = new Map([['image_retention/' + recordId, { generation: '1', orphanSince }]]);
  let deletes = 0, manifestReads = 0;
  const ref = key => ({ key, get: async () => ({ exists: records.has(key), data: () => records.get(key) }),
    set: async (value, options) => records.set(key, options?.merge ? { ...records.get(key), ...value } : value) });
  const db = {
    collection: collection => ({ doc: id => {
      if (collection === 'system_meta' && id === 'live_state') return { get: async () => {
        manifestReads++;
        if (failRead) throw new Error('READ_FAILED');
        if (resetBeforeDelete && manifestReads === 2) records.set('image_retention/' + recordId, { generation: '1', orphanSince: null, lastUsedAt: now });
        return { exists: true, data: () => ({ data: referenced ? { receipts: [url(name)] } : {} }) };
      } };
      return ref(collection + '/' + id);
    } }),
    listCollections: async () => [],
    runTransaction: async fn => fn({ get: r => r.get(), set: (r, value, options) => r.set(value, options) })
  };
  const file = { name, getMetadata: async () => [{ generation: '1' }], delete: async options => {
    assert.equal(options.ifGenerationMatch, '1'); deletes++;
  } };
  return { sdk: { db, storage: { bucket: () => ({ getFiles: async () => [[file], null] }) } }, records,
    get deletes() { return deletes; }, get record() { return records.get('image_retention/' + recordId); } };
}

test('Real retention runner deletes an eligible orphan with generation guard', async () => {
  const fixture = retentionFixture({ orphanSince: now - IMAGE_RETENTION_MS });
  assert.equal((await runImageRetention(fixture.sdk, bucket, now)).deleted, 1);
  assert.equal(fixture.deletes, 1);
});
test('Real runner keeps a referenced historical image and clears its timer', async () => {
  const fixture = retentionFixture({ orphanSince: 1, referenced: true });
  await runImageRetention(fixture.sdk, bucket, now);
  assert.equal(fixture.deletes, 0);
  assert.equal(fixture.record.orphanSince, null);
});
test('Real runner never deletes on failed cloud reads and releases its lease', async () => {
  const fixture = retentionFixture({ orphanSince: 1, failRead: true });
  await assert.rejects(runImageRetention(fixture.sdk, bucket, now), /READ_FAILED/);
  assert.equal(fixture.deletes, 0);
  assert.equal(fixture.records.get('system_meta/image_retention_control').leaseUntil, 0);
});
test('Real runner observes a concurrent upload reset before deletion reservation', async () => {
  const fixture = retentionFixture({ orphanSince: 1, resetBeforeDelete: true });
  await runImageRetention(fixture.sdk, bucket, now);
  assert.equal(fixture.deletes, 0);
});
