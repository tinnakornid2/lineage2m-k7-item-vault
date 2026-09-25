import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  collection,
  getDocs,
  deleteDoc,
  doc,
  setDoc,
  writeBatch
} from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, '..', 'firebase-applet-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = initializeApp({
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId
});

const auth = getAuth(app);
const db = getFirestore(app, config.firestoreDatabaseId);

const OWNER_EMAIL = '656c6f6e69@auth.k7-clan.local';
const OWNER_PASS = '0386231334';

async function wipeCollection(colName, exceptDocId = null) {
  console.log(`Wiping collection: ${colName}...`);
  try {
    const colRef = collection(db, colName);
    const snap = await getDocs(colRef);
    if (snap.empty) {
      console.log(`- ${colName} is already empty.`);
      return 0;
    }
    let count = 0;
    const batch = writeBatch(db);
    let batchCount = 0;

    for (const docSnap of snap.docs) {
      if (exceptDocId && docSnap.id === exceptDocId) {
        console.log(`- Preserving document: ${exceptDocId}`);
        continue;
      }
      batch.delete(docSnap.ref);
      count++;
      batchCount++;
      if (batchCount >= 400) {
        await batch.commit();
        batchCount = 0;
      }
    }
    if (batchCount > 0) {
      await batch.commit();
    }
    console.log(`✓ Deleted ${count} documents from ${colName}.`);
    return count;
  } catch (err) {
    console.error(`Error wiping collection ${colName}:`, err.message);
    return 0;
  }
}

async function main() {
  console.log('==================================================');
  console.log('⚡ STARTING CLEAN SLATE SYSTEM WIPE');
  console.log('==================================================');

  // 1. Authenticate as Owner
  console.log('Authenticating as Owner...');
  const cred = await signInWithEmailAndPassword(auth, OWNER_EMAIL, OWNER_PASS);
  console.log(`✓ Authenticated as: ${cred.user.email} (UID: ${cred.user.uid})`);

  // 2. Wipe Firestore Collections
  await wipeCollection('items');
  await wipeCollection('item_claims');
  await wipeCollection('item_queues');
  await wipeCollection('general_items');
  await wipeCollection('quick_items');
  await wipeCollection('diamond_vault');
  await wipeCollection('vault');
  await wipeCollection('vault_transactions');

  // 3. Wipe Users except user_owner_eloni and the authenticated owner UID
  console.log('Wiping users except owner account...');
  const usersSnap = await getDocs(collection(db, 'users'));
  let deletedUsers = 0;
  for (const uDoc of usersSnap.docs) {
    const uData = uDoc.data();
    const isOwner =
      uDoc.id === 'user_owner_eloni' ||
      uDoc.id === cred.user.uid ||
      uData.role === 'owner' ||
      uData.username?.toLowerCase() === 'eloni' ||
      uData.inGameName?.toLowerCase() === 'eloni';

    if (!isOwner) {
      await deleteDoc(uDoc.ref).catch(() => {});
      deletedUsers++;
    }
  }
  console.log(`✓ Deleted ${deletedUsers} non-owner users.`);

  // 4. Ensure canonical Owner profile is pristine
  console.log('Writing canonical Owner profile...');
  const now = Date.now();
  const ownerUser = {
    id: cred.user.uid,
    username: 'Eloni',
    inGameName: 'Eloni',
    clan: 'VoltZ',
    characterClass: 'Orb',
    classes: ['Orb', 'Dual Blades', 'Spear', 'Greatsword'],
    powerLevel: 3722,
    level: 79,
    role: 'owner',
    status: 'active',
    verified: true,
    createdAt: 1786449061493,
    updatedAt: now
  };
  await setDoc(doc(db, 'users', cred.user.uid), ownerUser, { merge: true });
  await setDoc(doc(db, 'users', 'user_owner_eloni'), { ...ownerUser, id: 'user_owner_eloni' }, { merge: true });
  console.log('✓ Canonical Owner profile saved.');

  // 5. Reset tombstones document so new items can use any names/IDs without conflict
  console.log('Resetting system tombstones...');
  try {
    await setDoc(doc(db, 'system', 'tombstones'), {
      deletedUsers: {},
      deletedVaultItems: {},
      deletedGeneralItems: {},
      deletedQueueItems: {},
      removedQueueMembers: {},
      cancelledClaims: {},
      updatedAt: now
    });
    console.log('✓ System tombstones reset.');
  } catch (err) {
    console.warn('Notice: System tombstones reset warning:', err.message);
  }

  // 6. Reset Version Hub
  console.log('Resetting system Version Hub...');
  try {
    await setDoc(doc(db, 'system_meta', 'version_hub'), {
      vaultVersion: 1,
      usersVersion: 1,
      queuesVersion: 1,
      quickItemsVersion: 1,
      generalItemsVersion: 1,
      clansVersion: 1,
      diamondsVersion: 1,
      settingsVersion: 1,
      lastUpdatedAt: now,
      lastUpdatedBy: 'Eloni'
    });
    console.log('✓ Version Hub reset.');
  } catch (err) {
    console.warn('Notice: Version Hub reset warning:', err.message);
  }

  // 7. Clear local live-state.json file if present
  console.log('Cleaning local Live State file...');
  const localDataPaths = [
    path.join(__dirname, '..', 'data', 'live-state.json'),
    path.join(__dirname, '..', 'api', 'data', 'live-state.json')
  ];
  for (const p of localDataPaths) {
    if (fs.existsSync(p)) {
      try {
        fs.unlinkSync(p);
        console.log(`✓ Deleted ${p}`);
      } catch {}
    }
  }

  // 8. Broadcast Clean Empty State to Local Server & Production
  const cleanPayload = {
    users: [{ ...ownerUser, id: 'user_owner_eloni' }],
    vaultItems: [],
    quickItems: [],
    generalItems: [],
    queueItems: [],
    clans: [{ id: 'clan_voltz', name: 'VoltZ', color: '#22c55e', order: 0, enabled: true }],
    diamondLogs: [],
    vaultBalance: 0,
    syncMeta: {
      deletedVaultItems: {},
      deletedQueueItems: {},
      deletedGeneralItems: {},
      deletedUsers: {},
      cancelledClaims: {},
      removedQueueMembers: {}
    }
  };

  console.log('Broadcasting clean state to local server (http://localhost:3000)...');
  try {
    const resLocal = await fetch('http://localhost:3000/api/live-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: cleanPayload, performedBy: 'Clean Slate Reset' })
    });
    if (resLocal.ok) {
      console.log('✓ Local live-state broadcast success.');
    }
  } catch (e) {
    console.warn('Local broadcast notice:', e.message);
  }

  console.log('Broadcasting clean state to production (https://lineage2m-k7-item-vault.vercel.app)...');
  try {
    const resProd = await fetch('https://lineage2m-k7-item-vault.vercel.app/api/live-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: cleanPayload, performedBy: 'Clean Slate Reset' })
    });
    if (resProd.ok) {
      console.log('✓ Production live-state broadcast success.');
    }
  } catch (e) {
    console.warn('Production broadcast notice:', e.message);
  }

  console.log('==================================================');
  console.log('🎉 CLEAN SLATE WIPE COMPLETE!');
  console.log('Vault is now 100% empty and ready for fresh data.');
  console.log('==================================================');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error during wipe:', err);
  process.exit(1);
});
