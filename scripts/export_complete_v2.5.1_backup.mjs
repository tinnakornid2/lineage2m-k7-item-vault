import fs from 'node:fs';
import path from 'node:path';

const liveStatePath = path.resolve('data', 'hub-live-state.json');
const backupsDir = path.resolve('backups');

if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

if (!fs.existsSync(liveStatePath)) {
  console.error('Error: data/hub-live-state.json not found');
  process.exit(1);
}

const raw = fs.readFileSync(liveStatePath, 'utf8');
const parsed = JSON.parse(raw);
const stateData = parsed.data || parsed;

const backupPayload = {
  version: 'v2.5.1',
  tag: 'v2.5.1-rule5-discord-hard-guard',
  exportedAt: new Date().toISOString(),
  description: 'Lineage2M Clan Hub Complete System State Backup v2.5.1 (Rule 5 Server-Side Discord Hard Guard, permanent drop of stat notifications from proxy, zero-cache headers for client SPA bundles, 100% item-only Discord notifications)',
  metrics: {
    userCount: stateData.users?.length || 0,
    vaultItemCount: stateData.vaultItems?.length || 0,
    queueItemCount: stateData.queueItems?.length || 0,
    clanCount: stateData.clans?.length || 0,
    diamondLogCount: stateData.diamondLogs?.length || 0,
    vaultBalance: stateData.vaultBalance || 0
  },
  data: stateData
};

const targetFile = path.join(backupsDir, 'complete_snapshot_v2.5.1.json');
const latestFile = path.join(backupsDir, 'complete_snapshot_latest.json');

fs.writeFileSync(targetFile, JSON.stringify(backupPayload, null, 2), 'utf8');
fs.writeFileSync(latestFile, JSON.stringify(backupPayload, null, 2), 'utf8');

console.log(`✅ Backup successfully written to ${targetFile}`);
console.log(`📊 Metrics:`, backupPayload.metrics);
