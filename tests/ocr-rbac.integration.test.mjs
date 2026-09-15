import { deleteApp as deleteAdminApp, getApps as getAdminApps, initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';

process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.NODE_ENV = 'test';

const projectId = 'hybrid-box-753bd';
const adminApp = initializeAdminApp({ projectId }, `rbac-admin-${Date.now()}`);
const db = getAdminFirestore(adminApp);

async function createActor(uid, role) {
  const app = initializeApp({ apiKey: 'local-test-key', projectId }, `rbac-${uid}-${Date.now()}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const credential = await createUserWithEmailAndPassword(auth, `${uid}@example.test`, 'LocalOnly123!');
  await db.collection('users').doc(credential.user.uid).set({
    id: credential.user.uid,
    username: uid,
    inGameName: uid,
    role,
    status: 'active'
  });
  return { app, uid: credential.user.uid, token: await credential.user.getIdToken() };
}

const member = await createActor(`member-${Date.now()}`, 'member');
const partyLeader = await createActor(`party-leader-${Date.now()}`, 'party_leader');
const admin = await createActor(`admin-${Date.now()}`, 'admin');
const owner = await createActor(`owner-${Date.now()}`, 'owner');
const { createApp } = await import('../server.ts');
delete process.env.GEMINI_API_KEY;
await db.collection('app_settings').doc('gemini_ai').set({ apiKey: 'local-persisted-test-key' });
const expressApp = await createApp({ serveFrontend: false });
const server = expressApp.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const anonymous = await fetch(`${baseUrl}/api/gemini-status`);
  if (anonymous.status !== 403) throw new Error(`Anonymous status was ${anonymous.status}, expected 403`);

  const memberResponse = await fetch(`${baseUrl}/api/gemini-status`, {
    headers: { Authorization: `Bearer ${member.token}` }
  });
  if (memberResponse.status !== 403) throw new Error(`Member status was ${memberResponse.status}, expected 403`);

  const partyLeaderDiscord = await fetch(`${baseUrl}/api/discord-webhook`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${partyLeader.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ payload: { embeds: [{}] } })
  });
  if (partyLeaderDiscord.status === 403) throw new Error('Party leader was incorrectly denied Discord notifications');

  const adminResponse = await fetch(`${baseUrl}/api/gemini-status`, {
    headers: { Authorization: `Bearer ${admin.token}` }
  });
  if (adminResponse.status !== 200) throw new Error(`Admin status was ${adminResponse.status}, expected 200`);
  const adminStatus = await adminResponse.json();
  if (!adminStatus.configured || adminStatus.maskedKey !== 'local-...-key') {
    throw new Error('Persisted backend Gemini key was not loaded after restart');
  }
  await db.collection('app_settings').doc('gemini_ai').delete();

  let rateLimitedResponse;
  for (let attempt = 0; attempt < 11; attempt += 1) {
    rateLimitedResponse = await fetch(`${baseUrl}/api/scan-hunters`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${admin.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ imageBase64: 'data:image/png;base64,AA==', lang: 'en' })
    });
  }
  if (rateLimitedResponse?.status !== 429) throw new Error('OCR rate limit did not block request 11');

  const adminOcr = await fetch(`${baseUrl}/api/scan-hunters`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${admin.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ imagesBase64: [] })
  });
  if (adminOcr.status === 403) throw new Error('Admin was incorrectly denied OCR access');
  const ownerOcr = await fetch(`${baseUrl}/api/scan-hunters`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${owner.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ imagesBase64: [] })
  });
  if (ownerOcr.status === 403) throw new Error('Owner was incorrectly denied OCR access');

  const memberDeleteAdmin = await fetch(`${baseUrl}/api/users/${admin.uid}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${member.token}` }
  });
  if (memberDeleteAdmin.status !== 403) {
    throw new Error(`Member delete admin status was ${memberDeleteAdmin.status}`);
  }

  const memberUid = member.uid;
  const adminDeleteMember = await fetch(`${baseUrl}/api/users/${memberUid}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${admin.token}` }
  });
  if (adminDeleteMember.status !== 200) throw new Error(`Admin delete member status was ${adminDeleteMember.status}`);
  const deletedProfile = await db.collection('users').doc(memberUid).get();
  if (deletedProfile.exists) throw new Error('Deleted member profile still exists');
  await getAdminAuth(adminApp).getUser(memberUid).then(
    () => { throw new Error('Deleted member Auth account still exists'); },
    (error) => { if (error?.code !== 'auth/user-not-found') throw error; }
  );
  console.log('OCR RBAC and managed Auth/profile deletion verified.');
} finally {
  await new Promise((resolve) => server.close(resolve));
  await deleteApp(member.app);
  await deleteApp(partyLeader.app);
  await deleteApp(admin.app);
  await deleteApp(owner.app);
  await deleteAdminApp(adminApp);
  for (const app of getAdminApps()) await deleteAdminApp(app);
}
