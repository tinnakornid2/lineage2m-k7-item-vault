import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  connectAuthEmulator,
  deleteUser as deleteAuthUser,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updatePassword
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  query,
  orderBy,
  limit,
  where
} from 'firebase/firestore';
import firebaseConfigData from '../../firebase-applet-config.json';
import { validateRegistration } from '../utils/registration';
import {
  User,
  VaultItem,
  Claimant,
  QuickItem,
  GeneralItem,
  QueueItem,
  DiamondVault,
  DiamondVaultRecord,
  ClanGroup,
  AnnouncementSettings,
  DiscordSettings,
  FormulaSettings,
  cleanClanName,
  DEFAULT_CLAN
} from '../types';
import { LEAN_OFFLINE_MEMBERS } from '../data/offlineMembersFallback';
// Production data comes from Firestore/Google Sheets, with offline fallback for authentication
const REAL_BACKUP_MEMBERS: User[] = LEAN_OFFLINE_MEMBERS;
const REAL_BACKUP_CLANS: ClanGroup[] = [];
const REAL_BACKUP_QUEUES: QueueItem[] = [];
const REAL_BACKUP_VAULT_ITEMS: VaultItem[] = [];
const REAL_BACKUP_DIAMOND_TXS: DiamondVaultRecord[] = [];

const firebaseConfig = {
  apiKey: firebaseConfigData.apiKey,
  authDomain: firebaseConfigData.authDomain,
  projectId: firebaseConfigData.projectId,
  storageBucket: firebaseConfigData.storageBucket,
  messagingSenderId: firebaseConfigData.messagingSenderId,
  appId: firebaseConfigData.appId,
};

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
const useFirebaseEmulators = (import.meta as any).env?.VITE_USE_FIREBASE_EMULATORS === 'true';

// Initialize Firestore with Persistent Local Cache (IndexedDB)
// This saves up to 70-90% of Firestore reads by serving cached data directly from browser storage
function createFirestoreInstance() {
  const customDbId =
    !useFirebaseEmulators &&
    firebaseConfigData.firestoreDatabaseId &&
    firebaseConfigData.firestoreDatabaseId !== '(default)'
      ? firebaseConfigData.firestoreDatabaseId
      : undefined;

  if (useFirebaseEmulators) {
    return customDbId
      ? initializeFirestore(app, { experimentalForceLongPolling: true }, customDbId)
      : initializeFirestore(app, { experimentalForceLongPolling: true });
  }

  try {
    const cacheSettings = {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    };
    return customDbId
      ? initializeFirestore(app, cacheSettings, customDbId)
      : initializeFirestore(app, cacheSettings);
  } catch (err) {
    console.warn('Persistent cache init fallback to getFirestore:', err);
    return customDbId ? getFirestore(app, customDbId) : getFirestore(app);
  }
}

export const db = createFirestoreInstance();

// Opt-in local emulators. Production never connects unless this explicit flag is set.
const emulatorState = globalThis as typeof globalThis & { __k7FirebaseEmulatorsConnected?: boolean };
if (useFirebaseEmulators && !emulatorState.__k7FirebaseEmulatorsConnected) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
  emulatorState.__k7FirebaseEmulatorsConnected = true;
}

// Collection references
// Helper to recursively remove undefined fields for Firestore safety
export function sanitizeForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
  const clean: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = sanitizeForFirestore(value);
    }
  }
  return clean;
}

export const USERS_COLLECTION = 'users';
export const ITEMS_COLLECTION = 'items';
export const ITEM_CLAIMS_COLLECTION = 'item_claims';
export const QUICK_ITEMS_COLLECTION = 'quick_items';
export const GENERAL_ITEMS_COLLECTION = 'general_items';
export const QUEUES_COLLECTION = 'item_queues';
export const VAULT_COLLECTION = 'diamond_vault';
export const CLANS_COLLECTION = 'clans';

// Default seeded owner account & sample data (Synced with latest verified profile)
export const DEFAULT_OWNER: User = {
  id: 'user_owner_eloni',
  username: 'Eloni',
  inGameName: 'Eloni',
  powerLevel: 3722,
  level: 79,
  clan: 'VoltZ',
  characterClass: 'Orb',
  classes: ['Orb', 'Dual Blades', 'Spear', 'Greatsword'],
  role: 'owner',
  status: 'active',
  verified: true,
  createdAt: 1786449061493,
  statScreenshotUrl: 'https://kain7.com/screenshot/1810',
};

export const INITIAL_MEMBERS: User[] = (REAL_BACKUP_MEMBERS && REAL_BACKUP_MEMBERS.length > 0)
  ? (REAL_BACKUP_MEMBERS.some((u) => u.username?.toLowerCase() === 'eloni') ? REAL_BACKUP_MEMBERS : [DEFAULT_OWNER, ...REAL_BACKUP_MEMBERS])
  : [
      DEFAULT_OWNER,
      {
        id: 'user_zenkaii',
        username: 'zenkaii',
        inGameName: 'Zenkaii',
        powerLevel: 580000,
        clan: 'VoltZ',
        characterClass: 'Dual Blade',
        role: 'admin',
        status: 'active',
        createdAt: Date.now() - 86400000 * 20,
      },
      {
        id: 'user_dvd',
        username: 'dvd_player',
        inGameName: 'DVD',
        powerLevel: 540000,
        clan: 'LevelS',
        characterClass: 'Spear',
        role: 'member',
        status: 'active',
        createdAt: Date.now() - 86400000 * 15,
      },
      {
        id: 'user_arthur',
        username: 'arthur99',
        inGameName: 'KingArthur',
        powerLevel: 490000,
        clan: 'VoltZ',
        characterClass: 'Greatsword',
        role: 'member',
        status: 'active',
        createdAt: Date.now() - 86400000 * 10,
      },
      {
        id: 'user_valkyrie',
        username: 'valkyrie',
        inGameName: 'ValkyrieX',
        powerLevel: 510000,
        clan: 'LevelS',
        characterClass: 'Staff',
        role: 'member',
        status: 'active',
        createdAt: Date.now() - 86400000 * 8,
      },
      {
        id: 'user_pending_one',
        username: 'shadow_hunter',
        inGameName: 'NightHawk',
        powerLevel: 380000,
        clan: 'VoltZ',
        characterClass: 'Dagger',
        role: 'member',
        status: 'pending_approval',
        createdAt: Date.now() - 86400000 * 2,
      }
    ];

export const INITIAL_CLANS: ClanGroup[] = (REAL_BACKUP_CLANS && REAL_BACKUP_CLANS.length > 0)
  ? REAL_BACKUP_CLANS
  : [
      { id: 'clan_voltz', name: 'VoltZ', color: '#22c55e', order: 0, enabled: true },
      { id: 'clan_levels', name: 'LevelS', color: '#ef4444', order: 1, enabled: true },
      { id: 'clan_stronk', name: 'STRONK', color: '#eab308', order: 2, enabled: true }
    ];

export const INITIAL_QUICK_ITEMS: QuickItem[] = [];

export const INITIAL_VAULT_ITEMS: VaultItem[] = (REAL_BACKUP_VAULT_ITEMS && REAL_BACKUP_VAULT_ITEMS.length > 0)
  ? REAL_BACKUP_VAULT_ITEMS
  : [
  {
    id: 'item_initial_1',
    name: 'Dynasty Crusher Spear',
    imageUrl: 'https://images.unsplash.com/photo-1589241062272-c0a000072dfa?w=400&auto=format&fit=crop&q=80',
    price: 8500,
    minPowerLevel: 500000,
    rarity: 'LAGEND',
    hunters: [
      { name: 'Zenkaii', clan: 'VoltZ' },
      { name: 'DVD', clan: 'LevelS' }
    ],
    hunterScreenshots: [
      'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80'
    ],
    status: 'available',
    claimants: [
      {
        userId: 'user_dvd',
        inGameName: 'DVD',
        clan: 'LevelS',
        powerLevel: 540000,
        claimedAt: Date.now() - 3600000 * 4
      }
    ],
    createdAt: Date.now() - 86400000 * 1
  },
  {
    id: 'item_initial_2',
    name: 'Imperial Crusader Armor',
    imageUrl: 'https://images.unsplash.com/photo-1595590424283-b8f17842773f?w=400&auto=format&fit=crop&q=80',
    price: 15000,
    minPowerLevel: 550000,
    rarity: 'MYTHIC',
    hunters: [
      { name: 'Eloni', clan: 'VoltZ' },
      { name: 'Zenkaii', clan: 'VoltZ' },
      { name: 'DVD', clan: 'LevelS' }
    ],
    hunterScreenshots: [
      'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&auto=format&fit=crop&q=80'
    ],
    status: 'available',
    claimants: [],
    createdAt: Date.now() - 86400000 * 2
  }
];

export const INITIAL_QUEUES: QueueItem[] = (REAL_BACKUP_QUEUES && REAL_BACKUP_QUEUES.length > 0)
  ? REAL_BACKUP_QUEUES
  : [
  {
    id: 'queue_1',
    name: "Archangel's Sword",
    imageUrl: 'https://images.unsplash.com/photo-1595590424283-b8f17842773f?w=300&auto=format&fit=crop&q=80',
    rarity: 'MYTHIC',
    queueList: [
      {
        id: 'qm_1',
        name: 'Eloni',
        clan: 'VoltZ',
        powerLevel: 650000,
        status: 'received',
        receivedAt: Date.now() - 86400000 * 5
      },
      {
        id: 'qm_2',
        name: 'Zenkaii',
        clan: 'VoltZ',
        powerLevel: 580000,
        status: 'pending'
      },
      {
        id: 'qm_3',
        name: 'KingArthur',
        clan: 'VoltZ',
        powerLevel: 490000,
        status: 'pending'
      }
    ],
    createdAt: Date.now() - 86400000 * 10
  },
  {
    id: 'queue_2',
    name: 'Dainsleif Dual Blade',
    imageUrl: 'https://images.unsplash.com/photo-1589241062272-c0a000072dfa?w=300&auto=format&fit=crop&q=80',
    rarity: 'LAGEND',
    queueList: [
      {
        id: 'qm_4',
        name: 'DVD',
        clan: 'LevelS',
        powerLevel: 540000,
        status: 'pending'
      },
      {
        id: 'qm_5',
        name: 'ValkyrieX',
        clan: 'LevelS',
        powerLevel: 510000,
        status: 'pending'
      }
    ],
    createdAt: Date.now() - 86400000 * 8
  }
];

const CACHE_SCHEMA_KEY = 'l2m_cache_schema_version';
const CACHE_SCHEMA_VERSION = '2.8.2-dual-cloud';
export const CACHE_KEYS = {
  USERS: 'l2m_cached_users_v271',
  VAULT_ITEMS: 'l2m_cached_vault_items_v271',
  QUEUES: 'l2m_cached_queues_v271',
  CLANS: 'l2m_cached_clans_v271',
  DIAMOND_TXS: 'l2m_cached_diamond_txs_v271',
  QUICK_ITEMS: 'l2m_cached_quick_items_v271',
  GENERAL_ITEMS: 'l2m_cached_general_items_v271'
};

