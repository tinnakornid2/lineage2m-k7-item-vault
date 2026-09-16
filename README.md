# ⚔️ Lineage2M Clan Hub & Boss Item Vault (v2.3.0)

> **Lineage 2M Clan Hub & Boss Item Vault (Version: v2.3.0 — อัปเดตล่าสุด)**  
> ระบบบริหารจัดการกิลด์ คลังไอเทมบอส คิวไอเทม สแกนสลิปผู้ล่าด้วย AI และแจ้งเตือน Discord ANSI Colors & Templates แบบ Real-time

---

## ✨ ฟีเจอร์ใหม่ล่าสุดใน v2.3.0 (What's New in v2.3.0)

- ⚪ **Discord Price Font Color is Bold White (ANSI \u001b[1;37m):**
  - ตัวอักษรแสดงราคาเพชร เช่น `Price: FREE (0 Diamonds)` หรือราคาเพชรอื่น ๆ เปลี่ยนเป็น **สีขาวเรืองแสงเด่นชัด** สวยงาม อ่านง่ายทั้งบนคอมและมือถือ ครบทั้ง 4 แม่แบบ
  - อัปเดต UI Live Preview ในหน้าเลือกแม่แบบ (`DiscordBroadcastModal`) และหน้าตั้งค่า (`DiscordWebhookModal`) เป็นสีขาว (`text-white`)
- 💾 **ระบบบันทึก Discord Webhook และ Gemini OCR Key ถาวรข้ามแอดมิน (Shared Persistence):**
  - ข้อมูล URL ของ Webhook และคีย์ Gemini OCR จัดเก็บบน Firestore (`app_settings/discord`, `app_settings/gemini_ai`) และมี `localStorage` สำรอง
  - รีเฟรชหน้าจอ F5 ข้อมูลไม่สูญหาย ไม่ต้องกรอกใหม่
  - เมื่อ Owner บันทึกคีย์ Gemini AI แล้ว แอดมินทุกคนสามารถกดสแกนรูปปาร์ตี้บอสได้ทันทีโดยไม่ต้องขอคีย์มากรอกเอง
- ⚡ **ความเสถียรบน Vercel Serverless (แก้ปัญหา FUNCTION_INVOCATION_FAILED):**
  - Dynamic Import โมดูล Firebase Admin ป้องกันการ Crash จาก Credential ขาดหาย
  - ห่อหุ้ม Express Handler ด้วย Promise รอ `res.on('finish')` ป้องกัน Lambda ตัดการเชื่อมต่อก่อนส่งผลลัพธ์
  - Bundle ไฟล์เดียว `api/index.js` พร้อม Endpoint `/api/health` คืนค่ารวดเร็ว <150ms
- 📦 **สแนปช็อตสำรองข้อมูลสมบูรณ์ v2.3.0:**
  - `backups/complete_snapshot_v2.3.0.json` (สมาชิก 22 คน, ไอเทม 23 ชิ้น, คิว 5 รายการ, กองทุน 23,521 เพชร)

---

## 🎨 ฟีเจอร์เด่นหลักของระบบ (Core Features)

- 🎨 **Discord Message Templates 4 สไตล์:**
  - **Radiant Neon (`neon_glow`):** สไตล์นีออนเรืองแสง กรอบ ANSI สีตามความหายาก สวยสะดุดตา
  - **Siege & War Vault Alert (`war_horn`):** สไตล์บัญชาการรบ ดุดัน แจ้งเตือนบอสและเปิดเคลมเสริมทัพกิลด์
  - **Guild Treasury & Market (`clan_market`):** สไตล์ตลาดประมูลปราสาทกีรัน เน้นราคาเพชรและรายการไอเทม
  - **Crystal Minimal (`crystal_minimal`):** การ์ด Embed กระชับ คลีน สบายตา
- 🎯 **สีฟอนต์ชื่อไอเทมเรืองแสงตรงตามระดับความหายาก (Discord ANSI):**
  - 🟨 **MYTHIC:** สีทอง (`\u001b[1;33m`)
  - 🟪 **LEGEND:** สีม่วงเรืองแสง (`\u001b[1;35m`)
  - 🟥 **EPIC:** สีแดงเรืองแสง (`\u001b[1;31m`)
  - 🟦 **RARE:** สีฟ้าเรืองแสง (`\u001b[1;36m`)
  - 💎 **ราคาไอเทม:** สีขาวเด่นชัด (`\u001b[1;37m`)
- 🖼️ **การแนบรูปภาพ Thumbnail อัตโนมัติ (Native Multipart Uploads):**
  - อัปโหลดไฟล์ภาพจริงเข้า Discord API ตรง พร้อมระบบสำรอง Default Icon 100%
- 🖥️ **Fluid Dynamic Responsive UI (ปรับขนาดตามหน้าต่างบราวเซอร์):**
  - คอนเทนเนอร์หลักปรับขนาดอัตโนมัติตามขนาดหน้าต่างบราวเซอร์ (`w-full max-w-full 2xl:max-w-[1920px]`)
  - รองรับทั้งการแบ่งหน้าจอ (Split-Screen), แล็ปท็อป, มอนิเตอร์มาตรฐาน และจอ Ultrawide 2K/4K
- 🔄 **Tab State & URL Hash Persistence (รีเฟรชแล้วอยู่หน้าเดิม):**
  - ซิงค์แท็บหน้าปัจจุบันลงบน URL Hash (`#vault`, `#queue`, `#distribution`, ฯลฯ) ร่วมกับ `localStorage`
  - กด F5 Refresh หรือกดปุ่ม Back/Forward ของเบราว์เซอร์จะไม่หลุดกลับไปหน้า Dashboard
- 🏰 **Item Vault & Dashboard (คลังไอเทมบอส):**
  - **จัดกล่องไอเทมแถวละ 4 ชิ้นบนเดสก์ท็อป (`lg:grid-cols-4`)**
  - **การ์ดไอเทมกะทัดรัดจัดระเบียบ 2 บรรทัดติดรูปภาพ Thumbnail**
    - บรรทัด 1: ชื่อไอเทมเด่นชัด + ป้ายเกรดความหายาก
    - บรรทัด 2: ราคาเพชร (หรือ FREE) + เกณฑ์พลังขั้นต่ำ + จำนวนผู้ขอรับ
  - ลงทะเบียนและแก้ไขข้อมูลไอเทมเปิดรับได้อิสระ (`EditVaultItemModal`) ทั้งชื่อ, จำนวน, ราคา, พลังขั้นต่ำ, รูปไอเทม และรายชื่อผู้ล่า
  - ระบบจดจำชื่อไอเทมที่เคยกรอกอัตโนมัติ (Item Names Autocomplete & Recent Memory)
- 🔔 **Discord Webhook Integration with Custom Role Mentions:**
  - Owner สามารถตั้งค่ารูปแบบการแท็กแจ้งเตือน Discord ได้ 3 แบบ: **`Role ID`**, **`@everyone`**, หรือ **`none`**
  - ส่งการ์ดแจ้งเตือน Discord อัตโนมัติทันทีที่มีการลงไอเทมใหม่เข้าคลัง (ทั้ง Admin และ Owner)
- 🧾 **Multiple Receipt Bills (ระบบแนบรูปบิลหลายใบ):**
  - แนบภาพบิล/ใบเสร็จได้หลายใบต่อ 1 ไอเทม สำหรับไอเทมที่แจกแล้ว
  - หน้าต่างแกลเลอรีซูมภาพขนาดใหญ่ พร้อมระบบเพิ่ม/ลบบิลย้อนหลังได้อย่างปลอดภัย
- 💎 **Clan Fund (กองทุนเพชรแคลน):**
  - ฝากและถอนเพชรแบบ 1:1 ตรงตามจำนวนจริง
  - ระบบคำนวณยอดคงเหลือมาตรฐานเดียวกันทุกจุด (Dashboard, Sidebar, Modal) ผ่าน `diamondHelper.ts`
  - **ปุ่มรีเซ็ตยอด (Owner Balance Reset):** สิทธิ์พิเศษเฉพาะ Owner ในการล้างประวัติธุรกรรมเริ่มใหม่ที่ 0 หรือบันทึกรายการปรับยอด (Adjust) อัตโนมัติ
- 📸 **AI Hunter OCR Scanner (Google Gemini AI):**
  - สแกนรายชื่อผู้ล่าจากภาพสกรีนช็อตปาร์ตี้บอสหลายรูปพร้อมกัน ตัดชื่อซ้ำอัตโนมัติ
  - สิทธิ์การใช้งาน OCR แบบเต็มรูปแบบสำหรับ Admin ทุกคนและ Owner
- ⏳ **Item Queue Management (คิวไอเทม):**
  - แสดงลำดับคิวและสถานะรับไอเทมของสมาชิกอย่างโปร่งใส พร้อมระบบตรวจสอบสเตตัสก่อนเคลม
- 🛡️ **Clan & Member Management:**
  - จัดการแคลนพันธมิตร ลากย้ายสมาชิกข้ามแคลน (Drag & Drop และ Bulk Swap)
  - ระบบขออนุมัติและเปรียบเทียบสเตตัสแบบ Split-View พร้อมภาพสกรีนช็อต
- 🌐 **100% Bilingual (TH / EN):**
  - รองรับ 2 ภาษา ทั้งภาษาไทยและภาษาอังกฤษครบทุกปุ่ม ข้อความ กล่องตัวเลือก และแจ้งเตือน

---

## 🚀 วิธีติดตั้งและเปิดใช้งาน (Local Development)

### 1. ติดตั้ง Dependencies
```bash
npm install
```

### 2. ตั้งค่าไฟล์ Environment (.env)
กำหนดค่าใน `.env`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3000
```

### 3. เริ่มรันเซิร์ฟเวอร์
```bash
npm run dev
```
เปิดเบราว์เซอร์เข้าที่: `http://localhost:3000`

---

## 📦 การสร้าง Production Build & Verification

```powershell
# ตรวจสอบ TypeScript Type Safety
& 'C:\Program Files\nodejs\node.exe' 'node_modules\typescript\bin\tsc' --noEmit

# สร้าง Production Bundle
& 'C:\Program Files\nodejs\node.exe' 'node_modules\vite\bin\vite.js' build
```

---

## 🛠️ Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide React, Motion
- **Backend Server:** Node.js, Express, ESBuild, tsx
- **Database:** Firebase Cloud Firestore (Real-time synchronization `onSnapshot`)
- **AI Engine:** Google GenAI SDK (`@google/genai` - Gemini Flash Models)
- **Hosting / Deploy:** Vercel (Frontend & Serverless API) / Express Server (Local)
