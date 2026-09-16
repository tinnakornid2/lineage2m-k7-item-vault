# 🤖 AI_CONTEXT.md — สรุปบริบทและสถาปัตยกรรมระบบ Lineage2M Clan Hub
> **สำหรับ AI ในการทำความเข้าใจโปรเจกต์อย่างรวดเร็วและครบถ้วน 100% (เวอร์ชันปัจจุบัน: v2.3.0 — อัปเดตล่าสุด)**

เมื่อเปิดห้องแชทใหม่ ให้สั่ง AI อ่านไฟล์นี้ทันที เพื่อให้เข้าใจโครงสร้าง สถาปัตยกรรม โค้ด และกฎทางธุรกิจทั้งหมดโดยไม่ต้องอธิบายใหม่

---

## 1. ข้อมูลภาพรวมโปรเจกต์ (Project Overview)
- **ชื่อโปรเจกต์:** Lineage2M Clan Hub & Boss Item Vault System
- **เวอร์ชันปัจจุบัน:** `v2.3.0-discord-white-price-persistence-stable`
- **วัตถุประสงค์:** เว็บแอปพลิเคชันสำหรับบริหารจัดการแคลน/กิลด์ในเกม Lineage 2M ประกอบด้วย:
  1. **คลังไอเทมดรอปจากบอส (Boss Drop Item Vault):** แสดงผล 4 คอลัมน์ต่อแถวบน Desktop, การ์ดไอเทมกระชับ 2 บรรทัดติดรูปภาพ, ลงชื่อขอรับ (Claim), แจกจ่ายของ (Distribute), แก้ไขไอเทมเปิดรับ (Edit Item), และระบบจำชื่อไอเทมอัตโนมัติ (Autocomplete)
  2. **ระบบแจ้งเตือน Discord 4 รูปแบบ พร้อมฟอนต์สีขาวสำหรับราคาเพชร:** Discord ANSI Glowing Colors (MYTHIC ทอง, LEGEND ม่วง, EPIC แดง, RARE ฟ้า, และราคาเพชรเป็นสีขาว `\u001b[1;37m` เช่น `Price: FREE (0 Diamonds)`), ส่งรูปภาพ Thumbnail อัตโนมัติแบบ Multipart
  3. **ระบบบันทึกการตั้งค่าข้ามแอดมิน (Shared Persistence):** Discord Webhook (`app_settings/discord`) และ Gemini AI OCR Key (`app_settings/gemini_ai`) ซิงค์ผ่าน Firestore เรียลไทม์ รีเฟรชไม่หาย แอดมินทุกคนใช้ร่วมกันได้ทันที
  4. **ระบบ Vercel Serverless ที่เสถียร 100%:** แก้ไข `FUNCTION_INVOCATION_FAILED` ด้วย Dynamic Import และ Lambda Promise Lifecycle
  5. **ระบบหน้าจอ Fluid Dynamic Auto-Scaling:** ปรับขนาดตามหน้าต่างเบราว์เซอร์อัตโนมัติ ไม่จำกัด max-width รองรับ Split-Screen, แล็ปท็อป และหน้าจอ Ultrawide
  6. **ระบบรักษาหน้าเดิมเมื่อรีเฟรช (Tab & Hash Persistence):** รองรับ URL Hash (`#vault`, `#queue`, `#distribution`, ฯลฯ) และ `localStorage` ทำให้กด F5 หรือ Back/Forward ไม่เด้งกลับหน้า Dashboard
  7. **ระบบแนบรูปบิล/ใบเสร็จได้หลายใบต่อ 1 ไอเทม:** สำหรับไอเทมที่แจกแล้ว พร้อมแกลเลอรีซูมและจัดการรูปบิล
  8. **ระบบคิวไอเทม (Item Queue Management):** จัดลำดับการรับของล่วงหน้า พร้อมระบบตรวจสอบสเตตัสก่อนเคลม
  9. **ระบบสแกนรายชื่อผู้ล่าจากภาพสกรีนช็อตปาร์ตี้บอสด้วย AI (Google Gemini AI OCR):** สแกนผ่าน Backend Proxy และ Direct Client
  10. **ระบบคลังเพชรกลาง/กองทุนแคลน (Clan Fund):** ฝาก-ถอนแบบ 1:1 ตรงตามจริง พร้อมปุ่ม "รีเซ็ตยอด" (Reset Balance) เฉพาะ Owner
  11. **ระบบจัดการแคลนและสมาชิก (Clan & Alliance Management):** รองรับการลากย้ายแคลน (Drag & Drop และ Bulk Swap)
  12. **รองรับการวางรูปภาพจากคลิปบอร์ดโดยตรง (Ctrl + V / Copy-Paste):** ทุกจุดที่มีการอัปโหลดรูป
  13. **รองรับ 2 ภาษา ทั้งไทย (TH) และ อังกฤษ (EN) 100%:** ครอบคลุมทุกจุด ไม่มี hardcode
  14. **ธีม Dark Fantasy ปราสาท Lineage 2M พร้อมเสียงเอฟเฟกต์ Sound FX**

