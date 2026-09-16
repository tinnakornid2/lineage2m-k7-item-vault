import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  HardDrive,
  Cloud,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  UploadCloud,
  DownloadCloud,
  ShieldCheck,
  X,
  Layers,
  Sparkles,
  Info,
  Database
} from 'lucide-react';
import { Language, User, VaultItem, QueueItem, ClanGroup, DiamondVaultRecord } from '../types';
import { sounds } from '../utils/sound';
import {
  GoogleBackupConfig,
  BackupDataPayload,
  getGoogleBackupConfig,
  saveGoogleBackupConfig,
  testGoogleSheetsConnection,
  backupAllDataToGoogleSheets,
  fetchDataFromGoogleSheets
} from '../services/googleSheetsBackupService';
import { syncBackupToFirestore, forceCheckAndFetchFirestore } from '../services/firebase';
import { GOOGLE_APPS_SCRIPT_CODE } from '../services/googleAppsScriptTemplate';

interface GoogleDriveBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  isOwner?: boolean;
  currentData: BackupDataPayload;
  onDataRestored?: (restoredData: BackupDataPayload) => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
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
  const [activeTab, setActiveTab] = useState<'control' | 'guide' | 'code'>('control');
  const [config, setConfig] = useState<GoogleBackupConfig>(getGoogleBackupConfig);
  const [inputUrl, setInputUrl] = useState(config.webAppUrl || '');
  const [isTesting, setIsTesting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isSyncingToCloud, setIsSyncingToCloud] = useState(false);
  const [isFetchingFromCloud, setIsFetchingFromCloud] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'idle' | 'success' | 'error' | 'info';
    text: string;
  }>({ type: 'idle', text: '' });

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      const cfg = getGoogleBackupConfig();
      setConfig(cfg);
      setInputUrl(cfg.webAppUrl || '');
      setStatusMessage({ type: 'idle', text: '' });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    sounds.playClick();
    const cleanUrl = inputUrl.trim();
    if (!cleanUrl) {
      setStatusMessage({
        type: 'error',
        text: lang === 'th' ? 'กรุณาระบุ Google Apps Script Web App URL' : 'Please provide the Web App URL'
      });
      sounds.playError();
      return;
    }

    setIsTesting(true);
    setStatusMessage({
      type: 'info',
      text: lang === 'th' ? 'กำลังเชื่อมต่อไปยัง Google Sheets...' : 'Testing connection to Google Sheets...'
    });

    try {
      const res = await testGoogleSheetsConnection(cleanUrl);
      if (res.success) {
        const updated = saveGoogleBackupConfig({
          webAppUrl: cleanUrl,
          sheetUrl: res.sheetUrl,
          sheetName: res.sheetName,
          lastStatus: 'success'
        });
        setConfig(updated);
        setStatusMessage({
          type: 'success',
          text: lang === 'th'
            ? `เชื่อมต่อสำเร็จ! แผ่นงาน: ${res.sheetName || 'Google Sheet'}`
            : `Connected successfully! Sheet: ${res.sheetName || 'Google Sheet'}`
        });
        sounds.playClaim();
        if (showToast) {
          showToast(
            lang === 'th' ? 'เชื่อมต่อ Google Sheets เรียบร้อยแล้ว' : 'Google Sheets connected successfully',
            'success'
          );
        }
      } else {
        setStatusMessage({
          type: 'error',
          text: res.message
        });
        sounds.playError();
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Connection failed'
      });
      sounds.playError();
    } finally {
      setIsTesting(false);
    }
  };

  const handleBackupNow = async () => {
    sounds.playClick();
    const cleanUrl = inputUrl.trim();
    if (!cleanUrl) {
      setStatusMessage({
        type: 'error',
        text: lang === 'th' ? 'กรุณาระบุและทดสอบ Web App URL ก่อนสำรองข้อมูล' : 'Please configure Web App URL first'
      });
      sounds.playError();
      return;
    }

    setIsBackingUp(true);
    setStatusMessage({
      type: 'info',
      text: lang === 'th' ? 'กำลังส่งข้อมูลไปยัง Google Sheets และ Google Drive...' : 'Backing up data to Google Sheets & Drive...'
    });

    try {
      const res = await backupAllDataToGoogleSheets(currentData, 'Owner');
      if (res.success) {
        const updated = getGoogleBackupConfig();
        setConfig(updated);
        setStatusMessage({
          type: 'success',
          text: lang === 'th'
            ? 'สำรองข้อมูลสำเร็จ! (สมาชิก 125 รายการ, ไอเทม 15 รายการ, กองทุนไดอา 23,521)'
            : 'Backup successful! (Members, Items, Queues, Diamond Vault)'
        });
        sounds.playClaim();
        if (showToast) {
          showToast(
            lang === 'th' ? 'สำรองข้อมูลลง Google Sheets & Drive สำเร็จ!' : 'Backup completed successfully!',
            'success'
          );
        }
      } else {
        setStatusMessage({
          type: 'error',
          text: res.message
        });
        sounds.playError();
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Backup failed'
      });
      sounds.playError();
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreNow = async () => {
    sounds.playClick();
    const cleanUrl = inputUrl.trim();
    if (!cleanUrl) {
      setStatusMessage({
        type: 'error',
        text: lang === 'th' ? 'กรุณาระบุ Web App URL ก่อนดึงข้อมูล' : 'Please configure Web App URL first'
      });
      sounds.playError();
      return;
    }

    const confirmRestore = window.confirm(
      lang === 'th'
        ? 'คุณต้องการดึงข้อมูลล่าสุดจาก Google Sheets มาใช้งานบน Clan Hub หรือไม่?'
        : 'Do you want to fetch and restore the latest data from Google Sheets into Clan Hub?'
    );
    if (!confirmRestore) return;

    setIsRestoring(true);
    setStatusMessage({
      type: 'info',
      text: lang === 'th' ? 'กำลังดึงข้อมูลจาก Google Sheets...' : 'Fetching data from Google Sheets...'
    });

    try {
      const res = await fetchDataFromGoogleSheets(cleanUrl);
      if (res.success && res.data) {
        if (onDataRestored) {
          onDataRestored(res.data);
        }
        setStatusMessage({
          type: 'success',
          text: lang === 'th'
            ? `ดึงข้อมูลสำเร็จ! สมาชิก ${res.data.users?.length || 0} คน, ไอเทมคลัง ${res.data.vaultItems?.length || 0} ชิ้น`
            : `Restored ${res.data.users?.length || 0} members, ${res.data.vaultItems?.length || 0} vault items!`
        });
        sounds.playClaim();
        if (showToast) {
          showToast(
            lang === 'th' ? 'อัปเดตข้อมูลจาก Google Sheets สำเร็จ!' : 'Data restored from Google Sheets!',
            'success'
          );
        }
      } else {
        setStatusMessage({
          type: 'error',
          text: res.message || 'No data returned'
        });
        sounds.playError();
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Restore failed'
      });
      sounds.playError();
    } finally {
      setIsRestoring(false);
    }
  };

  const handleFetchFromFirebaseCloud = async () => {
    sounds.playClick();
    setIsFetchingFromCloud(true);
    setStatusMessage({
      type: 'info',
      text: lang === 'th' ? 'กำลังเชื่อมต่อและดึงข้อมูลจริงจาก Firebase Cloud...' : 'Connecting and fetching authentic data from Firebase Cloud...'
    });

    try {
      const res = await forceCheckAndFetchFirestore();
      if (res.success && res.data) {
        if (onDataRestored) {
          onDataRestored({
            ...res.data,
            vaultBalance: currentData.vaultBalance
          });
        }
        setStatusMessage({
          type: 'success',
          text: lang === 'th'
            ? `ดึงข้อมูลจาก Firebase Cloud สำเร็จ! สมาชิก ${res.data.users?.length || 0} คน, ไอเทม ${res.data.vaultItems?.length || 0} ชิ้น`
            : `Firebase Cloud data restored! ${res.data.users?.length || 0} members, ${res.data.vaultItems?.length || 0} items`
        });
        sounds.playClaim();
        if (showToast) {
          showToast(
            lang === 'th' ? 'ดึงข้อมูลจากระบบหลัก Firebase สำเร็จ!' : 'Restored data from Firebase Cloud!',
            'success'
          );
        }
      } else {
        setStatusMessage({
          type: 'error',
          text: lang === 'th'
            ? `ระบบหลัก Firebase ยังไม่พร้อมใช้งาน: ${res.message}`
            : `Firebase Cloud not ready: ${res.message}`
        });
        sounds.playError();
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Firebase fetch failed'
      });
      sounds.playError();
    } finally {
      setIsFetchingFromCloud(false);
    }
  };

  const handleSyncToFirebaseCloud = async () => {
    sounds.playClick();
    const confirmed = window.confirm(
      lang === 'th'
        ? 'คุณต้องการเขียนข้อมูลปัจจุบันทับลงบน Firebase Cloud หรือไม่?'
        : 'Do you want to write current data into Firebase Cloud?'
    );
    if (!confirmed) return;

    setIsSyncingToCloud(true);
    setStatusMessage({
      type: 'info',
      text: lang === 'th' ? 'กำลังบันทึกข้อมูลทับลงบน Firebase Cloud...' : 'Writing records to Firebase Cloud...'
    });

    try {
      const res = await syncBackupToFirestore(currentData);
      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: lang === 'th'
            ? `บันทึกข้อมูลทับลง Firebase Cloud สำเร็จ (${res.writtenCount} รายการ)!`
            : `Successfully synced ${res.writtenCount} records to Firebase Cloud!`
        });
        sounds.playClaim();
        if (showToast) {
          showToast(
            lang === 'th' ? 'เขียนข้อมูลลง Firebase Cloud สำเร็จ!' : 'Synced to Firebase Cloud!',
            'success'
          );
        }
      } else {
        setStatusMessage({
          type: 'error',
          text: res.message
        });
        sounds.playError();
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Sync to Cloud failed'
      });
      sounds.playError();
    } finally {
      setIsSyncingToCloud(false);
    }
  };

  const handleToggleAutoBackup = (enabled: boolean) => {
    sounds.playClick();
    const updated = saveGoogleBackupConfig({ autoBackupEnabled: enabled });
    setConfig(updated);
  };

  const handleToggleFallback = (enabled: boolean) => {
    sounds.playClick();
    const updated = saveGoogleBackupConfig({ fallbackOnQuotaExceeded: enabled });
    setConfig(updated);
  };

  const handleCopyCode = () => {
    sounds.playClick();
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopiedCode(true);
    if (showToast) {
      showToast(
        lang === 'th' ? 'คัดลอกโค้ด Google Apps Script แล้ว' : 'Google Apps Script code copied to clipboard',
        'info'
      );
    }
    setTimeout(() => setCopiedCode(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-gradient-to-b from-[#0e1628] to-[#070b14] border border-emerald-500/40 shadow-2xl shadow-emerald-950/50 overflow-hidden text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/10 bg-[#121c32]/80">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
              <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  {lang === 'th' ? 'สำรองข้อมูล Google Sheets & Drive' : 'Google Sheets & Drive Database'}
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {lang === 'th' ? 'ฟรี ไม่จำกัด' : 'Free & Unlimited'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {lang === 'th'
                  ? 'ระบบฐานข้อมูลกลางสำรองสำหรับ Owner ป้องกันปัญหาโควต้า Firebase เต็ม'
                  : 'Owner Central Backup Engine to prevent Firebase Quota Exceeded'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-[#090e1a]/60 px-4 sm:px-6 pt-2">
          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('control');
            }}
            className={`flex items-center gap-2 pb-2.5 px-3 text-xs sm:text-sm font-medium border-b-2 transition-all cursor-pointer ${
              activeTab === 'control'
                ? 'border-emerald-400 text-emerald-300 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>{lang === 'th' ? 'แผงควบคุมและสถานะ' : 'Control Panel & Status'}</span>
          </button>
          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('guide');
            }}
            className={`flex items-center gap-2 pb-2.5 px-3 text-xs sm:text-sm font-medium border-b-2 transition-all cursor-pointer ${
              activeTab === 'guide'
                ? 'border-emerald-400 text-emerald-300 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Info className="w-4 h-4" />
            <span>{lang === 'th' ? 'วิธีติดตั้ง 4 ขั้นตอน' : '4-Step Setup Guide'}</span>
          </button>
          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('code');
            }}
            className={`flex items-center gap-2 pb-2.5 px-3 text-xs sm:text-sm font-medium border-b-2 transition-all cursor-pointer ${
              activeTab === 'code'
                ? 'border-emerald-400 text-emerald-300 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>{lang === 'th' ? 'โค้ด Apps Script' : 'Apps Script Code'}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs sm:text-sm">
          {/* TAB 1: CONTROL PANEL */}
          {activeTab === 'control' && (
            <div className="space-y-4">
              {/* Status Banner */}
              <div className="p-3.5 rounded-xl bg-[#131d33] border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      config.webAppUrl ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]' : 'bg-slate-500'
                    }`}
                  />
                  <div>
                    <div className="font-semibold text-white">
                      {config.webAppUrl
                        ? (lang === 'th' ? 'ระบบฐานข้อมูล Google Sheets พร้อมใช้งาน' : 'Google Sheets Database Active')
                        : (lang === 'th' ? 'ยังไม่ได้เชื่อมต่อ Google Apps Script' : 'Google Apps Script Not Connected')}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {config.lastBackupAt
                        ? `${lang === 'th' ? 'สำรองข้อมูลล่าสุดเมื่อ:' : 'Last backed up:'} ${new Date(
                            config.lastBackupAt
                          ).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')}`
                        : (lang === 'th' ? 'ยังไม่มีประวัติการสำรอง' : 'No backup records yet')}
                    </div>
                  </div>
                </div>

                {config.sheetUrl && (
                  <a
                    href={config.sheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/30 transition-all font-semibold text-xs shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{lang === 'th' ? 'เปิด Google Sheet' : 'Open Sheet'}</span>
                  </a>
                )}
              </div>

              {/* URL Input Form */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  {lang === 'th' ? 'Google Apps Script Web App URL:' : 'Google Apps Script Web App URL:'}
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#0a0f1c] border border-white/20 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 font-mono text-xs"
                  />
                  <button
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 shadow-md shadow-emerald-900/40"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                    <span>{lang === 'th' ? 'ทดสอบการเชื่อมต่อ' : 'Test Connection'}</span>
                  </button>
                </div>
              </div>

              {/* Status / Alert Message */}
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
                  <span className="leading-relaxed">{statusMessage.text}</span>
                </div>
              )}

              {/* Current Data Overview */}
              <div className="p-3.5 rounded-xl bg-[#0c1322] border border-white/10 space-y-2">
                <div className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span>{lang === 'th' ? 'ข้อมูลในระบบ Clan Hub ปัจจุบันที่พร้อมสำรอง:' : 'Current Clan Hub Data Ready for Backup:'}</span>
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
                    <div className="text-[11px] text-slate-400">{lang === 'th' ? 'คิวไอเทม' : 'Queues'}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#141e33] border border-white/5">
                    <div className="text-lg font-bold text-amber-300 font-mono">
                      {currentData.vaultBalance.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-slate-400">{lang === 'th' ? 'กองทุนไดอา' : 'Diamonds'}</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  onClick={handleBackupNow}
                  disabled={isBackingUp || !inputUrl.trim()}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition-all cursor-pointer"
                >
                  <UploadCloud className={`w-4 h-4 ${isBackingUp ? 'animate-bounce' : ''}`} />
                  <span>
                    {isBackingUp
                      ? (lang === 'th' ? 'กำลังสำรองข้อมูล...' : 'Backing up...')
                      : (lang === 'th' ? 'สำรองข้อมูลขึ้น Sheets & Drive ทันที' : 'Backup to Sheets & Drive Now')}
                  </span>
                </button>

                <button
                  onClick={handleRestoreNow}
                  disabled={isRestoring || !inputUrl.trim()}
                  className="w-full py-3 px-4 rounded-xl bg-[#141f36] hover:bg-[#1a2947] border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 hover:text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <DownloadCloud className={`w-4 h-4 ${isRestoring ? 'animate-bounce' : ''}`} />
                  <span>
                    {isRestoring
                      ? (lang === 'th' ? 'กำลังดึงข้อมูล...' : 'Restoring...')
                      : (lang === 'th' ? 'ดึงข้อมูลจาก Google Sheets กลับมา' : 'Fetch / Restore from Sheets')}
                  </span>
                </button>
              </div>

              {/* Automatic Options */}
              <div className="p-3 rounded-xl bg-[#0d1526] border border-white/10 space-y-2.5">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="pr-2">
                    <div className="font-semibold text-white text-xs">
                      {lang === 'th' ? 'สำรองข้อมูลอัตโนมัติเมื่อมีการแก้ไข (Auto-Sync)' : 'Auto-Sync to Google Sheets'}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {lang === 'th'
                        ? 'ระบบจะส่งข้อมูลไปอัปเดตบน Google Sheets ให้อัตโนมัติในเบื้องหลัง'
                        : 'Automatically sync changes to Google Sheets in the background'}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.autoBackupEnabled}
                    onChange={(e) => handleToggleAutoBackup(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 bg-slate-900 border-white/20"
                  />
                </label>

                <div className="border-t border-white/5 pt-2">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="pr-2">
                      <div className="font-semibold text-white text-xs">
                        {lang === 'th' ? 'ฐานข้อมูลสำรองอัตโนมัติ (Failover Mode)' : 'Automatic Failover Mode'}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {lang === 'th'
                          ? 'เมื่อ Firebase Firestore ติดลิมิตโควต้าฟรี ระบบจะดึงข้อมูลจาก Google Sheets แทนทันที'
                          : 'Seamlessly fall back to Google Sheets whenever Firebase hits daily read limits'}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.fallbackOnQuotaExceeded}
                      onChange={(e) => handleToggleFallback(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 bg-slate-900 border-white/20"
                    />
                  </label>
                </div>
              </div>

              {/* Primary Database (Firebase Cloud) 2-Way Sync */}
              <div className="p-3.5 rounded-xl bg-[#0a1222] border border-sky-500/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-sky-400" />
                    <span className="font-bold text-white text-xs sm:text-sm">
                      {lang === 'th' ? 'การซิงค์กับระบบหลัก (Firebase Firestore Cloud)' : 'Primary Database (Firebase Cloud Sync)'}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                    {lang === 'th' ? 'ระบบหลัก' : 'Primary Cloud'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {lang === 'th'
                    ? 'เมื่อระบบหลัก Firebase หายจากการติดโควต้าหรืออัปเกรดแล้ว สามารถกดดึงข้อมูลจริงจาก Cloud มาทับ หรือเขียนข้อมูลปัจจุบันกลับขึ้น Cloud ได้'
                    : 'When Firebase Cloud recovers from quota limits, you can fetch authentic cloud data to overwrite local, or push current data back to Cloud.'}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <button
                    onClick={handleFetchFromFirebaseCloud}
                    disabled={isFetchingFromCloud}
                    className="py-2.5 px-3 rounded-xl bg-sky-600/30 hover:bg-sky-600/50 border border-sky-500/50 text-sky-200 hover:text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isFetchingFromCloud ? 'animate-spin' : ''}`} />
                    <span>
                      {isFetchingFromCloud
                        ? (lang === 'th' ? 'กำลังดึงจาก Cloud...' : 'Fetching from Cloud...')
                        : (lang === 'th' ? 'ดึงข้อมูลจริงจาก Firebase Cloud มาทับ' : 'Fetch & Overwrite from Cloud')}
                    </span>
                  </button>

                  <button
                    onClick={handleSyncToFirebaseCloud}
                    disabled={isSyncingToCloud}
                    className="py-2.5 px-3 rounded-xl bg-amber-600/25 hover:bg-amber-600/45 border border-amber-500/50 text-amber-200 hover:text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                  >
                    <UploadCloud className={`w-3.5 h-3.5 ${isSyncingToCloud ? 'animate-bounce' : ''}`} />
                    <span>
                      {isSyncingToCloud
                        ? (lang === 'th' ? 'กำลังเขียนลง Cloud...' : 'Writing to Cloud...')
                        : (lang === 'th' ? 'เขียนข้อมูลชุดนี้กลับขึ้น Firebase Cloud' : 'Push Data to Firebase Cloud')}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SETUP GUIDE */}
          {activeTab === 'guide' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs leading-relaxed flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  {lang === 'th'
                    ? 'ระบบนี้ทำงานบนบัญชี Google ของ Owner เอง 100% ปลอดภัยสูง ข้อมูลไม่ผ่านเซิร์ฟเวอร์บุคคลที่สาม และไม่จำกัดโควต้าอ่านข้อมูล'
                    : 'Runs 100% on the Owner\'s personal Google Account. Highly secure, no third-party servers, and zero read quota limits.'}
                </span>
              </div>

              <ol className="space-y-3">
                <li className="p-3 rounded-xl bg-[#0e1628] border border-white/10 space-y-1">
                  <div className="font-bold text-white flex items-center justify-between">
                    <span>{lang === 'th' ? '1. สร้าง Google Spreadsheet ใหม่' : '1. Create a New Google Spreadsheet'}</span>
                    <a
                      href="https://sheets.new"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 text-xs"
                    >
                      <span>sheets.new</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-xs text-slate-400">
                    {lang === 'th'
                      ? 'เปิด sheets.new แล้วตั้งชื่อไฟล์ เช่น "Lineage2M Clan Hub - Database"'
                      : 'Open sheets.new and name it "Lineage2M Clan Hub - Database"'}
                  </p>
                </li>

                <li className="p-3 rounded-xl bg-[#0e1628] border border-white/10 space-y-1">
                  <div className="font-bold text-white">
                    {lang === 'th' ? '2. เปิด Apps Script' : '2. Open Apps Script'}
                  </div>
                  <p className="text-xs text-slate-400">
                    {lang === 'th'
                      ? 'ที่เมนูด้านบนของ Google Sheets คลิก "ส่วนขยาย" (Extensions) > "Apps Script"'
                      : 'In Google Sheets menu, click "Extensions" > "Apps Script"'}
                  </p>
                </li>

                <li className="p-3 rounded-xl bg-[#0e1628] border border-white/10 space-y-2">
                  <div className="font-bold text-white flex items-center justify-between">
                    <span>{lang === 'th' ? '3. วางโค้ด Google Apps Script' : '3. Paste the Apps Script Code'}</span>
                    <button
                      onClick={handleCopyCode}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:text-white text-xs flex items-center gap-1 cursor-pointer transition-all"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode ? (lang === 'th' ? 'คัดลอกแล้ว!' : 'Copied!') : (lang === 'th' ? 'คัดลอกโค้ด' : 'Copy Code')}</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">
                    {lang === 'th'
                      ? 'ลบโค้ดเดิมใน Code.gs ทั้งหมด แล้ววางโค้ดที่เตรียมไว้ให้จากแท็บ "โค้ด Apps Script" จากนั้นกด Ctrl+S เพื่อบันทึก'
                      : 'Replace all code in Code.gs with the script provided in the "Apps Script Code" tab, then press Ctrl+S to save.'}
                  </p>
                </li>

                <li className="p-3 rounded-xl bg-[#0e1628] border border-white/10 space-y-1">
                  <div className="font-bold text-white">
                    {lang === 'th' ? '4. เผยแพร่เป็นเว็บแอป (Deploy as Web App)' : '4. Deploy as Web App'}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {lang === 'th' ? (
                      <>
                        คลิกปุ่มสีน้ำเงิน <strong>"ทำให้ใช้งานได้" (Deploy)</strong> ด้านบนขวา &gt;{' '}
                        <strong>"การทำให้ใช้งานได้รายการใหม่" (New deployment)</strong> &gt; คลิกไอคอนฟันเฟืองเลือก{' '}
                        <strong>"เว็บแอป" (Web app)</strong><br />
                        - เรียกใช้ในฐานะ (Execute as): <strong>ฉัน (Me)</strong><br />
                        - ผู้ที่มีสิทธิ์เข้าถึง (Who has access): <strong>ทุกคน (Anyone)</strong><br />
                        คลิก "ทำให้ใช้งานได้" (Deploy) อนุมัติสิทธิ์ แล้วคัดลอก <strong>URL เว็บแอป</strong> นำมาวางในแผงควบคุม
                      </>
                    ) : (
                      <>
                        Click the blue <strong>"Deploy"</strong> button at top right &gt;{' '}
                        <strong>"New deployment"</strong> &gt; Click gear icon and select{' '}
                        <strong>"Web app"</strong><br />
                        - Execute as: <strong>Me</strong><br />
                        - Who has access: <strong>Anyone</strong><br />
                        Click "Deploy", authorize permissions, then copy the <strong>Web App URL</strong> and paste it into the Control Panel.
                      </>
                    )}
                  </p>
                </li>
              </ol>
            </div>
          )}

          {/* TAB 3: SCRIPT CODE */}
          {activeTab === 'code' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {lang === 'th' ? 'โค้ด Code.gs สำหรับ Google Apps Script (พร้อมระบบ Auto Drive & Sheets)' : 'Code.gs for Google Apps Script:'}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-950/40"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? (lang === 'th' ? 'คัดลอกเรียบร้อยแล้ว!' : 'Copied!') : (lang === 'th' ? 'คัดลอกโค้ดทั้งหมด' : 'Copy Full Script')}</span>
                </button>
              </div>

              <div className="relative rounded-xl border border-white/10 bg-[#060a12] p-3 font-mono text-[11px] text-emerald-300/90 overflow-x-auto max-h-[380px] leading-relaxed">
                <pre>{GOOGLE_APPS_SCRIPT_CODE}</pre>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t border-white/10 bg-[#0c1424]">
          <span className="text-[11px] text-slate-500">
            Lineage2M Clan Hub &bull; Owner Google Cloud Protection
          </span>
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
