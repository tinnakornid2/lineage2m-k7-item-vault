# 🤖 AI_CONTEXT.md — สรุปบริบทและสถาปัตยกรรมระบบ Lineage2M Clan Hub
> **สำหรับ AI ในการทำความเข้าใจโปรเจกต์อย่างรวดเร็วและครบถ้วน 100% (เวอร์ชันปัจจุบัน: v2.0.0 — เวอร์ชั่นสมบูรณ์)**

เมื่อเปิดห้องแชทใหม่ ให้สั่ง AI อ่านไฟล์นี้ทันที เพื่อให้เข้าใจโครงสร้าง สถาปัตยกรรม โค้ด และกฎทางธุรกิจทั้งหมดโดยไม่ต้องอธิบายใหม่

---

## 1. ข้อมูลภาพรวมโปรเจกต์ (Project Overview)
- **ชื่อโปรเจกต์:** Lineage2M Clan Hub & Boss Item Vault System
- **วัตถุประสงค์:** เว็บแอปพลิเคชันสำหรับบริหารจัดการแคลน/กิลด์ในเกม Lineage 2M ประกอบด้วย:
  1. คลังไอเทมดรอปจากบอส (Boss Drop Item Vault) พร้อมระบบลงชื่อขอรับ (Claim), แจกจ่ายของ (Distribute), แก้ไขไอเทมเปิดรับ (Edit Item), และระบบจำชื่อไอเทมอัตโนมัติ (Autocomplete)
  2. ระบบแนบรูปบิล/ใบเสร็จได้หลายใบต่อ 1 ไอเทม สำหรับไอเทมที่แจกแล้ว พร้อมแกลเลอรีซูมและจัดการรูปบิล
  3. ระบบคิวไอเทม (Item Queue Management) จัดลำดับการรับของล่วงหน้า พร้อมระบบตรวจสอบสเตตัสก่อนเคลม
  4. ระบบสแกนรายชื่อผู้ล่าจากภาพสกรีนช็อตปาร์ตี้บอสด้วย AI (Google Gemini AI OCR) ปลดล็อกสิทธิ์เต็มรูปแบบให้ Admin ทุกคนและ Owner
  5. ระบบคลังเพชรกลาง/กองทุนแคลน (Clan Fund) ฝาก-ถอนแบบ 1:1 ตรงตามจริง พร้อมปุ่ม "รีเซ็ตยอด" (Reset Balance) เฉพาะ Owner
  6. ระบบจัดการแคลนและสมาชิก (Clan & Alliance Management) รองรับการลากย้ายแคลน (Drag & Drop และ Bulk Swap)
  7. ระบบแจ้งเตือนอัตโนมัติเข้า Discord ผ่าน Webhook
  8. รองรับการวางรูปภาพจากคลิปบอร์ดโดยตรง (**Ctrl + V / Copy-Paste**) ทุกจุดที่มีการอัปโหลดรูป
  9. รองรับ 2 ภาษา ทั้ง **ไทย (TH)** และ **อังกฤษ (EN)** 100% ครอบคลุมทุกจุด
  10. ธีม Dark Fantasy ปราสาท Lineage 2M พร้อมเสียงเอฟเฟกต์ Sound FX

---

## 2. เทคโนโลยีที่ใช้ (Tech Stack)
- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide React (Icons), Motion
- **Backend / Dev Server:** Node.js, Express 4 (`server.ts`), ESBuild, tsx
- **Database & Sync:** Google Firebase Cloud Firestore (`firebase.ts`) — Real-time snapshots (`onSnapshot`)
- **AI OCR:** Google GenAI SDK (`@google/genai` - Gemini Flash Models) สำหรับสแกนรายชื่อผู้ล่าจากสกรีนช็อต
- **Fonts & Styling:** Cinzel (หัวข้อภาษาอังกฤษ), Prompt (ภาษาไทย), Monospace สำหรับตัวเลข CP/เพชร

---

## 3. โครงสร้างไฟล์และหน้าที่ (Project Structure & Map)

