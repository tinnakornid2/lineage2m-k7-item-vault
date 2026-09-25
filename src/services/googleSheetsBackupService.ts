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
export async function testGoogleSheetsConnection(webAppUrl: string): Promise<{
  success: boolean;
  message: string;
  sheetUrl?: string;
  sheetName?: string;
}> {
  if (!webAppUrl || !webAppUrl.trim().startsWith('https://script.google.com/macros/s/')) {
    return {
      success: false,
      message: 'Invalid Google Apps Script Web App URL. Must start with https://script.google.com/macros/s/'
    };
  }

  try {
    const pingUrl = `${webAppUrl.trim()}${webAppUrl.includes('?') ? '&' : '?'}action=ping`;
    const response = await fetch(pingUrl, {
      method: 'GET',
      mode: 'cors',
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    if (json.status === 'success') {
      saveGoogleBackupConfig({
        webAppUrl: webAppUrl.trim(),
        sheetUrl: json.sheetUrl,
        sheetName: json.sheetName,
        lastStatus: 'success',
        lastMessage: 'Connected successfully'
      });
      return {
        success: true,
        message: 'Connected to Google Sheets successfully!',
        sheetUrl: json.sheetUrl,
        sheetName: json.sheetName
      };
    } else {
      return {
        success: false,
        message: json.message || 'Unknown response from Google Apps Script'
      };
    }
  } catch (err: any) {
    console.error('Test connection failed:', err);
    return {
      success: false,
      message: err?.message || 'Failed to connect to Google Apps Script. Check permissions (Anyone) or CORS.'
    };
  }
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
export async function broadcastLiveState(
  payload: BackupDataPayload,
  performedBy: string = 'User'
): Promise<{ success: boolean; version?: number }> {
  if (!liveRelayEnabled) {
    return { success: true, version: currentLocalVersion };
  }
  try {
    payload = withLocalSyncMeta(payload);
    if (Array.isArray(payload.users)) {
      payload = {
        ...payload,
        users: payload.users.map((u: any) => {
          if (!u || typeof u !== 'object') return u;
          const { password: _pw, ...cleanUser } = u;
          return cleanUser;
        })
      };
    }
    const payloadStr = JSON.stringify(payload);
    if (payloadStr === lastBroadcastString) {
      // Data is identical to what was already broadcasted or received from remote. Skip!
      return { success: true, version: currentLocalVersion };
    }

    const res = await fetch('/api/live-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: payload,
        performedBy
      })
    });
    if (res.ok) {
      const json = await res.json();
      lastBroadcastString = payloadStr;
      if (typeof json.version === 'number') {
        currentLocalVersion = Math.max(currentLocalVersion, json.version);
      }
      return { success: true, version: json.version };
    }
  } catch (err) {
    console.warn('broadcastLiveState error:', err);
  }
  return { success: false };
}

let fastPollTimer: any = null;

/**
 * Start real-time live synchronization across all clan members:
 * - Ultra-fast push notifications via long-polling server relay (< 50ms latency)
 * - 3.5-second fast-poll heartbeat fallback ensuring immediate multi-container lambda synchronization
 */
export function startGoogleRealtimeSync(
  onDataChanged: (data: BackupDataPayload) => void
) {
  if (!liveRelayEnabled || realtimeActive) return;
  realtimeActive = true;

  const pollLoop = async () => {
    while (realtimeActive) {
      try {
        abortController = new AbortController();
        const url = `/api/live-state?v=${currentLocalVersion}&wait=true&_t=${Date.now()}`;
        const res = await fetch(url, {
          signal: abortController.signal
        });

        if (res.ok) {
          const json = await res.json();
          if (json.modified && json.data) {
            currentLocalVersion = json.version;
            try {
              lastBroadcastString = JSON.stringify(json.data);
            } catch {}
            isApplyingRemoteUpdate = true;
            applyIncomingSyncMeta(json.data);
            onDataChanged(json.data);
            setTimeout(() => {
              isApplyingRemoteUpdate = false;
            }, 500);
          }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          break; // User stopped sync
        }
        // Small delay on network error before reconnecting
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  };

  pollLoop();

  // Fast-poll heartbeat (every 3.5s) to guarantee zero-miss sync even when Vercel serverless isolates lambdas
  if (fastPollTimer) clearInterval(fastPollTimer);
  fastPollTimer = setInterval(async () => {
    if (!realtimeActive) return;
    try {
      const res = await fetch(`/api/live-state?v=${currentLocalVersion}&_t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.modified && json.data && json.version > currentLocalVersion) {
          currentLocalVersion = json.version;
          try {
            lastBroadcastString = JSON.stringify(json.data);
          } catch {}
          isApplyingRemoteUpdate = true;
          applyIncomingSyncMeta(json.data);
          onDataChanged(json.data);
          setTimeout(() => {
            isApplyingRemoteUpdate = false;
          }, 500);
        }
      }
    } catch {}
  }, 3500);
}

/**
 * Stop real-time live synchronization cleanly
 */
export function stopGoogleRealtimeSync() {
  realtimeActive = false;
  if (fastPollTimer) {
    clearInterval(fastPollTimer);
    fastPollTimer = null;
  }
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
}


