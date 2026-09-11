# 🤖 AI_CONTEXT.md — สรุปบริบทและสถาปัตยกรรมระบบ Lineage2M Clan Hub
> **สำหรับ AI ในการทำความเข้าใจโปรเจกต์อย่างรวดเร็วและครบถ้วน 100% (เวอร์ชันปัจจุบัน: v1.3.0)**

เมื่อเปิดห้องแชทใหม่ ให้สั่ง AI อ่านไฟล์นี้ทันที เพื่อให้เข้าใจโครงสร้าง สถาปัตยกรรม โค้ด และกฎทางธุรกิจทั้งหมดโดยไม่ต้องอธิบายใหม่

---

## 1. ข้อมูลภาพรวมโปรเจกต์ (Project Overview)
- **ชื่อโปรเจกต์:** Lineage2M Clan Hub & Boss Item Vault System
- **วัตถุประสงค์:** เว็บแอปพลิเคชันสำหรับบริหารจัดการแคลน/กิลด์ในเกม Lineage 2M ประกอบด้วย:
  1. คลังไอเทมดรอปจากบอส (Boss Drop Item Vault) พร้อมระบบลงชื่อขอรับ (Claim) และแจกจ่ายของ (Distribute)
  2. ระบบคิวไอเทม (Item Queue Management) จัดลำดับการรับของล่วงหน้า (Admin/Owner จัดการ)
  3. ระบบสแกนรายชื่อผู้ล่าจากภาพสกรีนช็อตปาร์ตี้บอสด้วย AI (Google Gemini 2.5 Flash OCR)
  4. ระบบคลังเพชรกลาง (Diamond Vault) บันทึกประวัติฝาก-ถอนเพชร
  5. ระบบจัดการแคลนและสมาชิก (Clan & Alliance Management) รองรับการลากย้ายแคลน (Drag & Drop)
  6. ระบบแจ้งเตือนอัตโนมัติเข้า Discord ผ่าน Webhook
  7. ระบบกำหนดค่าพลังตอนสมัคร และระบบขออนุมัติเมื่อมีการอัปเดตค่าพลัง (CP Approval Workflow)
  8. รองรับการวางรูปภาพจากคลิปบอร์ดโดยตรง (**Ctrl + V / Copy-Paste**) ทุกจุดที่มีการอัปโหลดรูป
  9. รองรับ 2 ภาษา ทั้ง **ไทย (TH)** และ **อังกฤษ (EN)**
  10. ธีม Dark Fantasy ปราสาท Lineage 2M พร้อมเสียงเอฟเฟกต์ Sound FX

---

## 2. เทคโนโลยีที่ใช้ (Tech Stack)
- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide React (Icons), Motion
- **Backend / Dev Server:** Node.js, Express 4 (`server.ts`), ESBuild, tsx
- **Database & Sync:** Google Firebase Cloud Firestore (`firebase.ts`) — Real-time snapshots (`onSnapshot`)
- **AI OCR:** Google GenAI SDK (`@google/genai` - Gemini 2.5 Flash) สำหรับสแกนรายชื่อผู้ล่าจากสกรีนช็อต
- **Fonts & Styling:** Cinzel (หัวข้อภาษาอังกฤษ), Prompt (ภาษาไทย), Monospace สำหรับตัวเลข CP/เพชร

---

## 3. โครงสร้างไฟล์และหน้าที่ (Project Structure & Map)

