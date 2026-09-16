# ⚔️ Lineage2M Clan Hub & Boss Item Vault (v2.2.0)

> **Lineage 2M Clan Hub & Boss Item Vault (Version: v2.2.0 — อัปเดตล่าสุด)**  
> ระบบบริหารจัดการกิลด์ คลังไอเทมบอส คิวไอเทม สแกนสลิปผู้ล่าด้วย AI และแจ้งเตือน Discord ANSI Colors & Templates แบบ Real-time

---

## ✨ ฟีเจอร์หลัก (Key Features)

- 🎨 **Discord Message Templates & ANSI Glowing Colors (ใหม่ใน v2.2.0):**
  - **4 สไตล์แม่แบบข้อความ:** Radiant Neon, Siege & War, Guild Market, Crystal Minimal
  - **สีฟอนต์ชื่อไอเทมเรืองแสงตรงตามระดับความหายาก:**
    - 🟨 **MYTHIC:** สีทอง (`\u001b[1;33m`)
    - 🟪 **LEGEND:** สีม่วงเรืองแสง (`\u001b[1;35m`) และธีม `#8500fd`
    - 🟥 **EPIC:** สีแดงเรืองแสง (`\u001b[1;31m`)
    - 🟦 **RARE:** สีฟ้าเรืองแสง (`\u001b[1;36m`)
    - 💎 **ราคาไอเทม:** สีเขียวเรืองแสง (`\u001b[1;32m`)
  - **การแนบรูปภาพ Thumbnail อัตโนมัติ:** ส่งไฟล์ภาพจริงเข้า Discord API โดยตรง พร้อมระบบสำรอง Default Icon 100%
  - **DiscordBroadcastModal:** หน้าต่างเลือกแม่แบบพร้อม Live Color Preview ก่อนกดส่งประกาศ
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
  - ฝากและถอนเพชรแบบ 1:1 ตรงตามจำนวนจริง (นำช่องหักภาษีตลาดออกเพื่อความสะดวกและโปร่งใส)
  - ระบบคำนวณยอดคงเหลือมาตรฐานเดียวกันทุกจุด (Dashboard, Sidebar, Modal) ผ่าน `diamondHelper.ts`
  - **ปุ่มรีเซ็ตยอด (Owner Balance Reset):** สิทธิ์พิเศษเฉพาะ Owner ในการล้างประวัติธุรกรรมเริ่มใหม่ที่ 0 หรือบันทึกรายการปรับยอด (Adjust) อัตโนมัติ
  - สรุปภาพรวมยอดกองทุนและบันทึกภาพการ์ดสรุปยอด (Balance Snapshot Generator) ส่งเข้า LINE / Discord ได้ทันที
- 📸 **AI Hunter OCR Scanner (Google Gemini AI):**
  - สแกนรายชื่อผู้ล่าจากภาพสกรีนช็อตปาร์ตี้บอสหลายรูปพร้อมกัน ตัดชื่อซ้ำอัตโนมัติ
  - สิทธิ์การใช้งาน OCR แบบเต็มรูปแบบสำหรับ Admin ทุกคนและ Owner
  - รองรับทั้งการสแกนผ่าน Server (Localhost) และ Direct Client (Vercel Production)
- ⏳ **Item Queue Management (คิวไอเทม):**
  - แสดงลำดับคิวและสถานะรับไอเทมของสมาชิกอย่างโปร่งใส
  - ระบบตรวจสอบเงื่อนไขสเตตัสก่อนเคลม (สมาชิกต้องส่งสเตตัสและผ่านการอนุมัติก่อน)
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
- **Hosting / Deploy:** Vercel (Frontend & Direct Client API) / Express Server (Local)
