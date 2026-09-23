import { applicationDefault, cert, deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CURRENT_BACKUP_FORMAT,
  CURRENT_SCHEMA_VERSION,
  REQUIRED_COLLECTIONS
} from './backup-schema.mjs';

export const COLLECTIONS = REQUIRED_COLLECTIONS;

export function encodeValue(value) {
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

export async function runBackup(options = {}) {
  const PROJECT_ID = options.projectId || process.env.FIREBASE_PROJECT_ID?.trim();
  const DATABASE_ID = options.databaseId || process.env.FIRESTORE_DATABASE_ID?.trim();

  if (!PROJECT_ID || !DATABASE_ID) {
    throw new Error('Explicit FIREBASE_PROJECT_ID and FIRESTORE_DATABASE_ID environment variables are required. Stale fallbacks have been removed for data safety.');
  }

  if (PROJECT_ID === 'hybrid-box-753bd') {
    throw new Error('Stale legacy project hybrid-box-753bd is strictly rejected.');
  }
  if (DATABASE_ID === 'ai-studio-lineage2mk7itemv-4a75381c-cb0d-43f8-9b9b-c337a41dd8b0') {
    throw new Error('Stale database ID ai-studio-lineage2mk7itemv-4a75381c-cb0d-43f8-9b9b-c337a41dd8b0 is strictly rejected.');
  }
  const useEmulators = options.useEmulators ?? (process.env.K7_USE_EMULATORS === 'true');
  if (!useEmulators && PROJECT_ID === 'k7-item' && DATABASE_ID === '(default)') {
    throw new Error('Project k7-item does not use (default) database. Specific database ID required.');
  }
  const passphrase = options.passphrase || process.env.K7_BACKUP_PASSPHRASE || '';

  if (passphrase.length < 16) {
    throw new Error('K7_BACKUP_PASSPHRASE must contain at least 16 characters.');
  }
  if (useEmulators) process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';

  const serviceAccountJson = options.serviceAccountJson || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
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

  try {
    const collections = {};
    const counts = {};
    for (const collectionName of REQUIRED_COLLECTIONS) {
      const snapshot = await db.collection(collectionName).get();
      let docs = snapshot.docs;
      if (collectionName === 'users') {
        docs = docs.filter((document) => {
          const data = document.data();
          if (!data) return false;
          if (data.status === 'deleted') return false;
          if (data.status === 'shadow' || data.isAuthShadow) return false;
          return true;
        });
      }
      collections[collectionName] = docs.map((document) => ({
        id: document.id,
        data: encodeValue(document.data())
      }));
      counts[collectionName] = docs.length;
    }

    const plaintext = Buffer.from(JSON.stringify({
      format: CURRENT_BACKUP_FORMAT,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      projectId: PROJECT_ID,
      databaseId: useEmulators ? '(default)' : DATABASE_ID,
      createdAt: new Date().toISOString(),
      collections,
      counts,
      requiredCollections: REQUIRED_COLLECTIONS
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

    const backupDirectory = options.backupDirectory || path.resolve('backups', 'encrypted');
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

    const result = { backupPath, counts, encryptionVerified: true };
    console.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    await deleteApp(app);
  }
}

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) {
  runBackup().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
