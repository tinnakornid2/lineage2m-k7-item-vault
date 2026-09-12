# Workspace Rules & Guidelines for Lineage2M Clan Hub

## 1. กฎเหล็ก: ระบบสองภาษา 100% ทุกการแก้ไข (Mandatory Bilingual TH & EN)

**สำคัญมาก:** ทุกครั้งที่มีการแก้ไข, เพิ่มเติมฟีเจอร์, สร้าง Component ใหม่ หรือปรับปรุง UI ในโปรเจ็คนี้ **ต้องมีระบบสองภาษา (ไทย และ อังกฤษ) รองรับเสมอ 100%** ห้าม Hardcode ภาษาใดภาษาหนึ่งเป็นอันขาด

### ข้อกำหนดภาคบังคับ:
1. **องค์ประกอบ UI ทุกจุดต้องมี 2 ภาษา:**
   - หัวข้อ (Headers), คำอธิบาย (Subtitles / Descriptions)
   - ป้ายระบุ (Badges / Tags), ตัวเลือก (Options / Dropdowns)
   - ปุ่มกด (Buttons), ข้อความกำกับ (Tooltips)
   - กล่องข้อความ (Inputs, Placeholders, Textareas)
   - ข้อความแจ้งเตือน (Toast Notifications, Alerts, Error Messages)
   - เหตุผลสำเร็จรูป (Quick Presets เช่น Rejection reasons, Quick filter tags)
   - วันที่และเวลา: ใช้ `new Date(...).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')` พร้อมคำสำรองสองภาษา เช่น `lang === 'th' ? 'เมื่อสักครู่' : 'Just now'`

2. **รูปแบบการเขียนโค้ด:**
   ```tsx
   // แบบที่ 1: ใช้ translations dictionary
   <span>{t.appTitle}</span>

   // แบบที่ 2: ใช้ conditional ตาม lang prop
   <span>{lang === 'th' ? 'ข้อความภาษาไทย' : 'English message'}</span>

   // แบบที่ 3: อาร์เรย์หรือชุดตัวเลือก (Presets / Reasons)
   const QUICK_PRESETS: Record<'th' | 'en', string[]> = {
     th: ['ตัวเลือกที่ 1', 'ตัวเลือกที่ 2'],
     en: ['Option 1', 'Option 2']
   };
   ```

3. **ห้ามเกิดกรณีภาษาผสมกันในหน้าเดียวกัน:**
   - เมื่อผู้ใช้เลือกภาษาอังกฤษ (`lang === 'en'`) ข้อมูลปุ่ม, ตัวเลือก และกล่องข้อความทั้งหมดต้องแสดงเป็นภาษาอังกฤษ
   - เมื่อผู้ใช้เลือกภาษาไทย (`lang === 'th'`) ข้อมูลทั้งหมดต้องแสดงเป็นภาษาไทย

---

## 2. กฎการ Deploy และ Git (Local First Rule)
- ทุกการแก้ไขต้องทำและทดสอบบนเครื่อง Local ก่อนเท่านั้น (`http://localhost:3000`)
- **ห้าม** รันคำสั่ง `git push` หรือ deploy ขึ้น Vercel (`vercel --prod`) จนกว่าผู้ใช้งานจะพิมพ์สั่งยืนยันให้อัปโหลดอย่างชัดเจน

---

## 3. สิทธิ์และการอนุมัติค่าพลัง (Security & Permissions)
- **Gemini AI OCR Key:** ปุ่มตั้งค่า API Key ต้องมองเห็นและแก้ไขได้เฉพาะ `Owner` เท่านั้น
- **การอนุมัติสเตตัส (Stat Approvals):** เมื่อสมาชิกส่งการแก้ไขสเตตัส ตัวเลขจะอยู่ในสถานะ `Pending` เท่านั้น ค่าพลังจริง (`Verified Power`) จะอัปเดตต่อเมื่อ Admin หรือ Owner ตรวจสอบเทียบกับภาพสกรีนช็อตและกดยืนยันอนุมัติแล้ว

---

## 4. กฎการแยกอิสระของหน้าเวลาบอส (Boss Time Complete Isolation Rule)
- **ระบบแยกอิสระ 100%:** ระบบเวลาบอส (Boss Time / Boss Tracker) ไม่ผูกกับระบบสมาชิก, สิทธิ์ (Role), หรือข้อมูลของ Clan Hub ใดๆ ทั้งสิ้น โดยระบบเวลาบอสจะใช้ระบบรหัสผ่านและ PIN (`4321`) ของตัวเองโดยเฉพาะ
- **ขอบเขตการแก้ไขโค้ดที่อนุญาต:** ทุกการแก้ไขหรือเพิ่มเติมต่อจากนี้ ให้ดำเนินการเฉพาะไฟล์ในส่วนของหน้าเวลาบอสเท่านั้น ได้แก่:
  - `src/components/BossTimeView.tsx`
  - `boss_server/` (เช่น `boss_server/index.js`, `boss_server/data/store.json`, `boss_server/routes/` ฯลฯ)
  - `public/build/`
  - **ห้ามแตะต้องหรือกระทบไฟล์ระบบหลักของ Clan Hub โดยเด็ดขาด** (เช่น คลังเพชร/ไอเทม `VaultView`, สมาชิก `MembersView`, จัดการแคลน `ClanView`, คิวไอเทม `QueueView`, คำนวณพลัง `MyStatsView`, อนุมัติพลัง `StatApprovalView`, `DashboardView` ฯลฯ)