```
d:/K7 item webapp/lineage2m-k7-item-vault (1)/
├── .env                         # ตัวแปรระบบ: GEMINI_API_KEY, PORT=3000
├── firebase-applet-config.json  # ค่าคอนฟิกเชื่อมต่อ Firebase Firestore
├── server.ts                    # Express backend: เสิร์ฟ Vite และ API endpoint /api/scan-hunters, /api/gemini-status
├── src/
│   ├── main.tsx                 # Entry point ของ React
│   ├── App.tsx                  # คอมโพเนนต์หลัก: จัดการ Global State, Real-time Listeners, Modal triggers
│   ├── types.ts                 # Type definitions ทั้งหมดของระบบ (User, VaultItem, QueueItem, Clan, ฯลฯ)
│   ├── translations.ts          # พจนานุกรมแปล 2 ภาษา (th, en) 100%
│   ├── services/
│   │   ├── firebase.ts          # Firestore operations, real-time listeners, sanitizeForFirestore
│   │   └── gemini.ts            # ฟังก์ชันเรียก Gemini AI สแกน OCR ผู้ล่า
│   ├── utils/
│   │   ├── sound.ts             # Web Audio API สร้างเสียงเอฟเฟกต์ (คลิก, เคลม, แจ้งเตือน, แตรแจกของ)
│   │   ├── clipboard.ts         # Utility ช่วยดักจับ event Ctrl+V เพื่ออ่านรูปภาพจาก Clipboard
│   │   ├── diamondHelper.ts     # คำนวณยอดเพชรและ Net Change รายการธุรกรรม
│   │   └── discord.ts           # ส่งแจ้งเตือน Webhook เข้า Discord
│   └── components/
│       ├── LoginScreen.tsx      # หน้าล็อกอิน/สมัครสมาชิกแบบเต็มหน้า (มีกรอกค่าพลังเริ่มต้น + พรีวิวตัวเลข)
│       ├── AuthModal.tsx        # หน้าต่าง Popup เข้าสู่ระบบ/สมัครสมาชิก (กรณีเปิดจากด้านใน)
│       ├── Navbar.tsx           # แถบเมนูด้านบน มีปุ่มสลับภาษาและวิดเจ็ตเพชรขาว
│       ├── Sidebar.tsx          # แถบเมนูซ้าย + เมนูมือถือหลักของระบบ
│       ├── GeminiKeyModal.tsx   # หน้าต่างตั้งค่า/ทดสอบ Gemini API Key (เฉพาะ Owner)
│       ├── DashboardView.tsx    # หน้าแดชบอร์ด: ยอดเพชร, ไอเทมเปิดเคลม, คิวไอเทม, วิดเจ็ตภาพรวม
│       ├── VaultView.tsx        # หน้าคลังไอเทมบอส: เพิ่มไอเทม, ควิกไอเทม, สแกน OCR, ตารางของแจกแล้ว
│       ├── EditVaultItemModal.tsx # หน้าต่างแก้ไขไอเทมเปิดรับ (ชื่อ, จำนวน, ราคา, รูป, ผู้ล่า)
│       ├── DistributeItemModal.tsx # หน้าต่างแจกจ่ายไอเทมให้สมาชิก (แนบรูปบิลได้หลายใบ)
│       ├── QueueView.tsx        # หน้าคิวไอเทม: สร้างคิว, จัดลำดับ, ติ๊กรับของ (รองรับ Ctrl+V)
│       ├── MembersView.tsx      # หน้าทำเนียบสมาชิก: จัดกลุ่มตามแคลน, กล่องอนุมัติสมาชิก, กล่องอนุมัติ CP
│       ├── ClanView.tsx         # หน้าจัดการแคลน: ลากย้ายสมาชิกข้ามแคลน, ลบแคลน, ลบสมาชิกแบบกลุ่ม
│       ├── RequestPowerLevelModal.tsx # หน้าต่างสมาชิกขออัปเดต CP (คำนวณส่วนต่าง +/- เรียลไทม์)
│       ├── QuickItemModal.tsx   # หน้าต่างจัดการแม่แบบไอเทมด่วน (รองรับ Ctrl+V)
│       ├── DiamondVaultModal.tsx# หน้าต่างฝาก-ถอนเพชรส่วนกลาง 1:1 และระบบรีเซ็ตยอดของ Owner
│       ├── DiscordWebhookModal.tsx # ตั้งค่า Webhook URL แจ้งเตือน Discord
│       ├── BackgroundSettingsModal.tsx # ปรับแต่งภาพพื้นหลังปราสาท ความเบลอ ความสว่าง
│       ├── ClassSettingsModal.tsx # จัดการรายชื่อสายอาชีพตามแพตช์เกม
│       ├── OwnerResetModal.tsx  # ศูนย์รีเซ็ตระบบสำหรับ Owner (ต้องพิมพ์ RESET)
│       └── ImageViewerModal.tsx # ดูรูปภาพขนาดเต็มแบบซูมได้
```

---

## 4. กฎทางธุรกิจและโฟลว์การทำงานสำคัญ (Core Business Logic)

### 4.1 ระบบสิทธิ์ผู้ใช้งาน (Roles & Permissions)
- **Owner (เจ้าของ):**
  - ใช้ Firebase Authentication และไม่มีรหัสผ่านฝังในโค้ดหรือเอกสาร
  - มีสิทธิ์สูงสุด ควบคุมระบบทั้งหมด แต่งตั้ง Admin ได้ผู้เดียว, ตั้งค่า Gemini Key ได้ผู้เดียว, และใช้ฟังก์ชันรีเซ็ตยอดเพชรและศูนย์รีเซ็ตระบบได้ผู้เดียว
