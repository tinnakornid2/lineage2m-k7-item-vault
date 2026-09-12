import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';
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

async function restore() {
  const eloniRef = doc(db, 'users', 'user_owner_eloni');
  await updateDoc(eloniRef, {
    role: 'owner',
    status: 'active'
  });
  console.log('Successfully restored Eloni (user_owner_eloni) to role: owner, status: active');

  const snap = await getDoc(eloniRef);
  console.log('Verified Firestore Data:', snap.data().inGameName, 'Role:', snap.data().role, 'Status:', snap.data().status);
}

restore().catch(console.error);
