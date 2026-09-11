const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Writing Manuals...');

// 1. THAI MARKDOWN
const thMarkdown = `# คู่มือการใช้งานระบบ Lineage2M Clan Hub (v1.4.0)
**ศูนย์กลางกิลด์ & คลังไอเทมบอส Lineage 2M**

คู่มือนี้สรุปหน้าที่ของทุกหน้าและทุกปุ่มในระบบอย่างกระชับ เข้าใจง่าย เพื่อให้สมาชิกและผู้ดูแลระบบสามารถใช้งานได้อย่างถูกต้องและรวดเร็ว พร้อมระบบใหม่ **Copy-Paste (Ctrl + V)** สำหรับวางรูปภาพทันที และระบบ **กำหนดค่าพลังตอนสมัคร & ขออนุมัติอัปเดต CP**

---

## สารบัญ
1. [สิทธิ์ผู้ใช้งาน (User Roles)](#1-สิทธิ์ผู้ใช้งาน-user-roles)
2. [แถบเมนูด้านบนและเครื่องมือหลัก (Top Bar & Utilities)](#2-แถบเมนูด้านบนและเครื่องมือหลัก-top-bar--utilities)
3. [หน้าแดชบอร์ด (Dashboard)](#3-หน้าแดชบอร์ด-dashboard)
4. [หน้าคลังไอเทมบอส (Item Vault)](#4-หน้าคลังไอเทมบอส-item-vault)
5. [หน้าคิวรับไอเทม (Item Queue)](#5-หน้าคิวรับไอเทม-item-queue)
6. [หน้าทำเนียบสมาชิก (All Members)](#6-หน้าทำเนียบสมาชิก-all-members)
7. [หน้าจัดการแคลน (Clan Management)](#7-หน้าจัดการแคลน-clan-management)
8. [หน้าต่างเครื่องมือพิเศษ (Special Modals)](#8-หน้าต่างเครื่องมือพิเศษ-special-modals)

---

## 1. สิทธิ์ผู้ใช้งาน (User Roles)

| บทบาท (Role) | สิทธิ์และการเข้าถึง |
| :--- | :--- |
| 👑 **Owner (เจ้าของระบบ)** | ควบคุมระบบสูงสุด แต่งตั้ง/ปลด Admin, จัดการรีเซ็ตระบบ, ควบคุม API Key และเข้าถึงได้ทุกฟังก์ชัน |
| 🛡️ **Admin (ผู้ดูแลระบบ)** | เพิ่ม/แก้ไข/แจกจ่ายไอเทม, สร้างและจัดการคิว, อนุมัติสมาชิกใหม่, อนุมัติคำขอ CP, ฝาก-ถอนเพชร |
| ⚔️ **Manager (ผู้จัดการแคลน)** | ช่วยดูแลจัดการสมาชิกและบันทึกคิวไอเทม |
| 👤 **Member (สมาชิกทั่วไป)** | ตรวจสอบคลังไอเทม, กดขอรับไอเทม (Claim), ขออัปเดตค่าพลัง CP ของตนเอง |

---

## 2. แถบเมนูด้านบนและเครื่องมือหลัก (Top Bar & Utilities)

| ปุ่ม / เมนู | ไอคอน | หน้าที่การทำงาน |
| :--- | :---: | :--- |
| **LINEAGE 2M CLAN HUB (v1.3.0)** | 👑 | โลโก้ประจำเว็บ คลิกเมื่อใดก็ได้เพื่อกลับสู่ **หน้าแดชบอร์ด** ทันที |
| **กล่องคลังเพชรกลาง** | 💎 | แสดงยอดเพชรคงเหลือในกองทุนกลาง คลิกเพื่อเปิดหน้าต่าง **ฝาก-ถอนเพชร** |
| **ขออัปเดตค่าพลัง (CP Badge)** | ⚡ | แสดงค่าพลัง CP ปัจจุบันของสมาชิก คลิกเพื่อเปิดหน้าต่าง **ขออัปเดตค่าพลังใหม่** |
| **ตั้งค่าภาพพื้นหลัง** | ✨ | เปิดหน้าต่างเปลี่ยนภาพพื้นหลังปราสาท ปรับความสว่าง และความเบลอ |
| **เปิด/ปิดเสียง** | 🔊 / 🔇 | สลับเปิดหรือปิดเสียงเอฟเฟกต์คลิก/แจ้งเตือนของระบบ |
| **สลับภาษา (TH / EN)** | 🌐 | สลับภาษาของระบบระหว่าง **ภาษาไทย** และ **English** ทันที |
| **เข้าสู่ระบบ / ออกจากระบบ** | 👤 / 🚪 | เข้าใช้งานบัญชีสมาชิก หรือออกจากระบบ |
| **เมนูนำทาง (Nav Tabs)** | 📑 | สลับไปยังหน้า: แดชบอร์ด, คลังไอเทม, คิวไอเทม, สมาชิก, และจัดการแคลน |

---

## 3. หน้าแดชบอร์ด (Dashboard)
**ศูนย์รวมภาพรวมกิลด์ ไอเทมที่กำลังเปิดให้ขอรับ และประวัติธุรกรรมเพชร**

### องค์ประกอบและปุ่มในหน้านี้
* **กล่องคลังเพชร (Diamond Vault Card):**
  * ปุ่ม **"ฝากเพชร / ถอนเพชร"** *(Admin/Owner)*: ฝากหรือเบิกถอนเพชรพร้อมบันทึกเหตุผล
* **ไทม์ไลน์ธุรกรรม (Transaction Timeline):** แสดง 10 รายการฝาก-ถอนเพชรล่าสุด คลิก **"ดูทั้งหมด"** เพื่อเปิดดูประวัติเต็ม
* **ตารางไอเทมเปิดรับเครม (Active Claimable Items):**
  * **รูปไอเทม:** คลิกเพื่อ **ซูมดูรูปขนาดเต็ม**
  * **ปุ่ม "ลงชื่อเครม" (Claim Item):** สมาชิกที่ค่าพลัง CP ผ่านเกณฑ์กดเพื่อแสดงความประสงค์ขอรับของ
  * **ปุ่ม "ยกเลิกเครม" (Cancel Claim):** สมาชิกกดยกเลิกการลงชื่อเครมได้ตลอดเวลาก่อนแจก
  * **ปุ่ม "ดูผู้เครม" (View Claimants):** ดูรายชื่อสมาชิกที่มาลงชื่อ เรียงตามพลังรบและเวลา
  * **ปุ่ม "แจกไอเทม" (Distribute Item)** *(Admin/Owner)*: เปิดหน้าต่างเลือกผู้รับไอเทม เมื่อเลือกแล้วระบบจะตัดของเข้าประวัติและส่งแจ้งเตือนเข้า Discord ทันที
  * **ปุ่ม "รีเซ็ตไอเทม" (Clear/Reset)** *(เฉพาะ Owner)*: ล้างหรือจัดการข้อมูลไอเทม
* **ตารางคิวไอเทม (Queue Items Overview):** ดูภาพรวมคิวไอเทมสำคัญของกิลด์

---

## 4. หน้าคลังไอเทมบอส (Item Vault)
*(เข้าถึงได้เฉพาะ Admin และ Owner)*
**คลังบันทึกไอเทมดรอปจากบอส จัดการแม่แบบไอเทมด่วน และสแกนรายชื่อผู้ล่าด้วย AI OCR (รองรับ Copy-Paste)**

### แท็บย่อย
  * **ปุ่ม "กรองรายชื่อซ้ำ" (Filter Duplicates):** ตัดชื่อผู้ล่าที่ซ้ำกันออกในคลิกเดียว
* **ปุ่ม "บันทึก / เพิ่มไอเทม":** ตรวจสอบข้อมูลแล้วบันทึกเข้าสู่คลังกลาง
* **ในแท็บไอเทมที่แจกแล้ว:**
  * **ปุ่ม "ดูรูปหลักฐานผู้ล่า" (View Proof):** เปิดดูรูปสกรีนช็อตตอนล่าบอส สามารถใช้สกอลล์เม้าส์ซูมเข้า-ออกได้
  * **ปุ่ม "ลบประวัติ" (Delete Record):** ลบรายการแจกนั้นออกจากประวัติ

---

## 5. หน้าคิวรับไอเทม (Item Queue)
**ระบบจัดอันดับคิวรับของรางวัลและไอเทมสำคัญของกิลด์อย่างโปร่งใส**

> **หมายเหตุสำคัญ:** สมาชิกทั่วไปไม่สามารถกดเข้าคิวเองได้ เพื่อความเป็นระเบียบและโปร่งใสสูงสุด ระบบจึงกำหนดให้ **Admin และ Owner เป็นผู้จัดคิวเท่านั้น**

### ปุ่มและฟังก์ชันสำคัญ *(Admin/Owner)*
* **ปุ่ม "+ เพิ่มคิวไอเทม" (Register Item into Queue):** สร้างหัวข้อไอเทมที่เปิดให้เข้าคิว (รองรับกด **Ctrl + V** วางรูปไอเทมได้ทันที)
* **ปุ่ม "+ เพิ่มสมาชิกลงคิว" (Add Member to Queue):** เลือกสมาชิกจากดรอปดาวน์เพื่อจัดเข้าคิวไอเทมนั้น
* **ปุ่ม "ได้รับแล้ว" (Mark as Received):** กดเมื่อสมาชิกได้รับของแล้ว (จะเปลี่ยนเป็นสถานะสีเขียวพร้อมติ๊กถูก)
* **ปุ่ม "รอคิว" (Mark as Waiting):** กดเพื่อปรับสถานะกลับมารอคิว
* **การจัดลำดับคิว (Reorder):**
  * กดปุ่ม **ลูกศรขึ้น / ลูกศรลง (Move Up/Down)**
  * หรือ **คลิกลากแถบจุด (Drag & Drop)** สลับตำแหน่งคิวได้ทันที
* **ปุ่ม "ลบสมาชิกออกจากคิว" (Remove Member):** นำสมาชิกออกจากคิวนั้น
* **ปุ่ม "ลบคิวไอเทม" (Delete Queue):** ลบรายการคิวนั้นเมื่อเสร็จสิ้นการแจกจ่าย

---

## 6. หน้าทำเนียบสมาชิก (All Members)
**ศูนย์รวมรายชื่อผู้เล่นในสังกัดทั้งหมด จัดกลุ่มตามแคลนและเรียงตามพลังรบ (CP)**

### ส่วนที่ 1: คำขอรออนุมัติ (Pending Approvals)
*(สำหรับผู้เล่นที่เพิ่งลงทะเบียน)*
* **ปุ่ม "อนุมัติ" (Approve):** ยืนยันให้ผู้เล่นเข้าสู่ระบบและเริ่มใช้งานได้
* **ปุ่ม "ปฏิเสธ" (Reject):** ปฏิเสธคำขอลงทะเบียน

### ส่วนที่ 2: รายชื่อสมาชิกทั้งหมด (Active Members)
* **ช่องค้นหา (Search):** พิมพ์ค้นหาด้วย ชื่อตัวละคร, แคลน, หรือคลาสอาชีพ
* **ปุ่ม "แก้ไขโปรไฟล์" (Edit Profile):** *(Admin/Owner)* แก้ไขชื่อในเกม, พลัง CP, แคลน, สายอาชีพ และรีเซ็ตรหัสผ่าน
* **ปุ่ม "กำหนดบทบาท" (Change Role):** *(เฉพาะ Owner)* ปรับระดับสิทธิ์ระหว่าง Member, Admin หรือ Owner
* **ปุ่ม "ลบสมาชิก" (Delete Member):** ลบบัญชีผู้เล่นออกจากระบบ

---

## 7. หน้าจัดการแคลน (Clan Management)
*(เข้าถึงได้เฉพาะ Admin และ Owner)*
**บริหารจัดการกิลด์หลัก กิลด์ย่อย และพันธมิตร**

### ปุ่มและฟังก์ชันสำคัญ
* **ปุ่ม "+ เพิ่มแคลน" (Add New Clan):** เพิ่มสังกัดแคลนใหม่เข้าระบบ
* **การย้ายสมาชิกข้ามแคลน (Drag & Drop):** คลิกที่การ์ดสมาชิกแล้ว **ลากไปวางในกล่องแคลนเป้าหมาย** สังกัดของสมาชิกจะเปลี่ยนทันที
* **การลบสมาชิกแบบกลุ่ม (Batch Delete):**
  * ติ๊กเลือกช่องสี่เหลี่ยมหน้าชื่อสมาชิก หรือกด **"เลือกทั้งหมดในแคลน"**
  * กดปุ่มสีแดง **"ลบสมาชิกที่เลือก" (Batch Delete Selected)**
* **ปุ่ม "ลบแคลน" (Delete Clan):** ลบกล่องแคลนที่ไม่ได้ใช้งานแล้ว

---

## 8. หน้าต่างเครื่องมือพิเศษ (Special Modals)

### 1. คลังเพชรกลาง (Diamond Vault Modal)
* **แท็บ "ฝากเพชร" (Deposit):** ระบุจำนวนเพชรและเหตุผล (เช่น ขายของบอสได้)
* **แท็บ "ถอนเพชร" (Withdraw):** ระบุจำนวนและเหตุผล (เช่น จ่ายค่าน้ำยา/แจกสมาชิก)
* **แท็บ "ประวัติฝากถอน" (History Log):** ดูประวัติย้อนหลังทั้งหมดว่าใครเป็นผู้ทำรายการ

### 2. แจ้งเตือน Discord (Discord Webhook Settings)
* คลิกที่ **ไอคอนกระดิ่ง** บนแถบด้านซ้าย
* ใส่ URL Webhook ของห้อง Discord ที่ต้องการ
* ปุ่ม **"ทดสอบส่งแจ้งเตือน" (Test Ping):** ยิงข้อความทดสอบเข้า Discord
* เมื่อเปิดใช้งาน ระบบจะส่งการ์ดแจ้งเตือนอัตโนมัติเมื่อ: มีการเพิ่มไอเทมบอส, แจกของ, หรือมีธุรกรรมเพชร

### 3. จัดการสายอาชีพ (Class Settings Modal)
* คลิกที่ **ไอคอนดาบ** บนแถบด้านซ้าย
* เพิ่มหรือลบรายชื่อคลาสอาชีพในเกมตามแพตช์ปัจจุบัน (เช่น Orb, Bow, Greatsword, Dual Blades, Rapier)

### 4. ปรับแต่งพื้นหลัง (Wallpaper Settings Modal)
* คลิกที่ **ไอคอนประกายดาว**
* อัปโหลดภาพพื้นหลัง หรือเลือกภาพธีมปราสาท
* ปรับแถบเลื่อน: **ความสว่าง (Brightness)**, **ความเบลอ (Blur)** และ **ความมืดของหน้ากาก (Overlay Darkness)**

### 5. แถบประกาศกิลด์วิ่ง (Live Announcement Bar)
* แสดงข้อความประกาศสำคัญด้านบนสุดของเว็บ
* กดปุ่ม **ดินสอ (Edit)** เพื่อแก้ไขข้อความประกาศ และเปิด/ปิดการแสดงผล

### 6. ศูนย์รีเซ็ตระบบ (Owner Reset Center)
*(เข้าถึงได้เฉพาะ Owner)*
* ป้องกันข้อผิดพลาดด้วยระบบยืนยันโดยต้อง **พิมพ์คำว่า RESET** ก่อนดำเนินการ
* ตัวเลือกการรีเซ็ต:
  1. ล้างเฉพาะไอเทมที่แจกแล้ว (คงไอเทมเปิดรับไว้)
  2. ล้างไอเทมในคลังทั้งหมดเพื่อเริ่มรอบใหม่
  3. ล้างคิวไอเทมทั้งหมด
  4. ล้างประวัติธุรกรรมเพชร
  5. คืนค่าข้อมูลตัวอย่างทดสอบ

---
*เอกสารนี้จัดทำขึ้นสำหรับผู้ใช้งานและผู้ดูแลระบบ Lineage2M Clan Hub*
`;

