# 🤖 AI_CONTEXT.md — สรุปบริบทและสถาปัตยกรรมระบบ Lineage2M Clan Hub
> **สำหรับ AI ในการทำความเข้าใจโปรเจกต์อย่างรวดเร็วและครบถ้วน 100% (เวอร์ชันปัจจุบัน: v2.5.1 — อัปเดตล่าสุด)**

เมื่อเปิดห้องแชทใหม่ ให้สั่ง AI อ่านไฟล์นี้ทันที เพื่อให้เข้าใจโครงสร้าง สถาปัตยกรรม โค้ด และกฎทางธุรกิจทั้งหมดโดยไม่ต้องอธิบายใหม่

---

## 1. ข้อมูลภาพรวมโปรเจกต์ (Project Overview)
- **ชื่อโปรเจกต์:** Lineage2M Clan Hub & Boss Item Vault System
- **เวอร์ชันปัจจุบัน:** `v2.5.1-rule5-discord-hard-guard`
- **วัตถุประสงค์:** เว็บแอปพลิเคชันสำหรับบริหารจัดการแคลน/กิลด์ในเกม Lineage 2M ประกอบด้วย:
  1. **ระบบป้องกันข้อความสเตตัสหลุดเข้า Discord (Rule 5 Server Hard Guard - NEW v2.5.1):** ระบบกรองที่ Backend Proxy `/api/discord-webhook` ทำการ Drop คำขอแจ้งเตือนสเตตัส/พลังรบทุกรูปแบบทันที ไม่ส่งต่อไปยัง Discord 100% ป้องกันกรณี Client เก่าหรือแคชเบราว์เซอร์ส่งข้อความเข้ามา พร้อมเซ็ต Header No-Cache สำหรับหน้าเว็บ SPA
  2. **กฎมาตรฐานการแจ้งเตือน Discord Webhook (Rule 5: Discord Webhook Option 1 Only & English 100%):** แจ้งเตือนเฉพาะไอเทมเท่านั้น (`new_item`, `distribute`, `test`), ข้อความ Discord และ Live Preview เป็นภาษาอังกฤษ 100%, ตัด Embed Title สีขาวที่ซ้ำซ้อนออก, ตัดบรรทัดคนล่า (`⚔️ Hunters:`) ออกถาวร 100%, กรอบข้อความ ANSI 2 บรรทัดคมชัดกระชับ (ชื่อไอเทมมีสีตามระดับความหายาก + ราคาเพชรสีขาวสว่าง), และแสดงรูปไอเทมจริงที่มุมขวาบนเสมอ (ไม่ใช้ไอคอนตัวอย่างทับ)
  2. **ระบบเปลี่ยนรหัสผ่านตามลำดับสิทธิ์ (Role-Based Password Management):** ทุกคนเปลี่ยนของตนเองได้, Owner เปลี่ยนให้ทุกคนได้, Admin เปลี่ยนให้ตนเองและ Member/Leader ได้ พร้อม Modal ยืนยันรหัสผ่านปลอดภัย
  3. **ระบบจัดการและล้างการแจ้งเตือน (Notification Deletion & Auto-Cleanup):** ปุ่มลบรายข้อความ, ปุ่มล้างทั้งหมดจำค่าใน LocalStorage, และตัดการแจ้งเตือนเคลมของที่แจกไปแล้วอัตโนมัติ
  4. **ระบบติดตามสถานะชำระเงินของไอเทมแจกจ่าย (Payment Tracking & Confirmation):** สถานะ `รอชำระ` / `ชำระแล้ว` / `ฟรี`, ปุ่มยืนยันชำระในหน้า Vault (ของที่แจกแล้ว) และแสดงเฉพาะป้ายสถานะสะอาดตาในแดชบอร์ด
  5. **ปรับแต่งหน้าจอ My Stats (Thai Subtitles & Clean Input UX):** เพิ่มคำแปลภาษาไทยกำกับต่อท้ายชื่อสเตตัสในวงเล็บจางๆ พร้อมเคลียร์ค่า placeholder พื้นหลังออกทั้งหมด
  5. **คลังไอเทมดรอปจากบอส (Boss Drop Item Vault):** แสดงผล 4 คอลัมน์ต่อแถวบน Desktop, การ์ดไอเทมกระชับ 2 บรรทัดติดรูปภาพ, ลงชื่อขอรับ (Claim), แจกจ่ายของ (Distribute), แก้ไขไอเทมเปิดรับ (Edit Item), และระบบจำชื่อไอเทมอัตโนมัติ (Autocomplete)
  6. **ระบบแจ้งเตือน Discord 4 รูปแบบ พร้อมฟอนต์สีขาวสำหรับราคาเพชร:** Discord ANSI Glowing Colors (MYTHIC ทอง, LEGEND ม่วง, EPIC แดง, RARE ฟ้า, และราคาเพชรเป็นสีขาว `\u001b[1;37m` เช่น `Price: FREE (0 Diamonds)`), ส่งรูปภาพ Thumbnail อัตโนมัติแบบ Multipart
  7. **ระบบบันทึกการตั้งค่าข้ามแอดมิน (Shared Persistence):** Discord Webhook (`app_settings/discord`) และ Gemini AI OCR Key (`app_settings/gemini_ai`) ซิงค์ผ่าน Firestore เรียลไทม์ รีเฟรชไม่หาย แอดมินทุกคนใช้ร่วมกันได้ทันที
  8. **ระบบ Vercel Serverless ที่เสถียร 100%:** สถาปัตยกรรม Single Bundle `api/index.js` พร้อม Dynamic Import และ Promise Lifecycle
  9. **ระบบหน้าจอ Fluid Dynamic Auto-Scaling:** ปรับขนาดตามหน้าต่างเบราว์เซอร์อัตโนมัติ ไม่จำกัด max-width รองรับ Split-Screen, แล็ปท็อป และหน้าจอ Ultrawide
  10. **ระบบรักษาหน้าเดิมเมื่อรีเฟรช (Tab & Hash Persistence):** รองรับ URL Hash (`#vault`, `#queue`, `#distribution`, ฯลฯ) และ `localStorage` ทำให้กด F5 หรือ Back/Forward ไม่เด้งกลับหน้า Dashboard
  11. **ระบบแนบรูปบิล/ใบเสร็จได้หลายใบต่อ 1 ไอเทม:** สำหรับไอเทมที่แจกแล้ว พร้อมแกลเลอรีซูมและจัดการรูปบิล
  12. **ระบบคิวไอเทม (Item Queue Management):** จัดลำดับการรับของล่วงหน้า พร้อมระบบตรวจสอบสเตตัสก่อนเคลม
  13. **ระบบสแกนรายชื่อผู้ล่าจากภาพสกรีนช็อตปาร์ตี้บอสด้วย AI (Google Gemini AI OCR):** สแกนผ่าน Backend Proxy และ Direct Client
  14. **ระบบคลังเพชรกลาง/กองทุนแคลน (Clan Fund):** ฝาก-ถอนแบบ 1:1 ตรงตามจริง พร้อมปุ่ม "รีเซ็ตยอด" (Reset Balance) เฉพาะ Owner
  15. **ระบบจัดการแคลนและสมาชิก (Clan & Alliance Management):** รองรับการลากย้ายแคลน (Drag & Drop และ Bulk Swap)
  16. **รองรับการวางรูปภาพจากคลิปบอร์ดโดยตรง (Ctrl + V / Copy-Paste):** ทุกจุดที่มีการอัปโหลดรูป
  17. **รองรับ 2 ภาษา ทั้งไทย (TH) และ อังกฤษ (EN) 100%:** ครอบคลุมทุกจุด ไม่มี hardcode
  18. **ธีม Dark Fantasy ปราสาท Lineage 2M พร้อมเสียงเอฟเฟกต์ Sound FX**

