import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  connectAuthEmulator,
  deleteUser as deleteAuthUser,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
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
import {
  REAL_BACKUP_MEMBERS,
  REAL_BACKUP_CLANS,
  REAL_BACKUP_QUEUES,
  REAL_BACKUP_VAULT_ITEMS,
  REAL_BACKUP_DIAMOND_TXS
} from '../data/offlineMembersData';

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

export const INITIAL_QUICK_ITEMS: QuickItem[] = [
  {
    id: 'qi_1',
    name: "Archangel's Sword",
    rarity: 'MYTHIC',
    imageUrl: 'https://images.unsplash.com/photo-1595590424283-b8f17842773f?w=300&auto=format&fit=crop&q=80',
    createdAt: Date.now(),
  },
  {
    id: 'qi_2',
    name: 'Dainsleif Dual Blade',
    rarity: 'LAGEND',
    quantity: 1,
    imageUrl: 'https://images.unsplash.com/photo-1589241062272-c0a000072dfa?w=300&auto=format&fit=crop&q=80',
    createdAt: Date.now(),
  },
  {
    id: 'qi_3',
    name: 'Dragonic Bow',
    rarity: 'EPIC',
    imageUrl: 'https://images.unsplash.com/photo-1514539079130-25950c84af65?w=300&auto=format&fit=crop&q=80',
    createdAt: Date.now(),
  },
  {
    id: 'qi_4',
    name: 'Tateossian Ring',
    rarity: 'RARE',
    imageUrl: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=300&auto=format&fit=crop&q=80',
    createdAt: Date.now(),
  }
];

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

// LocalStorage caching keys to prevent data loss on quota limits or network errors
export const CACHE_KEYS = {
  USERS: 'l2m_cached_users',
  VAULT_ITEMS: 'l2m_cached_vault_items',
  QUEUES: 'l2m_cached_queues',
  CLANS: 'l2m_cached_clans',
  DIAMOND_TXS: 'l2m_cached_diamond_txs',
  QUICK_ITEMS: 'l2m_cached_quick_items'
};

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
  return getCachedData<User[]>(CACHE_KEYS.USERS, INITIAL_MEMBERS);
}

export function getCachedVaultItems(): VaultItem[] {
  return getCachedData<VaultItem[]>(CACHE_KEYS.VAULT_ITEMS, INITIAL_VAULT_ITEMS);
}

export function getCachedClans(): ClanGroup[] {
  return getCachedData<ClanGroup[]>(CACHE_KEYS.CLANS, INITIAL_CLANS);
}

export function getCachedQueues(): QueueItem[] {
  return getCachedData<QueueItem[]>(CACHE_KEYS.QUEUES, INITIAL_QUEUES);
}

export function getCachedDiamondTransactions(): DiamondVaultRecord[] {
  return getCachedData<DiamondVaultRecord[]>(CACHE_KEYS.DIAMOND_TXS, REAL_BACKUP_DIAMOND_TXS || []);
}

let onQuotaExceededCallback: ((isQuotaExceeded: boolean) => void) | null = null;

export function setOnQuotaExceededListener(cb: (isQuotaExceeded: boolean) => void) {
  onQuotaExceededCallback = cb;
}

export function notifyQuotaExceeded(err: any) {
  const msg = (err?.message || '').toLowerCase();
  if (msg.includes('quota') || msg.includes('limit exceeded') || err?.code === 'resource-exhausted') {
    console.warn('⚠️ Firestore Free Tier Read Quota exceeded for today! Operating in offline/cached resilience mode.');
    if (onQuotaExceededCallback) {
      onQuotaExceededCallback(true);
    }
  }
}