```
d:/K7 item webapp/lineage2m-k7-item-vault (1)/
├── .env                         # ตัวแปรระบบ: GEMINI_API_KEY, PORT=3000
├── firebase-applet-config.json  # ค่าคอนฟิกเชื่อมต่อ Firebase Firestore
├── server.ts                    # Express backend: เสิร์ฟ Vite และ API endpoint /api/gemini/ocr
├── src/
│   ├── main.tsx                 # Entry point ของ React
│   ├── App.tsx                  # คอมโพเนนต์หลัก: จัดการ Global State, Real-time Listeners, Modal triggers
│   ├── types.ts                 # Type definitions ทั้งหมดของระบบ (User, VaultItem, QueueItem, Clan, ฯลฯ)
│   ├── translations.ts          # พจนานุกรมแปล 2 ภาษา (th, en)
│   ├── services/
│   │   ├── firebase.ts          # Firestore operations, real-time listeners, sanitizeForFirestore
│   │   └── gemini.ts            # ฟังก์ชันเรียก Gemini AI สแกน OCR ผู้ล่า
│   ├── utils/
│   │   ├── sound.ts             # Web Audio API สร้างเสียงเอฟเฟกต์ (คลิก, เคลม, แจ้งเตือน, แตรแจกของ)
│   │   └── clipboard.ts         # Utility ช่วยดักจับ event Ctrl+V เพื่ออ่านรูปภาพจาก Clipboard
│   └── components/
│       ├── LoginScreen.tsx      # หน้าล็อกอิน/สมัครสมาชิกแบบเต็มหน้า (มีกรอกค่าพลังเริ่มต้น + พรีวิวตัวเลข)
│       ├── AuthModal.tsx        # หน้าต่าง Popup เข้าสู่ระบบ/สมัครสมาชิก (กรณีเปิดจากด้านใน)
│       ├── Navbar.tsx           # แถบเมนูด้านบน (สำหรับจอใหญ่/ทางเลือก) มีปุ่มขออัปเดต CP
│       ├── Sidebar.tsx          # แถบเมนูซ้าย + เมนูมือถือหลักของระบบ (มีปุ่มขออัปเดต CP และปุ่มตั้งค่า Gemini Key)
│       ├── GeminiKeyModal.tsx   # หน้าต่างตั้งค่า/ทดสอบ Gemini API Key (พร้อมลิงก์ Google AI Studio ฟรี)
│       ├── DashboardView.tsx    # หน้าแดชบอร์ด: ยอดเพชร, ไอเทมเปิดเคลม, คิวไอเทม, ไทม์ไลน์เพชร
│       ├── VaultView.tsx        # หน้าคลังไอเทมบอส: เพิ่มไอเทม, ควิกไอเทม, สแกน OCR (รองรับ Ctrl+V + สแกนจากรูปที่แนบ)
│       ├── QueueView.tsx        # หน้าคิวไอเทม: สร้างคิว, จัดลำดับ, ติ๊กรับของ (รองรับ Ctrl+V)
│       ├── MembersView.tsx      # หน้าทำเนียบสมาชิก: จัดกลุ่มตามแคลน, กล่องอนุมัติสมาชิก, กล่องอนุมัติ CP
│       ├── ClanView.tsx         # หน้าจัดการแคลน: ลากย้ายสมาชิกข้ามแคลน, ลบแคลน, ลบสมาชิกแบบกลุ่ม
│       ├── RequestPowerLevelModal.tsx # หน้าต่างสมาชิกขออัปเดต CP (คำนวณส่วนต่าง +/- เรียลไทม์)
│       ├── DistributeItemModal.tsx    # หน้าต่างแจกจ่ายไอเทมให้สมาชิก (ตัดของ + ส่ง Discord)
│       ├── QuickItemModal.tsx   # หน้าต่างจัดการแม่แบบไอเทมด่วน (รองรับ Ctrl+V)
│       ├── DiamondVaultModal.tsx# หน้าต่างฝาก-ถอนเพชรส่วนกลาง
│       ├── DiscordWebhookModal.tsx    # ตั้งค่า Webhook URL แจ้งเตือน Discord
│       ├── BackgroundSettingsModal.tsx# ปรับแต่งภาพพื้นหลังปราสาท ความเบลอ ความสว่าง
│       ├── ClassSettingsModal.tsx     # จัดการรายชื่อสายอาชีพตามแพตช์เกม
│       ├── OwnerResetModal.tsx  # ศูนย์รีเซ็ตระบบสำหรับ Owner (ต้องพิมพ์ RESET)
│       └── ImageViewerModal.tsx # ดูรูปภาพขนาดเต็มแบบซูมได้
```

