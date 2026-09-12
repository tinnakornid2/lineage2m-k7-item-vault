import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  onSnapshot
} from 'firebase/firestore';
import { db, sanitizeForFirestore } from './firebase';
import {
  BossItem,
  BossEvent,
  BossResetTimeConfigs,
  BossTrackerSettings
} from '../types';
import {
  INITIAL_BOSSES,
  INITIAL_EVENTS,
  INITIAL_RESET_TIME_CONFIGS,
  INITIAL_TRACKER_SETTINGS
} from '../data/initialBossData';

export const BOSS_TIMERS_COLLECTION = 'boss_timers';
export const BOSS_EVENTS_COLLECTION = 'boss_events';
export const BOSS_CONFIG_DOC = 'boss_tracker_config';

/**
 * Real-time listener for all bosses
 */
export function listenToBosses(callback: (bosses: BossItem[]) => void): () => void {
  const colRef = collection(db, BOSS_TIMERS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      if (snapshot.empty) {
        // If Firestore is empty, seed with initial data in background
        seedBossDataIfEmpty().catch(console.error);
        callback(INITIAL_BOSSES);
        return;
      }
      const list: BossItem[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as BossItem;
        list.push({ ...data, id: Number(data.id || d.id) });
      });
      // Sort by ID
      list.sort((a, b) => a.id - b.id);
      callback(list);
    },
    (err) => {
      console.warn('listenToBosses error, falling back to local data:', err);
      callback(INITIAL_BOSSES);
    }
  );
}

/**
 * Real-time listener for clan events
 */
export function listenToBossEvents(callback: (events: BossEvent[]) => void): () => void {
  const colRef = collection(db, BOSS_EVENTS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      if (snapshot.empty) {
        callback(INITIAL_EVENTS);
        return;
      }
      const list: BossEvent[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as BossEvent;
        list.push({ ...data, id: Number(data.id || d.id) });
      });
      list.sort((a, b) => a.id - b.id);
      callback(list);
    },
    (err) => {
      console.warn('listenToBossEvents error, falling back to local events:', err);
      callback(INITIAL_EVENTS);
    }
  );
}

/**
 * Real-time listener for tracker settings & maintenance reset offsets
 */
export function listenToBossTrackerConfig(
  callback: (data: { settings: BossTrackerSettings; resetTimeConfigs: BossResetTimeConfigs }) => void
): () => void {
  const docRef = doc(db, 'app_settings', BOSS_CONFIG_DOC);
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        callback({
          settings: INITIAL_TRACKER_SETTINGS,
          resetTimeConfigs: INITIAL_RESET_TIME_CONFIGS
        });
        return;
      }
      const val = snapshot.data() || {};
      callback({
        settings: { ...INITIAL_TRACKER_SETTINGS, ...(val.settings || {}) },
        resetTimeConfigs: { ...INITIAL_RESET_TIME_CONFIGS, ...(val.resetTimeConfigs || {}) }
      });
    },
    (err) => {
      console.warn('listenToBossTrackerConfig error:', err);
      callback({
        settings: INITIAL_TRACKER_SETTINGS,
        resetTimeConfigs: INITIAL_RESET_TIME_CONFIGS
      });
    }
  );
}

/**
 * Seeds initial 89 bosses, 3 events, and configs to Firestore if not already present
 */
export async function seedBossDataIfEmpty(): Promise<void> {
  try {
    const colRef = collection(db, BOSS_TIMERS_COLLECTION);
    const snap = await getDocs(colRef);
    if (!snap.empty) return; // Already seeded

    console.log('⚡ Seeding initial 89 bosses to Cloud Firestore...');
    const chunks = [];
    const chunkSize = 400;
    for (let i = 0; i < INITIAL_BOSSES.length; i += chunkSize) {
      chunks.push(INITIAL_BOSSES.slice(i, i + chunkSize));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      for (const boss of chunk) {
        const dRef = doc(db, BOSS_TIMERS_COLLECTION, String(boss.id));
        batch.set(dRef, sanitizeForFirestore(boss));
      }
      await batch.commit();
    }

    // Seed events
    const eventBatch = writeBatch(db);
    for (const ev of INITIAL_EVENTS) {
      const dRef = doc(db, BOSS_EVENTS_COLLECTION, String(ev.id));
      eventBatch.set(dRef, sanitizeForFirestore(ev));
    }
    await eventBatch.commit();

    // Seed settings & reset configs
    const configRef = doc(db, 'app_settings', BOSS_CONFIG_DOC);
    await setDoc(
      configRef,
      sanitizeForFirestore({
        settings: INITIAL_TRACKER_SETTINGS,
        resetTimeConfigs: INITIAL_RESET_TIME_CONFIGS,
        seededAt: Date.now()
      })
    );

    console.log('✅ Boss Tracker data seeded successfully!');
  } catch (e) {
    console.error('Failed to seed Boss Tracker data:', e);
  }
}

