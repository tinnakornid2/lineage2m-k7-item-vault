# 🚀 คู่มือการเตรียมงานและ Deploy ขึ้น Production (Deployment Guide)

> **Lineage 2M Clan Hub & Boss Item Vault (Version: v2.10.50)**  
> เอกสารฉบับนี้รวบรวมขั้นตอนการเตรียมความพร้อม (Pre-flight Checklist), การตั้งค่า Environment Variables, ขั้นตอนการ Deploy สู่ Vercel, และแผนรับมือเหตุฉุกเฉิน (Disaster Recovery Runbook)

---

## 📋 เช็คลิสต์ก่อน Deploy (Pre-Flight Verification Checklist)

ก่อนทำการอัปโหลดหรือสั่ง Deploy ขึ้น Production **ต้องผ่านการตรวจสอบทั้ง 4 ข้อนี้ 100%**:

| ลำดับ | รายการตรวจสอบ | คำสั่ง / วิธีตรวจสอบ | เกณฑ์ที่ต้องผ่าน |
| :---: | :--- | :--- | :--- |
| **1** | **TypeScript Typecheck** | `& 'C:\Program Files\nodejs\node.exe' 'node_modules\typescript\bin\tsc' --noEmit` | **0 Error** (ห้ามมี Type error แม้แต่จุดเดียว) |
| **2** | **Vite Production Build** | `& 'C:\Program Files\nodejs\node.exe' 'node_modules\vite\bin\vite.js' build` | **Build ผ่านสมบูรณ์** ได้โฟลเดอร์ `dist/` ภายในเวลา ~10-15 วินาที |
| **3** | **การทดสอบบนเครื่อง Local** | ทดสอบบน `http://localhost:3000` | • ลากสลับตำแหน่งกล่องไอเทม (Drag & Drop) ได้ลื่นไหล<br>• สลับภาษา TH/EN แล้วข้อความเปลี่ยน 100%<br>• ไม่มีภาษาผสมกันหรือ Console Error ร้ายแรง |
| **4** | **ตรวจสอบเลขเวอร์ชัน SemVer** | ตรวจสอบ 6 ไฟล์สำคัญ (ดูตารางด้านล่าง) | ทุกไฟล์ต้องมีเลขเวอร์ชัน **`v2.10.50`** ตรงกัน 100% |

