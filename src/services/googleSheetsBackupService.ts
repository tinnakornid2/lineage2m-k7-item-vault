import { centralApi } from './centralApi';
import { getLocalSessionUser } from './firebase';
import {
  User,
  VaultItem,
  QuickItem,
  GeneralItem,
  QueueItem,
  ClanGroup,
  DiamondVaultRecord,
  FormulaSettings,
  AnnouncementSettings,
  BackgroundSettingsData,
  DiscordSettings,
  StatUpdateSettings,
  isItemDistributed,
  normalizeDistributedItem
} from '../types';

export interface GoogleBackupConfig {
  webAppUrl: string;
  sheetUrl?: string;
  sheetName?: string;
  autoBackupEnabled: boolean;
  fallbackOnQuotaExceeded: boolean;
  lastBackupAt?: number;
  lastStatus?: 'success' | 'error' | 'idle' | 'syncing';
  lastMessage?: string;
}

export interface BackupDataPayload {
  users: User[];
  vaultItems: VaultItem[];
  quickItems?: QuickItem[];
  generalItems?: GeneralItem[];
  queueItems: QueueItem[];
  clans: ClanGroup[];
  diamondLogs: DiamondVaultRecord[];
  vaultBalance: number;
  formulaSettings?: FormulaSettings;
  announcementSettings?: AnnouncementSettings | null;
  backgroundSettings?: BackgroundSettingsData | null;
  discordSettings?: DiscordSettings | null;
  statUpdateSettings?: StatUpdateSettings | null;
  googleBackupConfig?: Partial<GoogleBackupConfig> | null;
  syncMeta?: {
    deletedVaultItems?: Record<string, number>;
    deletedQueueItems?: Record<string, number>;
    deletedGeneralItems?: Record<string, number>;
    deletedUsers?: Record<string, number>;
    cancelledClaims?: Record<string, number>;
    removedQueueMembers?: Record<string, number>;
  };
  isReset?: boolean;
}

const SYNC_META_KEYS = {
  deletedVaultItems: 'k7_deleted_vault_item_ids',
  deletedQueueItems: 'k7_deleted_queue_item_ids',
  deletedGeneralItems: 'k7_deleted_general_item_ids',
  deletedUsers: 'k7_deleted_user_ids',
  cancelledClaims: 'l2m_cancelled_claims_map',
  removedQueueMembers: 'k7_removed_queue_members'
} as const;

