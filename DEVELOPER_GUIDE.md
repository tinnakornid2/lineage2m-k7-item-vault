# 🛠️ Lineage2M Clan Hub — Developer & Maintainer Handover Guide (v2.6.0)

> **คู่มือส่งมอบงานและโครงสร้างสถาปัตยกรรมระบบ (Handover Architecture & Maintenance Guide)**  
> เอกสารฉบับนี้จัดทำขึ้นเพื่อให้ Developer / Maintainer ที่มารับช่วงต่อ สามารถเข้าใจการทำงานทั้งหมดของระบบ พัฒนาต่อ หรือแก้ไขปัญหาได้ทันที **โดยไม่ต้องเสียเวลาไล่อ่านโค้ดใหม่ทั้งหมด**

---

## 📌 1. ภาพรวมของระบบ (System Overview)

Lineage2M Clan Hub & Boss Item Vault เป็นเว็บแอพพลิเคชันระดับ Full-Stack สำหรับบริหารจัดการกิลด์และคลังไอเทมบอสเกม Lineage 2M ประกอบด้วย:
- **Boss Item Vault:** คลังไอเทมบอส, การขอเคลมไอเทม, การจัดคิว, การแจกจ่ายไอเทม, และการติดตามสถานะการชำระเงิน
- **Zero-Downtime Dual-Database:** ระบบสำรองและซิงค์ข้อมูลคู่ขนานระหว่าง **Firebase Firestore** และ **Google Sheets & Drive** ป้องกันปัญหาโควต้าเต็ม
- **Real-Time Live State Relay:** ระบบกระจายข้อมูลระหว่างสมาชิกในกิลด์ด้วยความเร็วสูง (< 50ms) ผ่าน Server Long-Polling (`/api/live-state`)
- **Power Formula Engine:** ระบบปรับแต่งสูตรคำนวณค่าพลังตัวละคร (Standard PL & Transfer PL) เต็มหน้าจอ พร้อม Sandbox จำลอง (`#power_formula`)
- **Side-by-Side Stat Proof Inspector:** ระบบตรวจสอบและอนุมัติสเตตัสสมาชิกแบบแบ่งครึ่งหน้าจอ (รูปสกรีนช็อตซูม-แพนได้ เทียบกับสเตตัสที่กรอก)
- **AI OCR Hunter Scanner:** สแกนรายชื่อผู้ล่าจากภาพปาร์ตี้บอสด้วย Google Gemini AI
- **Discord Webhook (Rule 5 Standard):** แจ้งเตือนไอเทมเข้าคลังและการแจกของด้วยฟอนต์ ANSI สีสันสวยงาม ภาษาอังกฤษ 100%

---

## 🏗️ 2. สถาปัตยกรรมและเทคโนโลยีที่ใช้ (Tech Stack & Architecture)

| ส่วนประกอบ | เทคโนโลยีที่ใช้ | รายละเอียด |
| :--- | :--- | :--- |
| **Frontend UI** | React 19 + TypeScript + Vite | พัฒนาด้วย Tailwind CSS v4, Lucide Icons, Motion Animation |
| **Backend Server** | Node.js + Express + TypeScript (`server.ts`) | ทำหน้าที่เป็น API Proxy, WebSocket/Long-polling Live Relay |
| **Primary Database** | Google Firebase (Firestore + Auth) | ฐานข้อมูล Cloud Real-time ปกติ |
| **Failover Database** | Google Sheets + Google Apps Script | ฐานข้อมูลสำรองฟรี ไม่จำกัดโควต้า เชื่อมต่อผ่าน Web App URL |
| **AI Integration** | Google Gemini GenAI SDK (`@google/genai`) | OCR สแกนชื่อสมาชิกจากสกรีนช็อตเกม |
| **Deployment** | Vercel Serverless + GitHub CI/CD | Push ขึ้น branch `main` แล้ว Vercel จะ build อัตโนมัติ |

---

## 🗂️ 3. โครงสร้างโฟลเดอร์และไฟล์สำคัญ (Key Files Map)