// 1. Users Firestore functions
export function listenToUsers(callback: (users: User[]) => void) {
  // Immediately provide cached or fallback users to prevent screen from showing empty
  const initialUsers = getCachedUsers();
  callback(initialUsers);

  const q = collection(db, USERS_COLLECTION);
  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        callback(initialUsers);
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
      callback(getCachedUsers());
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
    await updateDoc(ref, cleanUpdates);
  } catch (err: any) {
    console.error('Failed to update user:', err);
    notifyQuotaExceeded(err);
    const msg = (err?.message || '').toLowerCase();
    if (msg.includes('quota') || msg.includes('resource-exhausted') || err?.code === 'resource-exhausted') {
      return;
    }
    throw err;
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
}) {
  const username = data.username.trim();
  const inGameName = data.inGameName.trim();
  const invalidField = validateRegistration(username, data.password, inGameName);
  if (invalidField) {
    throw new Error(`invalid-registration-${invalidField}`);
  }

  let newId = '';
  let authCreated = false;

  // 1. Try Firebase Authentication first
  try {
    const credential = await createUserWithEmailAndPassword(
      auth,
      usernameToAuthEmail(username),
      data.password
    );
    newId = credential.user.uid;
    authCreated = true;
    await signOut(auth).catch(() => undefined);
  } catch (authErr: any) {
    console.warn('Firebase Auth registration notice:', authErr?.code || authErr?.message);
    if (authErr?.code === 'auth/email-already-in-use') {
      throw authErr;
    }
    // Fallback: Generate an ID for Firestore document
    newId = 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  }

  const newUser: User = {
    id: newId,
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

  const userPayload = authCreated ? newUser : { ...newUser, password: data.password };
  const cleanUser = sanitizeForFirestore(userPayload);

  try {
    await setDoc(doc(db, USERS_COLLECTION, newId), cleanUser);
  } catch (error) {
    console.error('Failed to save user doc to Firestore:', error);
    throw error;
  }
  return newUser;
}

export async function loginUserQuery(username: string, pass: string): Promise<User | null> {
  const cleanUsername = username.trim();
  const lowerUser = cleanUsername.toLowerCase();

  // 1. Check Owner account (Eloni / 0386231334)
  if (lowerUser === 'eloni' && pass === '0386231334') {
    try {
      // 1. Check direct doc ID 'user_owner_eloni' first
      const directSnap = await getDoc(doc(db, USERS_COLLECTION, 'user_owner_eloni'));
      if (directSnap.exists()) {
        const user = { ...DEFAULT_OWNER, ...directSnap.data(), id: 'user_owner_eloni', role: 'owner', status: 'active' } as User;
        saveLocalSessionUser(user);
        return user;
      }

      // 2. Query collection for username
      const snap = await getDocs(query(collection(db, USERS_COLLECTION), where('username', 'in', ['eloni', 'Eloni'])));
      if (!snap.empty) {
        const docSnap = snap.docs[0];
        const user = { ...DEFAULT_OWNER, ...docSnap.data(), id: docSnap.id, role: 'owner', status: 'active' } as User;
        saveLocalSessionUser(user);
        return user;
      }
    } catch (e) {
      notifyQuotaExceeded(e);
      console.warn('Could not query eloni doc, using DEFAULT_OWNER fallback:', e);
    }
    saveLocalSessionUser(DEFAULT_OWNER);
    return DEFAULT_OWNER;
  }

  // 2. Try Firebase Authentication
  try {
    const credential = await signInWithEmailAndPassword(
      auth,
      usernameToAuthEmail(cleanUsername),
      pass
    );
    try {
      const profile = await getDoc(doc(db, USERS_COLLECTION, credential.user.uid));
      if (profile.exists()) {
        const user = { ...profile.data(), id: profile.id } as User;
        saveLocalSessionUser(user);
        return user;
      }
    } catch (readErr) {
      notifyQuotaExceeded(readErr);
      const fallbackList = getCachedUsers();
      const matched = fallbackList.find(u => u.id === credential.user.uid || u.username?.toLowerCase() === lowerUser);
      if (matched) {
        saveLocalSessionUser(matched);
        return matched;
      }
    }
  } catch (authErr: any) {
    console.warn('Firebase Auth sign in notice:', authErr?.code || authErr?.message);
  }

  // 3. Fallback: Search Firestore users collection directly or cached members
  try {
    const snap = await getDocs(collection(db, USERS_COLLECTION));
    let matched: User | null = null;
    snap.forEach((docSnap) => {
      const data = docSnap.data() as User;
      const dbUser = (data.username || '').trim().toLowerCase();
      const dbPass = (data as any).password;
      if (dbUser === lowerUser && (dbPass === pass || !dbPass)) {
        matched = { ...data, id: docSnap.id };
      }
    });

    if (matched) {
      saveLocalSessionUser(matched);
      return matched;
    }
  } catch (dbErr) {
    notifyQuotaExceeded(dbErr);
    console.warn('Firestore login query error, checking cached members:', dbErr);
    const fallbackList = getCachedUsers();
    const matched = fallbackList.find(u => (u.username || '').toLowerCase() === lowerUser && ((u as any).password === pass || !(u as any).password));
    if (matched) {
      saveLocalSessionUser(matched);
      return matched;
    }
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

  const emitCombinedItems = () => {
    const combinedList = latestItems.map((item) => {
      const claims = latestClaims.filter((claim) => claim.itemId === item.id);
      const combined = [...(item.claimants || []), ...claims];
      const deduplicated = combined.filter((claim, index, all) =>
        all.findIndex((candidate) => candidate.userId === claim.userId) === index
      );
      return { ...item, claimants: deduplicated };
    });
    setCachedData(CACHE_KEYS.VAULT_ITEMS, combinedList);
    callback(combinedList);
  };

  const unsubItems = onSnapshot(
    collection(db, ITEMS_COLLECTION),
    (snapshot) => {
      if (snapshot.empty) {
        latestItems = INITIAL_VAULT_ITEMS;
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
        items.push(item);
      });
      latestItems = items;
      emitCombinedItems();
    },
    (err) => {
      console.warn('Firestore vault items listener fallback to cache:', err);
      notifyQuotaExceeded(err);
      callback(getCachedVaultItems());
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
  await setDoc(doc(db, ITEM_CLAIMS_COLLECTION, itemClaimDocumentId(itemId, claimant.userId)), claim);

  // Backward compatibility: Keep claimants array on the item document updated
  try {
    const itemRef = doc(db, ITEMS_COLLECTION, itemId);
    const itemSnap = await getDoc(itemRef);
    if (itemSnap.exists()) {
      const existing = (itemSnap.data().claimants || []) as Claimant[];
      if (!existing.some((c) => c.userId === claimant.userId)) {
        await updateDoc(itemRef, {
          claimants: [...existing, sanitizeForFirestore(claimant)]
        });
      }
    }
  } catch (err) {
    console.warn('Notice: synced to item_claims; item claimants array sync warning:', err);
  }
}

export async function deleteItemClaimDoc(itemId: string, userId: string) {
  await deleteDoc(doc(db, ITEM_CLAIMS_COLLECTION, itemClaimDocumentId(itemId, userId)));

  // Backward compatibility: Remove from claimants array on the item document
  try {
    const itemRef = doc(db, ITEMS_COLLECTION, itemId);
    const itemSnap = await getDoc(itemRef);
    if (itemSnap.exists()) {
      const existing = (itemSnap.data().claimants || []) as Claimant[];
      const filtered = existing.filter((c) => c.userId !== userId);
      await updateDoc(itemRef, {
        claimants: filtered
      });
    }
  } catch (err) {
    console.warn('Notice: deleted from item_claims; item claimants array sync warning:', err);
  }
}

async function deleteClaimsForItem(itemId: string) {
  const claims = await getDocs(
    query(collection(db, ITEM_CLAIMS_COLLECTION), where('itemId', '==', itemId))
  );
  await Promise.all(claims.docs.map((claimDoc) => deleteDoc(claimDoc.ref)));
}

export async function addVaultItemDoc(item: Omit<VaultItem, 'id' | 'createdAt'>) {
  const newId = 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
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
  const cleanItem = sanitizeForFirestore(fullItem);
  try {
    await setDoc(doc(db, ITEMS_COLLECTION, newId), cleanItem);
  } catch (err: any) {
    console.error('Failed to setDoc in addVaultItemDoc:', err);
    notifyQuotaExceeded(err);
    const msg = (err?.message || '').toLowerCase();
    if (msg.includes('quota') || msg.includes('resource-exhausted') || err?.code === 'resource-exhausted') {
      return fullItem;
    }
    throw err;
  }
  return fullItem;
}

export async function updateVaultItemDoc(itemId: string, updates: Partial<VaultItem>) {
  try {
    const ref = doc(db, ITEMS_COLLECTION, itemId);
    const cleanUpdates = sanitizeForFirestore(updates);
    await updateDoc(ref, cleanUpdates);
  } catch (err: any) {
    console.error('Failed to update vault item doc in Firestore:', err);
    notifyQuotaExceeded(err);
    const msg = (err?.message || '').toLowerCase();
    if (msg.includes('quota') || msg.includes('resource-exhausted') || err?.code === 'resource-exhausted') {
      return;
    }
    throw err;
  }
}

export async function deleteVaultItemDoc(itemId: string) {
  try {
    await deleteClaimsForItem(itemId);
    const ref = doc(db, ITEMS_COLLECTION, itemId);
    await deleteDoc(ref);
  } catch (err: any) {
    console.error('Failed to delete vault item doc in Firestore:', err);
    notifyQuotaExceeded(err);
    const msg = (err?.message || '').toLowerCase();
    if (msg.includes('quota') || msg.includes('resource-exhausted') || err?.code === 'resource-exhausted') {
      return;
    }
    throw err;
  }
}

// Owner Clear & Reset Functions for Vault Items
export async function clearDistributedVaultItemsDoc(): Promise<number> {
  const snap = await getDocs(collection(db, ITEMS_COLLECTION));
  const batch = writeBatch(db);
  let count = 0;
  snap.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.status === 'distributed') {
      batch.delete(docSnap.ref);
      count++;
    }
  });
  if (count > 0) {
    await batch.commit();
    await Promise.all(
      snap.docs
        .filter((itemDoc) => itemDoc.data().status === 'distributed')
        .map((itemDoc) => deleteClaimsForItem(itemDoc.id))
    );
  }
  return count;
}

