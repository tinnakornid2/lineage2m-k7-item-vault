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
import { calculateDiamondNetChange } from '../utils/diamondHelper';
import {
  User,
  VaultItem,
  Claimant,
  QuickItem,
  GeneralItem,
  GeneralItemReceipt,
  QueueItem,
  QueueMember,
  DiamondVault,
  DiamondVaultRecord,
  ClanGroup,
  AnnouncementSettings,
  QueueAnnouncementSettings,
  DiscordSettings,
  StatUpdateSettings,
  DEFAULT_STAT_UPDATE_SETTINGS,
  FormulaSettings,
  cleanClanName,
  DEFAULT_CLAN,
  isItemDistributed,
  normalizeDistributedItem
} from '../types';
// Production data comes primarily from Firebase Firestore with Google Sheets & Live Relay dual-write resilience (v2.10.1)
const REAL_BACKUP_MEMBERS: User[] = [];
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

export const INITIAL_MEMBERS: User[] = [DEFAULT_OWNER];

export const INITIAL_CLANS: ClanGroup[] = [
  { id: 'clan_voltz', name: 'VoltZ', color: '#22c55e', order: 0, enabled: true }
];

export const INITIAL_QUICK_ITEMS: QuickItem[] = [];

export const INITIAL_VAULT_ITEMS: VaultItem[] = [];

export const INITIAL_QUEUES: QueueItem[] = [];

/**
 * Robust numeric parser that guarantees a finite number.
 * Safely handles undefined, null, "", "abc", NaN, and Infinity.
 */
export function toFiniteNumber(val: any, fallback: number = 0): number {
  if (val === null || val === undefined || val === '') return fallback;
  const num = typeof val === 'number' ? val : Number(val);
  return Number.isFinite(num) ? num : fallback;
}

export function sanitizeVaultItem<T extends Partial<VaultItem>>(item: T): VaultItem {
  if (!item) return item as any;
  const anyItem = item as any;
  return {
    ...item,
    id: anyItem.id || `item_${Date.now()}`,
    name: anyItem.name || 'Unnamed Item',
    imageUrl: anyItem.imageUrl || '',
    price: toFiniteNumber(anyItem.price, 0),
    minPowerLevel: toFiniteNumber(anyItem.minPowerLevel, 0),
    rarity: anyItem.rarity || 'RARE',
    quantity: Math.max(1, toFiniteNumber(anyItem.quantity, 1)),
    hunters: Array.isArray(anyItem.hunters) ? anyItem.hunters : [],
    hunterScreenshots: Array.isArray(anyItem.hunterScreenshots) ? anyItem.hunterScreenshots : [],
    status: anyItem.status === 'distributed' ? 'distributed' : 'available',
    claimants: Array.isArray(anyItem.claimants)
      ? anyItem.claimants.map((c: any) => ({
          ...c,
          claimedAt: toFiniteNumber(c?.claimedAt, 0),
          powerLevel: toFiniteNumber(c?.powerLevel, 0)
        }))
      : [],
    distributedTo: anyItem.distributedTo,
    receiptImages: Array.isArray(anyItem.receiptImages) ? anyItem.receiptImages : [],
    paymentStatus: anyItem.paymentStatus || 'pending',
    createdAt: toFiniteNumber(anyItem.createdAt, Date.now()),
    updatedAt: anyItem.updatedAt !== undefined && anyItem.updatedAt !== null
      ? toFiniteNumber(anyItem.updatedAt, undefined as any)
      : undefined
  } as VaultItem;
}

export function sanitizeUser<T extends Partial<User>>(user: T): User {
  if (!user) return user as any;
  const anyUser = user as any;
  return {
    ...user,
    id: anyUser.id || `user_${Date.now()}`,
    username: anyUser.username || '',
    inGameName: anyUser.inGameName || '',
    clan: anyUser.clan || '',
    role: anyUser.role || 'member',
    powerLevel: toFiniteNumber(anyUser.powerLevel, 0),
    level: toFiniteNumber(anyUser.level, 0),
    characterClass: anyUser.characterClass || '',
    classes: Array.isArray(anyUser.classes) ? anyUser.classes : [],
    legendClasses: Array.isArray(anyUser.legendClasses) ? anyUser.legendClasses : [],
    legendAgathions: Array.isArray(anyUser.legendAgathions) ? anyUser.legendAgathions : [],
    status: anyUser.status || 'active',
    verified: Boolean(anyUser.verified),
    createdAt: toFiniteNumber(anyUser.createdAt, Date.now())
  } as User;
}

export function sanitizeGeneralItem<T extends Partial<GeneralItem>>(item: T): GeneralItem {
  if (!item) return item as any;
  const anyItem = item as any;
  return {
    ...item,
    id: anyItem.id || `gen_${Date.now()}`,
    name: anyItem.name || 'General Item',
    price: toFiniteNumber(anyItem.price, 0),
    minPowerLevel: toFiniteNumber(anyItem.minPowerLevel, 0),
    quantity: Math.max(0, toFiniteNumber(anyItem.quantity, 0)),
    rarity: anyItem.rarity || 'RARE',
    category: anyItem.category || 'other',
    order: toFiniteNumber(anyItem.order, 0),
    active: anyItem.active !== false
  } as GeneralItem;
}

const CACHE_SCHEMA_KEY = 'l2m_cache_schema_version';
const CACHE_SCHEMA_VERSION = '2.10.20-bundled-seed-secret-sanitization';
export const CACHE_KEYS = {
  USERS: 'l2m_cached_users_v271',
  VAULT_ITEMS: 'l2m_cached_vault_items_v271',
  QUEUES: 'l2m_cached_queues_v271',
  CLANS: 'l2m_cached_clans_v271',
  DIAMOND_TXS: 'l2m_cached_diamond_txs_v271',
  QUICK_ITEMS: 'l2m_cached_quick_items_v271',
  GENERAL_ITEMS: 'l2m_cached_general_items_v271'
};

export function clearAllLocalCaches(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    Object.values(CACHE_KEYS).forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem('l2m_active_tab');
    localStorage.removeItem(DELETED_VAULT_ITEMS_KEY);
    localStorage.removeItem(DELETED_QUEUE_ITEMS_KEY);
    localStorage.removeItem(DELETED_USERS_KEY);
    localStorage.removeItem(DELETED_GENERAL_ITEMS_KEY);
    localStorage.removeItem('l2m_cancelled_claims_map');
    localStorage.removeItem('k7_queue_announcement');
  } catch (e) {
    console.warn('clearAllLocalCaches error:', e);
  }
}

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
        'l2m_cached_quick_items_v260',
        'l2m_active_tab'
      ];
      LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));

      // Resilient inline sanitization for current v271 caches
      try {
        const rawVault = localStorage.getItem(CACHE_KEYS.VAULT_ITEMS);
        if (rawVault) {
          const parsed = JSON.parse(rawVault);
          if (Array.isArray(parsed)) {
            const sanitized = parsed.map((i: any) => sanitizeVaultItem(i));
            localStorage.setItem(CACHE_KEYS.VAULT_ITEMS, JSON.stringify(sanitized));
          }
        }
      } catch {}

      try {
        const rawUsers = localStorage.getItem(CACHE_KEYS.USERS);
        if (rawUsers) {
          const parsed = JSON.parse(rawUsers);
          if (Array.isArray(parsed)) {
            const sanitized = parsed.map((u: any) => sanitizeUser(u));
            localStorage.setItem(CACHE_KEYS.USERS, JSON.stringify(sanitized));
          }
        }
      } catch {}

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

// Resilient Hybrid In-Memory + LocalStorage Collections (Survives F5 Reloads & Zero-Downtime)
let inMemoryVaultItems: VaultItem[] = [];
let inMemoryQueues: QueueItem[] = [];
let inMemoryUsers: User[] = [];
let inMemoryClans: ClanGroup[] = [];
let inMemoryDiamondTxs: DiamondVaultRecord[] = [];
let inMemoryQuickItems: QuickItem[] = [];
let inMemoryGeneralItems: GeneralItem[] = [];

export const DELETED_VAULT_ITEMS_KEY = 'k7_deleted_vault_item_ids';
export const DELETED_QUEUE_ITEMS_KEY = 'k7_deleted_queue_item_ids';
export const DELETED_USERS_KEY = 'k7_deleted_user_ids';
export const DELETED_GENERAL_ITEMS_KEY = 'k7_deleted_general_item_ids';
export const REMOVED_QUEUE_MEMBERS_KEY = 'k7_removed_queue_members';

const TOMBSTONE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

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

export function getDeletedUserIds(): Set<string> {
  return new Set(Object.keys(getDeletedIdsMap(DELETED_USERS_KEY)));
}

/**
 * Persist tombstones to Firestore cloud storage so ALL clients (and cold starts)
 * permanently recognize deleted users, vault items, general items, and queue members.
 */
export async function syncTombstoneToFirestore(
  field: 'deletedUsers' | 'deletedVaultItems' | 'deletedGeneralItems' | 'deletedQueueItems' | 'removedQueueMembers' | 'cancelledClaims',
  map: Record<string, number>
): Promise<void> {
  // Durable cloud tombstones on system/tombstones are written authoritatively via backend Admin SDK endpoints.
  // Client SDK direct writes are restricted by security rules. Client maintains local storage persistence.
}

