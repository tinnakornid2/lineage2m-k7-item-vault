import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
const app = initializeApp({ projectId: 'k7-item' }, `seed-${Date.now()}`);
const db = getFirestore(app);

await db.collection('users').doc('legacy-member-1').set({
  id: 'legacy-member-1',
  username: 'legacy_member',
  password: 'LegacyOnly123!',
  inGameName: 'Legacy Member',
  powerLevel: 456789,
  clan: 'VoltZ',
  role: 'member',
  status: 'active',
  createdAt: Date.now()
});
await db.collection('items').doc('legacy-item-1').set({
  id: 'legacy-item-1',
  name: 'Legacy Sword',
  status: 'available',
  claimants: [{
    userId: 'legacy-member-1',
    inGameName: 'Legacy Member',
    clan: 'VoltZ',
    powerLevel: 456789,
    claimedAt: Date.now()
  }]
});

await deleteApp(app);