---

## 2. เทคโนโลยีที่ใช้ (Tech Stack)
- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide React (Icons), Motion
- **Backend / Dev Server:** Node.js, Express 4 (`server.ts`), ESBuild, tsx
- **Serverless Production:** Vercel Serverless Function (`api/index.js` bundled from `api/_entry.ts`)
- **Database & Sync:** Google Firebase Cloud Firestore (`firebase.ts`) — Real-time snapshots (`onSnapshot`)
- **AI OCR:** Google GenAI SDK (`@google/genai` - Gemini Flash Models) สำหรับสแกนรายชื่อผู้ล่าจากสกรีนช็อต
- **Fonts & Styling:** Cinzel (หัวข้อภาษาอังกฤษ), Prompt (ภาษาไทย), Monospace สำหรับตัวเลข CP/เพชร

---

## 3. โครงสร้างไฟล์และหน้าที่ (Project Structure & Map)

```
d:/Anti webapp/
├── .env                         # ตัวแปรระบบ: GEMINI_API_KEY, PORT=3000
├── firebase-applet-config.json  # ค่าคอนฟิกเชื่อมต่อ Firebase Firestore
├── server.ts                    # Express backend: เสิร์ฟ Vite, Discord Proxy, API endpoints /api/scan-hunters, /api/gemini-status
├── api/
│   ├── _entry.ts                # Serverless Lambda lifecycle wrapper
│   ├── _server.ts               # Express Router สำหรับ Serverless
│   ├── _firebaseAdmin.ts        # Lazy Dynamic Firebase Admin
│   └── index.js                 # Output bundle สำหรับ Vercel
├── PROJECT_HANDOVER.md          # คู่มือส่งมอบงานและข้อมูลอัปเดต v2.3.0 แบบสมบูรณ์
├── SYSTEM_MANUAL_v2.3.0.md      # คู่มือระบบและสถาปัตยกรรมฉบับสมบูรณ์ v2.3.0
├── SYSTEM_ARCHITECTURE.md       # แผนผังวิศวกรรมสถาปัตยกรรมระบบแม่บท
├── backups/
│   ├── complete_snapshot_v2.3.0.json # สแนปช็อตข้อมูลครบถ้วน v2.3.0
│   └── complete_snapshot_latest.json # สแนปช็อตล่าสุด
├── scripts/
│   ├── export_complete_v2.3.0_backup.mjs # สคริปต์ส่งออกข้อมูลสำรอง v2.3.0
│   └── backup-firestore-encrypted.mjs    # สำรอง Firestore เข้ารหัส
├── src/
│   ├── main.tsx                 # Entry point ของ React
│   ├── App.tsx                  # คอมโพเนนต์หลัก: จัดการ Global State, Fluid Layout, Tab Persistence, Modal triggers
│   ├── types.ts                 # Type definitions ทั้งหมด (User, VaultItem, DiscordSettings, DiscordMessageTemplate)
│   ├── translations.ts          # พจนานุกรมแปล 2 ภาษา (th, en) 100%
│   ├── services/
│   │   ├── firebase.ts          # Firestore operations, real-time listeners, shared settings sync
│   │   └── gemini.ts            # ฟังก์ชันเรียก Gemini AI สแกน OCR ผู้ล่า
│   ├── utils/
│   │   ├── sound.ts             # Web Audio API สร้างเสียงเอฟเฟกต์
│   │   ├── clipboard.ts         # Utility ช่วยดักจับ event Ctrl+V เพื่ออ่านรูปภาพจาก Clipboard
│   │   ├── diamondHelper.ts     # คำนวณยอดเพชรและ Net Change รายการธุรกรรม
│   │   ├── discord.ts           # ส่งแจ้งเตือน Webhook เข้า Discord พร้อม ANSI White Price, Templates, Multipart
│   │   └── defaultItemIcon.ts   # รูปไอคอนสำรองมาตรฐาน (Breka's Soul Base64)
│   └── components/
│       ├── LoginScreen.tsx      # หน้าล็อกอิน/สมัครสมาชิกแบบเต็มหน้า (v2.3.0)
│       ├── AuthModal.tsx        # หน้าต่าง Popup เข้าสู่ระบบ/สมัครสมาชิก (กรณีเปิดจากด้านใน)
│       ├── Navbar.tsx           # แถบเมนูด้านบน สลับภาษา และยอดเพชร (v2.3.0)
│       ├── Sidebar.tsx          # แถบเมนูซ้าย + เมนูมือถือหลักของระบบ (v2.3.0)
│       ├── GeminiKeyModal.tsx   # หน้าต่างตั้งค่า/ทดสอบ Gemini API Key (เฉพาะ Owner บันทึกลง Firestore ให้ทุกคนใช้)
│       ├── DashboardView.tsx    # หน้าแดชบอร์ด: ยอดเพชร, ไอเทมเปิดรับ 4 คอลัมน์ 2 บรรทัด, คิวไอเทม
│       ├── VaultView.tsx        # หน้าคลังไอเทมบอส: เพิ่มไอเทม, ควิกไอเทม, สแกน OCR, ตารางของแจกแล้ว
│       ├── EditVaultItemModal.tsx # หน้าต่างแก้ไขไอเทมเปิดรับ (ชื่อ, จำนวน, ราคา, รูป, ผู้ล่า)
│       ├── DistributeItemModal.tsx # หน้าต่างแจกจ่ายไอเทมให้สมาชิก (แนบรูปบิลได้หลายใบ)
│       ├── QueueView.tsx        # หน้าคิวไอเทม: สร้างคิว, จัดลำดับ, ติ๊กรับของ (รองรับ Ctrl+V)
│       ├── MembersView.tsx      # หน้าทำเนียบสมาชิก: จัดกลุ่มตามแคลน, กล่องอนุมัติสมาชิก, กล่องอนุมัติ CP
│       ├── ClanView.tsx         # หน้าจัดการแคลน: ลากย้ายสมาชิกข้ามแคลน, ลบแคลน, ลบสมาชิกแบบกลุ่ม
│       ├── RequestPowerLevelModal.tsx # หน้าต่างสมาชิกขออัปเดต CP (คำนวณส่วนต่าง +/- เรียลไทม์)
│       ├── QuickItemModal.tsx   # หน้าต่างจัดการแม่แบบไอเทมด่วน (รองรับ Ctrl+V)
│       ├── DiamondVaultModal.tsx# หน้าต่างฝาก-ถอนเพชรส่วนกลาง 1:1 และระบบรีเซ็ตยอดของ Owner
│       ├── DiscordBroadcastModal.tsx # หน้าต่างเลือกแม่แบบส่งประกาศ Discord พร้อม Live Preview สีขาว
│       ├── DiscordWebhookModal.tsx # ตั้งค่า Webhook URL, Role ID Mention และแม่แบบเริ่มต้น
│       ├── BackgroundSettingsModal.tsx # ปรับแต่งภาพพื้นหลังปราสาท ความเบลอ ความสว่าง
│       ├── ClassSettingsModal.tsx # จัดการรายชื่อสายอาชีพตามแพตช์เกม
│       ├── OwnerResetModal.tsx  # ศูนย์รีเซ็ตระบบสำหรับ Owner (ต้องพิมพ์ RESET)
│       └── ImageViewerModal.tsx # ดูรูปภาพขนาดเต็มแบบซูมได้
```