export function applyIncomingCloudTombstones(cloudData: any): void {
  if (!cloudData || typeof cloudData !== 'object') return;
  const mapping: Record<string, string> = {
    deletedUsers: DELETED_USERS_KEY,
    deletedVaultItems: DELETED_VAULT_ITEMS_KEY,
    deletedGeneralItems: DELETED_GENERAL_ITEMS_KEY,
    deletedQueueItems: DELETED_QUEUE_ITEMS_KEY,
    removedQueueMembers: REMOVED_QUEUE_MEMBERS_KEY,
    cancelledClaims: 'l2m_cancelled_claims_map'
  };

  for (const [cloudKey, storageKey] of Object.entries(mapping)) {
    const cloudMap = cloudData[cloudKey];
    if (cloudMap && typeof cloudMap === 'object') {
      const local = getDeletedIdsMap(storageKey);
      let changed = false;
      for (const [id, ts] of Object.entries(cloudMap)) {
        if (typeof ts === 'number' && ts > (local[id] || 0)) {
          local[id] = ts;
          changed = true;
        }
      }
      if (changed) {
        saveDeletedIdsMap(storageKey, local);
      }
    }
  }

  // Instantly purge matching items from cache
  const deletedUsers = getDeletedIdsMap(DELETED_USERS_KEY);
  inMemoryUsers = inMemoryUsers.filter((u) => !u || !u.id || (u.id !== 'user_owner_eloni' && !deletedUsers[u.id]));
  setCachedData(CACHE_KEYS.USERS, inMemoryUsers);

  const deletedVault = getDeletedIdsMap(DELETED_VAULT_ITEMS_KEY);
  inMemoryVaultItems = inMemoryVaultItems
    .filter((i) => !i || !i.id || !deletedVault[i.id])
    .map((vi) => {
      if (!vi.claimants || vi.claimants.length === 0) return vi;
      const filtered = vi.claimants.filter((c) => !isClaimCancelled(vi.id, c));
      return filtered.length !== vi.claimants.length ? { ...vi, claimants: filtered } : vi;
    });
  setCachedData(CACHE_KEYS.VAULT_ITEMS, inMemoryVaultItems);

  const deletedGeneral = getDeletedIdsMap(DELETED_GENERAL_ITEMS_KEY);
  inMemoryGeneralItems = inMemoryGeneralItems
    .filter((i) => !i || !i.id || !deletedGeneral[i.id])
    .map((gi) => {
      if (!gi.queueList || gi.queueList.length === 0) return gi;
      const filtered = gi.queueList.filter((m) => !isQueueMemberRemoved(gi.id, m));
      return filtered.length !== gi.queueList.length ? { ...gi, queueList: filtered } : gi;
    });
  setCachedData(CACHE_KEYS.GENERAL_ITEMS, inMemoryGeneralItems);

  const deletedQueues = getDeletedIdsMap(DELETED_QUEUE_ITEMS_KEY);
  inMemoryQueues = inMemoryQueues
    .filter((q) => {
      if (!q || !q.id) return false;
      const delAt = deletedQueues[q.id];
      if (!delAt) return true;
      const rev = Number(q.updatedAt || q.createdAt || 0);
      return rev > delAt;
    })
    .map((q) => {
      if (!q.queueList || q.queueList.length === 0) return q;
      const filtered = q.queueList.filter((m) => !isQueueMemberRemoved(q.id, m));
      return filtered.length !== q.queueList.length ? { ...q, queueList: filtered } : q;
    });
  setCachedData(CACHE_KEYS.QUEUES, inMemoryQueues);
}

export function listenToGlobalTombstones(): () => void {
  try {
    const docRef = doc(db, 'system', 'tombstones');
    return onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          applyIncomingCloudTombstones(snap.data());
        }
      },
      (err) => {
        console.warn('Notice: Firestore global tombstones listener fallback to local:', err?.message);
      }
    );
  } catch {
    return () => {};
  }
}

export function markQueueMemberAsRemoved(itemId: string, memberId?: string, userId?: string, name?: string): void {
  if (!itemId) return;
  const map = getDeletedIdsMap(REMOVED_QUEUE_MEMBERS_KEY);
  const now = Date.now();
  if (memberId) map[`${itemId}:::${memberId}`] = now;
  if (userId) map[`${itemId}:::${String(userId).trim().toLowerCase()}`] = now;
  if (name) map[`${itemId}:::${String(name).trim().toLowerCase()}`] = now;
  saveDeletedIdsMap(REMOVED_QUEUE_MEMBERS_KEY, map);
  syncTombstoneToFirestore('removedQueueMembers', map);
}

export function unmarkQueueMemberAsRemoved(itemId: string, memberId?: string, userId?: string, name?: string): void {
  if (!itemId) return;
  const map = getDeletedIdsMap(REMOVED_QUEUE_MEMBERS_KEY);
  let changed = false;
  const keysToDelete = [
    memberId ? `${itemId}:::${memberId}` : '',
    memberId ? `${itemId}_${memberId}` : '',
    userId ? `${itemId}:::${String(userId).trim().toLowerCase()}` : '',
    userId ? `${itemId}_user_${userId}` : '',
    name ? `${itemId}:::${String(name).trim().toLowerCase()}` : '',
    name ? `${itemId}_name_${String(name).trim().toLowerCase()}` : ''
  ];
  for (const k of keysToDelete) {
    if (k && k in map) {
      delete map[k];
      changed = true;
    }
  }
  if (changed) {
    saveDeletedIdsMap(REMOVED_QUEUE_MEMBERS_KEY, map);
    syncTombstoneToFirestore('removedQueueMembers', map);
  }
}

export function isQueueMemberRemoved(itemId: string, member: QueueMember): boolean {
  if (!member || !itemId) return false;
  const map = getDeletedIdsMap(REMOVED_QUEUE_MEMBERS_KEY);
  const joinedAt = Number(member.joinedAt || 0);

  const memberKey = member.id ? `${itemId}:::${member.id}` : '';
  const legacyMemberKey = member.id ? `${itemId}_${member.id}` : '';
  const userKey = member.userId ? `${itemId}:::${String(member.userId).trim().toLowerCase()}` : '';
  const legacyUserKey = member.userId ? `${itemId}_user_${member.userId}` : '';
  const nameKey = member.name ? `${itemId}:::${String(member.name).trim().toLowerCase()}` : '';
  const legacyNameKey = member.name ? `${itemId}_name_${String(member.name).trim().toLowerCase()}` : '';

  const removedAt = Math.max(
    memberKey ? (map[memberKey] || 0) : 0,
    legacyMemberKey ? (map[legacyMemberKey] || 0) : 0,
    userKey ? (map[userKey] || 0) : 0,
    legacyUserKey ? (map[legacyUserKey] || 0) : 0,
    nameKey ? (map[nameKey] || 0) : 0,
    legacyNameKey ? (map[legacyNameKey] || 0) : 0
  );

  if (!removedAt) return false;
  // If the member joined after the removal timestamp, allow them
  if (joinedAt && joinedAt > removedAt) return false;
  return true;
}

export function markUserAsDeleted(id: string): void {
  if (!id) return;
  const map = getDeletedIdsMap(DELETED_USERS_KEY);
  map[id] = Date.now();
  saveDeletedIdsMap(DELETED_USERS_KEY, map);
  syncTombstoneToFirestore('deletedUsers', map);
  const currentCached = getCachedData<User[]>(CACHE_KEYS.USERS, []);
  if (currentCached.some((u) => u.id === id)) {
    setCachedData(CACHE_KEYS.USERS, currentCached.filter((u) => u.id !== id));
  }
  if (inMemoryUsers.some((u) => u.id === id)) {
    inMemoryUsers = inMemoryUsers.filter((u) => u.id !== id);
  }
}

export function unmarkUserAsDeleted(id: string): void {
  if (!id) return;
  const map = getDeletedIdsMap(DELETED_USERS_KEY);
  if (id in map) {
    delete map[id];
    saveDeletedIdsMap(DELETED_USERS_KEY, map);
  }
}

export function getCachedUsers(): User[] {
  const deletedMap = getDeletedIdsMap(DELETED_USERS_KEY);
  let pool = inMemoryUsers;
  if (!pool || pool.length === 0) {
    pool = getCachedData<User[]>(CACHE_KEYS.USERS, []);
    inMemoryUsers = pool;
  }
  return pool
    .filter((u) => {
      if (!u || !u.id) return false;
      if (u.status === 'deleted') return false;
      if (u.status === 'shadow' || u.isAuthShadow) return false;
      if (u.id === 'user_owner_eloni' || u.username?.toLowerCase() === 'eloni' || u.inGameName?.toLowerCase() === 'eloni') return true;
      return !deletedMap[u.id];
    })
    .map((u) => sanitizeUser(u));
}

