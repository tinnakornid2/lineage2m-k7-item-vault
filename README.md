# ⚔️ Lineage2M Clan Hub & Boss Item Vault (v2.7.0)

> **Lineage 2M Clan Hub & Boss Item Vault (Version: v2.7.0 — อัปเดตล่าสุด)**  
> ระบบบริหารจัดการกิลด์ คลังไอเทมบอส คิวไอเทม สแกนสลิปผู้ล่าด้วย AI จัดการรหัสผ่านตามสิทธิ์ ติดตามสถานะชำระเงิน ฐานข้อมูลสำรอง Google Sheets Zero-Downtime และแจ้งเตือน Discord ANSI Colors & Templates แบบ Real-time

---

## 📖 คู่มือนักพัฒนาและการส่งมอบงาน (Developer Handover Guide)
> 👉 **[อ่านคู่มือสถาปัตยกรรมและการส่งมอบงานฉบับเต็มได้ที่ DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)**  
> 👉 **[อ่านคู่มือ Zero-Downtime Architecture & Resilience ได้ที่ ARCHITECTURE_AND_RESILIENCE.md](ARCHITECTURE_AND_RESILIENCE.md)**  
> สรุปโครงสร้างระบบ สถาปัตยกรรม Zero-Downtime สิทธิ์ผู้ใช้งาน กฎความปลอดภัย และแนวทางการพัฒนาต่อยอดโดยระบบไม่พัง

---

## ✨ ฟีเจอร์ใหม่ล่าสุดใน v2.7.0 (What's New in v2.7.0)

- 📊 **จำกัดการแสดงผล 5 รายการแรก พร้อมปุ่มกดดูทั้งหมด (Dashboard 5-Item View All Toggles):**
  - **My Clan Status (สถานะแคลนของฉัน):** ทั้งส่วนคิวรอรับไอเทม (`userQueues`) และรายการเคลมไอเทม (`userActiveClaims`) แสดงเริ่มต้น 5 รายการแรก พร้อมปุ่มสลับ "ดูทั้งหมด / View All" และ "แสดงแค่ 5 รายการแรก / Show 5 Items Only"
  - **Top Power Leaderboard (อันดับค่าพลัง):** แสดง 5 อันดับแรกเริ่มต้น พร้อมป้ายนับจำนวน และปุ่ม "ดูทั้งหมด / View All"
  - **Recent Distributions (ประวัติการแจกไอเทมล่าสุด):** แสดง 5 รายการแจกล่าสุดเริ่มต้น พร้อมปุ่ม "ดูทั้งหมด / View All"
  - รองรับระบบสองภาษา (ไทย/อังกฤษ) 100% ตามกฎ Rule 1
- ⚡ **ระบบเขียนข้อมูล Firestore แบบ Zero-Hang (`safeFirestoreWrite`):**
  - ครอบคำสั่ง Write ทุกคำสั่งด้วย 1,200ms Timeout Guard ป้องกันปุ่มค้างที่ "กำลังบันทึก..." หรือ "กำลังโหลด..." เมื่อโควต้า Firestore เต็ม (`RESOURCE_EXHAUSTED`)
  - ซิงค์ลง LocalStorage, Live State Relay, และ Google Sheets อัตโนมัติทันที
- 📢 **ระบบแจ้งเตือน Discord อัตโนมัติและคงทน (Discord Auto-Post Resilience):**
  - แก้ไขปัญหาปุ่มบันทึกการตั้งค่า Webhook ค้าง
  - แจ้งเตือนไอเทมใหม่เข้าคลังและการแจกของลง Discord อัตโนมัติ 100% แม้ Firestore ติดลิมิต
  - คงรูปแบบ Option 1 ANSI Code Block 2 บรรทัด ฟอนต์มีสี และรูปไอเทมจริงขวาบนตาม Rule 5
- 📚 **คู่มือสถาปัตยกรรมความคงทนฉบับสมบูรณ์ ([ARCHITECTURE_AND_RESILIENCE.md](ARCHITECTURE_AND_RESILIENCE.md)):**
  - รวบรวมแนวทาง 5-Tier Failover Hierarchy, กฎ Firestore Quota, และคู่มือนักพัฒนาทุกคน

---