export async function clearAllVaultItemsDoc(): Promise<number> {
  const snap = await getDocs(collection(db, ITEMS_COLLECTION));
  const batch = writeBatch(db);
  let count = 0;
  snap.forEach((docSnap) => {
    batch.delete(docSnap.ref);
    count++;
  });
  if (count > 0) {
    await batch.commit();
    const claims = await getDocs(collection(db, ITEM_CLAIMS_COLLECTION));
    await Promise.all(claims.docs.map((claimDoc) => deleteDoc(claimDoc.ref)));
  }
  return count;
}

// 3. Queue Items Firestore functions
export function listenToQueueItems(callback: (queues: QueueItem[]) => void) {
  const initialQueues = getCachedQueues();
  callback(initialQueues);

  const q = collection(db, QUEUES_COLLECTION);
  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        callback(initialQueues);
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
      setCachedData(CACHE_KEYS.QUEUES, queues);
      callback(queues);
    },
    (err) => {
      console.warn('Firestore queue listener fallback to initial/cached queues:', err);
      notifyQuotaExceeded(err);
      callback(getCachedQueues());
    }
  );
}

export async function addQueueItemDoc(item: Omit<QueueItem, 'id' | 'createdAt'>) {
  const newId = 'queue_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const fullQueue: QueueItem = {
    ...item,
    queueList: (item.queueList || []).map((qm) => ({
      ...qm,
      clan: cleanClanName(qm.clan)
    })),
    id: newId,
    createdAt: Date.now()
  };
  const cleanQueue = sanitizeForFirestore(fullQueue);
  try {
    await setDoc(doc(db, QUEUES_COLLECTION, newId), cleanQueue);
  } catch (err) {
    console.error('Failed to setDoc in addQueueItemDoc:', err);
    throw err;
  }
  return fullQueue;
}

