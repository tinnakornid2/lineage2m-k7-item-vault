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

## 4. การเรียก Node บน Windows (ห้ามเกิดป๊อปอัป `Select an app to open 'npm'`)

- ในเครื่องนี้ **ห้ามเรียก `npm` แบบชื่อเปล่า** เช่น `npm run build`, `npm run lint` หรือ `npm audit` เพราะ Windows อาจตีความ `npm` เป็น protocol/file และเปิดหน้าต่างถามเลือกแอป
- ห้ามเปลี่ยนไปใช้ `pnpm` กับ `node_modules` เดิมโดยตรง เพราะ dependency ชุดนี้ติดตั้งด้วย npm และ pnpm อาจย้ายแพ็กเกจไป `node_modules/.ignored`
- ให้ตรวจตำแหน่ง runtime จาก Codex Workspace Dependencies ก่อน แล้วเรียก Node ด้วย absolute path
- สำหรับคำสั่งทดสอบที่มี JavaScript entrypoint ให้ใช้รูปแบบนี้:

  ```powershell
  & 'C:\Users\tinna\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\typescript\bin\tsc' --noEmit
  & 'C:\Users\tinna\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vite\bin\vite.js' build
  ```

- หากต้องใช้ npm จริง ให้ค้นหาและเรียก `npm.cmd` หรือ `npm-cli.js` ด้วย absolute path ที่ตรวจสอบแล้วเท่านั้น ห้ามเดาพาธและห้ามใช้คำว่า `npm` เดี่ยว ๆ

---

## 5. กฎมาตรฐานการแจ้งเตือน Discord (Discord Webhook Rules)

**ข้อกำหนดภาคบังคับสำหรับระบบ Discord Webhook:**
1. **ขอบเขตการแจ้งเตือน (Item-Only Notifications):**
   - ส่งแจ้งเตือน Discord **เฉพาะฟังก์ชันที่เกี่ยวกับไอเทมเท่านั้น** (`new_item` เมื่อมีไอเทมใหม่เข้าคลัง/ประกาศไอเทม, `distribute` เมื่อแจกไอเทม, และ `test` เมื่อกดปุ่มทดสอบ Webhook ในหน้าตั้งค่า)
   - **ห้าม** ส่งแจ้งเตือน Discord สำหรับฟังก์ชันอื่น ๆ เช่น คำขออัปเดตสเตตัส (`stat_request`) หรือการอนุมัติสเตตัส (`stat_approval`)

2. **ข้อความ Discord ต้องเป็นภาษาอังกฤษ 100% (Mandatory English 100% for Discord):**
   - ข้อความทั้งหมดที่ส่งเข้าห้อง Discord (Headers, Titles, ANSI Code Blocks, Fields, Footers, Links) **ต้องเป็นภาษาอังกฤษ 100% เสมอ** (ห้ามส่งข้อความภาษาไทยเข้าช่อง Discord)
   - สำหรับ UI ภายในเว็บแอพ (หน้าจอตั้งค่า ปุ่มกด และ Modal) ยังคงใช้ระบบสองภาษา TH/EN ตามกฎข้อ 1 แต่ตัวข้อความ Discord และ Live Preview แสดงผลเป็นภาษาอังกฤษ 100%

3. **รูปแบบข้อความไอเทมใหม่ (บังคับใช้แบบที่ 1 สั้นกระชับ + ฟอนต์ ANSI มีสี + รูปขวาบน):**
   - ทุกคนที่จะแก้ไขระบบ Discord ต้องรักษา **แบบที่ 1 (Option 1)** ไว้เสมอ ห้ามเปลี่ยนเป็นแบบอื่นหรือเพิ่ม fields ยาวเกินไป
   - **ห้ามใส่ Title ซ้ำซ้อน (Strictly No Duplicate Title):** ในการ์ด Embed ของไอเทมใหม่ (`new_item`) ห้ามใส่ฟิลด์ `title: ⚔️ [RARITY] <Item Name>` เพราะจะซ้ำกับบรรทัดที่ 1 ของกรอบ ANSI ที่มีสีประจำระดับอยู่แล้ว ให้ปล่อยหัวการ์ดเริ่มด้วยกรอบ ANSI ทันที
   - **ตัดบรรทัดคนล่าออกถาวร (Completely Remove Hunters Line):** ไม่ต้องแสดงรายชื่อคนล่า (`⚔️ Hunters:`) ในข้อความ Discord ตัดออก 100% เพื่อให้ข้อความสั้นกระชับที่สุด
   - **โครงสร้างข้อความในกรอบ ANSI Code Block (ภาษาอังกฤษ - มีเพียง 2 บรรทัดเท่านั้น):**
     - **บรรทัดที่ 1:** `[RARITY] <Item Name> (xQty)` — ใช้สี ANSI ตามระดับความหายาก (🟨 MYTHIC ทอง, 🪻/🟪 LEGEND ม่วง, 🟥 EPIC แดง, 🟦 RARE ฟ้า)
     - **บรรทัดที่ 2:** `💎 Price: X Diamonds` (หรือ `Price: FREE (0 Diamonds)`) — ใช้สีขาวสว่าง (`\u001b[1;37m`)
   - **บรรทัดลิงก์เคลม:** `👉 [Open Vault to Claim Item](url)` (ภาษาอังกฤษ)
   - **รูปภาพไอเทมจริง (Thumbnail):** ต้องแสดงรูปไอเทมจริงที่อัปโหลด/ใส่ URL ไว้ที่มุมขวาบนของการ์ด Discord (ห้ามนำรูปไอคอนตัวอย่างมาทับเด็ดขาด)
   - **ข้อความแจ้งผลการแจกไอเทม (Distribution):** ใช้ภาษาอังกฤษ 100% (`🏆 Item Distribution Result!`, `Congratulations to **Name** of **Clan**, who received this item!`, ฟิลด์ Recipient, Rarity, Item Value, Distributed by)

