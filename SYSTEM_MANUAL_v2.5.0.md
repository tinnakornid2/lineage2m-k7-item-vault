# 🛡️ Lineage2M Clan Hub — คู่มือระบบและสถาปัตยกรรมฉบับสมบูรณ์ (System Manual v2.5.0)

> **เวอร์ชันระบบ:** `v2.5.0-discord-webhook-standard-item-only`  
> **ที่เก็บซอร์สโค้ด:** `https://github.com/tinnakornid2/lineage2m-k7-item-vault`  
> **สถานะการติดตั้ง (Deployment):** Production Ready (Vercel Serverless + Node.js Live Relay)  
> **URL ระบบสด:** [https://lineage2m-k7-item-vault.vercel.app/](https://lineage2m-k7-item-vault.vercel.app/)  
> **มาตรฐานระบบสองภาษา:** รองรับภาษาไทย (TH) และภาษาอังกฤษ (EN) 100% ครบทุกจุด  
> **สแนปช็อตข้อมูล:** `backups/complete_snapshot_v2.5.0.json` (23 users, 23 vault items, 5 queue items, 23,521 diamonds)

---

## 📑 สารบัญ (Table of Contents)
1. [ภาพรวมและความเปลี่ยนแปลงในเวอร์ชัน v2.5.0 (What's New in v2.5.0)](#1-ภาพรวมและความเปลี่ยนแปลงในเวอร์ชัน-v250)
2. [กฎมาตรฐานการแจ้งเตือน Discord Webhook (Rule 5: Discord Webhook Rules)](#2-กฎมาตรฐานการแจ้งเตือน-discord-webhook)
3. [สถาปัตยกรรมระบบและการไหลของข้อมูล (System Architecture & Data Flow)](#3-สถาปัตยกรรมระบบและการไหลของข้อมูล)
4. [ระบบเปลี่ยนรหัสผ่านตามลำดับสิทธิ์ (Role-Based Password Management)](#4-ระบบเปลี่ยนรหัสผ่านตามลำดับสิทธิ์)
5. [ระบบจัดการและล้างการแจ้งเตือน (Notification Deletion & Auto-Cleanup)](#5-ระบบจัดการและล้างการแจ้งเตือน)
6. [ระบบติดตามสถานะการชำระเงินของไอเทมแจกแล้ว (Payment Status Tracking & Confirmation)](#6-ระบบติดตามสถานะการชำระเงินของไอเทมแจกแล้ว)
7. [การปรับปรุงหน้าจอ My Stats (Thai Subtitles & Clean Input UX)](#7-การปรับปรุงหน้าจอ-my-stats)
8. [การตั้งค่าส่วนกลางข้ามแอดมินและความเสถียรบน Vercel (Shared Persistence & Serverless)](#8-การตั้งค่าส่วนกลางข้ามแอดมินและความเสถียรบน-vercel)
9. [โครงสร้างสิทธิ์และการเข้าถึง (Roles & Security Permissions Hierarchy)](#9-โครงสร้างสิทธิ์และการเข้าถึง)
10. [การตรวจสอบข้อมูลและรายงานสำรองฉบับสมบูรณ์ (Verified Data Snapshot v2.5.0)](#10-การตรวจสอบข้อมูลและรายงานสำรองฉบับสมบูรณ์)
11. [ขั้นตอนการรันคำสั่งและดีพลอย (Deployment & Verification Commands)](#11-ขั้นตอนการรันคำสั่งและดีพลอย)
12. [คู่มือส่งมอบงานสำหรับนักพัฒนาและ AI สานต่องานทันที (AI & Developer Handover Guide)](#12-คู่มือส่งมอบงานสำหรับนักพัฒนาและ-ai-สานต่องานทันที)

---

## 1. ภาพรวมและความเปลี่ยนแปลงในเวอร์ชัน v2.5.0

เวอร์ชัน **v2.5.0** พัฒนาต่อยอดจาก v2.4.0 โดยเน้นการสร้างมาตรฐานการแจ้งเตือน Discord Webhook ใหม่ที่สั้นกระชับ สวยงาม คมชัด และตัดข้อมูลที่ไม่จำเป็นออกทั้งหมดตามคำสั่งผู้ใช้งาน:

### 1. กฎมาตรฐาน Discord Webhook ใหม่ (Rule 5: Discord Webhook Option 1 Only & English 100%)
- **แจ้งเตือนเฉพาะไอเทมเท่านั้น (Item-Only Scope):** ส่งแจ้งเตือน Discord เฉพาะการลงไอเทมใหม่ (`new_item`) และการแจกของ (`distribute`) เท่านั้น ปิดการแจ้งเตือนสเตตัส (`stat_request`, `stat_approval`) ถาวร เพื่อรักษาความสะอาดของช่อง Discord
- **ข้อความ Discord เป็นภาษาอังกฤษ 100% (Mandatory English 100% for Discord):** ข้อความทั้งหมดที่ส่งเข้า Discord (Headers, Titles, ANSI Code Blocks, Fields, Footers, Links) ต้องเป็นภาษาอังกฤษ 100% ห้ามส่งภาษาไทยเข้าห้อง Discord
- **ตัด Embed Title ซ้ำซ้อนออกถาวร (Strictly No Duplicate Title):** ไม่ใส่ฟิลด์ `title` ซ้ำใน Embed ไอเทมใหม่ เพื่อให้การ์ดเริ่มด้วยกรอบ ANSI สีสดทันที ไม่เกิดข้อความสีขาวซ้ำกับข้อความสี
- **ตัดบรรทัดคนล่าออกถาวร 100% (Completely Remove Hunters Line):** ไม่ต้องแสดงรายชื่อคนล่า (`⚔️ Hunters:`) ในข้อความ Discord และตัดออกจาก Preview ทุกแบบ ให้กรอบ ANSI มีเพียง 2 บรรทัดเท่านั้น
- **โครงสร้างกรอบ ANSI 2 บรรทัด (Option 1 Standard):**
  - **บรรทัดที่ 1:** `[RARITY] <Item Name> (xQty)` สี ANSI ตามระดับความหายาก (🟨 MYTHIC ทอง, 🪻/🟪 LEGEND ม่วง, 🟥 EPIC แดง, 🟦 RARE ฟ้า)
  - **บรรทัดที่ 2:** `💎 Price: X Diamonds` หรือ `Price: FREE (0 Diamonds)` สีขาวสว่าง `\u001b[1;37m`
  - **บรรทัดลิงก์:** `👉 [Open Vault to Claim Item](url)`
- **แก้ไขรูปภาพไอเทมจริงที่มุมขวาบน (Thumbnail Fix):** ดึงรูปภาพไอเทมจริงที่อัปโหลด/ใส่ URL มาแสดงที่มุมขวาบน ไม่นำรูปไอคอนตัวอย่าง (`DEFAULT_ITEM_ICON_BASE64`) มาเขียนทับ

### 2. ความสืบเนื่องจาก v2.4.0:
- ระบบเปลี่ยนรหัสผ่านตามลำดับสิทธิ์ (ทุกคนเปลี่ยนของตนเองได้, Owner เปลี่ยนให้ทุกคนได้, Admin เปลี่ยนให้ Member/Leader ได้)
- ระบบจัดการและลบการแจ้งเตือนรายข้อความ + ปุ่มล้างทั้งหมด + ลบอัตโนมัติเมื่อไอเทมแจกแล้ว
- ระบบติดตามสถานะการชำระเงินของไอเทมแจกแล้ว (`รอชำระ` / `ชำระแล้ว` / `ฟรี`) พร้อมปุ่มยืนยันในหน้า Vault
- ปรับแต่งหน้าจอ My Stats แสดงวงเล็บภาษาไทยกำกับจางๆ พร้อมเคลียร์ placeholder ออกทั้งหมด
- สแนปช็อตข้อมูลสำรองเวอร์ชันล่าสุด `backups/complete_snapshot_v2.5.0.json`

---

## 2. กฎมาตรฐานการแจ้งเตือน Discord Webhook

### ข้อกำหนดทางเทคนิค (Locked Standard):
```typescript
// โครงสร้างข้อความ Embed ของ new_item ใน src/utils/discord.ts
payload = {
  content: `${mentionPrefix}⚔️ **New Boss Item Added to Vault!**`.trim(),
  username: settings.botName || 'Lineage 2M Clan Hub',
  avatar_url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=128&auto=format&fit=crop&q=80',
  allowed_mentions: allowedMentions,
  embeds: [
    {
      color: color,
      // ไม่มีฟิลด์ title เพื่อไม่ให้ซ้ำซ้อนกับบรรทัดแรกของ ANSI
      description: buildTemplateDescription(template, item, claimLink, data?.customNote),
      thumbnail: thumbnailObj, // รูปไอเทมจริงที่มุมขวาบน
      footer: { text: 'Lineage 2M Clan Hub • Guild Vault Alert' },
      timestamp: new Date().toISOString()
    }
  ]
};
```

### รูปแบบกรอบข้อความ ANSI 2 บรรทัด (Option 1):
```text
```ansi
\u001b[1;31m[EPIC] Chain Chasing\u001b[0m \u001b[1;37m(x1)\u001b[0m
\u001b[1;37m💎 Price: 1,500 Diamonds\u001b[0m
```
👉 [**Open Vault to Claim Item**](https://vault-link)
```

---

## 3. สถาปัตยกรรมระบบและการไหลของข้อมูล

```mermaid
flowchart TD
    subgraph WebClients["ผู้ใช้งานในระบบ (Clients)"]
        Owner["Owner (ควบคุมรหัสผ่านทุกคน, รีเซ็ตยอด, ตั้งค่า)"]
        Admin["Admin (เปลี่ยนรหัสผ่าน Member/Leader, ยืนยันชำระ, แจกของ)"]
        Member["Member (เปลี่ยนรหัสผ่านตนเอง, ขอรับของ, ดูสถานะชำระ)"]
    end

    subgraph AppState["ระบบจัดการสถานะ (React 19 + Local Cache)"]
        AppCore["App.tsx (Global State, Tab Sync, Notifications)"]
        LocalCache["localStorage (Dismissed Notifications, Offline Cache)"]
        AudioFX["Web Audio Sound Effects"]
    end

    subgraph BackendServices["บริการฝั่งเซิร์ฟเวอร์ (Express & Serverless)"]
        VercelAPI["Vercel Serverless /api (api/index.js)"]
        AdminAuthAPI["POST /api/users/:userId/change-password"]
        DiscordProxyAPI["POST /api/discord-proxy (Multipart Image & Webhook Relay)"]
        ScanOCRAPI["POST /api/scan-hunters (Gemini Proxy)"]
    end

    subgraph CloudData["คลาวด์และฐานข้อมูล (Cloud Firestore & Auth)"]
        FirebaseAdminSDK["Firebase Admin SDK (Auth User Records)"]
        FirestoreDB["Firestore Documents (vault_items, users, app_settings)"]
    end

    subgraph External["ระบบภายนอก"]
        DiscordBot["Discord Webhook (Option 1 ANSI 2 Lines + Real Thumbnail)"]
    end

    Admin -->|ลงไอเทมใหม่/แจกของ| AppCore
    AppCore -->|sendDiscordNotification| DiscordProxyAPI
    DiscordProxyAPI -->|Relay Webhook (English 100%)| DiscordBot
    Owner -->|เปลี่ยนรหัสผ่านใครก็ได้| AdminAuthAPI
    Admin -->|เปลี่ยนรหัสผ่าน Member/ตนเอง| AdminAuthAPI
    AdminAuthAPI -->|ตรวจสอบสิทธิ์และ Token| FirebaseAdminSDK
    FirebaseAdminSDK -->|อัปเดตรหัสผ่าน| FirestoreDB
    AppCore -->|confirmVaultItemPayment| FirestoreDB
```

---

## 4. ระบบเปลี่ยนรหัสผ่านตามลำดับสิทธิ์ (Role-Based Password Management)

| ระดับผู้สั่งการ | บัญชีตนเอง | สมาชิกทั่วไป (Member / Leader) | ผู้ดูแล (Admin) | เจ้าของระบบ (Owner) |
| :--- | :---: | :---: | :---: | :---: |
| **Owner (eloni)** | ✅ เปลี่ยนได้ | ✅ เปลี่ยนได้ | ✅ เปลี่ยนได้ | ✅ เปลี่ยนได้ |
| **Admin** | ✅ เปลี่ยนได้ | ✅ เปลี่ยนได้ | ❌ ไม่อนุญาต | ❌ ไม่อนุญาต |
| **Member / Leader** | ✅ เปลี่ยนได้ | ❌ ไม่อนุญาต | ❌ ไม่อนุญาต | ❌ ไม่อนุญาต |

---

## 5. การตรวจสอบข้อมูลและรายงานสำรองฉบับสมบูรณ์ (Verified Data Snapshot v2.5.0)

ข้อมูลในระบบถูกตรวจสอบและส่งออกไว้เป็นสแนปช็อตสำรองสมบูรณ์ที่:
- **`backups/complete_snapshot_v2.5.0.json`**
- **`backups/complete_snapshot_latest.json`**
- **สคริปต์ส่งออกข้อมูล:** `scripts/export_complete_v2.5.0_backup.mjs`

### 📊 สถิติข้อมูลระบบล่าสุด:
| ข้อมูล (Metric) | จำนวน (Count/Value) |
| :--- | :---: |
| จำนวนสมาชิก (Users) | 23 บัญชี |
| จำนวนไอเทมในคลัง (Vault Items) | 23 รายการ |
| จำนวนคิวไอเทม (Queue Items) | 5 รายการ |
| จำนวนแคลน (Clans) | 1 แคลนหลัก |
| ยอดคงเหลือคลังเพชร (Vault Balance) | 23,521 เพชร |

---

## 6. ขั้นตอนการรันคำสั่งและดีพลอย (Deployment & Verification Commands)

1. **ตรวจสอบ Type TypeScript:**
   ```powershell
   & 'C:\Program Files\nodejs\node.exe' 'node_modules\typescript\bin\tsc' --noEmit
   ```
2. **คอมไพล์โปรดักชัน Frontend:**
   ```powershell
   & 'C:\Program Files\nodejs\node.exe' 'node_modules\vite\bin\vite.js' build
   ```
3. **คอมไพล์เซิร์ฟเวอร์ Backend และ Serverless:**
   ```powershell
   & 'C:\Program Files\nodejs\node.exe' 'node_modules\esbuild\bin\esbuild' api/_entry.ts --bundle --platform=node --format=esm --packages=external --outfile=api/index.js
   & 'C:\Program Files\nodejs\node.exe' 'node_modules\esbuild\bin\esbuild' server.ts --bundle --platform=node --format=esm --packages=external --sourcemap --outfile=dist/server.js
   ```
4. **ส่งออกข้อมูลสำรอง v2.5.0:**
   ```powershell
   & 'C:\Program Files\nodejs\node.exe' 'scripts\export_complete_v2.5.0_backup.mjs'
   ```
5. **ดีพลอยขึ้น Vercel Production:**
   ```powershell
   vercel --prod --yes
   ```

---

## 7. คู่มือส่งมอบงานสำหรับนักพัฒนาและ AI สานต่องานทันที (AI & Developer Handover Guide)

ข้อความพร้อมคัดลอกไปวางเมื่อเปิดห้องแชทใหม่:

```text
โปรดอ่านไฟล์ SYSTEM_MANUAL_v2.5.0.md, AI_CONTEXT.md, AGENTS.md และ PROJECT_HANDOVER.md ในโปรเจกต์นี้ทั้งหมดก่อนเริ่มงาน
ระบบปัจจุบันคือ Lineage2M Clan Hub & Boss Item Vault (v2.5.0 — อัปเดตล่าสุด)
- บัญชี Owner: Eloni (สิทธิ์ Owner สูงสุด)
- Live Production: https://lineage2m-k7-item-vault.vercel.app/
- สถานะระบบล่าสุด (v2.5.0):
  1. กฎมาตรฐาน Discord Webhook (Rule 5): แจ้งเตือนเฉพาะไอเทมเท่านั้น, ข้อความ Discord เป็นภาษาอังกฤษ 100%, ห้ามใส่ title ซ้ำกับข้อความสี, ตัดบรรทัดคนล่าออกถาวร, และใช้แบบที่ 1 (Option 1 ANSI 2 บรรทัดกระชับ + รูปจริงมุมขวาบน) เท่านั้น
  2. ระบบเปลี่ยนรหัสผ่านตามลำดับสิทธิ์: ทุกคนเปลี่ยนของตนเองได้, Owner เปลี่ยนให้ทุกคนได้, Admin เปลี่ยนให้ Member/Leader ได้
  3. ระบบลบการแจ้งเตือนรายข้อความ + ปุ่มล้างทั้งหมด + ลบการแจ้งเตือนขอรับของอัตโนมัติเมื่อไอเทมแจกจ่ายแล้ว
  4. ระบบติดตามสถานะการชำระเงินของไอเทมแจกแล้ว (รอชำระ / ชำระแล้ว / ฟรี) พร้อมปุ่มยืนยันในหน้า Vault และแสดงสถานะสะอาดตาใน Dashboard
  5. หน้า My Stats มีวงเล็บภาษาไทยกำกับชื่อสเตตัสจางๆ อ่านง่าย พร้อมลบ placeholder ตัวเลขหลอกตาออกทั้งหมด
  6. บันทึก Discord Webhook และ Gemini OCR Key ถาวรข้ามแอดมินทุกคนผ่าน Firestore
  7. อัปเดตเวอร์ชัน v2.5.0 ครบทุกจุด (package.json, Navbar, Sidebar, LoginScreen)
  8. มีสแนปช็อตข้อมูลสำรองครบถ้วนที่ backups/complete_snapshot_v2.5.0.json (23 users, 23 vault items, 23,521 diamonds)
  9. ระบบ 2 ภาษา TH/EN 100% ทุกจุด
  10. Typecheck และ Vite Build ผ่าน 0 errors
โปรดยืนยันว่าเข้าใจสถาปัตยกรรมและกฎการป้องกันโค้ดเสียหายแล้ว พร้อมรับคำสั่งงานต่อไปครับ
```