export async function updateQueueItemDoc(queueId: string, updates: Partial<QueueItem>) {
  try {
    const ref = doc(db, QUEUES_COLLECTION, queueId);
    const cleanUpdates = sanitizeForFirestore(updates);
    await updateDoc(ref, cleanUpdates);
  } catch (err) {
    console.error('Failed to update queue item doc in Firestore:', err);
    throw err;
  }
}

export async function deleteQueueItemDoc(queueId: string) {
  try {
    const ref = doc(db, QUEUES_COLLECTION, queueId);
    await deleteDoc(ref);
  } catch (err) {
    console.error('Failed to delete queue item doc in Firestore:', err);
    throw err;
  }
}

export async function clearAllQueuesDoc(): Promise<number> {
  const snap = await getDocs(collection(db, QUEUES_COLLECTION));
  const batch = writeBatch(db);
  let count = 0;
  snap.forEach((docSnap) => {
    batch.delete(docSnap.ref);
    count++;
  });
  if (count > 0) {
    await batch.commit();
  }
  return count;
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
    await batch.commit();
  }
  return count;
}

export async function resetToDefaultVaultDataDoc(): Promise<void> {
  // 1. Delete all current items
  const itemsSnap = await getDocs(collection(db, ITEMS_COLLECTION));
  const batch1 = writeBatch(db);
  itemsSnap.forEach((docSnap) => batch1.delete(docSnap.ref));
  await batch1.commit();
  const claimsSnap = await getDocs(collection(db, ITEM_CLAIMS_COLLECTION));
  await Promise.all(claimsSnap.docs.map((claimDoc) => deleteDoc(claimDoc.ref)));

  // 2. Re-seed default items
  const batch2 = writeBatch(db);
  for (const item of INITIAL_VAULT_ITEMS) {
    batch2.set(doc(db, ITEMS_COLLECTION, item.id), item);
  }
  await batch2.commit();

  // 3. Delete all current queues
  const queuesSnap = await getDocs(collection(db, QUEUES_COLLECTION));
  const batch3 = writeBatch(db);
  queuesSnap.forEach((docSnap) => batch3.delete(docSnap.ref));
  await batch3.commit();

  // 4. Re-seed default queues
  const batch4 = writeBatch(db);
  for (const q of INITIAL_QUEUES) {
    batch4.set(doc(db, QUEUES_COLLECTION, q.id), q);
  }
  await batch4.commit();
}