---

## 4. กฎทางธุรกิจและโฟลว์การทำงานสำคัญ (Core Business Logic)

### 4.1 ระบบสิทธิ์ผู้ใช้งาน (Roles & Permissions)
- **Owner (เจ้าของ):**
  - ใช้ Firebase Authentication บัญชี `eloni` มีสิทธิ์สูงสุด ควบคุมระบบทั้งหมด แต่งตั้ง Admin ได้ผู้เดียว, ตั้งค่า Gemini Key ได้ผู้เดียว (บันทึกแชร์ให้ Admin ใช้ได้), ตั้งค่า Discord Webhook ได้ผู้เดียว, และใช้ฟังก์ชันรีเซ็ตยอดเพชรและศูนย์รีเซ็ตระบบได้ผู้เดียว
- **Admin / Manager (ผู้ดูแล / ผู้จัดการ):** เพิ่ม/แก้ไขไอเทม, จัดการคิว, แจกของแนบบิล, ใช้งานระบบ AI OCR ได้เต็มรูปแบบจาก Shared Key, อนุมัติสมาชิกใหม่, อนุมัติสเตตัส, จัดการเพิ่ม/ถอนเพชร
- **Member (สมาชิกทั่วไป):** ดูคลัง, ลงชื่อเคลมไอเทม (เมื่อผ่านเกณฑ์สเตตัส), ขอปรับค่าพลังสเตตัสของตนเอง