```
d:\Anti webapp\
├── api/
│   ├── _server.ts                  # โค้ด Express Server และ API Handlers ทั้งหมด
│   └── index.js                    # Serverless Entrypoint สำหรับ Vercel
├── backups/                        # สแนปช็อตสำรองข้อมูล JSON (ฉุกเฉิน)
│   ├── complete_snapshot_latest.json
│   └── complete_snapshot_v2.6.0.json
├── data/
│   └── hub-live-state.json         # แคชสถานะข้อมูลจริงปัจจุบันบนเซิร์ฟเวอร์
├── scripts/                        # สคริปต์ยูทิลิตี้ (export backup, firestore tools)
│   └── export_complete_v2.6.0_backup.mjs
├── src/
│   ├── App.tsx                     # คอมโพเนนต์หลัก: Global State, Routing, Failover Engine
│   ├── types.ts                    # ประกาศ Type/Interface ทั้งหมดของระบบ
│   ├── translations.ts             # คลังคำแปลระบบสองภาษา 100% (TH / EN)
│   │
│   ├── components/                 # UI Components แยกตามโมดูล
│   │   ├── DashboardView.tsx       # หน้าแรก สรุปสถิติ กองทุนเพชร คลังไอเทมล่าสุด
│   │   ├── VaultView.tsx           # หน้าคลังไอเทมเต็มรูปแบบ แถวละ 4 ชิ้น พร้อมตัวกรอง
│   │   ├── QueueView.tsx           # หน้าคิวรับไอเทม
│   │   ├── MembersView.tsx         # หน้ารายชื่อสมาชิก (มุมมองการ์ด และตาราง)
│   │   ├── ClansView.tsx           # หน้าจัดการแคลนพันธมิตร (Drag & Drop, Bulk Swap)
│   │   ├── PowerFormulaView.tsx    # หน้าสูตรคำนวณค่าพลังเต็มหน้าจอ (#power_formula)
│   │   ├── StatComparisonModal.tsx # กล่องตรวจสเตตัสเทียบรูปสกรีนช็อตแบบคู่ขนาน
│   │   ├── GoogleDriveBackupModal.tsx # แผงควบคุมและสถานะสำรองข้อมูล Google Sheets
│   │   ├── EditVaultItemModal.tsx  # เพิ่ม/แก้ไขไอเทมในคลัง
│   │   ├── ClaimantsModal.tsx      # รายชื่อผู้ขอรับไอเทม
│   │   ├── DistributeModal.tsx     # หน้าต่างแจกไอเทมและบันทึกภาพบิล
│   │   ├── GeminiKeyModal.tsx      # ตั้งค่า Gemini API Key (เฉพาะ Owner)
│   │   ├── DiscordBroadcastModal.tsx# ตั้งค่า Discord Webhook และ Role Mentions
│   │   ├── NotificationModal.tsx   # ศูนย์แจ้งเตือนในระบบ
│   │   ├── Sidebar.tsx             # เมนูด้านข้างพร้อมไฟสถานะ Google Sheets
│   │   └── Navbar.tsx              # แถบเมนูด้านบนพร้อมยอดกองทุนไดอา
│   │
│   ├── services/
│   │   ├── firebase.ts             # เชื่อมต่อ Firestore, Auth, Listener และตัวตรวจโควต้า
│   │   ├── googleSheetsBackupService.ts # ตัวจัดการซิงค์ Google Sheets, Live Relay, Auto-Recovery
│   │   ├── googleAppsScriptTemplate.ts # เทมเพลตโค้ด Apps Script สำหรับ Google Sheets
│   │   ├── discordWebhook.ts       # ส่งการ์ดแจ้งเตือน Discord แบบ ANSI Colors 100% EN
│   │   └── geminiService.ts        # เรียกใช้ Gemini API ทำ OCR สแกนชื่อสมาชิก
│   │
│   └── utils/
│       ├── sound.ts                # ระบบเสียงเอฟเฟกต์ (Click, Claim, Success, Error)
│       └── diamondHelper.ts        # คำนวณยอดคงเหลือกองทุนไดอา 1:1
│
├── GOOGLE_SHEETS_DATABASE_SCRIPT.js# โค้ด Apps Script พร้อมใช้งานสำหรับ Google Sheets
├── package.json                    # รายการ Dependencies และ Version v2.6.0
└── README.md                       # รายละเอียดโปรเจ็คภาษาไทยและอังกฤษ
```