// 2. ENGLISH MARKDOWN
const enMarkdown = `# Lineage2M Clan Hub - User Manual (v1.2.0)
**Comprehensive Guild Management, Boss Item Vault & Queue Distribution System**

This user guide provides a clear, concise breakdown of every page, section, and button within the Lineage2M Clan Hub application, featuring **Direct Copy-Paste (Ctrl + V)** image upload capabilities.

---

## Table of Contents
1. [User Roles & Permissions](#1-user-roles--permissions)
2. [Top Navigation Bar & Header Controls](#2-top-navigation-bar--header-controls)
3. [Dashboard View](#3-dashboard-view)
4. [Boss Item Vault](#4-boss-item-vault)
5. [Item Queue Management](#5-item-queue-management)
6. [All Clan Members Directory](#6-all-clan-members-directory)
7. [Clan & Alliance Management](#7-clan--alliance-management)
8. [Special Modals & Configuration Tools](#8-special-modals--configuration-tools)

---

## 1. User Roles & Permissions

| Role | Badge | Permissions & Responsibilities |
| :--- | :---: | :--- |
| **Owner** | 👑 | Full superadmin access. Controls all game data, promotes/demotes admins, configures classes, and exclusively accesses the **Owner Reset Center**. |
| **Admin** | 🛡️ | Can add boss drops, manage queues, distribute items to members, approve new member registrations, and manage the Diamond Vault. |
| **Member** | ⚔️ | Clan player. Can view items, register claims for eligible items (matching CP requirement), inspect item queues, and view guild roster. |

---

## 2. Top Navigation Bar & Header Controls

| Button / Element | Icon | Function & Description |
| :--- | :---: | :--- |
| **LINEAGE 2M CLAN HUB (v1.2.0)** | 👑 | System logo. Click anywhere to return to the **Main Dashboard**. |
| **Diamond Vault Widget** | 💎 | Displays current central guild diamond reserve. Click to open the **Deposit / Withdrawal** window. |
| **Wallpaper Settings** | ✨ | Opens the background visual customization modal (upload image, adjust blur/brightness). |
| **Sound Toggle** | 🔊 / 🔇 | Enables or mutes system UI sound effects (clicks, modal pops, distribution fanfares). |
| **Language Switcher (TH / EN)** | 🌐 | Instantly switches the interface language between **English** and **Thai**. |
| **Login / Logout** | 👤 / 🚪 | Authenticate into your user account or sign out securely. |
| **Navigation Tabs** | 📑 | Switch across: Dashboard, Item Vault, Item Queue, Members, and Clan Management. |

---

## 3. Dashboard View
**The central command screen showing real-time vault balance, transaction timelines, and items currently open for claim.**

### Elements and Buttons
* **Diamond Vault Card:**
  * **"Deposit / Withdraw" Button** *(Admin/Owner)*: Deposit loot sale proceeds or withdraw diamonds for guild upkeep with mandatory notes.
* **Transaction Timeline Box:** Shows the 10 most recent deposit and withdrawal activities with timestamp and performer name. Click **"View all"** for the complete audit log.
* **Active Claimable Items Table:**
  * **Item Thumbnail:** Click to **Zoom full size**.
  * **"Register Claim" Button:** Members with power level meeting or exceeding the minimum CP click to register their intent to claim.
  * **"Cancel Claim" Button:** Allows a member to retract their claim registration.
  * **"View Claimants" Button:** Displays all registered applicants, sorted by CP and application timestamp.
  * **"Distribute Item" Button** *(Admin/Owner)*: Opens the recipient distribution modal. Selecting a member awards the item, records distribution history, and triggers an automated Discord announcement.
  * **"Clear & Reset" Button** *(Owner Only)*: Opens the system reset modal to wipe or archive items for a fresh boss cycle.

---

## 4. Boss Item Vault
*(Restricted to Admin and Owner)*
**Comprehensive repository for logging raid drops, managing preset templates, and scanning hunter rosters with AI OCR (Copy-Paste Supported).**

### Sub-tabs
1. **Add New Item:** Input form to record a newly dropped boss item.
2. **Distributed Items Archive:** Searchable archive of all historical distributed items with attached raid proof.

### Key Buttons & Actions
* **"Quick Items Menu" Button:** Opens the quick item preset editor to save item icons, names, and rarities for rapid 1-click entry (Ctrl+V supported).
* **Quick Presets Shortcut Strip:** Click any preset chip to auto-populate the creation form instantly.
* **Form Inputs:** Item Name, Diamond Price, Minimum CP required to claim, and Rarity tier (Rare / Epic / Legend / Mythic).
* **Item Image Upload (Ctrl + V Supported):** Click to select from device or press **Ctrl + V** to paste clipboard images directly.
* **Hunter System & AI OCR Screenshot Scanner (Ctrl + V Supported):**
  * **Hunter Dropdown:** Select hunters from active guild rosters grouped by clan without typing.
  * **"Upload Backup Screenshots" (Multiple):** Select files or press **Ctrl + V** to attach raid party screenshots proving boss participation.
  * **"Scan Hunters via OCR" (Gemini AI):** Click button or press **Ctrl + V** to paste screenshots directly; the AI reads player names and matches them against guild databases automatically.
  * **"Filter Duplicates" Button:** Cleans duplicate detected names across multiple screenshots in one click.
* **"Create / Add Item" Button:** Validates and saves the item into the active vault.
* **In Distributed Archive:**
  * **"View Hunter Proof" Button:** Launches the proof viewer with mouse scroll zoom.
  * **"Delete Record" Button:** Permanently deletes the distribution log entry.

---

## 5. Item Queue Management
**Transparent, chronological priority waiting list for high-tier guild drops.**

> **Notice:** Self-service queue joining is disabled for standard members. Only **Admins and Owners** have privileges to add and rearrange queue members to ensure fair and dispute-free distribution.

### Key Buttons & Actions *(Admin/Owner)*
* **"+ Register Item into Queue" Button:** Create an item queue category (supports **Ctrl + V** image paste).
* **"+ Add Member to Queue" Button:** Select a clan player from the dropdown to place them on the waiting list.
* **"Mark as Received" Button:** Toggles member status to a green checkmark once their item has been awarded in-game.
* **"Mark as Waiting" Button:** Reverts a member's status back to pending queue.
* **Queue Reordering:**
  * Use the **Up / Down Arrow buttons**
  * Or **Drag & Drop** member cards using the grab handle to change priority rank.
* **"Remove Member" Button:** Removes a specific player from the item queue.
* **"Delete Queue Item" Button:** Deletes the entire item queue category.

---

## 6. All Clan Members Directory
**Directory of all clan players grouped by guild and sorted by Power Level (CP).**

### Section 1: Pending Approvals
*(Awaiting Admin action after user registration)*
* **"Approve Member" Button:** Validates account and grants access to the portal.
* **"Reject Request" Button:** Rejects and clears the registration request.

### Section 2: Active Members Roster
* **Search Input:** Filter members in real-time by character name, clan, or class.
* **"Edit Profile" Button** *(Admin/Owner)*: Modify character name, CP, clan affiliation, class, and password.
* **"Assign Role" Button** *(Owner Only)*: Promote or demote between Member, Admin, and Owner.
* **"Delete Member" Button:** Removes member record from the database.

---

## 7. Clan & Alliance Management
*(Restricted to Admin and Owner)*
**Organize main clans, sub-guilds, and alliance rosters.**

### Key Buttons & Actions
* **"+ Add New Clan" Button:** Register a new clan tag into the guild network.
* **Drag-and-Drop Member Transfers:** Click and drag any player card into a target clan container to instantly update their affiliation.
* **Batch Member Deletion:**
  * Check individual boxes or click **"Select All in Clan"**.
  * Click **"Batch Delete Selected"** to prune multiple inactive accounts at once.
* **"Delete Clan" Button:** Removes an empty clan container.

---

## 8. Special Modals & Configuration Tools

### 1. Diamond Vault Modal
* **"Deposit" Tab:** Specify amount and reason (e.g. boss loot market sale).
* **"Withdraw" Tab:** Specify amount and reason (e.g. consumables, clan payout).
* **"Log" Tab:** Review the complete historical audit log of all financial movements.

### 2. Discord Webhook Settings Modal
* Click the **Bell icon** on the sidebar.
* Enter your guild's Discord Webhook URL.
* **"Test Ping" Button:** Sends a formatted verification card to your Discord channel.
* When enabled, automatic rich embeds are dispatched for: Item additions, loot distributions, and diamond transactions.

### 3. Class Settings Modal
* Click the **Sword icon** on the sidebar.
* Add or delete character classes to reflect the active game patch (e.g. Orb, Bow, Greatsword, Dual Blades, Rapier).

### 4. Wallpaper & Theme Settings Modal
* Click the **Sparkles icon** on the top bar or sidebar.
* Upload a custom castle background or choose presets.
* Sliders for: **Brightness**, **Blur radius**, and **Overlay Darkness**.

### 5. Live Announcement Ticker Bar
* Located at the top of the interface for urgent clan broadcast messages.
* Click the **Pencil icon** to edit message content and toggle visibility.

### 6. Owner Reset Center
*(Owner Privilege Only)*
* Safeguarded by mandatory confirmation (must **type "RESET"** to execute).
* Granular reset choices:
  1. Clear all distributed items (preserve active claimable items).
  2. Wipe all vault items for a brand new hunting cycle.
  3. Wipe all item queues.
  4. Clear diamond vault transaction logs.
  5. Restore default sample data for testing.

---
*Document produced for Lineage2M Clan Hub players and administrators.*
`;