- 🛡️ **ระบบสำรองข้อมูลคู่ขนาน Google Sheets & Drive Database (Zero-Downtime Architecture):**
  - **ทำงานต่อเนื่อง 100% แม้ Firebase ติดโควต้าฟรี (Automatic Failover):** สลับมาใช้ Google Sheets และ Local Relay ทันที ไม่สะดุด ไม่ขึ้นจอขาว
  - **ซิงค์สดระหว่างสมาชิกด้วยความเร็วสูง (< 50ms):** ผ่าน Server Long-Polling (`/api/live-state`)
  - **บันทึกลง Google Sheets อัตโนมัติ (Background Auto-Backup):** บันทึกข้อมูลสมาชิก ไอเทม คิว และกองทุนไดอาทุกครั้งที่มีการอัปเดต
  - **กู้คืนและเขียนกลับขึ้น Firebase Cloud อัตโนมัติ (Auto-Recovery Heartbeat):** เมื่อ Firebase พ้นลิมิตโควต้า ระบบจะซิงค์ข้อมูลช่วงออฟไลน์กลับขึ้น Cloud ให้ทันที
  - **แผงควบคุมและสถานะการสำรองข้อมูลแบบใหม่ (Streamlined Backup Modal):** ตัดแท็บโค้ดดิบและปุ่มอันตรายออก แสดงไฟสถานะ 🟢 ออนไลน์, เวลาล่าสุดสดๆ และปุ่มเปิดดู Google Sheet ได้ทันที
  - **ไฟสถานะบน Sidebar:** แสดงจุดเขียวบนปุ่ม Google Sheets ในเมนูข้าง ให้ Owner ทราบทันทีว่าฐานข้อมูลสำรองพร้อมใช้งาน
- 🔍 **ระบบตรวจสอบสเตตัสเทียบรูปสกรีนช็อตแบบคู่ขนาน (Side-by-Side Stat Proof Inspector):**
  - **แผงซ้าย:** ภาพสกรีนช็อตความละเอียดสูง ซูมได้ (0.4x - 4x), ใช้ลูกกลิ้งเมาส์ซูม, ลากขยับรูปได้ (Drag-to-pan), ปุ่ม 150%, 200%, Fit Screen
  - **ระบบดูหลายภาพ (Multi-Screenshot Carousel):** สลับดูสกรีนช็อตทุกหน้าของสมาชิกได้ด้วยปุ่ม `<` และ `>` พร้อมตัวนับ `📷 1 / 3`
  - **แผงขวา:** ข้อมูลตัวละครและค่าสเตตัสทั้งหมดเทียบกันชัดเจน พร้อมช่องค้นหาด่วนและปุ่มคัดกรองหมวดหมู่ (โจมตี, ป้องกัน, ผลึกวิญญาณ)
  - **รองรับ 2 โหมด:** โหมดตรวจดูสเตตัสที่ผ่านการยืนยันแล้ว (Verified Mode) และโหมดพิจารณาอนุมัติ/ปฏิเสธ (Pending Review Mode)
  - **เข้าถึงได้ทุกจุด:** ปุ่มกล้องในหน้ารายชื่อสมาชิก (ทั้งมุมมองการ์ดและตาราง) และรูปพรีวิวในหน้าแก้ไขสมาชิก
- ⚡ **หน้าจัดการสูตรคำนวณค่าพลังเต็มหน้าจอ (Full-Page Power Formula View):**
  - ยกเลิกการแสดงผลแบบป๊อปอัพ เปลี่ยนเป็นหน้าต่างเต็มหน้าจอผ่าน Route `#power_formula`
  - สไลเดอร์ปรับตัวคูณค่าน้ำหนักสเตตัส, สร้างสเตตัสกำหนดเอง (Custom Stats), และ Sandbox จำลองคำนวณค่าพลัง
- 🖼️ **ปรับขนาดรูปภาพไอเทมให้ใหญ่และชัดเจนขึ้น:**
  - เพิ่มขนาดรูปภาพไอเทมทุกจุด (คลังไอเทม, ป๊อปอัพแจกของ, คิว, รายชื่อเคลม) ให้เห็นไอเทมได้ถนัดตา
- 🧹 **ปรับปรุง UI:**
  - นำไอคอนรูปกุญแจที่หน้าสมาชิกออก เพื่อความสะอาดตา
  - แก้ไขปัญหาการแจ้งเตือนแจกของค้างบนหน้าจอเมื่อกดรีเฟรช
- 📦 **สแนปช็อตสำรองข้อมูลสมบูรณ์ v2.6.0:**
  - `backups/complete_snapshot_v2.6.0.json` (สมาชิก 24 คน, ไอเทม 29 ชิ้น, คิว 5 รายการ, กองทุน 26,460 เพชร)

---

## 📜 ประวัติการอัปเดตเวอร์ชันก่อนหน้า (Previous Releases)

### ✨ ฟีเจอร์ใน v2.5.0

