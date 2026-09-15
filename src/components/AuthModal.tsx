import React, { useState } from 'react';
import {
  X,
  Lock,
  User,
  Shield,
  Zap,
  Swords,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Language, User as UserType } from '../types';
import { translations } from '../translations';
import { sounds } from '../utils/sound';
import { registrationErrorMessage, validateRegistration } from '../utils/registration';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onLogin: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  onRegister: (newUser: Partial<UserType>) => Promise<{ success: boolean; message?: string }>;
  users: UserType[];
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  lang,
  onLogin,
  onRegister,
  users
}) => {
  const t = translations[lang];
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  // Register form state
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regInGameName, setRegInGameName] = useState('');
  const [regSuccessMessage, setRegSuccessMessage] = useState('');
  const [regError, setRegError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
    }
    setLoginError('');

    setIsSubmitting(true);
    try {
      const result = await onLogin(loginUser.trim(), loginPass);
      if (!result.success) {
        setLoginError(result.message || t.invalidCredentials);
        return;
      }
      sounds.playClaim();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccessMessage('');

    const invalidField = validateRegistration(regUsername, regPassword, regInGameName);
    if (invalidField) {
      setRegError(registrationErrorMessage(invalidField, lang));
      return;
    }

    // Check if username taken
    const exists = users.some(
      (u) => u.username.toLowerCase() === regUsername.trim().toLowerCase()
    );
    if (exists) {
      setRegError(lang === 'th' ? 'ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว' : 'Username already exists');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onRegister({
        username: regUsername.trim(),
        password: regPassword,
        inGameName: regInGameName.trim(),
      });

      if (result.success) {
        sounds.playClaim();
        setRegSuccessMessage(t.registrationSuccess);
        // Reset form
        setRegUsername('');
        setRegPassword('');
        setRegInGameName('');
      } else {
        setRegError(result.message || t.error);
      }
    } catch {
      setRegError(t.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-xl bg-gradient-to-b from-[#151c2b] via-[#0f1420] to-[#0a0d15] border border-[#d4af37]/40 shadow-2xl p-6 sm:p-7 text-slate-200">
        
        {/* Close Button */}
        <button
          id="btn-close-auth-modal"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/40 text-[#f5d77f] mb-3 shadow-inner">
            <Swords className="w-6 h-6" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-[#fff2b8] via-[#e6be44] to-[#c99a22]">
            {mode === 'login' ? t.login : t.register}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {t.appSubtitle}
          </p>
        </div>

        {/* Mode Switch Tabs */}
        <div className="grid grid-cols-2 gap-1 p-1 mb-5 rounded-lg bg-[#0b0e17] border border-slate-800">
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              setMode('login');
              setLoginError('');
              setRegSuccessMessage('');
            }}
            className={`py-2 text-xs sm:text-sm font-semibold rounded-md transition-all ${
              mode === 'login'
                ? 'bg-[#1e2a3f] text-[#f5d77f] border border-[#d4af37]/40 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.login}
          </button>
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              setMode('register');
              setLoginError('');
              setRegSuccessMessage('');
            }}
            className={`py-2 text-xs sm:text-sm font-semibold rounded-md transition-all ${
              mode === 'register'
                ? 'bg-[#1e2a3f] text-[#f5d77f] border border-[#d4af37]/40 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.register}
          </button>
        </div>

        {/* LOGIN FORM */}
        {mode === 'login' && (
          <form
            onSubmit={handleLoginSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleLoginSubmit(e);
              }
            }}
            className="space-y-4"
          >
            {loginError && (
              <div className="p-3 rounded-lg bg-red-950/60 border border-red-800/60 text-xs text-red-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {t.username}
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="input-login-username"
                  type="text"
                  required
                  value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleLoginSubmit(e);
                    }
                  }}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-[#0a0e17] border border-slate-700/80 focus:border-[#d4af37] text-slate-100 text-sm focus:outline-none transition-all placeholder:text-slate-600"
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {t.password}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="input-login-password"
                  type="password"
                  required
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleLoginSubmit(e);
                    }
                  }}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-[#0a0e17] border border-slate-700/80 focus:border-[#d4af37] text-slate-100 text-sm focus:outline-none transition-all placeholder:text-slate-600"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              id="btn-submit-login"
              type="submit"
              className="w-full py-2.5 mt-2 rounded-lg bg-gradient-to-r from-[#d4af37] via-[#e5be49] to-[#aa841c] hover:brightness-110 text-slate-950 font-bold text-sm shadow-lg shadow-amber-900/30 transition-all active:scale-[0.99] cursor-pointer"
            >
              {t.loginBtn}
            </button>
          </form>
        )}

        {/* REGISTER FORM */}
        {mode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5 max-h-[70vh] overflow-y-auto pr-1">
            {regSuccessMessage && (
              <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-700/60 text-xs text-emerald-200 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{regSuccessMessage}</span>
              </div>
            )}

            {regError && (
              <div className="p-3 rounded-lg bg-red-950/60 border border-red-800/60 text-xs text-red-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{regError}</span>
              </div>
            )}

            {/* Note about admin approval */}
            <div className="p-2.5 rounded-lg bg-[#1a2336] border border-[#38bdf8]/30 text-[11px] text-[#7dd3fc] flex items-center gap-2">
              <Shield className="w-4 h-4 shrink-0 text-[#38bdf8]" />
              <span>{t.pendingApprovalDesc}</span>
            </div>

            {/* 1. Username */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                1. {t.username} *
              </label>
              <input
                id="input-reg-username"
                type="text"
                required
                minLength={3}
                maxLength={40}
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0a0e17] border border-slate-700 focus:border-[#d4af37] text-slate-100 text-sm focus:outline-none"
              />
            </div>

            {/* 2. Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                2. {t.password} *
              </label>
              <input
                id="input-reg-password"
                type="password"
                required
                minLength={6}
                maxLength={128}
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0a0e17] border border-slate-700 focus:border-[#d4af37] text-slate-100 text-sm focus:outline-none"
              />
            </div>

            {/* 3. In-Game Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                3. {t.inGameName} *
              </label>
              <input
                id="input-reg-ingamename"
                type="text"
                required
                maxLength={60}
                value={regInGameName}
                onChange={(e) => setRegInGameName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0a0e17] border border-slate-700 focus:border-[#d4af37] text-slate-100 text-sm focus:outline-none"
              />
            </div>

            {/* Note about Character Profile */}
            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-750 text-[11px] text-slate-400">
              {lang === 'th'
                ? '💡 ค่าพลัง (PL), เลเวล, อาชีพ และการจัดสรรแคลน สามารถอัปเดตและดำเนินการได้ในระบบหลังเข้าสู่ระบบ'
                : '💡 Power level (PL), level, class, and clan assignment can be updated in the system after logging in.'}
            </div>

            <button
              id="btn-submit-register"
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 mt-2 rounded-lg bg-gradient-to-r from-[#d4af37] via-[#e5be49] to-[#aa841c] hover:brightness-110 text-slate-950 font-bold text-sm shadow-lg shadow-amber-900/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? t.loading : t.registerBtn}
            </button>
          </form>
        )}

      </div>
    </div>
  );
};
