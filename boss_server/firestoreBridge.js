const { initializeApp, getApps, getApp } = require('firebase/app');
const {
    getFirestore,
    collection,
    doc,
    setDoc,
    getDocs,
    deleteDoc,
    writeBatch,
    onSnapshot
} = require('firebase/firestore');
const firebaseConfig = require('../firebase-applet-config.json');

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const firestoreDb = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

const BOSS_COLLECTION = 'boss_timers';
const EVENTS_COLLECTION = 'boss_events';
const CONFIG_DOC = 'boss_tracker_config';

let isListening = false;
let isInternalSync = false;

function sanitize(obj) {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sanitize);
    const clean = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v !== undefined) clean[k] = sanitize(v);
    }
    return clean;
}

function initFirestoreSync(db, broadcaster) {
    if (isListening) return;
    isListening = true;

    console.log('🔄 Initializing Real-time Cloud Firestore Bridge (hybrid-box-753bd)...');

    // 1. Seed or Load Bosses
    async function setupBosses() {
        try {
            const colRef = collection(firestoreDb, BOSS_COLLECTION);
            const snapshot = await getDocs(colRef);

            if (snapshot.empty) {
                console.log('⚡ Firestore boss_timers empty. Seeding 89 initial bosses...');
                const bosses = db.getBosses();
                const batch = writeBatch(firestoreDb);
                bosses.forEach((boss) => {
                    const docRef = doc(firestoreDb, BOSS_COLLECTION, String(boss.id));
                    batch.set(docRef, sanitize(boss));
                });
                await batch.commit();
                console.log('✅ Seeded 89 bosses to Cloud Firestore successfully!');
            } else {
                console.log(`📥 Loaded ${snapshot.size} bosses from Cloud Firestore.`);
                snapshot.forEach((d) => {
                    const data = d.data();
                    const numId = Number(data.id || d.id);
                    db.updateBoss(numId, data);
                });
            }

            // Real-time onSnapshot listener for multi-device sync
            onSnapshot(colRef, (snap) => {
                if (isInternalSync) return;
                let hasChanges = false;
                snap.docChanges().forEach((change) => {
                    const data = change.doc.data();
                    const numId = Number(data.id || change.doc.id);
                    if (change.type === 'added' || change.type === 'modified') {
                        db.updateBoss(numId, data);
                        hasChanges = true;
                    } else if (change.type === 'removed') {
                        db.deleteBoss(numId);
                        hasChanges = true;
                    }
                });
                if (hasChanges && broadcaster) {
                    broadcaster.broadcast('bosses.updated', { bosses: db.getBosses() });
                }
            });
        } catch (err) {
            console.warn('⚠️ Firestore boss setup warning:', err.message);
        }
    }

    setupBosses();

    // 2. Export sync helpers
    return {
        async syncBossToFirestore(boss) {
            if (!boss || !boss.id) return;
            try {
                isInternalSync = true;
                await setDoc(doc(firestoreDb, BOSS_COLLECTION, String(boss.id)), sanitize(boss), { merge: true });
            } catch (err) {
                console.warn(`Failed to sync boss ${boss.id} to Firestore:`, err.message);
            } finally {
                setTimeout(() => { isInternalSync = false; }, 500);
            }
        },

        async syncAllBossesToFirestore(bosses) {
            if (!Array.isArray(bosses)) return;
            try {
                isInternalSync = true;
                const batch = writeBatch(firestoreDb);
                bosses.forEach((b) => {
                    batch.set(doc(firestoreDb, BOSS_COLLECTION, String(b.id)), sanitize(b), { merge: true });
                });
                await batch.commit();
            } catch (err) {
                console.warn('Failed to batch sync bosses to Firestore:', err.message);
            } finally {
                setTimeout(() => { isInternalSync = false; }, 500);
            }
        },

        async deleteBossFromFirestore(bossId) {
            try {
                isInternalSync = true;
                await deleteDoc(doc(firestoreDb, BOSS_COLLECTION, String(bossId)));
            } catch (err) {
                console.warn(`Failed to delete boss ${bossId} from Firestore:`, err.message);
            } finally {
                setTimeout(() => { isInternalSync = false; }, 500);
            }
        },

        async syncConfigToFirestore(settings, resetConfigs) {
            try {
                await setDoc(doc(firestoreDb, 'boss_config', CONFIG_DOC), sanitize({
                    settings: settings || {},
                    resetConfigs: resetConfigs || {},
                    updated_at: new Date().toISOString()
                }), { merge: true });
            } catch (err) {
                console.warn('Failed to sync boss config to Firestore:', err.message);
            }
        }
    };
}

module.exports = {
    initFirestoreSync
};
