const path = require('path');
const fs = require('fs');
const express = require('express');
const db = require('./db');
const broadcaster = require('./broadcaster');
const { initFirestoreSync } = require('./firestoreBridge');

const INERTIA_VERSION = '55c7f37e0516ec0f9ab5340e89e90c20';
let forceReloadAt = null;
let firestoreSync = null;

// Helper: Escape HTML for data-page attribute
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// 100% Exact Original HTML page wrapper matching boss.kain7.com
function renderHtml(pageData, title = '#Kain7') {
    const jsonStr = escapeHtml(JSON.stringify(pageData));
    return `<!DOCTYPE html>
<html lang="en" class="">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <script>
            (function() {
                const appearance = 'system';
                if (appearance === 'system') {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    if (prefersDark) {
                        document.documentElement.classList.add('dark');
                    }
                }
                const isMaxDesktop = window.maxDesktop?.runtime === 'max';
                if ('__TAURI_INTERNALS__' in window) {
                    document.documentElement.classList.add('tauri');
                    document.documentElement.classList.add('desktop');
                }
                if (isMaxDesktop) {
                    document.documentElement.classList.add('max');
                    document.documentElement.classList.add('desktop');
                }
            })();
        </script>
        <style>
            html, body, #app {
                margin: 0;
                padding: 0;
                height: 100%;
                overflow: hidden;
            }
            html.desktop,
            html.desktop body,
            html.desktop #app,
            html.desktop .browser-shell,
            html.desktop .browser-shell > * {
                background: transparent !important;
            }
        </style>
        <title inertia>${title}</title>
        <meta name="theme-color" content="#000000">
        <meta name="mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
        <meta name="apple-mobile-web-app-title" content="BossTracker">
        <link rel="apple-touch-icon" href="/favicon.png">
        <link rel="icon" href="/favicon.png" sizes="any" type="image/png">
        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600" rel="stylesheet" />
        <link rel="preload" as="style" href="/build/assets/app-DIKwFrKw.css" />
        <link rel="modulepreload" as="script" href="/build/assets/app-CTdHufbH.js" />
        <link rel="stylesheet" href="/build/assets/app-DIKwFrKw.css" />
        <script type="module" src="/build/assets/app-CTdHufbH.js"></script>
    </head>
    <body class="font-sans antialiased">
        <div class="browser-shell">
            <div id="app" data-page="${jsonStr}"></div>
        </div>
    </body>
</html>`;
}

// Helper: Inertia response dispatcher
function sendInertia(req, res, component, props, url) {
    const targetUrl = url || req.originalUrl || req.url;
    const pageData = {
        component,
        props,
        url: targetUrl,
        version: INERTIA_VERSION,
        clearHistory: false,
        encryptHistory: false
    };

    const isInertia = Boolean(
        req.headers['x-inertia'] ||
        req.headers['x-requested-with'] === 'XMLHttpRequest' ||
        (req.headers.accept && req.headers.accept.includes('application/json'))
    );

    if (isInertia) {
        res.setHeader('X-Inertia', 'true');
        res.setHeader('Vary', 'Accept-Encoding, X-Inertia');
        return res.json(pageData);
    }

    const html = renderHtml(pageData, props.name || '#Kain7');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
}

// Helper: Dispatch Inertia mutation response
function respondInertiaOrRedirect(req, res, targetUrl = '/boss-tracker') {
    const isInertia = Boolean(
        req.headers['x-inertia'] ||
        req.headers['x-requested-with'] === 'XMLHttpRequest' ||
        (req.headers.accept && req.headers.accept.includes('application/json'))
    );

    if (isInertia) {
        return sendInertia(req, res, 'dashboard', getDashboardProps(req), targetUrl);
    }
    res.setHeader('X-Inertia', 'true');
    res.redirect(303, targetUrl);
}

function isAuthenticated(req) {
    const sess = req.cookies?.['boss_session'] || req.cookies?.['remember_web_59ba36addc2b2f9401580f014c7f58ea4e30989d'];
    return Boolean(sess);
}

