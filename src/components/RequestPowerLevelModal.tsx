import React, { useState, useEffect } from 'react';
import { X, Zap, ArrowRight, TrendingUp, TrendingDown, Clock, ShieldAlert, Check, Lock } from 'lucide-react';
import { User, Language, cleanClanName, StatUpdateSettings } from '../types';
import { translations } from '../translations';
import { sounds } from '../utils/sound';

interface RequestPowerLevelModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  lang: Language;
  statUpdateSettings?: StatUpdateSettings;
  onRequestUpdate: (userId: string, newPowerLevel: number) => Promise<void>;
  onCancelRequest?: (userId: string) => Promise<void>;
}

export const RequestPowerLevelModal: React.FC<RequestPowerLevelModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  lang,
  statUpdateSettings,
  onRequestUpdate,
  onCancelRequest
}) => {
  const t = translations[lang];
  const isOwner = currentUser?.role === 'owner';
  const isAdmin = currentUser?.role === 'admin';
  const isStatLocked = Boolean(
    statUpdateSettings &&
    !statUpdateSettings.allowMemberUpdates &&
    !isOwner &&
    !isAdmin
  );
  const [newPowerLevel, setNewPowerLevel] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const currentPower = currentUser?.powerLevel || 0;
  const parsedNewPower = newPowerLevel ? parseInt(newPowerLevel.replace(/,/g, ''), 10) : 0;
  const hasValidNewPower = !isNaN(parsedNewPower) && parsedNewPower > 0;
  const diff = hasValidNewPower ? parsedNewPower - currentPower : 0;

  useEffect(() => {
    if (isOpen && currentUser) {
      if (currentUser.pendingPowerLevel && currentUser.pendingPowerLevel > 0) {
        setNewPowerLevel(currentUser.pendingPowerLevel.toString());
      } else {
        setNewPowerLevel(currentUser.powerLevel ? currentUser.powerLevel.toString() : '');
      }
      setErrorMessage('');
      setSuccessMessage('');
      setIsSubmitting(false);
    }
  }, [isOpen, currentUser]);

  if (!isOpen || !currentUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (isStatLocked) {
      setErrorMessage(t.statUpdateLockedNotice);
      return;
    }

    if (!hasValidNewPower) {
      setErrorMessage(lang === 'th' ? 'กรุณากรอกค่าพลังที่ถูกต้องและมากกว่า 0' : 'Please enter a valid PL greater than 0');
      return;
    }

    if (parsedNewPower === currentPower) {
      setErrorMessage(
        lang === 'th'
          ? 'ค่าพลังใหม่ตรงกับค่าพลังปัจจุบัน กรุณากรอกค่าที่เปลี่ยนแปลง'
          : 'New PL is the same as your current PL'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      sounds.playClaim();
      await onRequestUpdate(currentUser.id, parsedNewPower);
      setSuccessMessage(t.cpUpdateRequestedSuccess);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err?.message || t.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelPending = async () => {
    if (!onCancelRequest || !currentUser.pendingPowerLevel) return;
    setIsSubmitting(true);
    try {
      sounds.playClick();
      await onCancelRequest(currentUser.id);
      setNewPowerLevel(currentUser.powerLevel ? currentUser.powerLevel.toString() : '');
      setSuccessMessage(lang === 'th' ? 'ยกเลิกคำขอเรียบร้อยแล้ว' : 'Pending request cancelled');
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err?.message || t.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-gradient-to-b from-[#111726] via-[#0d121e] to-[#080c14] border border-[#d4af37]/40 shadow-[0_0_50px_rgba(0,0,0,0.9),0_0_20px_rgba(212,175,55,0.15)] p-6 sm:p-7 text-slate-200">
        
        {/* Close Button */}
        <button
          id="btn-close-cp-request"
          onClick={() => {
            sounds.playClick();
            onClose();
          }}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-900/30 border border-amber-500/40 flex items-center justify-center text-[#f5d77f] shadow-inner shrink-0">
            <Zap className="w-6 h-6 drop-shadow-[0_2px_8px_rgba(245,215,127,0.5)]" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-[#fff3be] via-[#f5d77f] to-[#bf9121]">
              {t.requestCpUpdateTitle}
            </h2>
            <p className="text-xs text-slate-400">
              {t.requestCpUpdateDesc}
            </p>
          </div>
        </div>

        {/* Status Alerts */}
        {errorMessage && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-950/70 border border-red-700/60 text-xs text-red-200 shadow-md animate-in fade-in">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-600/70 text-xs text-emerald-200 flex items-center gap-2 shadow-md animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Pending Request Notice if user already has one */}
        {currentUser.pendingPowerLevel && currentUser.pendingPowerLevel > 0 && (
          <div className="mb-5 p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/50 text-xs text-amber-200/90 shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-amber-300">
                    {t.pendingCpNotice}
                  </div>
                  <div className="mt-1 text-[11px] text-amber-200/80">
                    {lang === 'th' ? 'คำขอที่ส่งไปล่าสุด:' : 'Requested value:'}{' '}
                    <span className="font-mono font-bold text-[#f5d77f]">
                      ⚡ {currentUser.pendingPowerLevel.toLocaleString()} PL
                    </span>
                  </div>
                </div>
              </div>

              {onCancelRequest && (
                <button
                  type="button"
                  onClick={handleCancelPending}
                  disabled={isSubmitting}
                  className="px-2.5 py-1 rounded-lg bg-red-950/60 hover:bg-red-900/80 border border-red-700/50 text-red-300 hover:text-white text-[11px] font-medium transition-all cursor-pointer shrink-0 disabled:opacity-50"
                >
                  {t.cancelCpRequest}
                </button>
              )}
            </div>
          </div>
        )}

        {/* User Current Info Card */}
        <div className="mb-5 p-4 rounded-xl bg-[#090e17] border border-slate-800 shadow-inner">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div>
              <span className="text-slate-400">{lang === 'th' ? 'ตัวละคร:' : 'Character:'}</span>{' '}
              <span className="text-slate-100 font-bold">{currentUser.inGameName}</span>{' '}
              <span className="text-slate-500">({cleanClanName(currentUser.clan) || 'No Clan'} • {currentUser.characterClass})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">{t.currentCp}:</span>
              <span className="font-mono font-bold text-amber-400">
                ⚡ {currentPower.toLocaleString()} PL
              </span>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>{t.newRequestedCp} <span className="text-amber-400">*</span></span>
              {hasValidNewPower && (
                <span className="font-mono text-xs font-bold text-[#f5d77f]">
                  ⚡ {parsedNewPower.toLocaleString()} PL
                </span>
              )}
            </label>
            <div className="relative">
              <Zap className="w-4 h-4 text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="input-request-new-cp"
                type="number"
                min="0"
                required
                value={newPowerLevel}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setNewPowerLevel(e.target.value)}
                placeholder={lang === 'th' ? 'เช่น 580000' : 'e.g. 580000'}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#070b13] border border-slate-700 focus:border-[#d4af37] text-slate-100 font-mono text-sm focus:outline-none transition-all shadow-inner"
              />
            </div>
          </div>

          {/* Comparison Diff Box */}
          {hasValidNewPower && diff !== 0 && (
            <div className="p-3.5 rounded-xl bg-[#0b1220] border border-slate-800 flex items-center justify-between text-xs animate-in fade-in">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-mono">{currentPower.toLocaleString()} PL</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-slate-100 font-mono font-bold">{parsedNewPower.toLocaleString()} PL</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[11px]">{t.cpDiff}:</span>
                {diff > 0 ? (
                  <span className="flex items-center gap-1 font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                    <TrendingUp className="w-3.5 h-3.5" />
                    +{diff.toLocaleString()} PL
                  </span>
                ) : (
                  <span className="flex items-center gap-1 font-mono font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30">
                    <TrendingDown className="w-3.5 h-3.5" />
                    {diff.toLocaleString()} PL
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Locked Notice Banner if Owner locked monthly updates */}
          {isStatLocked ? (
            <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/60 text-xs flex items-center gap-3 text-red-200 shadow-md">
              <Lock className="w-5 h-5 text-red-400 shrink-0" />
              <div className="space-y-0.5">
                <div className="font-bold text-red-300 flex items-center gap-2">
                  <span>{lang === 'th' ? 'ระบบปิดรับการอัปเดตสเตตัส' : 'Stat Updates Locked'}</span>
                  <span className="text-[10px] px-2 py-0.2 rounded bg-red-900 text-red-200 border border-red-700 font-mono">
                    {t.statusLockedBadge}
                  </span>
                </div>
                <p className="text-[11px] text-red-300/80">
                  {t.statUpdateLockedNotice}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-[#141b2a] border border-sky-500/30 text-[11px] text-sky-200/90 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                {lang === 'th'
                  ? 'คำขอนี้จะไม่เปลี่ยนค่าพลังทันที แต่จะถูกส่งไปยัง Owner และ Admin เพื่อตรวจสอบและกดยืนยันอนุมัติ'
                  : 'This request will not take effect immediately. It will be sent to the Owner and Admins for review and approval.'}
              </div>
            </div>
          )}

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              id="btn-cancel-cp-request-modal"
              type="button"
              onClick={() => {
                sounds.playClick();
                onClose();
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
            >
              {t.cancel}
            </button>

            <button
              id="btn-submit-cp-request"
              type="submit"
              disabled={isSubmitting || isStatLocked || !hasValidNewPower || parsedNewPower === currentPower}
              title={isStatLocked ? t.statUpdateLockedBtnDesc : undefined}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#d4af37] via-[#f1c953] to-[#aa841c] hover:brightness-110 active:scale-[0.99] text-slate-950 font-bold text-xs shadow-lg shadow-amber-900/30 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isStatLocked ? <Lock className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
              <span>{isSubmitting ? t.loading : isStatLocked ? t.statusLockedBadge : t.requestCpUpdate}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