// 4. Quick Items Firestore functions
export function listenToQuickItems(callback: (items: QuickItem[]) => void) {
  const q = collection(db, QUICK_ITEMS_COLLECTION);
  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        callback([]);
        return;
      }
      const items: QuickItem[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ ...docSnap.data(), id: docSnap.id } as QuickItem);
      });
      callback(items);
    },
    (err) => {
      console.warn('Firestore quick items fallback:', err);
      callback([]);
    }
  );
}

export async function addQuickItemDoc(item: Omit<QuickItem, 'id' | 'createdAt'>) {
  const newId = 'qi_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const fallbackImg = 'https://images.unsplash.com/photo-1595590424283-b8f17842773f?w=300&auto=format&fit=crop&q=80';
  const fullItem: QuickItem = {
    id: newId,
    name: item.name ? item.name.trim() : 'Unknown Item',
    rarity: item.rarity || 'LAGEND',
    imageUrl: (item.imageUrl && item.imageUrl.trim().length > 0) ? item.imageUrl : fallbackImg,
    createdAt: Date.now()
  };
  try {
    await setDoc(doc(db, QUICK_ITEMS_COLLECTION, newId), fullItem);
  } catch (err) {
    console.error('Firestore setDoc error in addQuickItemDoc:', err);
    throw err;
  }
  return fullItem;
}

export async function deleteQuickItemDoc(itemId: string) {
  try {
    const ref = doc(db, QUICK_ITEMS_COLLECTION, itemId);
    await deleteDoc(ref);
  } catch (err) {
    console.error('Firestore deleteDoc error in deleteQuickItemDoc:', err);
    throw err;
  }
}