function getSessionRole(req) {
    const sess = req.cookies?.['boss_session'] || req.cookies?.['remember_web_59ba36addc2b2f9401580f014c7f58ea4e30989d'] || '';
    if (sess.includes('member')) return 'member';
    return 'admin';
}

function getDashboardProps(req) {
    const settings = db.getSettings();
    const role = getSessionRole(req);
    const isAdmin = role === 'admin';

    return {
        errors: {},
        name: settings.serverName || '#Kain7',
        auth: {
            user: {
                id: 1,
                name: isAdmin ? 'admin' : 'kain7',
                email: isAdmin ? 'admin@boss.local' : 'member@boss.local',
                email_verified_at: '2026-03-11T22:46:43.000000Z',
                role: role,
                two_factor_secret: null,
                two_factor_recovery_codes: null,
                two_factor_confirmed_at: null,
                created_at: '2026-03-11T22:46:43.000000Z',
                updated_at: '2026-03-11T22:46:43.000000Z'
            }
        },
        sidebarOpen: true,
        bosses: db.getBosses(),
        events: db.getEvents(),
        allEvents: db.getAllEvents(),
        hideInvasionBosses: Boolean(settings.hideInvasionBosses),
        invasionLabel: settings.invasionLabel || 'L3',
        announcement: settings.announcement || null,
        resetTimeConfigs: db.getResetConfigs(),
        savedMaintenanceEndTime: db.getSavedMaintenanceEndTime() || null
    };
}

