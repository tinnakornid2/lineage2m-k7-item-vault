# 📋 PROJECT HANDOVER & WORK CONTINUATION GUIDE
> **Lineage 2M Clan Hub & Boss Item Vault (Version: v2.0.0 — เวอร์ชั่นสมบูรณ์)**  
> **Last Updated:** 2026-09-16  
> **Repository:** `tinnakornid2/lineage2m-k7-item-vault`  
> **Live Web App:** [https://lineage2m-k7-item-vault.vercel.app/](https://lineage2m-k7-item-vault.vercel.app/)  
> **Master Architecture Guide:** [SYSTEM_ARCHITECTURE.md](file:///d:/K7%20item%20webapp/lineage2m-k7-item-vault%20%281%29/SYSTEM_ARCHITECTURE.md)

---

## 🎯 วัตถุประสงค์ของเอกสารนี้ (Purpose)
เอกสารนี้จัดทำขึ้นเพื่อให้ **AI Assistant ในห้องแชทใหม่ (New Chat Session)** หรือนักพัฒนาท่านอื่น สามารถเข้ามาอ่านและเริ่มทำงานต่อได้ทันที โดยเข้าใจสถาปัตยกรรม ฟีเจอร์ล่าสุด สถานะโค้ดปัจจุบัน และกฎเกณฑ์สำคัญของระบบอย่างครบถ้วน 100% **เพื่อป้องกันไม่ให้ไปแก้ไขส่วนอื่นโดยไม่จำเป็น**

---

## 🔑 ข้อมูลบัญชีและสิทธิ์สำคัญ (Credentials & Permissions)
1. **บัญชีเจ้าของระบบ (Owner Account):**
   - **Username:** `eloni` (หรือ `Eloni`)
   - **Authentication:** จัดการผ่าน Firebase Authentication; ห้ามบันทึกรหัสผ่านใน repository
   - **ID ในระบบ:** ตรงกับ Firebase Auth UID
   - **Role:** `owner` (มีระบบคุ้มครอง Immutable Protection ห้ามลดขั้นเป็น member)
   - **สิทธิ์:** เข้าถึงทุกฟังก์ชัน, ตั้งค่า Gemini AI Key, อนุมัติสเตตัส/สมาชิก, สลับบทบาทสมาชิก, ศูนย์รีเซ็ตระบบ, ปุ่มรีเซ็ตยอดเพชร
2. **ระดับสิทธิ์ผู้ใช้ (User Roles):**
   - `'owner'` : เจ้าของระบบ / หัวหน้ากิลด์สูงสุด
   - `'admin'` : ผู้ดูแลระบบ
   - `'manager'` : ผู้จัดการระบบ
   - `'party_leader'` : หัวหน้าปาร์ตี้ / 👑 Leader
   - `'member'` : สมาชิกทั่วไป

---

## 🏗️ ฟีเจอร์ล่าสุดในเวอร์ชันสมบูรณ์ v2.0.0 (What's New in v2.0.0)

### 1. ระบบแก้ไขไอเทมเปิดรับ (Edit Available Vault Items)
- เพิ่มคอมโพเนนต์ [`EditVaultItemModal.tsx`](file:///d:/K7%20item%20webapp/lineage2m-k7-item-vault%20%281%29/src/components/EditVaultItemModal.tsx)
- Admin และ Owner สามารถแก้ไขข้อมูลไอเทมที่เปิดรับได้ครบถ้วน:
  - ชื่อไอเทม (พร้อมระบบช่วยจำชื่อ Autocomplete)
  - จำนวนไอเทม (Quantity)
  - ราคาเพชร หรือกำหนดให้เป็นของฟรี (0 เพชร)
  - เกณฑ์พลังขั้นต่ำ (Min Power Level / PL)
  - ระดับความหายาก (Mythic, Legend, Epic, Rare)
  - เปลี่ยนรูปภาพไอเทม (เลือกไฟล์หรือกด Ctrl+V วางภาพ)
  - แก้ไขรายชื่อผู้ล่า (เพิ่ม/ลบรายบุคคล, ดึงจากสมาชิกกิลด์)
  - แนบ/ลบรูปภาพสลิปหลักฐานผู้ล่า

### 2. ระบบจดจำชื่อไอเทมที่เคยกรอก (Remember Item Names Autocomplete)
- บันทึกและดึงประวัติชื่อไอเทมจาก 3 แหล่งอัตโนมัติ: ไอเทมในคลัง, แม่แบบ Quick Items, และ `localStorage` (`l2m_recent_item_names`)
- แสดงป๊อปอัพรายชื่อตัวเลือกเมื่อคลิกช่องกรอกชื่อไอเทมทั้งในหน้าคลังและหน้าต่างแก้ไข

### 3. ระบบแนบรูปบิล/ใบเสร็จได้หลายใบต่อ 1 ไอเทม (Multiple Receipts/Bills Attachment)
- เพิ่มฟิลด์ `receiptImages?: string[]` รองรับรูปบิลหลายใบในไอเทมชิ้นเดียว
- หน้าต่างแจกจ่ายไอเทม [`DistributeItemModal.tsx`](file:///d:/K7%20item%20webapp/lineage2m-k7-item-vault%20%281%29/src/components/DistributeItemModal.tsx) รองรับการแนบสลิป/บิลก่อนแจก
- ตารางประวัติของที่แจกแล้วในหน้าคลังแสดงภาพ Thumbnails พร้อมป้าย `#1`, `#2`, ... และปุ่ม `+ แนบบิล` เพิ่ม/ลบรูปบิลย้อนหลังได้อย่างปลอดภัย พร้อมหน้าต่างซูมภาพขนาดใหญ่

### 4. ปรับปรุงกองทุนเพชรแคลนแบบ 1:1 เรียบง่าย (Simplified 1:1 Clan Fund)
- ป๊อปอัพกองทุนเพชร [`DiamondVaultModal.tsx`](file:///d:/K7%20item%20webapp/lineage2m-k7-item-vault%20%281%29/src/components/DiamondVaultModal.tsx) มี 2 ปุ่มหลัก: **"เพิ่มกองทุน" (Add Fund)** และ **"ถอนกองทุน" (Withdraw Fund)**
- นำช่องหักภาษีตลาด (%) ออกทั้งหมด เพิ่มและถอนตรงตามจำนวนเพชรจริงแบบ 1:1

### 5. รวมสูตรคำนวณยอดเพชรมาตรฐานกลาง (`diamondHelper.ts`)
- สร้างโมดูล [`diamondHelper.ts`](file:///d:/K7%20item%20webapp/lineage2m-k7-item-vault%20%281%29/src/utils/diamondHelper.ts) รวมฟังก์ชัน `computeTotalVaultBalance` และ `calculateDiamondNetChange`
- นำยอดฮาร์ดโค้ด 150,000 ออกจาก `App.tsx` ทำให้ Dashboard, Sidebar, และ Clan Fund Modal แสดงตัวเลขตรงกัน 100% โดยคำนวณจากประวัติธุรกรรมจริงเริ่มต้นจาก 0

### 6. ระบบปุ่มรีเซ็ตยอดกองทุนเพชรเฉพาะ Owner (Owner Balance Reset)
- เพิ่มปุ่ม **"รีเซ็ตยอด" (Reset Balance)** ติดป้าย Owner ในป๊อปอัพกองทุนเพชรแคลน
- รองรับ 2 รูปแบบ:
  1. `wipe`: ลบประวัติธุรกรรมทั้งหมดใน Firestore และเริ่มต้นยอดใหม่ที่ 0 เพชร (หรือกำหนดยอดตั้งต้นใหม่ได้)
  2. `adjust`: บันทึกรายการปรับยอด (Adjust) อัตโนมัติ เพื่อดึงยอดปัจจุบันเป็นยอดที่ต้องการทันทีโดยไม่ลบประวัติเดิม

### 7. ปลดล็อกระบบ Gemini AI OCR ให้ Admin/Manager ทุกคนใช้งานได้เต็มรูปแบบ
- ปรับปรุงสิทธิ์ Backend Route `/api/scan-hunters` และ `/api/gemini-status` ให้รับสิทธิ์ `['owner', 'admin', 'manager']`
- ซิงค์ Session Token และ ID Token ให้แอดมินทุกคนส่งรูปสแกน OCR หรือกด Ctrl+V วางรูปสแกนได้ทันทีโดยไม่ติด 403 Forbidden
- อัปเดตโมเดล AI บน Express Backend เป็น `gemini-3.6-flash` และ `gemini-flash-latest`

### 8. กฎเหล็กสองภาษา 100% (Rule 1: Bilingual Compliance)
- ทุกข้อความ ปุ่ม ตัวเลือก กล่องข้อความ และหน้าต่างโมดอลใหม่ทั้งหมด รองรับทั้ง **ไทย (TH)** และ **อังกฤษ (EN)** ครบถ้วน 100%

---

## 🔒 กฎการป้องกันโค้ดเสียหาย (Code Protection & Safety Rules)
> [!IMPORTANT]
> 1. **ห้ามเปลี่ยนโมเดล OCR:** คงชุดโมเดล `gemini-flash-latest`, `gemini-3.6-flash` ไว้เสมอ
> 2. **ห้ามลดสิทธิ์ Owner:** บัญชี `eloni` ต้องคงสิทธิ์สูงสุดเสมอ
> 3. **ห้ามละเมิดระบบ 2 ภาษา:** ทุกการเพิ่มโค้ดต้องรองรับ TH และ EN 100%
> 4. **Local First Rule:** ทดสอบบน `localhost:3000` ก่อน และห้ามรัน `git push` โดยไม่ได้รับคำสั่งยืนยัน

---

## 📂 แผนผังไฟล์สำคัญ (Key Files Map)
- `SYSTEM_ARCHITECTURE.md`: **แผนผังวิศวกรรมระบบแม่บทและคู่มือป้องกันโค้ดเสียหาย (Master Blueprint)**
- `src/App.tsx`: ควบคุม Global State, Firestore Real-time Listeners, Modal Routing, และยอดเพชรกลาง
- `src/utils/diamondHelper.ts`: โมดูลคำนวณยอดเพชรและ Net Change ทุกประเภทรายการ
- `src/components/EditVaultItemModal.tsx`: หน้าต่างแก้ไขไอเทมเปิดรับ
- `src/components/DistributeItemModal.tsx`: หน้าต่างแจกจ่ายไอเทมพร้อมแนบรูปบิล
- `src/components/DiamondVaultModal.tsx`: หน้าต่างกองทุนเพชรแคลนและระบบรีเซ็ตยอดของ Owner
- `src/components/VaultView.tsx`: คลังไอเทมบอส, OCR สแกนชื่อผู้ล่า, ตารางของที่แจกแล้ว
- `src/components/DashboardView.tsx`: แดชบอร์ดภาพรวม, กล่องเพชรกลาง, รายการของรอเคลม
- `src/components/MyStatsView.tsx`: หน้าระบบสเตตัสและการเติบโต
- `src/services/firebase.ts`: การเชื่อมต่อ Cloud Firestore
- `src/types.ts`: โมเดลข้อมูลทั้งหมด
- `src/translations.ts`: ระบบ 2 ภาษา (TH / EN) 100%

---

## ⚙️ คำสั่งสำหรับทดสอบและบิลด์ (Developer Commands)
```powershell
# ตรวจสอบ Type Safety
& 'C:\Users\tinna\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\typescript\bin\tsc' --noEmit

# สร้าง Production Bundle
& 'C:\Users\tinna\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vite\bin\vite.js' build

# รันเซิร์ฟเวอร์ Local Development
& 'C:\Users\tinna\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\tsx\dist\cli.mjs' server.ts
```

---

## 💬 ข้อความตัวอย่างสำหรับ Copy ไปเริ่มในห้องแชทใหม่:
```
โปรดอ่านไฟล์ SYSTEM_ARCHITECTURE.md, AI_CONTEXT.md และ PROJECT_HANDOVER.md ในโปรเจกต์นี้ทั้งหมดก่อนเริ่มงาน
ระบบปัจจุบันคือ Lineage2M Clan Hub & Boss Item Vault (v2.0.0 - เวอร์ชั่นสมบูรณ์)
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
