import React, { useState } from 'react';
import {
  Lock,
  User as UserIcon,
  Shield,
  Swords,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Globe,
  Volume2,
  VolumeX,
  Sparkles,
  Users,
  Zap
} from 'lucide-react';
import { Language, User, ClanGroup } from '../types';
import { translations } from '../translations';
import { sounds } from '../utils/sound';
import { registrationErrorMessage, validateRegistration } from '../utils/registration';

interface LoginScreenProps {
  lang: Language;
  onToggleLanguage: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onLogin: (username: string, pass: string) => Promise<{ success: boolean; message?: string }>;
  onRegister: (data: {
    username: string;
    password: string;
    inGameName: string;
  }) => Promise<{ success: boolean; message?: string }>;
  users?: User[];
  clans?: ClanGroup[];
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  lang,
  onToggleLanguage,
  soundEnabled,
  onToggleSound,
  onLogin,
  onRegister,
  users = [],
  clans = []
}) => {
  const t = translations[lang];
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Register form state
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPass, setShowRegPass] = useState(false);
  const [regInGameName, setRegInGameName] = useState('');
  const [regSuccessMessage, setRegSuccessMessage] = useState('');
  const [regError, setRegError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLoginSubmit = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
    }
    setLoginError('');

    const trimmedUser = loginUser.trim();
    if (!trimmedUser || !loginPass) {
      setLoginError(t.invalidCredentials);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onLogin(trimmedUser, loginPass);
      if (!result.success) {
        sounds.playClick();
        setLoginError(result.message || t.invalidCredentials);
      } else {
        sounds.playClaim();
      }
    } catch (err: any) {
      setLoginError(err?.message || (lang === 'th' ? 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' : 'Login failed. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
    }
    setRegError('');
    setRegSuccessMessage('');

    const finalUsername = regUsername.trim();
    const finalPassword = regPassword;
    const finalInGameName = regInGameName.trim();

    const invalidField = validateRegistration(finalUsername, finalPassword, finalInGameName);
    if (invalidField) {
      setRegError(registrationErrorMessage(invalidField, lang));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onRegister({
        username: finalUsername,
        password: finalPassword,
        inGameName: finalInGameName,
      });

      if (result.success) {
        sounds.playClaim();
        setRegSuccessMessage(
          lang === 'th'
            ? 'ลงทะเบียนสำเร็จ! บัญชีของคุณถูกส่งแล้ว รอผู้ดูแล (Admin/Owner) อนุมัติสิทธิ์เข้าใช้งาน'
            : 'Registration submitted successfully! Please wait for an Admin to approve your account.'
        );
        // Pre-fill username into login form
        setLoginUser(finalUsername);
        setLoginPass('');
        // Reset register form
        setRegUsername('');
        setRegPassword('');
        setRegInGameName('');
      } else {
        setRegError(result.message || t.error);
      }
    } catch (err: any) {
      setRegError(err?.message || (lang === 'th' ? 'เกิดข้อผิดพลาดในการลงทะเบียน' : 'Registration failed. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-transparent text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-x-hidden selection:bg-[#d4af37]/30 selection:text-[#f5d77f]">
      
      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-[#d4af37]/10 via-[#1e3a8a]/10 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[350px] bg-[#3b82f6]/5 blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/3 left-10 w-[350px] h-[350px] bg-[#d4af37]/5 blur-3xl pointer-events-none -z-10" />

      {/* Top right quick settings: Language & Sound */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2 z-20">
        <button
          id="btn-login-sound-toggle"
          onClick={() => {
            sounds.playClick();
            onToggleSound();
          }}
          className="p-2 rounded-lg bg-[#0b101c]/80 border border-slate-700/80 hover:border-[#d4af37]/60 text-slate-300 hover:text-white transition-all shadow-md flex items-center gap-1.5 text-xs cursor-pointer backdrop-blur-sm"
          title={soundEnabled ? 'Mute sound' : 'Unmute sound'}
        >
          {soundEnabled ? (
            <Volume2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <VolumeX className="w-4 h-4 text-slate-500" />
          )}
          <span className="hidden sm:inline font-mono text-[11px]">
            {soundEnabled ? 'SFX ON' : 'MUTED'}
          </span>
        </button>

        <button
          id="btn-login-lang-toggle"
          onClick={() => {
            sounds.playClick();
            onToggleLanguage();
          }}
          className="px-3 py-1.5 rounded-lg bg-[#0b101c]/80 border border-[#d4af37]/40 hover:border-[#d4af37] text-[#f5d77f] font-semibold text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer backdrop-blur-sm"
          title="Switch Language"
        >
          <Globe className="w-3.5 h-3.5 text-[#d4af37]" />
          <span>{lang === 'th' ? 'TH (ไทย)' : 'EN (English)'}</span>
        </button>
      </div>

      {/* CENTERED CARD */}
      <div className="w-full max-w-[460px] my-auto relative z-10 animate-in fade-in zoom-in-95 duration-300">
        
        {/* Card Border & Glowing Glass Wrapper */}
        <div className="rounded-2xl bg-[#09101f]/85 border border-[#d4af37]/45 shadow-[0_0_60px_rgba(0,0,0,0.92),0_0_30px_rgba(212,175,55,0.16)] p-6 sm:p-8 backdrop-blur-2xl">
          
          {/* Logo & Emblem Header */}
          <div className="text-center mb-6">
            <div className="relative inline-flex items-center justify-center mb-3">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#23314d] via-[#151e30] to-[#0a0f1a] border border-[#d4af37]/60 shadow-[0_0_20px_rgba(212,175,55,0.25)] flex items-center justify-center text-[#f5d77f]">
                <Swords className="w-8 h-8 drop-shadow-[0_2px_8px_rgba(212,175,55,0.6)]" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#d4af37] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#d4af37]"></span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black font-cinzel tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#fff3be] via-[#e5be49] to-[#bf9121] drop-shadow-sm">
              LINEAGE 2M
            </h1>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <span className="px-3 py-0.5 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 text-[11px] font-mono tracking-widest text-[#f0cf75] uppercase">
                CLAN HUB SYSTEM
              </span>
              <span className="px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/35 text-[10px] font-mono font-bold text-sky-300">
                v2.10.13
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2 font-prompt">
              {lang === 'th'
                ? 'เข้าสู่ระบบ หรือ สมัครสมาชิก เพื่อจัดการคลังไอเทมและแคลน'
                : 'Sign in or register to access the item vault & clan system'}
            </p>
          </div>

          {/* Mode Switch Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 mb-6 rounded-xl bg-[#070b13] border border-slate-800/90 shadow-inner">
            <button
              id="tab-login-btn"
              type="button"
              onClick={() => {
                sounds.playClick();
                setMode('login');
                setLoginError('');
              }}
              className={`py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'login'
                  ? 'bg-gradient-to-r from-[#1c273c] to-[#253552] text-[#f5d77f] border border-[#d4af37]/50 shadow-[0_2px_10px_rgba(0,0,0,0.5)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{t.login}</span>
            </button>

            <button
              id="tab-register-btn"
              type="button"
              onClick={() => {
                sounds.playClick();
                setMode('register');
                setLoginError('');
              }}
              className={`py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'register'
                  ? 'bg-gradient-to-r from-[#1c273c] to-[#253552] text-[#f5d77f] border border-[#d4af37]/50 shadow-[0_2px_10px_rgba(0,0,0,0.5)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{t.register}</span>
            </button>
          </div>

          {/* ======================= 1. LOGIN FORM ======================= */}
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
                <div className="p-3.5 rounded-xl bg-red-950/70 border border-red-700/60 text-xs text-red-200 flex items-start gap-2.5 shadow-md animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{loginError}</div>
                </div>
              )}

              {/* Username Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {lang === 'th' ? 'ชื่อผู้ใช้ หรือ ชื่อตัวละครในเกม (IGN)' : 'Username or In-Game Name (IGN)'}
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
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
                    placeholder={lang === 'th' ? 'กรอกชื่อผู้ใช้ หรือชื่อตัวละคร (IGN)...' : 'Enter username or character name...'}
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[#090d16] border border-slate-700/80 focus:border-[#d4af37] text-slate-100 text-sm focus:outline-none transition-all placeholder:text-slate-600 shadow-inner"
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {t.password}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="input-login-password"
                    type={showLoginPass ? 'text' : 'password'}
                    required
                    value={loginPass}
                    onChange={(e) => setLoginPass(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleLoginSubmit(e);
                      }
                    }}
                    placeholder={lang === 'th' ? 'กรอกรหัสผ่าน...' : 'Enter password...'}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#090d16] border border-slate-700/80 focus:border-[#d4af37] text-slate-100 text-sm focus:outline-none transition-all placeholder:text-slate-600 shadow-inner"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPass(!showLoginPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1 cursor-pointer"
                  >
                    {showLoginPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                id="btn-login-submit"
                type="submit"
                className="w-full py-3 mt-3 rounded-xl bg-gradient-to-r from-[#d4af37] via-[#f1c953] to-[#aa841c] hover:brightness-110 active:scale-[0.99] text-slate-950 font-bold text-sm shadow-lg shadow-amber-900/30 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>{t.loginBtn}</span>
              </button>

              {/* Switch to register helper */}
              <div className="pt-2 text-center text-xs text-slate-400">
                <span>{t.noAccount} </span>
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setMode('register');
                  }}
                  className="text-[#f5d77f] hover:underline font-semibold cursor-pointer"
                >
                  {t.register}
                </button>
              </div>

            </form>
          )}

          {/* ======================= 2. REGISTER FORM ======================= */}
          {mode === 'register' && (
            <form
              onSubmit={handleRegisterSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleRegisterSubmit(e);
                }
              }}
              className="space-y-3.5"
            >
              {regSuccessMessage && (
                <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-600/70 text-xs text-emerald-200 flex flex-col gap-2 shadow-md animate-in fade-in">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{regSuccessMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setMode('login');
                      setRegSuccessMessage('');
                    }}
                    className="self-end px-3 py-1 bg-emerald-800/80 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all"
                  >
                    {lang === 'th' ? 'กลับไปหน้าเข้าสู่ระบบ' : 'Go to Login'}
                  </button>
                </div>
              )}

              {regError && (
                <div className="p-3.5 rounded-xl bg-red-950/70 border border-red-700/60 text-xs text-red-200 flex items-start gap-2 shadow-md animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{regError}</span>
                </div>
              )}

              {/* Pending Approval Notice */}
              <div className="p-3 rounded-xl bg-[#141e30] border border-[#38bdf8]/40 text-xs text-[#7dd3fc] flex items-start gap-2.5">
                <Shield className="w-4 h-4 shrink-0 text-[#38bdf8] mt-0.5" />
                <div className="leading-relaxed text-[11px]">
                  {lang === 'th'
                    ? 'กรอกชื่อผู้ใช้ รหัสผ่าน และชื่อตัวละคร จากนั้นรอ Admin หรือ Owner อนุมัติบัญชี'
                    : 'Enter your username, password, and character name, then wait for Admin or Owner approval.'}
                </div>
              </div>

              {/* 1. Username */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t.username} <span className="text-amber-400">*</span>
                </label>
                <input
                  id="input-reg-username"
                  type="text"
                  required
                  minLength={3}
                  maxLength={40}
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder={lang === 'th' ? 'เช่น warrior01' : 'e.g. warrior01'}
                  className="w-full px-3 py-2 rounded-xl bg-[#090d16] border border-slate-700/80 focus:border-[#d4af37] text-slate-100 text-sm focus:outline-none transition-all shadow-inner"
                />
              </div>

              {/* 2. Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t.password} <span className="text-amber-400">*</span>
                </label>
                <div className="relative">
                  <input
                    id="input-reg-password"
                     type={showRegPass ? 'text' : 'password'}
                     required
                     minLength={6}
                     maxLength={128}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-3 pr-10 py-2 rounded-xl bg-[#090d16] border border-slate-700/80 focus:border-[#d4af37] text-slate-100 text-sm focus:outline-none transition-all shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPass(!showRegPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
                  >
                    {showRegPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* 3. In-Game Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t.inGameName} <span className="text-amber-400">*</span>
                </label>
                <input
                  id="input-reg-ingamename"
                  type="text"
                  required
                  maxLength={60}
                  value={regInGameName}
                  onChange={(e) => setRegInGameName(e.target.value)}
                  placeholder={lang === 'th' ? 'เช่น Zenkaii หรือ DVD' : 'e.g. Zenkaii or DVD'}
                  className="w-full px-3 py-2 rounded-xl bg-[#090d16] border border-slate-700/80 focus:border-[#d4af37] text-slate-100 text-sm focus:outline-none transition-all shadow-inner"
                />
              </div>

              {/* Note about Character Profile */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-750 text-[11px] text-slate-400">
                {lang === 'th'
                  ? '💡 ค่าพลัง (PL), เลเวล, อาชีพ และการจัดสรรแคลน สามารถอัปเดตและดำเนินการได้ในระบบหลังเข้าสู่ระบบ'
                  : '💡 Power level (PL), level, class, and clan assignment can be updated in the system after logging in.'}
              </div>

              {/* Submit Register Button */}
              <button
                id="btn-register-submit"
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 mt-2 rounded-xl bg-gradient-to-r from-[#d4af37] via-[#f1c953] to-[#aa841c] hover:brightness-110 active:scale-[0.99] text-slate-950 font-bold text-sm shadow-lg shadow-amber-900/30 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span>{t.loading}</span>
                ) : (
                  <>
                    <Shield className="w-4 h-4 text-slate-950" />
                    <span>{t.registerBtn}</span>
                  </>
                )}
              </button>

              {/* Switch back to login */}
              <div className="pt-2 text-center text-xs text-slate-400">
                <span>{t.alreadyHaveAccount} </span>
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setMode('login');
                  }}
                  className="text-[#f5d77f] hover:underline font-semibold cursor-pointer"
                >
                  {t.login}
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Footer info */}
        <div className="mt-4 text-center text-[11px] text-slate-500 font-mono">
          LINEAGE 2M • CLAN HUB • SECURE CLAN MANAGEMENT
        </div>
      </div>
    </div>
  );
};
