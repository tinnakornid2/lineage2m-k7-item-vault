# 📋 PROJECT HANDOVER & WORK CONTINUATION GUIDE
> **Lineage 2M Clan Hub & Boss Item Vault (Version: v2.1.0 — อัปเดตล่าสุด)**  
> **Last Updated:** 2026-09-16  
> **Repository:** `tinnakornid2/lineage2m-k7-item-vault`  
> **Live Web App:** [https://lineage2m-k7-item-vault.vercel.app/](https://lineage2m-k7-item-vault.vercel.app/)  
> **Master Architecture Guide:** [SYSTEM_ARCHITECTURE.md](file:///d:/Anti%20webapp/SYSTEM_ARCHITECTURE.md)  
> **AI Quick Context:** [AI_CONTEXT.md](file:///d:/Anti%20webapp/AI_CONTEXT.md)

---

## 🎯 วัตถุประสงค์ของเอกสารนี้ (Purpose)
เอกสารนี้จัดทำขึ้นเพื่อให้ **AI Assistant ในห้องแชทใหม่ (New Chat Session)** หรือนักพัฒนาท่านอื่น สามารถเข้ามาอ่านและเริ่มทำงานต่อได้ทันที โดยเข้าใจสถาปัตยกรรม ฟีเจอร์ล่าสุด สถานะโค้ดปัจจุบัน และกฎเกณฑ์สำคัญของระบบอย่างครบถ้วน 100% **โดยไม่ต้องไล่อ่านโค้ดใหม่ทั้งหมด และป้องกันไม่ให้เกิดการแก้ไขส่วนอื่นที่ทำงานสมบูรณ์แล้ว**

---

## 🔑 ข้อมูลบัญชีและสิทธิ์สำคัญ (Credentials & Permissions)
1. **บัญชีเจ้าของระบบ (Owner Account):**
   - **Username:** `eloni` (หรือ `Eloni`)
   - **Authentication:** จัดการผ่าน Firebase Authentication; ห้ามฮาร์ดโค้ดรหัสผ่านในโค้ด
   - **ID ในระบบ:** ตรงกับ Firebase Auth UID (`currentUser.id`)
   - **Role:** `owner` (มีระบบคุ้มครอง Immutable Protection ห้ามลดขั้นเป็น member)
   - **สิทธิ์สูงสุด:** เข้าถึงทุกฟังก์ชัน, ตั้งค่า Gemini AI Key, ตั้งค่า Discord Webhook/Role ID, อนุมัติสเตตัส/สมาชิก, สลับบทบาทสมาชิก, ศูนย์รีเซ็ตระบบ, ปุ่มรีเซ็ตยอดเพชร
2. **ระดับสิทธิ์ผู้ใช้ (User Roles):**
   - `'owner'` : เจ้าของระบบ / หัวหน้ากิลด์สูงสุด
   - `'admin'` : ผู้ดูแลระบบ
   - `'manager'` : ผู้จัดการระบบ
   - `'party_leader'` : หัวหน้าปาร์ตี้ / 👑 Leader
   - `'member'` : สมาชิกทั่วไป

---

## 🏗️ ฟีเจอร์ล่าสุดในเวอร์ชัน v2.1.0 (What's New in v2.1.0)

### 1. ปรับขนาดหน้าจออัตโนมัติ ตามขนาดหน้าต่างบราวเซอร์ (Fluid Dynamic Responsive Scaling)
- ไฟล์ที่เกี่ยวข้อง: [`src/App.tsx`](file:///d:/Anti%20webapp/src/App.tsx)
- ปรับเปลี่ยนโครงสร้าง Layout คอนเทนเนอร์หลักจากเดิมที่จำกัด `max-w-[1720px]` และ padding กว้างเกินไป ให้กลายเป็น Fluid Layout เต็มความกว้าง:
  ```tsx
  <main className="flex-1 w-full max-w-full 2xl:max-w-[1920px] mx-auto px-2.5 sm:px-4 md:px-6 lg:px-7 py-3 sm:py-5 min-w-0 transition-all">
  ```
- รองรับการย่อ/ขยายหน้าต่างแบบ Real-time, แบ่งหน้าจอครึ่งบราวเซอร์ (Split-Screen 50:50), หน้าจอแล็ปท็อป, มอนิเตอร์มาตรฐาน และจอ Ultrawide 2K/4K อย่างสวยงาม ไม่ล้นจอ และไม่อัดแน่นเกินไป

### 2. ระบบจำหน้าเดิมเมื่อกดรีเฟรชหรือใช้ปุ่มย้อนกลับ (Tab State & URL Hash Persistence)
- ไฟล์ที่เกี่ยวข้อง: [`src/App.tsx`](file:///d:/Anti%20webapp/src/App.tsx), [`src/components/Sidebar.tsx`](file:///d:/Anti%20webapp/src/components/Sidebar.tsx)
- รองรับ URL Hash เช่น `#vault`, `#queue`, `#distribution`, `#all_members`, `#stats`, `#gemini_settings`, `#system_reset` ร่วมกับ `localStorage` (`l2m_active_tab`)
- เมื่อผู้ใช้กดปุ่ม F5 Refresh ในบราวเซอร์ หรือกด Back/Forward หน้าเว็บจะคงอยู่ที่หน้าที่กำลังเปิดใช้งาน ไม่เด้งกลับไปหน้า Dashboard

### 3. จัดกล่องไอเทมเปิดรับแถวละ 4 ชิ้น (Available Items 4-Columns Grid)
- ไฟล์ที่เกี่ยวข้อง: [`src/components/DashboardView.tsx`](file:///d:/Anti%20webapp/src/components/DashboardView.tsx)
- ปรับ Grid Layout ของกล่องไอเทมเปิดรับบนหน้า Dashboard ให้แสดงเป็นแถวละ 4 ชิ้นบนจอ Desktop:
  ```tsx
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-3.5">
  ```
- ย่อขยายตาม Responsive Breakpoints ได้ราบรื่น (มือถือ 1 คอลัมน์, แท็บเล็ต 2-3 คอลัมน์, เดสก์ท็อป 4 คอลัมน์)

### 4. การ์ดไอเทมเปิดรับแบบกะทัดรัด 2 บรรทัด (Compact 2-Line Item Cards beside Thumbnail)
- ไฟล์ที่เกี่ยวข้อง: [`src/components/DashboardView.tsx`](file:///d:/Anti%20webapp/src/components/DashboardView.tsx)
- ปรับการ์ดไอเทมเปิดรับแต่ละชิ้น ให้มีความสูงกะทัดรัด ตัวหนังสือข้างรูป Thumbnail จัดเป็น 2 บรรทัดชัดเจน:
  - **บรรทัดที่ 1:** ชื่อไอเทม (ตัวหนา เด่นชัด ตัดข้อความยาวด้วย truncate พร้อมเงาสีตามเกรด) + ป้ายระดับความหายาก (Mythic, Legend, Epic, Rare)
  - **บรรทัดที่ 2:** ราคาเพชร (หรือป้าย FREE) + เกณฑ์พลังขั้นต่ำ (Min PL) + จำนวนผู้ลงชื่อเคลม
- ปุ่ม Action (ลงชื่อขอรับ, ยกเลิก, แก้ไข, แจกจ่าย, ลบ) จัดเรียงอย่างเป็นสัดส่วนไม่กินพื้นที่

### 5. ปรับแต่งการแท็กแจ้งเตือน Discord ตาม Role ID / @everyone / ไม่แท็ก (Discord Role Mentions)
- ไฟล์ที่เกี่ยวข้อง:
  - [`src/components/DiscordWebhookModal.tsx`](file:///d:/Anti%20webapp/src/components/DiscordWebhookModal.tsx)
  - [`src/utils/discord.ts`](file:///d:/Anti%20webapp/src/utils/discord.ts)
  - [`src/types.ts`](file:///d:/Anti%20webapp/src/types.ts)
  - [`server.ts`](file:///d:/Anti%20webapp/server.ts)
- Owner สามารถเข้าเมนูตั้งค่า Discord Webhook และเลือกรูปแบบการแท็กได้ 3 แบบ:
  1. `@everyone` (แท็กทุกคนในเซิร์ฟเวอร์)
  2. `Role ID` (ระบุ Discord Role ID เฉพาะ เช่น `123456789012345678` หรือวาง `<@&123456789012345678>`)
  3. `none` (ไม่แท็กใคร ส่งเฉพาะการ์ดข้อความ)
- จัดเก็บลง Firestore ที่ `discordSettings.mentionType` และ `discordSettings.mentionRoleId`
- ปรับแต่ง `allowed_mentions` ในเซิร์ฟเวอร์ Proxy ให้ Discord API อนุญาตให้แท็ก Role ID ได้อย่างถูกต้อง

### 6. ส่งแจ้งเตือน Discord อัตโนมัติเมื่อมีการลงไอเทมใหม่ (Auto Notify on New Vault Items)
- ทั้ง Admin และ Owner เมื่อเพิ่มไอเทมใหม่เข้าคลัง ระบบจะส่งข้อความ Embed การ์ดไอเทมใหม่ไปยังห้อง Discord ที่ตั้งค่าไว้โดยอัตโนมัติ พร้อมแท็ก Role ID หรือ @everyone ตามที่ตั้งค่าไว้
- ข้อความแจ้งเตือน Discord กำหนดเป็นภาษาอังกฤษสากลมาตรฐาน ส่วน UI การตั้งค่าในเว็บเป็น 2 ภาษา (TH/EN) 100%

---

## 📜 ฟีเจอร์หลักก่อนหน้าจาก v2.0.0 ที่คงอยู่อย่างสมบูรณ์ (Inherited Core Features)
1. **ระบบแก้ไขไอเทมเปิดรับ (`EditVaultItemModal.tsx`):** แก้ไขชื่อ, จำนวน, ราคาเพชร/ฟรี, เกณฑ์พลัง, รูปภาพ, และรายชื่อผู้ล่า
2. **ระบบจดจำชื่อไอเทมที่เคยกรอก (Item Names Autocomplete):** บันทึกจากคลัง, แม่แบบด่วน, และ LocalStorage
3. **ระบบแนบรูปบิลหลายใบต่อ 1 ไอเทม (`receiptImages`):** สำหรับของที่แจกแล้ว พร้อมแกลเลอรีซูมและจัดการรูปบิล
4. **กองทุนเพชรแคลนแบบ 1:1 (`DiamondVaultModal.tsx` & `diamondHelper.ts`):** ฝาก-ถอนตรงตามจริง ไม่หักภาษี พร้อมปุ่ม Reset Balance เฉพาะ Owner
5. **ระบบสแกน OCR ผู้ล่าด้วย AI (Google Gemini AI):** Admin และ Owner ทุกคนใช้งานได้ สแกนรูปปาร์ตี้บอสตัดชื่อซ้ำอัตโนมัติ

---

## 🔒 กฎเหล็กและการป้องกันโค้ดเสียหาย (Core Engineering Rules)

> [!IMPORTANT]
> 1. **กฎเหล็กสองภาษา 100% (Rule 1: Bilingual Compliance):**
>    - ทุก UI, หัวข้อ, คำอธิบาย, ป้าย, Dropdown, ปุ่มกด, ช่อง Input/Placeholder, Alert และ Toast ต้องรองรับ **ไทย (TH)** และ **อังกฤษ (EN)** เสมอ
>    - ห้าม Hardcode ภาษาเดียวในหน้าจอเด็ดขาด
> 2. **กฎการทดสอบ Local First (Rule 2):**
>    - ต้องทดสอบบน `http://localhost:3000` และรัน Typecheck (`tsc --noEmit`) และ Build (`vite build`) ให้ผ่าน 0 error ก่อนเสมอ
>    - ห้ามรัน `git push` จนกว่าผู้ใช้งานจะพิมพ์สั่งยืนยันให้อัปโหลดโดยตรง
> 3. **กฎการเรียก Node บน Windows (Rule 4):**
>    - ห้ามรันคำว่า `npm` โดดๆ บน Windows ให้ใช้ `C:\Program Files\nodejs\node.exe` หรือรันผ่าน npx/node entrypoint
> 4. **การรักษาความปลอดภัยและสิทธิ์ Owner:**
>    - บัญชี `eloni` คือ Owner สูงสุด ห้ามลดสิทธิ์ และปุ่มรีเซ็ตระบบ/คีย์ Gemini ต้องเปิดให้เฉพาะ Owner เท่านั้น

---

## 📂 แผนผังไฟล์สำคัญในโปรเจกต์ (Key Files Architecture)

```
d:/Anti webapp/
├── package.json                   # เวอร์ชั่น v2.1.0 และ dependencies
├── server.ts                      # Express Backend (Local API + Proxy Discord/Gemini)
├── src/
│   ├── App.tsx                    # ตัวควบคุมหลัก: Responsive Container, Tab Routing, Firestore Real-time Listeners
│   ├── types.ts                   # Types กลาง (User, VaultItem, DiscordSettings, ฯลฯ)
│   ├── translations.ts            # พจนานุกรม 2 ภาษา (TH / EN)
│   ├── services/
│   │   ├── firebase.ts            # Firestore Listeners & Database Operations
│   │   └── gemini.ts              # Gemini AI OCR Client
│   ├── utils/
│   │   ├── discord.ts             # Discord Webhook formatting & Role Mentions
│   │   ├── diamondHelper.ts       # ยอดคำนวณเพชรส่วนกลาง
│   │   └── sound.ts               # ระบบเสียงประกอบ Web Audio API
│   └── components/
│       ├── DashboardView.tsx      # แดชบอร์ดภาพรวม, ไอเทมเปิดรับ 4 คอลัมน์ 2 บรรทัด
│       ├── VaultView.tsx          # คลังไอเทมบอส, สแกน OCR, รายการของที่แจกแล้ว
│       ├── EditVaultItemModal.tsx # หน้าต่างแก้ไขไอเทมเปิดรับ
│       ├── DistributeItemModal.tsx# หน้าต่างแจกจ่ายไอเทมพร้อมแนบรูปบิล
│       ├── DiamondVaultModal.tsx  # กองทุนเพชร 1:1 และปุ่มรีเซ็ตยอดของ Owner
│       ├── DiscordWebhookModal.tsx# ตั้งค่า Webhook URL และ Role ID Mention
│       ├── Sidebar.tsx            # เมนูด้านข้างและแท็บนำทาง
│       ├── Navbar.tsx             # แถบเมนูด้านบน สลับภาษา และยอดเพชร
│       └── LoginScreen.tsx        # หน้าจอล็อกอินพร้อมระบบสเตตัสเริ่มต้น
```

---

## ⚙️ คำสั่งสำหรับทดสอบและบิลด์ (Verification Commands)

```powershell
# 1. ตรวจสอบ Typecheck
& 'C:\Program Files\nodejs\node.exe' 'node_modules\typescript\bin\tsc' --noEmit

# 2. ทดสอบสร้าง Production Bundle
& 'C:\Program Files\nodejs\node.exe' 'node_modules\vite\bin\vite.js' build

# 3. รัน Dev Server (Localhost)
& 'C:\Program Files\nodejs\node.exe' 'node_modules\tsx\dist\cli.mjs' server.ts
```

---

## 💬 ข้อความตัวอย่างสำหรับ Copy ไปเริ่มในห้องแชทใหม่:

```
โปรดอ่านไฟล์ SYSTEM_ARCHITECTURE.md, AI_CONTEXT.md และ PROJECT_HANDOVER.md ในโปรเจกต์นี้ทั้งหมดก่อนเริ่มงาน
ระบบปัจจุบันคือ Lineage2M Clan Hub & Boss Item Vault (v2.1.0 — อัปเดตล่าสุด)
- บัญชี Owner: Eloni (สิทธิ์ Owner สูงสุด)
- Live Production: https://lineage2m-k7-item-vault.vercel.app/
- สถานะระบบล่าสุด (v2.1.0):
  1. หน้าจอ Fluid Responsive ปรับขนาดตามหน้าต่างบราวเซอร์อัตโนมัติ (App.tsx)
  2. ระบบจดจำ Tab ผ่าน URL Hash (#vault, #queue, ฯลฯ) รีเฟรชแล้วอยู่หน้าเดิม
  3. กล่องไอเทมเปิดรับแสดงผลแถวละ 4 ชิ้นบนเดสก์ท็อป (DashboardView.tsx)
  4. การ์ดไอเทมกะทัดรัดจัดระเบียบ 2 บรรทัดติดรูป Thumbnail
  5. ระบบ Discord Webhook ปรับแต่งการแท็กได้ (Role ID, @everyone, หรือไม่แท็ก)
  6. ส่งแจ้งเตือน Discord อัตโนมัติเมื่อ Admin/Owner ลงไอเทมใหม่
  7. ระบบ 2 ภาษา TH/EN 100% ทุกจุด
  8. Typecheck และ Vite Build ผ่าน 0 errors
โปรดยืนยันว่าเข้าใจสถาปัตยกรรมและกฎการป้องกันโค้ดเสียหายแล้ว พร้อมรับคำสั่งงานต่อไปครับ
```
