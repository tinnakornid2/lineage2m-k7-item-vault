import { applicationDefault, cert, deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { createDecipheriv, scryptSync } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REQUIRED_COLLECTIONS,
  SUPPORTED_BACKUP_FORMATS,
  validateSnapshotCollections
} from './backup-schema.mjs';

export function decodeValue(value) {
  if (value?.__k7Type === 'timestamp') return Timestamp.fromDate(new Date(value.value));
  if (value?.__k7Type === 'bytes') return Buffer.from(value.value, 'base64');
  if (Array.isArray(value)) return value.map(decodeValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([keyName, child]) => [keyName, decodeValue(child)]));
  }
  return value;
}

export async function runRestore(options = {}) {
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
  const backupArgument = options.backupFilePath || process.argv.find((argument) => argument.endsWith('.k7backup'));

  if (!backupArgument) throw new Error('Provide the .k7backup file path.');
  if (passphrase.length < 16) throw new Error('K7_BACKUP_PASSPHRASE must contain at least 16 characters.');
  if ((options.restoreConfirm || process.env.K7_RESTORE_CONFIRM) !== 'RESTORE_FIRESTORE_BACKUP') {
    throw new Error('Set K7_RESTORE_CONFIRM=RESTORE_FIRESTORE_BACKUP before restoring.');
  }
  if (useEmulators) process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';

  const container = JSON.parse(await readFile(path.resolve(backupArgument), 'utf8'));
  if (container.format !== 'k7-encrypted-container-v1' || container.cipher !== 'aes-256-gcm') {
    throw new Error('Unsupported or invalid backup container.');
  }
  const salt = Buffer.from(container.salt, 'base64');
  const iv = Buffer.from(container.iv, 'base64');
  const tag = Buffer.from(container.tag, 'base64');
  const ciphertext = Buffer.from(container.ciphertext, 'base64');
  const key = scryptSync(passphrase, salt, 32);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const backup = JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'));

  if (!SUPPORTED_BACKUP_FORMATS.includes(backup.format) || backup.projectId !== PROJECT_ID) {
    throw new Error('Backup project identity does not match the K7 Firebase project.');
  }
  if (!useEmulators) {
    if (backup.databaseId !== DATABASE_ID) {
      throw new Error(`Backup database ${backup.databaseId} does not match target ${DATABASE_ID}.`);
    }
  } else {
    // In emulator rehearsal mode, allow emulator (default) or production named database
    if (backup.databaseId !== '(default)' && backup.databaseId !== DATABASE_ID) {
      throw new Error(`Backup database ${backup.databaseId} does not match target ${DATABASE_ID} or (default).`);
    }
  }

  const validation = validateSnapshotCollections(backup.collections);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const serviceAccountJson = options.serviceAccountJson || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const app = initializeApp(
    useEmulators
      ? { projectId: PROJECT_ID }
      : {
          projectId: PROJECT_ID,
          credential: serviceAccountJson ? cert(JSON.parse(serviceAccountJson)) : applicationDefault()
        },
    `k7-restore-${Date.now()}`
  );
  const db = useEmulators ? getFirestore(app) : getFirestore(app, DATABASE_ID);

  async function commitInChunks(operations) {
    for (let offset = 0; offset < operations.length; offset += 400) {
      const batch = db.batch();
      for (const operation of operations.slice(offset, offset + 400)) operation(batch);
      await batch.commit();
    }
  }

  try {
    const restoredCounts = {};
    for (const collectionName of REQUIRED_COLLECTIONS) {
      const documents = backup.collections[collectionName] || [];
      const existing = await db.collection(collectionName).get();
      if (collectionName === 'users') {
        const existingProtectedDocs = new Map();
        existing.docs.forEach((doc) => {
          const data = doc.data();
          if (data && (data.status === 'deleted' || data.status === 'shadow' || data.isAuthShadow)) {
            existingProtectedDocs.set(doc.id, data);
          }
        });

        // Anti-resurrection guard: Existing soft-deleted and shadow documents are never resurrected, overwritten, or physically deleted
        const docsToRestore = documents.filter((doc) => !existingProtectedDocs.has(doc.id));
        const docsToDelete = existing.docs.filter((doc) => !existingProtectedDocs.has(doc.id));

        await commitInChunks(docsToDelete.map((document) => (batch) => batch.delete(document.ref)));
        await commitInChunks(docsToRestore.map((document) => (batch) =>
          batch.set(db.collection(collectionName).doc(document.id), decodeValue(document.data))
        ));
        restoredCounts[collectionName] = docsToRestore.length;
      } else if (collectionName === 'system') {
        const existingDocsMap = new Map();
        existing.docs.forEach((doc) => {
          existingDocsMap.set(doc.id, doc.data());
        });

        const systemDocsToCommit = documents.map((docItem) => {
          const docId = docItem.id;
          const backupData = decodeValue(docItem.data) || {};
          const existingData = existingDocsMap.get(docId) || {};

          let mergedData = { ...backupData };
          if (docId === 'tombstones') {
            mergedData = {
              ...backupData,
              deletedUsers: { ...(backupData.deletedUsers || {}), ...(existingData.deletedUsers || {}) },
              deletedVaultItems: { ...(backupData.deletedVaultItems || {}), ...(existingData.deletedVaultItems || {}) },
              deletedQueueItems: { ...(backupData.deletedQueueItems || {}), ...(existingData.deletedQueueItems || {}) },
              deletedGeneralItems: { ...(backupData.deletedGeneralItems || {}), ...(existingData.deletedGeneralItems || {}) },
              removedQueueMembers: { ...(backupData.removedQueueMembers || {}), ...(existingData.removedQueueMembers || {}) },
              cancelledClaims: { ...(backupData.cancelledClaims || {}), ...(existingData.cancelledClaims || {}) },
              updatedAt: Math.max(backupData.updatedAt || 0, existingData.updatedAt || 0, Date.now())
            };
          }
          return { id: docId, data: mergedData };
        });

        // Retain any existing system docs not in backup (e.g. tombstones created after backup)
        const backupDocIds = new Set(documents.map((d) => d.id));
        for (const existingDoc of existing.docs) {
          if (!backupDocIds.has(existingDoc.id)) {
            systemDocsToCommit.push({ id: existingDoc.id, data: existingDoc.data() });
          }
        }

        await commitInChunks(systemDocsToCommit.map((item) => (batch) =>
          batch.set(db.collection(collectionName).doc(item.id), item.data, { merge: true })
        ));
        restoredCounts[collectionName] = systemDocsToCommit.length;
      } else {
        await commitInChunks(existing.docs.map((document) => (batch) => batch.delete(document.ref)));
        await commitInChunks(documents.map((document) => (batch) =>
          batch.set(db.collection(collectionName).doc(document.id), decodeValue(document.data))
        ));
        restoredCounts[collectionName] = documents.length;
      }
    }
    const result = { restored: true, restoredCounts };
    console.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    await deleteApp(app);
  }
}

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) {
  runRestore().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
