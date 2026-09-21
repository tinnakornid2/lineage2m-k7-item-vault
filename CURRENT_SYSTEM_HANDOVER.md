# Lineage2M Clan Hub — Current Handover

Version: **2.8.9**  
Updated: **2026-09-21**  
Production: https://lineage2m-k7-item-vault.vercel.app  
Repository: https://github.com/tinnakornid2/lineage2m-k7-item-vault

## Read this first

This file is the authoritative handover. Do not restore old ZIP snapshots, `backups/`, `data/`, or `src/data/offlineMembersData.ts` as production data. Production data comes from the live Firestore database and the configured Google Apps Script backup only.

## Current architecture

- React + TypeScript + Vite frontend.
- Express API bundled into `api/index.js` for Vercel.
- Firebase project `k7-item` with Enterprise Firestore database `ai-studio-lineage2mclanhub-4a1794d8-f944-422f-945e-56c12057ad13`.
- Google Apps Script endpoint is the secondary database/backup. Full snapshots include users, vaultItems, quickItems, generalItems, queueItems, clans, diamondLogs, formula/settings and sanitized Discord settings.
- Vercel production project is linked through `.vercel/project.json`; never commit `.vercel` or secrets.

## Data continuity rules

1. Firestore is primary while healthy.
2. Every state change schedules a Google backup after a 10-second debounce.
3. When Firestore returns quota/resource errors, the app enables Google failover, stores pending-sync state, uses the live relay, and polls Google for shared updates.
4. Quick Items and General Items perform an immediate Google snapshot if their Firestore write fails. They must not report success unless Firestore or Google accepted the data.
5. When Firestore recovers, `syncBackupToFirestore()` restores all collections, including `quick_items` and `general_items`.
6. Firestore recovery health checks run every 5 minutes during quota exhaustion, not every minute, to conserve reads.
7. Never claim both stores are identical unless the write/restore response succeeded and record counts were checked.

## Current features

- Quick Items are reusable item-entry presets only; they are not queues.
- General Item Queue is a dedicated queue feature styled identically to Boss Item Queue (dark fantasy gold aesthetics, Grid 4-column & Table views, 1-click Quick Item preset selection, Ctrl+V clipboard image paste, drag-and-drop upload, in-app delivery modal, receipt attachment, and editable history).
- Members who received an item may join the same queue again.
- Item Vault supports quick presets, OCR hunter scanning, payment status, distribution history and receipts.
- OCR uses Gemini first and automatically falls back to free on-device Tesseract OCR when Google is unavailable or over quota.
- Discord uses the configured webhook avatar; secrets are never included in Google or GitHub data.

## Important files

- `src/App.tsx`: state ownership, listeners, failover and write handlers.
- `src/services/firebase.ts`: Firestore collections, writes, recovery and quota detection.
- `src/services/googleSheetsBackupService.ts`: Google backup/fetch/live failover.
- `src/services/googleAppsScriptTemplate.ts` and `GOOGLE_SHEETS_DATABASE_SCRIPT.js`: Apps Script source.
- `src/components/QuickItemModal.tsx`: Quick Item editor.
- `src/components/GeneralItemQueueCard.tsx`: General Item queue and management.
- `src/components/QueueView.tsx`: Queue Management screen.
- `src/components/VaultView.tsx`: Item Vault and OCR.
- `firestore.rules`: production rules for the named Firestore database.

## Safe change procedure

1. Preserve existing data types and bilingual TH/EN behavior.
2. Increment the application version for every behavior change. Increment `CACHE_SCHEMA_VERSION` when data/cache behavior changes.
3. Run `npm run lint` and `npm run build`.
4. Run Firestore rules dry-run before rules deployment.
5. Deploy the named Firestore database rules, then Vercel production.
6. Verify the public URL version and browser console.
7. Keep GitHub free of `.env*`, service accounts, `.vercel`, backups, live JSON, generated `dist`, and offline production snapshots.

## Known limitation

The current `general_items.queueList` is an array in the parent document. Rules restrict members to changing only that field, but per-member mutation cannot be perfectly enforced inside arbitrary arrays. A future hardening migration should use UID-keyed queue-entry subcollections.
