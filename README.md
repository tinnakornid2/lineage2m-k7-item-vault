# ⚔️ Lineage 2M Clan Hub & Boss Item Vault (v2.10.50)

[![Version](https://img.shields.io/badge/version-v2.10.50-amber.svg)](package.json)
[![Architecture](https://img.shields.io/badge/architecture-5--Tier%20Zero--Downtime-emerald.svg)](ARCHITECTURE.md)
[![Bilingual](https://img.shields.io/badge/i18n-100%25%20TH%20%7C%20EN-blue.svg)](AGENTS.md)
[![License](https://img.shields.io/badge/license-Private-red.svg)]()

> **Lineage 2M Clan Hub** คือเว็บแอปพลิเคชันบริหารจัดการแคลน, คลังไอเทมบอส (Boss Item Vault), คิวขอรับไอเทม (Item Queue), กองทุนเพชร (Diamond Treasury) และระบบตรวจสอบค่าพลังตัวละครผ่าน AI OCR (Gemini 2.5 Flash) ที่ถูกออกแบบด้วยสถาปัตยกรรม **5-Tier Zero-Downtime Resilience** เพื่อให้ระบบทำงานได้ลื่นไหล ไม่ค้าง ไม่จอดำ แม้โควต้าฟรีของฐานข้อมูลคลาวด์จะเต็ม

---

## 📑 สารบัญเอกสารโครงการ (Documentation Index)

สำหรับนักพัฒนา, AI หรือผู้ดูแลระบบที่เข้ามาทำงานต่อ สามารถศึกษาและเข้าใจระบบทั้งหมดได้ทันทีโดยไม่ต้องอ่านโค้ด:

| เอกสาร | รายละเอียด |
| :--- | :--- |
| 📘 **[ARCHITECTURE.md](ARCHITECTURE.md)** | **สถาปัตยกรรมระบบ 5 ชั้น & โครงสร้างข้อมูล** — เจาะลึก Zero-Downtime Model, LocalStorage Cache, Live State Relay Server, Firestore Failover (`safeFirestoreWrite`), Data Schemas และ Sync Engines |
| 🎮 **[WORKFLOWS_AND_FEATURES.md](WORKFLOWS_AND_FEATURES.md)** | **คู่มือระบบ, UI/UX และ เวิร์กโฟลว์การทำงาน 100%** — รายละเอียดทุกหน้าจอ (Dashboard, Vault, Queue, Members, My Stats), ระบบลากปรับกล่องไอเทม (Drag & Drop), การแจกจ่ายไอเทม, การหักภาษีเพชร, และระบบสแกนสเตตัสด้วย Gemini AI OCR |
| 🚀 **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** | **คู่มือเตรียมงานและขั้นตอน Deploy ขึ้น Production** — Pre-flight Checklist, การตั้งค่า Environment Variables, การเชื่อมต่อ Vercel / Firebase, และแผนกู้คืนระบบฉุกเฉิน (Disaster Recovery) |
| 🛡️ **[AGENTS.md](AGENTS.md)** | **กฎเหล็กภาคบังคับ 7 ข้อ (Golden Engineering Rules)** — กฎสองภาษา 100%, กฎ Local First, สิทธิ์ Owner, ข้อกำหนด Discord Webhook ภาษาอังกฤษ 100%, และการรัน Node บน Windows |

---

## ⚡ ไฮไลต์ฟีเจอร์สำคัญ (Core Highlights)

1. **คิวขอรับไอเทม & ระบบจัดลำดับอิสระ (Item Queue & Free Drag-and-Drop - v2.10.50):**
   - แยกกล่องชัดเจนระหว่าง **"👥 กดรับเอง (Open Queue)"** และ **"🔒 แอดมินแจก (Admin Pick)"**
   - **ลากปรับตำแหน่งกล่องไอเทมได้อย่างอิสระ (Drag & Drop):** แอดมินและโอเนอร์สามารถจับไอคอนมือจับ (Grip Vertical) หรือหัวการ์ดลากสลับตำแหน่งได้ทันที พร้อมเส้นขอบฟ้าและไฮไลต์สีทองอำพัน
   - ตารางรายชื่อคิวแบบ Tabular: จัดคอลัมน์ `#`, `ชื่อตัวละคร` (ตัดคำย่ออัตโนมัติพร้อม Tooltip), `ค่าพลัง` ชิดขวาตรงกันเป๊ะ, และ `จำนวนรับ/ขอ`

2. **คลังไอเทมบอส & การแจกจ่าย (Boss Item Vault & Claiming):**
   - ระบบลงไอเทมพร้อมอัปโหลดรูปภาพ / พรีวิวรูปภาพขยาย (Fullscreen Lightbox)
   - สมาชิกกดขอรับ (Claim) และคำนวณคะแนน Priority Score อัตโนมัติ (จากค่าพลัง, ประวัติการรับ, และความเหมาะสมของคลาส)
   - ระบบแจกจ่ายไอเทม (Direct Distribution) พร้อมติดตามสถานะการชำระเพชร (`⏳ รอชำระ`, `✓ ชำระแล้ว`, `🎁 ฟรี`)

3. **กองทุนเพชรและการกระจายเงินปันผล (Diamond Treasury & Dividends):**
   - คำนวณหักภาษีกิลด์ และแบ่งปันเพชรให้ทีมล่าบอส (Boss Hunters) อัตโนมัติ
   - บันทึกประวัติสมุดบัญชีเพชรแบบ Double-Entry ตรวจสอบย้อนหลังได้ทุกบิล

4. **สแกนสเตตัสด้วย Gemini 2.5 Flash AI OCR:**
   - สมาชิกเพียงแคปภาพหน้าจอในเกม อัปโหลดเข้าสู่หน้า My Stats
   - AI ตรวจจับตัวเลข Damage, Accuracy, Defense, Reduction, Skill Resist, Hit Chance และค่าพลัง (Combat Power) นำไปกรอกให้อัตโนมัติ
   - ข้อมูลจะอยู่ในสถานะ **"รอตรวจสอบ (Pending)"** จนกว่าแอดมินหรือโอเนอร์จะเทียบกับภาพถ่ายแล้วกดยืนยันอนุมัติ

5. **แจ้งเตือน Discord Webhook มาตรฐานสูง (Item-Only, English 100%):**
   - แจ้งเตือนเฉพาะฟังก์ชันเกี่ยวกับไอเทม (`new_item`, `distribute`) ตัดบรรทัดคนล่าออกถาวร
   - แสดงผลในกรอบข้อความ ANSI มีสีประจำระดับความหายาก (Mythic ทอง, Legend ม่วง, Epic แดง, Rare ฟ้า) สั้นกระชับ 2 บรรทัด พร้อมรูปภาพไอเทมจริงที่มุมขวาบน

6. **ระบบสองภาษา 100% (Mandatory Bilingual TH & EN):**
   - รองรับภาษาไทยและภาษาอังกฤษครอบคลุมทุกจุดในระบบ สลับภาษาได้ทันทีโดยไม่ต้องรีเฟรชหน้า

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

| ส่วนประกอบ | เทคโนโลยี |
| :--- | :--- |
| **Frontend Framework** | React 18 (Functional Components, Hooks, TypeScript) |
| **Build Tool & Bundler** | Vite 6 (ESM, Code Splitting, CSS Minification) |
| **Styling** | Tailwind CSS 3.4 (Custom Theme, Dark Mode, Animations) |
| **Backend & Cloud DB** | Google Firebase (Firestore Database, Firebase Authentication) |
| **Real-Time Relay Server** | Node.js + Express + `tsx` (In-Memory Live State Relay & SSE Broadcast) |
| **AI Integration** | Google Gemini API (`@google/genai`, Gemini 2.5 Flash Vision Model) |
| **Notification System** | Discord Webhooks (ANSI Terminal Formatting, Rich Embeds) |
| **Icons & Audio** | Lucide React, Web Audio API Sound Synthesizer |
| **Hosting & Deploy** | Vercel (Production Frontend + Serverless API Routes) / Local Node Server |

---

## 🚀 การติดตั้งและรันในเครื่อง Local (Quick Start)

### 1. ข้อกำหนดเบื้องต้น (Prerequisites)
- **Node.js:** v18.x หรือ v20.x LTS
- **OS:** Windows / macOS / Linux

> [!CAUTION]
> **สำหรับเครื่อง Windows:** ห้ามพิมพ์คำสั่ง `npm` แบบโดดเดี่ยว (เช่น `npm run build` หรือ `npm dev`) เพราะระบบ Windows อาจเปิดหน้าต่างถาม `Select an app to open 'npm'` ให้ใช้คำสั่งผ่านพาธตรงของ Node หรือ `npm.cmd` ตาม [AGENTS.md](AGENTS.md) เสมอ

### 2. รันแอปพลิเคชันในโหมดพัฒนา (Development Mode)
เปิด PowerShell ในโฟลเดอร์โปรเจกต์แล้วรันคำสั่ง:

```powershell
# รันเซิร์ฟเวอร์แบบ Full-Stack (Vite Frontend + Express Live Relay บนพอร์ต 3000)
& 'C:\Program Files\nodejs\node.exe' 'node_modules/tsx/dist/cli.mjs' server.ts
```

เมื่อเซิร์ฟเวอร์เริ่มทำงาน เปิดเบราว์เซอร์ไปที่:
👉 **`http://localhost:3000`**

### 3. ตรวจสอบความถูกต้องของโค้ดก่อนส่งงาน (Verification Commands)
```powershell
# 1. ตรวจสอบ TypeScript Types (ต้องผ่าน 0 Error)
& 'C:\Program Files\nodejs\node.exe' 'node_modules\typescript\bin\tsc' --noEmit

# 2. ทดสอบ Build สำหรับ Production
& 'C:\Program Files\nodejs\node.exe' 'node_modules\vite\bin\vite.js' build
```

---

## 📁 โครงสร้างโฟลเดอร์โปรเจกต์ (Project Directory Structure)

```text
lineage2m-k7-item-vault/
├── api/                             # Vercel Serverless API Handlers
│   ├── _firebaseAdmin.ts            # Firebase Admin SDK Configuration
│   ├── _server.ts                   # Centralized API logic & endpoints
│   ├── change-password.ts           # Admin/User Password Change Endpoint
│   ├── live-state.ts                # Real-Time State Sync Broadcast Relay
│   └── update-general-item-queue.ts # Queue Background Updater
├── backups/                         # ไฟล์สำรองข้อมูลระบบ JSON Snapshots
├── public/                          # สแตติกแอสเซท (Favicons, Sound FX, รูปภาพ)
├── src/
│   ├── components/                  # React UI Components
│   │   ├── DashboardView.tsx        # หน้าหลักภาพรวมกิลด์ & ไฮไลต์
│   │   ├── VaultView.tsx            # หน้ารายการไอเทมคลังบอส & แจกจ่าย
│   │   ├── GeneralItemQueueCard.tsx # หน้าระบบคิวไอเทม (ลากปรับตำแหน่ง, จัดคิว)
│   │   ├── MembersView.tsx          # หน้ารายชื่อสมาชิกกิลด์ & จัดการแคลน
│   │   ├── MyStatsView.tsx          # หน้าสเตตัสส่วนตัว & สแกนเนอร์ AI OCR
│   │   ├── Navbar.tsx               # แถบนำทางด้านบน & สลับภาษา
│   │   ├── Sidebar.tsx              # เมนูนำทางด้านข้าง & แสดงสถานะระบบ
│   │   ├── DiscordWebhookModal.tsx  # หน้าต่างตั้งค่า Discord Webhook
│   │   ├── DistributeItemModal.tsx  # หน้าต่างคำนวณภาษี & แจกจ่ายไอเทม
│   │   ├── GoogleDriveBackupModal.tsx # ศูนย์สำรอง & กู้คืนข้อมูล 1-Click
│   │   └── LoginScreen.tsx          # หน้าจอเข้าสู่ระบบ & ลงทะเบียน
│   ├── services/
│   │   ├── firebase.ts              # Firebase Firestore Engine, Caching & safeFirestoreWrite
│   │   └── geminiOcr.ts             # Google Gemini Vision OCR Scanner Engine
│   ├── utils/
│   │   ├── discord.ts               # Discord Webhook Payloads & ANSI Color Formatter
│   │   ├── diamondHelper.ts         # ตัวช่วยคำนวณเพชรและภาษีกิลด์
│   │   ├── sound.ts                 # Web Audio API Sound Effects
│   │   └── imageCompressor.ts       # ระบบบีบอัดรูปภาพก่อนอัปโหลด
│   ├── types.ts                     # TypeScript Interfaces & Data Models รวมทั้งระบบ
│   ├── translations.ts              # พจนานุกรมสองภาษา TH / EN รวมทั้งระบบ
│   ├── App.tsx                      # Root Application Component & Central State
│   └── main.tsx                     # React Entrypoint
├── server.ts                        # Local Express Relay Server + Vite Dev Middleware
├── vite.config.ts                   # การตั้งค่า Vite Build & Plugins
├── package.json                     # รายการ Dependencies & Version (v2.10.50)
├── ARCHITECTURE.md                  # สถาปัตยกรรม 5 ชั้น & ระบบซิงก์ข้อมูล
├── WORKFLOWS_AND_FEATURES.md        # รายละเอียด UI/UX และ เวิร์กโฟลว์ทั้งหมด
├── DEPLOYMENT_GUIDE.md              # ขั้นตอนเตรียมงานและขึ้น Production
└── AGENTS.md                        # กฎเหล็กของโปรเจกต์สำหรับผู้รับช่วงงานต่อ
```

---

## 🔒 ระดับสิทธิ์ในระบบ (User Permissions)

- **`Owner` (`eloni`)**: สิทธิ์สูงสุด ดูแลจัดการระบบทั้งหมด, จัดการรหัสผ่านทุกคน, ตั้งค่า Gemini AI OCR Key, จัดการ Discord Webhook, อนุมัติสเตตัส, รีเซ็ตข้อมูล และเข้าถึงฟังก์ชันระดับสูง
- **`Admin`**: ผู้ดูแลระบบ จัดการไอเทมในคลัง, จัดการคิว (รวมการลากสลับตำแหน่งไอเทม), ยืนยันการชำระเพชร, อนุมัติสเตตัสสมาชิก
- **`Manager` / `Party Leader`**: ผู้ช่วยจัดการ ดูแลปาร์ตี้และร่วมบริหารจัดการคิว
- **`Member`**: สมาชิกแคลน ขอรับไอเทม, เข้าคิว, อัปเดตสเตตัสของตนเอง, ดูประวัติและเงินปันผล
- **`Guest`**: ผู้เยี่ยมชม สามารถดูรายการไอเทมและข้อมูลสาธารณะของแคลนได้

---

> 📖 **คำแนะนำถัดไป:** โปรดอ่าน **[ARCHITECTURE.md](ARCHITECTURE.md)** เพื่อทำความเข้าใจโครงสร้างข้อมูล และ **[WORKFLOWS_AND_FEATURES.md](WORKFLOWS_AND_FEATURES.md)** เพื่อเข้าใจการทำงานของแต่ละหน้าจออย่างละเอียด