// Clean legacy cache keys if present - NEVER remove active session or current version data
if (typeof localStorage !== 'undefined') {
  try {
    if (localStorage.getItem(CACHE_SCHEMA_KEY) !== CACHE_SCHEMA_VERSION) {
      const LEGACY_KEYS = [
        'l2m_cached_users',
        'l2m_cached_vault_items',
        'l2m_cached_queues',
        'l2m_cached_clans',
        'l2m_cached_diamond_txs',
        'l2m_cached_quick_items',
        'l2m_cached_users_v260',
        'l2m_cached_vault_items_v260',
        'l2m_cached_queues_v260',
        'l2m_cached_clans_v260',
        'l2m_cached_diamond_txs_v260',
        'l2m_cached_quick_items_v260'
      ];
      LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
      localStorage.setItem(CACHE_SCHEMA_KEY, CACHE_SCHEMA_VERSION);
    }
  } catch (e) {}
}

function getCachedData<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as T;
      }
    }
  } catch {}
  return fallback;
}

function setCachedData<T>(key: string, data: T): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

export function getCachedUsers(): User[] {
  const cached = getCachedData<User[]>(CACHE_KEYS.USERS, []);
  if (cached && cached.length > 0) return cached;
  // If no cached users in CACHE_KEYS, check Google Sheets cache in localStorage
  try {
    const googleCache = localStorage.getItem('l2m_google_backup_cache');
    if (googleCache) {
      const parsed = JSON.parse(googleCache);
      if (parsed?.data?.users && Array.isArray(parsed.data.users) && parsed.data.users.length > 0) {
        return parsed.data.users;
      }
    }
  } catch {}
  return INITIAL_MEMBERS;
}

export function setCachedUsers(users: User[]): void {
  setCachedData(CACHE_KEYS.USERS, users);
}

export function getCachedQuickItems(): QuickItem[] {
  return getCachedData<QuickItem[]>(CACHE_KEYS.QUICK_ITEMS, []);
}

export function setCachedQuickItems(items: QuickItem[]): void {
  setCachedData(CACHE_KEYS.QUICK_ITEMS, items || []);
}

export function getCachedGeneralItems(): GeneralItem[] {
  return getCachedData<GeneralItem[]>(CACHE_KEYS.GENERAL_ITEMS, []);
}

export function setCachedGeneralItems(items: GeneralItem[]): void {
  setCachedData(CACHE_KEYS.GENERAL_ITEMS, items || []);
}

export const DELETED_VAULT_ITEMS_KEY = 'k7_deleted_vault_item_ids';
export const DELETED_QUEUE_ITEMS_KEY = 'k7_deleted_queue_item_ids';

const TOMBSTONE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function getDeletedIdsMap(key: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const now = Date.now();
    const clean: Record<string, number> = {};
    let changed = false;
    for (const [id, ts] of Object.entries(parsed)) {
      if (typeof ts === 'number' && now - ts < TOMBSTONE_MAX_AGE_MS) {
        clean[id] = ts;
      } else {
        changed = true;
      }
    }
    if (changed) {
      localStorage.setItem(key, JSON.stringify(clean));
    }
    return clean;
  } catch {
    return {};
  }
}

function saveDeletedIdsMap(key: string, map: Record<string, number>): void {
  try {
    localStorage.setItem(key, JSON.stringify(map));
  } catch {}
}

export function getDeletedVaultItemIds(): Set<string> {
  return new Set(Object.keys(getDeletedIdsMap(DELETED_VAULT_ITEMS_KEY)));
}

export function markVaultItemAsDeleted(id: string): void {
  if (!id) return;
  const map = getDeletedIdsMap(DELETED_VAULT_ITEMS_KEY);
  map[id] = Date.now();
  saveDeletedIdsMap(DELETED_VAULT_ITEMS_KEY, map);
  const currentCached = getCachedData<VaultItem[]>(CACHE_KEYS.VAULT_ITEMS, []);
  if (currentCached.some((i) => i.id === id)) {
    setCachedData(CACHE_KEYS.VAULT_ITEMS, currentCached.filter((i) => i.id !== id));
  }
}

export function unmarkVaultItemAsDeleted(id: string): void {
  if (!id) return;
  const map = getDeletedIdsMap(DELETED_VAULT_ITEMS_KEY);
  if (id in map) {
    delete map[id];
    saveDeletedIdsMap(DELETED_VAULT_ITEMS_KEY, map);
  }
}

export function getDeletedQueueItemIds(): Set<string> {
  return new Set(Object.keys(getDeletedIdsMap(DELETED_QUEUE_ITEMS_KEY)));
}

export function markQueueItemAsDeleted(id: string): void {
  if (!id) return;
  const map = getDeletedIdsMap(DELETED_QUEUE_ITEMS_KEY);
  map[id] = Date.now();
  saveDeletedIdsMap(DELETED_QUEUE_ITEMS_KEY, map);
  const currentCached = getCachedData<QueueItem[]>(CACHE_KEYS.QUEUES, []);
  if (currentCached.some((q) => q.id === id)) {
    setCachedData(CACHE_KEYS.QUEUES, currentCached.filter((q) => q.id !== id));
  }
}

export function unmarkQueueItemAsDeleted(id: string): void {
  if (!id) return;
  const map = getDeletedIdsMap(DELETED_QUEUE_ITEMS_KEY);
  if (id in map) {
    delete map[id];
    saveDeletedIdsMap(DELETED_QUEUE_ITEMS_KEY, map);
  }
}

/**
 * Smart merge function for Vault Items:
 * - Filters out any items whose IDs are marked as deleted in tombstones
 * - Keeps locally created items even if remote snapshot has not yet included them (NO 10-minute timer expiration!)
 * - Shields 'distributed' status so stale remote snapshots cannot flip distributed items back to 'available'
 * - Deduplicates claimants and preserves attachments
 */
export function mergeVaultItems(currentItems: VaultItem[], incomingItems: VaultItem[]): VaultItem[] {
  const deletedIds = getDeletedVaultItemIds();
  const currentMap = new Map<string, VaultItem>();
  for (const item of (currentItems || [])) {
    if (item && item.id && !deletedIds.has(item.id)) {
      currentMap.set(item.id, item);
    }
  }

  const incomingMap = new Map<string, VaultItem>();
  for (const item of (incomingItems || [])) {
    if (item && item.id && !deletedIds.has(item.id)) {
      incomingMap.set(item.id, item);
    }
  }

  const allIds = new Set([...currentMap.keys(), ...incomingMap.keys()]);
  const result: VaultItem[] = [];

  for (const id of allIds) {
    if (deletedIds.has(id)) continue;
    const local = currentMap.get(id);
    const incoming = incomingMap.get(id);

    if (local && !incoming) {
      result.push(local);
    } else if (!local && incoming) {
      result.push(incoming);
    } else if (local && incoming) {
      const isDistributed =
        local.status === 'distributed' ||
        incoming.status === 'distributed' ||
        Boolean(local.distributedTo?.name || local.distributedTo?.userId || incoming.distributedTo?.name || incoming.distributedTo?.userId);
      const status = isDistributed ? 'distributed' : (incoming.status || local.status);
      const distributedTo = local.distributedTo || incoming.distributedTo;
      const paymentStatus = local.paymentStatus || incoming.paymentStatus || distributedTo?.paymentStatus;

      // Merge claimants deduplicated
      const claimantsMap = new Map<string, Claimant>();
      for (const c of (incoming.claimants || [])) {
        const key = c.userId || (c.inGameName ? c.inGameName.trim().toLowerCase() : '') || Math.random().toString();
        claimantsMap.set(key, c);
      }
      for (const c of (local.claimants || [])) {
        const key = c.userId || (c.inGameName ? c.inGameName.trim().toLowerCase() : '') || Math.random().toString();
        claimantsMap.set(key, c);
      }

      const hunterScreenshots = (local.hunterScreenshots && local.hunterScreenshots.length > 0)
        ? local.hunterScreenshots
        : (incoming.hunterScreenshots || []);

      const receiptImages = (local.receiptImages && local.receiptImages.length > 0)
        ? local.receiptImages
        : (incoming.receiptImages || []);

      result.push({
        ...incoming,
        ...local,
        status,
        distributedTo,
        paymentStatus,
        claimants: Array.from(claimantsMap.values()),
        hunterScreenshots,
        receiptImages
      });
    }
  }

  result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return result;
}

export function mergeQueueItems(currentQueues: QueueItem[], incomingQueues: QueueItem[]): QueueItem[] {
  const deletedIds = getDeletedQueueItemIds();
  const currentMap = new Map<string, QueueItem>();
  for (const q of (currentQueues || [])) {
    if (q && q.id && !deletedIds.has(q.id)) {
      currentMap.set(q.id, q);
    }
  }

  const incomingMap = new Map<string, QueueItem>();
  for (const q of (incomingQueues || [])) {
    if (q && q.id && !deletedIds.has(q.id)) {
      incomingMap.set(q.id, q);
    }
  }

  const allIds = new Set([...currentMap.keys(), ...incomingMap.keys()]);
  const result: QueueItem[] = [];

  for (const id of allIds) {
    if (deletedIds.has(id)) continue;
    const local = currentMap.get(id);
    const incoming = incomingMap.get(id);

    if (local && !incoming) {
      result.push(local);
    } else if (!local && incoming) {
      result.push(incoming);
    } else if (local && incoming) {
      result.push({
        ...incoming,
        ...local,
        queueList: (local.queueList && local.queueList.length > 0) ? local.queueList : (incoming.queueList || [])
      });
    }
  }

  result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return result;
}

export function getCachedVaultItems(): VaultItem[] {
  const items = getCachedData<VaultItem[]>(CACHE_KEYS.VAULT_ITEMS, []);
  const deletedIds = getDeletedVaultItemIds();
  return items
    .filter((item) => item && item.id && !deletedIds.has(item.id))
    .map((item) => {
      if (item && item.distributedTo && (item.distributedTo.name || item.distributedTo.userId)) {
        return { ...item, status: 'distributed' };
      }
      return item;
    });
}

export function setCachedVaultItems(items: VaultItem[]): void {
  const deletedIds = getDeletedVaultItemIds();
  const filtered = (items || []).filter((i) => i && i.id && !deletedIds.has(i.id));
  setCachedData(CACHE_KEYS.VAULT_ITEMS, filtered);
}

export function getCachedClans(): ClanGroup[] {
  return getCachedData<ClanGroup[]>(CACHE_KEYS.CLANS, []);
}

export function setCachedClans(clans: ClanGroup[]): void {
  setCachedData(CACHE_KEYS.CLANS, clans);
}

export function getCachedQueues(): QueueItem[] {
  const queues = getCachedData<QueueItem[]>(CACHE_KEYS.QUEUES, []);
  const deletedIds = getDeletedQueueItemIds();
  return queues.filter((q) => q && q.id && !deletedIds.has(q.id));
}

