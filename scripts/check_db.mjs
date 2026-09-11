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

async function check() {
  const snap = await getDocs(collection(db, 'users'));
  console.log('Current users in Firestore:', snap.size);
  snap.forEach(d => {
    const data = d.data();
    console.log(`- [${d.id}] ${data.inGameName} (${data.clan}) | Role: ${data.role} | Status: ${data.status}`);
  });

  const clansSnap = await getDocs(collection(db, 'clans'));
  console.log('\nCurrent clans in Firestore:', clansSnap.size);
  clansSnap.forEach(d => {
    const data = d.data();
    console.log(`- [${d.id}] ${data.name} (Color: ${data.color})`);
  });
}

check().catch(console.error);
