# 🏛️ SYSTEM_ARCHITECTURE.md — สถาปัตยกรรมระบบและคู่มือป้องกันโค้ดเสียหาย
> **Lineage 2M Clan Hub & Boss Item Vault (Version: v1.8.0)**  
> **Last Updated:** 2026-09-12  
> **Live Production:** [https://lineage2m-k7-item-vault.vercel.app/](https://lineage2m-k7-item-vault.vercel.app/)  
> **Repository:** `tinnakornid2/lineage2m-k7-item-vault`

---

## 🎯 วัตถุประสงค์ของเอกสารฉบับนี้ (Purpose)
เอกสารนี้จัดทำขึ้นเป็น **แผนผังวิศวกรรมระบบแม่บท (Master Engineering Blueprint)** เพื่อให้ AI Assistant หรือนักพัฒนาในอนาคต:
1. **ไม่ไปแก้ไขส่วนอื่นโดยไม่จำเป็น (Prevent Unintended Regressions):** รู้ว่าส่วนไหนทำงานสมบูรณ์แล้วและห้ามแตะต้อง
2. **เข้าใจจุดเชื่อมต่อระบบ (System Integrations):** เข้าใจความสัมพันธ์ระหว่าง Firestore, Express Backend, Vercel Static Hosting, และ Google Gemini AI
3. **มีแนวทางต่อยอดฟังก์ชันที่ปลอดภัย (Safe Extension Pathways):** รู้วิธีเพิ่มฟีเจอร์ใหม่อย่างเป็นระเบียบ โดยไม่ทำให้ฟีเจอร์เดิมเสียหาย

---

## ⛔ 1. โซนแกนกลางที่ห้ามแก้ไขโดยไม่จำเป็น (PROTECTED CORE — DO NOT TOUCH)

> [!CAUTION]
> ห้ามแก้ไข, ลบ, หรือเขียนทับโค้ดใน 7 ส่วนนี้โดยเด็ดขาด เว้นแต่ผู้ใช้งานจะสั่งการเฉพาะเจาะจงในจุดนั้นโดยตรง:

### 1.1 ระบบโมเดล AI OCR และการทำงานบน Vercel (`src/components/VaultView.tsx` & `server.ts`)
- **โมเดลที่ใช้งานได้จริง:** ต้องคงรายการ `candidateModels` เป็นโมเดลปัจจุบันของ Google API ได้แก่:
  ```ts
  const candidateModels = [
    "gemini-flash-latest",
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3-flash-preview",
    "gemini-3.6-flash"
  ];
  ```
  *⚠️ ห้ามนำโมเดล `gemini-1.5-flash`, `gemini-2.0-flash`, `gemini-2.5-flash` กลับมาเด็ดขาด เพราะ Google ปิดการเข้าถึงสำหรับผู้ใช้ใหม่แล้ว (จะส่งผลให้ระบบพังด้วย Error 404)*
- **การแยกแยะสภาพแวดล้อม (Local vs Vercel):**
  ```ts
  const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  ```
  *⚠️ บน Vercel ไม่มี Express backend รันอยู่ (`!isLocalhost`) ระบบต้องเรียก `runDirectGeminiClientOcr` จากฝั่ง Client โดยตรง ห้ามพยายามส่ง POST ไปยัง `/api/scan-hunters` บน Vercel เพราะจะได้ผลตอบกลับเป็นหน้าเว็บ HTML (`index.html`)*
- **การดึงคีย์กลาง (Cloud Sync):** ดึงคีย์อัตโนมัติจาก Firestore `app_settings/gemini_ai` ผ่าน `listenToGeminiAiSettings` พร้อมสำรองใน `DEFAULT_GEMINI_API_KEY` ห้ามลบตัวแปรสำรองนี้

### 1.2 กฎเหล็กระบบสองภาษา 100% (Rule 1: Bilingual Compliance)
- **ห้าม Hardcode ภาษาเดียวในทุกจุดของ UI:**
  - ข้อความ, ปุ่ม, ป้าย, Dropdown, กล่องข้อความ Placeholder, Toast, และ Alert ต้องรองรับทั้ง **ไทย (TH)** และ **อังกฤษ (EN)**
  - การเขียนข้อความต้องอิงจาก `translations[lang]` หรือ `lang === 'th' ? '...' : '...'` เสมอ

### 1.3 ระบบคุ้มครองบัญชีเจ้าของสูงสุด (Immutable Owner Protection)
- บัญชี `user_owner_eloni` (Username: `eloni`) เป็นเจ้าของระบบสูงสุด:
  - **ห้าม** ลดขั้นบทบาท (`role`) ของ `eloni` จาก `'owner'` เป็นบทบาทอื่นโดยเด็ดขาด
  - **ห้าม** แสดงปุ่มลบหรือคำสั่งลบบัญชี `eloni` ในระบบ
  - ฟังก์ชันระดับสูง เช่น **Owner Reset Center** (`OwnerResetModal.tsx`) และ **ตั้งค่า Gemini Key** (`GeminiKeyModal.tsx`) ต้องตรวจสอบสิทธิ์ `isOwner` (`currentUser.role === 'owner'`) เท่านั้น

### 1.4 การคำนวณค่าพลังและซิงค์สูตรแบบ Real-time (`powerFormulaService.ts` & `PowerFormulaSettingsModal.tsx`)
- สูตรคำนวณถูกจัดเก็บไว้ที่ Firestore `app_settings/power_formula`
- เมื่อ Owner มีการปรับแก้น้ำหนักสูตร ทุกไคลเอนต์จะได้รับ Event แบบเรียลไทม์ และคำนวณ Power Level (PL) ใหม่ทันที
- การคำนวณค่าพลังต้องผ่านฟังก์ชันกลาง `calculatePowerLevel(stats, formula)` เท่านั้น ห้ามเขียนสูตร Hardcode แยกในแต่ละ Component

### 1.5 หน้าต่างลอยตรึงรูปหลักฐานเทียบสเตตัส (`Floating Pinned Proof` ใน `src/components/MyStatsView.tsx`)
- สมาชิกระบบสามารถกด **"📌 ดูรูปเทียบสเตตัส"** เพื่อเปิดหน้าต่างรูปภาพหลักฐานลอยขึ้นมาขณะกรอกตัวเลข
- โค้ดส่วนนี้มีระบบปรับขนาด 3 สัดส่วน (S / M / L Split-view) พร้อมปุ่มซูม 100% แบบ Uncropped ห้ามลบฟังก์ชันนี้

### 1.6 มาตรฐานสีเพชรขาวสว่าง (White Diamond & Font Standard)
- ตามความต้องการของระบบล่าสุด ไอคอนเพชร (`Gem` icon) และตัวเลขยอดคงเหลือ/ราคาเพชรทั้งหมดต้องใช้ **สีขาวสว่าง (`text-white font-mono font-bold`)** พร้อมประกายเงา ห้ามเปลี่ยนกลับเป็นสีฟ้าใน Component ต่อไปนี้:
  - `Sidebar.tsx` (Desktop Quick Card & Mobile Top Button)
  - `Navbar.tsx` (Diamond Trigger Widget)
  - `DashboardView.tsx` (Diamond Vault Box & Items Table Price Column)
  - `VaultView.tsx` (Input Price Box, Distributed Table, Viewing Modal)
  - `DiamondVaultModal.tsx` & `DistributionStatsModal.tsx`

### 1.7 กฎการทดสอบและการ Deploy (Rule 2: Local First Rule)
- ทุกการแก้ไขต้องทดสอบบนเครื่อง Localhost (`http://localhost:3000`) ก่อนเสมอ
- ตรวจสอบความถูกต้องด้วย `npx tsc --noEmit` และ `npm run build`
- **ห้ามรัน `git push` หรือ deploy สู่ Vercel จนกว่าผู้ใช้งานจะสั่งการชัดเจน**

### 1.8 ระบบการอนุมัติแบบทีละคนอย่างเคร่งครัด (Strict Individual 1-by-1 Approval)
- **การอนุมัติสเตตัสและการอนุมัติสมาชิกใหม่ต้องทำ "ทีละคน" (One by One) เท่านั้น:**
  - **ห้าม** สร้างหรือเพิ่มปุ่ม "อนุมัติทั้งหมด" (Approve All) โดยเด็ดขาด เพื่อป้องกันความผิดพลาดในการตรวจสอบหลักฐาน
  - ใน `StatApprovalView.tsx`, `StatApprovalModal.tsx`, และ `MembersView.tsx` แต่ละการ์ดมีปุ่มอนุมัติเฉพาะของสมาชิกคนนั้น
  - ทุกปุ่มอนุมัติต้องมีสถานะ **`processingUserId / processingMemberId`** เพื่อแสดง Spinner `กำลังอนุมัติ...` / `Approving...` และปิดปุ่มชั่วคราวขณะประมวลผล เพื่อป้องกันการกดเบิ้ล (Anti-Double Click)
  - ทุกการอนุมัติต้องแสดง **Toast Notification ระบุชื่อสมาชิกที่ได้รับการอนุมัติอย่างชัดเจน** ทั้งภาษาไทยและอังกฤษ

---

## 🛠️ 2. คู่มือการต่อยอดฟังก์ชันในอนาคต (SAFE EXTENSION GUIDE)

หากต้องการเพิ่มฟังก์ชันใหม่ในอนาคต ให้ปฏิบัติตามแนวทางมาตรฐานนี้ เพื่อไม่ให้กระทบส่วนอื่น:

### 2.1 การเพิ่มแท็บเมนูใหม่ในระบบ (Adding New View Tab)
1. **เพิ่มชื่อแท็บใน `src/types.ts`:**
   ```ts
   export type ActiveTab = 'dashboard' | 'vault' | 'queue' | 'members' | 'clans' | 'my-stats' | 'new_feature';
   ```
2. **เพิ่มข้อความสองภาษาใน `src/translations.ts`:**
   ```ts
   // th
   tabNewFeature: 'ชื่อฟีเจอร์ภาษาไทย',
   // en
   tabNewFeature: 'Feature Name in English',
   ```
3. **เพิ่มปุ่มเมนูใน `src/components/Sidebar.tsx`:**
   - เพิ่มปุ่มใน Navigation Links List พร้อมใส่ไอคอนจาก `lucide-react`
4. **สร้างคอมโพเนนต์ใหม่แยกโฟลเดอร์ชัดเจน:**
   - สร้างไฟล์ใน `src/components/NewFeatureView.tsx`
   - นำไปเรียกใช้ใน `src/App.tsx` ใต้เงื่อนไข `{activeTab === 'new_feature' && <NewFeatureView ... />}`

### 2.2 การเพิ่มคอลเลกชันใหม่ใน Firestore (Adding New Firestore Collection)
1. **เพิ่มชื่อคอลเลกชันใน `src/services/firebase.ts`:**
   ```ts
   export const NEW_FEATURE_COLLECTION = 'new_features';
   ```
2. **ใช้ฟังก์ชัน `sanitizeForFirestore` เสมอ:**
   - Firestore จะ Error ทันทีหากมีค่า `undefined` ดังนั้นทุกครั้งที่บันทึกข้อมูล ให้ครอบด้วย `sanitizeForFirestore(data)` เสมอ

### 2.3 การเพิ่มประเภทการแจ้งเตือน Discord Webhook (Adding Discord Notifications)
1. เข้าไปที่ `src/utils/discord.ts`
2. เพิ่มประเภทใน `DiscordNotificationType`
3. เพิ่ม Embed Payload ฟอร์แมตสองภาษา พร้อมส่งผ่านฟังก์ชัน `sendDiscordNotification`

---

## 🗺️ 3. แผนผังคอมโพเนนต์และการเชื่อมต่อข้อมูล (Component & Data Map)

```mermaid
graph TD
    A[App.tsx - Global State Controller] --> B[Sidebar.tsx - Main Navigation]
    A --> C[Navbar.tsx - Top Bar & Profile]
    A --> D[DashboardView.tsx - Overview & Quick Stats]
    A --> E[VaultView.tsx - Boss Loot & AI OCR Scanner]
    A --> F[QueueView.tsx - Item Priority Queue]
    A --> G[MembersView.tsx - Roster & Role Manager]
    A --> H[ClanView.tsx - Drag & Drop Clan Manager]
    A --> I[MyStatsView.tsx - Growth & Proof Inspector]

    %% Modals
    A --> J[StatComparisonModal.tsx - Side-by-side Stat Audit]
    A --> K[PowerFormulaSettingsModal.tsx - Cloud PL Formula]
    A --> L[BulkSwapClanModal.tsx - Batch Clan Transfer]
    A --> M[DiamondVaultModal.tsx - Alliance Fund Audit]
    A --> N[GeminiKeyModal.tsx - AI OCR Key Setup]
    A --> O[OwnerResetModal.tsx - System Reset Center]

    %% Backend & Cloud
    E -. Direct Client OCR .-> P[Google Gemini API]
    A <== Real-time onSnapshot ==> Q[(Firebase Cloud Firestore)]
```

---

## 📋 4. รายชื่อคอมโพเนนต์และหน้าที่รับผิดชอบ (Component Inventory)

| คอมโพเนนต์ (Component) | หน้าที่หลัก (Responsibility) | สถานะความปลอดภัย |
| :--- | :--- | :--- |
| `App.tsx` | ควบคุม State กลาง, Real-time Listener, Modal Router | ⚠️ แกนกลางระบบ |
| `Sidebar.tsx` | เมนูหลักทั้ง PC และ Mobile, กล่องยอดเพชรขาว | ⚠️ แกนกลางระบบ |
| `Navbar.tsx` | แถบเครื่องมือบน, วิดเจ็ตเพชรขาว, ปุ่มสลับภาษา | ⚠️ แกนกลางระบบ |
| `DashboardView.tsx` | แดชบอร์ดภาพรวม, กล่องเพชรกลาง, รายการของรอเคลม | ✅ ปรับแต่งได้ |
| `VaultView.tsx` | คลังไอเทมบอส, OCR สแกนชื่อผู้ล่า, ตารางของที่แจกแล้ว | ⚠️ ห้ามเปลี่ยนโมเดล OCR |
| `QueueView.tsx` | คิวจัดลำดับรับไอเทมล่วงหน้า | ✅ ปรับแต่งได้ |
| `MembersView.tsx` | รายชื่อสมาชิกแยกตามแคลน, ปุ่มอนุมัติสมาชิกใหม่ | ✅ ปรับแต่งได้ |
| `ClanView.tsx` | ลากย้ายสมาชิกข้ามแคลน (Drag & Drop) | ✅ ปรับแต่งได้ |
| `MyStatsView.tsx` | หน้ากรอกสเตตัส, Floating Pinned Proof (S/M/L) | ⚠️ ห้ามลบฟังก์ชันลอยรูป |
| `StatComparisonModal.tsx` | เปรียบเทียบสเตตัสเดิม vs ใหม่พร้อมรูปหลักฐาน | ✅ ปรับแต่งได้ |
| `PowerFormulaSettingsModal.tsx` | ตั้งค่าน้ำหนักสูตร PL ซิงค์ Firestore แบบเรียลไทม์ | ⚠️ ห้ามฮาร์ดโค้ดสูตร |
| `BulkSwapClanModal.tsx` | ย้ายแคลนแบบกลุ่มพร้อมกล่องย่อขยายอัตโนมัติ | ✅ ปรับแต่งได้ |
| `DiamondVaultModal.tsx` | ฝาก-ถอนเพชรส่วนกลาง, ประวัติธุรกรรม, สแนปช็อตการ์ด | ✅ ปรับแต่งได้ |
| `GeminiKeyModal.tsx` | ตั้งค่า/ทดสอบ Gemini API Key ตรวจสอบตรงกับ Google | ⚠️ เฉพาะ Owner |
| `OwnerResetModal.tsx` | ล้างข้อมูลระบบเพื่อเริ่มรอบใหม่ (ต้องพิมพ์ RESET) | ⚠️ เฉพาะ Owner |
| `DiscordWebhookModal.tsx` | ตั้งค่า Webhook URL แจ้งเตือน Discord | ✅ ปรับแต่งได้ |
| `BackgroundSettingsModal.tsx` | เปลี่ยนภาพพื้นหลังปราสาท, ปรับความมืด/เบลอ | ✅ ปรับแต่งได้ |

---

## 💾 5. ข้อมูลการสำรองระบบ (System Backups Registry)
- **ไฟล์ Source Code Backup:** `backup-v1.8.0-stable.zip` (ขนาด ~4.0 MB ครอบคลุม Source Code, สคริปต์, คอนฟิก และเอกสารทั้งหมด)
- **ไฟล์ Database Snapshot:** `backups/firestore_snapshot_v1.8.0.json` และ `backups/firestore_snapshot_latest.json` (สำรองข้อมูล Users, Clans, Item Queues, และ Settings จาก Cloud Firestore ทั้งหมด 100%)
- **การกู้คืนข้อมูล (Restore):** ใช้สคริปต์ในโฟลเดอร์ `scripts/` เพื่อกู้คืนฐานข้อมูลหากเกิดเหตุฉุกเฉิน