// 3. HTML TEMPLATES WITH PRINT CSS FOR BEAUTIFUL PDF GENERATION
const generateHtml = (title, lang, contentHtml) => `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Prompt:wght@300;400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');

  @page {
    size: A4 portrait;
    margin: 14mm 14mm 16mm 14mm;
    @bottom-right {
      content: counter(page);
    }
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    font-family: ${lang === 'th' ? "'Prompt', sans-serif" : "'Inter', sans-serif"};
    background-color: #ffffff;
    color: #1e293b;
    line-height: 1.5;
    font-size: 10.5pt;
  }

  .header-banner {
    background: linear-gradient(135deg, #090f1d 0%, #152037 100%);
    color: #ffffff;
    padding: 20px 24px;
    border-radius: 10px;
    margin-bottom: 20px;
    border: 2px solid #d4af37;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }

  .header-banner h1 {
    font-family: 'Cinzel', serif;
    font-size: 20pt;
    color: #f5d77f;
    letter-spacing: 1px;
    margin-bottom: 4px;
  }

  .header-banner p {
    font-size: 10.5pt;
    color: #94a3b8;
  }

  h2 {
    font-family: ${lang === 'th' ? "'Prompt', sans-serif" : "'Cinzel', serif"};
    font-size: 13.5pt;
    font-weight: 700;
    color: #0f172a;
    border-left: 5px solid #d4af37;
    padding-left: 10px;
    margin-top: 22px;
    margin-bottom: 10px;
    page-break-after: avoid;
  }

  h3 {
    font-size: 11pt;
    font-weight: 600;
    color: #1e293b;
    margin-top: 14px;
    margin-bottom: 6px;
    page-break-after: avoid;
  }

  p {
    margin-bottom: 8px;
    text-align: justify;
  }

  ul, ol {
    margin-left: 20px;
    margin-bottom: 10px;
  }

  li {
    margin-bottom: 4px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0 16px 0;
    font-size: 9.5pt;
    page-break-inside: avoid;
  }

  th, td {
    border: 1px solid #cbd5e1;
    padding: 7px 10px;
    text-align: left;
    vertical-align: top;
  }

  th {
    background: #0f172a;
    color: #f8fafc;
    font-weight: 600;
  }

  tr:nth-child(even) {
    background-color: #f8fafc;
  }

  .badge-owner {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    background: #fef3c7;
    color: #92400e;
    font-weight: 600;
    font-size: 8pt;
    border: 1px solid #fcd34d;
  }

  .badge-admin {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    background: #e0f2fe;
    color: #0369a1;
    font-weight: 600;
    font-size: 8pt;
    border: 1px solid #7dd3fc;
  }

  .badge-member {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    background: #f1f5f9;
    color: #334155;
    font-weight: 600;
    font-size: 8pt;
    border: 1px solid #cbd5e1;
  }

  blockquote {
    background: #fffbeb;
    border-left: 4px solid #f59e0b;
    padding: 8px 12px;
    margin: 10px 0;
    font-size: 9.5pt;
    color: #92400e;
    border-radius: 0 6px 6px 0;
  }

  .page-break {
    page-break-before: always;
  }

  .footer {
    margin-top: 24px;
    padding-top: 10px;
    border-top: 1px solid #e2e8f0;
    font-size: 8.5pt;
    color: #64748b;
    text-align: center;
  }
</style>
</head>
<body>
${contentHtml}
</body>
</html>`;

