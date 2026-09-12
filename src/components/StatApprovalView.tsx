import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Zap,
  ArrowRight,
  HelpCircle,
  ExternalLink,
  ArrowLeft,
  Maximize2,
  Eye,
  Rows,
  Columns,
  Sparkles,
  ZoomIn
} from 'lucide-react';
import { User, OFFICIAL_CLASSES, ActiveTab } from '../types';
import { sounds } from '../utils/sound';
import { ScreenshotGuideModal } from './ScreenshotGuideModal';
import { StatComparisonModal } from './StatComparisonModal';
import { getFormulaSettings } from '../services/powerFormulaService';

interface StatApprovalViewProps {
  pendingUsers: User[];
  lang: 'th' | 'en';
  onApproveStatUpdate: (userId: string) => Promise<void>;
  onRejectStatUpdate: (userId: string, reason: string) => Promise<void>;
  onNavigateTab?: (tab: ActiveTab) => void;
  onViewImageZoom?: (url: string, title?: string) => void;
  showToast?: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

const QUICK_REJECTION_REASONS: Record<'th' | 'en', string[]> = {
  th: [
    '📷 ภาพสกรีนช็อตไม่ชัดเจน หรือไม่เห็นชื่อตัวละคร',
    '🔢 ตัวเลขสเตตัสที่กรอกไม่ตรงกับในภาพสกรีนช็อต',
    '🔮 ขาดภาพหน้าผลึกวิญญาณ (Spirits)',
    '⏳ ภาพสกรีนช็อตเก่าเกินไป รบกวนแคปภาพล่าสุด',
    '🛡️ มีบัฟหรือน้ำยาชั่วคราวติดมา รบกวนแคปภาพสเตตัสเปล่า'
  ],
  en: [
    '📷 Screenshot is blurry or character name is not visible',
    '🔢 Submitted stat numbers do not match screenshot values',
    '🔮 Missing spirit enhancement screenshot (Spirits)',
    '⏳ Screenshot is outdated, please submit latest screenshot',
    '🛡️ Temporary buffs/potions active, please submit unbuffed screenshot'
  ]
};

export const StatApprovalView: React.FC<StatApprovalViewProps> = ({
  pendingUsers,
  lang,
  onApproveStatUpdate,
  onRejectStatUpdate,
  onNavigateTab,
  onViewImageZoom,
  showToast
}) => {
  const [rejectingUserId, setRejectingUserId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [expanded100, setExpanded100] = useState<Record<string, boolean>>({});
  const [inspectingUser, setInspectingUser] = useState<User | null>(null);
  const [cardLayoutMode, setCardLayoutMode] = useState<Record<string, 'side-by-side' | 'full-width'>>({});

  const formulaConfig = getFormulaSettings();
  const classMap = new Map(OFFICIAL_CLASSES.map((c) => [c.nameEn.toLowerCase(), c]));

  const handleApprove = async (user: User) => {
    setIsProcessing(true);
    try {
      sounds.playSuccess();
      await onApproveStatUpdate(user.id);
      if (showToast) {
        showToast(
          lang === 'th'
            ? `อนุมัติสเตตัสใหม่ของ ${user.inGameName} สำเร็จ (⚡ ${user.pendingPowerLevel?.toLocaleString()} PL) 🎉`
            : `Approved ${user.inGameName}'s stat update (⚡ ${user.pendingPowerLevel?.toLocaleString()} PL) 🎉`,
          'success'
        );
      }
    } catch (err: any) {
      if (showToast) showToast(err?.message || 'Approval failed', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenReject = (userId: string) => {
    sounds.playClick();
    setRejectingUserId(userId);
    setRejectionReason(QUICK_REJECTION_REASONS[lang][1]);
  };

  const handleConfirmReject = async () => {
    if (!rejectingUserId) return;
    if (!rejectionReason.trim()) {
      alert(lang === 'th' ? 'กรุณาระบุเหตุผลการปฏิเสธ' : 'Please provide a reason');
      return;
    }

    setIsProcessing(true);
    try {
      sounds.playClick();
      await onRejectStatUpdate(rejectingUserId, rejectionReason.trim());
      if (showToast) {
        showToast(
          lang === 'th' ? 'ปฏิเสธคำขอและส่งเหตุผลกลับไปยังสมาชิกแล้ว' : 'Request rejected and feedback sent',
          'info'
        );
      }
      setRejectingUserId(null);
      setRejectionReason('');
    } catch (err: any) {
      if (showToast) showToast(err?.message || 'Rejection failed', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-20">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  onNavigateTab('dashboard');
                }}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-amber-300 transition mr-2 cursor-pointer"
              >
                <ArrowLeft className="size-3.5" />
                <span>{lang === 'th' ? 'กลับแดชบอร์ด' : 'Dashboard'}</span>
              </button>
            )}
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
              ADMIN VERIFICATION
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-[#fff2b8] via-[#e6be44] to-[#c99a22] flex items-center gap-3">
            <span>{lang === 'th' ? 'ตรวจสอบคำขออัปเดตสเตตัส' : 'Stat Update Approvals'}</span>
            <span className="text-sm px-3 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
              {pendingUsers.length}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {lang === 'th'
              ? 'ตรวจสอบความถูกต้องของสเตตัสตัวละคร ผลึกวิญญาณ และอาชีพ เทียบกับภาพสกรีนช็อตจริงจากในเกม'
              : 'Verify member stats, classes, and spirit enhancements against in-game screenshot proof.'}
          </p>
        </div>

        {/* Screenshot Guide Trigger */}
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              setIsGuideOpen(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <HelpCircle className="size-4 text-cyan-400" />
            <span>{lang === 'th' ? 'เกณฑ์ภาพที่ถูกต้อง' : 'Screenshot Guide'}</span>
          </button>
        </div>
      </div>

      {/* Main List Body */}
      {pendingUsers.length === 0 ? (
        <div className="py-24 text-center rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4 shadow-xl">
          <div className="size-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
            <CheckCircle2 className="size-8" />
          </div>
          <div className="text-lg font-bold text-white">
            {lang === 'th' ? 'ไม่มีคำขอสเตตัสค้างตรวจ' : 'No pending stat requests'}
          </div>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {lang === 'th'
              ? 'คำขออัปเดตสเตตัสและค่าพลังทั้งหมดได้รับการตรวจสอบเรียบร้อยแล้ว'
              : 'All member stat update requests have been verified.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {pendingUsers.map((user) => {
            const prevPL = user.powerLevel || 0;
            const nextPL = user.pendingPowerLevel || 0;
            const diffPL = nextPL - prevPL;
            const pendingStats = user.pendingStats || {};
            const pendingSpirits = user.pendingSpiritEnhancements || {};
            const displayClasses = user.pendingClasses !== undefined && user.pendingClasses !== null
              ? user.pendingClasses
              : (user.classes || (user.characterClass ? [user.characterClass] : []));
            const displayLevel = user.pendingLevel !== undefined && user.pendingLevel !== null
              ? user.pendingLevel
              : (user.level || 0);
            const displayLegendClasses = user.pendingLegendClasses !== undefined && user.pendingLegendClasses !== null
              ? user.pendingLegendClasses
              : (user.legendClasses || 0);
            const displayLegendAgathions = user.pendingLegendAgathions !== undefined && user.pendingLegendAgathions !== null
              ? user.pendingLegendAgathions
              : (user.legendAgathions || 0);

            return (
              <div
                key={user.id}
                className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-750 hover:border-slate-650 transition shadow-2xl space-y-5"
              >
                {/* Member Summary Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3.5">
                    <div className="size-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-300 font-bold text-base shadow-inner shrink-0">
                      {user.inGameName.charAt(0).toUpperCase()}
                    </div>
                    <div className="space-y-1">
                      <div className="font-bold text-base text-white flex flex-wrap items-center gap-2">
                        <span>{user.inGameName}</span>
                        <span className="text-xs text-slate-400 font-normal">
                          ({user.clan || 'VoltZ'})
                        </span>
                        {displayLevel > 0 && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-mono">
                            Lv. {displayLevel}
                          </span>
                        )}
                        {displayClasses.map((clsName) => {
                          const meta = classMap.get(clsName.toLowerCase());
                          return (
                            <span
                              key={clsName}
                              className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-lg bg-purple-500/20 text-purple-200 border border-purple-500/40 shadow-sm"
                            >
                              {meta?.icon && (
                                <img
                                  src={meta.icon}
                                  alt={clsName}
                                  className="size-4 object-contain shrink-0"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              )}
                              <span>{clsName}</span>
                            </span>
                          );
                        })}
                      </div>
                      <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5 text-slate-500" />
                          <span>
                            {user.pendingPowerLevelRequestedAt
                              ? new Date(user.pendingPowerLevelRequestedAt).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')
                              : (lang === 'th' ? 'เมื่อสักครู่' : 'Just now')}
                          </span>
                        </span>
                        {(displayLegendClasses > 0 || displayLegendAgathions > 0) && (
                          <span className="text-slate-300 font-mono">
                            • Legend: <span className="text-amber-300 font-bold">{displayLegendClasses}</span> Classes / <span className="text-amber-300 font-bold">{displayLegendAgathions}</span> Agathions
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Power Level Comparison Badge */}
                  <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-950 border border-slate-750 shadow-inner">
                    <span className="text-xs text-slate-400 font-mono">
                      {prevPL.toLocaleString()} PL
                    </span>
                    <ArrowRight className="size-4 text-slate-500" />
                    <span className="text-lg font-black text-amber-400 font-mono">
                      ⚡ {nextPL.toLocaleString()} PL
                    </span>
                    {diffPL > 0 && (
                      <span className="text-xs font-bold text-emerald-400 font-mono bg-emerald-500/15 px-2 py-0.5 rounded-md border border-emerald-500/30">
                        (+{diffPL.toLocaleString()})
                      </span>
                    )}
                  </div>
                </div>

                {(() => {
                  const displayScreenshot = user.pendingStatScreenshotUrl || user.statScreenshotUrl;
                  const isPendingNew = !!user.pendingStatScreenshotUrl;
                  const isFullWidth = cardLayoutMode[user.id] === 'full-width';
                  const is100Percent = !!expanded100[user.id];

                  return (
                    <div className="space-y-4">
                      {/* Comparison Toolbar & Layout Switcher */}
                      <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                            <Sparkles className="size-3.5 text-amber-400" />
                            <span>{lang === 'th' ? 'การแสดงผลเทียบสเตตัส:' : 'Comparison View:'}</span>
                          </span>

                          {displayScreenshot && (
                            <button
                              type="button"
                              onClick={() => {
                                sounds.playClick();
                                setInspectingUser(user);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 transition flex items-center gap-1.5 cursor-pointer active:scale-98"
                            >
                              <Eye className="size-3.5" />
                              <span>{lang === 'th' ? '🔍 เปิดโหมดเทียบข้างรูปเต็มจอ' : '🔍 Full Side-by-Side Compare'}</span>
                            </button>
                          )}
                        </div>

                        {displayScreenshot && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-[11px] text-slate-400 mr-1 hidden sm:inline">
                              {lang === 'th' ? 'รูปแบบบนการ์ด:' : 'Card Layout:'}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                sounds.playClick();
                                setCardLayoutMode(prev => ({
                                  ...prev,
                                  [user.id]: prev[user.id] === 'full-width' ? 'side-by-side' : 'full-width'
                                }));
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer ${
                                isFullWidth
                                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                              }`}
                              title={isFullWidth ? (lang === 'th' ? 'สลับเป็นแบ่ง 2 ข้าง' : 'Switch to Side-by-Side') : (lang === 'th' ? 'แสดงภาพเต็มความกว้างแถว' : 'Full Width Image')}
                            >
                              {isFullWidth ? <Columns className="size-3.5" /> : <Rows className="size-3.5" />}
                              <span>{isFullWidth ? (lang === 'th' ? '↕ ภาพเต็มความกว้าง' : 'Full Width') : (lang === 'th' ? '↔ แบ่ง 2 ข้าง' : 'Side-by-Side')}</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Body Grid: Stats breakdown vs Proof Screenshot */}
                      <div className={`grid grid-cols-1 ${isFullWidth ? 'lg:grid-cols-12 gap-5' : 'lg:grid-cols-12 gap-6'} items-start`}>
                        {/* 1. In Full-Width mode: Screenshot spans all 12 cols on TOP so numbers are giant & uncropped */}
                        {isFullWidth && displayScreenshot && (
                          <div className="lg:col-span-12 space-y-2">
                            <div className="rounded-2xl border-2 border-amber-500/40 bg-slate-950/95 p-4 shadow-2xl space-y-3">
                              <div className="flex items-center justify-between text-xs font-bold text-slate-300 border-b border-slate-800 pb-2">
                                <div className="flex items-center gap-2">
                                  <span>{lang === 'th' ? '📸 ภาพหลักฐานขนาดเต็ม (ไม่ถูกตัดขอบ):' : '📸 Proof Screenshot (Full Width Uncropped):'}</span>
                                  {isPendingNew ? (
                                    <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px]">
                                      ✨ {lang === 'th' ? 'รูปใหม่ที่แนบมา' : 'New Image'}
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[10px]">
                                      📸 {lang === 'th' ? 'รูปเดิม' : 'Previous'}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setInspectingUser(user)}
                                    className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <Eye className="size-3.5" />
                                    <span>{lang === 'th' ? 'เปิดโหมดเทียบข้างรูป' : 'Side-by-Side View'}</span>
                                  </button>
                                </div>
                              </div>

                              <div
                                onClick={() => setInspectingUser(user)}
                                className="relative rounded-xl border border-slate-800 bg-black/95 flex items-center justify-center p-2 cursor-zoom-in group transition hover:border-amber-500/60 overflow-hidden"
                              >
                                <img
                                  src={displayScreenshot}
                                  alt="Full Width Proof"
                                  className="w-full h-auto max-h-[800px] object-contain rounded-lg transition duration-200 group-hover:scale-[1.005]"
                                />
                                <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition backdrop-blur-[1px] pointer-events-none">
                                  🔍 {lang === 'th' ? 'คลิกเพื่อเปิดโหมดเปรียบเทียบเต็มจอ (ซูม/เลื่อนดูชัดๆ)' : 'Click to inspect side-by-side'}
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                                <span>{lang === 'th' ? '✓ ขยายกว้างเต็มหน้าจอ ตัวเลขในภาพชัดเจน อ่านง่าย' : '✓ Full width uncropped image'}</span>
                                <span className="text-amber-400 font-semibold">{lang === 'th' ? 'เทียบสเตตัสที่กรอกด้านล่างนี้ ↓' : 'Compare with submitted stats below ↓'}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 2. Submitted Stats Breakdown (6 cols in side-by-side, or 12 cols in full-width mode) */}
                        <div className={`${isFullWidth ? 'lg:col-span-12' : 'lg:col-span-6'} space-y-3`}>
                          <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                            <span>{lang === 'th' ? 'สเตตัสที่ขออัปเดต:' : 'Submitted Stat Values:'}</span>
                            <span className="text-[11px] text-slate-400 font-normal">
                              {isFullWidth
                                ? (lang === 'th' ? 'เทียบตัวเลขกับรูปภาพขนาดใหญ่ด้านบน' : 'Compare values with proof above')
                                : (lang === 'th' ? 'เทียบตัวเลขกับรูปภาพด้านขวา' : 'Compare values with proof on the right')}
                            </span>
                          </div>

                          <div className={`grid ${isFullWidth ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3'} gap-2.5 text-xs`}>
                            {formulaConfig.stats
                              .filter((s) => s.isActive && (pendingStats[s.id] !== undefined || s.inputType === 'spirit_card'))
                              .map((s) => {
                                const val = pendingStats[s.id] ?? 0;
                                const prevVal = user.stats?.[s.id] ?? 0;
                                const isChanged = val !== prevVal;
                                const enh = pendingSpirits[s.id];

                                return (
                                  <div
                                    key={s.id}
                                    className={`p-2.5 rounded-xl border transition ${
                                      isChanged
                                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-200 shadow-sm ring-1 ring-amber-500/20'
                                        : 'bg-slate-950/70 border-slate-800 text-slate-300'
                                    }`}
                                  >
                                    <div className="text-[10px] text-slate-400 truncate font-medium" title={s.labelTh}>
                                      {lang === 'th' ? s.labelTh : s.labelEn}
                                    </div>
                                    <div className="flex items-center justify-between mt-1">
                                      <span className="font-bold text-sm text-white font-mono">
                                        {val}
                                        {s.inputType === 'percentage' && '%'}
                                        {s.inputType === 'spirit_card' && enh !== undefined && (
                                          <span
                                            className="ml-1.5 px-1.5 py-0.2 rounded text-[10px] font-bold"
                                            style={{
                                              color: s.spiritConfig?.accentColor || '#3b82f6',
                                              backgroundColor: `${s.spiritConfig?.accentColor || '#3b82f6'}22`
                                            }}
                                          >
                                            {enh === 0 ? '0' : `+${enh}`}
                                          </span>
                                        )}
                                      </span>
                                      {isChanged && prevVal > 0 && (
                                        <span className="text-[10px] text-slate-500 line-through font-mono">
                                          {prevVal}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>

                        {/* 3. In Side-by-Side mode: Screenshot Proof (6 cols, sticky on desktop) */}
                        {!isFullWidth && (
                          <div className="lg:col-span-6 space-y-2.5 lg:sticky lg:top-4 self-start">
                            <div className="rounded-2xl border-2 border-slate-700/90 bg-slate-950/95 p-3.5 shadow-2xl space-y-2.5 backdrop-blur-sm">
                              {/* Header toolbar */}
                              <div className="text-xs font-bold text-slate-300 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                                <div className="flex items-center gap-2">
                                  <span>{lang === 'th' ? 'ภาพหลักฐานในเกม:' : 'Proof Screenshot:'}</span>
                                  {isPendingNew ? (
                                    <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px] normal-case shadow">
                                      ✨ {lang === 'th' ? 'รูปใหม่' : 'New'}
                                    </span>
                                  ) : user.statScreenshotUrl ? (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[10px] normal-case">
                                      📸 {lang === 'th' ? 'รูปเดิม' : 'Prev'}
                                    </span>
                                  ) : null}
                                </div>

                                {displayScreenshot && (
                                  <div className="flex items-center gap-1.5">
                                    {/* Open Full Side-by-Side Compare Modal */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        sounds.playClick();
                                        setInspectingUser(user);
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer"
                                      title={lang === 'th' ? 'เปิดโหมดเทียบข้างรูปเต็มจอ' : 'Side-by-Side Compare'}
                                    >
                                      <Eye className="size-3" />
                                      <span>{lang === 'th' ? 'เทียบเต็มจอ' : 'Compare'}</span>
                                    </button>

                                    {/* Toggle Fit vs 100% Natural */}
                                    <button
                                      type="button"
                                      onClick={() => setExpanded100(prev => ({ ...prev, [user.id]: !prev[user.id] }))}
                                      className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition flex items-center gap-1 cursor-pointer ${
                                        is100Percent
                                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                      }`}
                                      title={is100Percent ? (lang === 'th' ? 'ย่อให้พอดีกรอบ' : 'Fit to Box') : (lang === 'th' ? 'ดูขนาดจริง 100%' : '100% Natural Size')}
                                    >
                                      <Maximize2 className="size-3" />
                                      <span>{is100Percent ? (lang === 'th' ? 'พอดีกรอบ' : 'Fit') : (lang === 'th' ? 'ขนาด 100%' : '100%')}</span>
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Uncropped Full Screenshot Box */}
                              {displayScreenshot ? (
                                <div className="space-y-1.5">
                                  <div
                                    className={`relative rounded-xl border border-slate-800 bg-black/95 transition-all ${
                                      is100Percent
                                        ? 'max-h-[640px] overflow-auto cursor-grab'
                                        : 'min-h-[360px] max-h-[600px] flex items-center justify-center overflow-hidden cursor-zoom-in group'
                                    }`}
                                    onClick={() => setInspectingUser(user)}
                                  >
                                    <img
                                      src={displayScreenshot}
                                      alt="Stat Proof"
                                      className={
                                        is100Percent
                                          ? 'max-w-none w-auto rounded-lg'
                                          : 'w-full h-auto max-h-[580px] object-contain rounded-lg transition duration-200 group-hover:scale-[1.01]'
                                      }
                                    />
                                    {!is100Percent && (
                                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition backdrop-blur-[1px] pointer-events-none">
                                        🔍 {lang === 'th' ? 'คลิกเพื่อเปิดโหมดเปรียบเทียบสเตตัสเต็มจอ' : 'Click to open side-by-side comparison'}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                                    <span>{lang === 'th' ? '✓ แสดงภาพเต็ม ไม่ถูกตัดขอบ' : '✓ Full uncropped screenshot'}</span>
                                    <button
                                      type="button"
                                      onClick={() => setInspectingUser(user)}
                                      className="text-amber-400 hover:text-amber-300 hover:underline font-semibold cursor-pointer"
                                    >
                                      {lang === 'th' ? '🔍 ซูมเทียบสเตตัส' : 'Compare Side-by-Side'}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="p-8 rounded-xl bg-slate-900/80 border border-slate-800 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2 aspect-video">
                                  <AlertCircle className="size-7 text-amber-400" />
                                  <span className="font-semibold text-slate-300">{lang === 'th' ? 'ไม่มีการแนบรูปสกรีนช็อต' : 'No screenshot attached'}</span>
                                  <span className="text-[11px] text-slate-500">{lang === 'th' ? 'คำขอนี้ส่งมาโดยไม่มีรูปประกอบ' : 'Submitted without proof screenshot'}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Actions Footer */}
                <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleOpenReject(user.id)}
                    disabled={isProcessing}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-semibold transition cursor-pointer"
                  >
                    <XCircle className="size-4" />
                    <span>{lang === 'th' ? 'ปฏิเสธ (Reject)' : 'Reject'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApprove(user)}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-6 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:brightness-110 text-white text-xs font-bold shadow-xl shadow-emerald-600/30 transition cursor-pointer"
                  >
                    <CheckCircle2 className="size-4" />
                    <span>{lang === 'th' ? 'อนุมัติสเตตัส (Approve)' : 'Approve'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Reason Confirmation Modal */}
      {rejectingUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5 space-y-4 text-slate-200">
            <div className="flex items-center gap-2.5 text-rose-400">
              <XCircle className="size-5 shrink-0" />
              <h3 className="font-bold text-sm text-white">
                {lang === 'th' ? 'ระบุเหตุผลการปฏิเสธคำขอ' : 'Reject Stat Update Request'}
              </h3>
            </div>

            <p className="text-xs text-slate-400">
              {lang === 'th'
                ? 'เลือกเหตุผลสำเร็จรูป หรือพิมพ์เหตุผลเพิ่มเติมเพื่อให้สมาชิกแก้ไขได้ตรงจุด'
                : 'Select a quick reason or provide specific feedback'}
            </p>

            <div className="space-y-1.5">
              {QUICK_REJECTION_REASONS[lang].map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRejectionReason(r)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs transition select-none border ${
                    rejectionReason === r
                      ? 'bg-rose-500/20 text-rose-200 border-rose-500/50'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                {lang === 'th' ? 'เหตุผลที่ส่งไปยังสมาชิก:' : 'Custom Feedback Message:'}
              </label>
              <textarea
                rows={2}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-rose-400 font-sans"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setRejectingUserId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition"
              >
                {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={isProcessing}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition disabled:opacity-50"
              >
                {lang === 'th' ? 'ยืนยันการปฏิเสธ' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Side-by-Side Fullscreen Inspector Modal */}
      {inspectingUser && (
        <StatComparisonModal
          isOpen={!!inspectingUser}
          onClose={() => setInspectingUser(null)}
          user={inspectingUser}
          lang={lang}
          onApprove={handleApprove}
          onOpenReject={(userId) => {
            setInspectingUser(null);
            handleOpenReject(userId);
          }}
          isProcessing={isProcessing}
        />
      )}

      {/* Screenshot Guide Lightbox */}
      <ScreenshotGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        lang={lang}
        onViewImageZoom={onViewImageZoom}
      />
    </div>
  );
};