### 4.2 ระบบการตั้งค่าส่วนกลางร่วมกันข้ามผู้ดูแล (Cross-Admin Shared Settings)
- **Discord Settings:** บันทึกลง `app_settings/discord` บน Firestore เมื่อแก้ไขจะไม่เคลียร์ Webhook URL ว่างเปล่า และแอดมินทุกคนจะเห็นการตั้งค่าเดียวกันทันที
- **Gemini OCR Key:** บันทึกลง `app_settings/gemini_ai` บน Firestore เมื่อ Owner กรอกคีย์แล้ว แอดมินทุกคนสามารถกดสแกน OCR สลิปปาร์ตี้บอสได้ทันที

### 4.3 กฎเหล็กเรื่องภาษา (Mandatory Bilingual Rule: TH & EN 100%)
- ทุกหน้าจอ ทุกปุ่ม ทุกกล่องข้อความ และทุกข้อความแจ้งเตือน (100%) ต้องรองรับ 2 ภาษาเสมอ (ไทย 'th' และ อังกฤษ 'en')
- ห้ามเขียน Hardcode ภาษาใดภาษาหนึ่งเด็ดขาด

---

## 5. คำสั่งการทำงานและทดสอบ (Commands)
- **รันเซิร์ฟเวอร์พัฒนา:** `& 'C:\Program Files\nodejs\node.exe' 'node_modules\tsx\dist\cli.mjs' server.ts` (เปิดที่ `http://localhost:3000`)
- **ตรวจสอบ Type TypeScript:** `& 'C:\Program Files\nodejs\node.exe' 'node_modules\typescript\bin\tsc' --noEmit`
- **Build สำหรับ Production:** `& 'C:\Program Files\nodejs\node.exe' 'node_modules\vite\bin\vite.js' build`
- **Build Serverless Endpoint:** `& 'C:\Program Files\nodejs\node.exe' 'node_modules\esbuild\bin\esbuild' api/_entry.ts --bundle --platform=node --format=esm --packages=external --outfile=api/index.js`
- **URL ระบบที่ Deploy สด:** [https://lineage2m-k7-item-vault.vercel.app/](https://lineage2m-k7-item-vault.vercel.app/)

---

## 6. ข้อความพร้อมใช้สำหรับเปิดแชทใหม่ (New Chat Prompt Template)
คัดลอกข้อความด้านล่างนี้ไปวางเมื่อเปิดห้องแชทใหม่ เพื่อให้ AI สานต่องานได้ทันที 100%:
```
โปรดอ่านไฟล์ SYSTEM_MANUAL_v2.3.0.md, AI_CONTEXT.md และ PROJECT_HANDOVER.md ในโปรเจกต์นี้ทั้งหมดก่อนเริ่มงาน
ระบบปัจจุบันคือ Lineage2M Clan Hub & Boss Item Vault (v2.3.0 — อัปเดตล่าสุด)
- บัญชี Owner: Eloni (สิทธิ์ Owner สูงสุด)
- Live Production: https://lineage2m-k7-item-vault.vercel.app/
- สถานะระบบล่าสุด (v2.3.0):
  1. Discord ฟอนต์ราคาไอเทมเป็นสีขาวเด่นชัด (ANSI \u001b[1;37m) ครบทั้ง 4 แม่แบบ (Price: FREE (0 Diamonds) สีขาว)
  2. บันทึก Discord Webhook และ Gemini OCR Key ถาวรข้ามแอดมินทุกคนผ่าน Firestore (app_settings/discord, app_settings/gemini_ai)
  3. แก้ไขข้อผิดพลาด Vercel Serverless FUNCTION_INVOCATION_FAILED สำเร็จ 100% (/api/health 200 OK)
  4. อัปเดตเวอร์ชัน v2.3.0 ครบทุกจุด (package.json, Navbar, Sidebar, LoginScreen)
  5. มีสแนปช็อตข้อมูลสำรองครบถ้วนที่ backups/complete_snapshot_v2.3.0.json (22 users, 23 vault items, 23,521 diamonds)
  6. แม่แบบข้อความ Discord 4 รูปแบบ (Radiant Neon, Siege & War, Guild Market, Crystal Minimal)
  7. ระบบ 2 ภาษา TH/EN 100% ทุกจุด
  8. Typecheck และ Vite Build ผ่าน 0 errors
โปรดยืนยันว่าเข้าใจสถาปัตยกรรมและกฎการป้องกันโค้ดเสียหายแล้ว พร้อมรับคำสั่งงานต่อไปครับ
```
