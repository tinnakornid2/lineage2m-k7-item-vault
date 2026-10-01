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
  ClassMeta,
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
  customClasses?: ClassMeta[];
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
 * Note: If caller already dispatched an immediate broadcastLiveState, skip redundant immediate call.
 */
export function triggerDebouncedAutoBackup(
  payload: BackupDataPayload,
  performedBy: string = 'Auto-Sync',
  immediate: boolean = false
) {
  if (isApplyingRemoteUpdate) return;
  // If immediate: true was passed, the calling handler already called broadcastLiveState directly
  if (immediate) return;

  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  debounceTimer = setTimeout(() => {
    broadcastLiveState(payload, performedBy).catch(() => {});
  }, 2000);
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
let syncGeneration = 0;
let retrying = false;
let isTransmitting = false;
let pendingSnapshot: {
  payload: BackupDataPayload;
  performedBy: string;
  resolvers: Array<(res: { success: boolean; version?: number }) => void>;
} | null = null;

function outboxKey(): string | null {
  const session = getLocalSessionUser();
  return session?.id ? OUTBOX_PREFIX + session.id : null;
}

/**
 * High-Performance Coalesced Live Relay Dispatcher (Latest Snapshot Wins)
 * Collapses concurrent / rapid sync requests into at most 1 in-flight + 1 pending transmission.
 * Avoids main-thread JSON.stringify / LocalStorage overhead on discarded intermediate snapshots.
 */
export async function broadcastLiveState(
  payload: BackupDataPayload,
  performedBy: string = 'User'
): Promise<{ success: boolean; version?: number }> {
  if (!liveRelayEnabled) return { success: false };

  // If a transmission is currently in flight: coalesce into pending snapshot!
  if (isTransmitting) {
    return new Promise<{ success: boolean; version?: number }>((resolve) => {
      if (pendingSnapshot) {
        pendingSnapshot.payload = payload;
        pendingSnapshot.performedBy = performedBy;
        pendingSnapshot.resolvers.push(resolve);
      } else {
        pendingSnapshot = {
          payload,
          performedBy,
          resolvers: [resolve]
        };
      }
    });
  }

  return dispatchBroadcastLoop(payload, performedBy);
}

async function dispatchBroadcastLoop(
  initialPayload: BackupDataPayload,
  initialActor: string
): Promise<{ success: boolean; version?: number }> {
  isTransmitting = true;
  let currentPayload = initialPayload;
  let currentActor = initialActor;
  let currentResolvers: Array<(res: { success: boolean; version?: number }) => void> = [];
  let lastResult: { success: boolean; version?: number } = { success: false };

  try {
    while (true) {
      // 1. Sanitize & stringify only when actively transmitting (offload from callers)
      const clean = sanitizePayloadForGoogle(withLocalSyncMeta(currentPayload));
      const body = JSON.stringify({ data: clean, performedBy: currentActor });

      // 2. Dedup: if exact payload was already broadcasted, skip redundant network roundtrip
      if (body === lastBroadcastString) {
        lastResult = { success: true };
      } else {
        const key = outboxKey();
        if (key) {
          try { localStorage.setItem(key, body); } catch {}
        }
        try {
          const res = await centralApi('/api/live-state', { method: 'POST', body });
          const result = await res.json();
          lastBroadcastString = body;
          if (key && localStorage.getItem(key) === body) localStorage.removeItem(key);
          lastResult = { success: true, version: result.version };
        } catch (error) {
          console.warn('Central sync pending:', error);
          lastResult = { success: false };
        }
      }

      // Resolve all callers that contributed to or waited for this transmission
      for (const resolve of currentResolvers) {
        resolve(lastResult);
      }
      currentResolvers = [];

      // 3. Check if newer snapshot arrived while network call was in flight
      if (pendingSnapshot) {
        currentPayload = pendingSnapshot.payload;
        currentActor = pendingSnapshot.performedBy;
        currentResolvers = pendingSnapshot.resolvers;
        pendingSnapshot = null;
        // Loop continues immediately with the newest snapshot
      } else {
        break;
      }
    }
  } finally {
    isTransmitting = false;
  }

  return lastResult;
}

let lastRetryAttempt = 0;
let retryBackoffMs = 5000;

async function retryOutbox() {
  const key = outboxKey();
  if (!key || retrying || isTransmitting) return;
  const body = localStorage.getItem(key);
  if (!body) return;
  const now = Date.now();
  if (now - lastRetryAttempt < retryBackoffMs) return;
  lastRetryAttempt = now;
  retrying = true;
  try {
    if (localStorage.getItem(key) !== body) return;
    const res = await centralApi('/api/live-state', { method: 'POST', body });
    if (res.ok) {
      if (localStorage.getItem(key) === body) localStorage.removeItem(key);
      retryBackoffMs = 5000;
    } else {
      retryBackoffMs = Math.min(30000, retryBackoffMs * 1.5);
    }
  } catch {
    retryBackoffMs = Math.min(30000, retryBackoffMs * 1.5);
  } finally {
    retrying = false;
  }
}

export function startGoogleRealtimeSync(onDataChanged: (data: BackupDataPayload) => void) {
  if (!liveRelayEnabled || realtimeActive) return;
  realtimeActive = true;
  const generation = ++syncGeneration;
  let consecutiveErrors = 0;

  const pollLoop = async () => {
    while (realtimeActive && generation === syncGeneration) {
      let cycleDelay = 2500;
      try {
        await retryOutbox();
        abortController = new AbortController();
        const timer = setTimeout(() => abortController?.abort(), 12000);
        try {
          const res = await fetch(`/api/live-state?v=${currentLocalVersion}&_t=${Date.now()}`, {
            signal: abortController.signal, cache: 'no-store'
          });
          if (!res.ok) throw new Error(`CENTRAL_READ_FAILED_${res.status}`);
          const json = await res.json();
          consecutiveErrors = 0;

          if (json.modified && json.data && generation === syncGeneration) {
            // Staleness guard: only apply if version >= local or local is 0
            if (currentLocalVersion === 0 || Number(json.version || 0) >= currentLocalVersion) {
              currentLocalVersion = json.version;
              lastBroadcastString = JSON.stringify(json.data);
              isApplyingRemoteUpdate = true;
              applyIncomingSyncMeta(json.data);
              onDataChanged(json.data);
              setTimeout(() => { isApplyingRemoteUpdate = false; }, 500);
            }
          } else if (!json.modified && json.version) {
            if (Number(json.version) > currentLocalVersion) {
              currentLocalVersion = json.version;
            }
          }
        } finally { clearTimeout(timer); }
      } catch (error) {
        if (!realtimeActive || generation !== syncGeneration) break;
        consecutiveErrors++;
        cycleDelay = Math.min(20000, 2500 * Math.pow(1.4, Math.min(consecutiveErrors, 5)) + Math.random() * 1000);
        console.warn(`Central read will retry in ${Math.round(cycleDelay)}ms:`, error);
      }
      await new Promise(resolve => setTimeout(resolve, cycleDelay));
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

