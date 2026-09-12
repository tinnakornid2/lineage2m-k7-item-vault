const fs = require('fs');
const path = require('path');
const db = require('./db');

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function generateStaticBossTrackerHtml() {
    const settings = db.getSettings();

    const pageData = {
        component: 'dashboard',
        props: {
            errors: {},
            name: settings.serverName || '#Kain7',
            auth: {
                user: {
                    id: 1,
                    name: 'kain7',
                    email: 'member@boss.local',
                    email_verified_at: '2026-03-11T22:46:43.000000Z',
                    role: 'member',
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
            savedMaintenanceEndTime: db.getSavedMaintenanceEndTime() || '08:00'
        },
        url: '/boss-tracker',
        version: '55c7f37e0516ec0f9ab5340e89e90c20',
        clearHistory: false,
        encryptHistory: false
    };

    const jsonStr = escapeHtml(JSON.stringify(pageData));

    const html = `<!DOCTYPE html>
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
        <title inertia>#Kain7</title>
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

    const targetFile = path.join(__dirname, '..', 'public', 'boss-tracker.html');
    fs.writeFileSync(targetFile, html, 'utf8');
    console.log(`✅ Successfully generated ${targetFile} (${html.length} bytes)`);
}

generateStaticBossTrackerHtml();

module.exports = { generateStaticBossTrackerHtml };