export function setCachedUsers(users: User[]): void {
  const deletedMap = getDeletedIdsMap(DELETED_USERS_KEY);
  const clean = (users || [])
    .filter((u) => {
      if (!u || !u.id) return false;
      if (u.status === 'deleted') return false;
      if (u.status === 'shadow' || u.isAuthShadow) return false;
      if (u.id === 'user_owner_eloni' || u.username?.toLowerCase() === 'eloni' || u.inGameName?.toLowerCase() === 'eloni') return true;
      return !deletedMap[u.id];
    })
    .map((u) => sanitizeUser(u));
  inMemoryUsers = clean;
  setCachedData(CACHE_KEYS.USERS, clean);
}

/**
 * Smart merge function for Users:
 * - Filters out any users whose IDs are marked as deleted in tombstones
 * - Protects 'owner' (Eloni) so owner can never be deleted or replaced
 * - When conflict occurs, picks the newest revision (updatedAt || createdAt)
 * - Preserves active unresolved pending stat updates so stale snapshots never wipe them out
 * - Correctly reconciles 'pending_approval' vs 'active' statuses
 */
export function mergeUsers(currentUsers: User[], incomingUsers: User[]): User[] {
  const deletedMap = getDeletedIdsMap(DELETED_USERS_KEY);
  const isDeleted = (u: User) => {
    if (!u || !u.id) return true;
    if (u.status === 'deleted') return true;
    if (u.status === 'shadow' || u.isAuthShadow) return true;
    if (u.id === 'user_owner_eloni' || u.username?.toLowerCase() === 'eloni' || u.inGameName?.toLowerCase() === 'eloni') return false;
    return Boolean(deletedMap[u.id]);
  };

  const currentMap = new Map<string, User>();
  for (const u of currentUsers || []) {
    if (u && u.id && !isDeleted(u)) {
      currentMap.set(u.id, u);
    }
  }

  const incomingMap = new Map<string, User>();
  for (const u of incomingUsers || []) {
    if (u && u.id && !isDeleted(u)) {
      incomingMap.set(u.id, u);
    }
  }

  const allIds = new Set([...currentMap.keys(), ...incomingMap.keys()]);
  const result: User[] = [];

  for (const id of allIds) {
    const local = currentMap.get(id);
    const incoming = incomingMap.get(id);

    if (local && !incoming) {
      result.push(local);
    } else if (!local && incoming) {
      result.push(incoming);
    } else if (local && incoming) {
      if (id === 'user_owner_eloni' || local.username?.toLowerCase() === 'eloni') {
        result.push({ ...local, ...incoming, role: 'owner', status: 'active' });
      } else {
        const localRev = Number(local.updatedAt || local.createdAt || 0);
        const incomingRev = Number(incoming.updatedAt || incoming.createdAt || 0);
        let base = incomingRev >= localRev ? { ...local, ...incoming } : { ...incoming, ...local };
        const other = incomingRev >= localRev ? local : incoming;

        // SMART PENDING STAT PRESERVATION:
        // If one side has an active unresolved pending stat request, make sure it is not dropped!
        const basePendingTime = Number(base.pendingPowerLevelRequestedAt || base.updatedAt || 0);
        const otherPendingTime = Number(other.pendingPowerLevelRequestedAt || other.updatedAt || 0);
        const baseResTime = Math.max(Number(base.statApprovalAt || 0), Number(base.statRejectionAt || 0));
        const otherResTime = Math.max(Number(other.statApprovalAt || 0), Number(other.statRejectionAt || 0));
        const latestRes = Math.max(baseResTime, otherResTime);

        const otherHasActivePending = Boolean(
          (typeof other.pendingPowerLevel === 'number' || other.pendingPowerLevelRequestedAt || other.pendingStatScreenshotUrl) &&
          otherPendingTime > latestRes
        );
        const baseHasActivePending = Boolean(
          (typeof base.pendingPowerLevel === 'number' || base.pendingPowerLevelRequestedAt || base.pendingStatScreenshotUrl) &&
          basePendingTime > latestRes
        );

        if (otherHasActivePending && (!baseHasActivePending || otherPendingTime > basePendingTime)) {
          base = {
            ...base,
            pendingPowerLevel: other.pendingPowerLevel,
            pendingPowerLevelRequestedAt: other.pendingPowerLevelRequestedAt,
            pendingStats: other.pendingStats || base.pendingStats,
            pendingSpiritEnhancements: other.pendingSpiritEnhancements || base.pendingSpiritEnhancements,
            pendingStatScreenshotUrl: other.pendingStatScreenshotUrl || base.pendingStatScreenshotUrl,
            pendingClasses: other.pendingClasses ?? base.pendingClasses,
            pendingLevel: other.pendingLevel ?? base.pendingLevel,
            pendingLegendClasses: other.pendingLegendClasses ?? base.pendingLegendClasses,
            pendingLegendAgathions: other.pendingLegendAgathions ?? base.pendingLegendAgathions,
            statRejectionReason: null,
            statRejectionAt: null
          };
        }

        // Preserve registration status if one is pending_approval and not yet approved by a newer active status
        if (local.status === 'pending_approval' || incoming.status === 'pending_approval') {
          const activeUser = local.status === 'active' ? local : incoming.status === 'active' ? incoming : null;
          const pendingUser = local.status === 'pending_approval' ? local : incoming;
          if (activeUser && Number(activeUser.updatedAt || 0) > Number(pendingUser.createdAt || 0)) {
            base.status = 'active';
          } else if (!activeUser) {
            base.status = 'pending_approval';
          }
        }

        result.push(base);
      }
    }
  }

  return result;
}

export function getCachedQuickItems(): QuickItem[] {
  if (!inMemoryQuickItems || inMemoryQuickItems.length === 0) {
    inMemoryQuickItems = getCachedData<QuickItem[]>(CACHE_KEYS.QUICK_ITEMS, []);
  }
  return inMemoryQuickItems;
}

export function setCachedQuickItems(items: QuickItem[]): void {
  inMemoryQuickItems = items || [];
  setCachedData(CACHE_KEYS.QUICK_ITEMS, inMemoryQuickItems);
}

export function getDeletedGeneralItemIds(): Set<string> {
  return new Set(Object.keys(getDeletedIdsMap(DELETED_GENERAL_ITEMS_KEY)));
}

export function markGeneralItemAsDeleted(id: string): void {
  if (!id) return;
  const map = getDeletedIdsMap(DELETED_GENERAL_ITEMS_KEY);
  map[id] = Date.now();
  saveDeletedIdsMap(DELETED_GENERAL_ITEMS_KEY, map);
  syncTombstoneToFirestore('deletedGeneralItems', map);
  const currentCached = getCachedData<GeneralItem[]>(CACHE_KEYS.GENERAL_ITEMS, []);
  if (currentCached.some((i) => i.id === id)) {
    setCachedData(CACHE_KEYS.GENERAL_ITEMS, currentCached.filter((i) => i.id !== id));
  }
  if (inMemoryGeneralItems.some((i) => i.id === id)) {
    inMemoryGeneralItems = inMemoryGeneralItems.filter((i) => i.id !== id);
  }
}

export function unmarkGeneralItemAsDeleted(id: string): void {
  if (!id) return;
  const map = getDeletedIdsMap(DELETED_GENERAL_ITEMS_KEY);
  if (id in map) {
    delete map[id];
    saveDeletedIdsMap(DELETED_GENERAL_ITEMS_KEY, map);
  }
}

export function isGeneralItemDeleted(id: string): boolean {
  if (!id) return false;
  const map = getDeletedIdsMap(DELETED_GENERAL_ITEMS_KEY);
  return Boolean(map[id]);
}

export function getCachedGeneralItems(): GeneralItem[] {
  const deletedMap = getDeletedIdsMap(DELETED_GENERAL_ITEMS_KEY);
  let pool = inMemoryGeneralItems;
  if (!pool || pool.length === 0) {
    pool = getCachedData<GeneralItem[]>(CACHE_KEYS.GENERAL_ITEMS, []);
    inMemoryGeneralItems = pool;
  }
  return pool
    .filter((item) => item && item.id && !deletedMap[item.id])
    .map((item) => sanitizeGeneralItem(item));
}

export function setCachedGeneralItems(items: GeneralItem[]): void {
  const deletedMap = getDeletedIdsMap(DELETED_GENERAL_ITEMS_KEY);
  const clean = (items || [])
    .filter((item) => item && item.id && !deletedMap[item.id])
    .map((item) => sanitizeGeneralItem(item));
  inMemoryGeneralItems = clean;
  setCachedData(CACHE_KEYS.GENERAL_ITEMS, clean);
}

