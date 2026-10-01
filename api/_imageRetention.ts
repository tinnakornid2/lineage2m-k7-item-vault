import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { decodeSnapshot } from './_relayStore.ts';

export const IMAGE_RETENTION_MS = 60 * 24 * 60 * 60 * 1000;
export const MANAGED_IMAGE_PREFIXES = ['app-images/', 'app-backgrounds/'];
export function managedImage(name: string): boolean {
  return MANAGED_IMAGE_PREFIXES.some(prefix => name.startsWith(prefix)) && !name.includes('..');
}

/** Include history, pending approvals and settings, not only currently visible cards. */
export function collectImageReferences(value: unknown, bucket: string, result = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    for (const match of value.matchAll(/(?:https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[^\s"<>]+|gs:\/\/[^\s"<>]+)/g)) {
      try {
        const url = new URL(match[0]);
        if (url.protocol === 'gs:' && url.hostname === bucket) result.add(decodeURIComponent(url.pathname.slice(1)));
        if (url.hostname === 'firebasestorage.googleapis.com') {
          const parts = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
          if (parts && decodeURIComponent(parts[1]) === bucket) result.add(decodeURIComponent(parts[2]));
        }
      } catch { /* Malformed URLs never qualify an object for deletion by themselves. */ }
    }
  } else if (Array.isArray(value)) {
    for (const entry of value) collectImageReferences(entry, bucket, result);
  } else if (value && typeof value === 'object') {
    for (const entry of Object.values(value)) collectImageReferences(entry, bucket, result);
  }
  return result;
}

export function retentionDecision(referenced: boolean, generation: string, previous: any, now: number) {
  if (referenced) return { orphanSince: null, deleteEligible: false };
  const existing = previous?.generation === generation && Number.isFinite(previous?.orphanSince) &&
    previous.orphanSince > 0 && previous.orphanSince <= now &&
    (!previous.lastUsedAt || previous.lastUsedAt <= previous.orphanSince);
  const orphanSince = existing ? previous.orphanSince : now;
  return { orphanSince, deleteEligible: now - orphanSince >= IMAGE_RETENTION_MS };
}

