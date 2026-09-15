# Lineage2M Clan Hub - User Manual (v1.2.0)
**Comprehensive Guild Management, Boss Item Vault & Queue Distribution System**

This user guide provides a clear, concise breakdown of every page, section, and button within the Lineage2M Clan Hub application, featuring **Direct Copy-Paste (Ctrl + V)** image upload capabilities.

---

## Table of Contents
1. [User Roles & Permissions](#1-user-roles--permissions)
2. [Top Navigation Bar & Header Controls](#2-top-navigation-bar--header-controls)
3. [Dashboard View](#3-dashboard-view)
4. [Boss Item Vault](#4-boss-item-vault)
5. [Item Queue Management](#5-item-queue-management)
6. [All Clan Members Directory](#6-all-clan-members-directory)
7. [Clan & Alliance Management](#7-clan--alliance-management)
8. [Special Modals & Configuration Tools](#8-special-modals--configuration-tools)

---

## 1. User Roles & Permissions

| Role | Badge | Permissions & Responsibilities |
| :--- | :---: | :--- |
| **Owner** | 👑 | Full superadmin access. Controls all game data, promotes/demotes admins, configures classes, and exclusively accesses the **Owner Reset Center**. |
| **Admin** | 🛡️ | Can add boss drops, manage queues, distribute items to members, approve new member registrations, and manage the Diamond Vault. |
| **Member** | ⚔️ | Clan player. Can view items, register claims for eligible items (matching CP requirement), inspect item queues, and view guild roster. |

---

## 2. Top Navigation Bar & Header Controls

| Button / Element | Icon | Function & Description |
| :--- | :---: | :--- |
| **LINEAGE 2M CLAN HUB (v1.2.0)** | 👑 | System logo. Click anywhere to return to the **Main Dashboard**. |
| **Diamond Vault Widget** | 💎 | Displays current central guild diamond reserve. Click to open the **Deposit / Withdrawal** window. |
| **Wallpaper Settings** | ✨ | Opens the background visual customization modal (upload image, adjust blur/brightness). |
| **Sound Toggle** | 🔊 / 🔇 | Enables or mutes system UI sound effects (clicks, modal pops, distribution fanfares). |
| **Language Switcher (TH / EN)** | 🌐 | Instantly switches the interface language between **English** and **Thai**. |
| **Login / Logout** | 👤 / 🚪 | Authenticate into your user account or sign out securely. |
| **Navigation Tabs** | 📑 | Switch across: Dashboard, Item Vault, Item Queue, Members, and Clan Management. |

---

## 3. Dashboard View
**The central command screen showing real-time vault balance, transaction timelines, and items currently open for claim.**

### Elements and Buttons
* **Diamond Vault Card:**
  * **"Deposit / Withdraw" Button** *(Admin/Owner)*: Deposit loot sale proceeds or withdraw diamonds for guild upkeep with mandatory notes.
* **Transaction Timeline Box:** Shows the 10 most recent deposit and withdrawal activities with timestamp and performer name. Click **"View all"** for the complete audit log.
* **Active Claimable Items Table:**
  * **Item Thumbnail:** Click to **Zoom full size**.
  * **"Register Claim" Button:** Members with power level meeting or exceeding the minimum CP click to register their intent to claim.
  * **"Cancel Claim" Button:** Allows a member to retract their claim registration.
  * **"View Claimants" Button:** Displays all registered applicants, sorted by CP and application timestamp.
  * **"Distribute Item" Button** *(Admin/Owner)*: Opens the recipient distribution modal. Selecting a member awards the item, records distribution history, and triggers an automated Discord announcement.
  * **"Clear & Reset" Button** *(Owner Only)*: Opens the system reset modal to wipe or archive items for a fresh boss cycle.

---

## 4. Boss Item Vault
*(Restricted to Admin and Owner)*
**Comprehensive repository for logging raid drops, managing preset templates, and scanning hunter rosters with AI OCR (Copy-Paste Supported).**

### Sub-tabs
1. **Add New Item:** Input form to record a newly dropped boss item.
2. **Distributed Items Archive:** Searchable archive of all historical distributed items with attached raid proof.

### Key Buttons & Actions
* **"Quick Items Menu" Button:** Opens the quick item preset editor to save item icons, names, and rarities for rapid 1-click entry (Ctrl+V supported).
* **Quick Presets Shortcut Strip:** Click any preset chip to auto-populate the creation form instantly.
* **Form Inputs:** Item Name, Diamond Price, Minimum CP required to claim, and Rarity tier (Rare / Epic / Legend / Mythic).
* **Item Image Upload (Ctrl + V Supported):** Click to select from device or press **Ctrl + V** to paste clipboard images directly.
* **Hunter System & AI OCR Screenshot Scanner (Ctrl + V Supported):**
  * **Hunter Dropdown:** Select hunters from active guild rosters grouped by clan without typing.
  * **"Upload Backup Screenshots" (Multiple):** Select files or press **Ctrl + V** to attach raid party screenshots proving boss participation.
  * **"Scan Hunters via OCR" (Gemini AI):** Click button or press **Ctrl + V** to paste screenshots directly; the AI reads player names and matches them against guild databases automatically.
  * **"Filter Duplicates" Button:** Cleans duplicate detected names across multiple screenshots in one click.
* **"Create / Add Item" Button:** Validates and saves the item into the active vault.
* **In Distributed Archive:**
  * **"View Hunter Proof" Button:** Launches the proof viewer with mouse scroll zoom.
  * **"Delete Record" Button:** Permanently deletes the distribution log entry.

---

## 5. Item Queue Management
**Transparent, chronological priority waiting list for high-tier guild drops.**

> **Notice:** Self-service queue joining is disabled for standard members. Only **Admins and Owners** have privileges to add and rearrange queue members to ensure fair and dispute-free distribution.

### Key Buttons & Actions *(Admin/Owner)*
* **"+ Register Item into Queue" Button:** Create an item queue category (supports **Ctrl + V** image paste).
* **"+ Add Member to Queue" Button:** Select a clan player from the dropdown to place them on the waiting list.
* **"Mark as Received" Button:** Toggles member status to a green checkmark once their item has been awarded in-game.
* **"Mark as Waiting" Button:** Reverts a member's status back to pending queue.
* **Queue Reordering:**
  * Use the **Up / Down Arrow buttons**
  * Or **Drag & Drop** member cards using the grab handle to change priority rank.
* **"Remove Member" Button:** Removes a specific player from the item queue.
* **"Delete Queue Item" Button:** Deletes the entire item queue category.

---

## 6. All Clan Members Directory
**Directory of all clan players grouped by guild and sorted by Power Level (CP).**

### Section 1: Pending Approvals
*(Awaiting Admin action after user registration)*
* **"Approve Member" Button:** Validates account and grants access to the portal.
* **"Reject Request" Button:** Rejects and clears the registration request.

### Section 2: Active Members Roster
* **Search Input:** Filter members in real-time by character name, clan, or class.
* **"Edit Profile" Button** *(Admin/Owner)*: Modify character name, CP, clan affiliation, class, and role according to the permission hierarchy.
* **"Assign Role" Button** *(Owner Only)*: Promote or demote between Member, Admin, and Owner.
* **"Delete Member" Button:** Removes member record from the database.

---

## 7. Clan & Alliance Management
*(Restricted to Admin and Owner)*
**Organize main clans, sub-guilds, and alliance rosters.**

### Key Buttons & Actions
* **"+ Add New Clan" Button:** Register a new clan tag into the guild network.
* **Drag-and-Drop Member Transfers:** Click and drag any player card into a target clan container to instantly update their affiliation.
* **Batch Member Deletion:**
  * Check individual boxes or click **"Select All in Clan"**.
  * Click **"Batch Delete Selected"** to prune multiple inactive accounts at once.
* **"Delete Clan" Button:** Removes an empty clan container.

---

## 8. Special Modals & Configuration Tools

### 1. Diamond Vault Modal
* **"Deposit" Tab:** Specify amount and reason (e.g. boss loot market sale).
* **"Withdraw" Tab:** Specify amount and reason (e.g. consumables, clan payout).
* **"Log" Tab:** Review the complete historical audit log of all financial movements.

### 2. Discord Webhook Settings Modal
* Click the **Bell icon** on the sidebar.
* Enter your guild's Discord Webhook URL.
* **"Test Ping" Button:** Sends a formatted verification card to your Discord channel.
* When enabled, automatic rich embeds are dispatched for: Item additions, loot distributions, and diamond transactions.

### 3. Class Settings Modal
* Click the **Sword icon** on the sidebar.
* Add or delete character classes to reflect the active game patch (e.g. Orb, Bow, Greatsword, Dual Blades, Rapier).

### 4. Wallpaper & Theme Settings Modal
* Click the **Sparkles icon** on the top bar or sidebar.
* Upload a custom castle background or choose presets.
* Sliders for: **Brightness**, **Blur radius**, and **Overlay Darkness**.

### 5. Live Announcement Ticker Bar
* Located at the top of the interface for urgent clan broadcast messages.
* Click the **Pencil icon** to edit message content and toggle visibility.

### 6. Owner Reset Center
*(Owner Privilege Only)*
* Safeguarded by mandatory confirmation (must **type "RESET"** to execute).
* Granular reset choices:
  1. Clear all distributed items (preserve active claimable items).
  2. Wipe all vault items for a brand new hunting cycle.
  3. Wipe all item queues.
  4. Clear diamond vault transaction logs.
  5. Restore default sample data for testing.

---
*Document produced for Lineage2M Clan Hub players and administrators.*
