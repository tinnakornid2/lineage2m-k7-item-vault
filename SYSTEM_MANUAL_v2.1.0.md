# 🛡️ Lineage2M Clan Hub — คู่มือระบบและสถาปัตยกรรมฉบับสมบูรณ์ (System Manual v2.1.0)

> **เวอร์ชันระบบ:** `v2.1.0-complete-stable`  
> **ที่เก็บซอร์สโค้ด:** `https://github.com/tinnakornid2/lineage2m-k7-item-vault`  
> **สถานะการติดตั้ง (Deployment):** Production Ready (Vercel + Node.js Live Relay)  
> **มาตรฐานระบบสองภาษา:** รองรับภาษาไทย (TH) และภาษาอังกฤษ (EN) 100% ครบทุกจุด

---

## 📑 สารบัญ (Table of Contents)
1. [ภาพรวมระบบและสถาปัตยกรรมฐานข้อมูลคู่ (Dual-Database Architecture)](#1-ภาพรวมระบบและสถาปัตยกรรมฐานข้อมูลคู่)
2. [ระบบซิงค์สดเรียลไทม์ (Real-Time Live Relay Engine)](#2-ระบบซิงค์สดเรียลไทม์-real-time-live-relay-engine)
3. [กลไกสลับการทำงานอัตโนมัติเมื่อโควต้าเต็ม (Auto-Failover & Auto-Recovery)](#3-กลไกสลับการทำงานอัตโนมัติเมื่อโควต้าเต็ม)
4. [คู่มือการติดตั้ง Google Apps Script สำรองข้อมูล (Google Sheets & Drive)](#4-คู่มือการติดตั้ง-google-apps-script-สำรองข้อมูล)
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
        UserAdmin["Admin / Owner (อนุมัติสเตตัส / แจกไอเทม)"]
    end

    subgraph LiveEngine["ระบบซิงค์สดเรียลไทม์ (Live Relay Engine)"]
        Relay["Node.js Live Relay Server (/api/live-state)"]
        MemoryCache["Memory State Cache"]
        DiskSnapshot["Disk Snapshot (data/hub-live-state.json)"]
        EventEmitter["Event Emitter Wake-Up (< 20ms)"]
    end

    subgraph DataStorage["ฐานข้อมูลคู่ขนาน (Dual-Database)"]
        Firebase["Firebase Firestore Cloud (หลัก)"]
        GoogleApps["Google Sheets & Drive Web App (สำรองกลาง)"]
    end

    UserA -->|1. อัปเดตข้อมูล| Relay
    UserAdmin -->|1. อนุมัติ / แจกของ| Relay
    Relay -->|2. แคชในหน่วยความจำ| MemoryCache
    Relay -->|3. สำรองลงดิสก์| DiskSnapshot
    Relay -->|4. แจ้งเตือน| EventEmitter
    EventEmitter -->|5. ผลักข้อมูลสดทันที (<50ms)| UserB
    EventEmitter -->|5. ผลักข้อมูลสดทันที (<50ms)| UserA
    Relay -.->|โควต้าปกติ: บันทึก Cloud| Firebase
    Relay -.->|สำรองอัตโนมัติ: บันทึก Sheets| GoogleApps
    Firebase -.->|โควต้าเต็ม (50k)| GoogleApps
```

---

## 2. ระบบซิงค์สดเรียลไทม์ (Real-Time Live Relay Engine)

- **API Endpoint:** `/api/live-state` (รองรับทั้ง GET สำหรับ Long-polling และ POST สำหรับ Broadcast)
- **กลไกการทำงาน:**
  1. เมื่อผู้ใช้งานเปิดหน้าเว็บ ระบบจะสร้างการเชื่อมต่อแบบ Long-Polling รอรับการเปลี่ยนแปลงจากเซิร์ฟเวอร์
  2. เมื่อมีการเปลี่ยนแปลงข้อมูล (เช่น เคลมไอเทม, เปลี่ยนสเตตัส, เติมเพชรเข้าคลัง) ฝั่งผู้ส่งจะยิง `POST /api/live-state`
  3. เซิร์ฟเวอร์จะอัปเดตแคช และกระตุ้น `EventEmitter` เพื่อตอบกลับ Long-polling ของผู้ใช้คนอื่นๆ ทันที
  4. หน้าจอของทุกคนจะอัปเดตตัวเลขและสถานะใหม่ภายในเสี้ยววินาที **โดยไม่ต้องกดรีเฟรช F5**
  5. หากไม่มีการอัปเดต เซิร์ฟเวอร์จะตัด Timeout คืนสถานะ `{ modified: false }` ทุก 15 วินาที เพื่อป้องกันการค้างและประหยัดแบนด์วิธ

---

## 3. กลไกสลับการทำงานอัตโนมัติเมื่อโควต้าเต็ม

### กรณีที่ 1: Firebase ทำงานปกติ (Normal Operation)
- ป้ายสถานะบน Dashboard: `[🗄️ Firebase 🟢]` วางอยู่เคียงข้าง `🟢 ระบบออนไลน์`
- ข้อมูลจะถูกอ่านและเขียนขึ้น Firestore ตามปกติ
- ระบบจะทำ Snapshot สำรองไปยัง Google Sheets ของ Owner เป็นระยะตามรอบเวลา

### กรณีที่ 2: โควต้า Firebase เกินกำหนด (Daily Quota Exceeded - 50k Reads)
- เมื่อ Google Cloud แจ้งข้อผิดพลาด `RESOURCE_EXHAUSTED (Quota exceeded)` ระบบจะสลับมาใช้ Google Sheets & Drive เป็นฐานข้อมูลหลักโดยอัตโนมัติ 100%
- ป้ายสถานะบน Dashboard: เปลี่ยนเป็น `[⚡ Google Sheets 🟠]` (สำหรับ Owner สามารถคลิกเพื่อตรวจสอบสุขภาพ Firebase และจัดการชีตได้ทันที)
- สมาชิกทุกคนสามารถใช้งานต่อได้ตามปกติ เคลมไอเทม, ส่งสเตตัส, ดูคลังเพชรได้ไม่มีสะดุด ข้อมูลจะถูกบันทึกผ่าน Live Relay และ Google Sheets
- ระบบ Probe จะคอยส่งสัญญาณเช็ค Firebase ทุก 60 วินาที เมื่อโควต้ารายวันรีเซ็ต ระบบจะนำข้อมูลทั้งหมดซิงค์กลับขึ้น Firebase Cloud ให้อัตโนมัติ

---

## 4. คู่มือการติดตั้ง Google Apps Script สำรองข้อมูล

สำหรับ Owner เมื่อต้องการเชื่อมต่อ Google Sheets & Drive เข้ากับระบบ ให้ทำตามขั้นตอนดังนี้:

1. สร้าง Google Spreadsheet ใหม่ใน Google Drive ของคุณ
2. ไปที่เมนู **Extensions (ส่วนขยาย)** > **Apps Script**
3. วางโค้ด Google Apps Script ด้านล่างนี้แทนที่โค้ดเดิมทั้งหมด (โค้ดนี้รองรับระบบ **Chunking** ป้องกันปัญหาข้อความเกิน 50,000 ตัวอักษรในเซลล์เดียว):

```javascript
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000);
  try {
    var rawData = e.postData.contents;
    var json = JSON.parse(rawData);
    var action = json.action || 'sync';
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    if (action === 'sync') {
      var stateString = JSON.stringify(json.data);
      var CHUNK_SIZE = 45000;
      var chunks = [];
      for (var i = 0; i < stateString.length; i += CHUNK_SIZE) {
        chunks.push(stateString.substring(i, i + CHUNK_SIZE));
      }
      
      var rowData = [
        new Date(),
        json.action,
        chunks.length,
        json.data.users ? json.data.users.length : 0,
        json.data.vaultItems ? json.data.vaultItems.length : 0,
        json.data.vaultBalance || 0
      ];
      
      for (var c = 0; c < chunks.length; c++) {
        rowData.push(chunks[c]);
      }
      
      sheet.appendRow(rowData);
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        chunks: chunks.length,
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
```
4. กด **Deploy** > **New Deployment**
5. เลือกประเภท: **Web App**
6. ตั้งค่า:
   - **Execute as:** `Me (บัญชีของคุณ)`
   - **Who has access:** `Anyone (ทุกคน)`
7. คัดลอก URL ของ Web App ที่ได้ นำมาวางในช่องตั้งค่า **"จัดการฐานข้อมูลสำรอง Google Sheets"** ในหน้าเว็บ (เข้าใช้งานได้เฉพาะ Owner)

---

## 5. โครงสร้างสิทธิ์และการเข้าถึง

| ฟังก์ชันการทำงาน | สมาชิกทั่วไป (Member) | แอดมิน (Admin) | โอเนอร์ (Owner) |
|---|:---:|:---:|:---:|
| ดูข้อมูล Dashboard & Leaderboard | ✅ | ✅ | ✅ |
| ส่งคำขอเคลมไอเทม (Claim Item) | ✅ | ✅ | ✅ |
| ส่งภาพสกรีนช็อตและอัปเดตสเตตัส | ✅ | ✅ | ✅ |
| ตรวจสอบป้ายสถานะเซิร์ฟเวอร์ (ข้าง Online) | ✅ (อ่านอย่างเดียว) | ✅ (อ่านอย่างเดียว) | ✅ (คลิกเปิดจัดการได้) |
| อนุมัติ / ปฏิเสธสเตตัสสมาชิก (Approval) | ❌ | ✅ | ✅ |
| กระจายแจกจ่ายไอเทมในคลัง (Distribute) | ❌ | ✅ | ✅ |
| จัดการคลังเพชรแคลน (Diamond Vault) | ❌ | ✅ | ✅ |
| ตั้งค่า Gemini AI OCR Key | ❌ | ❌ | ✅ |
| ตั้งค่าภาพพื้นหลังปราสาท (Wallpaper) | ❌ | ❌ | ✅ |
| ตั้งค่า Webhook แจ้งเตือน Discord | ❌ | ❌ | ✅ |
| เชื่อมต่อและกู้คืน Google Sheets Backup | ❌ | ❌ | ✅ |

---

## 6. การตรวจสอบข้อมูลและรายงานสำรองฉบับสมบูรณ์

ชุดข้อมูล Snapshot เวอร์ชันสมบูรณ์ (`v2.1.0`) ได้รับการตรวจสอบความถูกต้องเรียบร้อยแล้ว:

- **จำนวนสมาชิกทั้งหมด (Total Members):** 21 สมาชิก (ได้รับการบันทึกข้อมูลสเตตัสและคลาสครบถ้วน)
- **ทำเนียบยอดฝีมือ (Top Power Leaderboard):**
  1. 🥇 **Nuinw** — พลังรบ 4,568 (คลาส Orb / แคลน VoltZ)
  2. 🥈 **Starfish** — พลังรบ 4,302 (คลาส Spear & Greatsword / แคลน VoltZ)
  3. 🥉 **Jackpo7** — พลังรบ 4,228 (คลาส Dual Blades & Crossbow / แคลน VoltZ)
  4. 🎖️ **sss** — พลังรบ 4,099 (คลาส Orb)
  5. 🎖️ **VimKnight** — พลังรบ 3,745 (คลาส Sword / แคลน VoltZ)
- **ไอเทมในคลัง (Vault Items):** 16 ชิ้น (รวมถึงการแจก *Bow of Halisha* ราคา 60,000 ไดมอนด์ให้แก่ ImaGiNe เรียบร้อยแล้ว)
- **กองทุนเพชรกลางของแคลน (Clan Diamond Fund):** **23,521** เพชร (คงเหลือถูกต้องตรงกับบันทึกจริง)

ไฟล์สำรองข้อมูลฉบับเต็มถูกจัดเก็บไว้อย่างถาวรที่:
`backups/complete_snapshot_v2.1.0.json`

---

## 7. ขั้นตอนการรันคำสั่งและดีพลอย

### กฎการรัน Node.js บน Windows (ป้องกันข้อผิดพลาดเปิดแอปถามหา npm)
ห้ามเรียกใช้คำสั่ง `npm` แบบเดี่ยวๆ ให้รันผ่าน Node runtime โดยตรงเสมอ:

```powershell
# 1. ตรวจสอบ Type ของ TypeScript (ต้องผ่าน 0 Error)
& 'C:\Program Files\nodejs\node.exe' 'node_modules\typescript\bin\tsc' --noEmit

# 2. Build โค้ดสำหรับ Production
& 'C:\Program Files\nodejs\node.exe' 'node_modules\vite\bin\vite.js' build

# 3. Export สำรองข้อมูลฉบับเต็ม v2.1.0
& 'C:\Program Files\nodejs\node.exe' 'scripts\export_complete_v2.1.0_backup.mjs'

# 4. รัน Dev Server พร้อมระบบ Live Relay
& 'C:\Program Files\nodejs\node.exe' 'node_modules\tsx\dist\cli.mjs' server.ts
```

### การดีพลอยขึ้น Vercel (Production Deployment)
โปรเจ็คเชื่อมต่อแบบ Continuous Integration (CI/CD) ผ่าน GitHub Repository:
- เมื่อรัน `git push origin main` ระบบของ Vercel จะเริ่มกระบวนการ Build และ Deploy อัตโนมัติทันที
- ผู้ใช้งานสามารถเข้าใช้งานผ่านโดเมนจริงของ Vercel ได้อย่างเสถียรและราบรื่น