---

## 🛡️ 4. สถาปัตยกรรมข้อมูลไม่สะดุด (Zero-Downtime Data Flow)

ระบบถูกออกแบบด้วยกลไก **Failover 4 ชั้น** เพื่อให้เว็บทำงานต่อเนื่องได้ 24 ชั่วโมง แม้ว่าโควต้าอ่านฟรีของ Firebase จะเต็ม:

```
[ผู้ใช้แก้ไขข้อมูลในหน้าเว็บ]
            │
            ▼
     [App.tsx Local State อัปเดตทันที]
            │
    ┌───────┴─────────────────────────┐
    ▼                                 ▼
[/api/live-state Relay]       [Debounced Auto-Backup 10s]
    │                                 │
    ▼                                 ▼
[กระจายให้สมาชิกทุกคน (< 50ms)]   [ส่งบันทึกลง Google Sheets & Drive]
                                      │
            ┌─────────────────────────┘
            ▼
    [ตรวจสอบสถานะ Firebase]
            │
    ├── ปกติ ──> เขียนลง Firestore Cloud ทันที
    │
    └── โควต้าเต็ม ──> สลับมาดึง/บันทึกผ่าน Google Sheets
                       พร้อมตั้งสถานะ pendingFirebaseSync = true
                       (เมื่อโควต้ารีเซ็ต Heartbeat Probe จะเขียนกลับขึ้น Cloud ให้เอง 100%)
```

---

## 👥 5. ระบบสิทธิ์และการควบคุม (Role-Based Permissions)

ระบบมี 4 สิทธิ์หลัก:
1. **Owner (บัญชี `eloni`):**
   - สิทธิ์สูงสุดเพียงคนเดียวในระบบ
   - เข้าถึงเมนูตั้งค่า Google Sheets & Drive Database
   - แก้ไขและบันทึก Gemini API Key
   - รีเซ็ตยอดกองทุนไดอา (Owner Reset Fund)
   - ลบบัญชีผู้ใช้งานหรือเปลี่ยนรหัสผ่านให้ทุกคน
2. **Admin:**
   - เพิ่ม/แก้ไข/ลบไอเทมในคลัง
   - สแกนภาพสกรีนช็อตด้วย OCR Gemini AI
   - ตรวจสอบและอนุมัติสเตตัสสมาชิกผ่านหน้าต่าง Side-by-Side Stat Proof
   - แจกจ่ายไอเทมและบันทึกภาพบิล
3. **Leader:**
   - สิทธิ์ระดับหัวหน้าปาร์ตี้ ดูข้อมูลภายในและช่วยจัดสรรคิว
4. **Member:**
   - ดูคลังไอเทม ขอเคลมไอเทม ส่งผลสเตตัสตนเองพร้อมแนบสกรีนช็อต เปลี่ยนรหัสผ่านตนเอง

---

## ⚖️ 6. กฎเหล็ก 5 ข้อที่ต้องปฏิบัติตามอย่างเคร่งครัด (Mandatory Rules)

### กฎข้อที่ 1: ระบบสองภาษา 100% ทุกจุด (Mandatory Bilingual TH & EN)
- ทุก Component หรือข้อความที่สร้างใหม่ **ต้องรองรับ 2 ภาษาเสมอ** ห้าม Hardcode ภาษาเดียว
- ใช้รูปแบบ: `{lang === 'th' ? 'ข้อความภาษาไทย' : 'English text'}` หรือเรียกใช้ผ่าน `translations.ts`

### กฎข้อที่ 2: กฎการ Deploy และ Git (Local First Rule)
- ทุกการแก้ไขต้องทดสอบบน Local Server (`http://localhost:3000`) ให้ผ่านก่อน
- **ห้าม** รัน `git push` หรือ deploy ขึ้น Vercel จนกว่าผู้ใช้งานจะสั่งยืนยันอย่างชัดเจน

