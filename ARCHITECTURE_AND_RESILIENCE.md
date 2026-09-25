# 🏛️ Architecture & Zero-Downtime Resilience Guide
## Lineage 2M Clan Hub & Guild Vault (Kain 7)

> **คำเตือนสำคัญสำหรับผู้พัฒนาทุกคน (Crucial Notice for All Developers):**
> โปรเจกต์นี้ได้รับการออกแบบตามแนวทาง **Zero-Downtime Multi-Tier Architecture** เพื่อให้ระบบทำงานได้ 100% ตลอดเวลา แม้ในภาวะที่โควต้าใช้งานฟรีรายวันของ Google Cloud Firestore หมดลง (`RESOURCE_EXHAUSTED`) 
> ห้ามแก้ไขโค้ดที่ละเมิดกฎในเอกสารฉบับนี้เป็นอันขาด เพราะจะทำให้หน้าเว็บค้าง ปุ่มกดไม่ตอบสนอง หรือข้อความแจ้งเตือนผิดพลาด

---

## 1. สถาปัตยกรรมความทนทาน 5 ชั้น (5-Tier Failover Hierarchy)

ระบบจะจัดลำดับความสำคัญของแหล่งข้อมูลและการทำงานจากบนลงล่าง โดยไม่ยอมให้ชั้นล่างสุดที่เกิดข้อผิดพลาดมาหยุดการทำงานของชั้นบน:

```mermaid
flowchart TD
    UI["📱 UI Layer / React Components"]
    T1["⚡ Tier 1: React State (Memory) < 1ms"]
    T2["💾 Tier 2: LocalStorage & Cache"]
    T3["🌐 Tier 3: Live State Server Relay (/api/live-state)"]
    T4["📊 Tier 4: Google Sheets & Google Drive Backup"]
    T5["🔥 Tier 5: Google Cloud Firestore & Firebase Auth"]

    UI -->|1. Optimistic Update| T1
    T1 -->|2. Instant Local Persistence| T2
    T1 -->|3. Cross-device Broadcast| T3
    T1 -->|4. Automated Snapshot| T4
    T1 -.->|5. Non-blocking Timeout Guard (1200ms)| T5
```

1. **Tier 1: React State (Memory - เร็วที่สุด < 1ms)**
   - ทุก Action (เพิ่มไอเทม, เคลมไอเทม, อัปเดตสเตตัส, แจกไอเทม) ต้องทำ **Optimistic Update** ทันที เพื่อให้ผู้ใช้เห็นผลทันทีโดยไม่ต้องรอผลตอบกลับจากเซิร์ฟเวอร์
2. **Tier 2: LocalStorage & In-Memory Cache (ความปลอดภัยระดับเครื่องผู้ใช้)**
   - จัดเก็บข้อมูลล่าสุดผ่าน `setCachedVaultItems`, `setCachedUsers`, `setCachedQueues`, `setCachedDiscordSettings`
   - เมื่อผู้ใช้กด Refresh หรือเปิดเว็บตอนออฟไลน์ ข้อมูลต้องแสดงผลทันที ไม่ค้างหน้าจอขาว
3. **Tier 3: Live State Server Relay (`/api/live-state`)**
   - กระจายข้อมูลข้ามเครื่องและข้ามแท็บผ่าน SSE (Server-Sent Events) และ HTTP POST
   - สมาชิกทุกคนในแคลนจะเห็นไอเทมใหม่พร้อมกันแบบ Real-time โดยไม่ต้องพึ่งพา Firestore Realtime Listener
4. **Tier 4: Google Sheets Web App & Drive Backup (คลาวด์สำรองอัตโนมัติ)**
   - ซิงค์ข้อมูลทั้งหมดอัตโนมัติแบบ Debounced ไปยัง Google Sheets ซึ่งไม่มีปัญหาเรื่องโควต้าเขียนรายวัน
5. **Tier 5: Google Cloud Firestore & Firebase Auth (ฐานข้อมูลหลัก)**
   - ปฏิบัติการในฐานะฐานข้อมูลหลัก แต่ถูกควบคุมด้วย **Timeout Guard** อย่างเข้มงวด

---

## 2. กฎเหล็กการเขียน Firestore (The Firestore Quota Exhaustion Rule)

