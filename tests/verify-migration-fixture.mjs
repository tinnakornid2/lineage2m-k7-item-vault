import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
const app = initializeApp({ projectId: 'hybrid-box-753bd' }, `verify-${Date.now()}`);
const db = getFirestore(app);

const authUser = await getAuth(app).getUser('legacy-member-1');
if (authUser.uid !== 'legacy-member-1') throw new Error('Legacy UID was not preserved');

const user = await db.collection('users').doc('legacy-member-1').get();
if (!user.exists || 'password' in user.data()) throw new Error('Plaintext password was not removed');

const claim = await db.collection('item_claims').doc('legacy-item-1__legacy-member-1').get();
if (!claim.exists) throw new Error('Legacy claim was not migrated');

const item = await db.collection('items').doc('legacy-item-1').get();
if (item.data().claimants.length !== 0) throw new Error('Legacy claimant array was not cleared');

console.log('Migration fixture verified successfully.');
await deleteApp(app);
