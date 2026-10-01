# Image retention / การเก็บรักษารูป

Policy: retain images while referenced by any cloud application record, including historical receipts and pending approvals. After the first complete scan with no references, start a 60-day timer. Any detected reference or re-upload cancels/restarts that timer. Upload date is not the retention start date.

นโยบาย: เก็บรูปที่ข้อมูลบนคลาวด์ยังอ้างอิง รวมประวัติและคำขอรออนุมัติ เริ่มนับ 60 วันเมื่อการตรวจครบครั้งแรกไม่พบรายการอ้างอิง หากพบการใช้งานหรืออัปโหลดซ้ำจะยกเลิก/เริ่มนับใหม่ ไม่ได้นับจากวันอัปโหลด

## Activation / การเปิดใช้

- Local code only until an explicitly authorized production deployment.
- Set a strong `CRON_SECRET` and `STORAGE_CLEANUP_ENABLED=true` in Vercel production environment. Never expose the secret through `VITE_*`.
- Daily schedule: 19:00 UTC (02:00 Thailand the next day); actual timing depends on the hosting plan.
- Verify a successful complete reference scan in production before relying on the policy. Missing credentials, quota/read errors, incomplete relay data, or scan limits abort the pass.
- Only `app-images/` and `app-backgrounds/` in the configured bucket are managed. Other folders are untouched.
- Do not set bucket-wide age-based deletion rules; those would delete referenced images too.

- ยังไม่เปิดทำงานจริงจนกว่าจะได้รับอนุญาต Deploy
- ตั้ง `CRON_SECRET` และ `STORAGE_CLEANUP_ENABLED=true` ใน Vercel เฉพาะฝั่งเซิร์ฟเวอร์
- ตรวจวันละครั้งประมาณ 02:00 น. ประเทศไทย เวลาจริงขึ้นกับแผนโฮสติ้ง
- หากอ่านข้อมูลไม่ครบจะยกเลิกรอบนั้น ไม่ตีความว่ารูปทั้งหมดไม่มีการใช้งาน
- จัดการเฉพาะสองโฟลเดอร์ข้างต้น ไม่ตั้งกฎลบรูปทั้งหมดตามอายุไฟล์

## Limits / ข้อจำกัด

Cloud records only: unsent offline drafts and exported external backups cannot be inspected. A daily scan cannot observe transient reference changes between scans. References are rechecked before deletion, but application record writes and Storage deletion are not a single cross-service transaction. Restoring an old backup may contain links to already-retired images; export the images too when a long-term backup is required.

ตรวจได้เฉพาะข้อมูลที่ส่งขึ้นคลาวด์แล้ว ไม่รวมแบบร่างออฟไลน์หรือไฟล์สำรองภายนอก การตรวจรายวันไม่เห็นการเปลี่ยนแปลงชั่วคราวระหว่างรอบ และการเขียนข้อมูลกับการลบไฟล์ข้ามบริการไม่ใช่ธุรกรรมเดียวกัน หากต้องเก็บสำรองระยะยาวควรสำรองไฟล์รูปด้วย

Each pass scans up to 10,000 Firestore documents and processes up to 100 objects. Reference scans and metadata operations incur usage charges. Large datasets may reach the 20-second safety budget and require a separate indexed retention service. Failed scans do not advance the Storage cursor. A deletion uses an object-generation precondition to protect replacement files. Storage soft-delete recovery and its costs depend on the bucket configuration; no guaranteed recovery is assumed here.

แต่ละรอบจำกัด 10,000 เอกสารและ 100 รูป มีค่าอ่านข้อมูลและคำขอ หากข้อมูลมากอาจเกินเวลาปลอดภัยและต้องปรับระบบดัชนี การกู้คืนไฟล์ที่ลบขึ้นกับค่าของ Storage ไม่รับประกันการกู้คืน