export async function updateQuickItemDoc(itemId: string, updates: Partial<Omit<QuickItem, 'id' | 'createdAt'>>) {
  try {
    const ref = doc(db, QUICK_ITEMS_COLLECTION, itemId);
    const cleanUpdates: any = {};
    if (updates.name !== undefined) cleanUpdates.name = updates.name.trim();
    if (updates.rarity !== undefined) cleanUpdates.rarity = updates.rarity;
    if (updates.imageUrl !== undefined && updates.imageUrl.trim().length > 0) {
      cleanUpdates.imageUrl = updates.imageUrl;
    }
    await updateDoc(ref, cleanUpdates);
  } catch (err) {
    console.error('Firestore updateDoc error in updateQuickItemDoc:', err);
    throw err;
  }
}

// 5. Clans Firestore functions
export function listenToClans(callback: (clans: ClanGroup[]) => void) {
  const initialClans = getCachedClans();
  callback(initialClans);

  const q = collection(db, CLANS_COLLECTION);
  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        callback(initialClans);
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
      callback(getCachedClans());
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
  try {
    await setDoc(doc(db, CLANS_COLLECTION, newId), cleanClan);
  } catch (err) {
    console.error('Failed to setDoc in addClanDoc:', err);
    throw err;
  }
  return fullClan;
}

export async function updateClanDoc(clanId: string, updates: Partial<ClanGroup>) {
  try {
    const ref = doc(db, CLANS_COLLECTION, clanId);
    const sanitized = sanitizeForFirestore({
      ...updates,
      ...(updates.name ? { name: cleanClanName(updates.name) } : {})
    });
    await setDoc(ref, sanitized, { merge: true });
  } catch (err) {
    console.error('Failed to update clan doc:', err);
    throw err;
  }
}

export async function deleteClanDoc(clanId: string) {
  try {
    const ref = doc(db, CLANS_COLLECTION, clanId);
    await deleteDoc(ref);
  } catch (err) {
    console.error('Failed to delete clan doc:', err);
    throw err;
  }
}

// 6. Diamond Vault Transactions Firestore functions
export function listenToDiamondTransactions(
  callback: (logs: DiamondVaultRecord[]) => void,
  maxLogs: number = 50
) {
  const initialTxs = getCachedDiamondTransactions();
  callback(initialTxs);

  // Limit to latest transactions to prevent uncontrolled document reads
  const q = query(
    collection(db, VAULT_COLLECTION),
    orderBy('timestamp', 'desc'),
    limit(maxLogs)
  );
  return onSnapshot(
    q,
    (snapshot) => {
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
      callback(getCachedDiamondTransactions());
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
  try {
    await setDoc(doc(db, VAULT_COLLECTION, newId), cleanRecord);
  } catch (err: any) {
    console.error('Failed to setDoc in addDiamondTransactionDoc:', err);
    notifyQuotaExceeded(err);
    const msg = (err?.message || '').toLowerCase();
    if (msg.includes('quota') || msg.includes('resource-exhausted') || err?.code === 'resource-exhausted') {
      return fullRecord;
    }
    throw err;
  }
  return fullRecord;
}

export async function updateDiamondTransactionNoteDoc(recordId: string, note: string): Promise<void> {
  try {
    await updateDoc(doc(db, VAULT_COLLECTION, recordId), {
      note: note || ''
    });
  } catch (err) {
    console.error('Failed to updateDiamondTransactionNoteDoc:', err);
    throw err;
  }
}

export async function deleteDiamondTransactionDoc(recordId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, VAULT_COLLECTION, recordId));
  } catch (err) {
    console.error('Failed to deleteDiamondTransactionDoc:', err);
    throw err;
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
  const cleanData = sanitizeForFirestore({
    ...settings,
    updatedAt: Date.now()
  });
  try {
    const ref = doc(db, APP_SETTINGS_COLLECTION, 'background');
    await setDoc(ref, cleanData, { merge: true });
  } catch (err) {
    console.error('Failed to save background settings to Firestore:', err);
    throw err;
  }
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
        callback(docSnap.data() as AnnouncementSettings);
      } else {
        callback(DEFAULT_ANNOUNCEMENT);
      }
    },
    (err) => {
      console.warn('Firestore announcement sync notice:', err);
      callback(DEFAULT_ANNOUNCEMENT);
    }
  );
}