function setupBossTracker(app, httpServer) {
    // 1. Initialize WebSocket broadcaster
    if (httpServer) {
        broadcaster.init(httpServer);
    }

    // 2. Initialize Real-time Cloud Firestore Bridge (hybrid-box-753bd)
    if (!firestoreSync) {
        firestoreSync = initFirestoreSync(db, broadcaster);
    }

    // 2.5 Request logger for boss tracker debugging
    app.use((req, res, next) => {
        if (req.url.startsWith('/boss') || req.url.startsWith('/settings') || req.url.startsWith('/events') || req.url.startsWith('/announcement') || req.url.startsWith('/force-reload')) {
            console.log(`[BOSS_REQ] ${req.method} ${req.url} (Inertia: ${req.headers['x-inertia'] || 'no'})`);
        }
        next();
    });

    // 3. Cookie parser middleware for boss tracker routes
    app.use((req, res, next) => {
        const header = req.headers.cookie;
        if (!req.cookies) req.cookies = {};
        if (header) {
            header.split(';').forEach(c => {
                const parts = c.trim().split('=');
                if (parts[0]) {
                    req.cookies[parts[0]] = decodeURIComponent(parts.slice(1).join('=') || '');
                }
            });
        }
        if (!req.cookies['XSRF-TOKEN']) {
            const token = 'eyJpdiI6InhzcmZfdG9rZW4iLCJ2YWx1ZSI6InhzcmZfdmFsdWUifQ==';
            res.setHeader('Set-Cookie', `XSRF-TOKEN=${token}; Path=/; SameSite=Lax`);
            req.cookies['XSRF-TOKEN'] = token;
        }
        next();
    });

    // 4. Exact Audio Sounds Handler: Serve all 22 sound alerts from public/sounds directly
    const soundsDir = path.join(__dirname, '..', 'public', 'sounds');
    app.get(['/:sound.mp3', '/:sound.wav'], (req, res, next) => {
        const soundName = path.basename(req.path);
        const soundFile = path.join(soundsDir, soundName);
        if (fs.existsSync(soundFile)) {
            res.setHeader('Cache-Control', 'public, max-age=86400');
            return res.sendFile(soundFile);
        }
        next();
    });
    app.use('/sounds', express.static(soundsDir));

    // ==========================================================
    // 100% EXACT ORIGINAL ROUTE LOGIC
    // ==========================================================

    // GET /boss-tracker, /boss-time/app, /dashboard -> Exact Original Inertia Dashboard
    app.all(['/boss-tracker', '/boss-time/app', '/dashboard'], (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            return res.status(405).end();
        }

        // Require authentication like the original app
        if (!isAuthenticated(req)) {
            const props = {
                errors: {},
                name: db.getSettings().serverName || '#Kain7',
                auth: { user: null },
                sidebarOpen: true,
                status: null
            };
            return sendInertia(req, res, 'auth/login', props, '/login');
        }

        sendInertia(req, res, 'dashboard', getDashboardProps(req), '/boss-tracker');
    });

    // GET /boss-tracker/login or /login (Inertia request)
    app.get(['/boss-tracker/login', '/login'], (req, res) => {
        if (isAuthenticated(req)) {
            return res.redirect('/boss-tracker');
        }
        const props = {
            errors: {},
            name: db.getSettings().serverName || '#Kain7',
            auth: { user: null },
            sidebarOpen: true,
            status: null
        };
        return sendInertia(req, res, 'auth/login', props, '/login');
    });

    // POST /login -> Authenticate with PIN / Password
    // USER: 2221 (Role: member)
    // ADMIN: 9876 (Role: admin)
    app.post('/login', (req, res) => {
        const { name, username, password, pin } = req.body || {};
        const user = (name || username || '').trim().toLowerCase();
        const pass = (password || pin || '').trim();

        const isAdmin = pass === '9876';
        const isMember = pass === '2221';

        if (isAdmin || isMember) {
            const sessionRole = isAdmin ? 'admin' : 'member';
            const sessionVal = `authenticated_${sessionRole}_session`;
            const oneYearInSeconds = 31536000;
            const expires = new Date(Date.now() + oneYearInSeconds * 1000).toUTCString();

            res.setHeader('Set-Cookie', [
                `boss_session=${sessionVal}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${oneYearInSeconds}; Expires=${expires}`,
                `remember_web_59ba36addc2b2f9401580f014c7f58ea4e30989d=${sessionVal}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${oneYearInSeconds}; Expires=${expires}`
            ]);
            if (req.cookies) {
                req.cookies['boss_session'] = sessionVal;
                req.cookies['remember_web_59ba36addc2b2f9401580f014c7f58ea4e30989d'] = sessionVal;
            }

            return res.redirect(303, '/boss-tracker');
        }

        const errors = { password: 'รหัสผ่านหรือพินไม่ถูกต้อง (Invalid password or PIN)' };
        if (req.headers['x-inertia']) {
            res.setHeader('X-Inertia', 'true');
            return res.status(422).json({
                component: 'auth/login',
                props: {
                    errors,
                    name: db.getSettings().serverName || '#Kain7',
                    auth: { user: null },
                    sidebarOpen: true,
                    status: null
                },
                url: '/login',
                version: INERTIA_VERSION
            });
        }
        return res.redirect('/login');
    });

    // POST /logout -> Erase cookies and return to login screen
    app.post('/logout', (req, res) => {
        res.setHeader('Set-Cookie', [
            'boss_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0',
            'remember_web_59ba36addc2b2f9401580f014c7f58ea4e30989d=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0'
        ]);
        if (req.cookies) {
            delete req.cookies['boss_session'];
            delete req.cookies['remember_web_59ba36addc2b2f9401580f014c7f58ea4e30989d'];
        }
        if (req.headers['x-inertia']) {
            res.setHeader('X-Inertia-Location', '/login');
            return res.status(409).send('');
        }
        return res.redirect(303, '/login');
    });

    // GET /poll -> Client polling
    app.get('/poll', (req, res) => {
        const settings = db.getSettings();
        res.json({
            bosses: db.getBosses(),
            events: db.getEvents(),
            allEvents: db.getAllEvents(),
            announcement: settings.announcement || null,
            hideInvasionBosses: Boolean(settings.hideInvasionBosses),
            invasionLabel: settings.invasionLabel || 'L3',
            resetTimeConfigs: db.getResetConfigs(),
            savedMaintenanceEndTime: db.getSavedMaintenanceEndTime() || null,
            forceReloadAt: forceReloadAt
        });
    });

    // POST /bosses -> Create new boss
    app.post('/bosses', (req, res) => {
        const { name, location, interval, chance_of_appearing, chanceOfAppearing, is_invasion, isInvasion, last_kill_time } = req.body;
        let intervalMinutes = 60;
        if (typeof interval === 'string' && interval.includes(':')) {
            const [h, m] = interval.split(':').map(Number);
            intervalMinutes = (h || 0) * 60 + (m || 0);
        } else {
            intervalMinutes = Number(interval) || 60;
        }

        let spawnTime = null;
        let killTime = last_kill_time || null;
        if (killTime) {
            spawnTime = new Date(new Date(killTime).getTime() + intervalMinutes * 60000).toISOString();
        }

        const isInvasionVal = is_invasion !== undefined ? is_invasion : isInvasion;
        const chanceVal = chance_of_appearing !== undefined ? chance_of_appearing : (chanceOfAppearing || '100.00');

        const createdBoss = db.createBoss({
            name,
            location: location || '',
            interval: intervalMinutes,
            chance_of_appearing: String(chanceVal),
            is_invasion: Boolean(isInvasionVal),
            last_kill_time: killTime,
            next_spawn: spawnTime
        });

        if (firestoreSync) firestoreSync.syncBossToFirestore(createdBoss);
        broadcaster.broadcast('bosses.updated', { bosses: db.getBosses() });
        return respondInertiaOrRedirect(req, res, '/boss-tracker');
    });

    // PUT /bosses/:id -> Complete original boss actions
    app.put('/bosses/:id', (req, res) => {
        const id = Number(req.params.id);
        const boss = db.getBoss(id);
        if (!boss) return respondInertiaOrRedirect(req, res, '/boss-tracker');

        const body = req.body || {};
        const updates = {};

        if (body.last_kill_time !== undefined) {
            if (!body.last_kill_time) {
                updates.last_kill_time = null;
                updates.next_spawn = null;
                updates.pinned_alive = false;
                updates.auto_advanced = false;
                updates.post_maintenance = false;
                updates.pre_spawned = false;
            } else {
                const killDate = new Date(body.last_kill_time);
                if (!isNaN(killDate.getTime())) {
                    const intervalMinutes = boss.interval || 60;
                    const spawnDate = new Date(killDate.getTime() + intervalMinutes * 60000);
                    updates.last_kill_time = killDate.toISOString();
                    updates.next_spawn = spawnDate.toISOString();
                    updates.pinned_alive = false;
                    updates.auto_advanced = false;
                    updates.post_maintenance = false;
                    updates.pre_spawned = false;
                }
            }
        } else if (body.not_spawned) {
            let currentNext = boss.next_spawn ? new Date(boss.next_spawn) : new Date();
            let advanced = new Date(currentNext.getTime() + (boss.interval || 60) * 60000);
            if (advanced.getTime() < Date.now()) {
                advanced = new Date(Date.now() + (boss.interval || 60) * 60000);
            }
            updates.next_spawn = advanced.toISOString();
            updates.last_kill_time = new Date(advanced.getTime() - (boss.interval || 60) * 60000).toISOString();
            updates.auto_advanced = true;
            updates.pinned_alive = false;
            updates.pre_spawned = false;
        } else if (body.still_alive) {
            updates.pinned_alive = !boss.pinned_alive;
            if (updates.pinned_alive) updates.pre_spawned = false;
        } else if (body.toggle_pre_spawned) {
            updates.pre_spawned = !boss.pre_spawned;
            if (updates.pre_spawned) updates.pinned_alive = false;
        } else if (body.toggle_maintenance) {
            updates.post_maintenance = !boss.post_maintenance;
        } else if (body.adjust_spawn_minutes !== undefined) {
            const spawnMinutes = Number(body.adjust_spawn_minutes);
            const spawnDate = new Date(Date.now() + spawnMinutes * 60000);
            updates.next_spawn = spawnDate.toISOString();
            updates.last_kill_time = new Date(spawnDate.getTime() - (boss.interval || 60) * 60000).toISOString();
            updates.pinned_alive = false;
            updates.auto_advanced = false;
            updates.pre_spawned = false;
        } else if (body.unset_kill_time) {
            updates.last_kill_time = null;
            updates.next_spawn = null;
            updates.pinned_alive = false;
            updates.auto_advanced = false;
            updates.post_maintenance = false;
            updates.pre_spawned = false;
        } else if (body.cycle_backward) {
            let currentNext = boss.next_spawn ? new Date(boss.next_spawn) : new Date();
            let backward = new Date(currentNext.getTime() - (boss.interval || 60) * 60000);
            updates.next_spawn = backward.toISOString();
            updates.last_kill_time = new Date(backward.getTime() - (boss.interval || 60) * 60000).toISOString();
            updates.pinned_alive = false;
        }

        if (body.pinned_alive !== undefined) updates.pinned_alive = Boolean(body.pinned_alive);
        if (body.pre_spawned !== undefined) updates.pre_spawned = Boolean(body.pre_spawned);

        if (body.name !== undefined) {
            updates.name = body.name;
            if (body.location !== undefined) updates.location = body.location;
            if (body.interval !== undefined) {
                if (typeof body.interval === 'string' && body.interval.includes(':')) {
                    const [h, m] = body.interval.split(':').map(Number);
                    updates.interval = (h || 0) * 60 + (m || 0);
                } else {
                    updates.interval = Number(body.interval) || 60;
                }
                if (boss.last_kill_time) {
                    const killDate = new Date(boss.last_kill_time);
                    if (!isNaN(killDate.getTime())) {
                        updates.next_spawn = new Date(killDate.getTime() + updates.interval * 60000).toISOString();
                    }
                }
            }
            const chanceVal = body.chance_of_appearing !== undefined ? body.chance_of_appearing : body.chanceOfAppearing;
            if (chanceVal !== undefined) updates.chance_of_appearing = String(chanceVal);
            const isInvVal = body.is_invasion !== undefined ? body.is_invasion : body.isInvasion;
            if (isInvVal !== undefined) updates.is_invasion = Boolean(isInvVal);
        }

        const updatedBoss = db.updateBoss(id, updates);
        if (firestoreSync) firestoreSync.syncBossToFirestore(updatedBoss);
        broadcaster.broadcast('bosses.updated', { bosses: db.getBosses() });
        return respondInertiaOrRedirect(req, res, '/boss-tracker');
    });

    // DELETE /bosses/:id
    app.delete('/bosses/:id', (req, res) => {
        const id = Number(req.params.id);
        db.deleteBoss(id);
        if (firestoreSync) firestoreSync.deleteBossFromFirestore(id);
        broadcaster.broadcast('bosses.updated', { bosses: db.getBosses() });
        return respondInertiaOrRedirect(req, res, '/boss-tracker');
    });

    // PUT /settings/invasion-visibility
    app.put('/settings/invasion-visibility', (req, res) => {
        const hide = req.body.hide_invasion_bosses !== undefined
            ? Boolean(req.body.hide_invasion_bosses)
            : !db.getSettings().hideInvasionBosses;
        db.updateSettings({ hideInvasionBosses: hide });
        broadcaster.broadcast('settings.updated', db.getSettings());
        return respondInertiaOrRedirect(req, res, '/boss-tracker');
    });

    // PUT /settings/invasion-label
    app.put('/settings/invasion-label', (req, res) => {
        const label = String(req.body.label || req.body.invasion_label || 'L3');
        db.updateSettings({ invasionLabel: label });
        broadcaster.broadcast('settings.updated', db.getSettings());
        return respondInertiaOrRedirect(req, res, '/boss-tracker');
    });

    // POST /bosses/reset-invasion-kill-times
    app.post('/bosses/reset-invasion-kill-times', (req, res) => {
        const bosses = db.getBosses();
        bosses.forEach(b => {
            if (b.is_invasion) {
                db.updateBoss(b.id, { last_kill_time: null, next_spawn: null, pinned_alive: false });
            }
        });
        broadcaster.broadcast('bosses.updated', { bosses: db.getBosses() });
        return respondInertiaOrRedirect(req, res, '/boss-tracker');
    });

    // Helper: Safely parse maintenance end time (supports "HH:mm", "HH:mm:ss", and ISO strings)
    function parseMaintenanceTime(timeStr) {
        if (!timeStr) return new Date();
        const str = String(timeStr).trim();
        if (str.includes('T') || (str.includes('-') && str.length > 10)) {
            const d = new Date(str);
            return isNaN(d.getTime()) ? new Date() : d;
        }
        const parts = str.split(':').map(Number);
        if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            const now = new Date();
            return new Date(now.getFullYear(), now.getMonth(), now.getDate(), parts[0], parts[1], parts[2] || 0, 0);
        }
        const d = new Date(str);
        return isNaN(d.getTime()) ? new Date() : d;
    }

    // POST /bosses/apply-reset-boss-time
    app.post('/bosses/apply-reset-boss-time', (req, res) => {
        const { maintenance_end_time, reset_time, configs } = req.body || {};
        const targetTimeStr = maintenance_end_time || reset_time || '08:00';

        if (targetTimeStr) {
            const baseDate = parseMaintenanceTime(targetTimeStr);
            let configsMap = {};

            if (Array.isArray(configs)) {
                for (const c of configs) {
                    configsMap[c.boss_name] = {
                        hours: Number(c.delay_hours) || 0,
                        minutes: Number(c.delay_minutes) || 0
                    };
                }
            } else if (configs && typeof configs === 'object') {
                configsMap = configs;
            } else {
                configsMap = db.getResetConfigs();
            }

            // Save the configs map as well
            if (Object.keys(configsMap).length > 0) {
                db.saveResetConfigs(configsMap);
            }

            const bosses = db.getBosses();
            for (const boss of bosses) {
                const conf = configsMap[boss.name] || configsMap[boss.id] || db.getResetConfigs()[boss.name] || db.getResetConfigs()[boss.id];
                if (conf) {
                    const offsetMinutes = (Number(conf.hours) || 0) * 60 + (Number(conf.minutes) || 0);
                    const nextSpawn = new Date(baseDate.getTime() + offsetMinutes * 60000);
                    const lastKill = new Date(nextSpawn.getTime() - (boss.interval || 60) * 60000);

                    db.updateBoss(boss.id, {
                        next_spawn: nextSpawn.toISOString(),
                        last_kill_time: lastKill.toISOString(),
                        post_maintenance: true,
                        pinned_alive: false,
                        auto_advanced: false,
                        pre_spawned: false
                    });
                }
            }

            // Store clean HH:mm format for frontend time input
            const timeVal = targetTimeStr.includes('T')
                ? targetTimeStr.split('T')[1].substring(0, 5)
                : targetTimeStr.substring(0, 5);
            db.setSavedMaintenanceEndTime(timeVal);

            if (firestoreSync) {
                firestoreSync.syncAllBossesToFirestore(db.getBosses());
                firestoreSync.syncConfigToFirestore(db.getSettings(), db.getResetConfigs());
            }
            broadcaster.broadcast('bosses.updated', { bosses: db.getBosses() });
        }
        return respondInertiaOrRedirect(req, res, '/boss-tracker');
    });

    // POST /bosses/save-reset-boss-config
    app.post('/bosses/save-reset-boss-config', (req, res) => {
        const { configs, resetTimeConfigs, maintenance_end_time } = req.body || {};
        let configsMap = {};
        if (Array.isArray(configs)) {
            for (const c of configs) {
                configsMap[c.boss_name] = {
                    hours: Number(c.delay_hours) || 0,
                    minutes: Number(c.delay_minutes) || 0
                };
            }
        } else if (configs && typeof configs === 'object') {
            configsMap = configs;
        } else if (resetTimeConfigs) {
            configsMap = resetTimeConfigs;
        }

        if (Object.keys(configsMap).length > 0) {
            db.saveResetConfigs(configsMap);
        }
        if (maintenance_end_time) {
            const timeVal = String(maintenance_end_time).includes('T')
                ? String(maintenance_end_time).split('T')[1].substring(0, 5)
                : String(maintenance_end_time).substring(0, 5);
            db.setSavedMaintenanceEndTime(timeVal);
        }
        if (firestoreSync) firestoreSync.syncConfigToFirestore(db.getSettings(), db.getResetConfigs());
        return respondInertiaOrRedirect(req, res, '/boss-tracker');
    });

    // POST /bosses/post-maintenance-mode
    app.post('/bosses/post-maintenance-mode', (req, res) => {
        const bosses = db.getBosses();
        for (const b of bosses) {
            if (b.next_spawn) {
                db.updateBoss(b.id, { post_maintenance: true });
            }
        }
        broadcaster.broadcast('bosses.updated', { bosses: db.getBosses() });
        return respondInertiaOrRedirect(req, res, '/boss-tracker');
    });

    // POST /bosses/cancel-maintenance-mode
    app.post('/bosses/cancel-maintenance-mode', (req, res) => {
        const bosses = db.getBosses();
        for (const b of bosses) {
            if (b.post_maintenance) {
                db.updateBoss(b.id, { post_maintenance: false });
            }
        }
        db.setSavedMaintenanceEndTime(null);
        broadcaster.broadcast('bosses.updated', { bosses: db.getBosses() });
        return respondInertiaOrRedirect(req, res, '/boss-tracker');
    });

    // POST /bosses/reset-maintenance-kill-times
    app.post('/bosses/reset-maintenance-kill-times', (req, res) => {
        const bosses = db.getBosses();
        for (const b of bosses) {
            if (b.post_maintenance) {
                db.updateBoss(b.id, {
                    last_kill_time: null,
                    next_spawn: null,
                    post_maintenance: false,
                    pinned_alive: false,
                    auto_advanced: false,
                    pre_spawned: false
                });
            }
        }
        db.setSavedMaintenanceEndTime(null);
        broadcaster.broadcast('bosses.updated', { bosses: db.getBosses() });
        return respondInertiaOrRedirect(req, res, '/boss-tracker');
    });

    // ==========================================================
    // EVENTS ACTIONS
    // ==========================================================

    // PUT /events/:id
    app.put('/events/:id', (req, res) => {
        const id = Number(req.params.id);
        const body = req.body || {};
        const event = db.getEvent(id);
        if (event) {
            const todayStr = db.getLocalDateString(new Date());
            if (body.mark_done) {
                db.updateEvent(id, { done_on: todayStr, skipped_on: null, pinned_alive: false });
            } else if (body.mark_skipped) {
                db.updateEvent(id, { skipped_on: todayStr, done_on: null, pinned_alive: false });
            } else if (body.pin_alive) {
                db.updateEvent(id, { pinned_alive: !event.pinned_alive });
            } else if (body.undo_exception) {
                db.updateEvent(id, { done_on: null, skipped_on: null, pinned_alive: false });
            } else if (body.edit_occurrence) {
                db.updateEvent(id, {
                    occurrence_date: todayStr,
                    occurrence_time: body.occurrence_time || event.event_time,
                    occurrence_name: body.occurrence_name || event.name
                });
            } else if (body.name) {
                db.updateEvent(id, {
                    name: body.name,
                    location: body.location !== undefined ? body.location : event.location,
                    event_time: body.event_time !== undefined ? body.event_time : event.event_time,
                    occurs_on: Array.isArray(body.occurs_on) ? body.occurs_on : (event.occurs_on || ['saturday', 'sunday']),
                    auto_done_minutes: Number(body.auto_done_minutes) !== undefined ? Number(body.auto_done_minutes) : (event.auto_done_minutes || 10)
                });
            }
        }
        broadcaster.broadcast('events.updated', { events: db.getEvents(), allEvents: db.getAllEvents() });
        return respondInertiaOrRedirect(req, res, '/boss-tracker');
    });

    // POST /events
    app.post('/events', (req, res) => {
        db.createEvent(req.body || {});
        broadcaster.broadcast('events.updated', { events: db.getEvents(), allEvents: db.getAllEvents() });
        return respondInertiaOrRedirect(req, res, '/boss-tracker');
    });

    // DELETE /events/:id
    app.delete('/events/:id', (req, res) => {
        db.deleteEvent(Number(req.params.id));
        broadcaster.broadcast('events.updated', { events: db.getEvents(), allEvents: db.getAllEvents() });
        return respondInertiaOrRedirect(req, res, '/boss-tracker');
    });

    // ==========================================================
    // ANNOUNCEMENTS
    // ==========================================================

    app.post('/announcement', (req, res) => {
        const { announcement, message, sent_by, sentBy } = req.body || {};
        let announcementObj = null;
        if (announcement && typeof announcement === 'object') {
            announcementObj = announcement;
        } else if (message || announcement) {
            announcementObj = {
                message: String(message || announcement),
                sent_by: sent_by || sentBy || 'Admin',
                urgent: false,
                resent_at: new Date().toISOString()
            };
        }
        db.updateSettings({ announcement: announcementObj });
        broadcaster.broadcast('announcement.updated', announcementObj);
        return respondInertiaOrRedirect(req, res, '/boss-tracker');
    });

    app.post('/announcement/clear', (req, res) => {
        db.updateSettings({ announcement: null });
        broadcaster.broadcast('announcement.updated', null);
        return respondInertiaOrRedirect(req, res, '/boss-tracker');
    });

    app.post('/announcement/resend', (req, res) => {
        const settings = db.getSettings();
        if (settings.announcement) {
            settings.announcement.resent_at = new Date().toISOString();
            db.updateSettings({ announcement: settings.announcement });
            broadcaster.broadcast('announcement.resend', settings.announcement);
        }
        return respondInertiaOrRedirect(req, res, '/boss-tracker');
    });

    app.post('/force-reload', (req, res) => {
        forceReloadAt = new Date().toISOString();
        broadcaster.broadcast('forceReload', { timestamp: forceReloadAt });
        return respondInertiaOrRedirect(req, res, '/boss-tracker');
    });

    app.post('/analytics/heartbeat', (req, res) => {
        return res.json({ status: 'ok' });
    });

    // Public API Endpoint
    app.get('/api/v1/time-bosses', (req, res) => {
        const bosses = db.getBosses();
        const now = Date.now();
        const formatted = bosses.map(b => {
            let remainingSeconds = null;
            let isAlive = b.pinned_alive;
            if (b.next_spawn) {
                const spawnMs = new Date(b.next_spawn).getTime();
                remainingSeconds = Math.round((spawnMs - now) / 1000);
                if (remainingSeconds <= 0 && remainingSeconds > -300) {
                    isAlive = true;
                }
            }
            return {
                id: b.id,
                name: b.name,
                location: b.location,
                interval_minutes: b.interval,
                chance_of_appearing: b.chance_of_appearing,
                is_invasion: b.is_invasion,
                last_kill_time: b.last_kill_time,
                next_spawn: b.next_spawn,
                remaining_seconds: remainingSeconds,
                is_alive: isAlive,
                pinned_alive: b.pinned_alive,
                pre_spawned: b.pre_spawned,
                auto_advanced: b.auto_advanced,
                post_maintenance: b.post_maintenance
            };
        });
        res.json({
            server_name: db.getSettings().serverName || '#Kain7',
            timestamp: new Date().toISOString(),
            total_bosses: formatted.length,
            bosses: formatted
        });
    });

    // Settings page redirects (for standard Inertia links)
    app.all(['/settings/appearance', '/settings/password', '/settings/profile'], (req, res) => {
        return respondInertiaOrRedirect(req, res, '/boss-tracker');
    });

    console.log('✅ Lineage 2 Exact 100% Original Inertia Engine initialized on /boss-tracker');
}

module.exports = {
    setupBossTracker,
    renderHtml,
    sendInertia
};