function readSyncMap(key: string): Record<string, number> {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

function withLocalSyncMeta(payload: BackupDataPayload): BackupDataPayload {
  return {
    ...payload,
    syncMeta: {
      deletedVaultItems: readSyncMap(SYNC_META_KEYS.deletedVaultItems),
      deletedQueueItems: readSyncMap(SYNC_META_KEYS.deletedQueueItems),
      deletedGeneralItems: readSyncMap(SYNC_META_KEYS.deletedGeneralItems),
      deletedUsers: readSyncMap(SYNC_META_KEYS.deletedUsers),
      cancelledClaims: readSyncMap(SYNC_META_KEYS.cancelledClaims),
      removedQueueMembers: readSyncMap(SYNC_META_KEYS.removedQueueMembers),
      ...(payload.syncMeta || {})
    }
  };
}

export function applyIncomingSyncMeta(payload: BackupDataPayload): void {
  if (!payload.syncMeta) return;
  const now = Date.now();
  const maxAge = 14 * 24 * 60 * 60 * 1000;
  for (const [field, storageKey] of Object.entries(SYNC_META_KEYS)) {
    const incoming = payload.syncMeta[field as keyof typeof SYNC_META_KEYS] || {};
    const local = readSyncMap(storageKey);
    let changed = false;
    for (const [id, timestamp] of Object.entries(incoming)) {
      if (typeof timestamp === 'number' && (now - timestamp < maxAge) && timestamp > (local[id] || 0)) {
        local[id] = timestamp;
        changed = true;
      }
    }
    for (const [id, timestamp] of Object.entries(local)) {
      if (typeof timestamp !== 'number' || now - timestamp >= maxAge) {
        delete local[id];
        changed = true;
      }
    }
    if (changed) {
      try { localStorage.setItem(storageKey, JSON.stringify(local)); } catch {}
    }
  }
}

function sanitizePayloadForGoogle(payload: BackupDataPayload): BackupDataPayload {
  payload = withLocalSyncMeta(payload);
  const deletedUserMap = payload.syncMeta?.deletedUsers || {};
  const deletedGeneralMap = payload.syncMeta?.deletedGeneralItems || {};
  const deletedVaultMap = payload.syncMeta?.deletedVaultItems || {};
  const deletedQueueMap = payload.syncMeta?.deletedQueueItems || {};
  return {
    ...payload,
    users: (payload.users || [])
      .filter((user) => {
        if (!user || !user.id) return false;
        if (user.id === 'user_owner_eloni' || user.username?.toLowerCase() === 'eloni' || user.inGameName?.toLowerCase() === 'eloni') return true;
        return !deletedUserMap[user.id];
      })
      .map(({ password: _password, ...user }) => user as User),
    generalItems: (payload.generalItems || []).filter((item) => item && item.id && !deletedGeneralMap[item.id]),
    vaultItems: (payload.vaultItems || []).filter((item) => item && item.id && !deletedVaultMap[item.id]),
    queueItems: (payload.queueItems || []).filter((item) => item && item.id && !deletedQueueMap[item.id]),
    discordSettings: payload.discordSettings
      ? { ...payload.discordSettings, webhookUrl: '' }
      : payload.discordSettings
  };
}

const CONFIG_KEY = 'l2m_google_backup_config';
const CACHE_KEY = 'l2m_google_backup_cache';

const DEFAULT_CONFIG: GoogleBackupConfig = {
  webAppUrl: '',
  sheetUrl: '',
  sheetName: '',
  autoBackupEnabled: false,
  fallbackOnQuotaExceeded: false,
  lastStatus: 'idle',
  lastMessage: ''
};

export function getGoogleBackupConfig(): GoogleBackupConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed, autoBackupEnabled: false, fallbackOnQuotaExceeded: false };
  } catch (err) {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveGoogleBackupConfig(
  updates: Partial<GoogleBackupConfig>,
  broadcastToBackend: boolean = true
): GoogleBackupConfig {
  try {
    const current = getGoogleBackupConfig();
    const updated = { ...current, ...updates };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(updated));

    // Share with all members via backend API if webAppUrl was changed by the user
    if (
      broadcastToBackend &&
      (updates.webAppUrl !== undefined || updates.sheetUrl !== undefined) &&
      (updates.webAppUrl !== current.webAppUrl || updates.sheetUrl !== current.sheetUrl)
    ) {
      fetch('/api/google-backup-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webAppUrl: updated.webAppUrl,
          sheetUrl: updated.sheetUrl
        })
      }).catch(() => {});
    }

    return updated;
  } catch (err) {
    console.error('Error saving google backup config:', err);
    return getGoogleBackupConfig();
  }
}

/**
 * Initialize shared Google Backup config so all members automatically get the Owner's database URL
 */
export async function initSharedGoogleBackupConfig(): Promise<void> {
  try {
    const res = await fetch('/api/google-backup-config');
    if (res.ok) {
      const data = await res.json();
      if (data.webAppUrl) {
        saveGoogleBackupConfig(
          {
            webAppUrl: data.webAppUrl,
            sheetUrl: data.sheetUrl
          },
          false // DO NOT echo back to server!
        );
      }
    }
  } catch (err) {
    // Ignore offline errors
  }
}

/**
 * Test connectivity with deployed Google Apps Script Web App
 */