export async function saveAnnouncementSettingsDoc(settings: AnnouncementSettings) {
  const cleanData = sanitizeForFirestore({
    ...settings,
    updatedAt: Date.now()
  });
  try {
    const ref = doc(db, APP_SETTINGS_COLLECTION, 'announcement');
    await setDoc(ref, cleanData, { merge: true });
  } catch (err) {
    console.error('Failed to save announcement to Firestore:', err);
    throw err;
  }
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

export function listenToDiscordSettings(
  callback: (settings: DiscordSettings | null) => void
) {
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
        callback({
          ...DEFAULT_DISCORD_SETTINGS,
          ...data,
          webhookUrl: effectiveWebhook
        });
      } else {
        callback({
          ...DEFAULT_DISCORD_SETTINGS,
          webhookUrl: localWebhook
        });
      }
    },
    (err) => {
      console.warn('Firestore discord settings sync notice:', err);
      let localWebhook = '';
      if (typeof window !== 'undefined') {
        try {
          localWebhook = localStorage.getItem('vault_discord_webhook_url') || '';
        } catch {}
      }
      callback({
        ...DEFAULT_DISCORD_SETTINGS,
        webhookUrl: localWebhook
      });
    }
  );
}

export async function saveDiscordSettingsDoc(settings: DiscordSettings) {
  const targetWebhook = typeof settings.webhookUrl === 'string' ? settings.webhookUrl.trim() : '';
  const cleanData = sanitizeForFirestore({
    ...settings,
    webhookUrl: targetWebhook,
    updatedAt: Date.now()
  });
  try {
    const ref = doc(db, APP_SETTINGS_COLLECTION, 'discord');
    await setDoc(ref, cleanData, { merge: true });
    if (typeof window !== 'undefined' && targetWebhook) {
      try {
        localStorage.setItem('vault_discord_webhook_url', targetWebhook);
      } catch {}
    }
  } catch (err) {
    console.error('Failed to save discord settings to Firestore:', err);
    throw err;
  }
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
  try {
    const ref = doc(db, APP_SETTINGS_COLLECTION, 'character_classes');
    await setDoc(ref, cleanData, { merge: true });
  } catch (err) {
    console.error('Failed to save character classes to Firestore:', err);
    throw err;
  }
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
  await setDoc(ref, {
    apiKey: cleanKey,
    updatedAt: Date.now(),
    updatedBy: updatedBy || 'owner'
  }, { merge: true });

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
  try {
    const ref = doc(db, APP_SETTINGS_COLLECTION, 'power_formula');
    await setDoc(ref, cleanData, { merge: true });
  } catch (err) {
    console.error('Failed to save power_formula to Firestore:', err);
    throw err;
  }
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
    await batch.commit();
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
  clans?: ClanGroup[];
  diamondLogs?: DiamondVaultRecord[];
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
    if (payload.clans && payload.clans.length > 0) {
      await writeInBatches(payload.clans, CLANS_COLLECTION);
    }
    if (payload.diamondLogs && payload.diamondLogs.length > 0) {
      await writeInBatches(payload.diamondLogs, VAULT_COLLECTION);
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
    clans: ClanGroup[];
    diamondLogs: DiamondVaultRecord[];
  };
  message: string;
}> {
  try {
    const [usersSnap, itemsSnap, queuesSnap, clansSnap, vaultSnap] = await Promise.all([
      getDocs(collection(db, USERS_COLLECTION)),
      getDocs(collection(db, ITEMS_COLLECTION)),
      getDocs(collection(db, QUEUES_COLLECTION)),
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

    const clans: ClanGroup[] = [];
    clansSnap.forEach((d) => clans.push({ ...d.data(), id: d.id } as ClanGroup));

    const diamondLogs: DiamondVaultRecord[] = [];
    vaultSnap.forEach((d) => diamondLogs.push({ ...d.data(), id: d.id } as DiamondVaultRecord));

    if (onQuotaExceededCallback) {
      onQuotaExceededCallback(false);
    }

    return {
      success: true,
      data: { users, vaultItems, queueItems, clans, diamondLogs },
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