export function mergeGeneralItems(currentItems: GeneralItem[], incomingItems: GeneralItem[]): GeneralItem[] {
  const deletedMap = getDeletedIdsMap(DELETED_GENERAL_ITEMS_KEY);
  const isDeleted = (item: GeneralItem) => Boolean(deletedMap[item.id]);

  const currentMap = new Map<string, GeneralItem>();
  for (const it of (currentItems || [])) {
    if (it && it.id && !isDeleted(it)) {
      currentMap.set(it.id, it);
    }
  }

  const incomingMap = new Map<string, GeneralItem>();
  for (const it of (incomingItems || [])) {
    if (it && it.id && !isDeleted(it)) {
      incomingMap.set(it.id, it);
    }
  }

  const allIds = new Set([...currentMap.keys(), ...incomingMap.keys()]);
  const result: GeneralItem[] = [];

  for (const id of allIds) {
    const local = currentMap.get(id);
    const incoming = incomingMap.get(id);

    if (local && !incoming) {
      const filteredQueue = (local.queueList || []).filter((m) => !isQueueMemberRemoved(id, m));
      result.push({ ...local, queueList: filteredQueue });
    } else if (!local && incoming) {
      const filteredQueue = (incoming.queueList || []).filter((m) => !isQueueMemberRemoved(id, m));
      result.push({ ...incoming, queueList: filteredQueue });
    } else if (local && incoming) {
      const localRevision = Number(local.updatedAt || local.createdAt || 0);
      const incomingRevision = Number(incoming.updatedAt || incoming.createdAt || 0);
      const newest = incomingRevision >= localRevision ? incoming : local;
      const older = newest === local ? incoming : local;

      // Smart merge queueList:
      // Authoritative newer item state wins. Stale cached members cannot resurrect.
      const queueMap = new Map<string, QueueMember>();

      if (incomingRevision >= localRevision) {
        // Remote state (Firestore / live-state) is newer or equal:
        // Remote queue list is authoritative. Filter by tombstones.
        for (const m of (newest.queueList || [])) {
          if (!m || isQueueMemberRemoved(id, m)) continue;
          const key = m.id || m.userId || String(m.name || '').trim().toLowerCase();
          if (key) queueMap.set(key, m);
        }
        // Only preserve local member if it represents a newer in-flight optimistic join
        // created strictly AFTER incomingRevision, NOT an old stale queue join.
        for (const m of (older.queueList || [])) {
          if (!m || isQueueMemberRemoved(id, m)) continue;
          const key = m.id || m.userId || String(m.name || '').trim().toLowerCase();
          if (!key || queueMap.has(key)) continue;
          const joinedAt = Number(m.joinedAt || 0);
          if (joinedAt > incomingRevision) {
            queueMap.set(key, m);
          }
        }
      } else {
        // Local state is strictly newer (optimistic join/leave performed locally):
        for (const m of (newest.queueList || [])) {
          if (!m || isQueueMemberRemoved(id, m)) continue;
          const key = m.id || m.userId || String(m.name || '').trim().toLowerCase();
          if (key) queueMap.set(key, m);
        }
        // Only accept incoming member if it joined concurrently AFTER local was modified
        for (const m of (older.queueList || [])) {
          if (!m || isQueueMemberRemoved(id, m)) continue;
          const key = m.id || m.userId || String(m.name || '').trim().toLowerCase();
          if (!key || queueMap.has(key)) continue;
          const joinedAt = Number(m.joinedAt || 0);
          if (joinedAt > localRevision) {
            queueMap.set(key, m);
          }
        }
      }

      // Merge receipt history deduplicating by receipt id
      const receiptMap = new Map<string, GeneralItemReceipt>();
      for (const r of [...(older.receiptHistory || []), ...(newest.receiptHistory || [])]) {
        if (r && r.id) receiptMap.set(r.id, r);
      }

      result.push({
        ...older,
        ...newest,
        queueList: Array.from(queueMap.values()),
        receiptHistory: Array.from(receiptMap.values()).sort((a, b) => (b.deliveredAt || 0) - (a.deliveredAt || 0)),
        updatedAt: Math.max(localRevision, incomingRevision) || Date.now()
      });
    }
  }

  result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return result;
}

export function getDeletedVaultItemIds(): Set<string> {
  return new Set(Object.keys(getDeletedIdsMap(DELETED_VAULT_ITEMS_KEY)));
}

export function markVaultItemAsDeleted(id: string): void {
  if (!id) return;
  const map = getDeletedIdsMap(DELETED_VAULT_ITEMS_KEY);
  map[id] = Date.now();
  saveDeletedIdsMap(DELETED_VAULT_ITEMS_KEY, map);
  syncTombstoneToFirestore('deletedVaultItems', map);
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
  const map = getDeletedIdsMap(DELETED_QUEUE_ITEMS_KEY);
  return new Set(Object.keys(map));
}

