import React, { useState, useRef } from 'react';
import {
  Database,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  DownloadCloud,
  ShieldCheck,
  X,
  Layers,
  Sparkles,
  Info,
  Clock,
  FileJson,
  FileUp,
  FileDown,
  Check
} from 'lucide-react';
import { Language } from '../types';
import { sounds } from '../utils/sound';
import { BackupDataPayload } from '../services/googleSheetsBackupService';

interface GoogleDriveBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  isOwner?: boolean;
  currentData: BackupDataPayload;
  onDataRestored?: (restoredData: BackupDataPayload) => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

interface ParsedImportSummary {
  usersCount: number;
  vaultItemsCount: number;
  queueItemsCount: number;
  clansCount: number;
  vaultBalance: number;
  exportedAt?: string;
  version?: string;
  payload: BackupDataPayload;
}

export const GoogleDriveBackupModal: React.FC<GoogleDriveBackupModalProps> = ({
  isOpen,
  onClose,
  lang,
  isOwner = true,
  currentData,
  onDataRestored,
  showToast
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ParsedImportSummary | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'idle' | 'success' | 'error' | 'info';
    text: string;
  }>({ type: 'idle', text: '' });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // 1. Export entire database to local JSON file
  const handleExportJson = () => {
    sounds.playClick();
    setIsExporting(true);
    setStatusMessage({
      type: 'info',
      text: lang === 'th' ? 'กำลังเตรียมไฟล์สำรองข้อมูล JSON...' : 'Preparing JSON backup file...'
    });

    try {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');
      const filename = `clan-hub-backup-${dateStr}-${timeStr}.json`;

      const backupPayload = {
        appName: 'Lineage2M Clan Hub',
        schemaVersion: '2.10.28',
        exportedAt: now.toISOString(),
        exportedTimestamp: now.getTime(),
        exportedBy: isOwner ? 'Owner' : 'Admin',
        data: {
          users: currentData.users || [],
          vaultItems: currentData.vaultItems || [],
          queueItems: currentData.queueItems || [],
          clans: currentData.clans || [],
          diamondLogs: currentData.diamondLogs || [],
          vaultBalance: currentData.vaultBalance || 0,
          formulaSettings: currentData.formulaSettings || null
        }
      };

      const jsonStr = JSON.stringify(backupPayload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatusMessage({
        type: 'success',
        text: lang === 'th'
          ? `ส่งออกไฟล์สำรองสำเร็จ! (${backupPayload.data.users.length} สมาชิก, ${backupPayload.data.vaultItems.length} ไอเทมคลัง, กองทุน ${backupPayload.data.vaultBalance.toLocaleString()} ไดอา)`
          : `Backup JSON exported successfully! (${backupPayload.data.users.length} members, ${backupPayload.data.vaultItems.length} vault items, ${backupPayload.data.vaultBalance.toLocaleString()} diamonds)`
      });
      sounds.playClaim();
      if (showToast) {
        showToast(
          lang === 'th' ? 'ดาวน์โหลดไฟล์สำรองข้อมูล JSON เรียบร้อยแล้ว' : 'Backup JSON file downloaded successfully',
          'success'
        );
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || (lang === 'th' ? 'เกิดข้อผิดพลาดในการส่งออกไฟล์' : 'Export failed')
      });
      sounds.playError();
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Open file picker for JSON import
  const handleTriggerFileInput = () => {
    sounds.playClick();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // 3. Handle file selection & validation
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    sounds.playClick();
    setIsImporting(true);
    setStatusMessage({
      type: 'info',
      text: lang === 'th' ? 'กำลังอ่านและตรวจสอบโครงสร้างไฟล์ JSON...' : 'Reading and validating JSON backup file...'
    });

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        // Support both wrapped format { data: { users, ... } } and direct format { users, ... }
        const coreData = parsed.data || parsed;

        if (!coreData || (!Array.isArray(coreData.users) && !Array.isArray(coreData.vaultItems))) {
          throw new Error(
            lang === 'th'
              ? 'รูปแบบไฟล์สำรองไม่ถูกต้อง (ไม่พบข้อมูลสมาชิกหรือไอเทมคลัง)'
              : 'Invalid backup file format (missing users or vault items array)'
          );
        }

        const summary: ParsedImportSummary = {
          usersCount: Array.isArray(coreData.users) ? coreData.users.length : 0,
          vaultItemsCount: Array.isArray(coreData.vaultItems) ? coreData.vaultItems.length : 0,
          queueItemsCount: Array.isArray(coreData.queueItems) ? coreData.queueItems.length : 0,
          clansCount: Array.isArray(coreData.clans) ? coreData.clans.length : 0,
          vaultBalance: typeof coreData.vaultBalance === 'number' ? coreData.vaultBalance : 0,
          exportedAt: parsed.exportedAt,
          version: parsed.schemaVersion || parsed.version,
          payload: {
            users: coreData.users || [],
            vaultItems: coreData.vaultItems || [],
            queueItems: coreData.queueItems || [],
            clans: coreData.clans || [],
            diamondLogs: coreData.diamondLogs || [],
            vaultBalance: typeof coreData.vaultBalance === 'number' ? coreData.vaultBalance : 0,
            formulaSettings: coreData.formulaSettings
          }
        };

        setImportSummary(summary);
        setStatusMessage({
          type: 'info',
          text: lang === 'th'
            ? `ตรวจพบข้อมูลสำรอง: สมาชิก ${summary.usersCount} คน, ไอเทม ${summary.vaultItemsCount} ชิ้น กรุณากดยืนยันการกู้คืนด้านล่าง`
            : `Backup file verified: ${summary.usersCount} members, ${summary.vaultItemsCount} items. Please confirm restore below.`
        });
      } catch (err: any) {
        setStatusMessage({
          type: 'error',
          text: err?.message || (lang === 'th' ? 'อ่านไฟล์ไม่สำเร็จ ไฟล์อาจเสียหายหรือไม่ถูกต้อง' : 'Failed to parse JSON file')
        });
        sounds.playError();
      } finally {
        setIsImporting(false);
      }
    };

    reader.onerror = () => {
      setStatusMessage({
        type: 'error',
        text: lang === 'th' ? 'ไม่สามารถเปิดอ่านไฟล์ได้' : 'Failed to read file'
      });
      sounds.playError();
      setIsImporting(false);
    };

    reader.readAsText(file);
  };

  // 4. Confirm and apply restored data
  const handleConfirmRestore = () => {
    if (!importSummary) return;

    sounds.playClick();
    const confirmed = window.confirm(
      lang === 'th'
        ? `ยืนยันการกู้คืนฐานข้อมูลจากไฟล์สำรอง?\n\n- สมาชิก: ${importSummary.usersCount} คน\n- ไอเทมคลัง: ${importSummary.vaultItemsCount} ชิ้น\n- คิวรับของ: ${importSummary.queueItemsCount} รายการ\n- กองทุนไดอา: ${importSummary.vaultBalance.toLocaleString()}\n\nข้อมูลปัจจุบันในระบบจะถูกเขียนทับด้วยข้อมูลจากไฟล์นี้`
        : `Confirm database restore from backup file?\n\n- Members: ${importSummary.usersCount}\n- Vault Items: ${importSummary.vaultItemsCount}\n- Queue Items: ${importSummary.queueItemsCount}\n- Diamonds: ${importSummary.vaultBalance.toLocaleString()}\n\nCurrent data will be updated with data from this file.`
    );

    if (!confirmed) return;

    try {
      if (onDataRestored) {
        onDataRestored(importSummary.payload);
      }

      setStatusMessage({
        type: 'success',
        text: lang === 'th'
          ? `กู้คืนข้อมูลสำเร็จ! นำเข้าสมาชิก ${importSummary.usersCount} คน, ไอเทม ${importSummary.vaultItemsCount} ชิ้น เรียบร้อยแล้ว`
          : `Database restored successfully! Imported ${importSummary.usersCount} members, ${importSummary.vaultItemsCount} items.`
      });
      sounds.playClaim();
      if (showToast) {
        showToast(
          lang === 'th' ? 'กู้คืนฐานข้อมูลจากไฟล์สำรองเรียบร้อยแล้ว' : 'Database restored from backup file successfully',
          'success'
        );
      }
      setImportSummary(null);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || (lang === 'th' ? 'การกู้คืนข้อมูลล้มเหลว' : 'Restore failed')
      });
      sounds.playError();
    }
  };

  const handleCancelImport = () => {
    sounds.playClick();
    setImportSummary(null);
    setStatusMessage({ type: 'idle', text: '' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-gradient-to-b from-[#0e1628] to-[#070b14] border border-emerald-500/40 shadow-2xl shadow-emerald-950/50 overflow-hidden text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hidden File Input for JSON restore */}
        <input
          type="file"
          ref={fileInputRef}
          accept=".json,application/json"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/10 bg-[#121c32]/80">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
              <Database className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  {lang === 'th' ? 'สำรองและกู้คืนฐานข้อมูล (Database Backup)' : 'Database Backup & Restore'}
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {lang === 'th' ? 'Firebase Cloud' : 'Firebase Cloud'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {lang === 'th'
                  ? 'ระบบฐานข้อมูลกลาง CLAN-HUB พร้อมการส่งออก/นำเข้าไฟล์ JSON ออฟไลน์ 100%'
                  : 'CLAN-HUB Central Cloud Database with 100% Offline JSON Export / Import'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs sm:text-sm">
          {/* Architecture Status Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#121c33] to-[#0d1527] border border-emerald-500/30 space-y-3 shadow-lg shadow-emerald-950/20">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center">
                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399]" />
                  <span className="absolute w-5 h-5 rounded-full bg-emerald-400/30 animate-ping" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">
                      {lang === 'th' ? 'ฐานข้อมูลกลาง Firebase Cloud & Live Relay' : 'Firebase Cloud & Live Relay Active'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-emerald-500/20 border-emerald-500/40 text-emerald-300">
                      {lang === 'th' ? 'ออนไลน์สด 100%' : '100% Live'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {lang === 'th'
                      ? 'ระบบศูนย์กลางเดียว (Single Source of Truth) ไร้ปัญหาข้อมูลแย่งกันเขียนทับ'
                      : 'Single Source of Truth with zero sync conflicts or split-brain state'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>v2.10.28</span>
              </div>
            </div>

            {/* Explanation box */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#090f1d] border border-white/5 text-slate-300 text-xs leading-relaxed">
              <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-emerald-300">
                  {lang === 'th' ? 'นโยบายความเสถียรสูงสุด:' : 'High Resilience Architecture:'}{' '}
                </span>
                {lang === 'th'
                  ? 'ระบบตัดการเชื่อมต่ออัตโนมัติกับ Google Sheets ออก เพื่อตัดต้นตอปัญหาข้อมูลสเตตัสเก่าตีกลับและอาการจอกระพริบ โดยเปลี่ยนมาใช้ Firebase Cloud ร่วมกับ Live Relay Server เป็นศูนย์กลางเดียว และให้ Owner สามารถสำรองไฟล์ JSON เก็บไว้ในคอมพิวเตอร์ได้ตลอดเวลา'
                  : 'Google Sheets auto-sync has been decoupled to eliminate ghost stat regressions and background flickering. The hub operates strictly on Firebase Cloud + Live State Relay, with instant 1-click JSON backup file capabilities for the Owner.'}
              </div>
            </div>
          </div>

          {/* Current Database Overview Cards */}
          <div className="p-3.5 rounded-xl bg-[#0c1322] border border-white/10 space-y-2">
            <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>{lang === 'th' ? 'ข้อมูลปัจจุบันในฐานข้อมูลกลาง:' : 'Current Live Database Records:'}</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {lang === 'th' ? 'อัปเดตแบบเรียลไทม์' : 'Real-time state'}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2.5 rounded-lg bg-[#141e33] border border-white/5">
                <div className="text-lg font-bold text-white font-mono">{currentData.users.length}</div>
                <div className="text-[11px] text-slate-400">{lang === 'th' ? 'สมาชิก' : 'Members'}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#141e33] border border-white/5">
                <div className="text-lg font-bold text-white font-mono">{currentData.vaultItems.length}</div>
                <div className="text-[11px] text-slate-400">{lang === 'th' ? 'ไอเทมคลัง' : 'Vault Items'}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#141e33] border border-white/5">
                <div className="text-lg font-bold text-white font-mono">{currentData.queueItems.length}</div>
                <div className="text-[11px] text-slate-400">{lang === 'th' ? 'คิวรับของ' : 'Queues'}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#141e33] border border-white/5">
                <div className="text-lg font-bold text-amber-300 font-mono">
                  {currentData.vaultBalance.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-400">{lang === 'th' ? 'กองทุนไดอา' : 'Diamonds'}</div>
              </div>
            </div>
          </div>

          {/* Operation Status Feedback Banner */}
          {statusMessage.text && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 animate-fade-in ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : statusMessage.type === 'error'
                  ? 'bg-red-500/15 border-red-500/40 text-red-300'
                  : 'bg-sky-500/15 border-sky-500/40 text-sky-300'
              }`}
            >
              {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
              {statusMessage.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              {statusMessage.type === 'info' && <RefreshCw className="w-4 h-4 shrink-0 mt-0.5 animate-spin" />}
              <span className="leading-relaxed font-medium">{statusMessage.text}</span>
            </div>
          )}

          {/* Import Verification Card (If a file was chosen) */}
          {importSummary && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/40 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                  <FileJson className="w-4 h-4 text-amber-400" />
                  <span>{lang === 'th' ? 'ยืนยันการกู้คืนข้อมูลจากไฟล์' : 'Confirm Backup File Restoration'}</span>
                </div>
                {importSummary.version && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono">
                    v{importSummary.version}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2 rounded bg-black/40 border border-white/5">
                  <div className="font-bold text-white font-mono text-base">{importSummary.usersCount}</div>
                  <div className="text-[10px] text-slate-400">{lang === 'th' ? 'สมาชิก' : 'Members'}</div>
                </div>
                <div className="p-2 rounded bg-black/40 border border-white/5">
                  <div className="font-bold text-white font-mono text-base">{importSummary.vaultItemsCount}</div>
                  <div className="text-[10px] text-slate-400">{lang === 'th' ? 'ไอเทมคลัง' : 'Vault Items'}</div>
                </div>
                <div className="p-2 rounded bg-black/40 border border-white/5">
                  <div className="font-bold text-white font-mono text-base">{importSummary.queueItemsCount}</div>
                  <div className="text-[10px] text-slate-400">{lang === 'th' ? 'คิวรับของ' : 'Queues'}</div>
                </div>
                <div className="p-2 rounded bg-black/40 border border-white/5">
                  <div className="font-bold text-amber-300 font-mono text-base">
                    {importSummary.vaultBalance.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400">{lang === 'th' ? 'กองทุนไดอา' : 'Diamonds'}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleConfirmRestore}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{lang === 'th' ? 'กู้คืนข้อมูลทันที (เขียนทับ)' : 'Restore Now (Overwrite)'}</span>
                </button>
                <button
                  onClick={handleCancelImport}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
                >
                  {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                </button>
              </div>
            </div>
          )}

          {/* Primary Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {/* Export JSON Button */}
            <button
              onClick={handleExportJson}
              disabled={isExporting}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-950/60 transition-all cursor-pointer group"
            >
              <FileDown className={`w-5 h-5 text-emerald-200 group-hover:scale-110 transition-transform ${isExporting ? 'animate-bounce' : ''}`} />
              <div className="text-left">
                <div className="font-bold">
                  {lang === 'th' ? 'ดาวน์โหลดไฟล์สำรอง (Export JSON)' : 'Download Backup (Export JSON)'}
                </div>
                <div className="text-[10px] font-normal text-emerald-100/80">
                  {lang === 'th' ? 'บันทึกข้อมูลทั้งหมดเก็บไว้ในเครื่อง' : 'Save full database to local PC'}
                </div>
              </div>
            </button>

            {/* Import JSON Button */}
            <button
              onClick={handleTriggerFileInput}
              disabled={isImporting}
              className="w-full py-3.5 px-4 rounded-xl bg-[#141f36] hover:bg-[#1a2947] border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 hover:text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer group shadow-md"
            >
              <FileUp className={`w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform ${isImporting ? 'animate-bounce' : ''}`} />
              <div className="text-left">
                <div className="font-bold">
                  {lang === 'th' ? 'กู้คืนจากไฟล์ (Import JSON)' : 'Restore Backup (Import JSON)'}
                </div>
                <div className="text-[10px] font-normal text-slate-400">
                  {lang === 'th' ? 'เลือกไฟล์ .json เพื่อกู้คืน' : 'Select .json file to restore'}
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t border-white/10 bg-[#0c1424]">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Lineage2M Clan Hub &bull; Owner Database Protection (v2.10.28)</span>
          </div>
          <button
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
          >
            {lang === 'th' ? 'ปิดหน้าต่าง' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
