import fs from 'node:fs';

const snapshotPath = 'd:/Anti webapp/backups/complete_snapshot_v2.6.0.json';
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));

const fileContent = `import { User, ClanGroup, QueueItem, VaultItem, DiamondVaultRecord } from '../types';

export const REAL_BACKUP_MEMBERS: User[] = ${JSON.stringify(snapshot.data.users, null, 2)};

export const REAL_BACKUP_CLANS: ClanGroup[] = ${JSON.stringify(snapshot.data.clans, null, 2)};

export const REAL_BACKUP_QUEUES: QueueItem[] = ${JSON.stringify(snapshot.data.queueItems, null, 2)};

export const REAL_BACKUP_VAULT_ITEMS: VaultItem[] = ${JSON.stringify(snapshot.data.vaultItems, null, 2)};

export const REAL_BACKUP_DIAMOND_TXS: DiamondVaultRecord[] = ${JSON.stringify(snapshot.data.diamondLogs, null, 2)};
`;

fs.writeFileSync('d:/Anti webapp/src/data/offlineMembersData.ts', fileContent, 'utf8');
console.log('✅ Updated src/data/offlineMembersData.ts with v2.6.0 data successfully!');
console.log('   - Members count:', snapshot.data.users.length);
console.log('   - Vault items count:', snapshot.data.vaultItems.length);
console.log('   - Queues count:', snapshot.data.queueItems.length);