---

## 4. กฎทางธุรกิจและโฟลว์การทำงานสำคัญ (Core Business Logic)

### 4.1 ระบบสิทธิ์ผู้ใช้งาน (Roles & Permissions)
- **Owner (เจ้าของ):**
  - มีบัญชี Hardcoded พิเศษ: Username: `eloni` / Password: `0386231334`
  - มีสิทธิ์สูงสุด ควบคุมระบบทั้งหมด แต่งตั้ง Admin ได้ผู้เดียว และใช้ Owner Reset Center ได้ผู้เดียว
- **Admin (ผู้ดูแล):** เพิ่มไอเทม, จัดการคิว, แจกของ, อนุมัติสมาชิกใหม่, อนุมัติการปรับ CP, จัดการเพชร
- **Manager (ผู้จัดการแคลน):** ช่วยดูแลสมาชิกและคิวไอเทม
- **Member (สมาชิกทั่วไป):** ดูคลัง, ลงชื่อเคลมไอเทม, ขอปรับค่าพลัง CP ของตนเอง

### 4.2 ระบบค่าพลัง (Power Level / CP)
- **ตอนสมัคร (Registration):**
  - ฟอร์มสมัครใน `LoginScreen.tsx` และ `AuthModal.tsx` มีช่องกรอก `powerLevel`
  - มีตัวแสดงผลพรีวิวแบบเรียลไทม์ (พิมพ์ `540000` ➔ ขึ้นป้าย `⚡ 540,000 CP`)
  - บันทึกลง Firestore พร้อมสถานะ `pending_approval`
- **การขออัปเดตค่าพลัง (CP Update Request):**
  - สมาชิกกดปุ่ม **[⚡ ขออัปเดต CP]** ในแถบโปรไฟล์ (Sidebar/Navbar) หรือในตารางสมาชิก
  - เปิด `RequestPowerLevelModal.tsx` แสดงค่าพลังปัจจุบัน และช่องกรอกค่าพลังใหม่ พร้อมส่วนต่าง (`+40,000 CP`)
  - เมื่อกดยืนยัน จะบันทึกฟิลด์ `pendingPowerLevel` และ `pendingPowerLevelRequestedAt` ลงใน User document (ค่าพลังจริง `powerLevel` ยังไม่เปลี่ยน)
  - โปรไฟล์ของผู้ใช้จะขึ้นป้าย `⏳ รออนุมัติ: xxx,xxx CP`
- **การอนุมัติ (Approval by Admin/Owner):**
  - ใน `MembersView.tsx` มีกล่อง **"คำขออัปเดตค่าพลังรออนุมัติ (Pending CP Update Requests)"**
  - แสดงการเปรียบเทียบเดิม ➔ ใหม่ พร้อมปุ่ม **[✓ อนุมัติ CP]** (ปรับ `powerLevel` เป็นค่าใหม่และล้าง `pendingPowerLevel: null`) และ **[✕ ปฏิเสธ]** (ล้าง `pendingPowerLevel: null`)
  - *หาก Admin/Owner เข้าไปกดแก้ไขโปรไฟล์สมาชิกโดยตรง จะปรับค่าพลังทันทีโดยไม่ต้องรออนุมัติ*

### 4.3 ระบบ Copy-Paste (Ctrl + V) อัปโหลดรูป
- ทุกจุดในเว็บที่รับรูปภาพ รองรับการกด **Ctrl + V** เพื่อวางรูปจากคลิปบอร์ดทันที:
  1. รูปไอเทมในคลังบอส (`VaultView.tsx`)
  2. รูปสกรีนช็อตปาร์ตี้บอส / OCR Scanner (`VaultView.tsx`)
  3. รูปคิวไอเทม (`QueueView.tsx`)
  4. รูปควิกไอเทมแม่แบบด่วน (`QuickItemModal.tsx`)

