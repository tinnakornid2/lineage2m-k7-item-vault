# ⚔️ Lineage2M Clan Hub

ระบบจัดการกิลด์ คลังไอเทมบอส คิวไอเทม และแจ้งเตือน Discord แบบ Real-time สำหรับเกม Lineage 2M

---

## ✨ ฟีเจอร์หลัก (Key Features)

- 🏰 **Item Vault (คลังไอเทมบอส):** ลงทะเบียนไอเทม, มูลค่าเพชร, เกณฑ์พลังรบขั้นต่ำ (Min CP), แนบภาพหลักฐานผู้ล่า และประวัติการแจกจ่าย
- ⏳ **Item Queue Management (คิวไอเทม):** แสดงลำดับคิวและสถานะรับไอเทมของสมาชิกอย่างโปร่งใส ปลอดภัย (จัดการได้เฉพาะ Admin / Owner)
- 🔔 **Discord Webhook Integration:** เชื่อมต่อ Discord กิลด์ แจ้งเตือนไอเทมใหม่และประกาศผลการแจกไอเทมอัตโนมัติทันที
- 🛡️ **Clan & Member Management:** จัดการแคลนพันธมิตร อนุมัติสมาชิกใหม่ ปรับเปลี่ยนอาชีพและค่าพลัง
- 📸 **AI Hunter OCR Scanner:** สแกนรายชื่อผู้ล่าจากภาพสกรีนช็อตหลายรูปพร้อมกันและตัดชื่อซ้ำอัตโนมัติด้วย Google Gemini 2.5 Flash
- 💎 **Diamond Vault:** บันทึกประวัติการฝากและถอนเพชรส่วนกลางของแคลน
- 🌐 **Bilingual (TH/EN):** รองรับ 2 ภาษา ทั้งภาษาไทยและภาษาอังกฤษ

---

## 🚀 วิธีติดตั้งและเปิดใช้งาน (Local Development)

### 1. ติดตั้ง Dependencies
```bash
npm install
```

### 2. ตั้งค่าไฟล์ Environment (.env)
คัดลอกไฟล์ `.env.example` เป็น `.env`:
```bash
cp .env.example .env
```
กำหนดค่าคีย์ใน `.env`:
- `GEMINI_API_KEY`: API Key จาก [Google AI Studio](https://aistudio.google.com/) (สำหรับฟังก์ชันสแกนภาพสกรีนช็อต)
- `PORT`: 3000

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

- **Frontend:** React 19, TypeScript, Tailwind CSS, Lucide Icons, Motion
- **Backend Server:** Node.js, Express, ESBuild, tsx
- **Database:** Firebase Cloud Firestore (Real-time synchronization)
- **AI Engine:** Google GenAI SDK (`@google/genai` - Gemini 2.5 Flash)