// Simple Markdown to HTML parser for tables, headings, lists, bold, blockquotes
function markdownToHtml(md) {
  let lines = md.split('\n');
  let html = '';
  let inTable = false;
  let inUl = false;
  let inOl = false;
  let inBlockquote = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    // Close open lists if blank or heading
    if (!line) {
      if (inUl) { html += '</ul>\n'; inUl = false; }
      if (inOl) { html += '</ol>\n'; inOl = false; }
      if (inTable) { html += '</tbody></table>\n'; inTable = false; }
      if (inBlockquote) { html += '</blockquote>\n'; inBlockquote = false; }
      continue;
    }

    // Blockquote
    if (line.startsWith('>')) {
      if (!inBlockquote) { html += '<blockquote>'; inBlockquote = true; }
      let content = line.replace(/^>\s*/, '');
      html += `<p>${formatInline(content)}</p>\n`;
      continue;
    } else if (inBlockquote) {
      html += '</blockquote>\n';
      inBlockquote = false;
    }

    // Tables
    if (line.startsWith('|') && line.endsWith('|')) {
      let cells = line.slice(1, -1).split('|').map(c => c.trim());
      // Check if separator line
      if (cells.every(c => /^:?-+:?$/.test(c))) {
        // Table header separator, skip
        continue;
      }
      if (!inTable) {
        html += '<table><thead><tr>';
        cells.forEach(c => { html += `<th>${formatInline(c)}</th>`; });
        html += '</tr></thead><tbody>\n';
        inTable = true;
      } else {
        html += '<tr>';
        cells.forEach(c => { html += `<td>${formatInline(c)}</td>`; });
        html += '</tr>\n';
      }
      continue;
    } else if (inTable) {
      html += '</tbody></table>\n';
      inTable = false;
    }

    // Headings
    if (line.startsWith('# ')) {
      let title = line.replace('# ', '');
      let sub = '';
      if (lines[i+1] && lines[i+1].startsWith('**')) {
        sub = lines[i+1].replace(/\*\*/g, '');
        i++;
      }
      html += `<div class="header-banner"><h1>${title}</h1><p>${sub}</p></div>\n`;
      continue;
    }
    if (line.startsWith('## ')) {
      html += `<h2>${formatInline(line.replace('## ', ''))}</h2>\n`;
      continue;
    }
    if (line.startsWith('### ')) {
      html += `<h3>${formatInline(line.replace('### ', ''))}</h3>\n`;
      continue;
    }

    // Bullet Lists
    if (line.startsWith('* ') || line.startsWith('- ')) {
      if (!inUl) { html += '<ul>\n'; inUl = true; }
      html += `<li>${formatInline(line.slice(2))}</li>\n`;
      continue;
    }

    // Numbered Lists
    if (/^\d+\.\s/.test(line)) {
      if (!inOl) { html += '<ol>\n'; inOl = true; }
      html += `<li>${formatInline(line.replace(/^\d+\.\s/, ''))}</li>\n`;
      continue;
    }

    // HR
    if (line === '---') {
      html += '<hr style="border:0; border-top:1px solid #e2e8f0; margin:16px 0;" />\n';
      continue;
    }

    // Regular Paragraph
    html += `<p>${formatInline(line)}</p>\n`;
  }

  if (inUl) html += '</ul>\n';
  if (inOl) html += '</ol>\n';
  if (inTable) html += '</tbody></table>\n';
  if (inBlockquote) html += '</blockquote>\n';

  return html;
}

