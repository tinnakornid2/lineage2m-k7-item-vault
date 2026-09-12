# 📋 PROJECT HANDOVER & WORK CONTINUATION GUIDE
> **Lineage 2M Clan Hub & Boss Item Vault (Version: v1.7.0)**  
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

## 🏗️ ฟีเจอร์ล่าสุดในเวอร์ชัน v1.7.0 (What's New in v1.7.0)

### 1. ระบบสูตรคำนวณค่าพลัง Real-time Firestore Sync (`PowerFormula`)
- เชื่อมต่อ `FormulaSettings` ลงใน Firestore collection `app_settings/power_formula`
- เมื่อ Owner แก้ไขสูตรใน `PowerFormulaSettingsModal.tsx` ระบบจะซิงค์ขึ้น Cloud ทันที
- `App.tsx` และ `MyStatsView.tsx` มี Event Listener รับการอัปเดตแบบเรียลไทม์ ทำให้ทุกเครื่องและสมาชิกทุกคนเห็นตัวเลข Power Level (PL) ตรงกัน 100% โดยไม่ต้องรีเฟรชหน้าจอ

### 2. ปรับปรุงหน้าต่างกรอกสเตตัสและการเทียบรูปหลักฐาน (`MyStatsView.tsx`)
- **ซ่อนป้ายตัวคูณ:** นำป้าย `×1`, `×10 PL` ออกจากกล่องกรอกสเตตัสตามความต้องการ เพื่อความสะอาดตา สบายตา โดยการคำนวณเบื้องหลังยังคงใช้น้ำหนักตามสูตรอย่างแม่นยำ
- **หน้าต่างลอยตรึงรูปหลักฐาน (Floating Pinned Proof):**
  - สมาชิกสามารถกดปุ่ม **"📌 ดูรูปเทียบสเตตัส"** เพื่อเปิดหน้าต่างรูปหลักฐานลอยขึ้นมาขณะกรอกข้อมูล
  - รองรับการปรับขนาด 3 ระดับ: **S (ปกติ)**, **M (ใหญ่)**, และ **L (แบ่งครึ่งจอ Split View)**
  - มีปุ่มซูมในตัว: **[-]**, **[+]**, และ **[100%]** พร้อมเลื่อนดูตัวเลขได้ชัดเจน
  - แสดงภาพเต็มสัดส่วน Uncropped ไม่มีการตัดขอบ

### 3. หน้าต่างตรวจสอบและเปรียบเทียบสเตตัสแบบ Split-View (`StatComparisonModal.tsx`)
- Admin และ Owner สามารถกดเปิดเปรียบเทียบสเตตัสเดิม vs สเตตัสใหม่ที่ขออัปเดตแบบเคียงข้าง (Side-by-side)
- แสดงแถบส่วนต่างสีเขียว/แดง (+/- diff) ชัดเจน
- แสดงรูปสกรีนช็อตหลักฐานพร้อมปุ่มขยายและเครื่องมืออนุมัติ/ปฏิเสธในหน้าเดียว

### 4. ปรับหน้าต่าง Bulk Swap Clan Organizer ให้ย่อขยายอัตโนมัติ (`BulkSwapClanModal.tsx`)
- รองรับการแสดงผลแคลนและสมาชิกจำนวนมาก ปรับกล่องและตารางให้พอดีกับหน้าต่างจอเสมอ
- รองรับการค้นหา กรอง และสลับแคลนแบบกลุ่มได้อย่างคล่องตัว

### 5. เชื่อมต่อ Clan Scope กับหน้า Dashboard (`DashboardView.tsx`)
- อัปเดต `availableDashboardItems` ใน `App.tsx` ให้กรองตามแคลนที่เลือกจาก Sidebar (`selectedClanScope`) ทั้งผู้ล่าและผู้ขอรับไอเทม

### 6. การรีเซ็ตสเตตัสทั้งระบบเพื่อเริ่มรอบใหม่ (System-wide Stat Reset)
- ทำการสำรองข้อมูล (Safety Backup) สมาชิกเดิมทั้งหมดไว้ที่ `backups/users_stats_backup_*.json`
- รีเซ็ตค่าสเตตัส, PL (เป็น 0), และรูปสเตตัสของสมาชิกทุกคน (118 คน) เพื่อรอรับการอัปเดตใหม่อย่างเท่าเทียม
- เพิ่มตัวเลือก **"รีเซ็ตค่าสเตตัสและรูปสมาชิกทุกคน (รอส่งใหม่)"** ใน **Owner Reset Modal** ให้ Owner สามารถสั่งรันได้เองผ่าน UI ในอนาคต

### 7. กฎเหล็กสองภาษา 100% (Rule 1: Bilingual Compliance)
- ทุกข้อความ ปุ่ม ตัวเลือก กล่องข้อความ และรายงาน Discord Share รองรับทั้ง **ไทย (TH)** และ **อังกฤษ (EN)** ครบถ้วน 100% ไม่มีการ Hardcode ภาษาใดภาษาหนึ่ง

