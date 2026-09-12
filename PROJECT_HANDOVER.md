# 📋 PROJECT HANDOVER & WORK CONTINUATION GUIDE
> **Lineage 2M Clan Hub & Boss Item Vault (Version: v1.6.0)**  
> **Last Updated:** 2026-09-12  
> **Repository:** `tinnakornid2/lineage2m-k7-item-vault`  
> **Live Web App:** [https://lineage2m-k7-item-vault.vercel.app/](https://lineage2m-k7-item-vault.vercel.app/)

---

## 🎯 วัตถุประสงค์ของเอกสารนี้ (Purpose)
เอกสารนี้จัดทำขึ้นเพื่อให้ **AI Assistant ในห้องแชทใหม่ (New Chat Session)** หรือนักพัฒนาท่านอื่น สามารถเข้ามาอ่านและเริ่มทำงานต่อได้ทันที โดยเข้าใจสถาปัตยกรรม ฟีเจอร์ล่าสุด สถานะโค้ดปัจจุบัน และกฎเกณฑ์สำคัญของระบบอย่างครบถ้วน 100%

---

## 🔑 ข้อมูลบัญชีและสิทธิ์สำคัญ (Credentials & Permissions)
1. **บัญชีเจ้าของระบบ (Owner Account):**
   - **Username:** `eloni` (หรือ `Eloni`)
   - **Password:** `0386231334`
   - **ID ในระบบ:** `user_owner_eloni`
   - **Role:** `owner` (มีระบบคุ้มครอง Immutable Protection ห้ามลดขั้นเป็น member)
   - **สิทธิ์:** เข้าถึงทุกฟังก์ชัน, ตั้งค่า Gemini AI Key, อนุมัติสเตตัส/สมาชิก, สลับบทบาทสมาชิก, ศูนย์รีเซ็ตระบบ
2. **ระดับสิทธิ์ผู้ใช้ (User Roles):**
   - `'owner'` : เจ้าของระบบ / หัวหน้ากิลด์สูงสุด
   - `'admin'` : ผู้ดูแลระบบ
   - `'manager'` : ผู้จัดการแคลน
   - `'party_leader'` : หัวหน้าปาร์ตี้ / 👑 Leader
   - `'member'` : สมาชิกทั่วไป

---

## 🏗️ ฟีเจอร์ล่าสุดที่เพิ่งพัฒนาเสร็จสมบูรณ์ (Recent Implementations)

### 1. หน้าจอระบบสเตตัสและการเติบโตสไตล์ Kain7 (`src/components/MyStatsView.tsx`)
- **โครงสร้างแบบ 2-Column Responsive Dashboard:**
  - พอดีจอ ไม่ยาวจนเกินไป คุมสเกลและจัดสัดส่วนชัดเจน
  - **คอลัมน์ซ้าย (Sidebar 4 Cols):**
    - **การ์ดข้อมูลสมาชิก (Member Information):**
      - `In-Game Name *`: กล่องพิมพ์ชื่อตัวละครในเกม (แก้ไขได้และบันทึกอัตโนมัติเมื่อ blur)
      - `Role *`: ปุ่มสลับ `[ Member ]` และ `[ 👑 Leader ]` (มีขอบทองเรืองแสง `#eab308`)
      - `Status`: สวิตช์เปิด-ปิดทรงแคปซูล `Active` (สีเขียว) / `Inactive` (สีเทา)
      - `Clan`: กล่อง Dropdown รายชื่อแคลนของระบบ (`VoltZ`, `LevelS`, `STRONK`, etc.)
      - **ระบบความปลอดภัย (Security Lock):** ช่อง Role, Status, Clan ถูกล็อคให้**เฉพาะ Owner และ Admin เท่านั้นที่แก้ไขได้** สมาชิกทั่วไปจะขึ้นป้าย `🔒 เฉพาะ: Owner / Admin` และอยู่ในสถานะ Disabled ห้ามกด
    - **การ์ดแนบภาพสกรีนช็อต (Screenshots):** อัปโหลด ลากวาง หรือกด `Ctrl + V` วางภาพจาก Clipboard
    - **การ์ด Live Power Level:** คำนวณค่าพลัง PL เรียลไทม์ตามสูตร พร้อมแถบแสดงผลต่าง (`+50 PL` / `-120 PL`)
    - **การ์ดกราฟไทม์ไลน์การเติบโต (`GrowthTimelineChart.tsx`):** เส้นกราฟ SVG เวกเตอร์แบบโค้งมน กรองช่วงเวลา 30D / 90D / 6M / ALL พร้อมบันทึกประวัติ Milestone
  - **คอลัมน์ขวา (Main Content 8 Cols):**
    - **ข้อมูลตัวละคร (Character Stats):** เลือก Class หลัก/รอง (Multi-select), Level, Legend Classes, Legend Agathions
    - **ศูนย์กรอกสเตตัสแบบแท็บ (Tabbed Attribute Center):**
      - แท็บ **`[⚔️ โจมตี]`**, **`[🛡️ ป้องกัน]`**, และ **`[⭐ พิเศษ]`**
      - ลดความยาวหน้าเว็บ กรอกง่าย พร้อมตัวคูณกำกับแต่ละสเตตัส (`x1`, `x2`, `x3`) ตามสูตร Kain7
    - **ปุ่มยืนยันส่งคำขอ (Submit Verification):** แพ็คข้อมูลขึ้น Firestore รออนุมัติ และส่งแจ้งเตือนเข้า Discord Webhook อัตโนมัติ

---

## 📂 แผนผังไฟล์สำคัญ (Key Files Map)
- `src/App.tsx`: ควบคุม Global State, Firestore Real-time Listeners, Modal Routing, และการจัดเก็บ Current User
- `src/components/MyStatsView.tsx`: หน้าระบบสเตตัสและการเติบโต (Kain7 Dashboard)
- `src/components/GrowthTimelineChart.tsx`: คอมโพเนนต์กราฟแสดงพัฒนาการสเตตัส
- `src/services/firebase.ts`: การเชื่อมต่อ Google Cloud Firestore (`users`, `vault_items`, `item_queues`, `clans`, ฯลฯ)
- `src/services/powerFormulaService.ts`: สูตรคำนวณค่าพลัง Power Level (PL) และค่าสปิริต
- `src/types.ts`: โมเดลข้อมูลทั้งหมด (`User`, `UserRole`, `VaultItem`, `ClanGroup`, ฯลฯ)
- `src/translations.ts`: ระบบ 2 ภาษา (TH / EN) 100%

---

## ⚙️ คำสั่งสำหรับทดสอบและบิลด์ (Developer Commands)
```powershell
# ตรวจสอบ Type Safety
npx tsc --noEmit

# สร้าง Production Bundle
npx vite build

# รันเซิร์ฟเวอร์ Local Development
npm run dev

# หมายเหตุสำหรับ Windows PowerShell: ใช้เครื่องหมาย ; แทน &&
npx vite build ; npx tsc --noEmit
```

---

## 💬 ข้อความตัวอย่างสำหรับ Copy ไปเริ่มในห้องแชทใหม่:
```
โปรดอ่านไฟล์ AI_CONTEXT.md และ PROJECT_HANDOVER.md ในโปรเจกต์นี้ทั้งหมดก่อนเริ่มงาน
ระบบปัจจุบันคือ Lineage2M Clan Hub & Boss Item Vault (v1.6.0)
- บัญชี Owner: Eloni (รหัสผ่าน 0386231334)
- Live URL: https://lineage2m-k7-item-vault.vercel.app/
- สถานะล่าสุด: หน้าระบบสเตตัส Kain7 (MyStatsView) เสร็จสมบูรณ์ และล็อคสิทธิ์ Member Information เฉพาะ Owner/Admin เรียบร้อยแล้ว
โปรดยืนยันว่าเข้าใจโครงสร้างระบบแล้ว พร้อมรับคำสั่งงานต่อไปครับ
```
