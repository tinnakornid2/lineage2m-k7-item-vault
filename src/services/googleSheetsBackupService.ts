import { User, VaultItem, QueueItem, ClanGroup, DiamondVaultRecord, FormulaSettings } from '../types';

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
  queueItems: QueueItem[];
  clans: ClanGroup[];
  diamondLogs: DiamondVaultRecord[];
  vaultBalance: number;
  formulaSettings?: FormulaSettings;
}

const CONFIG_KEY = 'l2m_google_backup_config';
const CACHE_KEY = 'l2m_google_backup_cache';

const DEFAULT_CONFIG: GoogleBackupConfig = {
  webAppUrl: 'https://script.google.com/macros/s/AKfycbzg5w7B-4I-Xvrm0KGkg_ynFbQ1WNUv1KMrfdjxMegeManL-Qzc8BjVm1mRzjSlcwrz1A/exec',
  sheetUrl: 'https://docs.google.com/spreadsheets/d/1OZLqGcnAKBjilbvUme3OZbLQHNvRgs3MZkXWVl_d0y0/edit',
  sheetName: 'สเปรดชีตไม่มีชื่อ',
  autoBackupEnabled: true,
  fallbackOnQuotaExceeded: true,
  lastStatus: 'idle',
  lastMessage: ''
};

export function getGoogleBackupConfig(): GoogleBackupConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw);
    // Auto-migrate if client has the old legacy URL that times out
    if (
      !parsed.webAppUrl ||
      parsed.webAppUrl.includes('AKfycbyTNRdFleJFRQn8uhs6sCj1WeHlbhtIbc6pcgy2hdp3MJ64qJ9B4BMm6_RHEpwBzvn-')
    ) {
      parsed.webAppUrl = DEFAULT_CONFIG.webAppUrl;
      parsed.sheetUrl = DEFAULT_CONFIG.sheetUrl;
      parsed.sheetName = DEFAULT_CONFIG.sheetName;
      localStorage.setItem(CONFIG_KEY, JSON.stringify(parsed));
      try {
        localStorage.removeItem(CACHE_KEY);
      } catch (e) {}
    }
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch (err) {
    console.error('Error reading google backup config:', err);
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
  const config = getGoogleBackupConfig();
  const webAppUrl = config.webAppUrl?.trim();

  if (!webAppUrl) {
    return {
      success: false,
      message: 'No Google Apps Script Web App URL configured.'
    };
  }

  saveGoogleBackupConfig({ lastStatus: 'syncing', lastMessage: 'Backing up data...' });

  try {
    const postBody = {
      action: 'backup_all',
      performedBy,
      vaultBalance: payload.vaultBalance,
      data: {
        users: payload.users,
        vaultItems: payload.vaultItems,
        queueItems: payload.queueItems,
        clans: payload.clans,
        diamondLogs: payload.diamondLogs,
        formulaSettings: payload.formulaSettings
      }
    };

    // Note: use text/plain to avoid preflight OPTIONS CORS issues with Google Apps Script Web Apps
    const response = await fetch(webAppUrl, {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(postBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();

    if (json.status === 'success') {
      const now = Date.now();
      saveGoogleBackupConfig({
        lastBackupAt: now,
        lastStatus: 'success',
        lastMessage: 'Backup completed successfully',
        sheetUrl: json.sheetUrl || config.sheetUrl
      });

      // Cache snapshot locally as emergency fast fallback
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          data: payload,
          timestamp: now
        }));
      } catch (e) {}

      return {
        success: true,
        message: 'All data successfully backed up to Google Sheets and Google Drive!',
        sheetUrl: json.sheetUrl || config.sheetUrl
      };
    } else {
      throw new Error(json.message || 'Google Apps Script returned an error');
    }
  } catch (err: any) {
    console.error('Backup to Google Sheets failed:', err);
    saveGoogleBackupConfig({
      lastStatus: 'error',
      lastMessage: err?.message || 'Failed to backup'
    });
    return {
      success: false,
      message: err?.message || 'Network error during Google Sheets backup'
    };
  }
}

/**
 * Fetch all Clan Hub data from Google Sheets (Failover Recovery)
 */
export async function fetchDataFromGoogleSheets(customUrl?: string): Promise<{
  success: boolean;
  data?: BackupDataPayload;
  message: string;
}> {
  const config = getGoogleBackupConfig();
  const webAppUrl = (customUrl || config.webAppUrl)?.trim();

  if (!webAppUrl) {
    return {
      success: false,
      message: 'No Google Apps Script Web App URL configured.'
    };
  }

  try {
    const fetchUrl = `${webAppUrl}${webAppUrl.includes('?') ? '&' : '?'}action=fetch_all`;
    const response = await fetch(fetchUrl, {
      method: 'GET',
      mode: 'cors',
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();

    if (json.status === 'success' && json.data) {
      const parsedData: BackupDataPayload = {
        users: Array.isArray(json.data.users) ? json.data.users : [],
        vaultItems: Array.isArray(json.data.vaultItems) ? json.data.vaultItems : [],
        queueItems: Array.isArray(json.data.queueItems) ? json.data.queueItems : [],
        clans: Array.isArray(json.data.clans) ? json.data.clans : [],
        diamondLogs: Array.isArray(json.data.diamondLogs) ? json.data.diamondLogs : [],
        vaultBalance: Number(json.vaultBalance || 0),
        formulaSettings: json.data.formulaSettings || undefined
      };

      return {
        success: true,
        data: parsedData,
        message: 'Successfully loaded data from Google Sheets!'
      };
    } else {
      throw new Error(json.message || 'Failed to parse Google Sheets response');
    }
  } catch (err: any) {
    console.error('Fetch from Google Sheets failed:', err);

    // If fetch failed, check local cache
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.data) {
          return {
            success: true,
            data: parsed.data,
            message: 'Loaded from local backup cache (Google Sheets connection failed).'
          };
        }
      }
    } catch (cacheErr) {}

    return {
      success: false,
      message: err?.message || 'Could not fetch data from Google Sheets'
    };
  }
}

