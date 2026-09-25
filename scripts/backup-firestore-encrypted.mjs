import { applicationDefault, cert, deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'k7-item';
const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || 'ai-studio-lineage2mclanhub-4a1794d8-f944-422f-945e-56c12057ad13';
const COLLECTIONS = [
  'users', 'items', 'item_claims', 'item_queues', 'quick_items',
  'clans', 'diamond_vault', 'app_settings', 'system_meta'
];
const useEmulators = process.env.K7_USE_EMULATORS === 'true';
const passphrase = process.env.K7_BACKUP_PASSPHRASE || '';

if (passphrase.length < 16) {
  throw new Error('K7_BACKUP_PASSPHRASE must contain at least 16 characters.');
}
if (useEmulators) process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const app = initializeApp(
  useEmulators
    ? { projectId: PROJECT_ID }
    : {
        projectId: PROJECT_ID,
        credential: serviceAccountJson ? cert(JSON.parse(serviceAccountJson)) : applicationDefault()
      },
  `k7-backup-${Date.now()}`
);
const db = useEmulators ? getFirestore(app) : getFirestore(app, DATABASE_ID);

function encodeValue(value) {
  if (value?.toDate instanceof Function) {
    return { __k7Type: 'timestamp', value: value.toDate().toISOString() };
  }
  if (value instanceof Uint8Array) {
    return { __k7Type: 'bytes', value: Buffer.from(value).toString('base64') };
  }
  if (Array.isArray(value)) return value.map(encodeValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, encodeValue(child)]));
  }
  return value;
}

try {
  const collections = {};
  const counts = {};
  for (const collectionName of COLLECTIONS) {
    const snapshot = await db.collection(collectionName).get();
    collections[collectionName] = snapshot.docs.map((document) => ({
      id: document.id,
      data: encodeValue(document.data())
    }));
    counts[collectionName] = snapshot.size;
  }

  const plaintext = Buffer.from(JSON.stringify({
    format: 'k7-firestore-backup-v1',
    projectId: PROJECT_ID,
    databaseId: useEmulators ? '(default)' : DATABASE_ID,
    createdAt: new Date().toISOString(),
    collections
  }), 'utf8');
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(passphrase, salt, 32);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Verify the encrypted payload before writing it to disk.
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const verified = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  if (!verified.equals(plaintext)) throw new Error('Encrypted backup verification failed.');

  const backupDirectory = path.resolve('backups', 'encrypted');
  await mkdir(backupDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDirectory, `firestore-${timestamp}.k7backup`);
  await writeFile(backupPath, JSON.stringify({
    format: 'k7-encrypted-container-v1',
    cipher: 'aes-256-gcm',
    kdf: 'scrypt',
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64')
  }));

  console.log(JSON.stringify({ backupPath, counts, encryptionVerified: true }, null, 2));
} finally {
  await deleteApp(app);
}
