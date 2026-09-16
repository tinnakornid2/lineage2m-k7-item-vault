# ⚔️ Lineage2M Clan Hub & Boss Item Vault (v2.0.0)

> **Lineage 2M Clan Hub & Boss Item Vault (Version: v2.0.0 — เวอร์ชั่นสมบูรณ์)**  
> ระบบบริหารจัดการกิลด์ คลังไอเทมบอส คิวไอเทม สแกนสลิปผู้ล่าด้วย AI และแจ้งเตือน Discord แบบ Real-time

---

## ✨ ฟีเจอร์หลัก (Key Features)

- 🏰 **Item Vault (คลังไอเทมบอส):**
  - ลงทะเบียนและแก้ไขข้อมูลไอเทมเปิดรับได้อิสระ (`EditVaultItemModal`) ทั้งชื่อ, จำนวน, ราคา, พลังขั้นต่ำ, รูปไอเทม และรายชื่อผู้ล่า
  - ระบบจดจำชื่อไอเทมที่เคยกรอกอัตโนมัติ (Item Names Autocomplete & Recent Memory)
  - กำหนดระดับความหายาก (Mythic, Legend, Epic, Rare) และเกณฑ์พลังขั้นต่ำ (Min Power Level / PL)
- 🧾 **Multiple Receipt Bills (ระบบแนบรูปบิลหลายใบ):**
  - แนบภาพบิล/ใบเสร็จได้หลายใบต่อ 1 ไอเทม สำหรับไอเทมที่แจกแล้ว
  - หน้าต่างแกลเลอรีซูมภาพขนาดใหญ่ พร้อมระบบเพิ่ม/ลบบิลย้อนหลังได้อย่างปลอดภัย
- 💎 **Clan Fund (กองทุนเพชรแคลน):**
  - ฝากและถอนเพชรแบบ 1:1 ตรงตามจำนวนจริง (นำช่องหักภาษีตลาดออกเพื่อความสะดวกและโปร่งใส)
  - ระบบคำนวณยอดคงเหลือมาตรฐานเดียวกันทุกจุด (Dashboard, Sidebar, Modal)
  - **ปุ่มรีเซ็ตยอด (Owner Balance Reset):** สิทธิ์พิเศษเฉพาะ Owner ในการล้างประวัติธุรกรรมเริ่มใหม่ที่ 0 หรือบันทึกรายการปรับยอด (Adjust) อัตโนมัติ
  - สรุปภาพรวมยอดกองทุนและบันทึกภาพการ์ดสรุปยอด (Balance Snapshot Generator) ส่งเข้า LINE / Discord ได้ทันที
- 📸 **AI Hunter OCR Scanner (Google Gemini AI):**
  - สแกนรายชื่อผู้ล่าจากภาพสกรีนช็อตปาร์ตี้บอสหลายรูปพร้อมกัน ตัดชื่อซ้ำอัตโนมัติ
  - สิทธิ์การใช้งาน OCR แบบเต็มรูปแบบสำหรับ Admin ทุกคนและ Owner
  - รองรับทั้งการสแกนผ่าน Server (Localhost) และ Direct Client (Vercel Production)
- ⏳ **Item Queue Management (คิวไอเทม):**
  - แสดงลำดับคิวและสถานะรับไอเทมของสมาชิกอย่างโปร่งใส
  - ระบบตรวจสอบเงื่อนไขสเตตัสก่อนเคลม (สมาชิกต้องส่งสเตตัสและผ่านการอนุมัติก่อน)
- 🔔 **Discord Webhook Integration:**
  - แจ้งเตือนไอเทมบอสดรอปใหม่เข้าห้อง Discord กิลด์แบบ Real-time
  - ประกาศผลการแจกจ่ายไอเทมพร้อมสถิติและรูปหลักฐาน
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

## 📦 การสร้าง Production Build & Run

```bash
npm run build
npm start
```

---

## 🛠️ Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide React, Motion
- **Backend Server:** Node.js, Express, ESBuild, tsx
- **Database:** Firebase Cloud Firestore (Real-time synchronization `onSnapshot`)
- **AI Engine:** Google GenAI SDK (`@google/genai` - Gemini Flash Models)
- **Hosting / Deploy:** Vercel (Frontend & Direct Client API) / Express Server (Local)
