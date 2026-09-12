import fs from 'node:fs';
import path from 'node:path';

const snapPath = './backups/firestore_snapshot_latest.json';
if (!fs.existsSync(snapPath)) {
  console.error('Snapshot not found at', snapPath);
  process.exit(1);
}

const snap = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
const users = snap.collections?.users || [];
const clans = snap.collections?.clans || [];

const outDir = './src/data';
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const outFile = path.join(outDir, 'offlineMembersData.ts');
const fileContent = `import { User, ClanGroup } from '../types';

export const REAL_BACKUP_MEMBERS: User[] = ${JSON.stringify(users, null, 2)};

export const REAL_BACKUP_CLANS: ClanGroup[] = ${JSON.stringify(clans, null, 2)};
`;

fs.writeFileSync(outFile, fileContent, 'utf8');
console.log(`✅ Generated ${outFile} with ${users.length} users and ${clans.length} clans`);