### ทำไมระบบถึงเคยค้าง?
Firestore JavaScript SDK มีกลไก Offline Persistence และ Retry Loop อัตโนมัติ เมื่อโควต้าเขียนของ Free Tier เต็ม (`RESOURCE_EXHAUSTED` / Quota Exceeded) หรือเครือข่ายขัดข้อง คำสั่ง `await setDoc()`, `await updateDoc()` หรือ `await deleteDoc()` **จะไม่ throw error ทันที แต่จะค้างรอ (hang) นาน 30–60 วินาที หรือไม่ยอม resolve** ส่งผลให้:
- State `isSaving` หรือ `isCreating` ค้างอยู่ที่ `true`
- ปุ่มกดขึ้นสถานะ `"กำลังโหลด..."` หรือ `"กำลังบันทึก..."` ตลอดกาล
- โค้ดบรรทัดถัดไป (เช่น การส่ง Discord Webhook หรือการปิด Modal) ไม่ถูกเรียกใช้งาน

### ข้อกำหนดภาคบังคับสำหรับโค้ด Firestore ทุกจุด:
1. **ห้ามเรียก `await setDoc(...)` หรือ `await updateDoc(...)` โดยตรงเด็ดขาด**
2. **ต้องครอบด้วยฟังก์ชัน `safeFirestoreWrite` เสมอ:**
   ```typescript
   // ❌ ผิด (ห้ามทำเด็ดขาด - จะทำให้ระบบค้างเมื่อโควต้าเต็ม)
   await setDoc(doc(db, 'items', itemId), cleanItem);

   // ✅ ถูกต้อง (ใช้ safeFirestoreWrite พร้อม Timeout Guard 1200ms)
   await safeFirestoreWrite(
     setDoc(doc(db, 'items', itemId), cleanItem),
     1200,
     'addVaultItemDoc'
   );
   ```
3. **Optimistic Updates & Local Cache ต้องเกิดขึ้นก่อน:**
   - บันทึกลง LocalStorage (`setCachedVaultItems`) และยิง `broadcastLiveState()` ก่อนหรือควบคู่กับ Firestore เสมอ

---

## 3. กฎมาตรฐานการแจ้งเตือน Discord (Discord Webhook Rules)

**ข้อกำหนดภาคบังคับสำหรับระบบ Discord Webhook ตาม Rule 5:**

1. **ขอบเขตการแจ้งเตือน (Item-Only Notifications):**
   - ส่งแจ้งเตือน Discord **เฉพาะฟังก์ชันที่เกี่ยวกับไอเทมเท่านั้น:**
     - `new_item` เมื่อมีไอเทมใหม่เข้าคลัง/ประกาศไอเทม
     - `distribute` เมื่อแจกไอเทมให้สมาชิก
     - `test` เมื่อกดปุ่มทดสอบ Webhook ในหน้าตั้งค่า
   - **ห้าม** ส่งแจ้งเตือน Discord สำหรับเรื่องสเตตัส (`stat_request`, `stat_approval`, `power_level`) โดยเด็ดขาด ทั้งฝั่ง Client และ Server มีตัวกรอง Drop ทิ้งทันที

2. **ภาษาใน Discord ต้องเป็นภาษาอังกฤษ 100% (Strictly 100% English):**
   - ข้อความทั้งหมดที่ส่งเข้า Discord (Headers, Titles, ANSI Code Blocks, Fields, Footers, Links) **ต้องเป็นภาษาอังกฤษ 100% เสมอ**
   - ห้ามมีภาษาไทยส่งเข้าไปในห้องแชท Discord

3. **รูปแบบข้อความไอเทมใหม่ (Option 1 สั้นกระชับ + ฟอนต์ ANSI มีสี + รูปขวาบน):**
   - **ห้ามใส่ Title ซ้ำซ้อน (Strictly No Duplicate Title):** ห้ามใส่ฟิลด์ `title: ⚔️ [RARITY] <Item Name>` ใน Embed เพราะจะซ้ำกับบรรทัดที่ 1 ของกรอบ ANSI
   - **ตัดบรรทัดคนล่าออกถาวร (Completely Remove Hunters Line):** ไม่ต้องแสดงรายชื่อคนล่า (`⚔️ Hunters:`) ในข้อความ Discord ตัดออก 100% เพื่อความกระชับ
   - **กรอบ ANSI Code Block มีเพียง 2 บรรทัดเท่านั้น:**
     ```ansi
     [RARITY] Item Name (xQty)
     💎 Price: X Diamonds (หรือ Price: FREE (0 Diamonds))
     ```
     - สี ANSI: 🟨 `\u001b[1;33m` (MYTHIC), 🟪 `\u001b[1;35m` (LEGEND), 🟥 `\u001b[1;31m` (EPIC), 🟦 `\u001b[1;36m` (RARE)
     - สีราคา: ขาวสว่าง `\u001b[1;37m`
   - **ลิงก์เคลม:** `👉 [Open Vault to Claim Item](url)`
   - **รูป Thumbnail:** ต้องเป็นรูปไอเทมจริงที่อัปโหลด/ใส่ URL ไว้ที่มุมขวาบนของการ์ด Discord

