import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'node:fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

const app = initializeApp({
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId,
});

const db = config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, config.firestoreDatabaseId)
  : getFirestore(app);

const COLLECTIONS = [
  'users',
  'clans',
  'vault_items',
  'item_queues',
  'app_settings',
  'character_classes',
  'clan_fund_transactions'
];

async function exportFullBackup() {
  const backupData = {
    version: 'v1.9.0',
    createdAt: new Date().toISOString(),
    collections: {}
  };

  for (const colName of COLLECTIONS) {
    try {
      const snap = await getDocs(collection(db, colName));
      backupData.collections[colName] = [];
      snap.forEach((doc) => {
        backupData.collections[colName].push({
          id: doc.id,
          ...doc.data()
        });
      });
      console.log(`Exported ${colName}: ${snap.size} records`);
    } catch (err) {
      console.warn(`Could not export collection ${colName}:`, err.message);
    }
  }

  const outPath = './backups/firestore_snapshot_v1.9.0.json';
  fs.writeFileSync(outPath, JSON.stringify(backupData, null, 2), 'utf8');
  fs.writeFileSync('./backups/firestore_snapshot_latest.json', JSON.stringify(backupData, null, 2), 'utf8');
  console.log(`Full Firestore snapshot successfully saved to ${outPath}`);
}

exportFullBackup().catch(console.error);
