import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
const app = initializeApp({ projectId: 'hybrid-box-753bd' }, `verify-restore-${Date.now()}`);
const db = getFirestore(app);
const user = await db.collection('users').doc('legacy-member-1').get();
const item = await db.collection('items').doc('legacy-item-1').get();
if (user.data()?.password !== 'LegacyOnly123!') throw new Error('Legacy credential field was not restored');
if (item.data()?.claimants?.length !== 1) throw new Error('Legacy claimant array was not restored');
console.log('Encrypted backup restore fixture verified successfully.');
await deleteApp(app);
