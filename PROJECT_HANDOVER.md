# 📋 PROJECT HANDOVER & WORK CONTINUATION GUIDE
> **Lineage 2M Clan Hub & Boss Item Vault (Version: v2.3.0 — อัปเดตล่าสุด)**  
> **Last Updated:** 2026-09-16  
> **Repository:** `tinnakornid2/lineage2m-k7-item-vault`  
> **Live Web App:** [https://lineage2m-k7-item-vault.vercel.app/](https://lineage2m-k7-item-vault.vercel.app/)  
> **Master Architecture Guide:** [SYSTEM_ARCHITECTURE.md](file:///d:/Anti%20webapp/SYSTEM_ARCHITECTURE.md)  
> **AI Quick Context:** [AI_CONTEXT.md](file:///d:/Anti%20webapp/AI_CONTEXT.md)  
> **System Manual:** [SYSTEM_MANUAL_v2.3.0.md](file:///d:/Anti%20webapp/SYSTEM_MANUAL_v2.3.0.md)

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
   - **สิทธิ์สูงสุด:** เข้าถึงทุกฟังก์ชัน, ตั้งค่า Gemini AI Key, ตั้งค่า Discord Webhook/Role ID/Templates, อนุมัติสเตตัส/สมาชิก, สลับบทบาทสมาชิก, ศูนย์รีเซ็ตระบบ, ปุ่มรีเซ็ตยอดเพชร
2. **ระดับสิทธิ์ผู้ใช้ (User Roles):**
   - `'owner'` : เจ้าของระบบ / หัวหน้ากิลด์สูงสุด
   - `'admin'` : ผู้ดูแลระบบ
   - `'manager'` : ผู้จัดการระบบ
   - `'party_leader'` : หัวหน้าปาร์ตี้ / 👑 Leader
   - `'member'` : สมาชิกทั่วไป

---

## 🏗️ ฟีเจอร์ล่าสุดในเวอร์ชัน v2.3.0 (What's New in v2.3.0)

### 1. ฟอนต์ราคาไอเทม Discord สีขาว ANSI (`\u001b[1;37m`)
- ไฟล์ที่เกี่ยวข้อง: [`src/utils/discord.ts`](file:///d:/Anti%20webapp/src/utils/discord.ts), [`src/components/DiscordBroadcastModal.tsx`](file:///d:/Anti%20webapp/src/components/DiscordBroadcastModal.tsx), [`src/components/DiscordWebhookModal.tsx`](file:///d:/Anti%20webapp/src/components/DiscordWebhookModal.tsx)
- เปลี่ยนสีตัวอักษรของราคาเพชร `Price: FREE (0 Diamonds)` หรือราคาเพชรอื่น ๆ จากเดิมสีเขียว เป็น **สีขาวเรืองแสง (`\u001b[1;37m`)**
- ปรับใช้ครบทั้ง 4 แม่แบบข้อความ (`neon_glow`, `war_horn`, `clan_market`, `crystal_minimal`)
- ปรับแต่ง Live Preview ใน UI ให้แสดงเป็นสีขาว (`text-white`) ตรงกัน 100%

### 2. บันทึก Discord Webhook และ Gemini OCR Key ถาวรข้ามแอดมิน (Shared Persistence)
- ไฟล์ที่เกี่ยวข้อง: [`src/services/firebase.ts`](file:///d:/Anti%20webapp/src/services/firebase.ts), [`firestore.rules`](file:///d:/Anti%20webapp/firestore.rules), [`api/_server.ts`](file:///d:/Anti%20webapp/api/_server.ts), [`src/components/VaultView.tsx`](file:///d:/Anti%20webapp/src/components/VaultView.tsx)
- **Discord Webhook (`app_settings/discord`):** จัดเก็บค่า URL และการตั้งค่าบน Firestore พร้อม Real-time Listener ทำให้แอดมินทุกคนใช้งานร่วมกันได้ทันที และมี LocalStorage สำรอง
- **Gemini OCR Key (`app_settings/gemini_ai`):** เมื่อ Owner ตั้งค่าคีย์ไว้ แอดมินทุกคนสามารถใช้ฟังก์ชันสแกน OCR รายชื่อผู้ล่าได้ทันที โดยไม่ต้องกรอกคีย์เอง และรีเฟรชหน้าจอข้อมูลไม่สูญหาย
- **Dynamic API Key Forwarding:** ระบบส่งต่อ active API key ไปยัง Backend Endpoint `/api/scan-hunters` ทำให้เซิร์ฟเวอร์บน Vercel ทำงานได้ทันทีโดยไม่ต้อง Redeploy หลังตั้งค่าคีย์

### 3. แก้ไขข้อผิดพลาด Vercel Serverless `FUNCTION_INVOCATION_FAILED` อย่างสมบูรณ์
- ไฟล์ที่เกี่ยวข้อง: [`api/_entry.ts`](file:///d:/Anti%20webapp/api/_entry.ts), [`api/_firebaseAdmin.ts`](file:///d:/Anti%20webapp/api/_firebaseAdmin.ts), [`api/index.js`](file:///d:/Anti%20webapp/api/index.js)
- เปลี่ยนจากการ Import `firebase-admin` แบบคงที่มาเป็นแบบ Dynamic โหลดตามต้องการ ป้องกัน Crash จาก missing credentials
- ห่อหุ้ม Express Request/Response ด้วย Promise Listener เพื่อรอ `res.on('finish')` ป้องกัน Lambda ตัดการทำงานก่อนส่งข้อมูล
- Bundling โค้ดทั้งหมดเข้าเป็นไฟล์เดียว `api/index.js` ป้องกัน Route Collision บน Vercel
- ตรวจสอบผ่าน `/api/health` คืนค่า 200 OK ทันที

### 4. อัปเดตป้ายกำกับเวอร์ชันในหน้าเว็บ UI เป็น v2.3.0
- [`package.json`](file:///d:/Anti%20webapp/package.json): `"version": "2.3.0"`
- [`src/components/Sidebar.tsx`](file:///d:/Anti%20webapp/src/components/Sidebar.tsx): `v2.3.0`
- [`src/components/LoginScreen.tsx`](file:///d:/Anti%20webapp/src/components/LoginScreen.tsx): `v2.3.0`
- [`src/components/Navbar.tsx`](file:///d:/Anti%20webapp/src/components/Navbar.tsx): `v2.3.0`

### 5. ฐานข้อมูลและสแนปช็อต v2.3.0 (Verified Milestone Snapshot)
- ไฟล์ที่เกี่ยวข้อง: [`backups/complete_snapshot_v2.3.0.json`](file:///d:/Anti%20webapp/backups/complete_snapshot_v2.3.0.json), [`scripts/export_complete_v2.3.0_backup.mjs`](file:///d:/Anti%20webapp/scripts/export_complete_v2.3.0_backup.mjs)
- สแนปช็อตข้อมูลจริงล่าสุด: สมาชิก 22 คน, ไอเทมในคลัง 23 ชิ้น, คิว 5 ชิ้น, กองทุนเพชร 23,521 เพชร

---

## 📜 ฟีเจอร์หลักก่อนหน้าจาก v2.2.0 ที่คงอยู่อย่างสมบูรณ์ (Inherited Features)
1. **Discord Message Templates 4 รูปแบบ:** Radiant Neon, Siege & War, Guild Market, Crystal Minimal
2. **Discord ANSI Colors ตามระดับไอเทม:** MYTHIC (ทอง), LEGEND (ม่วง), EPIC (แดง), RARE (ฟ้า)
3. **ระบบส่งรูปภาพ Thumbnail อัตโนมัติ (Native Multipart Upload):** ส่งไฟล์ไบนารีเข้า Discord ตรง 100% พร้อม Breka's Soul Default Icon Fallback
4. **Fluid Dynamic Responsive Scaling ([`src/App.tsx`](file:///d:/Anti%20webapp/src/App.tsx)):** ปรับขนาดตามหน้าต่างบราวเซอร์อัตโนมัติ รองรับแบ่งครึ่งหน้าจอและจอ Ultrawide
5. **Tab State & URL Hash Persistence:** รีเฟรช F5 หรือกด Back/Forward อยู่หน้าเดิมเสมอ
6. **Available Items 4-Columns Grid & Compact 2-Line Item Cards:** กล่องไอเทมแถวละ 4 ชิ้นบนเดสก์ท็อป พร้อมข้อมูล 2 บรรทัดติดรูป
7. **Discord Role Mentions:** รองรับแท็ก Role ID เฉพาะกลุ่ม
8. **Persistent Local Caching & Quota Protection:** แคชข้อมูลลง LocalStorage ป้องกันจอขาวเมื่อติด Quota Firestore
9. **Gemini AI OCR Party Hunters:** สแกนรายชื่อผู้ล่าตัดชื่อซ้ำอัตโนมัติ

---

## 🔒 กฎเหล็กและการป้องกันโค้ดเสียหาย (Core Engineering Rules)

> [!IMPORTANT]
> 1. **กฎเหล็กสองภาษา 100% (Rule 1: Bilingual Compliance):**
>    - ทุก UI, หัวข้อ, คำอธิบาย, ป้าย, Dropdown, ปุ่มกด, ช่อง Input/Placeholder, Alert และ Toast ต้องรองรับ **ไทย (TH)** และ **อังกฤษ (EN)** เสมอ
>    - ห้าม Hardcode ภาษาเดียวในหน้าจอเด็ดขาด
> 2. **กฎการทดสอบ Local First (Rule 2):**
>    - ต้องทดสอบบน `http://localhost:3000` และรัน Typecheck (`tsc --noEmit`) และ Build (`vite build`) ให้ผ่าน 0 error ก่อนเสมอ
>    - ห้ามรัน `git push` หรือ deploy ขึ้น Vercel จนกว่าผู้ใช้งานจะพิมพ์สั่งยืนยันให้อัปโหลดอย่างชัดเจน
> 3. **กฎการเรียก Node บน Windows (Rule 4):**
>    - ห้ามรันคำว่า `npm` โดดๆ บน Windows ให้ใช้ `C:\Program Files\nodejs\node.exe` หรือรันผ่าน npx/node entrypoint
> 4. **การรักษาความปลอดภัยและสิทธิ์ Owner:**
>    - บัญชี `eloni` คือ Owner สูงสุด ห้ามลดสิทธิ์ และปุ่มรีเซ็ตระบบ/คีย์ Gemini ต้องเปิดให้เฉพาะ Owner เท่านั้น

---

## 📂 แผนผังไฟล์สำคัญในโปรเจกต์ (Key Files Architecture)

```
d:/Anti webapp/
├── package.json                   # เวอร์ชั่น v2.3.0 และ dependencies
├── server.ts                      # Express Backend (Local API + Proxy Discord/Gemini + Multipart Image Upload)
├── api/
│   ├── _entry.ts                  # Serverless Entrypoint Wrapper (Promise res.on finish)
│   ├── _server.ts                 # Express Router สำหรับ Serverless
│   ├── _firebaseAdmin.ts          # Firebase Admin แบบ Dynamic Import
│   └── index.js                   # Single Bundled Serverless Function (สร้างโดย esbuild)
├── backups/
│   ├── complete_snapshot_v2.3.0.json # สแนปช็อตข้อมูลครบถ้วน v2.3.0
│   └── complete_snapshot_latest.json # สแนปช็อตล่าสุด
├── scripts/
│   ├── export_complete_v2.3.0_backup.mjs # สคริปต์ส่งออกข้อมูลสำรอง v2.3.0
│   └── backup-firestore-encrypted.mjs    # สำรอง Firestore เข้ารหัส
├── src/
│   ├── App.tsx                    # ตัวควบคุมหลัก: Responsive Container, Tab Routing, Firestore Listeners
│   ├── types.ts                   # Types กลาง (User, VaultItem, DiscordSettings, DiscordMessageTemplate)
│   ├── translations.ts            # พจนานุกรม 2 ภาษา (TH / EN)
│   ├── services/
│   │   ├── firebase.ts            # Firestore Listeners, Shared Settings Sync, Sanitize
│   │   └── gemini.ts              # Gemini AI OCR Client
│   ├── utils/
│   │   ├── discord.ts             # Discord Webhook, Templates, White Price ANSI, Multipart Images
│   │   ├── defaultItemIcon.ts     # ภาพไอคอนสำรองมาตรฐาน (Breka's Soul Base64)
│   │   ├── diamondHelper.ts       # ยอดคำนวณเพชรส่วนกลาง
│   │   └── sound.ts               # ระบบเสียงประกอบ Web Audio API
│   └── components/
│       ├── DashboardView.tsx      # แดชบอร์ดภาพรวม, ไอเทมเปิดรับ 4 คอลัมน์ 2 บรรทัด
│       ├── VaultView.tsx          # คลังไอเทมบอส, สแกน OCR, รายการของที่แจกแล้ว
│       ├── EditVaultItemModal.tsx # หน้าต่างแก้ไขไอเทมเปิดรับ
│       ├── DistributeItemModal.tsx# หน้าต่างแจกจ่ายไอเทมพร้อมแนบรูปบิล
│       ├── DiamondVaultModal.tsx  # กองทุนเพชร 1:1 และปุ่มรีเซ็ตยอดของ Owner
│       ├── DiscordBroadcastModal.tsx # หน้าต่างเลือกแม่แบบส่งประกาศ Discord พร้อม Live Preview
│       ├── DiscordWebhookModal.tsx# ตั้งค่า Webhook URL, Role ID Mention และแม่แบบเริ่มต้น
│       ├── Sidebar.tsx            # เมนูด้านข้างและแท็บนำทาง (v2.3.0)
│       ├── Navbar.tsx             # แถบเมนูด้านบน สลับภาษา และยอดเพชร (v2.3.0)
│       └── LoginScreen.tsx        # หน้าจอล็อกอินพร้อมระบบสเตตัสเริ่มต้น (v2.3.0)
```

---

## ⚙️ คำสั่งสำหรับทดสอบและบิลด์ (Verification Commands)

```powershell
# 1. ตรวจสอบ Typecheck
& 'C:\Program Files\nodejs\node.exe' 'node_modules\typescript\bin\tsc' --noEmit

# 2. ทดสอบสร้าง Production Bundle
& 'C:\Program Files\nodejs\node.exe' 'node_modules\vite\bin\vite.js' build

# 3. บิลด์ Serverless Function สำหรับ Vercel
& 'C:\Program Files\nodejs\node.exe' 'node_modules\esbuild\bin\esbuild' api/_entry.ts --bundle --platform=node --format=esm --packages=external --outfile=api/index.js

# 4. รัน Dev Server (Localhost)
& 'C:\Program Files\nodejs\node.exe' 'node_modules\tsx\dist\cli.mjs' server.ts
```

---

## 💬 ข้อความตัวอย่างสำหรับ Copy ไปเริ่มในห้องแชทใหม่:

```
โปรดอ่านไฟล์ SYSTEM_MANUAL_v2.3.0.md, AI_CONTEXT.md และ PROJECT_HANDOVER.md ในโปรเจกต์นี้ทั้งหมดก่อนเริ่มงาน
ระบบปัจจุบันคือ Lineage2M Clan Hub & Boss Item Vault (v2.3.0 — อัปเดตล่าสุด)
- บัญชี Owner: Eloni (สิทธิ์ Owner สูงสุด)
- Live Production: https://lineage2m-k7-item-vault.vercel.app/
- สถานะระบบล่าสุด (v2.3.0):
  1. Discord ฟอนต์ราคาไอเทมเป็นสีขาวเด่นชัด (ANSI \u001b[1;37m) ครบทั้ง 4 แม่แบบ (Price: FREE (0 Diamonds) สีขาว)
  2. บันทึก Discord Webhook และ Gemini OCR Key ถาวรข้ามแอดมินทุกคนผ่าน Firestore (app_settings/discord, app_settings/gemini_ai)
  3. แก้ไขข้อผิดพลาด Vercel Serverless FUNCTION_INVOCATION_FAILED สำเร็จ 100% (/api/health 200 OK)
  4. อัปเดตเวอร์ชัน v2.3.0 ครบทุกจุด (package.json, Navbar, Sidebar, LoginScreen)
  5. มีสแนปช็อตข้อมูลสำรองครบถ้วนที่ backups/complete_snapshot_v2.3.0.json (22 users, 23 vault items, 23,521 diamonds)
  6. แม่แบบข้อความ Discord 4 รูปแบบ (Radiant Neon, Siege & War, Guild Market, Crystal Minimal)
  7. ระบบ 2 ภาษา TH/EN 100% ทุกจุด
  8. Typecheck และ Vite Build ผ่าน 0 errors
โปรดยืนยันว่าเข้าใจสถาปัตยกรรมและกฎการป้องกันโค้ดเสียหายแล้ว พร้อมรับคำสั่งงานต่อไปครับ
```
