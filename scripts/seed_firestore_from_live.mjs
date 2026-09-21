import fs from 'fs';
import path from 'path';

const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const token = cfg.tokens.access_token;

const BASE_URL = 'https://firestore.googleapis.com/v1/projects/k7-item/databases/ai-studio-lineage2mclanhub-4a1794d8-f944-422f-945e-56c12057ad13/documents';

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function objectToFirestoreDoc(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      fields[k] = toFirestoreValue(v);
    }
  }
  return { fields };
}

async function writeDoc(collectionPath, docId, data) {
  const url = `${BASE_URL}/${collectionPath}/${encodeURIComponent(docId)}`;
  const body = objectToFirestoreDoc(data);
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Write doc failed for ${collectionPath}/${docId}: ${res.status} ${err}`);
  }
  return res.json();
}

async function run() {
  console.log('1. Fetching authoritative Live Relay data from production...');
  const res = await fetch('https://lineage2m-k7-item-vault.vercel.app/api/live-state?v=0');
  const json = await res.json();
  const data = json.data;

  if (!data) {
    throw new Error('No data found in live-state response!');
  }

  console.log('Fetched data summary:');
  console.log('- Users:', data.users?.length || 0);
  console.log('- Vault Items:', data.vaultItems?.length || 0);
  console.log('- Queue Items:', data.queueItems?.length || 0);
  console.log('- Clans:', data.clans?.length || 0);
  console.log('- Diamond Logs:', data.diamondLogs?.length || 0);
  console.log('- Quick Items:', data.quickItems?.length || 0);
  console.log('- General Items:', data.generalItems?.length || 0);

  console.log('\n2. Seeding Users to Firestore via Admin API...');
  for (const u of data.users || []) {
    if (!u.id) continue;
    await writeDoc('users', u.id, u);
  }
  // Ensure Eloni auth UID doc also exists
  const eloni = (data.users || []).find(u => u.id === 'user_owner_eloni' || u.username === 'eloni');
  if (eloni) {
    await writeDoc('users', 'APsCZzEI4tYdx5UfHuY5Sw10L8B3', {
      ...eloni,
      id: 'APsCZzEI4tYdx5UfHuY5Sw10L8B3',
      role: 'owner',
      status: 'active'
    });
  }
  console.log('  Users seeded successfully!');

  console.log('3. Seeding Vault Items...');
  for (const item of data.vaultItems || []) {
    if (!item.id) continue;
    await writeDoc('items', item.id, item);
  }
  console.log('  Vault Items seeded successfully!');

  console.log('4. Seeding Queue Items...');
  for (const q of data.queueItems || []) {
    if (!q.id) continue;
    await writeDoc('item_queues', q.id, q);
  }
  console.log('  Queue Items seeded successfully!');

  console.log('5. Seeding Clans...');
  for (const c of data.clans || []) {
    if (!c.id) continue;
    await writeDoc('clans', c.id, c);
  }
  console.log('  Clans seeded successfully!');

  console.log('6. Seeding Diamond Logs...');
  for (const d of data.diamondLogs || []) {
    if (!d.id) continue;
    await writeDoc('diamond_vault', d.id, d);
  }
  console.log('  Diamond Logs seeded successfully!');

  console.log('7. Seeding Quick Items...');
  for (const qi of data.quickItems || []) {
    if (!qi.id) continue;
    await writeDoc('quick_items', qi.id, qi);
  }
  console.log('  Quick Items seeded successfully!');

  console.log('8. Seeding General Items...');
  for (const gi of data.generalItems || []) {
    if (!gi.id) continue;
    await writeDoc('general_items', gi.id, gi);
  }
  console.log('  General Items seeded successfully!');

  console.log('9. Seeding App Settings...');
  if (data.formulaSettings) {
    await writeDoc('app_settings', 'power_formula', data.formulaSettings);
  }
  if (data.announcementSettings) {
    await writeDoc('app_settings', 'announcement', data.announcementSettings);
  }
  if (data.backgroundSettings) {
    await writeDoc('app_settings', 'background', data.backgroundSettings);
  }
  if (data.discordSettings) {
    await writeDoc('app_settings', 'discord', data.discordSettings);
  }
  if (data.syncMeta) {
    await writeDoc('system_meta', 'sync_meta', data.syncMeta);
  }
  console.log('  Settings seeded successfully!');

  console.log('\n ALL DATA SEEDED TO FIRESTORE 100% SUCCESSFULLY! ');
}

run().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
