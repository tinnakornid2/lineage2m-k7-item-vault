/**
 * ==============================================================================
 * LINEAGE2M CLAN HUB - GOOGLE SHEETS & DRIVE DATABASE ENGINE
 * ==============================================================================
 * เจ้าของระบบ: Eloni / Lineage2M Clan Hub
 * ฟังก์ชัน:
 * 1. รับ-ส่งข้อมูล JSON ระหว่าง Web App กับ Google Sheets (Members, Items, Queues, Diamonds, Clans)
 * 2. สำรองประวัติไฟล์ JSON ลงโฟลเดอร์ Google Drive "L2M_ClanHub_Backups"
 * 3. รับอัปโหลดรูปภาพ (Base64) ไปบันทึกลงโฟลเดอร์ Google Drive "L2M_Item_Images" และคืนค่า Direct URL
 * 4. ทำงานได้ฟรี 100% ไม่มีลิมิต Document Read รายวันแบบ Firestore
 * ==============================================================================
 */

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * LINEAGE2M CLAN HUB - GOOGLE SHEETS & DRIVE BACKUP ENGINE
 * Deploy as: Web App (Execute as: Me, Who has access: Anyone)
 */

const FOLDER_BACKUPS = "L2M_ClanHub_Backups";
const FOLDER_IMAGES = "L2M_Item_Images";

// 1. GET Request Handler (Ping, Fetch All Data)
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "ping";
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === "ping") {
      return jsonResponse({
        status: "success",
        message: "Google Sheets Database Engine is Online",
        sheetName: ss.getName(),
        sheetId: ss.getId(),
        sheetUrl: ss.getUrl(),
        timestamp: new Date().toISOString()
      });
    }

    if (action === "fetch_all") {
      // 1. Try reading the full-fidelity snapshot from Google Drive first
      try {
        const folder = getOrCreateFolder(FOLDER_BACKUPS);
        const latestFile = getLatestBackupFile(folder);
        if (latestFile) {
          const content = latestFile.getBlob().getDataAsString();
          const parsed = JSON.parse(content);
          let balance = 0;
          if (parsed.diamondLogs && parsed.diamondLogs.length > 0) {
            balance = Number(parsed.diamondLogs[0].balanceAfter || 0);
          }
          return jsonResponse({
            status: "success",
            source: "drive_json",
            data: parsed,
            vaultBalance: balance,
            timestamp: latestFile.getLastUpdated().toISOString()
          });
        }
      } catch (driveErr) {
        console.warn("Drive snapshot read warning: " + driveErr);
      }

      // 2. Fallback to reading from Google Sheets tables
      const data = {
        users: readSheetData(ss, "Members"),
        vaultItems: readSheetData(ss, "VaultItems"),
        quickItems: readSheetData(ss, "QuickItems"),
        generalItems: readSheetData(ss, "GeneralItems"),
        queueItems: readSheetData(ss, "Queues"),
        clans: readSheetData(ss, "Clans"),
        diamondLogs: readSheetData(ss, "ClanDiamonds"),
        syncMeta: readSheetData(ss, "SyncMeta")[0] || {},
        announcementSettings: (readSheetData(ss, "Announcement") || [])[0] || null,
        backgroundSettings: (readSheetData(ss, "Background") || [])[0] || null,
        discordSettings: (readSheetData(ss, "DiscordSettings") || [])[0] || null,
        backupLog: readSheetData(ss, "BackupLog"),
        updatedAt: new Date().toISOString()
      };

      let balance = 0;
      if (data.diamondLogs && data.diamondLogs.length > 0) {
        balance = Number(data.diamondLogs[0].balanceAfter || 0);
      }

      return jsonResponse({
        status: "success",
        source: "sheets",
        data: data,
        vaultBalance: balance,
        timestamp: new Date().toISOString()
      });
    }

    return jsonResponse({ status: "error", message: "Unknown action: " + action });
  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
}