### จุดที่ต้องตรวจเช็กเลขเวอร์ชัน (6 Files Version Synchronization):
1. [`package.json`](file:///d:/lineage2m-k7-item-vault/package.json) ➔ `"version": "2.10.50"`
2. [`src/services/firebase.ts`](file:///d:/lineage2m-k7-item-vault/src/services/firebase.ts) ➔ `CACHE_SCHEMA_VERSION = '2.10.50-draggable-item-queue-cards'`
3. [`src/components/Sidebar.tsx`](file:///d:/lineage2m-k7-item-vault/src/components/Sidebar.tsx) ➔ `v2.10.50`
4. [`src/components/Navbar.tsx`](file:///d:/lineage2m-k7-item-vault/src/components/Navbar.tsx) ➔ `v2.10.50`
5. [`src/components/LoginScreen.tsx`](file:///d:/lineage2m-k7-item-vault/src/components/LoginScreen.tsx) ➔ `v2.10.50`
6. [`src/components/GoogleDriveBackupModal.tsx`](file:///d:/lineage2m-k7-item-vault/src/components/GoogleDriveBackupModal.tsx) ➔ `schemaVersion: '2.10.50'` และ `v2.10.50`

---

## 🔑 ตัวแปรสภาพแวดล้อม (Environment Variables)

กำหนดค่าในไฟล์ `.env` สำหรับ Local Development หรือตั้งค่าใน **Vercel Dashboard > Project Settings > Environment Variables**:

| ตัวแปร (Key) | คำอธิบาย | ขอบเขตความปลอดภัย |
| :--- | :--- | :--- |
| `VITE_FIREBASE_API_KEY` | Firebase Client API Key | Frontend Public |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Authentication Domain | Frontend Public |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID | Frontend Public |
| `VITE_FIREBASE_STORAGE_BUCKET` | Cloud Storage Bucket URL | Frontend Public |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging Sender ID | Frontend Public |
| `VITE_FIREBASE_APP_ID` | Firebase App ID | Frontend Public |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Firebase Admin Service Account JSON (สำหรับ API endpoints) | **Backend Secret** |
| `GEMINI_API_KEY` | Google Gemini AI OCR Key (สามารถตั้งค่าผ่านหน้าเว็บโดย Owner ได้) | **Secret** |

---

## 🚢 ขั้นตอนการ Deploy ขึ้น Production (Vercel)

> [!CAUTION]
> 🛑 **กฎเหล็กข้อที่ 2 (Strict Local-First & Zero Auto-Deploy):**  
> **ห้าม AI หรือนักพัฒนาสั่ง `git push` หรือ `vercel --prod` โดยเด็ดขาด 100%** จนกว่าผู้ใช้งานจะพิมพ์คำสั่งยืนยัน เช่น *"ดีพลอยได้เลย"* อย่างชัดเจน เพื่อป้องกันการผลาญโควต้า Build Minutes และไม่ให้เกิดค่าบริการ Vercel Pro ($20/เดือน หรือ ~9,000 บาท/ปี) ให้ทดสอบบน Localhost:3000 ให้เรียบร้อยเท่านั้น

### ทางเลือกที่ 1: Deploy ผ่าน Vercel CLI (แนะนำ)
เมื่อผู้ใช้งานสั่งให้อัปโหลด ให้เปิด Terminal และรัน:

```powershell
# 1. รันตรวจสอบความพร้อมครั้งสุดท้าย
& 'C:\Program Files\nodejs\node.exe' 'node_modules\typescript\bin\tsc' --noEmit
& 'C:\Program Files\nodejs\node.exe' 'node_modules\vite\bin\vite.js' build

# 2. ทำการ Deploy ขึ้น Production โดยตรง
vercel --prod
```

### ทางเลือกที่ 2: Deploy ผ่าน Git Push
```powershell
git add .
git commit -m "release: v2.10.50 - draggable item queue cards & unified documentation"
git push origin main
```
ระบบ CI/CD ของ Vercel จะตรวจจับ Commit และเริ่มกระบวนการ Build อัตโนมัติ

### การตั้งค่าโปรเจกต์บน Vercel (Project Build Settings):
- **Framework Preset:** `Vite`
- **Root Directory:** `./`
- **Build Command:** `vite build`
- **Output Directory:** `dist`
- **Install Command:** `npm install` (หรือคำสั่ง install เริ่มต้นของ Vercel)
- **Node.js Version:** `18.x` หรือ `20.x`

---

## 🔍 การทดสอบหลัง Deploy (Post-Deployment Smoke Tests)

เมื่อ Deploy เสร็จสิ้น ให้เข้าไปที่ Live Production URL แล้วตรวจสอบรายการต่อไปนี้:
1. **แถบเวอร์ชัน:** หน้าจอ Login, Navbar และ Sidebar ต้องแสดงป้าย `v2.10.50` ชัดเจน
2. **การเข้าสู่ระบบ:** ล็อกอินด้วยบัญชี Owner (`eloni`) และตรวจสอบว่าเมนูและปุ่มตั้งค่าแสดงครบ
3. **การลากสลับคิวไอเทม (v2.10.50):** ทดสอบคลิกลากกล่องไอเทมในหน้า Item Queue สลับตำแหน่ง แล้วรีเฟรชหน้าจอเพื่อตรวจเช็กว่าตำแหน่งใหม่อยู่คงเดิม
4. **ระบบสองภาษา:** กดสลับภาษา TH และ EN ตรวจสอบว่าปุ่มและคำอธิบายเปลี่ยนภาษาถูกต้อง 100%
5. **ทดสอบ Discord Webhook:** เข้าหน้าต่างตั้งค่า Discord แล้วกดปุ่ม "ทดสอบส่งการแจ้งเตือน" เพื่อตรวจเช็กการเชื่อมต่อห้องแชท

---

## 🛡️ แผนรับมือเหตุฉุกเฉินและการกู้คืนระบบ (Disaster Recovery & Runbook)

### กรณีที่ 1: โควต้า Firebase Firestore เต็ม (`RESOURCE_EXHAUSTED`)
- **อาการ:** คลาวด์ Firebase ปฏิเสธคำสั่งเขียนข้อมูลรายวันเนื่องจากเกินโควต้าฟรี
- **การทำงานของระบบ:** สถาปัตยกรรม 5 ชั้น (Tier 1-3) จะทำงานแทนที่ทันที! หน้าเว็บจะไม่ค้างปุ่มหมุนเพราะมี `safeFirestoreWrite` ตัดจบภายใน 1.5 วินาที สมาชิกสามารถใช้งาน, ลากสลับคิว, และขอรับไอเทมได้ตามปกติผ่าน LocalStorage และ Live Relay Server
- **แนวทางแก้ไข:** โควต้าฟรีของ Google Firebase จะรีเซ็ตใหม่อัตโนมัติทุกวันเวลา 14:00 น. (เวลาประเทศไทย) หรือ Owner สามารถอัปเกรดเป็นแพ็กเกจ Blaze Plan ได้ตามต้องการ

### กรณีที่ 2: ข้อมูลในเบราว์เซอร์ของสมาชิกแสดงผลเพี้ยนหรือไม่ตรงกับปัจจุบัน
- **สาเหตุ:** เบราว์เซอร์ค้างข้อมูลแคชเก่าใน LocalStorage
- **แนวทางแก้ไข:**
  - สมาชิกสามารถกดปุ่ม **"ล้างแคชและโหลดข้อมูลใหม่"** ที่มุมการตั้งค่า
  - หรือผู้ดูแลระบบสามารถปรับเพิ่มเลข `CACHE_SCHEMA_VERSION` ใน [`src/services/firebase.ts`](file:///d:/lineage2m-k7-item-vault/src/services/firebase.ts) ซึ่งจะบังคับให้ทุกเครื่องที่เปิดเว็บล้างข้อมูลเก่าและดึงข้อมูลใหม่ล่าสุดโดยอัตโนมัติ

### กรณีที่ 3: ต้องการกู้คืนข้อมูลย้อนหลังทั้งระบบ (Full Database Restore)
1. ให้ Owner เข้าสู่ระบบ
2. กดเปิดเมนู **"สำรองและกู้คืนข้อมูล (Google Drive / JSON Backup)"**
3. กดปุ่ม **"กู้คืนจากไฟล์ (Restore Backup)"**
4. เลือกไฟล์ Snapshot สำรองล่าสุด เช่น ไฟล์จากโฟลเดอร์ `backups/` หรือไฟล์ `.json` ที่ดาวน์โหลดไว้
5. ระบบจะแสดงรายการสรุปจำนวนสมาชิก, ไอเทม และยอดเพชร ให้กด **"ยืนยันกู้คืนข้อมูลทันที"**
6. ข้อมูลจะถูกเขียนทับลงในฐานข้อมูลกลาง และบรอดแคสต์อัปเดตเครื่องทุกคนทันทีใน 1 วินาที
