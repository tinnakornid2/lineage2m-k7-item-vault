# 🛡️ Lineage2M Clan Hub — คู่มือระบบและสถาปัตยกรรมฉบับสมบูรณ์ (System Manual v2.2.0)

> **เวอร์ชันระบบ:** `v2.2.0-discord-templates-stable`  
> **ที่เก็บซอร์สโค้ด:** `https://github.com/tinnakornid2/lineage2m-k7-item-vault`  
> **สถานะการติดตั้ง (Deployment):** Production Ready (Vercel + Node.js Live Relay)  
> **มาตรฐานระบบสองภาษา:** รองรับภาษาไทย (TH) และภาษาอังกฤษ (EN) 100% ครบทุกจุด  
> **สแนปช็อตข้อมูล:** `backups/complete_snapshot_v2.2.0.json` (22 users, 16 vault items, 23,521 diamonds)

---

## 📑 สารบัญ (Table of Contents)
1. [ภาพรวมระบบและสถาปัตยกรรมฐานข้อมูลคู่ (Dual-Database Architecture)](#1-ภาพรวมระบบและสถาปัตยกรรมฐานข้อมูลคู่)
2. [ระบบแม่แบบข้อความและการแจ้งเตือน Discord (Discord Templates & ANSI Colors)](#2-ระบบแม่แบบข้อความและการแจ้งเตือน-discord)
3. [ระบบซิงค์สดเรียลไทม์ (Real-Time Live Relay Engine)](#3-ระบบซิงค์สดเรียลไทม์-real-time-live-relay-engine)
4. [กลไกสลับการทำงานอัตโนมัติเมื่อโควต้าเต็ม (Auto-Failover & Auto-Recovery)](#4-กลไกสลับการทำงานอัตโนมัติเมื่อโควต้าเต็ม)
5. [โครงสร้างสิทธิ์และการเข้าถึง (Roles & Security Permissions)](#5-โครงสร้างสิทธิ์และการเข้าถึง)
6. [การตรวจสอบข้อมูลและรายงานสำรองฉบับสมบูรณ์ (Verified Data Snapshot)](#6-การตรวจสอบข้อมูลและรายงานสำรองฉบับสมบูรณ์)
7. [ขั้นตอนการรันคำสั่งและดีพลอย (Deployment & Commands)](#7-ขั้นตอนการรันคำสั่งและดีพลอย)

---

## 1. ภาพรวมระบบและสถาปัตยกรรมฐานข้อมูลคู่

Lineage2M Clan Hub ถูกออกแบบให้มีความยืดหยุ่นสูง (High Availability) สามารถทำงานได้อย่างต่อเนื่องแม้เกิดข้อจำกัดทางเทคนิคของคลาวด์ใดคลาวด์หนึ่ง โดยผสานการทำงานระหว่าง:
1. **Firebase Firestore Cloud (ระบบหลัก - Primary Database):** ทำหน้าที่จัดเก็บข้อมูลแบบกระจายศูนย์บน Google Cloud ให้การเข้าถึงที่รวดเร็ว
2. **Google Sheets & Google Drive (ระบบสำรองกลางของ Owner - Secondary/Backup Database):** ทำหน้าที่เป็นแหล่งจัดเก็บข้อมูลสำรองกลางที่ปลอดภัยและไม่มีค่าใช้จ่าย จัดเก็บตารางข้อมูลและไฟล์รูปภาพสกรีนช็อตทั้งหมด
3. **Node.js Live Relay Engine (ระบบซิงค์สดเรียลไทม์):** เป็นสะพานเชื่อมต่อข้อมูลระหว่างผู้ใช้งานทุกคน ทำให้เมื่อมีสมาชิกคนใดอัปเดตข้อมูล ทุกคนในแคลนจะเห็นผลทันทีแบบสดๆ (<50ms) โดยไม่ต้องรีเฟรชหน้าเว็บ

### แผนภาพการไหลของข้อมูล (Data Flow Architecture)

```mermaid
flowchart TD
    subgraph Clients["ผู้ใช้งานในระบบ (Clients)"]
        UserA["สมาชิก A (ส่งเคลม / แก้ไขสเตตัส)"]
        UserB["สมาชิก B (ดู Dashboard)"]
        UserAdmin["Admin / Owner (อนุมัติสเตตัส / แจกไอเทม / ส่ง Discord)"]
    end

    subgraph LiveEngine["ระบบซิงค์สดเรียลไทม์ (Live Relay Engine)"]
        Relay["Node.js Live Relay Server (/api/live-state)"]
        MemoryCache["Memory State Cache"]
        DiskSnapshot["Disk Snapshot (data/hub-live-state.json)"]
        EventEmitter["Event Emitter Wake-Up (< 20ms)"]
    end

    subgraph External["ระบบภายนอก (External Integrations)"]
        DiscordAPI["Discord Webhook API (ANSI Colors + Native Images)"]
        GeminiOCR["Google Gemini AI (Party OCR Hunter Extraction)"]
        Firebase["Firebase Firestore Cloud (หลัก)"]
        GoogleApps["Google Sheets & Drive Web App (สำรองกลาง)"]
    end

    UserA -->|1. อัปเดตข้อมูล| Relay
    UserAdmin -->|1. ส่ง Discord / แจกของ| Relay
    Relay -->|2. แคชในหน่วยความจำ| MemoryCache
    Relay -->|3. สำรองลงดิสก์| DiskSnapshot
    Relay -->|4. แจ้งเตือน| EventEmitter
    EventEmitter -->|5. ผลักข้อมูลสดทันที (<50ms)| UserB
    EventEmitter -->|5. ผลักข้อมูลสดทันที (<50ms)| UserA
    Relay -->|6. ส่งข้อความแบบฟอร์มมัลติพาร์ท| DiscordAPI
    Relay -.->|โควต้าปกติ: บันทึก Cloud| Firebase
    Relay -.->|สำรองอัตโนมัติ: บันทึก Sheets| GoogleApps
```

---

## 2. ระบบแม่แบบข้อความและการแจ้งเตือน Discord (v2.2.0 New Feature)

### 🎨 แม่แบบข้อความ 4 รูปแบบ (Discord Message Templates)
1. **🌟 Radiant Neon (`neon_glow` - ค่าเริ่มต้น):**
   - กรอบ ANSI Syntax Highlighting เรืองแสงตามระดับไอเทม สไตล์ MMORPG
   ```ansi
   [EPIC] Breka's Soul (x1)
   Price: FREE (0 Diamonds)
   ```
2. **⚔️ Siege & War Vault Alert (`war_horn`):**
   - สไตล์บัญชาการรบ ดุดัน แจ้งเตือนชัยชนะบอสและเปิดสิทธิ์เคลมเสริมทัพกิลด์
   ```ansi
   [WAR VAULT] [EPIC] Breka's Soul
   Price: FREE (0 Diamonds) (x1) • Claim Ready
   ```
3. **🏛️ Guild Treasury & Market (`clan_market`):**
   - สไตล์ตลาดประมูลปราสาทกีรัน เน้นราคาเพชรและรายการไอเทม
   ```ansi
   [MARKET] [EPIC] Breka's Soul
   Value: FREE (0 Diamonds) (x1)
   ```
4. **✨ Crystal Minimal (`crystal_minimal`):**
   - การ์ด Embed กระชับ สวยงาม อ่านง่าย สบายตา

### 🎯 รหัสสี ANSI ของ Discord ตามระดับความหายาก:
- 🟨 **MYTHIC:** ฟอนต์สีทอง (`\u001b[1;33m`)
- 🟪 **LEGEND:** ฟอนต์สีม่วงเรืองแสง (`\u001b[1;35m`)
- 🟥 **EPIC:** ฟอนต์สีแดงเรืองแสง (`\u001b[1;31m`)
- 🟦 **RARE:** ฟอนต์สีฟ้าเรืองแสง (`\u001b[1;36m`)
- 💎 **ราคาเพชร:** ฟอนต์สีเขียวเรืองแสง (`\u001b[1;32m`)

### 🖼️ การแนบรูปภาพ Thumbnail อัตโนมัติ (Native Multipart Uploads)
- **Local Proxy Endpoint:** `POST /api/discord-webhook` รับรูปภาพแบบ Base64 และแปลงเป็น Binary Buffer ส่งเป็น `multipart/form-data` ผ่านคีย์ `files[0]`
- **Embed Pointer:** `payload.embeds[0].thumbnail = { url: "attachment://item.jpg" }`
- **Fallback Icon:** หากไอเทมไม่มีภาพ หรือเป็นการกดปุ่ม "ทดสอบส่ง Discord" ระบบจะดึง `DEFAULT_ITEM_ICON_BASE64` ขึ้นมาแสดงเป็น Thumbnail อัตโนมัติ 100%

---

## 3. ระบบซิงค์สดเรียลไทม์ (Real-Time Live Relay Engine)

ระบบ Live Relay ถูกพัฒนาขึ้นเพื่อแก้ปัญหาความล่าช้าในการรีเฟรชข้อมูล:
- **Long-Polling + SSE Emulation:** ผู้ใช้แต่ละคนจะเปิดการเชื่อมต่อ Long-Polling รอไว้ที่ `/api/live-state?since={version}`
- **Instant Wake-Up:** เมื่อมีข้อมูลอัปเดต เซิร์ฟเวอร์จะปลุก Request ที่รออยู่ทั้งหมดส่งข้อมูลกลับทันทีภายใน 20-50ms
- **สถานะเซิร์ฟเวอร์บน Navbar:** มีไฟสถานะ `● Live (0.05s)` แสดงผลข้างปุ่มออนไลน์ ช่วยให้ผู้ใช้ทราบว่าระบบสดกำลังทำงานอย่างสมบูรณ์

---

## 4. กลไกสลับการทำงานอัตโนมัติเมื่อโควต้าเต็ม (Auto-Failover & Auto-Recovery)

เมื่อ Firebase Firestore แจ้งเตือน `RESOURCE_EXHAUSTED` (เกินโควต้าอ่าน 50,000 ครั้ง/วัน):
1. **Local Persistent Cache:** ระบบดึงข้อมูลจาก `localStorage` มาแสดงผลทันที ไม่ทำให้หน้าจอขาวหรือว่างเปล่า
2. **Auto-Failover to Google Sheets:** ระบบดึงข้อมูลจาก Google Apps Script สำรองกลางขึ้นมาทำงานแทน
3. **Auto-Recovery:** เมื่อเริ่มวันใหม่และโควต้า Firestore รีเซ็ต ระบบจะทยอยซิงค์ข้อมูลกลับขึ้น Firestore อย่างราบรื่น

---

## 5. โครงสร้างสิทธิ์และการเข้าถึง (Roles & Security Permissions)

| บทบาท (Role) | สิทธิ์การเข้าถึง (Permissions) | การป้องกันความปลอดภัย |
| :--- | :--- | :--- |
| **`owner` (eloni)** | สิทธิ์สูงสุดทุกอย่าง: ตั้งค่า Gemini AI Key, ตั้งค่า Discord Webhook, รีเซ็ตยอดเพชร, รีเซ็ตระบบ, อนุมัติสเตตัส, จัดการผู้ใช้ | **Immutable Protection** ไม่สามารถถูกลดขั้นหรือลบโดยแอดมินคนอื่นได้ |
| **`admin`** | เพิ่ม/แก้ไข/แจกจ่ายไอเทม, ส่ง Discord, อนุมัติสเตตัส, ดูประวัติและยอดเพชร | ไม่สามารถแก้ไขคีย์ Gemini หรือกดปุ่มรีเซ็ตระบบได้ |
| **`manager`** | ตรวจสอบสเตตัส, ดูคลัง, แจกจ่ายไอเทม | สิทธิ์จำกัดตามที่ Owner มอบหมาย |
| **`party_leader`** | ลงคิวไอเทม, สแกน OCR ปาร์ตี้บอส, จัดการสมาชิกในตี้ | สิทธิ์เฉพาะการจัดการปาร์ตี้ |
| **`member`** | ดูไอเทมในคลัง, ส่งคำขอเคลมไอเทม, ส่งคำขออัปเดตสเตตัส | สเตตัสใหม่จะอยู่ในสถานะ `pending` จนกว่า Admin จะอนุมัติ |

---

## 6. การตรวจสอบข้อมูลและรายงานสำรองฉบับสมบูรณ์ (Verified Data Snapshot)

สแนปช็อตข้อมูลสำรองสมบูรณ์เวอร์ชัน v2.2.0 ถูกบันทึกไว้ที่:
📁 **`backups/complete_snapshot_v2.2.0.json`** และ **`backups/complete_snapshot_latest.json`**

### สรุปตัวเลขสถิติล่าสุด (Metrics):
- **จำนวนสมาชิกในระบบ (Users):** 22 คน (พร้อมสเตตัสพลังรบและคลาสตัวละคร)
- **จำนวนไอเทมในคลัง (Vault Items):** 16 ชิ้น
- **จำนวนไอเทมในคิว (Queue Items):** 5 ชิ้น
- **จำนวนแคลนพันธมิตร (Clans):** 1 แคลนหลัก (`VoltZ`)
- **ยอดเพชรกองทุนส่วนกลาง (Vault Balance):** 23,521 เพชร

---

## 7. ขั้นตอนการรันคำสั่งและดีพลอย (Deployment & Commands)

> [!IMPORTANT]
> **กฎการเรียก Node บน Windows:** ห้ามเรียกคำว่า `npm` โดดๆ ให้ใช้ Absolute Path ของ Node.js:
> `& 'C:\Program Files\nodejs\node.exe' 'node_modules\...'`

### 1. การตรวจสอบ Typecheck:
```powershell
& 'C:\Program Files\nodejs\node.exe' 'node_modules\typescript\bin\tsc' --noEmit
```

### 2. การสร้าง Production Bundle:
```powershell
& 'C:\Program Files\nodejs\node.exe' 'node_modules\vite\bin\vite.js' build
```

### 3. การรันเซิร์ฟเวอร์ Localhost:
```powershell
& 'C:\Program Files\nodejs\node.exe' 'node_modules\tsx\dist\cli.mjs' server.ts
```

### 4. การส่งออกสแนปช็อตสำรองข้อมูล:
```powershell
& 'C:\Program Files\nodejs\node.exe' 'scripts\export_complete_v2.2.0_backup.mjs'
```

### 5. การ Deploy ขึ้น Production:
- โครงการเชื่อมต่อ GitHub กับ Vercel ไว้อัตโนมัติ:
  ```powershell
  git add .
  git commit -m "feat(v2.2.0): Discord templates, glowing ANSI fonts, image delivery, and v2.2.0 snapshot"
  git tag v2.2.0
  git push origin main
  git push origin v2.2.0
  ```
- Vercel จะตรวจจับ Commit ล่าสุดและเริ่มกระบวนการ Build & Deploy สดขึ้นสู่ `https://lineage2m-k7-item-vault.vercel.app/` ทันที
