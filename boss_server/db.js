const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, 'data', 'store.json');
let cache = null;

function load() {
    if (!cache) {
        if (!fs.existsSync(dataFile)) {
            throw new Error(`Data store not found at ${dataFile}`);
        }
        cache = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    }
    return cache;
}

let saveTimeout = null;
function save() {
    if (cache) {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            try {
                const tempPath = `${dataFile}.tmp`;
                fs.writeFileSync(tempPath, JSON.stringify(cache, null, 2), 'utf8');
                fs.renameSync(tempPath, dataFile);
            } catch (err) {
                console.error('Failed to save store.json:', err);
            }
        }, 150);
    }
}

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function toLocalIsoString(date) {
    const pad = n => String(n).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    const offsetMinutes = -date.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const absOffset = Math.abs(offsetMinutes);
    const offsetHours = pad(Math.floor(absOffset / 60));
    const offsetMins = pad(absOffset % 60);
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetMins}`;
}

function getLocalDateString(date) {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function calculateNextEventSpawn(occursOn, eventTime, doneOn, skippedOn) {
    if (!eventTime) return null;
    const [hours, minutes] = eventTime.split(':').map(Number);
    const now = new Date();
    const todayStr = getLocalDateString(now);

    const targetDays = (!occursOn || !Array.isArray(occursOn) || occursOn.length === 0)
        ? [0, 1, 2, 3, 4, 5, 6]
        : occursOn.map(d => DAYS.indexOf(String(d).toLowerCase())).filter(d => d !== -1);
    if (targetDays.length === 0) return null;

    for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
        const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hours || 0, minutes || 0, 0, 0);
        const dayOfWeek = candidate.getDay();

        // If today and already completed/skipped today, check next occurrence
        if (dayOffset === 0 && (doneOn === todayStr || skippedOn === todayStr)) {
            continue;
        }

        if (targetDays.includes(dayOfWeek)) {
            return toLocalIsoString(candidate);
        }
    }
    return null;
}

module.exports = {
    toLocalIsoString,
    getLocalDateString,
    calculateNextEventSpawn,

    getStore() {
        return load();
    },

    getBosses() {
        return load().bosses || [];
    },

    getBoss(id) {
        const numId = Number(id);
        return (load().bosses || []).find(b => b.id === numId);
    },

    createBoss(bossData) {
        const store = load();
        const maxId = store.bosses.reduce((max, b) => Math.max(max, b.id || 0), 0);
        const newBoss = {
            id: maxId + 1,
            name: bossData.name,
            location: bossData.location || '',
            interval: Number(bossData.interval) || 60,
            is_invasion: Boolean(bossData.is_invasion),
            chance_of_appearing: bossData.chance_of_appearing || '100.00',
            last_kill_time: bossData.last_kill_time || null,
            next_spawn: bossData.next_spawn || null,
            auto_advanced: false,
            post_maintenance: false,
            pinned_alive: false,
            pre_spawned: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        store.bosses.push(newBoss);
        save();
        return newBoss;
    },

    updateBoss(id, updates) {
        const store = load();
        const numId = Number(id);
        const idx = store.bosses.findIndex(b => b.id === numId);
        if (idx === -1) return null;

        store.bosses[idx] = {
            ...store.bosses[idx],
            ...updates,
            updated_at: new Date().toISOString()
        };
        save();
        return store.bosses[idx];
    },

    deleteBoss(id) {
        const store = load();
        const numId = Number(id);
        const idx = store.bosses.findIndex(b => b.id === numId);
        if (idx === -1) return false;
        store.bosses.splice(idx, 1);
        save();
        return true;
    },

    getAllEvents() {
        const store = load();
        const all = store.allEvents || [];
        return all.map(e => {
            const nextSpawn = calculateNextEventSpawn(e.occurs_on, e.event_time, e.done_on, e.skipped_on);
            return {
                ...e,
                is_event: true,
                next_spawn: nextSpawn || e.next_spawn || null
            };
        });
    },

    getEvents() {
        const store = load();
        const all = store.allEvents || [];
        const now = new Date();
        const todayStr = getLocalDateString(now);
        const todayDay = DAYS[now.getDay()];

        return all.filter(e => {
            // Check if event occurs today
            const occursOn = e.occurs_on && Array.isArray(e.occurs_on) && e.occurs_on.length > 0
                ? e.occurs_on.map(d => String(d).toLowerCase())
                : [todayDay]; // Default to today if undefined
            
            if (!occursOn.includes(todayDay)) {
                return false;
            }

            // If done or skipped today, exclude from active events
            if (e.done_on === todayStr || e.skipped_on === todayStr) {
                return false;
            }

            // Effective event time for today
            const eventTime = (e.occurrence_date === todayStr && e.occurrence_time) ? e.occurrence_time : (e.event_time || '21:00');
            const [hours, minutes] = eventTime.split(':').map(Number);
            const spawnDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours || 0, minutes || 0, 0, 0);

            // Auto-done check if not pinned alive
            if (!e.pinned_alive && e.auto_done_minutes > 0) {
                const autoDoneTime = spawnDate.getTime() + Number(e.auto_done_minutes) * 60 * 1000;
                if (now.getTime() > autoDoneTime) {
                    return false;
                }
            }

            return true;
        }).map(e => {
            const eventTime = (e.occurrence_date === todayStr && e.occurrence_time) ? e.occurrence_time : (e.event_time || '21:00');
            const eventName = (e.occurrence_date === todayStr && e.occurrence_name) ? e.occurrence_name : e.name;
            const [hours, minutes] = eventTime.split(':').map(Number);
            const spawnDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours || 0, minutes || 0, 0, 0);

            return {
                ...e,
                name: eventName,
                event_time: eventTime,
                next_spawn: toLocalIsoString(spawnDate),
                is_event: true
            };
        });
    },

    getEvent(id) {
        const numId = Number(id);
        const all = load().allEvents || [];
        return all.find(e => e.id === numId);
    },

    createEvent(eventData) {
        const store = load();
        if (!store.allEvents) store.allEvents = [];
        const maxId = store.allEvents.reduce((max, e) => Math.max(max, e.id || 0), 0);
        const newEvent = {
            id: maxId + 1,
            name: eventData.name,
            location: eventData.location || '',
            is_invasion: false,
            interval: 0,
            last_kill_time: null,
            auto_advanced: false,
            post_maintenance: false,
            pinned_alive: false,
            pre_spawned: false,
            chance_of_appearing: '100.00',
            next_spawn: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_event: true,
            event_time: eventData.event_time || '21:00',
            occurs_on: Array.isArray(eventData.occurs_on) && eventData.occurs_on.length > 0 ? eventData.occurs_on : ['saturday', 'sunday'],
            done_on: null,
            skipped_on: null,
            auto_done_minutes: Number(eventData.auto_done_minutes) !== undefined ? Number(eventData.auto_done_minutes) : 10
        };
        store.allEvents.push(newEvent);
        save();
        return newEvent;
    },

    updateEvent(id, updates) {
        const store = load();
        const numId = Number(id);
        if (!store.allEvents) store.allEvents = [];
        const idx = store.allEvents.findIndex(e => e.id === numId);
        if (idx === -1) return null;

        store.allEvents[idx] = {
            ...store.allEvents[idx],
            ...updates,
            updated_at: new Date().toISOString()
        };
        save();
        return store.allEvents[idx];
    },

    deleteEvent(id) {
        const store = load();
        const numId = Number(id);
        if (!store.allEvents) return false;
        const idx = store.allEvents.findIndex(e => e.id === numId);
        if (idx === -1) return false;
        store.allEvents.splice(idx, 1);
        save();
        return true;
    },

    getResetConfigs() {
        return load().resetTimeConfigs || {};
    },

    saveResetConfigs(configs) {
        const store = load();
        store.resetTimeConfigs = { ...store.resetTimeConfigs, ...configs };
        save();
        return store.resetTimeConfigs;
    },

    getSettings() {
        return load().settings || {};
    },

    updateSettings(updates) {
        const store = load();
        store.settings = {
            ...store.settings,
            ...updates
        };
        save();
        return store.settings;
    },

    getSavedMaintenanceEndTime() {
        return load().savedMaintenanceEndTime;
    },

    setSavedMaintenanceEndTime(time) {
        const store = load();
        store.savedMaintenanceEndTime = time;
        save();
        return time;
    }
};