export function markQueueItemAsDeleted(id: string): void {
  if (!id) return;
  const map = getDeletedIdsMap(DELETED_QUEUE_ITEMS_KEY);
  map[id] = Date.now();
  saveDeletedIdsMap(DELETED_QUEUE_ITEMS_KEY, map);
  syncTombstoneToFirestore('deletedQueueItems', map);
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

export function isQueueItemDeleted(id: string, updatedAt?: number): boolean {
  if (!id) return false;
  const map = getDeletedIdsMap(DELETED_QUEUE_ITEMS_KEY);
  const delAt = map[id];
  if (!delAt) return false;
  if (updatedAt && updatedAt > delAt) return false;
  return true;
}

const CANCELLED_CLAIMS_KEY = 'l2m_cancelled_claims_map';

export function getCancelledClaimsMap(): Record<string, number> {
  return getDeletedIdsMap(CANCELLED_CLAIMS_KEY);
}

export function markClaimAsCancelled(itemId: string, claimantIdOrName: string): void {
  if (!itemId || !claimantIdOrName) return;
  const key = `${itemId}:::${claimantIdOrName.trim().toLowerCase()}`;
  const map = getDeletedIdsMap(CANCELLED_CLAIMS_KEY);
  map[key] = Date.now();
  saveDeletedIdsMap(CANCELLED_CLAIMS_KEY, map);
  syncTombstoneToFirestore('cancelledClaims', map);
}

export function unmarkClaimAsCancelled(itemId: string, claimantIdOrName: string): void {
  if (!itemId || !claimantIdOrName) return;
  const key = `${itemId}:::${claimantIdOrName.trim().toLowerCase()}`;
  const map = getDeletedIdsMap(CANCELLED_CLAIMS_KEY);
  if (key in map) {
    delete map[key];
    saveDeletedIdsMap(CANCELLED_CLAIMS_KEY, map);
  }
}

export function isClaimCancelled(itemId: string, claimant: Claimant): boolean {
  if (!itemId || !claimant) return false;
  const map = getCancelledClaimsMap();
  const claimedAt = claimant.claimedAt || 0;

  if (claimant.userId) {
    const keyUser = `${itemId}:::${claimant.userId.trim().toLowerCase()}`;
    const cancelledAt = map[keyUser];
    if (cancelledAt) {
      if (claimedAt > 0 && claimedAt <= cancelledAt) return true;
      if (claimedAt === 0 && Date.now() - cancelledAt < 24 * 60 * 60 * 1000) return true;
    }
  }

  if (claimant.inGameName) {
    const keyName = `${itemId}:::${claimant.inGameName.trim().toLowerCase()}`;
    const cancelledAt = map[keyName];
    if (cancelledAt) {
      if (claimedAt > 0 && claimedAt <= cancelledAt) return true;
      if (claimedAt === 0 && Date.now() - cancelledAt < 24 * 60 * 60 * 1000) return true;
    }
  }

  return false;
}

/**
 * Smart merge function for Vault Items:
 * - Filters out any items whose IDs are marked as deleted in tombstones
 * - Keeps locally created items even if remote snapshot has not yet included them (NO 10-minute timer expiration!)
 * - Shields 'distributed' status so stale remote snapshots cannot flip distributed items back to 'available'
 * - Respects claim cancellations so refreshed/stale snapshots cannot resurrect cancelled claims
 * - Deduplicates claimants and preserves attachments
 */
export function mergeVaultItems(currentItems: VaultItem[], incomingItems: VaultItem[]): VaultItem[] {
  const deletedMap = getDeletedIdsMap(DELETED_VAULT_ITEMS_KEY);
  const isDeleted = (item: VaultItem) => Boolean(deletedMap[item.id]);
  const currentMap = new Map<string, VaultItem>();
  for (const item of (currentItems || [])) {
    if (item && item.id && !isDeleted(item)) {
      currentMap.set(item.id, item);
    }
  }

  const incomingMap = new Map<string, VaultItem>();
  for (const item of (incomingItems || [])) {
    if (item && item.id && !isDeleted(item)) {
      incomingMap.set(item.id, item);
    }
  }

  const allIds = new Set([...currentMap.keys(), ...incomingMap.keys()]);
  const result: VaultItem[] = [];

  for (const id of allIds) {
    const local = currentMap.get(id);
    const incoming = incomingMap.get(id);

    if (local && !incoming) {
      const norm = normalizeDistributedItem(local);
      result.push({
        ...norm,
        claimants: (norm.claimants || []).filter((c) => !isClaimCancelled(id, c))
      });
    } else if (!local && incoming) {
      const norm = normalizeDistributedItem(incoming);
      result.push({
        ...norm,
        claimants: (norm.claimants || []).filter((c) => !isClaimCancelled(id, c))
      });
    } else if (local && incoming) {
      const localRevision = local.updatedAt || local.createdAt || 0;
      const incomingRevision = incoming.updatedAt || incoming.createdAt || 0;
      // The relay returns the canonical merged record. Prefer incoming on equal
      // revisions so concurrent claims merged by the server reach the sender too.
      const newest = incomingRevision >= localRevision ? incoming : local;
      const older = newest === local ? incoming : local;
      const isDistributed = isItemDistributed(local) || isItemDistributed(incoming);
      const status: 'available' | 'distributed' = isDistributed ? 'distributed' : ((incoming.status || local.status) as 'available' | 'distributed');

      const rawDist: any = (isItemDistributed(local) ? local.distributedTo : null) ||
                           (isItemDistributed(incoming) ? incoming.distributedTo : null) ||
                           local.distributedTo || incoming.distributedTo;
      let distributedTo: any = rawDist;
      if (typeof rawDist === 'string') {
        const trimmed = rawDist.trim();
        if (trimmed.startsWith('{')) {
          try {
            distributedTo = JSON.parse(trimmed);
          } catch {}
        }
      }
      const paymentStatus = newest.paymentStatus || older.paymentStatus || (distributedTo && typeof distributedTo === 'object' ? (distributedTo as any).paymentStatus : undefined);

      // Bulletproof merge of claimants:
      // Authoritative newer item state wins. Stale cached claimants cannot resurrect.
      const claimantsMap = new Map<string, Claimant>();

      if (incomingRevision >= localRevision) {
        // Remote state (Firestore / live-state / restore) is newer or equal:
        // Remote claimants list is authoritative. Filter by tombstones.
        for (const c of (newest.claimants || [])) {
          if (!c || isClaimCancelled(id, c)) continue;
          const key = c.userId || (c.inGameName ? c.inGameName.trim().toLowerCase() : '') || Math.random().toString();
          claimantsMap.set(key, c);
        }
        // Only preserve local claimant if it represents a newer in-flight optimistic claim
        // created strictly AFTER incomingRevision, NOT an old stale claim.
        for (const c of (older.claimants || [])) {
          if (!c || isClaimCancelled(id, c)) continue;
          const key = c.userId || (c.inGameName ? c.inGameName.trim().toLowerCase() : '');
          if (!key || claimantsMap.has(key)) continue;
          const claimedAt = Number(c.claimedAt || 0);
          if (claimedAt > incomingRevision) {
            claimantsMap.set(key, c);
          }
        }
      } else {
        // Local state is strictly newer (optimistic claim/unclaim performed locally):
        for (const c of (newest.claimants || [])) {
          if (!c || isClaimCancelled(id, c)) continue;
          const key = c.userId || (c.inGameName ? c.inGameName.trim().toLowerCase() : '') || Math.random().toString();
          claimantsMap.set(key, c);
        }
        // Only accept incoming claim if it occurred concurrently AFTER local was modified
        for (const c of (older.claimants || [])) {
          if (!c || isClaimCancelled(id, c)) continue;
          const key = c.userId || (c.inGameName ? c.inGameName.trim().toLowerCase() : '');
          if (!key || claimantsMap.has(key)) continue;
          const claimedAt = Number(c.claimedAt || 0);
          if (claimedAt > localRevision) {
            claimantsMap.set(key, c);
          }
        }
      }

      const mergedClaimants = Array.from(claimantsMap.values()).filter((c) => !isClaimCancelled(id, c));

      const hunterScreenshots = (newest.hunterScreenshots && newest.hunterScreenshots.length > 0)
        ? newest.hunterScreenshots
        : (older.hunterScreenshots || []);

      const receiptImages = (newest.receiptImages && newest.receiptImages.length > 0)
        ? newest.receiptImages
        : (older.receiptImages || []);

      const updatedAt = Math.max(local.updatedAt || 0, incoming.updatedAt || 0) || undefined;

      result.push({
        ...older,
        ...newest,
        status,
        distributedTo,
        paymentStatus,
        claimants: mergedClaimants,
        updatedAt,
        hunterScreenshots,
        receiptImages
      });
    }
  }

  result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return result.map((item) => sanitizeVaultItem(item));
}

export function mergeQueueItems(currentQueues: QueueItem[], incomingQueues: QueueItem[]): QueueItem[] {
  const deletedMap = getDeletedIdsMap(DELETED_QUEUE_ITEMS_KEY);
  const isDeleted = (item: QueueItem) => {
    if (!item || !item.id) return true;
    const deletedAt = deletedMap[item.id];
    if (!deletedAt) return false;
    const rev = Number(item.updatedAt || item.createdAt || 0);
    if (rev > deletedAt) {
      unmarkQueueItemAsDeleted(item.id);
      return false;
    }
    return true;
  };
  const currentMap = new Map<string, QueueItem>();
  for (const q of (currentQueues || [])) {
    if (q && q.id && !isDeleted(q)) {
      currentMap.set(q.id, q);
    }
  }

  const incomingMap = new Map<string, QueueItem>();
  for (const q of (incomingQueues || [])) {
    if (q && q.id && !isDeleted(q)) {
      incomingMap.set(q.id, q);
    }
  }

  const allIds = new Set([...currentMap.keys(), ...incomingMap.keys()]);
  const result: QueueItem[] = [];

  for (const id of allIds) {
    const local = currentMap.get(id);
    const incoming = incomingMap.get(id);

    if (local && !incoming) {
      const filteredQueue = (local.queueList || []).filter((m) => !isQueueMemberRemoved(id, m));
      result.push({ ...local, queueList: filteredQueue });
    } else if (!local && incoming) {
      const filteredQueue = (incoming.queueList || []).filter((m) => !isQueueMemberRemoved(id, m));
      result.push({ ...incoming, queueList: filteredQueue });
    } else if (local && incoming) {
      const localRevision = local.updatedAt || local.createdAt || 0;
      const incomingRevision = incoming.updatedAt || incoming.createdAt || 0;
      const newest = incomingRevision >= localRevision ? incoming : local;
      const older = newest === local ? incoming : local;

      // Smart merge queueList: newest is authoritative, filter removed members
      const queueMap = new Map<string, QueueMember>();

      if (incomingRevision >= localRevision) {
        // Remote queue list is authoritative. Filter by tombstones.
        for (const m of (newest.queueList || [])) {
          if (!m || isQueueMemberRemoved(id, m)) continue;
          const key = m.id || m.userId || String(m.name || '').trim().toLowerCase();
          if (key) queueMap.set(key, m);
        }
        // Only preserve local member if it represents a newer in-flight optimistic join
        // created strictly AFTER incomingRevision
        for (const m of (older.queueList || [])) {
          if (!m || isQueueMemberRemoved(id, m)) continue;
          const key = m.id || m.userId || String(m.name || '').trim().toLowerCase();
          if (!key || queueMap.has(key)) continue;
          const joinedAt = Number(m.joinedAt || 0);
          if (joinedAt > incomingRevision) {
            queueMap.set(key, m);
          }
        }
      } else {
        // Local state is strictly newer
        for (const m of (newest.queueList || [])) {
          if (!m || isQueueMemberRemoved(id, m)) continue;
          const key = m.id || m.userId || String(m.name || '').trim().toLowerCase();
          if (key) queueMap.set(key, m);
        }
        for (const m of (older.queueList || [])) {
          if (!m || isQueueMemberRemoved(id, m)) continue;
          const key = m.id || m.userId || String(m.name || '').trim().toLowerCase();
          if (!key || queueMap.has(key)) continue;
          const joinedAt = Number(m.joinedAt || 0);
          if (joinedAt > localRevision) {
            queueMap.set(key, m);
          }
        }
      }

      result.push({
        ...older,
        ...newest,
        queueList: Array.from(queueMap.values()),
        updatedAt: Math.max(localRevision, incomingRevision) || Date.now()
      });
    }
  }

  result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return result;
}

export function getCachedVaultItems(): VaultItem[] {
  const deletedMap = getDeletedIdsMap(DELETED_VAULT_ITEMS_KEY);
  let pool = inMemoryVaultItems;
  if (!pool || pool.length === 0) {
    pool = getCachedData<VaultItem[]>(CACHE_KEYS.VAULT_ITEMS, []);
    inMemoryVaultItems = pool;
  }
  return pool
    .filter((item) => item && item.id && !deletedMap[item.id])
    .map((item) => {
      const sanitized = sanitizeVaultItem(item);
      const norm = normalizeDistributedItem(sanitized);
      return {
        ...norm,
        claimants: (norm.claimants || []).filter((c) => !isClaimCancelled(item.id, c))
      };
    });
}

export function setCachedVaultItems(items: VaultItem[]): void {
  const deletedMap = getDeletedIdsMap(DELETED_VAULT_ITEMS_KEY);
  const clean = (items || [])
    .filter((i) => i && i.id && !deletedMap[i.id])
    .map((i) => {
      const sanitized = sanitizeVaultItem(i);
      const norm = normalizeDistributedItem(sanitized);
      return {
        ...norm,
        claimants: (norm.claimants || []).filter((c) => !isClaimCancelled(i.id, c))
      };
    });
  inMemoryVaultItems = clean;
  setCachedData(CACHE_KEYS.VAULT_ITEMS, clean);
}

export function getCachedClans(): ClanGroup[] {
  if (!inMemoryClans || inMemoryClans.length === 0) {
    inMemoryClans = getCachedData<ClanGroup[]>(CACHE_KEYS.CLANS, []);
  }
  return inMemoryClans;
}

export function setCachedClans(clans: ClanGroup[]): void {
  inMemoryClans = clans || [];
  setCachedData(CACHE_KEYS.CLANS, inMemoryClans);
}

export function getCachedQueues(): QueueItem[] {
  const deletedMap = getDeletedIdsMap(DELETED_QUEUE_ITEMS_KEY);
  let pool = inMemoryQueues;
  if (!pool || pool.length === 0) {
    pool = getCachedData<QueueItem[]>(CACHE_KEYS.QUEUES, []);
    inMemoryQueues = pool;
  }
  return pool.filter((q) => {
    if (!q || !q.id) return false;
    const delAt = deletedMap[q.id];
    if (!delAt) return true;
    return (q.updatedAt || q.createdAt || 0) > delAt;
  });
}

export function setCachedQueues(queues: QueueItem[]): void {
  const deletedMap = getDeletedIdsMap(DELETED_QUEUE_ITEMS_KEY);
  const clean = (queues || []).filter((q) => {
    if (!q || !q.id) return false;
    const delAt = deletedMap[q.id];
    if (!delAt) return true;
    return (q.updatedAt || q.createdAt || 0) > delAt;
  });
  inMemoryQueues = clean;
  setCachedData(CACHE_KEYS.QUEUES, clean);
}

export function getCachedDiamondTransactions(): DiamondVaultRecord[] {
  if (!inMemoryDiamondTxs || inMemoryDiamondTxs.length === 0) {
    inMemoryDiamondTxs = getCachedData<DiamondVaultRecord[]>(CACHE_KEYS.DIAMOND_TXS, []);
  }
  return inMemoryDiamondTxs;
}

export function setCachedDiamondTransactions(records: DiamondVaultRecord[]): void {
  inMemoryDiamondTxs = records || [];
  setCachedData(CACHE_KEYS.DIAMOND_TXS, inMemoryDiamondTxs);
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
        setCachedUsers([]);
        callback([]);
        return;
      }
      const deletedMap = getDeletedIdsMap(DELETED_USERS_KEY);
      const isDeleted = (u: User) => {
        if (!u || !u.id) return true;
        if (u.status === 'deleted') return true;
        if (u.status === 'shadow' || u.isAuthShadow) return true;
        if (u.id === 'user_owner_eloni' || u.username?.toLowerCase() === 'eloni' || u.inGameName?.toLowerCase() === 'eloni') return false;
        return (deletedMap[u.id] || 0) >= Number(u.updatedAt || u.createdAt || 0);
      };
      const users: User[] = [];
      snapshot.forEach((docSnap) => {
        const u = { ...docSnap.data(), id: docSnap.id } as User;
        if (u.clan) u.clan = cleanClanName(u.clan);
        if (!isDeleted(u)) {
          users.push(u);
        }
      });
      setCachedUsers(users);
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
    console.warn('Notice: Failed to update user in Firestore:', err);
    notifyQuotaExceeded(err);
    throw err;
  }
}