export function authorizedCron(header: string | undefined, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`), actual = Buffer.from(header);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** No swallowed read failures or cached/partial relay fallback is permitted for deletion. */
export async function readAllImageReferences(db: any, bucket: string, deadline: number): Promise<Set<string>> {
  const refs = new Set<string>();
  let count = 0;
  const assertBudget = () => { if (Date.now() > deadline || count > 10000) throw new Error('REFERENCE_SCAN_INCOMPLETE'); };
  const manifest = await db.collection('system_meta').doc('live_state').get();
  if (!manifest.exists) throw new Error('REFERENCE_MANIFEST_MISSING');
  const state = manifest.data();
  if (state.format === 'gzip-parts-v1') {
    if (!Number.isInteger(state.parts) || state.parts < 1 || state.parts > 64) throw new Error('REFERENCE_MANIFEST_INVALID');
    const chunks = await Promise.all(Array.from({ length: state.parts }, (_, i) => db.collection('system_live_parts').doc(String(i)).get()));
    if (chunks.some((chunk: any) => !chunk.exists)) throw new Error('REFERENCE_SCAN_INCOMPLETE');
    collectImageReferences(decodeSnapshot(chunks.map((chunk: any) => chunk.data().payload)), bucket, refs);
  } else {
    if (!state.data || typeof state.data !== 'object') throw new Error('REFERENCE_MANIFEST_INVALID');
    collectImageReferences(state.data, bucket, refs);
  }
  async function scan(collection: any) {
    assertBudget();
    const rows = await collection.limit(10001).get();
    count += rows.size;
    assertBudget();
    for (const doc of rows.docs) {
      collectImageReferences(doc.data(), bucket, refs);
      const nested = await doc.ref.listCollections();
      for (const child of nested) await scan(child);
      assertBudget();
    }
  }
  for (const collection of await db.listCollections()) {
    // Current relay chunks were decoded above. GC registry does not contain application references.
    if (['system_live_parts', 'image_retention'].includes(collection.id)) continue;
    await scan(collection);
  }
  assertBudget();
  return refs;
}

/** Bounded daily pass. Only application-owned image paths are ever considered. */
export async function runImageRetention(sdk: any, bucketName: string, now = Date.now()) {
  const deadline = Date.now() + 20000;
  const control = sdk.db.collection('system_meta').doc('image_retention_control');
  const lease = randomUUID();
  const acquired = await sdk.db.runTransaction(async (tx: any) => {
    const snap = await tx.get(control), previous = snap.data() || {};
    if (previous.leaseUntil > Date.now()) return null;
    tx.set(control, { lease, leaseUntil: Date.now() + 120000 }, { merge: true });
    return { cursor: previous.cursor || undefined, prefixIndex: Number(previous.prefixIndex || 0) };
  });
  if (!acquired) return { skipped: 'LOCKED' };
  let checked = 0, marked = 0, cleared = 0, deleted = 0;
  try {
    const refs = await readAllImageReferences(sdk.db, bucketName, deadline);
    const bucket = sdk.storage.bucket(bucketName);
    const prefixIndex = acquired.prefixIndex % MANAGED_IMAGE_PREFIXES.length;
    const [files, next] = await bucket.getFiles({ prefix: MANAGED_IMAGE_PREFIXES[prefixIndex], maxResults: 100,
      autoPaginate: false, pageToken: acquired.cursor });
    for (const file of files) {
      if (Date.now() > deadline) throw new Error('RETENTION_PASS_TIMEOUT');
      if (!managedImage(file.name)) continue;
      const [metadata] = await file.getMetadata();
      const generation = String(metadata.generation);
      if (!generation || generation === 'undefined') throw new Error('IMAGE_GENERATION_MISSING');
      const record = sdk.db.collection('image_retention').doc(createHash('sha256').update(`${bucketName}/${file.name}`).digest('hex'));
      const previous = (await record.get()).data();
      const decision = retentionDecision(refs.has(file.name), generation, previous, now);
      checked++;
      if (decision.orphanSince === null) {
        if (previous?.orphanSince != null) {
          await record.set({ generation, orphanSince: null, lastCheckedAt: now }, { merge: true });
          cleared++;
        }
      } else if (decision.deleteEligible) {
        // Re-read authoritative sources immediately before each deletion. Any failure aborts the pass.
        const freshRefs = await readAllImageReferences(sdk.db, bucketName, deadline);
        if (freshRefs.has(file.name)) {
          await record.set({ generation, orphanSince: null, lastCheckedAt: now }, { merge: true });
          cleared++;
          continue;
        }
        if (Date.now() > deadline) throw new Error('RETENTION_PASS_TIMEOUT');
        const reserved = await sdk.db.runTransaction(async (tx: any) => {
          const latest = (await tx.get(record)).data();
          if (!retentionDecision(false, generation, latest, now).deleteEligible || latest?.deletingUntil > Date.now()) return false;
          tx.set(record, { deletingUntil: Date.now() + 120000 }, { merge: true });
          return true;
        });
        if (!reserved) continue;
        if (Date.now() > deadline) throw new Error('RETENTION_PASS_TIMEOUT');
        await file.delete({ ifGenerationMatch: generation });
        await record.set({ generation, orphanSince: decision.orphanSince, deletedAt: now, lastCheckedAt: now, deletingUntil: 0 }, { merge: true });
        deleted++;
      } else {
        await sdk.db.runTransaction(async (tx: any) => {
          const latest = (await tx.get(record)).data();
          const freshDecision = retentionDecision(false, generation, latest, now);
          tx.set(record, { generation, orphanSince: freshDecision.orphanSince, lastCheckedAt: now }, { merge: true });
        });
        marked++;
      }
    }
    await control.set({ cursor: next?.pageToken || null,
      prefixIndex: next?.pageToken ? prefixIndex : (prefixIndex + 1) % MANAGED_IMAGE_PREFIXES.length,
      lastCompletedAt: now, checked, marked, cleared, deleted }, { merge: true });
    return { checked, marked, cleared, deleted, retentionDays: 60 };
  } finally {
    await sdk.db.runTransaction(async (tx: any) => {
      const snap = await tx.get(control);
      if (snap.data()?.lease === lease) tx.set(control, { leaseUntil: 0, lease: null }, { merge: true });
    });
  }
}