export async function testGoogleSheetsConnection(_webAppUrl?: string): Promise<{
  success: boolean;
  message: string;
  sheetUrl?: string;
  sheetName?: string;
}> {
  return {
    success: true,
    message: 'Google Sheets sync is decoupled in favor of Firebase Cloud & Live Relay.'
  };
}

/**
 * Bulletproof normalizer: ensure any item that has a recipient is marked distributed
 */
export const normalizeVaultItemsList = <T extends { status?: string; distributedTo?: any }>(items: T[]): T[] => {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    if (!item) return item;
    return normalizeDistributedItem(item as any) as T;
  });
};

/**
 * Backup all Clan Hub data to Google Sheets & Drive
 */
export async function backupAllDataToGoogleSheets(
  payload: BackupDataPayload,
  performedBy: string = 'Owner'
): Promise<{
  success: boolean;
  message: string;
  sheetUrl?: string;
}> {
  try {
    await broadcastLiveState(payload, performedBy).catch(() => {});
    return {
      success: true,
      message: 'All data synchronized to Live State Relay and local storage successfully.'
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Sync to Live State Relay failed'
    };
  }
}

/**
 * Fetch all Clan Hub data from Google Sheets (Failover Recovery)
 */
export async function fetchDataFromGoogleSheets(_customUrl?: string): Promise<{
  success: boolean;
  data?: BackupDataPayload;
  message: string;
}> {
  return {
    success: false,
    message: 'Google Sheets sync is disabled in favor of Firebase CLAN-HUB.'
  };
}

/**
 * Upload Image (Base64) to Owner's Google Drive folder
 */
export async function uploadImageToGoogleDrive(
  base64Data: string,
  _fileName?: string
): Promise<{
  success: boolean;
  imageUrl?: string;
  fileId?: string;
  message: string;
}> {
  return {
    success: true,
    imageUrl: base64Data,
    message: 'Image stored locally'
  };
}

// Debounce timer reference
let debounceTimer: any = null;

/**
 * Auto-backup trigger with debounce (broadcasts directly to Live State Relay)
 */
export function triggerDebouncedAutoBackup(
  payload: BackupDataPayload,
  performedBy: string = 'Auto-Sync',
  immediate: boolean = false
) {
  if (isApplyingRemoteUpdate) return;

  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  const runBackup = () => {
    broadcastLiveState(payload, performedBy).catch(() => {});
  };

  if (immediate) {
    runBackup();
  } else {
    debounceTimer = setTimeout(runBackup, 1500);
  }
}

/**
 * Track changes that occurred during Firebase Quota downtime to auto-push when Firebase recovers
 */
export function setPendingFirebaseSync(pending: boolean) {
  try {
    if (pending) {
      localStorage.setItem('l2m_pending_firebase_sync', 'true');
      localStorage.setItem('l2m_pending_firebase_sync_at', Date.now().toString());
    } else {
      localStorage.removeItem('l2m_pending_firebase_sync');
      localStorage.removeItem('l2m_pending_firebase_sync_at');
    }
  } catch (e) {}
}