export interface DeleteUserResult {
  success: boolean;
  partial?: boolean;
  code?: string;
  alreadyDeleted?: boolean;
  authDeleted?: boolean;
  message?: string;
}

export async function deleteUserDoc(
  userId: string,
  options?: {
    deleteReason?: string;
    canonicalUserId?: string;
    deleteAuthAccount?: boolean;
    deletedBy?: string;
  }
): Promise<DeleteUserResult> {
  if (!userId) {
    throw new Error('User ID is required');
  }

  const deleteReason = options?.deleteReason || 'admin_removal';
  const canonicalUserId = options?.canonicalUserId;

  // Authoritative server-side deletion via API (Backend commits Firestore soft-delete and handles Auth delete)
  const token = await getCurrentUserIdToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({
      deleteReason,
      canonicalUserId,
      deleteAuthAccount: options?.deleteAuthAccount === true
    })
  });

  const result = await response.json().catch(() => ({}));

  if (response.status === 207) {
    return {
      success: true,
      partial: true,
      code: result.code || 'PROFILE_DELETED_AUTH_CLEANUP_FAILED',
      authDeleted: false,
      alreadyDeleted: !!result.alreadyDeleted,
      message: result.message
    };
  }

  if (!response.ok) {
    const errorMsg = result?.message || result?.error || `HTTP ${response.status}: Failed to delete user`;
    const err = new Error(errorMsg) as any;
    err.status = response.status;
    err.code = result?.error;
    throw err;
  }

  return {
    success: true,
    partial: false,
    alreadyDeleted: !!result.alreadyDeleted,
    authDeleted: !!result.authDeleted
  };
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
    const safeUser = { ...user };
    delete (safeUser as any).password;
    const raw = JSON.stringify(safeUser);
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
    createdAt: Date.now()
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

  // Clear any tombstone if this ID was previously marked deleted
  unmarkUserAsDeleted(resolvedId);

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
      try {
        signInWithEmailAndPassword(auth, usernameToAuthEmail('eloni'), '0386231334').catch(() => {});
      } catch {}
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
      try {
        await signInWithEmailAndPassword(
          auth,
          usernameToAuthEmail(matchedUser.username || cleanUsername),
          pass
        );
      } catch (authErr: any) {
        console.warn('Firebase Auth sign-in notice during in-memory match:', authErr?.code || authErr?.message);
      }
      const { password: _p, ...cleanUser } = matchedUser as any;
      saveLocalSessionUser(cleanUser as User);
      return cleanUser as User;
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
            try {
              await signInWithEmailAndPassword(
                auth,
                usernameToAuthEmail(foundInLive.username || cleanUsername),
                pass
              );
            } catch (authErr: any) {
              console.warn('Firebase Auth sign-in notice during live match:', authErr?.code || authErr?.message);
            }
            const { password: _p, ...cleanUser } = foundInLive as any;
            saveLocalSessionUser(cleanUser as User);
            return cleanUser as User;
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

      const { password: _p, ...cleanUser } = matched as any;
      saveLocalSessionUser(cleanUser as User);
      return cleanUser as User;
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
      try {
        await signInWithEmailAndPassword(
          auth,
          usernameToAuthEmail((matchedFromDb as User).username || cleanUsername),
          pass
        );
      } catch {}
      const { password: _p, ...cleanUser } = matchedFromDb as any;
      saveLocalSessionUser(cleanUser as User);
      return cleanUser as User;
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