- **Admin / Manager (ผู้ดูแล / ผู้จัดการ):** เพิ่ม/แก้ไขไอเทม, จัดการคิว, แจกของแนบบิล, ใช้งานระบบ AI OCR ได้เต็มรูปแบบ, อนุมัติสมาชิกใหม่, อนุมัติสเตตัส, จัดการเพิ่ม/ถอนเพชร
- **Member (สมาชิกทั่วไป):** ดูคลัง, ลงชื่อเคลมไอเทม (เมื่อผ่านเกณฑ์สเตตัส), ขอปรับค่าพลังสเตตัสของตนเอง

### 4.2 ระบบกองทุนเพชรแคลนและการคำนวณยอด (`diamondHelper.ts`)
- ยอดคงเหลือกองทุนเริ่มต้นจาก 0 เสมอ คำนวณจากประวัติการทำรายการจริงใน Firestore
- ไม่มีส่วนลดหย่อนภาษีตลาดในหน้าเพิ่ม/ถอนกองทุน เพิ่มถอนแบบ 1:1 ตรงไปตรงมา
- ปุ่ม "รีเซ็ตยอด" เฉพาะ Owner มี 2 โหมด: `wipe` ล้างประวัติเริ่ม 0 หรือ `adjust` บันทึกรายการปรับยอดอัตโนมัติ

### 4.3 ระบบสแกน AI OCR สำหรับแอดมินทุกคน
- แอดมินทุกคนมีสิทธิ์เข้าถึงและใช้งานระบบ AI OCR ในการสแกนสลิปผู้ล่า
- บนเครื่อง Localhost ระบบประมวลผลผ่าน Express Backend พร้อมโมเดลล่าสุด (`gemini-3.6-flash`, `gemini-flash-latest`)
- บนลิงก์ Deploy (Vercel) ระบบประมวลผลผ่าน Direct Client OCR อัตโนมัติ

### 4.4 กฎเหล็กเรื่องภาษา (Mandatory Bilingual Rule: TH & EN 100%)
- ทุกหน้าจอ ทุกปุ่ม ทุกกล่องข้อความ และทุกข้อความแจ้งเตือน (100%) ต้องรองรับ 2 ภาษาเสมอ (ไทย 'th' และ อังกฤษ 'en')
- ห้ามเขียน Hardcode ภาษาใดภาษาหนึ่งเด็ดขาด

---

## 5. คำสั่งการทำงานและทดสอบ (Commands)
- **รันเซิร์ฟเวอร์พัฒนา:** `npm run dev` (เปิดที่ `http://localhost:3000`)
- **ตรวจสอบ Type TypeScript:** `& 'C:\Users\tinna\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\typescript\bin\tsc' --noEmit`
- **Build สำหรับ Production:** `& 'C:\Users\tinna\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vite\bin\vite.js' build`
- **URL ระบบที่ Deploy สด:** [https://lineage2m-k7-item-vault.vercel.app/](https://lineage2m-k7-item-vault.vercel.app/)

---

## 6. ข้อความพร้อมใช้สำหรับเปิดแชทใหม่ (New Chat Prompt Template)
คัดลอกข้อความด้านล่างนี้ไปวางเมื่อเปิดห้องแชทใหม่ เพื่อให้ AI สานต่องานได้ทันที 100%:
```
โปรดอ่านไฟล์ SYSTEM_ARCHITECTURE.md, AI_CONTEXT.md และ PROJECT_HANDOVER.md ในโปรเจกต์นี้ทั้งหมดก่อนเริ่มงาน
ระบบปัจจุบันคือ Lineage2M Clan Hub & Boss Item Vault (v2.0.0 — เวอร์ชั่นสมบูรณ์)
- บัญชี Owner: Eloni (รหัสผ่านจัดการผ่าน Firebase Authentication)
- Live URL: https://lineage2m-k7-item-vault.vercel.app/
- สถานะล่าสุด (v2.0.0):
  1. ระบบแก้ไขไอเทมเปิดรับ (EditVaultItemModal) ครบทุกฟิลด์
  2. ระบบจดจำชื่อไอเทมที่เคยกรอก (Autocomplete & Memory)
  3. ระบบแนบรูปบิล/ใบเสร็จได้หลายใบต่อ 1 ไอเทม พร้อมแกลเลอรี
  4. กองทุนเพชรแคลนแบบ 1:1 เพิ่ม/ถอนตรงตามจริง ไม่หักภาษี
  5. รวมสูตรคำนวณยอดเพชรกลาง (diamondHelper.ts) ตรงกันทุกจุด
  6. ปุ่มรีเซ็ตยอดเพชรเฉพาะ Owner (Wipe & Adjust)
  7. ปลดล็อกระบบ Gemini AI OCR ให้แอดมินและผู้จัดการทุกคนใช้งานได้เต็มรูปแบบ
  8. รองรับ 2 ภาษา (TH/EN) 100% และปฏิบัติตาม Local-First Rule
โปรดยืนยันว่าเข้าใจสถาปัตยกรรมและกฎการป้องกันโค้ดเสียหายแล้ว พร้อมรับคำสั่งงานต่อไปครับ
```