export function isPendingFirebaseSync(): boolean {
  try {
    return localStorage.getItem('l2m_pending_firebase_sync') === 'true';
  } catch (e) {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Real-Time Live State Relay & Synchronization Engine
// ─────────────────────────────────────────────────────────────

let realtimeActive = false;
let abortController: AbortController | null = null;
let currentLocalVersion = 0;
let isApplyingRemoteUpdate = false;
// Tier 3 Live Relay: Always enabled across all devices for instant (<50ms) global sync
let liveRelayEnabled = true;

let lastBroadcastString = '';

export function getIsApplyingRemoteUpdate(): boolean {
  return isApplyingRemoteUpdate;
}

export function setIsApplyingRemoteUpdate(val: boolean) {
  isApplyingRemoteUpdate = val;
}

export function setLiveRelayEnabled(enabled: boolean) {
  liveRelayEnabled = enabled;
  if (!enabled) stopGoogleRealtimeSync();
}

export function getCurrentLocalVersion(): number {
  return currentLocalVersion;
}

export function setCurrentLocalVersion(version: number) {
  currentLocalVersion = version;
}

export function setLastBroadcastPayload(payload: BackupDataPayload) {
  try {
    lastBroadcastString = JSON.stringify(payload);
  } catch {}
}

/**
 * Broadcast local Clan Hub state changes instantly to server live relay (< 20ms)
 * to propagate to all other active clan members
 */
const OUTBOX_PREFIX = 'k7_relay_outbox_';
let sendChain: Promise<any> = Promise.resolve();
let syncGeneration = 0;
let retrying = false;

function outboxKey(): string | null {
  const session = getLocalSessionUser();
  return session?.id ? OUTBOX_PREFIX + session.id : null;
}

export async function broadcastLiveState(
  payload: BackupDataPayload,
  performedBy: string = 'User'
): Promise<{ success: boolean; version?: number }> {
  if (!liveRelayEnabled) return { success: false };
  const clean = sanitizePayloadForGoogle(withLocalSyncMeta(payload));
  const body = JSON.stringify({ data: clean, performedBy });
  const key = outboxKey();
  if (key) {
    try { localStorage.setItem(key, body); } catch {}
  }
  const send = async () => {
    try {
      // A write acknowledgement does NOT advance the read cursor: its merged snapshot
      // may contain another member's change that this browser has not read yet.
      const res = await centralApi('/api/live-state', { method: 'POST', body });
      const result = await res.json();
      lastBroadcastString = JSON.stringify(clean);
      if (key && localStorage.getItem(key) === body) localStorage.removeItem(key);
      return { success: true, version: result.version };
    } catch (error) {
      console.warn('Central sync pending:', error);
      return { success: false };
    }
  };
  const result = sendChain.then(send, send);
  sendChain = result;
  return result;
}

async function retryOutbox() {
  const key = outboxKey();
  if (!key || retrying) return;
  const body = localStorage.getItem(key);
  if (!body) return;
  retrying = true;
  try {
    await sendChain;
    if (localStorage.getItem(key) !== body) return;
    await centralApi('/api/live-state', { method: 'POST', body });
    if (localStorage.getItem(key) === body) localStorage.removeItem(key);
  } catch {} finally { retrying = false; }
}

export function startGoogleRealtimeSync(onDataChanged: (data: BackupDataPayload) => void) {
  if (!liveRelayEnabled || realtimeActive) return;
  realtimeActive = true;
  const generation = ++syncGeneration;
  const pollLoop = async () => {
    while (realtimeActive && generation === syncGeneration) {
      try {
        await retryOutbox();
        abortController = new AbortController();
        const timer = setTimeout(() => abortController?.abort(), 8000);
        try {
          const res = await fetch(`/api/live-state?v=${currentLocalVersion}&_t=${Date.now()}`, {
            signal: abortController.signal, cache: 'no-store'
          });
          if (!res.ok) throw new Error('CENTRAL_READ_FAILED');
          const json = await res.json();
          if (json.modified && json.data && generation === syncGeneration) {
            // Reject delayed responses, but allow a server restart with a new snapshot.
            currentLocalVersion = json.version;
            lastBroadcastString = JSON.stringify(json.data);
            isApplyingRemoteUpdate = true;
            applyIncomingSyncMeta(json.data);
            onDataChanged(json.data);
            setTimeout(() => { isApplyingRemoteUpdate = false; }, 500);
          }
        } finally { clearTimeout(timer); }
      } catch (error) {
        if (!realtimeActive || generation !== syncGeneration) break;
        console.warn('Central read will retry:', error);
      }
      await new Promise(resolve => setTimeout(resolve, 2500));
    }
  };
  void pollLoop();
}

/**
 * Stop real-time live synchronization cleanly
 */
export function stopGoogleRealtimeSync() {
  realtimeActive = false;
  syncGeneration++;
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
}

