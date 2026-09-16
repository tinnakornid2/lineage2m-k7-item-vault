# 📋 PROJECT HANDOVER & WORK CONTINUATION GUIDE
> **Lineage 2M Clan Hub & Boss Item Vault (Version: v2.2.0 — อัปเดตล่าสุด)**  
> **Last Updated:** 2026-09-16  
> **Repository:** `tinnakornid2/lineage2m-k7-item-vault`  
> **Live Web App:** [https://lineage2m-k7-item-vault.vercel.app/](https://lineage2m-k7-item-vault.vercel.app/)  
> **Master Architecture Guide:** [SYSTEM_ARCHITECTURE.md](file:///d:/Anti%20webapp/SYSTEM_ARCHITECTURE.md)  
> **AI Quick Context:** [AI_CONTEXT.md](file:///d:/Anti%20webapp/AI_CONTEXT.md)  
> **System Manual:** [SYSTEM_MANUAL_v2.2.0.md](file:///d:/Anti%20webapp/SYSTEM_MANUAL_v2.2.0.md)

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

## 🏗️ ฟีเจอร์ล่าสุดในเวอร์ชัน v2.2.0 (What's New in v2.2.0)

### 1. ระบบแม่แบบข้อความ Discord 4 รูปแบบ (Discord Message Templates)
- ไฟล์ที่เกี่ยวข้อง: [`src/utils/discord.ts`](file:///d:/Anti%20webapp/src/utils/discord.ts), [`src/components/DiscordBroadcastModal.tsx`](file:///d:/Anti%20webapp/src/components/DiscordBroadcastModal.tsx), [`src/components/DiscordWebhookModal.tsx`](file:///d:/Anti%20webapp/src/components/DiscordWebhookModal.tsx)
- ระบบมีชุดแม่แบบข้อความส่งประกาศเข้า Discord ให้เลือก 4 สไตล์:
  1. **🌟 Radiant Neon (`neon_glow`):** สไตล์นีออนเรืองแสง กรอบ ANSI สีตามความหายาก สวยสะดุดตา
  2. **⚔️ Siege & War Vault Alert (`war_horn`):** สไตล์บัญชาการรบ ดุดัน แจ้งเตือนบอสและเปิดเคลมเสริมทัพกิลด์
  3. **🏛️ Guild Treasury & Market (`clan_market`):** สไตล์ตลาดประมูลปราสาทกีรัน เน้นราคาเพชรและรายการไอเทม
  4. **✨ Crystal Minimal (`crystal_minimal`):** การ์ด Embed กระชับ คลีน ไม่มีขยะข้อความ
- ข้อความทั้งหมดที่ส่งเข้า Discord เป็นภาษาอังกฤษ 100% สั้น กระชับ และมีลิงก์กดเปิดคลังเคลมไอเทมได้ทันที

### 2. ฟอนต์ชื่อไอเทมมีสีเรืองแสงจริงใน Discord (Discord ANSI Color Codeblocks)
- ใช้ฟีเจอร์ Discord ANSI Syntax Highlighting (` ```ansi `) กำหนดสีตามระดับความหายาก:
  - 🟨 **MYTHIC:** ฟอนต์สีทอง (`\u001b[1;33m`)
  - 🟪 **LEGEND:** ฟอนต์สีม่วงเรืองแสง (`\u001b[1;35m`)
  - 🟥 **EPIC:** ฟอนต์สีแดงเรืองแสง (`\u001b[1;31m`)
  - 🟦 **RARE:** ฟอนต์สีฟ้าเรืองแสง (`\u001b[1;36m`)
  - 💎 **ราคาเพชร:** ฟอนต์สีเขียวเรืองแสง (`\u001b[1;32m`)
- แยก Emoji ออกจากบล็อก ANSI เพื่อป้องกัน byte misalignment ในระบบ Discord Renderer

### 3. ระบบส่งรูปภาพ Thumbnail อัตโนมัติ (Native Multipart Image Attachments & Fallback)
- ไฟล์ที่เกี่ยวข้อง: [`src/utils/discord.ts`](file:///d:/Anti%20webapp/src/utils/discord.ts), [`src/utils/defaultItemIcon.ts`](file:///d:/Anti%20webapp/src/utils/defaultItemIcon.ts), [`server.ts`](file:///d:/Anti%20webapp/server.ts)
- อัปโหลดไฟล์รูปภาพไบนารี (`files[0]`, `attachment://item.jpg`) เข้า Discord API โดยตรง ไม่พึ่งพา URL ภายนอกที่อาจหมดอายุ
- หากไอเทมไม่มีรูปภาพ หรือกดปุ่ม "ทดสอบส่ง Discord" ระบบจะใช้ `DEFAULT_ITEM_ICON_BASE64` ส่งเป็น Thumbnail ที่มุมขวาบนเสมอ 100%
- ตรวจจับนามสกุลไฟล์อัตโนมัติ (`jpg`, `png`, `webp`) ให้ตรงกันทั้งใน Local Proxy และ Direct Browser Fallback

### 4. หน้าต่างเลือกแม่แบบก่อนส่งไอเทม (DiscordBroadcastModal)
- ไฟล์ที่เกี่ยวข้อง: [`src/components/DiscordBroadcastModal.tsx`](file:///d:/Anti%20webapp/src/components/DiscordBroadcastModal.tsx)
- เมื่อกดปุ่มส่ง Discord ที่การ์ดไอเทมในคลัง จะมีหน้าต่างขึ้นมาให้เลือกแม่แบบ
- มี **Live Color Preview** แสดงตัวอย่างสีของไอเทมตรงตามระดับก่อนส่ง
- เลือกรูปแบบการแท็กได้อิสระ (`@everyone`, `Role ID`, หรือไม่แท็ก)
- สามารถใส่ Custom Announcement Note และมี Checkbox "จำแม่แบบนี้เป็นค่าเริ่มต้น"

### 5. ขอบการ์ดไอเทมเรืองแสงสไตล์นีออน (Neon Glowing UI)
- ไฟล์ที่เกี่ยวข้อง: [`src/types.ts`](file:///d:/Anti%20webapp/src/types.ts), [`src/index.css`](file:///d:/Anti%20webapp/src/index.css)
- เกรด LEGEND ปรับใช้สีม่วงอัลตร้านีออน `#8500fd` พร้อมเงาสี `box-shadow` เรืองแสงสมจริง
- เกรด MYTHIC ใช้สีทอง `#ffb800`
- เกรด EPIC ใช้สีแดงเลเซอร์ `#ff1744`
- เกรด RARE ใช้สีฟ้าเพชร `#00e5ff`

### 6. ฐานข้อมูลและสแนปช็อต v2.2.0 (Verified Milestone Snapshot)
- ไฟล์ที่เกี่ยวข้อง: [`backups/complete_snapshot_v2.2.0.json`](file:///d:/Anti%20webapp/backups/complete_snapshot_v2.2.0.json), [`scripts/export_complete_v2.2.0_backup.mjs`](file:///d:/Anti%20webapp/scripts/export_complete_v2.2.0_backup.mjs)
- สแนปช็อตข้อมูลจริงล่าสุด: สมาชิก 22 คน, ไอเทมในคลัง 16 ชิ้น, คิว 5 ชิ้น, กองทุนเพชร 23,521 เพชร

---

## 📜 ฟีเจอร์หลักก่อนหน้าจาก v2.1.0 ที่คงอยู่อย่างสมบูรณ์ (Inherited Features)
1. **Fluid Dynamic Responsive Scaling ([`src/App.tsx`](file:///d:/Anti%20webapp/src/App.tsx)):** ปรับขนาดตามหน้าต่างบราวเซอร์อัตโนมัติ รองรับแบ่งครึ่งหน้าจอและจอ Ultrawide
2. **Tab State & URL Hash Persistence:** รีเฟรช F5 หรือกด Back/Forward อยู่หน้าเดิมเสมอ
3. **Available Items 4-Columns Grid:** กล่องไอเทมเปิดรับแถวละ 4 ชิ้นบนเดสก์ท็อป
4. **Compact 2-Line Item Cards & Mini Toolbar:** การ์ดไอเทมกะทัดรัด 2 บรรทัดติดรูปภาพ ไม่ล้นจอ
5. **Discord Role Mentions:** รองรับแท็ก Role ID เฉพาะกลุ่ม
6. **Persistent Local Caching & Quota Protection:** แคชข้อมูลลง LocalStorage ป้องกันจอขาวเมื่อติด Quota Firestore
7. **Gemini AI OCR Party Hunters:** สแกนรายชื่อผู้ล่าตัดชื่อซ้ำอัตโนมัติ

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
├── package.json                   # เวอร์ชั่น v2.2.0 และ dependencies
├── server.ts                      # Express Backend (Local API + Proxy Discord/Gemini + Multipart Image Upload)
├── api/
│   ├── index.ts                   # Vercel Serverless Entrypoint
│   └── _firebaseAdmin.ts          # Firebase Admin & JWT Verification
├── backups/
│   ├── complete_snapshot_v2.2.0.json # สแนปช็อตข้อมูลครบถ้วน v2.2.0
│   └── complete_snapshot_latest.json # สแนปช็อตล่าสุด
├── scripts/
│   ├── export_complete_v2.2.0_backup.mjs # สคริปต์ส่งออกข้อมูลสำรอง v2.2.0
│   └── backup-firestore-encrypted.mjs    # สำรอง Firestore เข้ารหัส
├── src/
│   ├── App.tsx                    # ตัวควบคุมหลัก: Responsive Container, Tab Routing, Firestore Listeners
│   ├── types.ts                   # Types กลาง (User, VaultItem, DiscordSettings, DiscordMessageTemplate)
│   ├── translations.ts            # พจนานุกรม 2 ภาษา (TH / EN)
│   ├── services/
│   │   ├── firebase.ts            # Firestore Listeners & Database Operations
│   │   └── gemini.ts              # Gemini AI OCR Client
│   ├── utils/
│   │   ├── discord.ts             # Discord Webhook, Templates, ANSI Colors, Multipart Images
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
โปรดอ่านไฟล์ SYSTEM_MANUAL_v2.2.0.md, AI_CONTEXT.md และ PROJECT_HANDOVER.md ในโปรเจกต์นี้ทั้งหมดก่อนเริ่มงาน
ระบบปัจจุบันคือ Lineage2M Clan Hub & Boss Item Vault (v2.2.0 — อัปเดตล่าสุด)
- บัญชี Owner: Eloni (สิทธิ์ Owner สูงสุด)
- Live Production: https://lineage2m-k7-item-vault.vercel.app/
- สถานะระบบล่าสุด (v2.2.0):
  1. แม่แบบข้อความ Discord 4 รูปแบบ (Radiant Neon, Siege & War, Guild Market, Crystal Minimal)
  2. สีฟอนต์ชื่อไอเทมเรืองแสงตรงตามระดับความหายาก (Discord ANSI: MYTHIC=ทอง, LEGEND=ม่วง, EPIC=แดง, RARE=ฟ้า, Price=เขียว)
  3. รูปภาพ Thumbnail ไอเทมแนบส่งเข้า Discord API ตรง 100% พร้อม Default Icon Fallback
  4. หน้าต่าง DiscordBroadcastModal สำหรับเลือกแม่แบบพร้อม Live Color Preview ก่อนส่ง
  5. ขอบการ์ดไอเทมเรืองแสงสไตล์นีออน (LEGEND #8500fd, MYTHIC #ffb800, EPIC #ff1744, RARE #00e5ff)
  6. หน้าจอ Fluid Responsive ปรับขนาดตามหน้าต่างบราวเซอร์อัตโนมัติ (App.tsx)
  7. ระบบ 2 ภาษา TH/EN 100% ทุกจุด
  8. Typecheck และ Vite Build ผ่าน 0 errors
โปรดยืนยันว่าเข้าใจสถาปัตยกรรมและกฎการป้องกันโค้ดเสียหายแล้ว พร้อมรับคำสั่งงานต่อไปครับ
```