/**
 * Record boss kill time -> calculates next_spawn automatically
 */
export async function recordBossKill(
  boss: BossItem,
  killTimeIso: string,
  reporter: string = 'Admin'
): Promise<BossItem> {
  const killDate = new Date(killTimeIso);
  const nextSpawnIso = new Date(killDate.getTime() + boss.interval * 60000).toISOString();

  const updates: Partial<BossItem> = {
    last_kill_time: killTimeIso,
    next_spawn: nextSpawnIso,
    pinned_alive: false,
    auto_advanced: false,
    post_maintenance: false,
    pre_spawned: false,
    updated_at: new Date().toISOString(),
    last_reporter: reporter
  };

  const docRef = doc(db, BOSS_TIMERS_COLLECTION, String(boss.id));
  await updateDoc(docRef, sanitizeForFirestore(updates));
  return { ...boss, ...updates };
}

/**
 * Record expected next spawn time directly -> back-calculates kill time
 */
export async function recordBossNextSpawn(
  boss: BossItem,
  spawnTimeIso: string,
  reporter: string = 'Admin'
): Promise<BossItem> {
  const spawnDate = new Date(spawnTimeIso);
  const killTimeIso = new Date(spawnDate.getTime() - boss.interval * 60000).toISOString();

  const updates: Partial<BossItem> = {
    last_kill_time: killTimeIso,
    next_spawn: spawnTimeIso,
    pinned_alive: false,
    auto_advanced: false,
    post_maintenance: false,
    pre_spawned: false,
    updated_at: new Date().toISOString(),
    last_reporter: reporter
  };

  const docRef = doc(db, BOSS_TIMERS_COLLECTION, String(boss.id));
  await updateDoc(docRef, sanitizeForFirestore(updates));
  return { ...boss, ...updates };
}

/**
 * Advance boss by +1 interval cycle (useful for 50% chance bosses that didn't spawn)
 */
export async function advanceBossCycle(boss: BossItem): Promise<BossItem> {
  const baseTime = boss.next_spawn ? new Date(boss.next_spawn).getTime() : Date.now();
  const nextSpawnIso = new Date(baseTime + boss.interval * 60000).toISOString();

  const updates: Partial<BossItem> = {
    next_spawn: nextSpawnIso,
    auto_advanced: true,
    pinned_alive: false,
    updated_at: new Date().toISOString()
  };

  const docRef = doc(db, BOSS_TIMERS_COLLECTION, String(boss.id));
  await updateDoc(docRef, sanitizeForFirestore(updates));
  return { ...boss, ...updates };
}

/**
 * Toggle Pinned Alive status
 */
export async function togglePinBoss(boss: BossItem): Promise<BossItem> {
  const newPinned = !boss.pinned_alive;
  const updates: Partial<BossItem> = {
    pinned_alive: newPinned,
    updated_at: new Date().toISOString()
  };

  const docRef = doc(db, BOSS_TIMERS_COLLECTION, String(boss.id));
  await updateDoc(docRef, sanitizeForFirestore(updates));
  return { ...boss, ...updates };
}

/**
 * Apply Server Maintenance Reset
 * Recalculates next_spawn for all bosses that have an entry in resetTimeConfigs
 */
export async function applyMaintenanceReset(
  serverOpenIso: string,
  bosses: BossItem[],
  configs: BossResetTimeConfigs
): Promise<number> {
  const openTimeMs = new Date(serverOpenIso).getTime();
  if (isNaN(openTimeMs)) throw new Error('Invalid server open date');

  const batch = writeBatch(db);
  let count = 0;

  for (const boss of bosses) {
    const cfg = configs[boss.name];
    if (cfg) {
      const offsetMs = (cfg.hours * 60 + cfg.minutes) * 60000;
      const nextSpawnIso = new Date(openTimeMs + offsetMs).toISOString();
      const docRef = doc(db, BOSS_TIMERS_COLLECTION, String(boss.id));
      batch.update(
        docRef,
        sanitizeForFirestore({
          last_kill_time: serverOpenIso,
          next_spawn: nextSpawnIso,
          post_maintenance: true,
          auto_advanced: false,
          pinned_alive: false,
          updated_at: new Date().toISOString()
        })
      );
      count++;
    }
  }

  if (count > 0) {
    await batch.commit();
  }
  return count;
}