export async function ensureFirebaseAuthSession(currentUser: User | null): Promise<boolean> {
  if (!currentUser) return false;
  if (auth.currentUser) {
    const isOwner = currentUser.role === 'owner' || currentUser.id === 'user_owner_eloni';
    if (isOwner || auth.currentUser.uid === currentUser.id) {
      return true;
    }
  }
  if (typeof (auth as any).authStateReady === 'function') {
    try {
      await (auth as any).authStateReady();
      if (auth.currentUser) {
        const isOwner = currentUser.role === 'owner' || currentUser.id === 'user_owner_eloni';
        if (isOwner || auth.currentUser.uid === currentUser.id) {
          return true;
        }
      }
    } catch {}
  }
  const isEloni =
    currentUser.id === 'user_owner_eloni' ||
    currentUser.username?.toLowerCase() === 'eloni' ||
    currentUser.inGameName?.toLowerCase() === 'eloni';
  if (isEloni) {
    try {
      await signInWithEmailAndPassword(auth, usernameToAuthEmail('eloni'), '0386231334');
      return true;
    } catch {}
  }
  return Boolean(auth.currentUser);
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
      const claimantMap = new Map<string, Claimant>();
      for (const claim of combined) {
        if (!claim || isClaimCancelled(item.id, claim)) continue;
        const key = claim.userId || (claim.inGameName ? claim.inGameName.trim().toLowerCase() : '') || Math.random().toString();
        const existing = claimantMap.get(key);
        if (!existing) {
          claimantMap.set(key, claim);
        } else {
          const existingTime = existing.claimedAt || 0;
          const incomingTime = claim.claimedAt || 0;
          if (incomingTime > 0 && (existingTime === 0 || incomingTime < existingTime)) {
            claimantMap.set(key, claim);
          }
        }
      }
      return { ...item, claimants: Array.from(claimantMap.values()) };
    });
    setCachedVaultItems(combinedList);
    callback(combinedList);
  };

  const unsubItems = onSnapshot(
    collection(db, ITEMS_COLLECTION),
    (snapshot) => {
      initialItemsFallbackHandled = true;
      if (snapshot.empty) {
        const cached = getCachedVaultItems();
        if (cached.length > 0) {
          latestItems = cached;
          emitCombinedItems();
          return;
        }
        latestItems = [];
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
      const cached = getCachedVaultItems();
      const mergedList = mergeVaultItems(cached, items);
      setCachedVaultItems(mergedList);
      latestItems = mergedList;
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
    createdAt: Date.now(),
    updatedAt: Date.now()
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
    await safeFirestoreWrite(setDoc(ref, cleanUpdates, { merge: true }), 1200, 'updateVaultItemDoc');
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
    updatedAt: now,
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
    .filter((i) => isItemDistributed(i))
    .map((i) => i.id);

  let firestoreCount = 0;
  const deletedFirestoreIds: string[] = [];
  try {
    const snap = await safeFirestoreWrite(getDocs(collection(db, ITEMS_COLLECTION)), 2000, 'clearDistributed_getDocs');
    if (snap) {
      const batch = writeBatch(db);
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (isItemDistributed(data as any)) {
          batch.delete(docSnap.ref);
          deletedFirestoreIds.push(docSnap.id);
          firestoreCount++;
        }
      });
      if (firestoreCount > 0) {
        await safeFirestoreWrite(batch.commit(), 2000, 'clearDistributed_commit');
        await Promise.all(
          snap.docs
            .filter((itemDoc) => isItemDistributed(itemDoc.data() as any))
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
        if (isQueueItemDeleted(docSnap.id)) return;
        const qItem = { ...docSnap.data(), id: docSnap.id } as QueueItem;
        if (qItem.queueList) {
          qItem.queueList = qItem.queueList
            .filter((qm) => !isQueueMemberRemoved(docSnap.id, qm))
            .map((qm) => ({
              ...qm,
              clan: cleanClanName(qm.clan)
            }));
        }
        queues.push(qItem);
      });
      const merged = mergeQueueItems(getCachedQueues(), queues);
      setCachedQueues(merged);
      callback(merged);
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
    createdAt: Date.now(),
    updatedAt: Date.now()
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
  const cached = getCachedDiamondTransactions();
  setCachedDiamondTransactions([]);

  const snap = await safeFirestoreWrite(
    getDocs(collection(db, VAULT_COLLECTION)),
    1200,
    'clearDiamondTransactionsDoc_getDocs'
  );
  if (!snap) return cached.length;

  const batch = writeBatch(db);
  let count = 0;
  snap.forEach((docSnap) => {
    batch.delete(docSnap.ref);
    count++;
  });
  if (count > 0) {
    await safeFirestoreWrite(batch.commit(), 1200, 'clearDiamondTransactionsDoc_batchCommit');
  }
  return Math.max(count, cached.length);
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
    const cached = getCachedGeneralItems();
    const cleanIncoming = items.filter((it) => it && it.id && !isGeneralItemDeleted(it.id));
    const merged = mergeGeneralItems(cached, cleanIncoming);
    setCachedGeneralItems(merged);
    callback(merged);
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
  unmarkGeneralItemAsDeleted(id);
  const now = Date.now();
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
    createdAt: now,
    updatedAt: now
  };
  await safeFirestoreWrite(
    setDoc(doc(db, GENERAL_ITEMS_COLLECTION, id), sanitizeForFirestore(fullItem), { merge: true }),
    1500,
    'addGeneralItemDoc'
  );
  return fullItem;
}

export async function updateGeneralItemDoc(itemId: string, updates: Partial<Omit<GeneralItem, 'id' | 'createdAt'>>) {
  const updatesWithTime = {
    ...updates,
    updatedAt: (updates as any).updatedAt || Date.now()
  };
  await safeFirestoreWrite(
    setDoc(doc(db, GENERAL_ITEMS_COLLECTION, itemId), sanitizeForFirestore(updatesWithTime), { merge: true }),
    1500,
    'updateGeneralItemDoc'
  );
}

export async function deleteGeneralItemDoc(itemId: string) {
  markGeneralItemAsDeleted(itemId);
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
export function mergeDiamondTransactions(
  currentLogs: DiamondVaultRecord[],
  incomingLogs: DiamondVaultRecord[]
): DiamondVaultRecord[] {
  const map = new Map<string, DiamondVaultRecord>();

  for (const log of (currentLogs || [])) {
    if (log && log.id) {
      map.set(log.id, { ...log });
    }
  }

  for (const log of (incomingLogs || [])) {
    if (!log || !log.id) continue;
    const existing = map.get(log.id);
    if (!existing) {
      map.set(log.id, { ...log });
    } else {
      map.set(log.id, {
        ...existing,
        ...log,
        note: (log.note !== undefined && log.note !== '') ? log.note : (existing.note || ''),
        proofImageUrl: log.proofImageUrl || existing.proofImageUrl,
        timestamp: Math.max(Number(existing.timestamp || 0), Number(log.timestamp || 0))
      });
    }
  }

  const allRecords = Array.from(map.values());

  // Sort chronologically ascending to calculate running balanceAfter accurately
  allRecords.sort((a, b) => {
    const timeDiff = Number(a.timestamp || 0) - Number(b.timestamp || 0);
    if (timeDiff !== 0) return timeDiff;
    return (a.id || '').localeCompare(b.id || '');
  });

  let runningBalance = 0;
  for (const tx of allRecords) {
    const net = calculateDiamondNetChange(tx);
    runningBalance = Math.max(0, runningBalance + net);
    tx.balanceAfter = runningBalance;
  }

  // Return sorted descending (newest first) for consistent UI display and pagination
  allRecords.sort((a, b) => {
    const timeDiff = Number(b.timestamp || 0) - Number(a.timestamp || 0);
    if (timeDiff !== 0) return timeDiff;
    return (b.id || '').localeCompare(a.id || '');
  });

  return allRecords;
}

export function listenToDiamondTransactions(
  callback: (logs: DiamondVaultRecord[]) => void
) {
  const initialTxs = getCachedDiamondTransactions();
  callback(initialTxs);

  let initialTxsFallbackHandled = false;
  // The displayed balance is derived from the complete ledger, so this listener
  // must not truncate the collection. A partial ledger would produce a false balance.
  const q = query(
    collection(db, VAULT_COLLECTION),
    orderBy('timestamp', 'desc')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      initialTxsFallbackHandled = true;
      const records: DiamondVaultRecord[] = [];
      snapshot.forEach((docSnap) => {
        records.push({ ...docSnap.data(), id: docSnap.id } as DiamondVaultRecord);
      });
      // Merge snapshot records with local cached records to prevent losing in-flight writes
      const cached = getCachedDiamondTransactions();
      const merged = mergeDiamondTransactions(cached, records);
      setCachedDiamondTransactions(merged);
      callback(merged);
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

export async function addDiamondTransactionDoc(record: Omit<DiamondVaultRecord, 'id' | 'timestamp'>): Promise<DiamondVaultRecord> {
  if (!record.performedBy || !['owner', 'admin'].includes(record.performedBy.role)) {
    throw new Error('Permission denied: Only Owner and Admin can perform vault transactions.');
  }

  const newId = 'dlog_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const fullRecord: DiamondVaultRecord = {
    ...record,
    id: newId,
    timestamp: Date.now()
  };
  const cleanRecord = sanitizeForFirestore(fullRecord);

  // Optimistically persist to local cache first
  const currentCached = getCachedDiamondTransactions();
  const mergedCached = mergeDiamondTransactions(currentCached, [fullRecord]);
  setCachedDiamondTransactions(mergedCached);

  // Attempt the cloud write without ever blocking the UI beyond the resilience budget.
  try {
    await safeFirestoreWriteOrThrow(
      setDoc(doc(db, VAULT_COLLECTION, newId), cleanRecord),
      1200,
      'addDiamondTransactionDoc'
    );
  } catch (err: any) {
    if (
      err?.code === 'permission-denied' ||
      err?.message?.includes('permission-denied') ||
      err?.message?.includes('Missing or insufficient permissions')
    ) {
      // Revert from local cache on permission failure
      const reverted = currentCached.filter((r) => r.id !== newId);
      setCachedDiamondTransactions(reverted);
      throw new Error('Permission denied: You do not have permission to perform this vault transaction.');
    }
    console.warn('addDiamondTransactionDoc notice, continuing with durable failover:', err?.message || err);
  }

  return fullRecord;
}

export async function updateDiamondTransactionNoteDoc(recordId: string, note: string): Promise<void> {
  const currentCached = getCachedDiamondTransactions();
  const updatedCached = currentCached.map((r) => (r.id === recordId ? { ...r, note } : r));
  setCachedDiamondTransactions(updatedCached);

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
  const currentCached = getCachedDiamondTransactions();
  const filtered = currentCached.filter((r) => r.id !== recordId);
  setCachedDiamondTransactions(filtered);

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

export const DEFAULT_QUEUE_ANNOUNCEMENT: QueueAnnouncementSettings = {
  textTh: '📢 สมาชิกที่ต้องการขอรับไอเทม กรุณาติดต่อ Admin เพื่อเพิ่มรายชื่อลงในคิว',
  textEn: '📢 Members who wish to receive items, please contact an Admin to be added to the queue.',
  enabled: true
};

export function subscribeToQueueAnnouncementSettings(
  callback: (settings: QueueAnnouncementSettings) => void
) {
  const ref = doc(db, APP_SETTINGS_COLLECTION, 'queue_announcement');
  return onSnapshot(
    ref,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as QueueAnnouncementSettings;
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('k7_queue_announcement_config', JSON.stringify(data));
          }
        } catch {}
        callback(data);
      } else {
        callback(DEFAULT_QUEUE_ANNOUNCEMENT);
      }
    },
    (err) => {
      console.warn('Firestore queue announcement sync notice:', err);
      let cached: QueueAnnouncementSettings | null = null;
      try {
        if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem('k7_queue_announcement_config');
          if (raw) cached = JSON.parse(raw);
        }
      } catch {}
      callback(cached || DEFAULT_QUEUE_ANNOUNCEMENT);
    }
  );
}

