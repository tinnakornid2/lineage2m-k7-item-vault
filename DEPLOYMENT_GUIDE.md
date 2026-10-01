# 🚀 คู่มือการเตรียมงานและ Deploy ขึ้น Production (Deployment Guide)

> **Lineage 2M Clan Hub & Boss Item Vault (Version: v2.10.71)**  
> เอกสารฉบับนี้รวบรวมขั้นตอนการเตรียมความพร้อม (Pre-flight Checklist), การตั้งค่า Environment Variables, ขั้นตอนการ Deploy สู่ Vercel, และแผนรับมือเหตุฉุกเฉิน (Disaster Recovery Runbook)

---

## 📋 เช็คลิสต์ก่อน Deploy (Pre-Flight Verification Checklist)

ก่อนทำการอัปโหลดหรือสั่ง Deploy ขึ้น Production **ต้องรันคำสั่งตรวจสอบอัตโนมัติภาคบังคับ (Automated Pre-Flight Check)**:

```powershell
& 'C:\Program Files\nodejs\node.exe' 'scripts/pre-flight-check.mjs'
```

คำสั่งนี้จะทำการตรวจสอบและรันการคอมไพล์ครบทั้ง 7 ด่าน:
1. **Version Synchronization:** ตรวจสอบเลขเวอร์ชัน **`v2.10.71`** ตรงกันครบทั้ง 6 ไฟล์
2. **TypeScript Typecheck:** `tsc --noEmit` 0 error
3. **Frontend Build:** `vite build` สร้างไฟล์หน้าบ้านใน `dist/` สำเร็จ
4. **Backend Serverless Bundling:** `esbuild api/_entry.ts` สร้าง `api/index.js` ล่าสุด
5. **Server Bundling:** `esbuild server.ts` สร้าง `dist/server.js`
6. **Environment Variables (.env):** ตรวจเช็กตัวแปรจำเป็น
7. **LocalStorage Quota Shield & Security Rules:** ตรวจสอบระบบดักจับโควต้าและโครงสร้าง `firestore.rules`

---

## ⚠️ 7 ข้อแตกต่างสำคัญระหว่าง Localhost กับ Production บน Vercel