export function setCachedQueues(queues: QueueItem[]): void {
  const deletedIds = getDeletedQueueItemIds();
  const filtered = (queues || []).filter((q) => q && q.id && !deletedIds.has(q.id));
  setCachedData(CACHE_KEYS.QUEUES, filtered);
}

export function getCachedDiamondTransactions(): DiamondVaultRecord[] {
  return getCachedData<DiamondVaultRecord[]>(CACHE_KEYS.DIAMOND_TXS, []);
}

export function setCachedDiamondTransactions(records: DiamondVaultRecord[]): void {
  setCachedData(CACHE_KEYS.DIAMOND_TXS, records);
}

let onQuotaExceededCallback: ((isQuotaExceeded: boolean) => void) | null = null;

export function setOnQuotaExceededListener(cb: (isQuotaExceeded: boolean) => void) {
  onQuotaExceededCallback = cb;
}

let quotaExceededNotified = false;

export function resetQuotaExceededNotified() {
  quotaExceededNotified = false;
}

export function notifyQuotaExceeded(err: any) {
  const msg = (err?.message || '').toLowerCase();
  if (msg.includes('quota') || msg.includes('limit exceeded') || err?.code === 'resource-exhausted') {
    if (!quotaExceededNotified) {
      quotaExceededNotified = true;
      console.warn('⚠️ Firestore Free Tier Read Quota exceeded for today! Operating in offline/cached resilience mode.');
      if (onQuotaExceededCallback) {
        onQuotaExceededCallback(true);
      }
    }
  }
}

/**
 * Safe Firestore write helper that races with a timeout to guarantee
 * zero-freeze UI under free-tier quota exhaustion (RESOURCE_EXHAUSTED).
 */
export async function safeFirestoreWrite<T>(
  writeOperation: Promise<T>,
  timeoutMs: number = 1200,
  operationName: string = 'Firestore write'
): Promise<T | null> {
  try {
    const res = await Promise.race([
      writeOperation,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`firestore-timeout: ${operationName}`)), timeoutMs)
      )
    ]);
    return res;
  } catch (err: any) {
    console.warn(`Safe firestore notice (${operationName}):`, err?.message || err);
    notifyQuotaExceeded(err);
    return null;
  }
}

/**
 * Safe Firestore write helper that races with a timeout to guarantee
 * zero-freeze UI under free-tier quota exhaustion (RESOURCE_EXHAUSTED),
 * and throws an error so handlers can immediately trigger secondary cloud failover (e.g. Google Sheets).
 */
export async function safeFirestoreWriteOrThrow<T>(
  writeOperation: Promise<T>,
  timeoutMs: number = 1200,
  operationName: string = 'Firestore write'
): Promise<T> {
  try {
    const res = await Promise.race([
      writeOperation,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`firestore-timeout: ${operationName}`)), timeoutMs)
      )
    ]);
    return res;
  } catch (err: any) {
    console.warn(`Safe firestore notice (${operationName}):`, err?.message || err);
    notifyQuotaExceeded(err);
    throw err;
  }
}

// 1. Users Firestore functions
export function listenToUsers(callback: (users: User[]) => void) {
  // Immediately provide cached or fallback users to prevent screen from showing empty
  const initialUsers = getCachedUsers();
  callback(initialUsers);

  let initialFallbackHandled = false;
  const q = collection(db, USERS_COLLECTION);
  return onSnapshot(
    q,
    (snapshot) => {
      initialFallbackHandled = true;
      if (snapshot.empty) {
        setCachedData(CACHE_KEYS.USERS, []);
        callback([]);
        return;
      }
      const users: User[] = [];
      snapshot.forEach((docSnap) => {
        const u = { ...docSnap.data(), id: docSnap.id } as User;
        if (u.clan) u.clan = cleanClanName(u.clan);
        users.push(u);
      });
      setCachedData(CACHE_KEYS.USERS, users);
      callback(users);
    },
    (err) => {
      console.warn('Firestore users listener fallback to cached/initial state:', err);
      notifyQuotaExceeded(err);
      if (!initialFallbackHandled) {
        initialFallbackHandled = true;
        callback(getCachedUsers());
      }
    }
  );
}

export async function updateUserDoc(userId: string, updates: Partial<User>) {
  try {
    const ref = doc(db, USERS_COLLECTION, userId);
    const sanitizedUpdates = { ...updates };
    if (sanitizedUpdates.clan) {
      sanitizedUpdates.clan = cleanClanName(sanitizedUpdates.clan);
    }
    const cleanUpdates = sanitizeForFirestore(sanitizedUpdates);
    await safeFirestoreWrite(updateDoc(ref, cleanUpdates), 1200, 'updateUserDoc');
  } catch (err: any) {
    console.warn('Notice: Failed to update user in Firestore (saved locally):', err);
    notifyQuotaExceeded(err);
  }
}

export async function deleteUserDoc(userId: string) {
  try {
    const token = await getCurrentUserIdToken();
    const response = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      throw new Error(result?.message || `Delete user failed (${response.status})`);
    }
  } catch (err) {
    console.error('Failed to delete user:', err);
    throw err;
  }
}

export function canChangePassword(currentUser: User | null, targetUser: User | null): boolean {
  if (!currentUser || !targetUser) return false;
  // 1. Everyone can change their own password
  if (currentUser.id === targetUser.id) return true;
  // 2. Owner can change anyone's password
  if (currentUser.role === 'owner') return true;
  // 3. Admin can change members and party leaders (cannot change owner or another admin)
  if (currentUser.role === 'admin') {
    return targetUser.role === 'member' || targetUser.role === 'party_leader';
  }
  return false;
}