export async function saveQueueAnnouncementSettingsDoc(settings: QueueAnnouncementSettings) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('k7_queue_announcement_config', JSON.stringify(settings));
    }
  } catch {}
  const cleanData = sanitizeForFirestore({
    ...settings,
    updatedAt: Date.now()
  });
  const ref = doc(db, APP_SETTINGS_COLLECTION, 'queue_announcement');
  await safeFirestoreWrite(setDoc(ref, cleanData, { merge: true }), 1200, 'saveQueueAnnouncementSettingsDoc');
}

// 9. Discord Webhook Integration Settings
export const DEFAULT_DISCORD_SETTINGS: DiscordSettings = {
  webhookUrl: '',
  distributeWebhookUrl: '',
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
      const localDistWebhook = localStorage.getItem('vault_discord_distribute_webhook_url') || '';
      if (localDistWebhook && !cached.distributeWebhookUrl) {
        cached.distributeWebhookUrl = localDistWebhook;
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
      let localDistWebhook = '';
      if (typeof window !== 'undefined') {
        try {
          localWebhook = localStorage.getItem('vault_discord_webhook_url') || '';
          localDistWebhook = localStorage.getItem('vault_discord_distribute_webhook_url') || '';
        } catch {}
      }

      if (docSnap.exists()) {
        const data = docSnap.data() as DiscordSettings;
        const effectiveWebhook = (data.webhookUrl && data.webhookUrl.trim()) || localWebhook;
        const effectiveDistWebhook = (data.distributeWebhookUrl && data.distributeWebhookUrl.trim()) || localDistWebhook;
        if (effectiveWebhook && typeof window !== 'undefined') {
          try {
            localStorage.setItem('vault_discord_webhook_url', effectiveWebhook);
          } catch {}
        }
        if (effectiveDistWebhook && typeof window !== 'undefined') {
          try {
            localStorage.setItem('vault_discord_distribute_webhook_url', effectiveDistWebhook);
          } catch {}
        }
        const full: DiscordSettings = {
          ...DEFAULT_DISCORD_SETTINGS,
          ...data,
          webhookUrl: effectiveWebhook,
          distributeWebhookUrl: effectiveDistWebhook
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
  const targetDistWebhook = typeof settings.distributeWebhookUrl === 'string' ? settings.distributeWebhookUrl.trim() : '';
  if (typeof window !== 'undefined') {
    try {
      if (targetWebhook) {
        localStorage.setItem('vault_discord_webhook_url', targetWebhook);
      }
      if (targetDistWebhook) {
        localStorage.setItem('vault_discord_distribute_webhook_url', targetDistWebhook);
      } else {
        localStorage.removeItem('vault_discord_distribute_webhook_url');
      }
      localStorage.setItem('vault_discord_settings', JSON.stringify({
        ...settings,
        webhookUrl: targetWebhook,
        distributeWebhookUrl: targetDistWebhook
      }));
    } catch {}
  }
  const cleanData = sanitizeForFirestore({
    ...settings,
    webhookUrl: targetWebhook,
    distributeWebhookUrl: targetDistWebhook,
    updatedAt: Date.now()
  });
  const ref = doc(db, APP_SETTINGS_COLLECTION, 'discord');
  await safeFirestoreWrite(setDoc(ref, cleanData, { merge: true }), 1200, 'saveDiscordSettingsDoc');
}

// 9f. Monthly Stat Update Window Settings (Owner-controlled lock/unlock)
export function getCachedStatUpdateSettings(): StatUpdateSettings {
  if (typeof window === 'undefined') return DEFAULT_STAT_UPDATE_SETTINGS;
  try {
    const raw = localStorage.getItem('l2m_stat_update_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_STAT_UPDATE_SETTINGS,
        ...parsed
      };
    }
  } catch {}
  return DEFAULT_STAT_UPDATE_SETTINGS;
}

export function listenToStatUpdateSettings(callback: (settings: StatUpdateSettings) => void): () => void {
  const ref = doc(db, APP_SETTINGS_COLLECTION, 'stat_updates');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<StatUpdateSettings>;
        const full: StatUpdateSettings = {
          ...DEFAULT_STAT_UPDATE_SETTINGS,
          ...data
        };
        try {
          localStorage.setItem('l2m_stat_update_settings', JSON.stringify(full));
        } catch {}
        callback(full);
      } else {
        callback(getCachedStatUpdateSettings());
      }
    },
    (err) => {
      console.warn('Firestore stat update settings sync notice:', err);
      notifyQuotaExceeded(err);
      callback(getCachedStatUpdateSettings());
    }
  );
}

export async function saveStatUpdateSettingsDoc(settings: StatUpdateSettings) {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('l2m_stat_update_settings', JSON.stringify(settings));
    } catch {}
  }
  const cleanData = sanitizeForFirestore({
    ...settings,
    updatedAt: Date.now()
  });
  const ref = doc(db, APP_SETTINGS_COLLECTION, 'stat_updates');
  await safeFirestoreWrite(setDoc(ref, cleanData, { merge: true }), 1200, 'saveStatUpdateSettingsDoc');
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
  syncMeta?: {
    deletedUsers?: Record<string, number>;
    [key: string]: any;
  };
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
      let existingUsersSnap: any = null;
      try {
        existingUsersSnap = await getDocs(collection(db, USERS_COLLECTION));
      } catch (e) {
        console.warn('Notice: Could not read existing users for sync guard:', e);
      }
      const existingUserMap = new Map<string, any>();
      if (existingUsersSnap) {
        existingUsersSnap.forEach((d: any) => existingUserMap.set(d.id, d.data()));
      }

      const deletedUserMap: Record<string, number> = {
        ...getDeletedIdsMap(DELETED_USERS_KEY),
        ...(payload.syncMeta?.deletedUsers || {})
      };

      const safeUsersToWrite = payload.users.filter((incomingUser) => {
        if (!incomingUser || !incomingUser.id) return false;
        // Never restore shadow or deleted users from backup
        if (incomingUser.status === 'deleted' || incomingUser.status === 'shadow' || incomingUser.isAuthShadow) {
          return false;
        }

        const existing = existingUserMap.get(incomingUser.id);
        if (existing) {
          // If Firestore currently has status 'deleted', preserve it! Never overwrite to active!
          if (existing.status === 'deleted') return false;
          // If Firestore currently has status 'shadow' or isAuthShadow, preserve it!
          if (existing.status === 'shadow' || existing.isAuthShadow) return false;

          // Conflict resolution: preserve newer existing updatedAt
          const existingRev = Number(existing.updatedAt || existing.createdAt || 0);
          const incomingRev = Number(incomingUser.updatedAt || incomingUser.createdAt || 0);
          if (existingRev > incomingRev) return false;
        } else {
          // If doc does not exist yet (e.g. empty database disaster recovery):
          // Check if user is known to be deleted in tombstones
          if (deletedUserMap[incomingUser.id]) {
            return false;
          }
        }

        return true;
      });

      if (safeUsersToWrite.length > 0) {
        await writeInBatches(safeUsersToWrite, USERS_COLLECTION);
      }
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

    // Sync all tombstones to Firestore cloud storage so they survive restore/failover
    const tombstonePayload: Record<string, any> = {
      deletedUsers: {
        ...getDeletedIdsMap(DELETED_USERS_KEY),
        ...(payload.syncMeta?.deletedUsers || {})
      },
      deletedVaultItems: {
        ...getDeletedIdsMap(DELETED_VAULT_ITEMS_KEY),
        ...(payload.syncMeta?.deletedVaultItems || {})
      },
      deletedQueueItems: {
        ...getDeletedIdsMap(DELETED_QUEUE_ITEMS_KEY),
        ...(payload.syncMeta?.deletedQueueItems || {})
      },
      deletedGeneralItems: {
        ...getDeletedIdsMap(DELETED_GENERAL_ITEMS_KEY),
        ...(payload.syncMeta?.deletedGeneralItems || {})
      },
      removedQueueMembers: {
        ...getDeletedIdsMap(REMOVED_QUEUE_MEMBERS_KEY),
        ...(payload.syncMeta?.removedQueueMembers || {})
      },
      cancelledClaims: {
        ...getDeletedIdsMap('l2m_cancelled_claims_map'),
        ...(payload.syncMeta?.cancelledClaims || {})
      },
      updatedAt: Date.now()
    };
    try {
      await safeFirestoreWrite(
        setDoc(doc(db, 'system', 'tombstones'), tombstonePayload, { merge: true }),
        1200,
        'syncBackup_tombstones'
      );
      writtenCount++;
    } catch (e) {
      console.warn('Notice: Firestore tombstone sync in syncBackupToFirestore skipped:', e);
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

