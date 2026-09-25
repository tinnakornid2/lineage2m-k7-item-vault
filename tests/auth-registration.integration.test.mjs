import { test } from 'node:test';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';

test('registration accepts only username, password and in-game name', async () => {
  const app = initializeApp({
    apiKey: 'local-test-key',
    projectId: 'k7-item'
  }, `registration-${Date.now()}`);
  const auth = getAuth(app);
  const db = getFirestore(app);
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);

  const username = `integration_${Date.now()}`;
  const credential = await createUserWithEmailAndPassword(
    auth,
    `${Buffer.from(username).toString('hex')}@auth.k7-clan.local`,
    'LocalOnly123!'
  );
  const profile = {
    id: credential.user.uid,
    username,
    inGameName: 'Integration Tester',
    powerLevel: 0,
    clan: 'no-clan',
    characterClass: '',
    role: 'member',
    status: 'pending_approval',
    createdAt: Date.now()
  };

  await setDoc(doc(db, 'users', credential.user.uid), profile);
  const stored = await getDoc(doc(db, 'users', credential.user.uid));
  if (!stored.exists()) throw new Error('Pending profile was not created');
  if (stored.data().powerLevel !== 0) throw new Error('Verified power must remain zero');
  if ('password' in stored.data()) throw new Error('Password must never be stored in Firestore');
  if (stored.data().characterClass !== '') throw new Error('Registration must not assign a class');
  if (stored.data().clan !== 'no-clan') throw new Error('Registration must not assign a clan');

  await signOut(auth);
  await deleteApp(app);
});