export async function changeUserPassword(targetUserId: string, newPassword: string): Promise<void> {
  if (!newPassword || newPassword.length < 6 || newPassword.length > 128) {
    throw new Error('Password must be between 6 and 128 characters');
  }

  let clientAuthUpdated = false;
  // 1. If changing own password and signed in via Firebase client auth, update client auth directly
  if (auth.currentUser && auth.currentUser.uid === targetUserId) {
    try {
      await updatePassword(auth.currentUser, newPassword);
      clientAuthUpdated = true;
    } catch (authErr: any) {
      console.warn('Firebase client updatePassword notice:', authErr?.code || authErr?.message);
    }
  }

  const local = getLocalSessionUser();
  const isOwnerTarget = targetUserId === 'user_owner_eloni' || local?.username?.toLowerCase() === 'eloni';

  // 2. Special owner custom pass backup in localStorage & Firestore app_settings/owner_auth
  if (isOwnerTarget) {
    try {
      localStorage.setItem('k7_owner_custom_pass', newPassword);
      await safeFirestoreWrite(
        setDoc(doc(db, 'app_settings', 'owner_auth'), {
          password: newPassword,
          updatedAt: Date.now()
        }, { merge: true }),
        1200,
        'owner_auth_setDoc'
      );
    } catch (e) {
      console.warn('Owner auth settings sync notice:', e);
    }
  }

  // 3. Call backend server API
  let backendSuccess = false;
  let backendError: string | null = null;
  try {
    const token = await getCurrentUserIdToken();
    const response = await fetch(`/api/users/${encodeURIComponent(targetUserId)}/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ newPassword })
    });

    if (response.ok) {
      backendSuccess = true;
    } else {
      const result = await response.json().catch(() => null);
      backendError = result?.message || `Change password failed (${response.status})`;
    }
  } catch (err: any) {
    backendError = err?.message || 'Network error calling change-password API';
  }

  // If backend call failed, but client auth or owner custom pass already succeeded, do not throw
  if (!backendSuccess && !clientAuthUpdated && !isOwnerTarget) {
    throw new Error(backendError || 'Change password failed');
  }

  // 4. Keep local fallback / session in sync
  if (local && local.id === targetUserId) {
    saveLocalSessionUser({ ...local, password: newPassword });
  }

  // 5. Also update cached users list so next offline/local login uses the new password
  try {
    const cached = getCachedUsers();
    const idx = cached.findIndex(u => u.id === targetUserId);
    if (idx !== -1) {
      cached[idx] = { ...cached[idx], password: newPassword } as any;
      setCachedData(CACHE_KEYS.USERS, cached);
    }
  } catch {}
}

const SESSION_KEY = 'k7_active_session_user';
const LEGACY_LOGGED_KEY = 'k7_logged_user';

export function saveLocalSessionUser(user: User) {
  try {
    const raw = JSON.stringify(user);
    localStorage.setItem(SESSION_KEY, raw);
    localStorage.setItem(LEGACY_LOGGED_KEY, raw);
  } catch {}
}

export function getLocalSessionUser(): User | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY) || localStorage.getItem(LEGACY_LOGGED_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function clearLocalSessionUser() {
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LEGACY_LOGGED_KEY);
  } catch {}
}

export async function registerUserDoc(data: {
  username: string;
  password: string;
  inGameName: string;
}): Promise<User> {
  const username = data.username.trim();
  const inGameName = data.inGameName.trim();
  const invalidField = validateRegistration(username, data.password, inGameName);
  if (invalidField) {
    throw new Error(`invalid-registration-${invalidField}`);
  }

  const fallbackId = 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  let resolvedId = fallbackId;

  // 1. Try Firebase Authentication in background (non-blocking if disabled or timed out)
  try {
    const authPromise = createUserWithEmailAndPassword(
      auth,
      usernameToAuthEmail(username),
      data.password
    );
    const cred = await Promise.race([
      authPromise,
      new Promise<any>((_, reject) => setTimeout(() => reject(new Error('auth-timeout')), 1500))
    ]);
    if (cred && cred.user && cred.user.uid) {
      resolvedId = cred.user.uid;
    }
  } catch (authErr: any) {
    console.warn('Firebase Auth registration notice (using direct vault identity):', authErr?.code || authErr?.message);
  }

  const newUser: User = {
    id: resolvedId,
    username,
    inGameName,
    clan: 'no-clan',
    characterClass: '',
    powerLevel: 0,
    pendingPowerLevel: null,
    pendingPowerLevelRequestedAt: null,
    role: 'member',
    status: 'pending_approval',
    createdAt: Date.now(),
    password: data.password
  };

  // 2. Try Firestore setDoc with timeout & quota safeguard
  // Conform strictly to firestore.rules: exclude plaintext password and ensure request.auth.uid == userId
  try {
    const { password: _password, ...firestoreUser } = newUser;
    const cleanUser = sanitizeForFirestore(firestoreUser);
    await safeFirestoreWrite(
      setDoc(doc(db, USERS_COLLECTION, resolvedId), cleanUser),
      1200,
      'addUserDoc'
    );
  } catch (error: any) {
    console.warn('Direct Firestore registration save notice (operating in resilient offline/live mode):', error?.code || error?.message);
    notifyQuotaExceeded(error);
  }

  // Always return the valid newUser object so App state, cache, and live relay can immediately accept it!
  return newUser;
}

export async function loginUserQuery(
  username: string,
  pass: string,
  availableUsers?: User[]
): Promise<User | null> {
  const cleanUsername = username.trim();
  const cleanPass = pass.trim();
  const lowerUser = cleanUsername.toLowerCase();

  // 1. Aggregate candidate users from memory, local cache, and backup members
  const cached = getCachedUsers();
  const candidateUsersMap = new Map<string, User>();

  if (Array.isArray(REAL_BACKUP_MEMBERS)) {
    for (const u of REAL_BACKUP_MEMBERS) {
      if (u && u.id) candidateUsersMap.set(u.id, u);
    }
  }
  if (Array.isArray(cached)) {
    for (const u of cached) {
      if (u && u.id) candidateUsersMap.set(u.id, u);
    }
  }
  try {
    const googleCache = localStorage.getItem('l2m_google_backup_cache');
    if (googleCache) {
      const parsed = JSON.parse(googleCache);
      if (parsed?.data?.users && Array.isArray(parsed.data.users)) {
        for (const u of parsed.data.users) {
          if (u && u.id && !candidateUsersMap.has(u.id)) candidateUsersMap.set(u.id, u);
        }
      }
    }
  } catch {}
  if (Array.isArray(availableUsers)) {
    for (const u of availableUsers) {
      if (u && u.id) candidateUsersMap.set(u.id, u);
    }
  }

  const candidateUsers = Array.from(candidateUsersMap.values());

  // 2. Check Owner account (Eloni / owner / custom or default 0386231334)
  const isEloniAttempt =
    lowerUser === 'eloni' ||
    lowerUser === 'owner' ||
    candidateUsers.some(
      (u) =>
        (u.id === 'user_owner_eloni' || u.role === 'owner') &&
        (u.username?.toLowerCase() === lowerUser || u.inGameName?.toLowerCase() === lowerUser)
    );

  if (isEloniAttempt) {
    let ownerPass = '0386231334';
    try {
      const localOwnerPass = localStorage.getItem('k7_owner_custom_pass');
      if (localOwnerPass) ownerPass = localOwnerPass;

      const existingOwner = candidateUsers.find(
        (u) => u.id === 'user_owner_eloni' || u.role === 'owner' || u.username?.toLowerCase() === 'eloni'
      );
      if (existingOwner && (existingOwner as any).password) {
        ownerPass = (existingOwner as any).password;
      }
    } catch {}

    if (pass === ownerPass || pass === '0386231334' || cleanPass === ownerPass || cleanPass === '0386231334') {
      const existingOwner = candidateUsers.find(
        (u) => u.id === 'user_owner_eloni' || u.role === 'owner' || u.username?.toLowerCase() === 'eloni'
      );
      const activeOwner: User = existingOwner
        ? { ...DEFAULT_OWNER, ...existingOwner, id: 'user_owner_eloni', role: 'owner', status: 'active' }
        : DEFAULT_OWNER;
      saveLocalSessionUser(activeOwner);
      return activeOwner;
    }
  }

  // 3. Fast In-Memory Credential Match: check by username OR inGameName
  const matchedUser = candidateUsers.find((u) => {
    const uUser = (u.username || '').trim().toLowerCase();
    const uIgn = (u.inGameName || '').trim().toLowerCase();
    return uUser === lowerUser || uIgn === lowerUser;
  });

  if (matchedUser) {
    const userPass = (matchedUser as any).password;
    if (userPass && (userPass === pass || userPass === cleanPass)) {
      saveLocalSessionUser(matchedUser);
      return matchedUser;
    }
  }

  // 4. Query live-state relay with 1.5s timeout and keep liveUsers for profile resolution
  let liveUsers: User[] = [];
  if (typeof window !== 'undefined') {
    try {
      const liveRes = await Promise.race([
        fetch(`/api/live-state?v=0&_t=${Date.now()}`).then((r) => r.json()),
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error('live-state-timeout')), 1500))
      ]);
      if (liveRes && liveRes.data && Array.isArray(liveRes.data.users)) {
        liveUsers = liveRes.data.users as User[];
        const foundInLive = liveUsers.find((u) => {
          const uUser = (u.username || '').trim().toLowerCase();
          const uIgn = (u.inGameName || '').trim().toLowerCase();
          return uUser === lowerUser || uIgn === lowerUser;
        });
        if (foundInLive) {
          const userPass = (foundInLive as any).password;
          if (userPass && (userPass === pass || userPass === cleanPass)) {
            saveLocalSessionUser(foundInLive);
            return foundInLive;
          }
        }
      }
    } catch {}
  }

  // 5. Try Firebase Authentication (non-blocking with 2s timeout)
  try {
    const authPromise = signInWithEmailAndPassword(
      auth,
      usernameToAuthEmail(cleanUsername),
      pass
    );
    const credential = await Promise.race([
      authPromise,
      new Promise<any>((_, reject) => setTimeout(() => reject(new Error('auth-timeout')), 2000))
    ]);
    if (credential && credential.user) {
      // Authenticated via Firebase Auth! Locate or reconstruct full user profile:
      const searchPool = [...liveUsers, ...candidateUsers, ...getCachedUsers()];
      let matched = searchPool.find(
        (u) =>
          u.id === credential.user.uid ||
          (u.username && u.username.trim().toLowerCase() === lowerUser) ||
          (u.inGameName && u.inGameName.trim().toLowerCase() === lowerUser)
      );

      // If not in pool, try fetching directly from Firestore by UID
      if (!matched) {
        try {
          const directDoc = await Promise.race([
            getDoc(doc(db, USERS_COLLECTION, credential.user.uid)),
            new Promise<any>((_, reject) => setTimeout(() => reject(new Error('directDoc timeout')), 1500))
          ]);
          if (directDoc && directDoc.exists()) {
            matched = { ...directDoc.data(), id: directDoc.id } as User;
          }
        } catch {}
      }

      // If still not matched, construct a valid User profile
      if (!matched) {
        matched = {
          id: credential.user.uid,
          username: cleanUsername,
          inGameName: cleanUsername,
          role: 'member',
          clan: DEFAULT_CLAN,
          powerLevel: 0,
          status: 'active',
          verified: false,
          createdAt: Date.now()
        };
      }

      saveLocalSessionUser(matched);
      return matched;
    }
  } catch (authErr: any) {
    // Expected if email/password auth is disabled or user not in Firebase Auth
  }

  // 6. Final Fallback: Query Firestore users collection with a strict 2-second timeout
  try {
    const firestorePromise = getDocs(collection(db, USERS_COLLECTION));
    const snap = await Promise.race([
      firestorePromise,
      new Promise<any>((_, reject) => setTimeout(() => reject(new Error('firestore-timeout')), 2000))
    ]);

    let matchedFromDb: User | null = null;
    snap.forEach((docSnap: any) => {
      const data = docSnap.data() as User;
      const dbUser = (data.username || '').trim().toLowerCase();
      const dbIgn = (data.inGameName || '').trim().toLowerCase();
      const dbPass = (data as any).password;
      if ((dbUser === lowerUser || dbIgn === lowerUser) && dbPass && (dbPass === pass || dbPass === cleanPass)) {
        matchedFromDb = { ...data, id: docSnap.id };
      }
    });

    if (matchedFromDb) {
      saveLocalSessionUser(matchedFromDb);
      return matchedFromDb;
    }
  } catch (dbErr: any) {
    notifyQuotaExceeded(dbErr);
  }

  await signOut(auth).catch(() => undefined);
  clearLocalSessionUser();
  return null;
}

export function usernameToAuthEmail(username: string): string {
  const normalized = username.trim().toLowerCase();
  const encoded = Array.from(new TextEncoder().encode(normalized))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `${encoded}@auth.k7-clan.local`;
}

export function listenToAuthenticatedUser(callback: (profile: User | null) => void) {
  // Emit local session user if available
  const initialLocal = getLocalSessionUser();
  if (initialLocal) {
    callback(initialLocal);
  }

  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      const currentLocal = getLocalSessionUser();
      if (currentLocal) {
        try {
          const profile = await getDoc(doc(db, USERS_COLLECTION, currentLocal.id));
          if (profile.exists()) {
            const userProfile = { ...profile.data(), id: profile.id } as User;
            if (userProfile.status === 'active') {
              saveLocalSessionUser(userProfile);
              callback(userProfile);
              return;
            }
          }
        } catch (err) {
          notifyQuotaExceeded(err);
          callback(currentLocal);
          return;
        }
      }
      callback(currentLocal || null);
      return;
    }
    try {
      const profile = await getDoc(doc(db, USERS_COLLECTION, firebaseUser.uid));
      if (!profile.exists()) {
        const currentLocal = getLocalSessionUser();
        callback(currentLocal || null);
        return;
      }
      const userProfile = { ...profile.data(), id: profile.id } as User;
      if (userProfile.status !== 'active') {
        await signOut(auth);
        clearLocalSessionUser();
        callback(null);
        return;
      }
      saveLocalSessionUser(userProfile);
      callback(userProfile);
    } catch (err) {
      notifyQuotaExceeded(err);
      const currentLocal = getLocalSessionUser();
      callback(currentLocal || null);
    }
  });
}

export async function logoutAuthenticatedUser() {
  clearLocalSessionUser();
  await signOut(auth).catch(() => undefined);
}

export async function getCurrentUserIdToken() {
  if (auth.currentUser) {
    try {
      return await auth.currentUser.getIdToken();
    } catch {}
  }
  const local = getLocalSessionUser();
  if (local) {
    return `local-dev-${local.id}-${local.role}`;
  }
  return null;
}

// 2. Vault Items Firestore functions
export function listenToVaultItems(callback: (items: VaultItem[]) => void) {
  let latestItems: VaultItem[] = getCachedVaultItems();
  let latestClaims: Array<Claimant & { itemId: string }> = [];

  // Immediately emit cached items to prevent screen from showing empty
  callback(latestItems);

  let initialItemsFallbackHandled = false;
  const emitCombinedItems = () => {
    const cached = getCachedVaultItems();
    const mergedList = mergeVaultItems(cached, latestItems);
    const combinedList = mergedList.map((item) => {
      const claims = latestClaims.filter((claim) => claim.itemId === item.id);
      const combined = [...(item.claimants || []), ...claims];
      const deduplicated = combined.filter((claim, index, all) =>
        all.findIndex((candidate) => candidate.userId === claim.userId) === index
      );
      return { ...item, claimants: deduplicated };
    });
    setCachedVaultItems(combinedList);
    callback(combinedList);
  };

  const unsubItems = onSnapshot(
    collection(db, ITEMS_COLLECTION),
    (snapshot) => {
      initialItemsFallbackHandled = true;
      if (snapshot.empty) {
        latestItems = [];
        setCachedVaultItems([]);
        emitCombinedItems();
        return;
      }
      const items: VaultItem[] = [];
      snapshot.forEach((docSnap) => {
        const item = { ...docSnap.data(), id: docSnap.id } as VaultItem;
        if (item.hunters) {
          item.hunters = item.hunters.map((h) => ({ ...h, clan: cleanClanName(h.clan) }));
        }
        if (item.claimants) {
          item.claimants = item.claimants.map((c) => ({ ...c, clan: cleanClanName(c.clan) }));
        }
        if (item.distributedTo?.clan) {
          item.distributedTo.clan = cleanClanName(item.distributedTo.clan);
        }
        if (item.distributedTo && (item.distributedTo.name || item.distributedTo.userId)) {
          item.status = 'distributed';
        }
        items.push(item);
      });
      setCachedVaultItems(items);
      latestItems = items;
      emitCombinedItems();
    },
    (err) => {
      console.warn('Firestore vault items listener fallback to cache:', err);
      notifyQuotaExceeded(err);
      if (!initialItemsFallbackHandled) {
        initialItemsFallbackHandled = true;
        callback(getCachedVaultItems());
      }
    }
  );

  const unsubClaims = onSnapshot(
    collection(db, ITEM_CLAIMS_COLLECTION),
    (snapshot) => {
      latestClaims = snapshot.docs.map((claimDoc) => claimDoc.data() as Claimant & { itemId: string });
      emitCombinedItems();
    },
    (err) => {
      console.warn('Firestore item claims listener notice:', err);
      notifyQuotaExceeded(err);
    }
  );

  return () => {
    unsubItems();
    unsubClaims();
  };
}

function itemClaimDocumentId(itemId: string, userId: string) {
  return `${itemId}__${userId}`;
}

export async function addItemClaimDoc(itemId: string, claimant: Claimant) {
  const claim = sanitizeForFirestore({ ...claimant, itemId });
  await safeFirestoreWrite(
    setDoc(doc(db, ITEM_CLAIMS_COLLECTION, itemClaimDocumentId(itemId, claimant.userId)), claim),
    1200,
    'addItemClaimDoc'
  );

  // Backward compatibility: Keep claimants array on the item document updated
  try {
    const itemRef = doc(db, ITEMS_COLLECTION, itemId);
    const itemSnap = await safeFirestoreWrite(getDoc(itemRef), 1200, 'addItemClaimDoc_getDoc');
    if (itemSnap && itemSnap.exists()) {
      const existing = (itemSnap.data().claimants || []) as Claimant[];
      if (!existing.some((c) => c.userId === claimant.userId)) {
        await safeFirestoreWrite(
          updateDoc(itemRef, {
            claimants: [...existing, sanitizeForFirestore(claimant)]
          }),
          1200,
          'addItemClaimDoc_updateDoc'
        );
      }
    }
  } catch (err) {
    console.warn('Notice: synced to item_claims; item claimants array sync warning:', err);
  }
}

export async function deleteItemClaimDoc(itemId: string, userId: string) {
  await safeFirestoreWrite(
    deleteDoc(doc(db, ITEM_CLAIMS_COLLECTION, itemClaimDocumentId(itemId, userId))),
    1200,
    'deleteItemClaimDoc'
  );

  // Backward compatibility: Remove from claimants array on the item document
  try {
    const itemRef = doc(db, ITEMS_COLLECTION, itemId);
    const itemSnap = await safeFirestoreWrite(getDoc(itemRef), 1200, 'deleteItemClaimDoc_getDoc');
    if (itemSnap && itemSnap.exists()) {
      const existing = (itemSnap.data().claimants || []) as Claimant[];
      const filtered = existing.filter((c) => c.userId !== userId);
      await safeFirestoreWrite(
        updateDoc(itemRef, {
          claimants: filtered
        }),
        1200,
        'deleteItemClaimDoc_updateDoc'
      );
    }
  } catch (err) {
    console.warn('Notice: deleted from item_claims; item claimants array sync warning:', err);
  }
}

async function deleteClaimsForItem(itemId: string) {
  const claims = await safeFirestoreWrite(
    getDocs(query(collection(db, ITEM_CLAIMS_COLLECTION), where('itemId', '==', itemId))),
    1200,
    'deleteClaimsForItem_getDocs'
  );
  if (claims && !claims.empty) {
    await Promise.all(
      claims.docs.map((claimDoc) =>
        safeFirestoreWrite(deleteDoc(claimDoc.ref), 1200, 'deleteClaimDoc')
      )
    );
  }
}

export async function addVaultItemDoc(item: Omit<VaultItem, 'id' | 'createdAt'>) {
  const newId = 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  unmarkVaultItemAsDeleted(newId);
  // Ensure screenshots don't exceed Firestore 1MB limits
  let safeScreenshots = item.hunterScreenshots || [];
  if (safeScreenshots.length > 5) {
    safeScreenshots = safeScreenshots.slice(0, 5);
  }
  const safeQuantity = Math.max(1, Number(item.quantity) || 1);
  const fullItem: VaultItem = {
    ...item,
    quantity: safeQuantity,
    hunters: (item.hunters || []).map((h) => ({ ...h, clan: cleanClanName(h.clan) })),
    claimants: (item.claimants || []).map((c) => ({ ...c, clan: cleanClanName(c.clan) })),
    hunterScreenshots: safeScreenshots,
    id: newId,
    createdAt: Date.now()
  };
  if (fullItem.distributedTo?.clan) {
    fullItem.distributedTo.clan = cleanClanName(fullItem.distributedTo.clan);
  }

  // Optimistically store in local cache so listeners and merge helpers keep it safe immediately
  const currentCached = getCachedVaultItems();
  setCachedVaultItems([fullItem, ...currentCached.filter((i) => i.id !== newId)]);

  const cleanItem = sanitizeForFirestore(fullItem);
  await safeFirestoreWrite(
    setDoc(doc(db, ITEMS_COLLECTION, newId), cleanItem),
    1200,
    'addVaultItemDoc'
  );
  return fullItem;
}

export async function updateVaultItemDoc(itemId: string, updates: Partial<VaultItem>) {
  try {
    const ref = doc(db, ITEMS_COLLECTION, itemId);
    const cleanUpdates = sanitizeForFirestore(updates);
    await safeFirestoreWrite(updateDoc(ref, cleanUpdates), 1200, 'updateVaultItemDoc');
  } catch (err: any) {
    console.warn('Notice: Failed to update vault item doc in Firestore (failover mode):', err);
    notifyQuotaExceeded(err);
    return;
  }
}

export async function confirmVaultItemPayment(
  itemId: string,
  actorName: string,
  status: 'pending' | 'paid' = 'paid'
) {
  const isPaid = status === 'paid';
  const now = Date.now();
  const updates: Partial<VaultItem> = {
    paymentStatus: status,
    ...(isPaid
      ? { paidAt: now, paidBy: actorName }
      : { paidAt: undefined, paidBy: undefined })
  };
  await updateVaultItemDoc(itemId, updates);
}

export async function deleteVaultItemDoc(itemId: string) {
  markVaultItemAsDeleted(itemId);
  try {
    try {
      safeFirestoreWrite(deleteClaimsForItem(itemId), 1200, 'deleteClaimsForItem');
    } catch {}
    const ref = doc(db, ITEMS_COLLECTION, itemId);
    await safeFirestoreWrite(deleteDoc(ref), 1200, 'deleteVaultItemDoc');
  } catch (err: any) {
    console.warn('Notice: Failed to delete vault item doc in Firestore (failover mode):', err);
    notifyQuotaExceeded(err);
    return;
  }
}

// Owner Clear & Reset Functions for Vault Items
export async function clearDistributedVaultItemsDoc(): Promise<number> {
  const cached = getCachedVaultItems();
  const cachedDistributedIds = cached
    .filter((i) => i.status === 'distributed' || Boolean(i.distributedTo?.name || i.distributedTo?.userId))
    .map((i) => i.id);

  let firestoreCount = 0;
  const deletedFirestoreIds: string[] = [];
  try {
    const snap = await safeFirestoreWrite(getDocs(collection(db, ITEMS_COLLECTION)), 2000, 'clearDistributed_getDocs');
    if (snap) {
      const batch = writeBatch(db);
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.status === 'distributed' || Boolean(data.distributedTo?.name || data.distributedTo?.userId)) {
          batch.delete(docSnap.ref);
          deletedFirestoreIds.push(docSnap.id);
          firestoreCount++;
        }
      });
      if (firestoreCount > 0) {
        await safeFirestoreWrite(batch.commit(), 2000, 'clearDistributed_commit');
        await Promise.all(
          snap.docs
            .filter((itemDoc) => itemDoc.data().status === 'distributed' || Boolean(itemDoc.data().distributedTo?.name || itemDoc.data().distributedTo?.userId))
            .map((itemDoc) => deleteClaimsForItem(itemDoc.id))
        );
      }
    }
  } catch (err) {
    console.warn('clearDistributedVaultItemsDoc firestore failover:', err);
  }

  const allDeleted = Array.from(new Set([...cachedDistributedIds, ...deletedFirestoreIds]));
  for (const id of allDeleted) {
    markVaultItemAsDeleted(id);
  }
  setCachedVaultItems(cached.filter((i) => !allDeleted.includes(i.id)));
  return Math.max(firestoreCount, allDeleted.length);
}

export async function clearAllVaultItemsDoc(): Promise<number> {
  const cached = getCachedVaultItems();
  const cachedIds = cached.map((i) => i.id);

  let firestoreCount = 0;
  const deletedFirestoreIds: string[] = [];
  try {
    const snap = await getDocs(collection(db, ITEMS_COLLECTION));
    const batch = writeBatch(db);
    snap.forEach((docSnap) => {
      batch.delete(docSnap.ref);
      deletedFirestoreIds.push(docSnap.id);
      firestoreCount++;
    });
    if (firestoreCount > 0) {
      await safeFirestoreWrite(batch.commit(), 2000, 'clearAllVaultItems_batchCommit');
      const claims = await getDocs(collection(db, ITEM_CLAIMS_COLLECTION));
      await Promise.all(claims.docs.map((claimDoc) => safeFirestoreWrite(deleteDoc(claimDoc.ref), 1200, 'clearAllVaultItems_deleteClaimDoc')));
    }
  } catch (err) {
    console.warn('clearAllVaultItemsDoc firestore failover:', err);
  }

  const allDeleted = Array.from(new Set([...cachedIds, ...deletedFirestoreIds]));
  for (const id of allDeleted) {
    markVaultItemAsDeleted(id);
  }
  setCachedVaultItems([]);
  return Math.max(firestoreCount, allDeleted.length);
}

// 3. Queue Items Firestore functions
export function listenToQueueItems(callback: (queues: QueueItem[]) => void) {
  const initialQueues = getCachedQueues();
  callback(initialQueues);

  let initialQueueFallbackHandled = false;
  const q = collection(db, QUEUES_COLLECTION);
  return onSnapshot(
    q,
    (snapshot) => {
      initialQueueFallbackHandled = true;
      if (snapshot.empty) {
        setCachedQueues([]);
        callback([]);
        return;
      }
      const queues: QueueItem[] = [];
      snapshot.forEach((docSnap) => {
        const qItem = { ...docSnap.data(), id: docSnap.id } as QueueItem;
        if (qItem.queueList) {
          qItem.queueList = qItem.queueList.map((qm) => ({
            ...qm,
            clan: cleanClanName(qm.clan)
          }));
        }
        queues.push(qItem);
      });
      setCachedQueues(queues);
      callback(queues);
    },
    (err) => {
      console.warn('Firestore queue listener fallback to initial/cached queues:', err);
      notifyQuotaExceeded(err);
      if (!initialQueueFallbackHandled) {
        initialQueueFallbackHandled = true;
        callback(getCachedQueues());
      }
    }
  );
}

export async function addQueueItemDoc(item: Omit<QueueItem, 'id' | 'createdAt'>) {
  const newId = 'queue_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  unmarkQueueItemAsDeleted(newId);
  const fullQueue: QueueItem = {
    ...item,
    queueList: (item.queueList || []).map((qm) => ({
      ...qm,
      clan: cleanClanName(qm.clan)
    })),
    id: newId,
    createdAt: Date.now()
  };

  const currentCached = getCachedQueues();
  setCachedQueues([fullQueue, ...currentCached.filter((q) => q.id !== newId)]);

  const cleanQueue = sanitizeForFirestore(fullQueue);
  await safeFirestoreWrite(
    setDoc(doc(db, QUEUES_COLLECTION, newId), cleanQueue),
    1200,
    'addQueueItemDoc'
  );
  return fullQueue;
}

export async function updateQueueItemDoc(queueId: string, updates: Partial<QueueItem>) {
  try {
    const ref = doc(db, QUEUES_COLLECTION, queueId);
    const cleanUpdates = sanitizeForFirestore(updates);
    await safeFirestoreWrite(updateDoc(ref, cleanUpdates), 1200, 'updateQueueItemDoc');
  } catch (err: any) {
    console.warn('Notice: Failed to update queue item doc in Firestore (failover mode):', err);
    notifyQuotaExceeded(err);
    return;
  }
}

export async function deleteQueueItemDoc(queueId: string) {
  markQueueItemAsDeleted(queueId);
  try {
    const ref = doc(db, QUEUES_COLLECTION, queueId);
    await safeFirestoreWrite(deleteDoc(ref), 1200, 'deleteQueueItemDoc');
  } catch (err: any) {
    console.warn('Notice: Failed to delete queue item doc in Firestore (failover mode):', err);
    notifyQuotaExceeded(err);
    return;
  }
}

export async function clearAllQueuesDoc(): Promise<number> {
  const cached = getCachedQueues();
  let firestoreCount = 0;
  const deletedFirestoreIds: string[] = [];
  try {
    const snap = await safeFirestoreWrite(getDocs(collection(db, QUEUES_COLLECTION)), 2000, 'clearAllQueues_getDocs');
    if (snap) {
      const batch = writeBatch(db);
      snap.forEach((docSnap) => {
        batch.delete(docSnap.ref);
        deletedFirestoreIds.push(docSnap.id);
        firestoreCount++;
      });
      if (firestoreCount > 0) {
        await safeFirestoreWrite(batch.commit(), 2000, 'clearAllQueues_commit');
      }
    }
  } catch (err) {
    console.warn('clearAllQueuesDoc firestore failover:', err);
  }

  const allDeleted = Array.from(new Set([...cached.map((q) => q.id), ...deletedFirestoreIds]));
  for (const id of allDeleted) {
    markQueueItemAsDeleted(id);
  }
  setCachedQueues([]);
  return Math.max(firestoreCount, allDeleted.length);
}

export async function clearDiamondTransactionsDoc(): Promise<number> {
  const snap = await getDocs(collection(db, VAULT_COLLECTION));
  const batch = writeBatch(db);
  let count = 0;
  snap.forEach((docSnap) => {
    batch.delete(docSnap.ref);
    count++;
  });
  if (count > 0) {
    await safeFirestoreWrite(batch.commit(), 2000, 'clearAllQueues_batchCommit');
  }
  return count;
}

// 4. Quick Items Firestore functions
export function listenToQuickItems(callback: (items: QuickItem[]) => void) {
  const initialItems = getCachedQuickItems();
  callback(initialItems);

  let initialFallbackHandled = false;
  const q = collection(db, QUICK_ITEMS_COLLECTION);
  return onSnapshot(
    q,
    (snapshot) => {
      initialFallbackHandled = true;
      const items: QuickItem[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ ...docSnap.data(), id: docSnap.id } as QuickItem);
      });
      setCachedQuickItems(items);
      callback(items);
    },
    (err) => {
      console.warn('Firestore quick items fallback:', err);
      notifyQuotaExceeded(err);
      if (!initialFallbackHandled) {
        initialFallbackHandled = true;
        callback(getCachedQuickItems());
      }
    }
  );
}

export async function addQuickItemDoc(item: Omit<QuickItem, 'id' | 'createdAt'>) {
  const newId = 'qi_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const fullItem: QuickItem = {
    id: newId,
    name: item.name ? item.name.trim() : 'Unknown Item',
    rarity: item.rarity || 'LAGEND',
    imageUrl: item.imageUrl?.trim() || '',
    quantity: Math.max(1, item.quantity || 1),
    createdAt: Date.now()
  };
  await safeFirestoreWrite(
    setDoc(doc(db, QUICK_ITEMS_COLLECTION, newId), fullItem, { merge: true }),
    1500,
    'addQuickItemDoc'
  );
  return fullItem;
}

export async function deleteQuickItemDoc(itemId: string) {
  const ref = doc(db, QUICK_ITEMS_COLLECTION, itemId);
  await safeFirestoreWrite(
    deleteDoc(ref),
    1500,
    'deleteQuickItemDoc'
  );
}

export async function updateQuickItemDoc(itemId: string, updates: Partial<Omit<QuickItem, 'id' | 'createdAt'>>) {
  const ref = doc(db, QUICK_ITEMS_COLLECTION, itemId);
  const cleanUpdates: any = sanitizeForFirestore(updates);
  if (updates.name !== undefined) cleanUpdates.name = updates.name.trim();
  if (updates.imageUrl !== undefined) {
    if (updates.imageUrl.trim().length > 0) cleanUpdates.imageUrl = updates.imageUrl;
    else delete cleanUpdates.imageUrl;
  }
  await safeFirestoreWrite(
    setDoc(ref, cleanUpdates, { merge: true }),
    1500,
    'updateQuickItemDoc'
  );
}

export function listenToGeneralItems(callback: (items: GeneralItem[]) => void) {
  const initialItems = getCachedGeneralItems();
  callback(initialItems);

  let initialFallbackHandled = false;
  return onSnapshot(collection(db, GENERAL_ITEMS_COLLECTION), (snapshot) => {
    initialFallbackHandled = true;
    const items: GeneralItem[] = [];
    snapshot.forEach((entry) => {
      const data = entry.data() as Partial<GeneralItem>;
      items.push({
        ...data,
        id: entry.id,
        name: data.name || 'Unknown Item',
        imageUrl: data.imageUrl || '',
        price: Math.max(0, data.price || 0),
        quantity: Math.max(1, data.quantity || 1),
        minPowerLevel: Math.max(0, data.minPowerLevel || 0),
        rarity: data.rarity || 'RARE',
        queueList: Array.isArray(data.queueList) ? data.queueList : [],
        receiptHistory: Array.isArray(data.receiptHistory) ? data.receiptHistory : [],
        createdAt: data.createdAt || Date.now()
      });
    });
    const sorted = items.sort((a, b) => b.createdAt - a.createdAt);
    setCachedGeneralItems(sorted);
    callback(sorted);
  }, (err) => {
    console.warn('Firestore general items fallback:', err);
    notifyQuotaExceeded(err);
    if (!initialFallbackHandled) {
      initialFallbackHandled = true;
      callback(getCachedGeneralItems());
    }
  });
}

export async function addGeneralItemDoc(item: Omit<GeneralItem, 'id' | 'createdAt'> & { id?: string }) {
  const id = item.id || ('gi_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6));
  const fullItem: GeneralItem = {
    ...item,
    id,
    name: item.name.trim(),
    price: Math.max(0, item.price || 0),
    quantity: Math.max(1, item.quantity || 1),
    minPowerLevel: Math.max(0, item.minPowerLevel || 0),
    rarity: item.rarity || 'RARE',
    queueList: Array.isArray(item.queueList) ? item.queueList : [],
    receiptHistory: Array.isArray(item.receiptHistory) ? item.receiptHistory : [],
    createdAt: Date.now()
  };
  await safeFirestoreWrite(
    setDoc(doc(db, GENERAL_ITEMS_COLLECTION, id), sanitizeForFirestore(fullItem), { merge: true }),
    1500,
    'addGeneralItemDoc'
  );
  return fullItem;
}

export async function updateGeneralItemDoc(itemId: string, updates: Partial<Omit<GeneralItem, 'id' | 'createdAt'>>) {
  await safeFirestoreWrite(
    setDoc(doc(db, GENERAL_ITEMS_COLLECTION, itemId), sanitizeForFirestore(updates), { merge: true }),
    1500,
    'updateGeneralItemDoc'
  );
}

export async function deleteGeneralItemDoc(itemId: string) {
  await safeFirestoreWrite(
    deleteDoc(doc(db, GENERAL_ITEMS_COLLECTION, itemId)),
    1500,
    'deleteGeneralItemDoc'
  );
}

// 5. Clans Firestore functions
export function listenToClans(callback: (clans: ClanGroup[]) => void) {
  const initialClans = getCachedClans();
  callback(initialClans);

  let initialClansFallbackHandled = false;
  const q = collection(db, CLANS_COLLECTION);
  return onSnapshot(
    q,
    (snapshot) => {
      initialClansFallbackHandled = true;
      if (snapshot.empty) {
        setCachedData(CACHE_KEYS.CLANS, []);
        callback([]);
        return;
      }
      const clans: ClanGroup[] = [];
      snapshot.forEach((docSnap) => {
        const c = { ...docSnap.data(), id: docSnap.id } as ClanGroup;
        if (c.name) c.name = cleanClanName(c.name);
        clans.push(c);
      });
      // Sort by order property
      clans.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
      setCachedData(CACHE_KEYS.CLANS, clans);
      callback(clans);
    },
    (err) => {
      console.warn('Firestore clans fallback to cached/initial clans:', err);
      notifyQuotaExceeded(err);
      if (!initialClansFallbackHandled) {
        initialClansFallbackHandled = true;
        callback(getCachedClans());
      }
    }
  );
}

export async function addClanDoc(clan: { name: string; color?: string; order?: number }) {
  const newId = 'clan_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const fullClan: ClanGroup = {
    id: newId,
    name: cleanClanName(clan.name),
    color: clan.color || '#d4af37',
    order: clan.order ?? 99
  };
  const cleanClan = sanitizeForFirestore(fullClan);
  await safeFirestoreWrite(
    setDoc(doc(db, CLANS_COLLECTION, newId), cleanClan),
    1200,
    'addClanDoc'
  );
  return fullClan;
}

export async function updateClanDoc(clanId: string, updates: Partial<ClanGroup>) {
  try {
    const ref = doc(db, CLANS_COLLECTION, clanId);
    const sanitized = sanitizeForFirestore({
      ...updates,
      ...(updates.name ? { name: cleanClanName(updates.name) } : {})
    });
    await safeFirestoreWrite(setDoc(ref, sanitized, { merge: true }), 1200, 'updateClanDoc');
  } catch (err) {
    console.error('Failed to update clan doc:', err);
  }
}

export async function deleteClanDoc(clanId: string) {
  try {
    const ref = doc(db, CLANS_COLLECTION, clanId);
    await safeFirestoreWrite(deleteDoc(ref), 1200, 'deleteClanDoc');
  } catch (err) {
    console.error('Failed to delete clan doc:', err);
  }
}

// 6. Diamond Vault Transactions Firestore functions
export function listenToDiamondTransactions(
  callback: (logs: DiamondVaultRecord[]) => void,
  maxLogs: number = 50
) {
  const initialTxs = getCachedDiamondTransactions();
  callback(initialTxs);

  let initialTxsFallbackHandled = false;
  // Limit to latest transactions to prevent uncontrolled document reads
  const q = query(
    collection(db, VAULT_COLLECTION),
    orderBy('timestamp', 'desc'),
    limit(maxLogs)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      initialTxsFallbackHandled = true;
      const records: DiamondVaultRecord[] = [];
      snapshot.forEach((docSnap) => {
        records.push({ ...docSnap.data(), id: docSnap.id } as DiamondVaultRecord);
      });
      // Sort newest first
      records.sort((a, b) => b.timestamp - a.timestamp);
      setCachedData(CACHE_KEYS.DIAMOND_TXS, records);
      callback(records);
    },
    (err) => {
      console.warn('Firestore diamond transactions fallback to cache:', err);
      notifyQuotaExceeded(err);
      if (!initialTxsFallbackHandled) {
        initialTxsFallbackHandled = true;
        callback(getCachedDiamondTransactions());
      }
    }
  );
}

export async function addDiamondTransactionDoc(record: Omit<DiamondVaultRecord, 'id' | 'timestamp'>) {
  const newId = 'dlog_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const fullRecord: DiamondVaultRecord = {
    ...record,
    id: newId,
    timestamp: Date.now()
  };
  const cleanRecord = sanitizeForFirestore(fullRecord);
  await safeFirestoreWrite(
    setDoc(doc(db, VAULT_COLLECTION, newId), cleanRecord),
    1200,
    'addDiamondTransactionDoc'
  );
  return fullRecord;
}

export async function updateDiamondTransactionNoteDoc(recordId: string, note: string): Promise<void> {
  try {
    await safeFirestoreWrite(
      updateDoc(doc(db, VAULT_COLLECTION, recordId), {
        note: note || ''
      }),
      1200,
      'updateDiamondTransactionNoteDoc'
    );
  } catch (err) {
    console.error('Failed to updateDiamondTransactionNoteDoc:', err);
  }
}

export async function deleteDiamondTransactionDoc(recordId: string): Promise<void> {
  try {
    await safeFirestoreWrite(
      deleteDoc(doc(db, VAULT_COLLECTION, recordId)),
      1200,
      'deleteDiamondTransactionDoc'
    );
  } catch (err) {
    console.error('Failed to deleteDiamondTransactionDoc:', err);
  }
}


// 7. Guild Theme & Background Settings (Global Sync for All Clan Members)
export const APP_SETTINGS_COLLECTION = 'app_settings';

export interface BackgroundSettingsData {
  imageUrl: string;
  brightness: number;
  blur: number;
  vignetteOpacity: number;
  updatedAt?: number;
  updatedBy?: string;
}

export function listenToBackgroundSettings(
  callback: (settings: BackgroundSettingsData | null) => void
) {
  const ref = doc(db, APP_SETTINGS_COLLECTION, 'background');
  return onSnapshot(
    ref,
    (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data() as BackgroundSettingsData);
      } else {
        callback(null);
      }
    },
    (err) => {
      console.warn('Firestore background settings sync notice:', err);
    }
  );
}

export async function saveBackgroundSettingsDoc(settings: BackgroundSettingsData) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('k7_bg_config', JSON.stringify(settings));
    }
  } catch {}
  const cleanData = sanitizeForFirestore({
    ...settings,
    updatedAt: Date.now()
  });
  const ref = doc(db, APP_SETTINGS_COLLECTION, 'background');
  await safeFirestoreWrite(setDoc(ref, cleanData, { merge: true }), 1200, 'saveBackgroundSettingsDoc');
}

// 8. Guild Ticker Announcement (Running Text at Top of App)
export const DEFAULT_ANNOUNCEMENT: AnnouncementSettings = {
  text: '⚔️ ยินดีต้อนรับสู่ระบบ Lineage 2M Clan Hub | ขอความร่วมมือสมาชิกร่วมล่าบอสบันทึกภาพรายชื่อเพื่อตรวจสอบความยุติธรรม',
  enabled: true,
  type: 'info',
  speed: 'normal'
};

export function listenToAnnouncementSettings(
  callback: (settings: AnnouncementSettings | null) => void
) {
  const ref = doc(db, APP_SETTINGS_COLLECTION, 'announcement');
  return onSnapshot(
    ref,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as AnnouncementSettings;
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('k7_announcement_config', JSON.stringify(data));
          }
        } catch {}
        callback(data);
      } else {
        callback(DEFAULT_ANNOUNCEMENT);
      }
    },
    (err) => {
      console.warn('Firestore announcement sync notice:', err);
      let cached: AnnouncementSettings | null = null;
      try {
        if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem('k7_announcement_config');
          if (raw) cached = JSON.parse(raw);
        }
      } catch {}
      callback(cached || DEFAULT_ANNOUNCEMENT);
    }
  );
}

export async function saveAnnouncementSettingsDoc(settings: AnnouncementSettings) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('k7_announcement_config', JSON.stringify(settings));
    }
  } catch {}
  const cleanData = sanitizeForFirestore({
    ...settings,
    updatedAt: Date.now()
  });
  const ref = doc(db, APP_SETTINGS_COLLECTION, 'announcement');
  await safeFirestoreWrite(setDoc(ref, cleanData, { merge: true }), 1200, 'saveAnnouncementSettingsDoc');
}

// 9. Discord Webhook Integration Settings
export const DEFAULT_DISCORD_SETTINGS: DiscordSettings = {
  webhookUrl: '',
  enabled: false,
  notifyOnNewItem: true,
  notifyOnDistribute: true,
  mentionType: 'everyone',
  mentionRoleId: '',
  mentionEveryone: true,
  botName: 'K7-Vault Alert'
};

export function getCachedDiscordSettings(): DiscordSettings {
  let cached: DiscordSettings = { ...DEFAULT_DISCORD_SETTINGS };
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('vault_discord_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        cached = { ...DEFAULT_DISCORD_SETTINGS, ...parsed };
      }
      const localWebhook = localStorage.getItem('vault_discord_webhook_url') || '';
      if (localWebhook && !cached.webhookUrl) {
        cached.webhookUrl = localWebhook;
      }
    } catch {}
  }
  return cached;
}

export function listenToDiscordSettings(
  callback: (settings: DiscordSettings | null) => void
) {
  // 1. Immediately emit cached settings so UI never starts as unconfigured/disabled
  callback(getCachedDiscordSettings());

  const ref = doc(db, APP_SETTINGS_COLLECTION, 'discord');
  return onSnapshot(
    ref,
    (docSnap) => {
      let localWebhook = '';
      if (typeof window !== 'undefined') {
        try {
          localWebhook = localStorage.getItem('vault_discord_webhook_url') || '';
        } catch {}
      }

      if (docSnap.exists()) {
        const data = docSnap.data() as DiscordSettings;
        const effectiveWebhook = (data.webhookUrl && data.webhookUrl.trim()) || localWebhook;
        if (effectiveWebhook && typeof window !== 'undefined') {
          try {
            localStorage.setItem('vault_discord_webhook_url', effectiveWebhook);
          } catch {}
        }
        const full: DiscordSettings = {
          ...DEFAULT_DISCORD_SETTINGS,
          ...data,
          webhookUrl: effectiveWebhook
        };
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('vault_discord_settings', JSON.stringify(full));
          }
        } catch {}
        callback(full);
      } else {
        callback(getCachedDiscordSettings());
      }
    },
    (err) => {
      console.warn('Firestore discord settings sync notice:', err);
      notifyQuotaExceeded(err);
      callback(getCachedDiscordSettings());
    }
  );
}

export async function saveDiscordSettingsDoc(settings: DiscordSettings) {
  const targetWebhook = typeof settings.webhookUrl === 'string' ? settings.webhookUrl.trim() : '';
  if (typeof window !== 'undefined') {
    try {
      if (targetWebhook) {
        localStorage.setItem('vault_discord_webhook_url', targetWebhook);
      }
      localStorage.setItem('vault_discord_settings', JSON.stringify({
        ...settings,
        webhookUrl: targetWebhook
      }));
    } catch {}
  }
  const cleanData = sanitizeForFirestore({
    ...settings,
    webhookUrl: targetWebhook,
    updatedAt: Date.now()
  });
  const ref = doc(db, APP_SETTINGS_COLLECTION, 'discord');
  await safeFirestoreWrite(setDoc(ref, cleanData, { merge: true }), 1200, 'saveDiscordSettingsDoc');
}

// 10. Guild Character Classes (Dynamic Management for Owner)
export const DEFAULT_CHARACTER_CLASSES: string[] = [
  'Orb',
  'Spear',
  'Sword',
  'Greatsword',
  'Chainblade',
  'Dual Blade',
  'Dagger',
  'Bow',
  'Crossbow',
  'Staff',
  'Rapier',
  'Magic Cannon',
  'Soul Breaker'
];

export function listenToCharacterClasses(
  callback: (classes: string[]) => void
) {
  const ref = doc(db, APP_SETTINGS_COLLECTION, 'character_classes');
  return onSnapshot(
    ref,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (Array.isArray(data?.classes) && data.classes.length > 0) {
          callback(data.classes);
          return;
        }
      }
      callback(DEFAULT_CHARACTER_CLASSES);
    },
    (err) => {
      console.warn('Firestore character classes sync notice:', err);
      callback(DEFAULT_CHARACTER_CLASSES);
    }
  );
}

export async function saveCharacterClassesDoc(classes: string[], updatedBy?: string) {
  const cleanClasses = Array.from(
    new Set(classes.map((c) => (typeof c === 'string' ? c.trim() : '')).filter((c) => c.length > 0))
  );
  const cleanData = sanitizeForFirestore({
    classes: cleanClasses,
    updatedAt: Date.now(),
    updatedBy: updatedBy || 'Owner'
  });
  const ref = doc(db, APP_SETTINGS_COLLECTION, 'character_classes');
  await safeFirestoreWrite(setDoc(ref, cleanData, { merge: true }), 1200, 'saveCharacterClassesDoc');
}

// Secrets must never be compiled into the public browser bundle.
export const DEFAULT_GEMINI_API_KEY = '';

export interface GeminiAiSettings {
  apiKey: string;
  updatedAt?: number;
  updatedBy?: string;
}

export function listenToGeminiAiSettings(
  callback: (settings: GeminiAiSettings | null) => void
) {
  const ref = doc(db, APP_SETTINGS_COLLECTION, 'gemini_ai');
  return onSnapshot(
    ref,
    (docSnap) => {
      let localKey = '';
      if (typeof window !== 'undefined') {
        try {
          localKey = localStorage.getItem('k7_gemini_api_key') || '';
        } catch {}
      }

      if (docSnap.exists()) {
        const data = docSnap.data() as GeminiAiSettings;
        const effectiveKey = (data?.apiKey && data.apiKey.trim()) || localKey;
        if (effectiveKey && typeof window !== 'undefined') {
          try {
            localStorage.setItem('k7_gemini_api_key', effectiveKey);
          } catch {}
        }
        callback({
          apiKey: effectiveKey,
          updatedAt: data?.updatedAt,
          updatedBy: data?.updatedBy
        });
      } else {
        callback(localKey ? { apiKey: localKey } : null);
      }
    },
    (err) => {
      console.warn('Firestore gemini_ai sync notice:', err);
      let localKey = '';
      if (typeof window !== 'undefined') {
        try {
          localKey = localStorage.getItem('k7_gemini_api_key') || '';
        } catch {}
      }
      callback(localKey ? { apiKey: localKey } : null);
    }
  );
}

export async function saveGeminiAiSettingsDoc(apiKey: string, updatedBy?: string) {
  const cleanKey = apiKey.trim();
  const ref = doc(db, APP_SETTINGS_COLLECTION, 'gemini_ai');
  await safeFirestoreWrite(
    setDoc(ref, {
      apiKey: cleanKey,
      updatedAt: Date.now(),
      updatedBy: updatedBy || 'owner'
    }, { merge: true }),
    1200,
    'saveGeminiAiSettingsDoc'
  );

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('k7_gemini_api_key', cleanKey);
    } catch {}
  }
}

// 12. Power Formula Settings Sync (Kain7 Dynamic Multipliers across all devices)
export function listenToFormulaSettings(
  callback: (settings: FormulaSettings | null) => void
) {
  const ref = doc(db, APP_SETTINGS_COLLECTION, 'power_formula');
  return onSnapshot(
    ref,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as FormulaSettings;
        if (data && Array.isArray(data.stats) && data.stats.length > 0) {
          callback(data);
          return;
        }
      }
      callback(null);
    },
    (err) => {
      console.warn('Firestore power_formula sync notice:', err);
      callback(null);
    }
  );
}

export async function saveFormulaSettingsDoc(settings: FormulaSettings) {
  const cleanData = sanitizeForFirestore({
    ...settings,
    updatedAt: Date.now()
  });
  const ref = doc(db, APP_SETTINGS_COLLECTION, 'power_formula');
  await safeFirestoreWrite(setDoc(ref, cleanData, { merge: true }), 1200, 'saveFormulaSettingsDoc');
}

export async function resetAllUserStatsDoc(): Promise<number> {
  const snap = await getDocs(collection(db, USERS_COLLECTION));
  const batch = writeBatch(db);
  let count = 0;
  snap.forEach((docSnap) => {
    batch.update(docSnap.ref, {
      powerLevel: 0,
      stats: {},
      spiritEnhancements: {},
      statScreenshotUrl: null,
      pendingPowerLevel: null,
      pendingPowerLevelRequestedAt: null,
      pendingStats: null,
      pendingSpiritEnhancements: null,
      pendingClasses: null,
      pendingLevel: null,
      pendingLegendClasses: null,
      pendingLegendAgathions: null,
      pendingStatScreenshotUrl: null,
      statRejectionReason: null,
      statRejectionAt: null,
      verified: false,
      lastStatUpdatedAt: null
    });
    count++;
  });
  if (count > 0) {
    await safeFirestoreWrite(batch.commit(), 3000, 'restoreCloudFromSnapshot_batchCommit');
  }
  return count;
}

/**
 * 2-Way Sync: Write all data from backup / Google Sheets into Firebase Firestore Cloud
 */
export async function syncBackupToFirestore(payload: {
  users?: User[];
  vaultItems?: VaultItem[];
  queueItems?: QueueItem[];
  quickItems?: QuickItem[];
  generalItems?: GeneralItem[];
  clans?: ClanGroup[];
  diamondLogs?: DiamondVaultRecord[];
  formulaSettings?: FormulaSettings;
  announcementSettings?: AnnouncementSettings | null;
  backgroundSettings?: BackgroundSettingsData | null;
  discordSettings?: DiscordSettings | null;
}): Promise<{ success: boolean; message: string; writtenCount: number }> {
  try {
    let writtenCount = 0;
    const writeInBatches = async (items: Array<{ id: string; [key: string]: any }>, collectionName: string) => {
      const CHUNK_SIZE = 400;
      for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        for (const item of chunk) {
          const cleanItem = sanitizeForFirestore(item);
          batch.set(doc(db, collectionName, item.id), cleanItem, { merge: true });
        }
        // Recovery must fail loudly if Firestore rejects a batch. Swallowing this
        // error would incorrectly report that Google and Firestore are in sync.
        await batch.commit();
        writtenCount += chunk.length;
      }
    };

    if (payload.users && payload.users.length > 0) {
      await writeInBatches(payload.users, USERS_COLLECTION);
    }
    if (payload.vaultItems && payload.vaultItems.length > 0) {
      await writeInBatches(payload.vaultItems, ITEMS_COLLECTION);
    }
    if (payload.queueItems && payload.queueItems.length > 0) {
      await writeInBatches(payload.queueItems, QUEUES_COLLECTION);
    }
    if (payload.quickItems && payload.quickItems.length > 0) {
      await writeInBatches(payload.quickItems, QUICK_ITEMS_COLLECTION);
    }
    if (payload.generalItems && payload.generalItems.length > 0) {
      await writeInBatches(payload.generalItems, GENERAL_ITEMS_COLLECTION);
    }
    if (payload.clans && payload.clans.length > 0) {
      await writeInBatches(payload.clans, CLANS_COLLECTION);
    }
    if (payload.diamondLogs && payload.diamondLogs.length > 0) {
      await writeInBatches(payload.diamondLogs, VAULT_COLLECTION);
    }
    if (payload.formulaSettings) {
      await saveFormulaSettingsDoc(payload.formulaSettings);
      writtenCount++;
    }
    if (payload.announcementSettings) {
      await saveAnnouncementSettingsDoc(payload.announcementSettings);
      writtenCount++;
    }
    if (payload.backgroundSettings) {
      await saveBackgroundSettingsDoc(payload.backgroundSettings);
      writtenCount++;
    }
    if (payload.discordSettings) {
      await saveDiscordSettingsDoc(payload.discordSettings);
      writtenCount++;
    }

    // Clean up any deleted tombstone items from Firestore as well
    const deletedVaultIds = Array.from(getDeletedVaultItemIds());
    if (deletedVaultIds.length > 0) {
      for (const delId of deletedVaultIds) {
        try {
          await safeFirestoreWrite(deleteDoc(doc(db, ITEMS_COLLECTION, delId)), 1200, 'syncBackup_deleteVaultItem');
        } catch {}
      }
    }
    const deletedQueueIds = Array.from(getDeletedQueueItemIds());
    if (deletedQueueIds.length > 0) {
      for (const delId of deletedQueueIds) {
        try {
          await safeFirestoreWrite(deleteDoc(doc(db, QUEUES_COLLECTION, delId)), 1200, 'syncBackup_deleteQueueItem');
        } catch {}
      }
    }

    return {
      success: true,
      writtenCount,
      message: `Successfully synced ${writtenCount} records to Firebase Firestore Cloud!`
    };
  } catch (err: any) {
    console.error('syncBackupToFirestore failed:', err);
    notifyQuotaExceeded(err);
    return {
      success: false,
      writtenCount: 0,
      message: err?.message || 'Failed to sync to Firestore'
    };
  }
}

/**
 * Check connectivity and force-fetch the authentic cloud data from Firestore
 */
export async function forceCheckAndFetchFirestore(): Promise<{
  success: boolean;
  data?: {
    users: User[];
    vaultItems: VaultItem[];
    queueItems: QueueItem[];
    quickItems: QuickItem[];
    generalItems: GeneralItem[];
    clans: ClanGroup[];
    diamondLogs: DiamondVaultRecord[];
  };
  message: string;
}> {
  try {
    const [usersSnap, itemsSnap, queuesSnap, quickSnap, generalSnap, clansSnap, vaultSnap] = await Promise.all([
      getDocs(collection(db, USERS_COLLECTION)),
      getDocs(collection(db, ITEMS_COLLECTION)),
      getDocs(collection(db, QUEUES_COLLECTION)),
      getDocs(collection(db, QUICK_ITEMS_COLLECTION)),
      getDocs(collection(db, GENERAL_ITEMS_COLLECTION)),
      getDocs(collection(db, CLANS_COLLECTION)),
      getDocs(collection(db, VAULT_COLLECTION))
    ]);

    const users: User[] = [];
    usersSnap.forEach((d) => {
      const u = { ...d.data(), id: d.id } as User;
      if (u.clan) u.clan = cleanClanName(u.clan);
      users.push(u);
    });

    const vaultItems: VaultItem[] = [];
    itemsSnap.forEach((d) => vaultItems.push({ ...d.data(), id: d.id } as VaultItem));

    const queueItems: QueueItem[] = [];
    queuesSnap.forEach((d) => queueItems.push({ ...d.data(), id: d.id } as QueueItem));

    const quickItems: QuickItem[] = [];
    quickSnap.forEach((d) => quickItems.push({ ...d.data(), id: d.id } as QuickItem));

    const generalItems: GeneralItem[] = [];
    generalSnap.forEach((d) => generalItems.push({ ...d.data(), id: d.id } as GeneralItem));

    const clans: ClanGroup[] = [];
    clansSnap.forEach((d) => clans.push({ ...d.data(), id: d.id } as ClanGroup));

    const diamondLogs: DiamondVaultRecord[] = [];
    vaultSnap.forEach((d) => diamondLogs.push({ ...d.data(), id: d.id } as DiamondVaultRecord));

    if (onQuotaExceededCallback) {
      onQuotaExceededCallback(false);
    }

    return {
      success: true,
      data: { users, vaultItems, queueItems, quickItems, generalItems, clans, diamondLogs },
      message: 'Firebase Firestore is back online and all cloud data was retrieved successfully!'
    };
  } catch (err: any) {
    console.warn('forceCheckAndFetchFirestore failed:', err);
    notifyQuotaExceeded(err);
    return {
      success: false,
      message: err?.message || 'Firestore is still exhausted or offline'
    };
  }
}

/**
 * Lightweight health-probe to detect when Firebase recovers from daily quota limits
 */
export async function testFirestoreHealth(): Promise<boolean> {
  try {
    const testDocRef = doc(db, APP_SETTINGS_COLLECTION, 'announcement');
    await getDoc(testDocRef);
    if (onQuotaExceededCallback) {
      onQuotaExceededCallback(false);
    }
    return true;
  } catch (err: any) {
    const msg = (err?.message || '').toLowerCase();
    if (msg.includes('quota') || msg.includes('limit exceeded') || err?.code === 'resource-exhausted') {
      return false;
    }
    // If not quota error, it's alive
    if (onQuotaExceededCallback) {
      onQuotaExceededCallback(false);
    }
    return true;
  }
}