| ปัจจัยความต่าง | บนเครื่อง Local (ทำงานได้) | บน Vercel Production (จุดที่มักมีปัญหา) | วิธีป้องกัน / แนวทางปฏิบัติ |
| :--- | :--- | :--- | :--- |
| **1. ลักษณะการรันเซิร์ฟเวอร์** | เซิร์ฟเวอร์ Node.js เปิดค้างตลอดเวลา มี RAM ต่อเนื่อง | **Serverless Function (AWS Lambda)** มี Cold Start ทุก 5-15 นาที ไฟล์ใน `/tmp` และ RAM หายหมดเมื่อหยุดทำงาน | **ห้ามพึ่งพา RAM หรือไฟล์ชั่วคราวเพียงอย่างเดียว** ทุกข้อมูลต้อง Dual-Write ลง Firestore หรือ Google Sheets เสมอ |
| **2. คำสั่ง Build Backend** | รันผ่าน `tsx server.ts` คอมไพล์ TypeScript สดตลอด | หากตั้งค่า Build Command บน Vercel เป็นแค่ `vite build` จะทำให้ `api/index.js` **ไม่ถูกอัปเดต** กลายเป็นโค้ดเก่า | **บังคับใช้ Build Command:** `npm run build` ในการตั้งค่า Vercel Dashboard เสมอ |
| **3. ตัวแปร Environment Variables** | อ่านจากไฟล์ `.env` ในเครื่องโดยตรง | หากใน Vercel Dashboard ใส่ตัวแปรไม่ครบ หรือขาดตัวแปร `VITE_` หน้าเว็บจะกลายเป็น `undefined` | เช็คค่าใน **Vercel Dashboard > Project Settings > Environment Variables** ให้ตรงกับ `.env` 100% |
| **4. โดเมนที่อนุญาตใน Firebase** | มี `localhost` เป็นค่าเริ่มต้นอยู่แล้ว | หากไม่ได้นำโดเมนของ Vercel ไปใส่ใน Firebase Authentication สมาชิกจะ **ล็อกอินไม่ได้เด็ดขาด** (`auth/unauthorized-domain`) | เพิ่มโดเมน `xxx.vercel.app` ใน **Firebase Console > Authentication > Settings > Authorized Domains** |
| **5. แคชเบราว์เซอร์ผู้ใช้จริง** | มักทดสอบในหน้าต่างใหม่ LocalStorage ว่าง 5 MB | สมาชิกเดิมมีประวัติรูปภาพ Base64 สะสม จนชนเพดาน 5 MB ทำให้เกิด `QuotaExceededError` บันทึกไม่เข้า | ใน v2.10.71 มี **Auto-Pruning Quota Shield** สแกนและลดขนาดแคชเหลือ < 200 KB อัตโนมัติ |
| **6. กฎความปลอดภัย Firestore Cloud** | บางครั้งทดสอบผ่าน Relay หรือสิทธิ์ Admin | Cloud จริงจะตรวจ `firestore.rules` เข้มงวด หากมีฟิลด์ใหม่ที่ไม่อยู่ใน `hasOnly(...)` จะโดน `PERMISSION_DENIED` | อัปเดต whitelist ใน `firestore.rules` ทุกครั้งที่มีการเพิ่มฟิลด์ใหม่ใน TypeScript |
| **7. แคชของ CDN / Edge Network** | ไม่มี CDN แคชหน้าเว็บ | Vercel มี Edge Caching อาจเสิร์ฟไฟล์ API หรือ JS เก่า | มีการตั้ง `Cache-Control: no-store` และ `v=${version}` ในการดึง API เสมอ |

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

> [!WARNING]
> ตาม **กฎเหล็กข้อที่ 2 (Local First Rule)**: ห้ามรันคำสั่ง `git push` หรือ `vercel --prod` จนกว่าผู้ใช้งานจะพิมพ์คำสั่งยืนยันให้อัปโหลดอย่างชัดเจน

### การเตรียมความพร้อมก่อน Deploy:
```powershell
# รันตรวจสอบอัตโนมัติครบ 7 ด่าน (ต้องได้ PASS 7/7)
& 'C:\Program Files\nodejs\node.exe' 'scripts/pre-flight-check.mjs'
```

### การตั้งค่าโปรเจกต์บน Vercel (Project Build Settings - สำคัญมาก):
- **Framework Preset:** `Vite`
- **Root Directory:** `./`
- **Build Command:** `npm run build` *(ห้ามใช้ vite build เพียงอย่างเดียว เพราะจะไม่ Bundle `api/index.js`)*
- **Output Directory:** `dist`
- **Install Command:** `npm install`
- **Node.js Version:** `20.x` หรือ `22.x`

---

## 🔍 การทดสอบหลัง Deploy (Post-Deployment Smoke Tests)

เมื่อ Deploy เสร็จสิ้น ให้เข้าไปที่ Live Production URL แล้วตรวจสอบรายการต่อไปนี้:
1. **แถบเวอร์ชัน:** หน้าจอ Login, Navbar และ Sidebar ต้องแสดงป้าย `v2.10.71` ชัดเจน
2. **การเข้าสู่ระบบ:** ล็อกอินด้วยบัญชี Owner (`eloni`) และตรวจสอบว่าเมนูและปุ่มตั้งค่าแสดงครบ
3. **การลากสลับคิวไอเทม (v2.10.71):** ทดสอบคลิกลากกล่องไอเทมในหน้า Item Queue สลับตำแหน่ง แล้วรีเฟรชหน้าจอเพื่อตรวจเช็กว่าตำแหน่งใหม่อยู่คงเดิม
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
