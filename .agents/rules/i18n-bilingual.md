# Mandatory Bilingual Requirement (รองรับ 2 ภาษา TH & EN เสมอ)

## กฎเหล็กสำหรับการแก้ไขและพัฒนาโค้ด (Mandatory Rule for All Future AI & Chats)

1. **รองรับ 2 ภาษาทุกจุด 100% (Dual-Language Requirement):**
   - ทุกหน้าจอ, ทุกปุ่ม, ทุกข้อความแจ้งเตือน (Toast/Alert), กล่องข้อความ (Modal), ป้ายระบุ (Badge), Tooltip และ Placeholder **ต้องรองรับ 2 ภาษาเสมอ** คือ **ภาษาไทย ('th')** และ **ภาษาอังกฤษ ('en')**
   - ห้าม Hardcode ข้อความภาษาใดภาษาหนึ่งโดยไม่มีการสลับตาม `lang` prop หรือ `translations[lang]`
   - การเพิ่มข้อความใหม่ต้องเพิ่มทั้งในส่วนภาษาไทย (`th`) และภาษาอังกฤษ (`en`) ในไฟล์ `src/translations.ts` พร้อมกันเสมอ
   - ตัวอย่างการเขียน:
     ```tsx
     // ใช้ translations
     <span>{t.someNewKey}</span>

     // หรือใช้ conditional ตาม lang
     <span>{lang === 'th' ? 'ข้อความภาษาไทย' : 'English text'}</span>
     ```

2. **สิทธิ์การมองเห็นและการใช้งานปุ่ม Gemini AI (Gemini AI Key Owner-Only Rule):**
   - ปุ่มตั้งค่า/เชื่อมต่อ **Gemini AI OCR Key** ในหน้าคลัง (`VaultView.tsx`), ในแถบเมนูด้านข้าง (`Sidebar.tsx`), และในหน้าต่างตั้งค่า (`GeminiKeyModal.tsx`) **ต้องมองเห็นและใช้งานได้เฉพาะผู้ใช้ที่เป็น Owner เท่านั้น** (`currentUser?.role === 'owner'` หรือ `isOwner === true`)
   - สมาชิกทั่วไป (Member) หรือ ผู้ดูแล (Admin/Manager) จะต้องไม่เห็นปุ่มนี้ หรือไม่สามารถแก้ไข API Key ได้

3. **ผลการสแกนผู้ล่า (OCR Scan Results):**
   - ต้องรองรับการสลับมุมมองระหว่างแบบการ์ด (`Cards View`) และแบบข้อความ (`Text View`) เสมอ
   - ต้องมีปุ่มคัดลอกรายชื่อทั้งหมด (`Copy All`) ลงคลิปบอร์ดได้สะดวก

4. **การเลือกคนล่า (Hunter Selection):**
   - มีระบบ Checklist แสดงรายชื่อสมาชิกทั้งหมดพร้อมช่องติ๊กเลือก (`Checkbox`)
   - มีระบบค้นหา (`Search`) และกรองตามแคลน (`Clan Filter`)
   - มีปุ่มเลือกทั้งหมด (`Select All`) และล้างที่เลือก (`Deselect All`)
