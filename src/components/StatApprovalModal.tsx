import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Zap,
  Swords,
  Shield,
  Flame,
  ExternalLink,
  MessageSquare,
  Sparkles,
  ArrowRight,
  Send,
  HelpCircle
} from 'lucide-react';
import { User, StatDefinition, OFFICIAL_CLASSES } from '../types';
import { sounds } from '../utils/sound';
import { ScreenshotGuideModal } from './ScreenshotGuideModal';
import { getFormulaSettings } from '../services/powerFormulaService';

interface StatApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingUsers: User[];
  lang: 'th' | 'en';
  onApproveStatUpdate: (userId: string) => Promise<void>;
  onRejectStatUpdate: (userId: string, reason: string) => Promise<void>;
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

export const StatApprovalModal: React.FC<StatApprovalModalProps> = ({
  isOpen,
  onClose,
  pendingUsers,
  lang,
  onApproveStatUpdate,
  onRejectStatUpdate,
  onViewImageZoom,
  showToast
}) => {
  const [rejectingUserId, setRejectingUserId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const formulaConfig = getFormulaSettings();
  const classMap = new Map(OFFICIAL_CLASSES.map((c) => [c.nameEn.toLowerCase(), c]));

  if (!isOpen) return null;

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
    setRejectionReason(QUICK_REJECTION_REASONS[1]); // Default to "number mismatch"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl shadow-cyan-950/40 text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/20">
              <Zap className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                {lang === 'th' ? 'ตรวจสอบคำขออัปเดตสเตตัส (Stat Approvals)' : 'Stat Update Approvals'}
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                  {pendingUsers.length}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'th'
                  ? 'ตรวจสอบความถูกต้องของตัวเลขเทียบกับภาพสกรีนช็อตจริงจากในเกม'
                  : 'Verify submitted stats against in-game screenshots'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setIsGuideOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-bold transition shadow-sm cursor-pointer"
              title={lang === 'th' ? 'ดูคู่มือตัวอย่างสกรีนช็อตที่ถูกต้อง' : 'View Screenshot Guide'}
            >
              <HelpCircle className="size-3.5 text-cyan-400" />
              <span>{lang === 'th' ? 'เกณฑ์รูปที่ถูกต้อง' : 'Screenshot Guide'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {pendingUsers.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="size-14 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="size-7" />
              </div>
              <div className="text-base font-bold text-white">
                {lang === 'th' ? 'ไม่มีคำขอสเตตัสค้างตรวจ' : 'No pending stat requests'}
              </div>
              <p className="text-xs text-slate-400">
                {lang === 'th'
                  ? 'คำขออัปเดตสเตตัสและค่าพลังทั้งหมดได้รับการตรวจสอบเรียบร้อยแล้ว'
                  : 'All member stat update requests have been verified'}
              </p>
            </div>
          ) : (
            pendingUsers.map((user) => {
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
                  className="p-4 sm:p-5 rounded-2xl bg-slate-850/90 border border-slate-750 hover:border-slate-650 transition shadow-xl space-y-4"
                >
                  {/* Member Summary Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-300 font-bold text-sm shrink-0">
                        {user.inGameName.charAt(0).toUpperCase()}
                      </div>
                      <div className="space-y-1">
                        <div className="font-bold text-sm text-white flex flex-wrap items-center gap-2">
                          <span>{user.inGameName}</span>
                          <span className="text-xs text-slate-400 font-normal">
                            ({user.clan || 'VoltZ'})
                          </span>
                          {displayLevel > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-mono">
                              Lv. {displayLevel}
                            </span>
                          )}
                          {displayClasses.map((clsName) => {
                            const meta = classMap.get(clsName.toLowerCase());
                            return (
                              <span
                                key={clsName}
                                className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-200 border border-purple-500/40 shadow-sm"
                              >
                                {meta?.icon && (
                                  <img
                                    src={meta.icon}
                                    alt={clsName}
                                    className="size-3.5 object-contain shrink-0"
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
                        <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {user.pendingPowerLevelRequestedAt
                              ? new Date(user.pendingPowerLevelRequestedAt).toLocaleString('th-TH')
                              : 'เมื่อสักครู่'}
                          </span>
                          {(displayLegendClasses > 0 || displayLegendAgathions > 0) && (
                            <span className="text-slate-400 font-mono">
                              • Legend: <span className="text-amber-300 font-bold">{displayLegendClasses}</span> Classes / <span className="text-amber-300 font-bold">{displayLegendAgathions}</span> Agathions
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Power Comparison Badge */}
                    <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-750">
                      <span className="text-xs text-slate-400 font-mono">
                        {prevPL.toLocaleString()} PL
                      </span>
                      <ArrowRight className="size-3.5 text-slate-500" />
                      <span className="text-base font-black text-amber-400 font-mono">
                        ⚡ {nextPL.toLocaleString()} PL
                      </span>
                      {diffPL > 0 && (
                        <span className="text-xs font-bold text-emerald-400 font-mono">
                          (+{diffPL.toLocaleString()})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body: Side-by-Side Stat Breakdown + Screenshot */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Left: Submitted Stats Breakdown (8 cols) */}
                    <div className="lg:col-span-8 space-y-3">
                      <div className="text-xs font-bold text-slate-300">
                        {lang === 'th' ? 'รายละเอียดสเตตัสที่ขออัปเดต:' : 'Submitted Stat Values:'}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
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
                                className={`p-2 rounded-lg border ${
                                  isChanged
                                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                                    : 'bg-slate-900 border-slate-800 text-slate-300'
                                }`}
                              >
                                <div className="text-[10px] text-slate-400 truncate" title={s.labelTh}>
                                  {lang === 'th' ? s.labelTh : s.labelEn}
                                </div>
                                <div className="flex items-center justify-between mt-1">
                                  <span className="font-bold text-white">
                                    {val}
                                    {s.inputType === 'percentage' && '%'}
                                    {s.inputType === 'spirit_card' && enh !== undefined && (
                                      <span
                                        className="ml-1 px-1.5 py-0.2 rounded text-[10px] font-bold"
                                        style={{
                                          color: s.spiritConfig?.accentColor || '#3b82f6',
                                          backgroundColor: `${s.spiritConfig?.accentColor || '#3b82f6'}20`
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

                    {/* Right: Screenshot Proof (4 cols) */}
                    <div className="lg:col-span-4 space-y-2">
                      <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                        <span>{lang === 'th' ? 'ภาพสกรีนช็อตหลักฐาน:' : 'Proof Screenshot:'}</span>
                        {user.pendingStatScreenshotUrl && (
                          <button
                            type="button"
                            onClick={() => onViewImageZoom?.(user.pendingStatScreenshotUrl!, `${user.inGameName} Stat Proof`)}
                            className="text-[10px] text-amber-400 hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="size-3" />
                            {lang === 'th' ? 'คลิกขยายใหญ่' : 'Zoom In'}
                          </button>
                        )}
                      </div>

                      {user.pendingStatScreenshotUrl ? (
                        <div
                          className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 aspect-video cursor-pointer group"
                          onClick={() => onViewImageZoom?.(user.pendingStatScreenshotUrl!, `${user.inGameName} Stat Proof`)}
                        >
                          <img
                            src={user.pendingStatScreenshotUrl}
                            alt="Stat Proof"
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold transition">
                            🔍 {lang === 'th' ? 'คลิกเพื่อดูรูปเต็ม' : 'Click to inspect'}
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2 aspect-video">
                          <AlertCircle className="size-5 text-amber-400" />
                          <span>{lang === 'th' ? 'ไม่มีการแนบรูปสกรีนช็อต' : 'No screenshot attached'}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleOpenReject(user.id)}
                      disabled={isProcessing}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-semibold transition"
                    >
                      <XCircle className="size-4" />
                      <span>{lang === 'th' ? 'ปฏิเสธ (Reject)' : 'Reject'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApprove(user)}
                      disabled={isProcessing}
                      className="flex items-center gap-1.5 px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition"
                    >
                      <CheckCircle2 className="size-4" />
                      <span>{lang === 'th' ? 'อนุมัติสเตตัส (Approve)' : 'Approve'}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-950/80">
          <span className="text-xs text-slate-500">
            {lang === 'th'
              ? 'เมื่ออนุมัติแล้ว ค่า PL และสิทธิ์รับไอเทมจะอัปเดตอัตโนมัติทั่วทั้งระบบทันที'
              : 'Approved stats will instantly update PL and unlock eligible items across the app'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
          >
            {lang === 'th' ? 'ปิด' : 'Close'}
          </button>
        </div>
      </div>

      {/* Reject Reason Dialog */}
      {rejectingUserId && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <MessageSquare className="size-4" />
                <span>{lang === 'th' ? 'ระบุเหตุผลการปฏิเสธคำขอสเตตัส' : 'Rejection Reason & Feedback'}</span>
              </div>
              <button
                onClick={() => setRejectingUserId(null)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                {lang === 'th' ? 'เลือกเหตุผลสำเร็จรูป (คลิกเดียว):' : 'Quick Presets:'}
              </label>
              <div className="space-y-1.5">
                {QUICK_REJECTION_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setRejectionReason(reason)}
                    className={`w-full text-left p-2 rounded-lg text-xs transition border ${
                      rejectionReason === reason
                        ? 'bg-rose-500/20 border-rose-500 text-rose-200 font-semibold'
                        : 'bg-slate-850 border-slate-750 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-300">
                {lang === 'th' ? 'หรือพิมพ์ข้อความบอกสมาชิกเอง:' : 'Or custom feedback:'}
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="เช่น ค่าป้องกันในรูปคือ 320 แต่กรอกมา 350 รบกวนแก้ไขตรงช่อง Defense แล้วส่งใหม่ครับ"
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-rose-400 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingUserId(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={isProcessing || !rejectionReason.trim()}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition"
              >
                <Send className="size-3.5" />
                <span>{lang === 'th' ? 'ยืนยันการปฏิเสธ' : 'Confirm Rejection'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screenshot Guide Modal for Admin verification reference */}
      <ScreenshotGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        lang={lang}
        onViewImageZoom={onViewImageZoom}
      />
    </div>
  );
};
