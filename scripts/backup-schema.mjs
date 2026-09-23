/**
 * Canonical Schema and Allowlist for Encrypted Firestore Snapshots
 * Used symmetrically by backup and restore scripts.
 */

export const REQUIRED_COLLECTIONS = [
  'users',
  'items',
  'item_queues',
  'general_items',
  'clans',
  'diamond_vault',
  'quick_items',
  'item_claims',
  'app_settings',
  'system_meta'
];

export const CURRENT_BACKUP_FORMAT = 'k7-firestore-backup-v2';
export const CURRENT_SCHEMA_VERSION = '2.0';
export const SUPPORTED_BACKUP_FORMATS = ['k7-firestore-backup-v1', 'k7-firestore-backup-v2'];

export function validateSnapshotCollections(collectionsObj) {
  if (!collectionsObj || typeof collectionsObj !== 'object') {
    return {
      valid: false,
      error: 'Invalid or missing collections object in snapshot.',
      missingCollections: [...REQUIRED_COLLECTIONS],
      unknownCollections: []
    };
  }

  const keys = Object.keys(collectionsObj);
  const missingCollections = REQUIRED_COLLECTIONS.filter((col) => !keys.includes(col));
  const unknownCollections = keys.filter((col) => !REQUIRED_COLLECTIONS.includes(col));

  if (missingCollections.length > 0) {
    return {
      valid: false,
      error: `Incomplete backup snapshot: missing required collection(s): ${missingCollections.join(', ')}. Full restore unsafe.`,
      missingCollections,
      unknownCollections
    };
  }

  if (unknownCollections.length > 0) {
    return {
      valid: false,
      error: `Snapshot contains unrecognized collection(s): ${unknownCollections.join(', ')}. Restore aborted to prevent data corruption.`,
      missingCollections,
      unknownCollections
    };
  }

  return { valid: true, missingCollections: [], unknownCollections: [] };
}