function formatInline(str) {
  return str
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code style="background:#f1f5f9; padding:1px 4px; border-radius:3px; font-size:9pt;">$1</code>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" style="color:#0284c7; text-decoration:none;">$1</a>');
}

// 4. WRITE MARKDOWN AND HTML FILES
const baseDir = __dirname;
const thMdPath = path.join(baseDir, 'User_Manual_TH.md');
const enMdPath = path.join(baseDir, 'User_Manual_EN.md');
const thHtmlPath = path.join(baseDir, 'User_Manual_TH.html');
const enHtmlPath = path.join(baseDir, 'User_Manual_EN.html');
const thPdfPath = path.join(baseDir, 'User_Manual_TH.pdf');
const enPdfPath = path.join(baseDir, 'User_Manual_EN.pdf');

fs.writeFileSync(thMdPath, thMarkdown, 'utf8');
fs.writeFileSync(enMdPath, enMarkdown, 'utf8');

const thHtml = generateHtml('คู่มือการใช้งาน - Lineage2M Clan Hub', 'th', markdownToHtml(thMarkdown));
const enHtml = generateHtml('User Manual - Lineage2M Clan Hub', 'en', markdownToHtml(enMarkdown));

fs.writeFileSync(thHtmlPath, thHtml, 'utf8');
fs.writeFileSync(enHtmlPath, enHtml, 'utf8');

console.log('Generated Markdown and HTML successfully.');

// 5. INVOKE EDGE HEADLESS TO PRINT PDFS
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
if (!fs.existsSync(edgePath)) {
  console.error('Edge executable not found at: ' + edgePath);
  process.exit(1);
}

try {
  console.log('Printing Thai PDF...');
  const cmdTh = `"${edgePath}" --headless --disable-gpu --no-pdf-header-footer --run-all-compositor-stages-before-draw --print-to-pdf="${thPdfPath}" "${thHtmlPath}"`;
  execSync(cmdTh);
  console.log('Thai PDF Created: ' + fs.statSync(thPdfPath).size + ' bytes');

  console.log('Printing English PDF...');
  const cmdEn = `"${edgePath}" --headless --disable-gpu --no-pdf-header-footer --run-all-compositor-stages-before-draw --print-to-pdf="${enPdfPath}" "${enHtmlPath}"`;
  execSync(cmdEn);
  console.log('English PDF Created: ' + fs.statSync(enPdfPath).size + ' bytes');

  console.log('All PDF files generated successfully!');
} catch (err) {
  console.error('Error generating PDF:', err);
  process.exit(1);
}
