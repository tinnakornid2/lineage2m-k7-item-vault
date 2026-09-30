import { gzipSync, gunzipSync } from 'node:zlib';
import { mergeRelayData } from './_relayMerge.ts';

export interface RelaySnapshot { data: any; version: number; updatedAt: number }
const COLLECTIONS: Record<string, string> = {
  users: 'users', vaultItems: 'items', queueItems: 'item_queues',
  generalItems: 'general_items', quickItems: 'quick_items', clans: 'clans', diamondLogs: 'diamond_vault'
};
const DELETIONS: Record<string, string> = {
  deletedUsers: 'users', deletedVaultItems: 'items', deletedQueueItems: 'item_queues',
  deletedGeneralItems: 'general_items'
};
const SETTINGS: Record<string, string> = {
  formulaSettings: 'power_formula', announcementSettings: 'announcement',
  backgroundSettings: 'background', discordSettings: 'discord', statUpdateSettings: 'stat_updates'
};

export function publicRelayData(value: any): any {
  if (Array.isArray(value)) return value.map(publicRelayData);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key, val]) => val !== undefined && !['apiKey', 'webhookUrl', 'distributeWebhookUrl'].includes(key))
    .map(([key, val]) => [key, publicRelayData(val)]));
}

export async function withRelayTimeout<T>(operation: Promise<T>, ms = 1500): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('CENTRAL_STORE_TIMEOUT')), ms);
    })]);
  } finally { clearTimeout(timer!); }
}

// Compressed, bounded parts avoid placing an entire image-heavy vault in one Firestore document.
export function encodeSnapshot(data: any): string[] {
  const encoded = gzipSync(Buffer.from(JSON.stringify(publicRelayData(data)))).toString('base64');
  const parts = encoded.match(/.{1,600000}/g) || [];
  if (parts.length > 64) throw new Error('CENTRAL_STATE_TOO_LARGE');
  return parts;
}

export function decodeSnapshot(parts: string[]): any {
  return JSON.parse(gunzipSync(Buffer.from(parts.join(''), 'base64')).toString('utf8'));
}

export class FirestoreRelayStore {
  constructor(private db: any) {}

  private async readTransaction(tx: any): Promise<RelaySnapshot | null> {
    const ref = this.db.collection('system_meta').doc('live_state');
    const snap = await tx.get(ref);
    if (!snap.exists) {
      // Bootstrap from live collections, never from a bundled historical export.
      const data: any = {};
      await Promise.all(Object.entries(COLLECTIONS).map(async ([key, collection]) => {
        const rows = await tx.get(this.db.collection(collection));
        data[key] = rows.docs.map((row: any) => ({ ...row.data(), id: row.id }));
      }));
      await Promise.all(Object.entries(SETTINGS).map(async ([key, id]) => {
        const row = await tx.get(this.db.collection('app_settings').doc(id));
        if (row.exists) data[key] = row.data();
      }));
      return { data: publicRelayData(data), version: 0, updatedAt: 0 };
    }
    const manifest = snap.data();
    if (manifest.format !== 'gzip-parts-v1') {
      return manifest.data ? { ...manifest, data: publicRelayData(manifest.data) } : null;
    }
    if (!Number.isInteger(manifest.parts) || manifest.parts < 1 || manifest.parts > 64) {
      throw new Error('INVALID_CENTRAL_MANIFEST');
    }
    const chunks = await Promise.all(Array.from({ length: manifest.parts }, (_, i) =>
      tx.get(this.db.collection('system_live_parts').doc(String(i)))));
    if (chunks.some(chunk => !chunk.exists)) throw new Error('INCOMPLETE_CENTRAL_STATE');
    return { version: manifest.version, updatedAt: manifest.updatedAt,
      data: decodeSnapshot(chunks.map(chunk => chunk.data().payload)) };
  }

  async read(): Promise<RelaySnapshot | null> {
    return this.db.runTransaction((tx: any) => this.readTransaction(tx), { readOnly: true });
  }

  async commit(incoming: any, mutate?: (current: any) => any): Promise<RelaySnapshot> {
    return this.db.runTransaction(async (tx: any) => {
      const previous = await this.readTransaction(tx);
      const base = previous?.data || {};
      const data = publicRelayData(mutate ? mutate(structuredClone(base)) : mergeRelayData(base, incoming));
      const version = Math.max(Number(previous?.version || 0) + 1, Date.now());
      const updatedAt = Date.now();
      const parts = encodeSnapshot(data);
      const writes: Array<{ collection: string; id: string; data?: any }> = [];
      for (const [key, collection] of Object.entries(COLLECTIONS)) {
        const before = new Map<string, any>((base[key] || []).map((row: any) => [row.id, row]));
        const after = new Map<string, any>((data[key] || []).map((row: any) => [row.id, row]));
        for (const [id, row] of after) {
          if (!id || id.includes('/')) throw new Error('INVALID_RECORD_ID');
          if (JSON.stringify(before.get(id)) !== JSON.stringify(row)) writes.push({ collection, id, data: row });
        }
        for (const [id, row] of before) {
          if (!after.has(id) && !(collection === 'users' && (row.role === 'owner' || id === 'user_owner_eloni'))) {
            writes.push({ collection, id });
          }
        }
      }
      for (const [field, collection] of Object.entries(DELETIONS)) {
        for (const [id, timestamp] of Object.entries(data.syncMeta?.[field] || {})) {
          if (collection === 'users' && (id === 'user_owner_eloni' || (base.users || []).some((u: any) => u.id === id && u.role === 'owner'))) continue;
          if (timestamp !== base.syncMeta?.[field]?.[id] && !writes.some(w => w.collection === collection && w.id === id)) {
            const key = Object.keys(COLLECTIONS).find(k => COLLECTIONS[k] === collection)!;
            if (!(data[key] || []).some((row: any) => row.id === id)) writes.push({ collection, id });
          }
        }
      }
      for (const [key, id] of Object.entries(SETTINGS)) {
        if (data[key] && JSON.stringify(data[key]) !== JSON.stringify(base[key])) {
          writes.push({ collection: 'app_settings', id, data: data[key] });
        }
      }
      if (writes.length + parts.length + 2 > 450) throw new Error('CENTRAL_BATCH_TOO_LARGE');
      for (const write of writes) {
        const ref = this.db.collection(write.collection).doc(write.id);
        if (write.data) tx.set(ref, write.data, { merge: true });
        else tx.delete(ref);
      }
      parts.forEach((payload, i) => tx.set(this.db.collection('system_live_parts').doc(String(i)), { payload }));
      tx.set(this.db.collection('system_meta').doc('live_state'), { format: 'gzip-parts-v1', parts: parts.length, version, updatedAt });
      tx.set(this.db.collection('system_meta').doc('version_hub'), {
        vaultVersion: version, usersVersion: version, queuesVersion: version, generalItemsVersion: version,
        quickItemsVersion: version, clansVersion: version, diamondsVersion: version, settingsVersion: version,
        lastUpdatedAt: updatedAt, lastChangeType: 'liveState'
      }, { merge: true });
      return { data, version, updatedAt };
    });
  }
}
