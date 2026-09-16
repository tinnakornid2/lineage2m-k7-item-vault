# 📋 PROJECT HANDOVER & WORK CONTINUATION GUIDE
> **Lineage 2M Clan Hub & Boss Item Vault (Version: v2.4.0 — อัปเดตล่าสุด)**  
> **Last Updated:** 2026-09-16  
> **Repository:** `tinnakornid2/lineage2m-k7-item-vault`  
> **Live Web App:** [https://lineage2m-k7-item-vault.vercel.app/](https://lineage2m-k7-item-vault.vercel.app/)  
> **Master Architecture Guide:** [SYSTEM_ARCHITECTURE.md](file:///d:/Anti%20webapp/SYSTEM_ARCHITECTURE.md)  
> **System Manual:** [SYSTEM_MANUAL_v2.4.0.md](file:///d:/Anti%20webapp/SYSTEM_MANUAL_v2.4.0.md)  
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
   - **สิทธิ์สูงสุด:** เข้าถึงทุกฟังก์ชัน, จัดการรหัสผ่านของทุกคน, ตั้งค่า Gemini AI Key, ตั้งค่า Discord Webhook/Role ID/Templates, อนุมัติสเตตัส/สมาชิก, สลับบทบาทสมาชิก, ศูนย์รีเซ็ตระบบ, ปุ่มรีเซ็ตยอดเพชร
2. **ระดับสิทธิ์ผู้ใช้ (User Roles):**
   - `'owner'` : เจ้าของระบบ / หัวหน้ากิลด์สูงสุด
   - `'admin'` : ผู้ดูแลระบบ (เปลี่ยนรหัสผ่านตนเองและ Member/Leader ได้, ยืนยันชำระเงินไอเทมได้, แจกของได้)
   - `'manager'` : ผู้จัดการระบบ
   - `'party_leader'` : หัวหน้าปาร์ตี้ / 👑 Leader
   - `'member'` : สมาชิกทั่วไป (เปลี่ยนรหัสผ่านตนเองได้, ลบการแจ้งเตือนตนเองได้)

---

## 🏗️ ฟีเจอร์ล่าสุดในเวอร์ชัน v2.4.0 (What's New in v2.4.0)

### 1. ระบบเปลี่ยนรหัสผ่านตามลำดับสิทธิ์ (Role-Based Password Management)
- ไฟล์ที่เกี่ยวข้อง: [`src/components/ChangePasswordModal.tsx`](file:///d:/Anti%20webapp/src/components/ChangePasswordModal.tsx), [`api/_firebaseAdmin.ts`](file:///d:/Anti%20webapp/api/_firebaseAdmin.ts), [`api/_server.ts`](file:///d:/Anti%20webapp/api/_server.ts), [`src/services/firebase.ts`](file:///d:/Anti%20webapp/src/services/firebase.ts), [`src/components/Sidebar.tsx`](file:///d:/Anti%20webapp/src/components/Sidebar.tsx), [`src/components/MembersView.tsx`](file:///d:/Anti%20webapp/src/components/MembersView.tsx), [`src/components/MyStatsView.tsx`](file:///d:/Anti%20webapp/src/components/MyStatsView.tsx)
- สมาชิกทุกคนสามารถเปลี่ยนรหัสผ่านของตนเองได้
- Owner สามารถเปลี่ยนรหัสผ่านของสมาชิกทุกคนในระบบได้
- Admin สามารถเปลี่ยนรหัสผ่านของตนเอง และของสมาชิกทั่วไป (`Member`, `Party Leader`) ได้ โดยห้ามแตะ Owner และ Admin คนอื่น
- มีหน้าต่าง `ChangePasswordModal.tsx` ปลอดภัยสไตล์ Dark Fantasy ตรวจสอบความยาวรหัสผ่าน (ขั้นต่ำ 6 ตัวอักษร) พร้อมการยืนยันรหัสผ่านใหม่
- มี Backend Endpoint `POST /api/users/:userId/change-password` ตรวจสอบ Token และ Hierarchy ด้วย Firebase Admin SDK

### 2. ระบบจัดการและล้างการแจ้งเตือน (Notification Deletion & Auto-Cleanup)
- ไฟล์ที่เกี่ยวข้อง: [`src/components/NotificationModal.tsx`](file:///d:/Anti%20webapp/src/components/NotificationModal.tsx), [`src/App.tsx`](file:///d:/Anti%20webapp/src/App.tsx)
- เพิ่มปุ่มถังขยะ `Trash2` ให้ลบการแจ้งเตือนได้ทีละรายการ
- ปุ่ม "ล้างทั้งหมด" (Clear All) บันทึกและจำค่าลงใน `localStorage` (`l2m_dismissed_notifications`) ไม่ให้เด้งกลับมา
- **ระบบลบการแจ้งเตือนอัตโนมัติ:** เมื่อไอเทมถูกแจกจ่ายไปแล้ว (`status === 'distributed'`) การแจ้งเตือนขอรับของชิ้นนั้นจะถูกตัดออกจากการแจ้งเตือนทันที

### 3. ระบบติดตามสถานะการชำระเงินของไอเทมแจกจ่าย (Payment Tracking & Confirmation)
- ไฟล์ที่เกี่ยวข้อง: [`src/types.ts`](file:///d:/Anti%20webapp/src/types.ts), [`src/components/VaultView.tsx`](file:///d:/Anti%20webapp/src/components/VaultView.tsx), [`src/components/DashboardView.tsx`](file:///d:/Anti%20webapp/src/components/DashboardView.tsx), [`src/components/DistributeItemModal.tsx`](file:///d:/Anti%20webapp/src/components/DistributeItemModal.tsx), [`src/services/firebase.ts`](file:///d:/Anti%20webapp/src/services/firebase.ts)
- ไอเทมที่มีราคา (`price > 0`) แสดงสถานะ `⏳ รอชำระ` (`Pending Payment`) หรือ `✓ ชำระแล้ว` (`Paid`)
- ไอเทมแจกฟรี (`price <= 0`) แสดงสถานะ `🎁 ฟรี` (`Free`) อัตโนมัติ
- **Dashboard Box 3 (Recent Distributions):** แสดงเฉพาะป้ายสถานะ โดยไม่มีปุ่มกด เพื่อความสะอาดตา
- **Vault View (Distributed Items Tab):** มีปุ่ม `✓ ยืนยันการชำระ` และปุ่ม Revert สำหรับ Admin/Owner
- ซิงค์ลง Firestore ทันทีผ่านฟังก์ชัน `confirmVaultItemPayment`

### 4. ปรับแต่งหน้าจอ My Stats (Thai Subtitles & Clean Inputs)
- ไฟล์ที่เกี่ยวข้อง: [`src/components/MyStatsView.tsx`](file:///d:/Anti%20webapp/src/components/MyStatsView.tsx)
- มีชื่อภาษาไทยกำกับต่อท้ายในวงเล็บจางๆ พออ่านได้ เช่น `Damage (พลังโจมตี)`, `Accuracy (ความแม่นยำ)`, `Level (เลเวล)` ครบทุกสเตตัส
- ลบค่าตัวเลขหลอกตาในพื้นหลัง (`placeholder=""`) สะอาดตา 100%
- เพิ่มปุ่ม "เปลี่ยนรหัสผ่าน" ในการ์ดข้อมูลส่วนตัว

### 5. อัปเดตเวอร์ชัน v2.4.0 และสแนปช็อตข้อมูลครบถ้วน
- [`package.json`](file:///d:/Anti%20webapp/package.json): `"version": "2.4.0"`
- [`src/components/Sidebar.tsx`](file:///d:/Anti%20webapp/src/components/Sidebar.tsx): `v2.4.0`
- [`src/components/Navbar.tsx`](file:///d:/Anti%20webapp/src/components/Navbar.tsx): `v2.4.0`
- [`src/components/LoginScreen.tsx`](file:///d:/Anti%20webapp/src/components/LoginScreen.tsx): `v2.4.0`
- สแนปช็อตข้อมูล: [`backups/complete_snapshot_v2.4.0.json`](file:///d:/Anti%20webapp/backups/complete_snapshot_v2.4.0.json) (23 users, 23 vault items, 5 queues, 23,521 diamonds)
- สคริปต์สำรองข้อมูล: [`scripts/export_complete_v2.4.0_backup.mjs`](file:///d:/Anti%20webapp/scripts/export_complete_v2.4.0_backup.mjs)

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
>    - ห้ามรันคำว่า `npm` โดดๆ บน Windows ให้ใช้ `& 'C:\Program Files\nodejs\node.exe'` นำหน้าเสมอ
> 4. **การรักษาความปลอดภัยและสิทธิ์ Owner:**
>    - บัญชี `eloni` คือ Owner สูงสุด ห้ามลดสิทธิ์ และปุ่มรีเซ็ตระบบ/คีย์ Gemini ต้องเปิดให้เฉพาะ Owner เท่านั้น

---

## 📂 แผนผังไฟล์สำคัญในโปรเจกต์ (Key Files Architecture)

```
d:/Anti webapp/
├── package.json                   # เวอร์ชั่น v2.4.0 และ dependencies
├── server.ts                      # Express Backend (Local API + Proxy Discord/Gemini + Change Password Endpoint)
├── api/
│   ├── _entry.ts                  # Serverless Entrypoint Wrapper (Promise res.on finish)
│   ├── _server.ts                 # Express Router สำหรับ Serverless พร้อม endpoint เปลี่ยนรหัสผ่าน
│   ├── _firebaseAdmin.ts          # Firebase Admin แบบ Dynamic Import สำหรับเปลี่ยนรหัสผ่าน
│   └── index.js                   # Single Bundled Serverless Function (สร้างโดย esbuild)
├── backups/
│   ├── complete_snapshot_v2.4.0.json # สแนปช็อตข้อมูลครบถ้วน v2.4.0
│   └── complete_snapshot_latest.json # สแนปช็อตล่าสุด
├── scripts/
│   ├── export_complete_v2.4.0_backup.mjs # สคริปต์ส่งออกข้อมูลสำรอง v2.4.0
│   └── backup-firestore-encrypted.mjs    # สำรอง Firestore เข้ารหัส
├── src/
│   ├── App.tsx                    # ตัวควบคุมหลัก: Responsive Container, Tab Routing, Firestore Listeners, Auto Notification Cleanup
│   ├── types.ts                   # Types กลาง (User, VaultItem, DistributedInfo พร้อม paymentStatus, DiscordSettings)
│   ├── translations.ts            # พจนานุกรม 2 ภาษา (TH / EN) 100%
│   ├── services/
│   │   ├── firebase.ts            # Firestore Listeners, Shared Settings Sync, changeUserPassword, confirmVaultItemPayment
│   │   └── gemini.ts              # Gemini AI OCR Client
│   ├── utils/
│   │   ├── discord.ts             # Discord Webhook, Templates, White Price ANSI, Multipart Images
│   │   ├── defaultItemIcon.ts     # ภาพไอคอนสำรองมาตรฐาน (Breka's Soul Base64)
│   │   ├── diamondHelper.ts       # ยอดคำนวณเพชรส่วนกลาง
│   │   └── sound.ts               # ระบบเสียงประกอบ Web Audio API
│   └── components/
│       ├── ChangePasswordModal.tsx# หน้าต่างเปลี่ยนรหัสผ่านตามลำดับสิทธิ์ (v2.4.0)
│       ├── NotificationModal.tsx  # หน้าต่างการแจ้งเตือนพร้อมปุ่มลบ (v2.4.0)
│       ├── DashboardView.tsx      # แดชบอร์ดภาพรวม, ป้ายสถานะชำระเงิน Box 3 (v2.4.0)
│       ├── VaultView.tsx          # คลังไอเทมบอส, ป้ายและปุ่มยืนยันชำระเงิน (v2.4.0)
│       ├── MembersView.tsx        # หน้าทำเนียบสมาชิก พร้อมปุ่มเปลี่ยนรหัสผ่านตามสิทธิ์ (v2.4.0)
│       ├── MyStatsView.tsx        # สเตตัสสมาชิก พร้อมวงเล็บไทยจางๆ และช่องกรอกสะอาดตา (v2.4.0)
│       ├── EditVaultItemModal.tsx # หน้าต่างแก้ไขไอเทมเปิดรับ
│       ├── DistributeItemModal.tsx# หน้าต่างแจกจ่ายไอเทมพร้อมแนบรูปบิลและกำหนดสถานะชำระ
│       ├── DiamondVaultModal.tsx  # กองทุนเพชร 1:1 และปุ่มรีเซ็ตยอดของ Owner
│       ├── DiscordBroadcastModal.tsx # หน้าต่างเลือกแม่แบบส่งประกาศ Discord พร้อม Live Preview สีขาว
│       ├── DiscordWebhookModal.tsx# ตั้งค่า Webhook URL, Role ID Mention และแม่แบบเริ่มต้น
│       ├── Sidebar.tsx            # เมนูด้านข้างและแท็บนำทาง + ปุ่มเปลี่ยนรหัสผ่าน (v2.4.0)
│       ├── Navbar.tsx             # แถบเมนูด้านบน สลับภาษา และยอดเพชร (v2.4.0)
│       └── LoginScreen.tsx        # หน้าจอล็อกอินพร้อมระบบสเตตัสเริ่มต้น (v2.4.0)
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

# 4. บิลด์ Local Server
& 'C:\Program Files\nodejs\node.exe' 'node_modules\esbuild\bin\esbuild' server.ts --bundle --platform=node --format=esm --packages=external --sourcemap --outfile=dist/server.js

# 5. รัน Dev Server (Localhost)
& 'C:\Program Files\nodejs\node.exe' 'node_modules\tsx\dist\cli.mjs' server.ts
```

---

## 💬 ข้อความตัวอย่างสำหรับ Copy ไปเริ่มในห้องแชทใหม่:

```text
โปรดอ่านไฟล์ SYSTEM_MANUAL_v2.4.0.md, AI_CONTEXT.md และ PROJECT_HANDOVER.md ในโปรเจกต์นี้ทั้งหมดก่อนเริ่มงาน
ระบบปัจจุบันคือ Lineage2M Clan Hub & Boss Item Vault (v2.4.0 — อัปเดตล่าสุด)
- บัญชี Owner: Eloni (สิทธิ์ Owner สูงสุด)
- Live Production: https://lineage2m-k7-item-vault.vercel.app/
- สถานะระบบล่าสุด (v2.4.0):
  1. ระบบเปลี่ยนรหัสผ่านตามลำดับสิทธิ์: ทุกคนเปลี่ยนของตนเองได้, Owner เปลี่ยนให้ทุกคนได้, Admin เปลี่ยนให้ Member/Leader ได้
  2. ระบบลบการแจ้งเตือนรายข้อความ + ปุ่มล้างทั้งหมด + ลบการแจ้งเตือนขอรับของอัตโนมัติเมื่อไอเทมแจกจ่ายแล้ว
  3. ระบบติดตามสถานะการชำระเงินของไอเทมแจกแล้ว (รอชำระ / ชำระแล้ว / ฟรี) พร้อมปุ่มยืนยันในหน้า Vault และแสดงสถานะสะอาดตาใน Dashboard
  4. หน้า My Stats มีวงเล็บภาษาไทยกำกับชื่อสเตตัสจางๆ อ่านง่าย พร้อมลบ placeholder ตัวเลขหลอกตาออกทั้งหมด
  5. บันทึก Discord Webhook และ Gemini OCR Key ถาวรข้ามแอดมินทุกคนผ่าน Firestore
  6. อัปเดตเวอร์ชัน v2.4.0 ครบทุกจุด (package.json, Navbar, Sidebar, LoginScreen)
  7. มีสแนปช็อตข้อมูลสำรองครบถ้วนที่ backups/complete_snapshot_v2.4.0.json (23 users, 23 vault items, 23,521 diamonds)
  8. ระบบ 2 ภาษา TH/EN 100% ทุกจุด
  9. Typecheck และ Vite Build ผ่าน 0 errors
โปรดยืนยันว่าเข้าใจสถาปัตยกรรมและกฎการป้องกันโค้ดเสียหายแล้ว พร้อมรับคำสั่งงานต่อไปครับ
```
