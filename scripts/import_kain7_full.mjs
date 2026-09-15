import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, writeBatch } from 'firebase/firestore';
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

// Helper to remove undefined fields recursively
function cleanDoc(obj) {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cleanDoc);
  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = cleanDoc(value);
    }
  }
  return clean;
}

// 4 Official Clans
const OFFICIAL_CLANS = [
  { id: 'clan_voltz', name: 'VoltZ', color: '#22c55e' },
  { id: 'clan_levels', name: 'LevelS', color: '#ef4444' },
  { id: 'clan_stronk', name: 'STRONK', color: '#eab308' },
  { id: 'clan_noclan', name: 'no-clan', color: '#3b82f6' }
];

async function runImport() {
  console.log('=== Step 1: Syncing 4 Official Clans to Firestore ===');
  for (const c of OFFICIAL_CLANS) {
    await setDoc(doc(db, 'clans', c.id), c, { merge: true });
    console.log(`Synced clan: ${c.name} (${c.color})`);
  }

  console.log('\n=== Step 2: Fetching Existing Users from Firestore ===');
  const existingUsersSnap = await getDocs(collection(db, 'users'));
  const existingUsersMap = new Map();
  existingUsersSnap.forEach((d) => {
    const data = d.data();
    existingUsersMap.set(d.id, { docId: d.id, ...data });
    if (data.inGameName) existingUsersMap.set(data.inGameName.toLowerCase(), { docId: d.id, ...data });
    if (data.username) existingUsersMap.set(data.username.toLowerCase(), { docId: d.id, ...data });
  });
  console.log(`Found ${existingUsersSnap.size} existing users in Firestore.`);

  console.log('\n=== Step 3: Loading 139 Scraped Kain7 Members ===');
  const jsonPath = 'C:/Users/tinna/.gemini/antigravity-ide/brain/3fadf3b5-1a4e-4f65-9dc3-26a78a475b17/scratch/kain7_full_synced_members.json';
  const scrapedMembers = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`Loaded ${scrapedMembers.length} members from file.`);

  console.log('\n=== Step 4: Batch Writing Members to Firestore ===');
  const BATCH_SIZE = 400; // Firestore limit is 500
  let batch = writeBatch(db);
  let batchCount = 0;
  let importedCount = 0;
  let updatedCount = 0;

  for (const m of scrapedMembers) {
    const ignLower = m.inGameName.toLowerCase();
    const existing = existingUsersMap.get(ignLower) || existingUsersMap.get(m.username.toLowerCase());

    // Determine target docId: if existing user, use their docId; otherwise create unique id
    const docId = existing ? existing.docId : `user_k7_${m.kain7Id}`;

    // Preserve roles only. Authentication credentials must never be created,
    // copied, or stored by a public profile import script.
    const isOwner = existing?.role === 'owner';
    const role = isOwner ? 'owner' : (existing?.role === 'admin' ? 'admin' : (m.role || 'member'));

    const userPayload = cleanDoc({
      id: docId,
      kain7Id: m.kain7Id,
      username: existing?.username || m.username || ignLower.replace(/[^a-z0-9_]/g, '') || `k7_${m.kain7Id}`,
      inGameName: m.inGameName,
      clan: m.clan,
      classes: m.classes || ['Dual Blades'],
      characterClass: m.characterClass || (m.classes && m.classes[0]) || 'Dual Blades',
      level: m.level || 75,
      powerLevel: m.powerLevel || 0,
      role,
      status: m.status || 'active',
      stats: m.stats || {},
      spirits: m.spirits || {},
      spiritEnhancements: m.spiritEnhancements || {},
      screenshots: m.screenshots || [],
      screenshotUrl: m.screenshotUrl || '',
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now()
    });

    const userRef = doc(db, 'users', docId);
    batch.set(userRef, userPayload, { merge: true });
    batchCount++;

    if (existing) {
      updatedCount++;
    } else {
      importedCount++;
    }

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      console.log(`Committed batch of ${batchCount} users...`);
      batch = writeBatch(db);
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.log(`Committed final batch of ${batchCount} users.`);
  }

  console.log(`\n🎉 SUCCESS: Import finished!`);
  console.log(`- New members imported: ${importedCount}`);
  console.log(`- Existing members updated with latest stats/power/multi-classes: ${updatedCount}`);
  console.log(`- Total active in DB: ${importedCount + updatedCount}`);
}

runImport().catch(console.error);