### กฎข้อที่ 3: สิทธิ์ความปลอดภัย
- Gemini API Key มองเห็นและแก้ไขได้เฉพาะ Owner (`eloni`) เท่านั้น
- สเตตัสที่สมาชิกส่งมาจะอยู่ในสถานะ `Pending` เสมอ จนกว่า Admin หรือ Owner จะตรวจสอบคู่กับภาพสกรีนช็อตและกดอนุมัติ

### กฎข้อที่ 4: การเรียก Node บน Windows
- **ห้ามเรียก `npm` แบบชื่อเปล่าเดี่ยวๆ** ในคำสั่งเทอร์มินัลของ Windows เพราะอาจทำให้เกิดป๊อปอัปถามเลือกแอพ
- ให้เรียกผ่าน Node Binary Path โดยตรง เช่น:
  ```powershell
  & 'C:\Program Files\nodejs\node.exe' 'node_modules\typescript\bin\tsc' --noEmit
  & 'C:\Program Files\nodejs\node.exe' 'node_modules\vite\bin\vite.js' build
  ```

### กฎข้อที่ 5: กฎมาตรฐานการแจ้งเตือน Discord Webhook
- ส่งแจ้งเตือน Discord **เฉพาะฟังก์ชันไอเทมเท่านั้น** (`new_item`, `distribute`, `test`) ห้ามส่งการแจ้งเตือนสเตตัสเข้า Discord
- **ข้อความ Discord ต้องเป็นภาษาอังกฤษ 100%** (Titles, Code blocks, Fields, Links)
- **บังคับใช้แบบที่ 1 (Option 1):** กรอบ ANSI 2 บรรทัดพร้อมสีตามระดับความหายาก + ลิงก์เคลม + รูปจริงมุมขวาบน ห้ามใส่ Title ซ้ำซ้อน และตัดบรรทัดคนล่าออกถาวร

---

## 🚀 7. ขั้นตอนการรันและทดสอบระบบ (Local Development)

### เริ่มต้นเปิดเซิร์ฟเวอร์ Local:
```powershell
& 'C:\Program Files\nodejs\node.exe' 'node_modules\tsx\dist\cli.mjs' server.ts
```
ระบบจะเปิดบริการที่ `http://localhost:3000` (Vite Frontend + Express API)

### ตรวจสอบ Types และการคอมไพล์:
```powershell
& 'C:\Program Files\nodejs\node.exe' 'node_modules\typescript\bin\tsc' --noEmit
```

### ทดสอบการ Build:
```powershell
& 'C:\Program Files\nodejs\node.exe' 'node_modules\vite\bin\vite.js' build
```

### ส่งออก Snapshot สำรองข้อมูล:
```powershell
& 'C:\Program Files\nodejs\node.exe' 'scripts/export_complete_v2.6.0_backup.mjs'
```

---

## 📝 8. คำแนะนำการต่อยอดฟีเจอร์ในอนาคต (Extending Features)

1. **ต้องการเพิ่มค่าสเตตัสใหม่ของตัวละคร:**
   - เพิ่มฟิลด์ใน `types.ts` ภายใต้ interface `CharacterStats`
   - เพิ่มคำแปลใน `src/translations.ts`
   - เพิ่มตัวคูณในสูตรคำนวณที่ `PowerFormulaView.tsx` และฟังก์ชัน `computeStandardPowerLevel`
2. **ต้องการเพิ่มช่องทางแจ้งเตือนใหม่ (เช่น Line Notify หรือ Telegram):**
   - สร้าง service ใหม่ใน `src/services/`
   - เรียกใช้งานผ่าน `api/_server.ts` เพื่อความปลอดภัยของ Token
3. **ต้องการกู้คืนข้อมูลระบบฉุกเฉิน:**
   - โฟลเดอร์ `backups/` จะมีไฟล์ `complete_snapshot_latest.json` ที่มีข้อมูลสมาชิก คลังไอเทม และประวัติทั้งหมดครบถ้วน สามารถนำไป import กลับเข้า Firestore หรือ Google Sheets ได้ทันที

---
*เอกสารนี้ได้รับการตรวจสอบและปรับปรุงล่าสุดสำหรับเวอร์ชัน **v2.6.0** พร้อมสำหรับการทำงานต่อได้ทันที 100%*