/**
 * Cancel Maintenance Mode for all bosses
 */
export async function cancelMaintenanceMode(bosses: BossItem[]): Promise<void> {
  const batch = writeBatch(db);
  for (const boss of bosses) {
    if (boss.post_maintenance) {
      const docRef = doc(db, BOSS_TIMERS_COLLECTION, String(boss.id));
      batch.update(docRef, { post_maintenance: false });
    }
  }
  await batch.commit();
}

/**
 * Save updated maintenance offset configurations
 */
export async function saveResetTimeConfigs(configs: BossResetTimeConfigs): Promise<void> {
  const docRef = doc(db, 'app_settings', BOSS_CONFIG_DOC);
  await setDoc(docRef, sanitizeForFirestore({ resetTimeConfigs: configs }), { merge: true });
}

/**
 * Update tracker settings (e.g. sound defaults, alert minutes, announcement)
 */
export async function saveTrackerSettings(settings: Partial<BossTrackerSettings>): Promise<void> {
  const docRef = doc(db, 'app_settings', BOSS_CONFIG_DOC);
  await setDoc(docRef, sanitizeForFirestore({ settings }), { merge: true });
}

/**
 * Add or update announcement banner
 */
export async function updateAnnouncement(announcement: string): Promise<void> {
  const docRef = doc(db, 'app_settings', BOSS_CONFIG_DOC);
  await setDoc(
    docRef,
    sanitizeForFirestore({
      settings: {
        announcement: {
          message: announcement,
          sent_by: 'Admin',
          resent_at: new Date().toISOString()
        }
      }
    }),
    { merge: true }
  );
}

/**
 * Create a new boss
 */
export async function createBoss(
  data: {
    name: string;
    location?: string;
    interval: number;
    chance_of_appearing?: string;
    is_invasion?: boolean;
    last_kill_time?: string | null;
  },
  existingBosses: BossItem[]
): Promise<BossItem> {
  const maxId = existingBosses.reduce((max, b) => Math.max(max, b.id || 0), 0);
  const newId = maxId + 1;

  let spawnTime: string | null = null;
  if (data.last_kill_time) {
    spawnTime = new Date(new Date(data.last_kill_time).getTime() + data.interval * 60000).toISOString();
  }

  const newBoss: BossItem = {
    id: newId,
    name: data.name.trim(),
    location: (data.location || '').trim(),
    interval: Number(data.interval) || 60,
    chance_of_appearing: data.chance_of_appearing || '100.00',
    is_invasion: Boolean(data.is_invasion),
    last_kill_time: data.last_kill_time || null,
    next_spawn: spawnTime,
    auto_advanced: false,
    post_maintenance: false,
    pinned_alive: false,
    pre_spawned: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const docRef = doc(db, BOSS_TIMERS_COLLECTION, String(newId));
  await setDoc(docRef, sanitizeForFirestore(newBoss));
  return newBoss;
}

/**
 * Update an existing boss
 */
export async function updateBoss(bossId: number, data: Partial<BossItem>): Promise<void> {
  const docRef = doc(db, BOSS_TIMERS_COLLECTION, String(bossId));
  await updateDoc(docRef, sanitizeForFirestore({ ...data, updated_at: new Date().toISOString() }));
}

/**
 * Delete a boss
 */
export async function deleteBoss(bossId: number): Promise<void> {
  const docRef = doc(db, BOSS_TIMERS_COLLECTION, String(bossId));
  await deleteDoc(docRef);
}

/**
 * Mark event done for today
 */
export async function markEventDone(event: BossEvent): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const docRef = doc(db, BOSS_EVENTS_COLLECTION, String(event.id));
  await updateDoc(docRef, { done_on: today, updated_at: new Date().toISOString() });
}

/**
 * Skip event to next interval
 */
export async function skipEvent(event: BossEvent): Promise<void> {
  const baseTime = event.next_spawn ? new Date(event.next_spawn).getTime() : Date.now();
  const nextIso = new Date(baseTime + 86400000).toISOString();
  const docRef = doc(db, BOSS_EVENTS_COLLECTION, String(event.id));
  await updateDoc(docRef, { next_spawn: nextIso, done_on: null, updated_at: new Date().toISOString() });
}

/**
 * Pin event as active
 */
export async function togglePinEvent(event: BossEvent): Promise<void> {
  const docRef = doc(db, BOSS_EVENTS_COLLECTION, String(event.id));
  await updateDoc(docRef, { pinned_alive: !event.pinned_alive, updated_at: new Date().toISOString() });
}