- ⚔️ **กฎมาตรฐานการแจ้งเตือน Discord Webhook ใหม่ (Rule 5: Discord Webhook Option 1 Only & English 100%):**
  - **แจ้งเตือนเฉพาะไอเทมเท่านั้น (Item-Only Scope):** ส่งแจ้งเตือน Discord เฉพาะการลงไอเทมใหม่ (`new_item`) และการแจกของ (`distribute`) เท่านั้น ปิดการแจ้งเตือนสเตตัส (`stat_request`, `stat_approval`) เพื่อรักษาความสะอาดของช่อง Discord
  - **ข้อความ Discord เป็นภาษาอังกฤษ 100% (Mandatory English 100% for Discord):** ทุกส่วนของข้อความ Discord (Headers, Titles, ANSI Code Blocks, Fields, Footers, Links) เป็นภาษาอังกฤษ 100%
  - **ตัด Embed Title ซ้ำซ้อนออกถาวร (Strictly No Duplicate Title):** ไม่ใส่ฟิลด์ `title` ซ้ำใน Embed ไอเทมใหม่ เพื่อให้เริ่มด้วยกรอบ ANSI สีสดทันที
  - **ตัดบรรทัดคนล่าออกถาวร 100% (Completely Remove Hunters Line):** ไม่ต้องแสดงรายชื่อคนล่า (`⚔️ Hunters:`) ในข้อความ Discord ตัดออก 100% ให้ข้อความสั้นกระชับที่สุด
  - **กรอบ ANSI 2 บรรทัดคมชัด (Option 1 Standard):**
    - บรรทัด 1: `[RARITY] <Item Name> (xQty)` สี ANSI ตามระดับ (🟨 MYTHIC, 🪻 LEGEND, 🟥 EPIC, 🟦 RARE)
    - บรรทัด 2: `💎 Price: X Diamonds` หรือ `Price: FREE (0 Diamonds)` สีขาวสว่าง `\u001b[1;37m`
    - บรรทัดลิงก์: `👉 [Open Vault to Claim Item](url)`
  - **แก้ไขรูปภาพไอเทมจริงที่มุมขวาบน (Thumbnail Fix):** ดึงรูปภาพไอเทมจริงที่อัปโหลด/ใส่ URL มาแสดงที่มุมขวาบน ไม่นำรูปไอคอนตัวอย่างมาทับ
- 🔑 **ระบบเปลี่ยนรหัสผ่านตามลำดับสิทธิ์ (Role-Based Password Management):**
  - สมาชิกทุกคนเปลี่ยนรหัสผ่านตนเองได้, Owner เปลี่ยนให้ทุกคนได้, Admin เปลี่ยนให้ Member/Leader ได้
- 🗑️ **ระบบจัดการและลบการแจ้งเตือน (Notification Center Deletion & Auto-Cleanup):**
  - ปุ่มถังขยะลบรายข้อความ + ปุ่มล้างทั้งหมด + ตัดการแจ้งเตือนขอรับของที่แจกไปแล้วอัตโนมัติ
- 💳 **ระบบติดตามสถานะการชำระเงินของไอเทมแจกจ่าย (Payment Tracking & Confirmation):**
  - แสดงสถานะ `รอชำระ` / `ชำระแล้ว` / `ฟรี` พร้อมปุ่มยืนยันชำระเงินในหน้า Vault
- 🏷️ **ปรับปรุงหน้าจอ My Stats (Thai Subtitles & Clean Inputs):**
  - ชื่อสเตตัสทุกค่ามีวงเล็บภาษาไทยกำกับจางๆ พร้อมเคลียร์ค่า placeholder ออกทั้งหมด
- 📦 **สแนปช็อตสำรองข้อมูลสมบูรณ์ v2.5.0:**
  - `backups/complete_snapshot_v2.5.0.json` (สมาชิก 23 คน, ไอเทม 23 ชิ้น, คิว 5 รายการ, กองทุน 23,521 เพชร)

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

# บิลด์ Serverless Function สำหรับ Vercel
& 'C:\Program Files\nodejs\node.exe' 'node_modules\esbuild\bin\esbuild' api/_entry.ts --bundle --platform=node --format=esm --packages=external --outfile=api/index.js

# บิลด์ Local Server
& 'C:\Program Files\nodejs\node.exe' 'node_modules\esbuild\bin\esbuild' server.ts --bundle --platform=node --format=esm --packages=external --sourcemap --outfile=dist/server.js
```

---

## 🛠️ Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide React, Motion
- **Backend Server:** Node.js, Express, ESBuild, tsx
- **Database:** Firebase Cloud Firestore (Real-time synchronization `onSnapshot`)
- **Authentication:** Firebase Authentication & Firebase Admin SDK
- **AI Engine:** Google GenAI SDK (`@google/genai` - Gemini Flash Models)
- **Hosting / Deploy:** Vercel (Frontend & Serverless API) / Express Server (Local)
