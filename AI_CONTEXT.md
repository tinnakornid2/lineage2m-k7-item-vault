# 🤖 AI_CONTEXT.md — สรุปบริบทและสถาปัตยกรรมระบบ Lineage2M Clan Hub
> **สำหรับ AI ในการทำความเข้าใจโปรเจกต์อย่างรวดเร็วและครบถ้วน 100% (เวอร์ชันปัจจุบัน: v2.2.0 — อัปเดตล่าสุด)**

เมื่อเปิดห้องแชทใหม่ ให้สั่ง AI อ่านไฟล์นี้ทันที เพื่อให้เข้าใจโครงสร้าง สถาปัตยกรรม โค้ด และกฎทางธุรกิจทั้งหมดโดยไม่ต้องอธิบายใหม่

---

## 1. ข้อมูลภาพรวมโปรเจกต์ (Project Overview)
- **ชื่อโปรเจกต์:** Lineage2M Clan Hub & Boss Item Vault System
- **วัตถุประสงค์:** เว็บแอปพลิเคชันสำหรับบริหารจัดการแคลน/กิลด์ในเกม Lineage 2M ประกอบด้วย:
  1. **คลังไอเทมดรอปจากบอส (Boss Drop Item Vault):** แสดงผล 4 คอลัมน์ต่อแถวบน Desktop, การ์ดไอเทมกระชับ 2 บรรทัดติดรูปภาพ, ลงชื่อขอรับ (Claim), แจกจ่ายของ (Distribute), แก้ไขไอเทมเปิดรับ (Edit Item), และระบบจำชื่อไอเทมอัตโนมัติ (Autocomplete)
  2. **ระบบหน้าจอ Fluid Dynamic Auto-Scaling:** ปรับขนาดตามหน้าต่างเบราว์เซอร์อัตโนมัติ ไม่จำกัด max-width รองรับ Split-Screen, แล็ปท็อป และหน้าจอ Ultrawide
  3. **ระบบรักษาหน้าเดิมเมื่อรีเฟรช (Tab & Hash Persistence):** รองรับ URL Hash (`#vault`, `#queue`, `#distribution`, ฯลฯ) และ `localStorage` ทำให้กด F5 หรือ Back/Forward ไม่เด้งกลับหน้า Dashboard
  4. **ระบบแนบรูปบิล/ใบเสร็จได้หลายใบต่อ 1 ไอเทม:** สำหรับไอเทมที่แจกแล้ว พร้อมแกลเลอรีซูมและจัดการรูปบิล
  5. **ระบบคิวไอเทม (Item Queue Management):** จัดลำดับการรับของล่วงหน้า พร้อมระบบตรวจสอบสเตตัสก่อนเคลม
  6. **ระบบสแกนรายชื่อผู้ล่าจากภาพสกรีนช็อตปาร์ตี้บอสด้วย AI (Google Gemini AI OCR):** ปลดล็อกสิทธิ์เต็มรูปแบบให้ Admin ทุกคนและ Owner
  7. **ระบบคลังเพชรกลาง/กองทุนแคลน (Clan Fund):** ฝาก-ถอนแบบ 1:1 ตรงตามจริง พร้อมปุ่ม "รีเซ็ตยอด" (Reset Balance) เฉพาะ Owner
  8. **ระบบแจ้งเตือนอัตโนมัติเข้า Discord ผ่าน Webhook:** ส่งแจ้งเตือนไอเทมใหม่อัตโนมัติ พร้อมตั้งค่า Mention Role ID, @everyone, หรือ None ได้ตามต้องการ
  9. **ระบบจัดการแคลนและสมาชิก (Clan & Alliance Management):** รองรับการลากย้ายแคลน (Drag & Drop และ Bulk Swap)
  10. **รองรับการวางรูปภาพจากคลิปบอร์ดโดยตรง (Ctrl + V / Copy-Paste):** ทุกจุดที่มีการอัปโหลดรูป
  11. **รองรับ 2 ภาษา ทั้งไทย (TH) และ อังกฤษ (EN) 100%:** ครอบคลุมทุกจุด ไม่มี hardcode
  12. **ธีม Dark Fantasy ปราสาท Lineage 2M พร้อมเสียงเอฟเฟกต์ Sound FX**

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
d:/Anti webapp/
├── .env                         # ตัวแปรระบบ: GEMINI_API_KEY, PORT=3000
├── firebase-applet-config.json  # ค่าคอนฟิกเชื่อมต่อ Firebase Firestore
├── server.ts                    # Express backend: เสิร์ฟ Vite, Discord Proxy, API endpoints /api/scan-hunters, /api/gemini-status
├── PROJECT_HANDOVER.md          # คู่มือส่งมอบงานและข้อมูลอัปเดต v2.1.0 แบบสมบูรณ์
├── SYSTEM_ARCHITECTURE.md       # แผนผังวิศวกรรมสถาปัตยกรรมระบบแม่บท
├── src/
│   ├── main.tsx                 # Entry point ของ React
│   ├── App.tsx                  # คอมโพเนนต์หลัก: จัดการ Global State, Fluid Layout, Tab Persistence, Modal triggers
│   ├── types.ts                 # Type definitions ทั้งหมด (User, VaultItem, DiscordSettings, DiscordMentionType, ฯลฯ)
│   ├── translations.ts          # พจนานุกรมแปล 2 ภาษา (th, en) 100%
│   ├── services/
│   │   ├── firebase.ts          # Firestore operations, real-time listeners, sanitizeForFirestore
│   │   └── gemini.ts            # ฟังก์ชันเรียก Gemini AI สแกน OCR ผู้ล่า
│   ├── utils/
│   │   ├── sound.ts             # Web Audio API สร้างเสียงเอฟเฟกต์ (คลิก, เคลม, แจ้งเตือน, แตรแจกของ)
│   │   ├── clipboard.ts         # Utility ช่วยดักจับ event Ctrl+V เพื่ออ่านรูปภาพจาก Clipboard
│   │   ├── diamondHelper.ts     # คำนวณยอดเพชรและ Net Change รายการธุรกรรม
│   │   └── discord.ts           # ส่งแจ้งเตือน Webhook เข้า Discord พร้อม Role ID Mentions
│   └── components/
│       ├── LoginScreen.tsx      # หน้าล็อกอิน/สมัครสมาชิกแบบเต็มหน้า (มีกรอกค่าพลังเริ่มต้น + พรีวิวตัวเลข)
│       ├── AuthModal.tsx        # หน้าต่าง Popup เข้าสู่ระบบ/สมัครสมาชิก (กรณีเปิดจากด้านใน)
│       ├── Navbar.tsx           # แถบเมนูด้านบน มีปุ่มสลับภาษาและวิดเจ็ตเพชรขาว
│       ├── Sidebar.tsx          # แถบเมนูซ้าย + เมนูมือถือหลักของระบบ
│       ├── GeminiKeyModal.tsx   # หน้าต่างตั้งค่า/ทดสอบ Gemini API Key (เฉพาะ Owner)
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
│       ├── DiscordWebhookModal.tsx # ตั้งค่า Webhook URL และ Role ID Mention
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
  - มีสิทธิ์สูงสุด ควบคุมระบบทั้งหมด แต่งตั้ง Admin ได้ผู้เดียว, ตั้งค่า Gemini Key ได้ผู้เดียว, ตั้งค่า Discord Webhook Role Mentions ได้ผู้เดียว, และใช้ฟังก์ชันรีเซ็ตยอดเพชรและศูนย์รีเซ็ตระบบได้ผู้เดียว
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
- **รันเซิร์ฟเวอร์พัฒนา:** `& 'C:\Program Files\nodejs\node.exe' 'node_modules\tsx\dist\cli.mjs' server.ts` (เปิดที่ `http://localhost:3000`)
- **ตรวจสอบ Type TypeScript:** `& 'C:\Program Files\nodejs\node.exe' 'node_modules\typescript\bin\tsc' --noEmit`
- **Build สำหรับ Production:** `& 'C:\Program Files\nodejs\node.exe' 'node_modules\vite\bin\vite.js' build`
- **URL ระบบที่ Deploy สด:** [https://lineage2m-k7-item-vault.vercel.app/](https://lineage2m-k7-item-vault.vercel.app/)

---

## 6. ข้อความพร้อมใช้สำหรับเปิดแชทใหม่ (New Chat Prompt Template)
คัดลอกข้อความด้านล่างนี้ไปวางเมื่อเปิดห้องแชทใหม่ เพื่อให้ AI สานต่องานได้ทันที 100%:
```
โปรดอ่านไฟล์ SYSTEM_MANUAL_v2.2.0.md, AI_CONTEXT.md และ PROJECT_HANDOVER.md ในโปรเจกต์นี้ทั้งหมดก่อนเริ่มงาน
ระบบปัจจุบันคือ Lineage2M Clan Hub & Boss Item Vault (v2.2.0 — อัปเดตล่าสุด)
- บัญชี Owner: Eloni (สิทธิ์ Owner สูงสุด)
- Live URL: https://lineage2m-k7-item-vault.vercel.app/
- สถานะระบบล่าสุด (v2.2.0):
  1. แม่แบบข้อความ Discord 4 รูปแบบ (Radiant Neon, Siege & War, Guild Market, Crystal Minimal)
  2. สีฟอนต์ชื่อไอเทมเรืองแสงตรงตามระดับความหายาก (Discord ANSI: MYTHIC=ทอง, LEGEND=ม่วง, EPIC=แดง, RARE=ฟ้า, Price=เขียว)
  3. รูปภาพ Thumbnail ไอเทมแนบส่งเข้า Discord API ตรง 100% พร้อม Default Icon Fallback
  4. หน้าต่าง DiscordBroadcastModal สำหรับเลือกแม่แบบพร้อม Live Color Preview ก่อนส่ง
  5. ขอบการ์ดไอเทมเรืองแสงสไตล์นีออน (LEGEND #8500fd, MYTHIC #ffb800, EPIC #ff1744, RARE #00e5ff)
  6. หน้าจอ Fluid Responsive ปรับขนาดตามหน้าต่างบราวเซอร์อัตโนมัติ (App.tsx)
  7. ระบบ 2 ภาษา TH/EN 100% ทุกจุด
  8. Typecheck และ Vite Build ผ่าน 0 errors
โปรดยืนยันว่าเข้าใจสถาปัตยกรรมและกฎการป้องกันโค้ดเสียหายแล้ว พร้อมรับคำสั่งงานต่อไปครับ
```