/**
 * Upload Image (Base64) to Owner's Google Drive folder
 */
export async function uploadImageToGoogleDrive(
  base64Data: string,
  fileName: string = `img_${Date.now()}.png`
): Promise<{
  success: boolean;
  imageUrl?: string;
  fileId?: string;
  message: string;
}> {
  const config = getGoogleBackupConfig();
  const webAppUrl = config.webAppUrl?.trim();

  if (!webAppUrl) {
    return {
      success: false,
      message: 'Google Apps Script URL is not configured'
    };
  }

  try {
    const payload = {
      action: 'upload_image',
      base64Data,
      fileName,
      mimeType: base64Data.includes('image/jpeg') ? 'image/jpeg' : 'image/png'
    };

    const response = await fetch(webAppUrl, {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    const json = await response.json();
    if (json.status === 'success') {
      return {
        success: true,
        imageUrl: json.imageUrl,
        fileId: json.fileId,
        message: 'Image uploaded to Google Drive successfully'
      };
    } else {
      throw new Error(json.message || 'Upload to Google Drive failed');
    }
  } catch (err: any) {
    console.error('Upload to Google Drive failed:', err);
    return {
      success: false,
      message: err?.message || 'Upload to Google Drive error'
    };
  }
}

// Debounce timer reference
let debounceTimer: any = null;

/**
 * Auto-backup trigger with debounce (e.g. 10s)
 */
export function triggerDebouncedAutoBackup(
  payload: BackupDataPayload,
  performedBy: string = 'Auto-Sync'
) {
  if (isApplyingRemoteUpdate) return;
  const config = getGoogleBackupConfig();
  if (!config.webAppUrl || !config.autoBackupEnabled) return;

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    backupAllDataToGoogleSheets(payload, performedBy)
      .then(res => {
        if (res.success) {
          console.log('✅ Google Sheets Auto-Backup Completed:', new Date().toLocaleTimeString());
        }
      })
      .catch(err => console.warn('Auto backup skipped or failed:', err));
  }, 10000);
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
let sheetsPollingInterval: any = null;
let currentLocalVersion = 0;
let isApplyingRemoteUpdate = false;

let lastBroadcastString = '';

export function getIsApplyingRemoteUpdate(): boolean {
  return isApplyingRemoteUpdate;
}

export function setIsApplyingRemoteUpdate(val: boolean) {
  isApplyingRemoteUpdate = val;
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
  try {
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
        currentLocalVersion = json.version;
      }
      return { success: true, version: json.version };
    }
  } catch (err) {
    console.warn('broadcastLiveState error:', err);
  }
  return { success: false };
}

/**
 * Start real-time live synchronization across all clan members:
 * - Ultra-fast push notifications via long-polling server relay (< 50ms latency)
 * - Automatic background fallback sync with Google Sheets & Google Drive every 35s
 */
export function startGoogleRealtimeSync(
  onDataChanged: (data: BackupDataPayload) => void
) {
  if (realtimeActive) return;
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

  // Periodic Google Sheets fallback sync (every 35 seconds)
  sheetsPollingInterval = setInterval(async () => {
    if (!realtimeActive) return;
    try {
      const res = await fetchDataFromGoogleSheets();
      if (res.success && res.data) {
        if (res.data.users?.length || res.data.vaultItems?.length) {
          // 1. Strict equality check against what was already broadcast or applied
          const payloadStr = JSON.stringify(res.data);
          if (payloadStr === lastBroadcastString) {
            // Data in Google Sheets is completely identical to active live state. Skip to avoid re-renders & flicker!
            return;
          }

          // 2. Protect against stale snapshots overwriting higher verified power
          const incomingUsers = res.data.users || [];
          if (incomingUsers.length > 0 && lastBroadcastString) {
            try {
              const lastData = JSON.parse(lastBroadcastString);
              const lastUsers = lastData.users || [];
              if (lastUsers.length > 0) {
                const incomingPower = incomingUsers.reduce((s: number, u: any) => s + (Number(u.powerLevel) || 0), 0);
                const lastPower = lastUsers.reduce((s: number, u: any) => s + (Number(u.powerLevel) || 0), 0);
                // If incoming snapshot has lower total power and fewer or equal members, treat as stale and do not downgrade
                if (incomingPower < lastPower && incomingUsers.length <= lastUsers.length) {
                  console.warn('🛡️ Shielded state: Google Sheets snapshot is older than active live state. Skipping overwrite.', {
                    incomingPower,
                    lastPower
                  });
                  return;
                }
              }
            } catch {}
          }

          lastBroadcastString = payloadStr;
          isApplyingRemoteUpdate = true;
          onDataChanged(res.data);
          setTimeout(() => {
            isApplyingRemoteUpdate = false;
          }, 800);
        }
      }
    } catch {}
  }, 35000);
}

/**
 * Stop real-time live synchronization cleanly
 */
export function stopGoogleRealtimeSync() {
  realtimeActive = false;
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  if (sheetsPollingInterval) {
    clearInterval(sheetsPollingInterval);
    sheetsPollingInterval = null;
  }
}


