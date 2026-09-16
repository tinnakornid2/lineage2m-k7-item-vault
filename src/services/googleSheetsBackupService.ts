import { User, VaultItem, QueueItem, ClanGroup, DiamondVaultRecord } from '../types';

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
}

const CONFIG_KEY = 'l2m_google_backup_config';
const CACHE_KEY = 'l2m_google_backup_cache';

const DEFAULT_CONFIG: GoogleBackupConfig = {
  webAppUrl: '',
  autoBackupEnabled: true,
  fallbackOnQuotaExceeded: true,
  lastStatus: 'idle',
  lastMessage: ''
};

export function getGoogleBackupConfig(): GoogleBackupConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch (err) {
    console.error('Error reading google backup config:', err);
    return { ...DEFAULT_CONFIG };
  }
}

export function saveGoogleBackupConfig(updates: Partial<GoogleBackupConfig>): GoogleBackupConfig {
  try {
    const current = getGoogleBackupConfig();
    const updated = { ...current, ...updates };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Error saving google backup config:', err);
    return getGoogleBackupConfig();
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
    const pingUrl = `${webAppUrl.trim()}${webAppUrl.includes('?') ? '&' : '?'}action=ping&_t=${Date.now()}`;
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
        diamondLogs: payload.diamondLogs
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
    const fetchUrl = `${webAppUrl}${webAppUrl.includes('?') ? '&' : '?'}action=fetch_all&_t=${Date.now()}`;
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
        vaultBalance: Number(json.vaultBalance || 0)
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