---

## 2. เทคโนโลยีที่ใช้ (Tech Stack)
- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide React (Icons), Motion
- **Backend / Dev Server:** Node.js, Express 4 (`server.ts`), ESBuild, tsx
- **Serverless Production:** Vercel Serverless Function (`api/index.js` bundled from `api/_entry.ts`)
- **Database & Sync:** Google Firebase Cloud Firestore (`firebase.ts`) — Real-time snapshots (`onSnapshot`)
- **Admin Authentication:** Firebase Admin SDK (`api/_firebaseAdmin.ts`) จัดการรหัสผ่านผู้ใช้
- **AI OCR:** Google GenAI SDK (`@google/genai` - Gemini Flash Models) สำหรับสแกนรายชื่อผู้ล่าจากสกรีนช็อต
- **Fonts & Styling:** Cinzel (หัวข้อภาษาอังกฤษ), Prompt (ภาษาไทย), Monospace สำหรับตัวเลข CP/เพชร

---

## 3. โครงสร้างไฟล์และหน้าที่ (Project Structure & Map)

```
d:/Anti webapp/
├── .env                         # ตัวแปรระบบ: GEMINI_API_KEY, PORT=3000
├── firebase-applet-config.json  # ค่าคอนฟิกเชื่อมต่อ Firebase Firestore
├── server.ts                    # Express backend: เสิร์ฟ Vite, Discord Proxy, API endpoints /api/scan-hunters, /api/gemini-status, /api/users/:userId/change-password
├── api/
│   ├── _entry.ts                # Serverless Lambda lifecycle wrapper
│   ├── _server.ts               # Express Router สำหรับ Serverless พร้อม endpoint เปลี่ยนรหัสผ่าน
│   ├── _firebaseAdmin.ts        # Lazy Dynamic Firebase Admin สำหรับจัดการรหัสผ่าน
│   └── index.js                 # Output bundle สำหรับ Vercel
├── PROJECT_HANDOVER.md          # คู่มือส่งมอบงานและข้อมูลอัปเดต v2.5.0 แบบสมบูรณ์
├── SYSTEM_MANUAL_v2.5.0.md      # คู่มือระบบและสถาปัตยกรรมฉบับสมบูรณ์ v2.5.0
├── SYSTEM_MANUAL_v2.4.0.md      # คู่มือระบบเวอร์ชันเดิม v2.4.0
├── SYSTEM_ARCHITECTURE.md       # แผนผังวิศวกรรมสถาปัตยกรรมระบบแม่บท
├── backups/
│   ├── complete_snapshot_v2.5.0.json # สแนปช็อตข้อมูลครบถ้วน v2.5.0
│   └── complete_snapshot_latest.json # สแนปช็อตล่าสุด
├── scripts/
│   ├── export_complete_v2.5.0_backup.mjs # สคริปต์ส่งออกข้อมูลสำรอง v2.5.0
│   └── backup-firestore-encrypted.mjs    # สำรอง Firestore เข้ารหัส
├── src/
│   ├── main.tsx                 # Entry point ของ React
│   ├── App.tsx                  # คอมโพเนนต์หลัก: จัดการ Global State, Fluid Layout, Tab Persistence, Modal triggers, Auto Notification Cleanup
│   ├── types.ts                 # Type definitions ทั้งหมด (User, VaultItem, DistributedInfo with paymentStatus, DiscordSettings)
│   ├── translations.ts          # พจนานุกรมแปล 2 ภาษา (th, en) 100% ครอบคลุมปุ่มลบแจ้งเตือน เปลี่ยนรหัส ยืนยันชำระเงิน
│   ├── services/
│   │   ├── firebase.ts          # Firestore operations, real-time listeners, shared settings sync, changeUserPassword, confirmVaultItemPayment
│   │   └── gemini.ts            # ฟังก์ชันเรียก Gemini AI สแกน OCR ผู้ล่า
│   ├── utils/
│   │   ├── sound.ts             # Web Audio API สร้างเสียงเอฟเฟกต์
│   │   ├── clipboard.ts         # Utility ช่วยดักจับ event Ctrl+V เพื่ออ่านรูปภาพจาก Clipboard
│   │   ├── diamondHelper.ts     # คำนวณยอดเพชรและ Net Change รายการธุรกรรม
│   │   ├── discord.ts           # ส่งแจ้งเตือน Webhook เข้า Discord พร้อม ANSI White Price, Templates, Multipart
│   │   └── defaultItemIcon.ts   # รูปไอคอนสำรองมาตรฐาน (Breka's Soul Base64)
│   └── components/
│       ├── LoginScreen.tsx      # หน้าล็อกอิน/สมัครสมาชิกแบบเต็มหน้า (v2.4.0)
│       ├── AuthModal.tsx        # หน้าต่าง Popup เข้าสู่ระบบ/สมัครสมาชิก (กรณีเปิดจากด้านใน)
│       ├── ChangePasswordModal.tsx # หน้าต่างเปลี่ยนรหัสผ่านตามลำดับสิทธิ์ (NEW v2.4.0)
│       ├── NotificationModal.tsx# หน้าต่างการแจ้งเตือน พร้อมปุ่มลบรายข้อความและปุ่มล้างทั้งหมด (UPDATED v2.4.0)
│       ├── Navbar.tsx           # แถบเมนูด้านบน สลับภาษา และยอดเพชร (v2.4.0)
│       ├── Sidebar.tsx          # แถบเมนูซ้าย + เมนูมือถือหลักของระบบ + ปุ่มเปลี่ยนรหัสผ่าน (v2.4.0)
│       ├── GeminiKeyModal.tsx   # หน้าต่างตั้งค่า/ทดสอบ Gemini API Key (เฉพาะ Owner บันทึกลง Firestore ให้ทุกคนใช้)
│       ├── DashboardView.tsx    # หน้าแดชบอร์ด: ยอดเพชร, ไอเทมเปิดรับ 4 คอลัมน์ 2 บรรทัด, ป้ายสถานะชำระเงินใน Box 3 (UPDATED v2.4.0)
│       ├── VaultView.tsx        # หน้าคลังไอเทมบอส: เพิ่มไอเทม, ควิกไอเทม, สแกน OCR, ป้ายและปุ่มยืนยันชำระเงิน (UPDATED v2.4.0)
│       ├── EditVaultItemModal.tsx # หน้าต่างแก้ไขไอเทมเปิดรับ (ชื่อ, จำนวน, ราคา, รูป, ผู้ล่า)
│       ├── DistributeItemModal.tsx # หน้าต่างแจกจ่ายไอเทมให้สมาชิก (แนบรูปบิลได้หลายใบ, กำหนดสถานะชำระเริ่มต้น)
│       ├── QueueView.tsx        # หน้าคิวไอเทม: สร้างคิว, จัดลำดับ, ติ๊กรับของ (รองรับ Ctrl+V)
│       ├── MembersView.tsx      # หน้าทำเนียบสมาชิก: จัดกลุ่มตามแคลน, ปุ่มเปลี่ยนรหัสผ่านตามสิทธิ์ (UPDATED v2.4.0)
│       ├── MyStatsView.tsx      # หน้าสเตตัสผู้ใช้: ชื่อสเตตัสมีวงเล็บไทยจางๆ, เคลียร์ placeholder, ปุ่มเปลี่ยนรหัส (UPDATED v2.4.0)
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
  - ใช้ Firebase Authentication บัญชี `eloni` มีสิทธิ์สูงสุด ควบคุมระบบทั้งหมด แต่งตั้ง Admin ได้ผู้เดียว, เปลี่ยนรหัสผ่านให้สมาชิกทุกคนได้, ตั้งค่า Gemini Key ได้ผู้เดียว (บันทึกแชร์ให้ Admin ใช้ได้), ตั้งค่า Discord Webhook ได้ผู้เดียว, และใช้ฟังก์ชันรีเซ็ตยอดเพชรและศูนย์รีเซ็ตระบบได้ผู้เดียว
- **Admin (ผู้ดูแลระบบ):**
  - เปลี่ยนรหัสผ่านของตนเอง และของสมาชิกทั่วไป (`Member`, `Party Leader`) ได้ (ห้ามแตะ Owner และ Admin คนอื่น)
  - เพิ่ม/แก้ไขไอเทม, จัดการคิว, แจกของแนบบิล, กดยืนยันชำระเงินของไอเทมแจกจ่าย, ใช้งาน AI OCR, อนุมัติสมาชิกใหม่, อนุมัติสเตตัส, จัดการเพิ่ม/ถอนเพชร
- **Member (สมาชิกทั่วไป):**
  - เปลี่ยนรหัสผ่านของตนเองได้, ดูคลัง, ลงชื่อเคลมไอเทม (เมื่อผ่านเกณฑ์สเตตัส), ขอปรับค่าพลังสเตตัสของตนเอง, ลบการแจ้งเตือนของตนเองได้

### 4.2 กฎเหล็กเรื่องภาษา (Mandatory Bilingual Rule: TH & EN 100%)
- ทุกหน้าจอ ทุกปุ่ม ทุกกล่องข้อความ และทุกข้อความแจ้งเตือน (100%) ต้องรองรับ 2 ภาษาเสมอ (ไทย 'th' และ อังกฤษ 'en')
- ห้ามเขียน Hardcode ภาษาใดภาษาหนึ่งเด็ดขาด

### 4.3 กฎมาตรฐานการแจ้งเตือน Discord (Rule 5: Discord Webhook Option 1 Only & English 100%)
- **แจ้งเตือนเฉพาะไอเทมเท่านั้น (Item-Only Scope):** แจ้งเตือนเฉพาะ `new_item` และ `distribute` เท่านั้น ห้ามส่งการแจ้งเตือนสำหรับสเตตัส (`stat_request`, `stat_approval`) เด็ดขาด
- **ข้อความ Discord ต้องเป็นภาษาอังกฤษ 100% (Mandatory English 100% for Discord):** ข้อความทั้งหมดที่ส่งเข้าห้อง Discord (Headers, Titles, ANSI Code Blocks, Fields, Footers, Links) **ต้องเป็นภาษาอังกฤษ 100% เสมอ** (ห้ามส่งข้อความภาษาไทยเข้าช่อง Discord)
- **บังคับใช้แบบที่ 1 เท่านั้น (Option 1 Standard):**
  - **ห้ามใส่ Title ซ้ำซ้อน:** ไม่ใส่ฟิลด์ `title` ซ้ำใน Embed เพราะในกรอบ ANSI บรรทัดแรกมีชื่อไอเทมพร้อมสีประจำระดับอยู่แล้ว
  - **ตัดบรรทัดคนล่าออกถาวร (Completely Remove Hunters Line):** ไม่ต้องแสดงรายชื่อคนล่าใน Discord ตัดออก 100% เพื่อความสั้นกระชับที่สุด
  - ข้อความไอเทมใหม่เป็นกรอบ ANSI สั้นกระชับเพียง 2 บรรทัด (บรรทัด 1: ชื่อไอเทมสีตามระดับ, บรรทัด 2: Price Diamonds/Free สีขาวสว่าง) พร้อมลิงก์เปิดคลังเคลมไอเทม และแสดงรูปไอเทมจริงที่มุมขวาบนเสมอ (ห้ามนำรูปไอคอนตัวอย่างมาทับ)

---

## 5. คำสั่งการทำงานและทดสอบ (Commands)
- **รันเซิร์ฟเวอร์พัฒนา:** `& 'C:\Program Files\nodejs\node.exe' 'node_modules\tsx\dist\cli.mjs' server.ts` (เปิดที่ `http://localhost:3000`)
- **ตรวจสอบ Type TypeScript:** `& 'C:\Program Files\nodejs\node.exe' 'node_modules\typescript\bin\tsc' --noEmit`
- **Build สำหรับ Production:** `& 'C:\Program Files\nodejs\node.exe' 'node_modules\vite\bin\vite.js' build`
- **Build Serverless Endpoint:** `& 'C:\Program Files\nodejs\node.exe' 'node_modules\esbuild\bin\esbuild' api/_entry.ts --bundle --platform=node --format=esm --packages=external --outfile=api/index.js`
- **Build Local Server:** `& 'C:\Program Files\nodejs\node.exe' 'node_modules\esbuild\bin\esbuild' server.ts --bundle --platform=node --format=esm --packages=external --sourcemap --outfile=dist/server.js`
- **ส่งออกข้อมูลสำรอง v2.5.0:** `& 'C:\Program Files\nodejs\node.exe' 'scripts\export_complete_v2.5.0_backup.mjs'`
- **URL ระบบที่ Deploy สด:** [https://lineage2m-k7-item-vault.vercel.app/](https://lineage2m-k7-item-vault.vercel.app/)

---

## 6. ข้อความพร้อมใช้สำหรับเปิดแชทใหม่ (New Chat Prompt Template)
คัดลอกข้อความด้านล่างนี้ไปวางเมื่อเปิดห้องแชทใหม่ เพื่อให้ AI สานต่องานได้ทันที 100%:
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