// 2. POST Request Handler (Backup, Upload Image, Restore)
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ status: "error", message: "No post data received" });
    }

    const payload = JSON.parse(e.postData.contents);
    const action = payload.action || "backup_all";
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // ACTION: Backup All Data to Sheets & Drive
    if (action === "backup_all") {
      const data = payload.data || {};

      // 1. Write to Sheets with safe cell limits (under 50,000 characters per cell)
      if (Array.isArray(data.users)) writeSheetData(ss, "Members", data.users);
      if (Array.isArray(data.vaultItems)) writeSheetData(ss, "VaultItems", data.vaultItems);
      if (Array.isArray(data.quickItems)) writeSheetData(ss, "QuickItems", data.quickItems);
      if (Array.isArray(data.generalItems)) writeSheetData(ss, "GeneralItems", data.generalItems);
      if (Array.isArray(data.queueItems)) writeSheetData(ss, "Queues", data.queueItems);
      if (Array.isArray(data.clans)) writeSheetData(ss, "Clans", data.clans);
      if (Array.isArray(data.diamondLogs)) writeSheetData(ss, "ClanDiamonds", data.diamondLogs);
      if (data.syncMeta) writeSheetData(ss, "SyncMeta", [data.syncMeta]);
      if (data.formulaSettings && Array.isArray(data.formulaSettings.stats)) {
        writeSheetData(ss, "PowerFormula", data.formulaSettings.stats);
      }
      if (data.announcementSettings) {
        writeSheetData(ss, "Announcement", [data.announcementSettings]);
      }
      if (data.backgroundSettings) {
        writeSheetData(ss, "Background", [data.backgroundSettings]);
      }
      if (data.discordSettings) {
        writeSheetData(ss, "DiscordSettings", [data.discordSettings]);
      }

      // 2. Log Backup Record
      const logEntry = [{
        timestamp: new Date().toISOString(),
        triggeredBy: payload.performedBy || "System",
        usersCount: data.users ? data.users.length : 0,
        vaultItemsCount: data.vaultItems ? data.vaultItems.length : 0,
        quickItemsCount: data.quickItems ? data.quickItems.length : 0,
        generalItemsCount: data.generalItems ? data.generalItems.length : 0,
        diamondBalance: payload.vaultBalance || 0
      }];
      appendSheetLog(ss, "BackupLog", logEntry);

      // 3. Save FULL 100% UNTRUNCATED JSON Snapshot to Google Drive Folder
      try {
        const folder = getOrCreateFolder(FOLDER_BACKUPS);
        const dateStr = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd_HH-mm-ss");
        const fileName = "ClanHub_Backup_" + dateStr + ".json";
        folder.createFile(fileName, JSON.stringify(data, null, 2), "application/json");
      } catch (driveErr) {
        console.warn("Drive snapshot warning: " + driveErr);
      }

      return jsonResponse({
        status: "success",
        message: "Data successfully backed up to Google Sheets & Drive",
        sheetUrl: ss.getUrl(),
        timestamp: new Date().toISOString()
      });
    }

    // ACTION: Upload Image to Google Drive Folder
    if (action === "upload_image") {
      const base64Data = payload.base64Data;
      const fileName = payload.fileName || ("img_" + Date.now() + ".png");
      const mimeType = payload.mimeType || "image/png";

      if (!base64Data) {
        return jsonResponse({ status: "error", message: "Missing base64Data" });
      }

      const cleanBase64 = base64Data.replace(/^data:image\\/[a-z]+;base64,/, "");
      const decodedBytes = Utilities.base64Decode(cleanBase64);
      const blob = Utilities.newBlob(decodedBytes, mimeType, fileName);

      const folder = getOrCreateFolder(FOLDER_IMAGES);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      const fileId = file.getId();
      const directUrl = "https://lh3.googleusercontent.com/d/" + fileId;

      return jsonResponse({
        status: "success",
        fileId: fileId,
        imageUrl: directUrl,
        downloadUrl: file.getDownloadUrl(),
        timestamp: new Date().toISOString()
      });
    }

    return jsonResponse({ status: "error", message: "Unknown action: " + action });
  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
}

// ---------------- Helper Functions ----------------

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(folderName);
}

function getLatestBackupFile(folder) {
  const files = folder.getFiles();
  let latestFile = null;
  let latestDate = 0;
  while (files.hasNext()) {
    const file = files.next();
    const updated = file.getLastUpdated().getTime();
    if (!latestFile || updated > latestDate) {
      latestFile = file;
      latestDate = updated;
    }
  }
  return latestFile;
}

const MAX_CELL_CHARS = 45000;

function writeSheetData(ss, sheetName, items) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  sheet.clear();

  if (!items || items.length === 0) return;

  // Collect all unique keys from all items to guarantee all columns are written
  const keyMap = {};
  for (let k = 0; k < items.length; k++) {
    const it = items[k];
    if (it && typeof it === "object") {
      for (const prop in it) {
        keyMap[prop] = true;
      }
    }
  }
  const keys = Object.keys(keyMap);
  const rows = [keys];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const row = [];
    for (let j = 0; j < keys.length; j++) {
      const val = item[keys[j]];
      let strVal = "";
      if (val === null || val === undefined) {
        strVal = "";
      } else if (typeof val === "object") {
        strVal = JSON.stringify(val);
      } else {
        strVal = String(val);
      }

      // ป้องกัน Google Sheets ข้อผิดพลาด "อินพุตเกินจำนวนอักขระสูงสุด 50000 ตัวที่อนุญาตในเซลล์เดียว"
      if (strVal.length > MAX_CELL_CHARS) {
        if (strVal.startsWith("data:image/") || strVal.includes(";base64,")) {
          strVal = "[Image Data Stored in Google Drive Backup JSON]";
        } else {
          strVal = strVal.substring(0, MAX_CELL_CHARS - 50) + "... [TRUNCATED FOR SHEETS]";
        }
      }
      row.push(strVal);
    }
    rows.push(row);
  }

  sheet.getRange(1, 1, rows.length, keys.length).setValues(rows);
  sheet.getRange(1, 1, 1, keys.length).setFontWeight("bold").setBackground("#1e293b").setFontColor("#f5d77f");
  sheet.autoResizeColumns(1, Math.min(keys.length, 25));
}

function readSheetData(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) return [];

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0];
  const results = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      let val = row[c];
      if (typeof val === "string" && (val.startsWith("{") || val.startsWith("["))) {
        try {
          val = JSON.parse(val);
        } catch (e) {}
      }
      obj[key] = val;
    }
    results.push(obj);
  }
  return results;
}

function appendSheetLog(ss, sheetName, logItems) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    const headers = Object.keys(logItems[0]);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#0f172a").setFontColor("#38bdf8");
  }
  for (let i = 0; i < logItems.length; i++) {
    const item = logItems[i];
    const row = Object.values(item);
    sheet.appendRow(row);
  }
}
`;