4. **การส่งอัตโนมัติ (Auto-Post Fallback):**
   - ใน `handleCreateVaultItem` และ `handleDistributeItem` ระบบจะตรวจสอบ URL จาก 3 แหล่งตามลำดับ:
     `discordSettings?.webhookUrl` ➔ `getCachedDiscordSettings()?.webhookUrl` ➔ `localStorage.getItem('vault_discord_webhook_url')`
   - หากพบ URL ระบบจะยิง Webhook ไปยัง Backend Proxy (`/api/discord-webhook`) หรือ Direct Fallback ทันทีโดยไม่ถูกบล็อกด้วย Firestore

---

## 4. ระบบสองภาษา 100% ทุกจุด (Mandatory Bilingual TH & EN)

ทุกการแก้ไขหรือเพิ่ม Component ใหม่ **ต้องรองรับ 2 ภาษา (ไทย และ อังกฤษ) เสมอ**:
- หัวข้อ (Headers), คำอธิบาย (Descriptions), ป้ายระบุ (Badges), ปุ่มกด (Buttons)
- ช่องกรอกข้อมูล (Placeholders, Inputs)
- ข้อความแจ้งเตือน (Toasts, Alerts, Error Messages)
- รูปแบบโค้ด:
  ```tsx
  <span>{lang === 'th' ? 'ข้อความภาษาไทย' : 'English message'}</span>
  ```

---

## 5. การรันคำสั่ง Node บน Windows (Windows Node Execution Rule)

ในเครื่องนี้ **ห้ามพิมพ์คำสั่ง `npm` หรือ `pnpm` แบบชื่อเปล่า** (เช่น `npm run build` หรือ `npm test`) เพราะ Windows จะเปิดหน้าต่างถามเลือกแอป (`Select an app to open 'npm'`)

ให้เรียกใช้ Node ด้วย Absolute Path ที่ผ่านการทดสอบแล้วเสมอ:
```powershell
# 1. ตรวจสอบ Type Check (TypeScript)
& 'C:\Program Files\nodejs\node.exe' 'node_modules\typescript\bin\tsc' --noEmit

# 2. Build Frontend & Server Bundles
& 'C:\Program Files\nodejs\node.exe' 'node_modules\vite\bin\vite.js' build
& 'C:\Program Files\nodejs\node.exe' 'node_modules\esbuild\bin\esbuild' api/_entry.ts --bundle --platform=node --format=esm --packages=external --outfile=api/index.js
& 'C:\Program Files\nodejs\node.exe' 'node_modules\esbuild\bin\esbuild' server.ts --bundle --platform=node --format=esm --packages=external --sourcemap --outfile=dist/server.js
```

---

## 6. กฎ Local-First และการ Deploy (Rule 2)

- ทุกฟีเจอร์และการแก้ไขต้องทดสอบบน Local Server (`http://localhost:3000`) จนสมบูรณ์
- **ห้าม** รันคำสั่ง `git push` หรือ deploy ขึ้น Vercel (`vercel --prod`) จนกว่าผู้ใช้งานจะพิมพ์คำสั่งยืนยันอย่างชัดเจน

---

## 7. ระบบ Heartbeat Version Hub (Quota Optimization - v2.10.15)

เพื่อลดอัตราการอ่าน Firestore Reads ลง **80–90%** ทั่วโลก:
1. **1 Heartbeat Document Listener แทน 13 Collection Listeners:**
   - Client ฟังเฉพาะเอกสาร `system_meta/version_hub` เพียงตัวเดียว (1 Read ต่อคน)
   - ข้อมูล Local Cache แสดงผลทันทีใน 0ms
2. **Event-Driven Collection Fetching:**
   - หากไม่มีการอัปเดต ไม่มีการอ่านคอลเลกชันใด ๆ เพิ่มเติม (0 Reads!)
   - เมื่อมี Action (เพิ่มไอเทม, เคลม, สมัครสมาชิก, อัปเดตสเตตัส) ฟังก์ชันจะเรียก `bumpSystemVersion('<category>')` แบบ Atomic ใน Firestore
   - ทุกเครื่องทั่วโลกจะรู้ทันทีผ่าน Snapshot ของ `version_hub` และโหลดเฉพาะคอลเลกชันที่เปลี่ยนแปลงมาอัปเดตหน้าจอทันที (<200ms)

