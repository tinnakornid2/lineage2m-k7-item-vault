import React, { useState } from 'react';
import {
  X,
  Trash2,
  RotateCcw,
  AlertTriangle,
  Crown,
  CheckCircle,
  Layers,
  Users,
  Gem,
  ShieldAlert
} from 'lucide-react';
import { Language, User } from '../types';
import { translations } from '../translations';
import { sounds } from '../utils/sound';
import {
  clearDistributedVaultItemsDoc,
  clearAllVaultItemsDoc,
  clearAllQueuesDoc,
  clearDiamondTransactionsDoc,
  resetAllUserStatsDoc
} from '../services/firebase';

interface OwnerResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  currentUser: User | null;
  vaultItemsCount: number;
  distributedItemsCount: number;
  queuesCount: number;
  diamondLogsCount: number;
  onResetSuccess?: (target: ResetTarget, count: number) => void;
}

type ResetTarget =
  | 'clear_distributed'
  | 'clear_all_vault'
  | 'clear_queues'
  | 'clear_diamond_logs'
  | 'reset_all_user_stats';

export const OwnerResetModal: React.FC<OwnerResetModalProps> = ({
  isOpen,
  onClose,
  lang,
  currentUser,
  vaultItemsCount,
  distributedItemsCount,
  queuesCount,
  diamondLogsCount,
  onResetSuccess
}) => {
  const t = translations[lang];

  const [selectedTarget, setSelectedTarget] = useState<ResetTarget>('clear_distributed');
  const [confirmText, setConfirmText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isOwner = currentUser?.role === 'owner';

  // Requires typing "RESET" only for destructive wipes
  const requiresTypeConfirm =
    selectedTarget === 'clear_all_vault' ||
    selectedTarget === 'clear_queues' ||
    selectedTarget === 'reset_all_user_stats';

  const isConfirmValid = !requiresTypeConfirm || confirmText.trim().toUpperCase() === 'RESET';

  const handleExecuteReset = async () => {
    if (!isOwner) {
      setError(lang === 'th' ? 'เฉพาะเจ้าของระบบ (Owner) เท่านั้น' : 'Owner access required');
      return;
    }
    if (!isConfirmValid) {
      setError(
        lang === 'th'
          ? 'กรุณาพิมพ์คำว่า RESET ให้ถูกต้องเพื่อยืนยัน'
          : 'Please type RESET correctly to confirm'
      );
      return;
    }

    setError(null);
    setIsProcessing(true);

    try {
      sounds.playClick();
      let affectedCount = 0;

      if (selectedTarget === 'clear_distributed') {
        affectedCount = await clearDistributedVaultItemsDoc();
        setResultMessage(
          lang === 'th'
            ? `ล้างประวัติไอเทมที่แจกแล้วสำเร็จ (${affectedCount} รายการ)`
            : `Cleared ${affectedCount} distributed item records successfully`
        );
      } else if (selectedTarget === 'clear_all_vault') {
        affectedCount = await clearAllVaultItemsDoc();
        setResultMessage(
          lang === 'th'
            ? `ล้างรายการไอเทมในคลังทั้งหมดเรียบร้อย (${affectedCount} รายการ)`
            : `Cleared all ${affectedCount} vault items successfully`
        );
      } else if (selectedTarget === 'clear_queues') {
        affectedCount = await clearAllQueuesDoc();
        setResultMessage(
          lang === 'th'
            ? `ล้างคิวไอเทมทั้งหมดเรียบร้อย (${affectedCount} รายการ)`
            : `Cleared all ${affectedCount} item queues successfully`
        );
      } else if (selectedTarget === 'clear_diamond_logs') {
        affectedCount = await clearDiamondTransactionsDoc();
        setResultMessage(
          lang === 'th'
            ? `ล้างประวัติธุรกรรมกล่องเพชรเรียบร้อย (${affectedCount} รายการ)`
            : `Cleared all ${affectedCount} diamond vault transaction logs successfully`
        );
      } else if (selectedTarget === 'reset_all_user_stats') {
        affectedCount = await resetAllUserStatsDoc();
        setResultMessage(
          lang === 'th'
            ? `รีเซ็ตค่าสเตตัสและรูปสมาชิกทุกคนเรียบร้อย (${affectedCount} สมาชิก) รอการส่งสเตตัสใหม่`
            : `Reset stats and proof screenshots for ${affectedCount} members successfully. Awaiting fresh submissions!`
        );
      }

      sounds.playMythicFanfare();
      onResetSuccess?.(selectedTarget, affectedCount);
      setConfirmText('');
    } catch (err: any) {
      console.error('Owner reset failed:', err);
      setError(err?.message || (lang === 'th' ? 'เกิดข้อผิดพลาดในการล้างข้อมูล' : 'Reset failed'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl bg-gradient-to-b from-[#1b1e2c] via-[#101422] to-[#0a0d16] border-2 border-red-500/40 shadow-2xl p-5 sm:p-6 text-slate-200 flex flex-col max-h-[92vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          id="btn-close-owner-reset-modal"
          onClick={() => {
            sounds.playClick();
            onClose();
          }}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with Owner Security Badge */}
        <div className="flex items-start gap-3.5 mb-4 pb-3 border-b border-slate-800/80">
          <div className="p-3 rounded-xl bg-gradient-to-br from-red-600/30 to-amber-600/20 border border-red-500/50 text-amber-400 shrink-0 shadow-lg">
            <Crown className="w-6 h-6 text-amber-300" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-950/80 border border-red-800 text-[10px] font-bold text-red-300 uppercase tracking-wider mb-1">
              <ShieldAlert className="w-3 h-3 text-red-400" />
              <span>{t.ownerOnlyBadge}</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-white via-[#f5d77f] to-[#d4af37]">
              {t.ownerResetTitle}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {t.ownerResetDesc}
            </p>
          </div>
        </div>

        {/* Non-owner guard */}
        {!isOwner && (
          <div className="p-4 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <span>
              {lang === 'th'
                ? 'เมนูนี้สงวนสิทธิ์เฉพาะบัญชีที่ผ่านการยืนยันและมีบทบาทเป็น "Owner" เท่านั้น'
                : 'This action is strictly restricted to accounts with the "Owner" role.'}
            </span>
          </div>
        )}

        {/* Success Alert */}
        {resultMessage && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 text-xs flex items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="font-semibold">{resultMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setResultMessage(null)}
              className="text-slate-400 hover:text-white text-xs underline cursor-pointer"
            >
              {lang === 'th' ? 'ปิด' : 'Dismiss'}
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Options List */}
        <div className="space-y-2.5 my-2">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
            {lang === 'th' ? '1. เลือกรายการที่ต้องการล้าง/รีเซ็ต:' : '1. Select action to clear/reset:'}
          </label>

          {/* Option 1: Clear Distributed Items */}
          <div
            id="opt-clear-distributed"
            onClick={() => {
              sounds.playClick();
              setSelectedTarget('clear_distributed');
              setResultMessage(null);
            }}
            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
              selectedTarget === 'clear_distributed'
                ? 'bg-[#222a3d] border-amber-400 text-white shadow-md'
                : 'bg-[#0d121e] border-slate-800 text-slate-300 hover:bg-[#151c2c]'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                  selectedTarget === 'clear_distributed'
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold flex items-center gap-2">
                  <span>{t.clearDistributedOption}</span>
                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-800 text-amber-300 font-mono">
                    {distributedItemsCount} {lang === 'th' ? 'รายการ' : 'items'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {t.clearDistributedOptionDesc}
                </p>
              </div>
            </div>
            <input
              type="radio"
              name="resetTarget"
              checked={selectedTarget === 'clear_distributed'}
              onChange={() => setSelectedTarget('clear_distributed')}
              className="mt-1 accent-amber-400 cursor-pointer"
            />
          </div>

          {/* Option 2: Clear All Vault Items */}
          <div
            id="opt-clear-all-vault"
            onClick={() => {
              sounds.playClick();
              setSelectedTarget('clear_all_vault');
              setResultMessage(null);
            }}
            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
              selectedTarget === 'clear_all_vault'
                ? 'bg-red-950/40 border-red-500 text-white shadow-md'
                : 'bg-[#0d121e] border-slate-800 text-slate-300 hover:bg-[#151c2c]'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                  selectedTarget === 'clear_all_vault'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold flex items-center gap-2 text-red-300">
                  <span>{t.clearAllVaultItemsOption}</span>
                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-red-950 text-red-300 border border-red-800 font-mono">
                    {vaultItemsCount + distributedItemsCount} {lang === 'th' ? 'รายการทั้งหมด' : 'total items'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {t.clearAllVaultItemsOptionDesc}
                </p>
              </div>
            </div>
            <input
              type="radio"
              name="resetTarget"
              checked={selectedTarget === 'clear_all_vault'}
              onChange={() => setSelectedTarget('clear_all_vault')}
              className="mt-1 accent-red-400 cursor-pointer"
            />
          </div>

          {/* Option 3: Clear All Queues */}
          <div
            id="opt-clear-queues"
            onClick={() => {
              sounds.playClick();
              setSelectedTarget('clear_queues');
              setResultMessage(null);
            }}
            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
              selectedTarget === 'clear_queues'
                ? 'bg-red-950/40 border-red-500 text-white shadow-md'
                : 'bg-[#0d121e] border-slate-800 text-slate-300 hover:bg-[#151c2c]'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                  selectedTarget === 'clear_queues'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Users className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold flex items-center gap-2 text-red-300">
                  <span>{t.clearAllQueuesOption}</span>
                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-red-950 text-red-300 border border-red-800 font-mono">
                    {queuesCount} {lang === 'th' ? 'คิว' : 'queues'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {t.clearAllQueuesOptionDesc}
                </p>
              </div>
            </div>
            <input
              type="radio"
              name="resetTarget"
              checked={selectedTarget === 'clear_queues'}
              onChange={() => setSelectedTarget('clear_queues')}
              className="mt-1 accent-red-400 cursor-pointer"
            />
          </div>

          {/* Option 4: Clear Diamond Logs */}
          <div
            id="opt-clear-diamond-logs"
            onClick={() => {
              sounds.playClick();
              setSelectedTarget('clear_diamond_logs');
              setResultMessage(null);
            }}
            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
              selectedTarget === 'clear_diamond_logs'
                ? 'bg-[#222a3d] border-amber-400 text-white shadow-md'
                : 'bg-[#0d121e] border-slate-800 text-slate-300 hover:bg-[#151c2c]'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                  selectedTarget === 'clear_diamond_logs'
                    ? 'bg-sky-500/20 text-sky-400'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Gem className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold flex items-center gap-2">
                  <span>{t.clearDiamondLogsOption}</span>
                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-800 text-sky-300 font-mono">
                    {diamondLogsCount} {lang === 'th' ? 'รายการบันทึก' : 'logs'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {t.clearDiamondLogsOptionDesc}
                </p>
              </div>
            </div>
            <input
              type="radio"
              name="resetTarget"
              checked={selectedTarget === 'clear_diamond_logs'}
              onChange={() => setSelectedTarget('clear_diamond_logs')}
              className="mt-1 accent-amber-400 cursor-pointer"
            />
          </div>

          {/* Option 6: Reset All Member Stats & Proof Screenshots */}
          <div
            id="opt-reset-all-user-stats"
            onClick={() => {
              sounds.playClick();
              setSelectedTarget('reset_all_user_stats');
              setResultMessage(null);
            }}
            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
              selectedTarget === 'reset_all_user_stats'
                ? 'bg-amber-950/40 border-amber-500 text-white shadow-md'
                : 'bg-[#0d121e] border-slate-800 text-slate-300 hover:bg-[#151c2c]'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                  selectedTarget === 'reset_all_user_stats'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <RotateCcw className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold flex items-center gap-2 text-amber-300">
                  <span>{lang === 'th' ? 'รีเซ็ตค่าสเตตัสและรูปสมาชิกทุกคน (รอส่งใหม่)' : 'Reset All Member Stats & Screenshots'}</span>
                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-amber-950 text-amber-300 border border-amber-800 font-mono">
                    {lang === 'th' ? 'ทุกคน 0 PL' : 'All 0 PL'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {lang === 'th'
                    ? 'ล้างค่าสเตตัส รูปสกรีนช็อต และคำขอสเตตัสค้างอยู่ของสมาชิกทุกคนเป็นค่าเริ่มต้น (0 PL) เพื่อรอให้ทุกคนอัปเดตสเตตัสและส่งรูปใหม่ (ชื่อผู้ใช้, บทบาท และบัญชียังคงอยู่ครบถ้วน)'
                    : 'Reset verified/pending stats, PL (to 0), and proof screenshots for all members. Waiting for members to submit new screenshots and stats (accounts and roles preserved).'}
                </p>
              </div>
            </div>
            <input
              type="radio"
              name="resetTarget"
              checked={selectedTarget === 'reset_all_user_stats'}
              onChange={() => setSelectedTarget('reset_all_user_stats')}
              className="mt-1 accent-amber-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Security Confirmation Step */}
        <div className="p-3.5 mt-2 rounded-xl bg-red-950/30 border border-red-800/60 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-red-300">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{t.confirmWipeWarning}</span>
          </div>

          {requiresTypeConfirm && (
            <div className="pt-1">
              <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                {t.confirmTypeReset}
              </label>
              <input
                id="input-owner-reset-confirm"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="RESET"
                className="w-full px-3 py-2 rounded-lg bg-[#090d16] border border-red-500/60 text-slate-100 text-xs font-mono tracking-widest focus:outline-none focus:border-red-400"
              />
            </div>
          )}
        </div>

        {/* Footer Action Buttons */}
        <div className="flex justify-end items-center gap-3 pt-4 mt-3 border-t border-slate-800">
          <button
            type="button"
            id="btn-cancel-owner-reset"
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            id="btn-execute-owner-reset"
            disabled={isProcessing || !isOwner || !isConfirmValid}
            onClick={handleExecuteReset}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              selectedTarget === 'clear_distributed' || selectedTarget === 'clear_diamond_logs'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-slate-950'
                : 'bg-gradient-to-r from-red-600 via-red-700 to-rose-800 hover:brightness-110 text-white shadow-red-950/50'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span>
              {isProcessing ? t.loading : t.confirmActionBtn}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
};