### 4.5 กฎเหล็กเรื่องภาษา (Mandatory Bilingual Rule: TH & EN)
- **ทุกหน้าจอ ทุกปุ่ม และทุกข้อความแจ้งเตือน (100%) ต้องรองรับ 2 ภาษาเสมอ (ไทย 'th' และ อังกฤษ 'en'):**
  - ห้ามเขียน Hardcode ภาษาไทยหรืออังกฤษโดดๆ โดยเด็ดขาด
  - ต้องผูกผ่าน `t.keyName` จาก `src/translations.ts` หรือเงื่อนไข `lang === 'th' ? '...' : '...'`
  - เมื่อเพิ่มฟีเจอร์หรือข้อความใหม่ ต้องเพิ่มคู่คำแปลลงใน `src/translations.ts` ทั้งฝั่ง `th` และ `en` พร้อมกันเสมอ
  - ดูรายละเอียดเพิ่มเติมในกฎ `.agents/rules/i18n-bilingual.md`

### 4.6 กฎระบบ AI OCR และสิทธิ์ Owner (Gemini AI Key & Owner-Only Rules)
- **ปุ่ม Gemini AI จำกัดเฉพาะ Owner:**
  - ปุ่มตั้งค่า Gemini AI OCR ใน `VaultView.tsx`, `Sidebar.tsx` และ `GeminiKeyModal.tsx` **จำกัดให้มองเห็นและใช้งานได้เฉพาะผู้ใช้ที่มีสถานะ Owner เท่านั้น** (`currentUser?.role === 'owner'` หรือ `isOwner === true`)
  - สมาชิกทั่วไปและแอดมินจะไม่เห็นปุ่มหรือสิทธิ์ในการเข้าถึงการจัดการ API Key
- **ระบบสแกนผู้ล่าและการคัดลอก (Scan Results & Copyable Text):**
  - ส่วนแสดงผลการสแกน (หัวข้อ 7 ใน `VaultView.tsx`) รองรับทั้งมุมมองแบบ **การ์ดตามแคลน (Cards View)** และแบบ **ข้อความสำหรับคัดลอก (Text View)**
  - มีปุ่ม **[📋 คัดลอกรายชื่อทั้งหมด]** ทั้งแบบชื่อล้วน, แบบพร้อมชื่อแคลน, และแบบคั่นด้วยจุลภาค (Comma-separated)
- **ระบบเลือกคนล่าแบบ Checklist (Interactive Member Checklist):**
  - แสดงรายชื่อสมาชิกทั้งหมดพร้อมช่องติ๊กถูก (`[x]`)
  - มีช่องค้นหาชื่อสมาชิกและแท็บกรองตามแคลน
  - มีปุ่ม **[เลือกทั้งหมด (Select All)]** และ **[ล้างที่เลือก (Deselect All)]** ให้ติ๊กหลายคนพร้อมกันได้อย่างรวดเร็ว

---

## 5. คำสั่งการทำงานและทดสอบ (Commands)
- **รันเซิร์ฟเวอร์พัฒนา:** `npm run dev` (เปิดที่ `http://localhost:3000`)
- **ตรวจสอบ Type TypeScript:** `npx tsc --noEmit`
- **Build สำหรับ Production:** `npm run build`
- **สร้างเอกสารคู่มือ PDF:** `node build_manuals.cjs`
- *หมายเหตุสำหรับ Windows PowerShell:* ห้ามใช้ `&&` ในการต่อคำสั่ง ให้ใช้เครื่องหมายเซมิโคลอน `;` แทน เช่น `npm run build; npx tsc --noEmit`