### 8. ปรับปรุงระบบ AI OCR ให้ใช้งานได้สมบูรณ์ 100% บนลิงก์ Deploy (Vercel) และทุกอุปกรณ์
- **อัปเดตโมเดลล่าสุด:** เปลี่ยนเป็นชุดโมเดลที่ Google ให้บริการในปัจจุบัน ได้แก่ `gemini-flash-latest`, `gemini-3.5-flash`, `gemini-3.1-flash-lite`, `gemini-flash-lite-latest`, `gemini-3-flash-preview`, `gemini-3.6-flash` (ตัดโมเดล 1.5/2.0/2.5 ที่ Google ปิดบริการ 404 ออก)
- **Direct Client-side OCR บน Vercel:** เมื่อแอดมินใช้งานผ่านลิงก์ Vercel ระบบจะประมวลผลรูปภาพและส่งคำขอไปยัง Gemini AI จากฝั่ง Client โดยตรง รวดเร็ว แม่นยำ ไม่ต้องพึ่งพา Express backend
- **ระบบสลับโมเดลอัตโนมัติ (Intelligent Model Fallback):** หากโมเดลใดโมเดลหนึ่งติด Quota (429) หรือเซิร์ฟเวอร์หนาแน่น (503) ระบบจะข้ามไปลองใช้โมเดลถัดไปทันที
- **Firestore Cloud Key Sync:** ซิงค์ Gemini API Key ลงคอลเลกชัน `app_settings/gemini_ai` ทำให้แอดมินทุกคนที่เปิดจากเครื่องใหม่หรือเบราว์เซอร์ใหม่สามารถใช้งาน OCR ได้ทันทีโดยไม่ต้องตั้งค่าเอง
- **GeminiKeyModal สำหรับ Owner:** สามารถกดทดสอบและบันทึกคีย์ผ่านหน้าเว็บ Vercel ได้โดยตรง โดยตรวจเช็กกับ Google Generative Language API ทันที

---

## 📂 แผนผังไฟล์สำคัญ (Key Files Map)
- `src/App.tsx`: ควบคุม Global State, Firestore Real-time Listeners, Modal Routing, และการจัดเก็บ Current User
- `src/components/MyStatsView.tsx`: หน้าระบบสเตตัสและการเติบโต (Kain7 Dashboard พร้อม Floating Pinned Proof)
- `src/components/StatComparisonModal.tsx`: หน้าต่าง Split-View เปรียบเทียบสเตตัสก่อนอนุมัติ
- `src/components/StatApprovalView.tsx` / `StatApprovalModal.tsx`: ระบบศูนย์อนุมัติสเตตัสของ Admin/Owner
- `src/components/PowerFormulaSettingsModal.tsx`: หน้าต่างตั้งค่าสูตรคำนวณ Power Level (PL)
- `src/components/BulkSwapClanModal.tsx`: หน้าต่างย้ายแคลนแบบกลุ่ม
- `src/components/OwnerResetModal.tsx`: ศูนย์รีเซ็ตระบบของ Owner
- `src/services/firebase.ts`: การเชื่อมต่อ Google Cloud Firestore (`users`, `vault_items`, `item_queues`, `clans`, ฯลฯ)
- `src/services/powerFormulaService.ts`: สูตรคำนวณค่าพลัง Power Level (PL)
- `src/types.ts`: โมเดลข้อมูลทั้งหมด (`User`, `UserRole`, `VaultItem`, `ClanGroup`, ฯลฯ)
- `src/translations.ts`: ระบบ 2 ภาษา (TH / EN) 100%

---

## ⚙️ คำสั่งสำหรับทดสอบและบิลด์ (Developer Commands)
```powershell
# ตรวจสอบ Type Safety
npx tsc --noEmit

# สร้าง Production Bundle
npm run build

# รันเซิร์ฟเวอร์ Local Development
npm run dev
```

---

## 💬 ข้อความตัวอย่างสำหรับ Copy ไปเริ่มในห้องแชทใหม่:
```
โปรดอ่านไฟล์ AI_CONTEXT.md และ PROJECT_HANDOVER.md ในโปรเจกต์นี้ทั้งหมดก่อนเริ่มงาน
ระบบปัจจุบันคือ Lineage2M Clan Hub & Boss Item Vault (v1.7.0)
- บัญชี Owner: Eloni (รหัสผ่าน 0386231334)
- Live URL: https://lineage2m-k7-item-vault.vercel.app/
- สถานะล่าสุด: ระบบสเตตัส Kain7 ได้รับการรีเซ็ตค่าสเตตัสสมาชิกทุกคนเพื่อรออัปเดตรอบใหม่, ซ่อนป้ายตัวคูณแล้ว, ซิงค์สูตรผ่าน Firestore แบบ Real-time, และรองรับ 2 ภาษา 100%
โปรดยืนยันว่าเข้าใจโครงสร้างระบบแล้ว พร้อมรับคำสั่งงานต่อไปครับ
```
