import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  X,
  Eye,
  EyeOff,
  Shield,
  Crown,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock
} from 'lucide-react';
import { Language, User, cleanClanName } from '../types';
import { translations } from '../translations';
import { sounds } from '../utils/sound';
import { canChangePassword } from '../services/firebase';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: User | null;
  currentUser: User | null;
  lang: Language;
  onSubmit: (targetUser: User, newPass: string) => Promise<void>;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  currentUser,
  lang,
  onSubmit
}) => {
  const t = translations[lang];

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setNewPassword('');
      setConfirmPassword('');
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setErrorMsg(null);
      setIsSubmitting(false);
    }
  }, [isOpen, targetUser]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !targetUser) return null;

  const isSelf = currentUser?.id === targetUser.id;
  const isAuthorized = canChangePassword(currentUser, targetUser);

  const isLengthValid = newPassword.length >= 6 && newPassword.length <= 128;
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = isAuthorized && isLengthValid && isMatch && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthorized) {
      setErrorMsg(t.roleHierarchyDenied);
      return;
    }
    if (!isLengthValid) {
      setErrorMsg(t.passwordLengthError);
      return;
    }
    if (!isMatch) {
      setErrorMsg(t.passwordMismatch);
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      sounds.playClaim();
      await onSubmit(targetUser, newPassword);
      onClose();
    } catch (err: any) {
      console.error('Password change error:', err);
      setErrorMsg(err?.message || t.passwordChangeFailed);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-gradient-to-b from-[#131b2e] via-[#0c121e] to-[#070b14] border border-[#d4af37]/40 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow corner decorations */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between shrink-0 bg-[#090e1a]/90 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-950/40 border border-amber-500/40 text-amber-300 shadow-sm">
              <KeyRound className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold font-cinzel text-slate-100">
                {t.changePasswordModalTitle}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isSelf
                  ? t.changeOwnPasswordDesc
                  : t.changeMemberPasswordDesc.replace('{name}', targetUser.inGameName || targetUser.username)}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer disabled:opacity-50"
            title={t.close}
            aria-label={t.close}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {/* Target Account Badge */}
          <div className="p-3 rounded-xl bg-[#0a0f1d] border border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 font-bold font-cinzel">
                {targetUser.role === 'owner' ? (
                  <Crown className="w-4 h-4 text-amber-400" />
                ) : targetUser.role === 'admin' ? (
                  <Shield className="w-4 h-4 text-sky-400" />
                ) : (
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-200 truncate flex items-center gap-1.5">
                  <span>{targetUser.inGameName}</span>
                  <span className="text-[10px] text-slate-400 font-mono">(@{targetUser.username})</span>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <span>{cleanClanName(targetUser.clan) || 'No Clan'}</span>
                  <span>•</span>
                  <span className="text-amber-400 font-mono font-bold">
                    ⚡ {(targetUser.powerLevel || 0).toLocaleString()} PL
                  </span>
                </div>
              </div>
            </div>

            <span
              className={`text-[9px] px-2 py-0.5 rounded font-semibold uppercase border shrink-0 ${
                targetUser.role === 'owner'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : targetUser.role === 'admin'
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {targetUser.role === 'owner'
                ? t.roleOwner
                : targetUser.role === 'admin'
                ? t.roleAdmin
                : t.roleMember}
            </span>
          </div>

          {/* Role Hierarchy Denied Warning */}
          {!isAuthorized && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/50 flex items-start gap-2.5 text-red-200 text-xs">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{t.roleHierarchyDenied}</span>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/50 flex items-start gap-2.5 text-red-200 text-xs">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Field 1: New Password */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-200">
              {t.newPassword} <span className="text-amber-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                disabled={!isAuthorized || isSubmitting}
                placeholder={t.newPasswordPlaceholder}
                autoComplete="new-password"
                className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-[#090e1a] border border-slate-700 focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40 text-slate-100 text-xs sm:text-sm placeholder:text-slate-500 outline-none transition disabled:opacity-50"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowNewPassword((prev) => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 transition-colors cursor-pointer"
                title={showNewPassword ? t.hidePassword : t.showPassword}
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
              <span>{lang === 'th' ? 'ความยาว 6–128 ตัวอักษร' : '6–128 characters'}</span>
              {newPassword.length > 0 && (
                <span className={newPassword.length >= 6 ? 'text-emerald-400 font-mono' : 'text-amber-400 font-mono'}>
                  {newPassword.length}/128
                </span>
              )}
            </div>
          </div>

          {/* Field 2: Confirm New Password */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-200">
              {t.confirmNewPassword} <span className="text-amber-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                disabled={!isAuthorized || isSubmitting}
                placeholder={t.confirmPasswordPlaceholder}
                autoComplete="new-password"
                className={`w-full pl-3 pr-10 py-2.5 rounded-xl bg-[#090e1a] border text-slate-100 text-xs sm:text-sm placeholder:text-slate-500 outline-none transition disabled:opacity-50 ${
                  confirmPassword.length > 0 && !isMatch
                    ? 'border-red-500/70 focus:border-red-500'
                    : isMatch
                    ? 'border-emerald-500/70 focus:border-emerald-500'
                    : 'border-slate-700 focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40'
                }`}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 transition-colors cursor-pointer"
                title={showConfirmPassword ? t.hidePassword : t.showPassword}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Validation feedback indicator */}
            {confirmPassword.length > 0 && (
              <div className="flex items-center gap-1 text-[11px] px-1">
                {isMatch ? (
                  <span className="text-emerald-400 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{lang === 'th' ? 'รหัสผ่านตรงกันเรียบร้อย' : 'Passwords match'}</span>
                  </span>
                ) : (
                  <span className="text-red-400 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{t.passwordMismatch}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Modal Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-800">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                sounds.playClick();
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            >
              {t.cancel}
            </button>

            <button
              type="submit"
              disabled={!canSubmit}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#aa841c] hover:from-[#f5d77f] hover:to-[#c99a22] text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:pointer-events-none active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t.loading}</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>{t.save}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
