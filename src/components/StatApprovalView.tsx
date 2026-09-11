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
  ArrowLeft
} from 'lucide-react';
import { User, OFFICIAL_CLASSES, ActiveTab } from '../types';
import { sounds } from '../utils/sound';
import { ScreenshotGuideModal } from './ScreenshotGuideModal';
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

const QUICK_REJECTION_REASONS = [
  '📷 ภาพสกรีนช็อตไม่ชัดเจน หรือไม่เห็นชื่อตัวละคร',
  '🔢 ตัวเลขสเตตัสที่กรอกไม่ตรงกับในภาพสกรีนช็อต',
  '🔮 ขาดภาพหน้าผลึกวิญญาณ (Spirits)',
  '⏳ ภาพสกรีนช็อตเก่าเกินไป รบกวนแคปภาพล่าสุด',
  '🛡️ มีบัฟหรือน้ำยาชั่วคราวติดมา รบกวนแคปภาพสเตตัสเปล่า'
];

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
    setRejectionReason(QUICK_REJECTION_REASONS[1]);
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
                              ? new Date(user.pendingPowerLevelRequestedAt).toLocaleString('th-TH')
                              : 'เมื่อสักครู่'}
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

                {/* Body Grid: Stats breakdown vs Proof Screenshot */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left: Submitted Stats breakdown (7 cols) */}
                  <div className="lg:col-span-7 space-y-3">
                    <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                      <span>{lang === 'th' ? 'สเตตัสที่ขออัปเดต:' : 'Submitted Stat Values:'}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
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
                                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-200 shadow-sm'
                                  : 'bg-slate-950/70 border-slate-800 text-slate-300'
                              }`}
                            >
                              <div className="text-[10px] text-slate-400 truncate" title={s.labelTh}>
                                {lang === 'th' ? s.labelTh : s.labelEn}
                              </div>
                              <div className="flex items-center justify-between mt-1">
                                <span className="font-bold text-sm text-white">
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
                                  <span className="text-[10px] text-slate-500 line-through">
                                    {prevVal}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Right: Screenshot Proof (5 cols) */}
                  <div className="lg:col-span-5 space-y-2.5">
                    <div className="text-xs font-bold text-slate-300 flex items-center justify-between uppercase tracking-wider">
                      <span>{lang === 'th' ? 'ภาพหลักฐานในเกม:' : 'Proof Screenshot:'}</span>
                      {user.pendingStatScreenshotUrl && (
                        <button
                          type="button"
                          onClick={() => onViewImageZoom?.(user.pendingStatScreenshotUrl!, `${user.inGameName} Stat Proof`)}
                          className="text-xs text-amber-400 hover:underline flex items-center gap-1 cursor-pointer font-semibold"
                        >
                          <ExternalLink className="size-3" />
                          <span>{lang === 'th' ? 'คลิกขยายใหญ่' : 'Zoom In'}</span>
                        </button>
                      )}
                    </div>

                    {user.pendingStatScreenshotUrl ? (
                      <div
                        className="relative rounded-2xl overflow-hidden border-2 border-slate-700 hover:border-amber-400/80 bg-slate-950 aspect-video cursor-pointer group shadow-xl transition"
                        onClick={() => onViewImageZoom?.(user.pendingStatScreenshotUrl!, `${user.inGameName} Stat Proof`)}
                      >
                        <img
                          src={user.pendingStatScreenshotUrl}
                          alt="Stat Proof"
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition backdrop-blur-[2px]">
                          🔍 {lang === 'th' ? 'คลิกเพื่อดูภาพเต็ม' : 'Click to inspect full size'}
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2 aspect-video">
                        <AlertCircle className="size-6 text-amber-400" />
                        <span>{lang === 'th' ? 'ไม่มีการแนบรูปสกรีนช็อต' : 'No screenshot attached'}</span>
                      </div>
                    )}
                  </div>
                </div>

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
              {QUICK_REJECTION_REASONS.map((r, i) => (
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
