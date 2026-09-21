import React from 'react';
import {
  Shield,
  Gem,
  Volume2,
  VolumeX,
  Globe,
  LogOut,
  UserCheck,
  Crown,
  Sword,
  Sparkles,
  Zap,
  Bell,
  KeyRound
} from 'lucide-react';
import { ActiveTab, Language, User, cleanClanName } from '../types';
import { translations } from '../translations';
import { sounds } from '../utils/sound';

interface NavbarProps {
  currentTab?: ActiveTab;
  activeTab?: ActiveTab;
  setCurrentTab?: (tab: ActiveTab) => void;
  onTabChange?: (tab: ActiveTab) => void;
  lang: Language;
  setLang?: (lang: Language) => void;
  onToggleLanguage?: () => void;
  currentUser: User | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  vaultBalance: number;
  onOpenVaultModal: () => void;
  soundEnabled: boolean;
  setSoundEnabled?: (enabled: boolean) => void;
  onToggleSound?: () => void;
  onOpenBgModal?: () => void;
  onOpenRequestCp?: () => void;
  onOpenMyStats?: () => void;
  onOpenChangePassword?: () => void;
  unreadNotificationCount?: number;
  onOpenNotifications?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  activeTab,
  setCurrentTab,
  onTabChange,
  lang,
  setLang,
  onToggleLanguage,
  currentUser,
  onOpenAuth,
  onLogout,
  vaultBalance,
  onOpenVaultModal,
  soundEnabled,
  setSoundEnabled,
  onToggleSound,
  onOpenBgModal,
  onOpenRequestCp,
  onOpenMyStats,
  onOpenChangePassword,
  unreadNotificationCount,
  onOpenNotifications
}) => {
  const t = translations[lang];
  const isOwner = currentUser?.role === 'owner';
  const effectiveCurrentTab = currentTab || activeTab || 'dashboard';

  const handleTabSelect = (tab: ActiveTab) => {
    if (setCurrentTab) setCurrentTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  const toggleLang = () => {
    sounds.playClick();
    if (onToggleLanguage) {
      onToggleLanguage();
    } else if (setLang) {
      setLang(lang === 'th' ? 'en' : 'th');
    }
  };

  const toggleSound = () => {
    if (onToggleSound) {
      onToggleSound();
    } else if (setSoundEnabled) {
      sounds.enabled = !soundEnabled;
      setSoundEnabled(!soundEnabled);
      if (!soundEnabled) sounds.playClick();
    }
  };

  const canAccessVaultAndQueue =
    currentUser?.role === 'owner' ||
    currentUser?.role === 'admin';

  const allNavItems: { id: ActiveTab; label: string; restricted?: boolean }[] = [
    { id: 'dashboard', label: t.tabDashboard },
    { id: 'vault', label: t.tabVault, restricted: true },
    { id: 'queue', label: t.tabQueue, restricted: true },
    { id: 'all_members', label: t.tabMembers },
    { id: 'my_stats', label: t.tabMyStats },
  ];

  const navItems = allNavItems.filter(
    (item) => !item.restricted || canAccessVaultAndQueue
  );

  return (
    <header className="sticky top-0 z-40 bg-[#070c18]/85 border-b border-[#1c2942]/80 backdrop-blur-xl shadow-2xl">
      {/* Top micro bar with Lineage 2M styling */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Logo / Brand */}
          <div
            id="brand-logo"
            onClick={() => {
              sounds.playClick();
              handleTabSelect('dashboard');
            }}
            className="flex items-center gap-3 cursor-pointer group select-none"
          >
            <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-[#d4af37] via-[#91711e] to-[#45330a] p-[1.5px] shadow-lg shadow-[#d4af37]/20 group-hover:shadow-[#d4af37]/40 transition-all duration-300">
              <div className="w-full h-full bg-[#090f1d] rounded-[7px] flex items-center justify-center">
                <Crown className="w-6 h-6 text-[#f5d77f] group-hover:scale-110 transition-transform duration-300" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-cinzel text-lg sm:text-2xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#fff2b8] via-[#e6be44] to-[#c99a22]">
                  LINEAGE <span className="text-[#38bdf8]">2M</span>
                </span>
                <span className="text-[10px] sm:text-xs font-semibold px-1.5 py-0.5 rounded bg-[#d4af37]/20 border border-[#d4af37]/40 text-[#f5d77f] tracking-wide uppercase">
                  CLAN HUB
                </span>
                <span className="text-[9px] sm:text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-sky-500/20 border border-sky-400/40 text-sky-300">
                  v2.8.14
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate max-w-[190px] sm:max-w-none">
                {t.appSubtitle}
              </p>
            </div>
          </div>

          {/* Quick Diamond Vault Widget & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Diamond Vault Quick Display */}
            <button
              id="diamond-vault-trigger"
              onClick={() => {
                sounds.playClick();
                onOpenVaultModal();
              }}
              title={t.diamondVault}
              className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-[#0d1627]/80 border border-white/25 hover:border-white/50 text-slate-200 hover:text-white transition-all shadow-md group"
            >
              <div className="relative">
                <Gem className="w-4 h-4 sm:w-5 sm:h-5 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.7)] group-hover:scale-110 transition-transform" />
                <Sparkles className="w-2.5 h-2.5 text-white absolute -top-1 -right-1 animate-pulse" />
              </div>
              <div className="text-left leading-tight">
                <div className="text-[10px] uppercase tracking-wider text-slate-300 font-medium">
                  {t.diamonds}
                </div>
                <div className="text-xs sm:text-sm font-bold font-mono text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.3)]">
                  {vaultBalance.toLocaleString()}
                </div>
              </div>
            </button>

            {/* Background / Wallpaper Settings Toggle (Owner Only) */}
            {isOwner && onOpenBgModal && (
              <button
                id="btn-wallpaper-settings"
                onClick={() => {
                  sounds.playClick();
                  onOpenBgModal();
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg border border-[#1e2e4b] bg-[#0c1424]/80 hover:border-[#d4af37]/60 text-xs font-medium text-slate-300 hover:text-[#f5d77f] transition-all shadow-sm cursor-pointer"
                title={lang === 'th' ? 'ตั้งค่าภาพพื้นหลังปราสาท (Owner)' : 'Wallpaper Settings (Owner)'}
              >
                <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
                <span className="hidden md:inline">{lang === 'th' ? 'พื้นหลัง' : 'Wallpaper'}</span>
              </button>
            )}

            {/* Sound Toggle */}
            <button
              id="btn-sound-toggle"
              onClick={toggleSound}
              className={`p-2 rounded-lg border transition-all ${
                soundEnabled
                  ? 'border-[#d4af37]/40 text-[#f5d77f] bg-[#1a2332]/80'
                  : 'border-slate-800 text-slate-500 bg-[#0d121d]/80'
              }`}
              title={t.soundToggle}
              aria-label={t.soundToggle}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Language Switcher (EN - TH) */}
            <button
              id="btn-language-toggle"
              onClick={toggleLang}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#d4af37]/40 bg-[#162030]/80 hover:bg-[#1f2d45] text-xs font-semibold text-[#f5d77f] hover:text-white transition-all shadow-sm cursor-pointer"
              title="Switch Language / เปลี่ยนภาษา"
            >
              <Globe className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>{lang === 'th' ? 'TH' : 'EN'}</span>
            </button>

            {/* Notification Bell (Admin & Owner) */}
            {canAccessVaultAndQueue && onOpenNotifications && (
              <button
                id="btn-notification-bell"
                onClick={() => {
                  sounds.playClick();
                  onOpenNotifications();
                }}
                className={`relative p-2 rounded-lg border transition-all cursor-pointer ${
                  (unreadNotificationCount || 0) > 0
                    ? 'border-amber-500/60 bg-amber-500/15 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                    : 'border-slate-800 text-slate-400 hover:text-slate-200 bg-[#0d121d]/80 hover:border-slate-700'
                }`}
                title={t.notificationsTitle}
                aria-label={t.notificationsTitle}
              >
                <Bell className="w-4 h-4" />
                {(unreadNotificationCount || 0) > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-[9px] font-bold font-mono text-white shadow ring-2 ring-[#070c18] animate-pulse">
                    {(unreadNotificationCount || 0) > 9 ? '9+' : unreadNotificationCount}
                  </span>
                )}
              </button>
            )}

            {/* User Profile / Auth Action */}
            {currentUser ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                <div className="hidden md:flex flex-col items-end text-right leading-tight">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-200">
                      {currentUser.inGameName || currentUser.username}
                    </span>
                    {currentUser.role === 'owner' && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/50 font-semibold uppercase">
                        {t.ownerBadge}
                      </span>
                    )}
                    {currentUser.role === 'admin' && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/50 font-semibold uppercase">
                        {t.adminBadge}
                      </span>
                    )}
                    {currentUser.role === 'member' && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-700 text-slate-300 border border-slate-600 font-semibold uppercase">
                        {t.memberBadge}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <button
                      id="btn-navbar-request-cp"
                      type="button"
                      onClick={() => {
                        sounds.playClick();
                        if (onOpenMyStats) onOpenMyStats();
                        else onOpenRequestCp?.();
                      }}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/40 hover:border-amber-400 text-amber-300 font-mono text-[11px] font-bold transition-all cursor-pointer group shadow-sm"
                      title={lang === 'th' ? 'คลิกเพื่อเปิดหน้าสเตตัสของฉัน (My Stats)' : 'Click to open My Stats'}
                    >
                      <Zap className="w-3 h-3 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
                      <span>⚡ {(currentUser.powerLevel || 0).toLocaleString()} PL</span>
                      {currentUser.pendingPowerLevel && currentUser.pendingPowerLevel > 0 && (
                        <span className="ml-1 px-1 py-0.2 rounded bg-amber-400/25 text-[#f5d77f] text-[9px] font-sans font-bold animate-pulse">
                          ⏳ {t.pendingBadge}
                        </span>
                      )}
                    </button>
                    <span className="text-[11px] text-slate-400">
                      • {cleanClanName(currentUser.clan) || 'No Clan'}
                    </span>
                  </div>
                </div>

                {onOpenChangePassword && (
                  <button
                    id="btn-navbar-change-password"
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      onOpenChangePassword();
                    }}
                    className="p-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/40 hover:border-amber-400 text-amber-300 hover:text-white transition-all cursor-pointer shadow-sm"
                    title={t.changePasswordModalTitle}
                    aria-label={t.changePasswordModalTitle}
                  >
                    <KeyRound className="w-4 h-4" />
                  </button>
                )}

                <button
                  id="btn-logout"
                  onClick={() => {
                    sounds.playClick();
                    onLogout();
                  }}
                  className="p-2 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-300 hover:text-white transition-all cursor-pointer"
                  title={t.logout}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                id="btn-open-login"
                onClick={() => {
                  sounds.playClick();
                  onOpenAuth();
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#aa841c] hover:from-[#f5d77f] hover:to-[#c99a22] text-slate-950 font-bold text-xs sm:text-sm shadow-md hover:shadow-amber-500/20 transition-all cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                <span>{t.login}</span>
              </button>
            )}

          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-2.5 border-t border-slate-800/80 no-scrollbar">
          {navItems.map((item) => {
            const isActive = effectiveCurrentTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                onClick={() => {
                  sounds.playClick();
                  handleTabSelect(item.id);
                }}
                className={`relative px-3.5 py-1.5 sm:px-5 sm:py-2 rounded-md font-medium text-xs sm:text-sm transition-all whitespace-nowrap flex items-center gap-1.5 select-none ${
                  isActive
                    ? 'bg-gradient-to-b from-[#1e2a3f] to-[#121a29] text-[#f5d77f] border border-[#d4af37]/60 shadow-lg shadow-black/40 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#141b2b] border border-transparent'
                }`}
              >
                {item.id === 'dashboard' && <Shield className="w-3.5 h-3.5 text-sky-400" />}
                {item.id === 'vault' && <Sword className="w-3.5 h-3.5 text-amber-400" />}
                {item.id === 'queue' && <Crown className="w-3.5 h-3.5 text-purple-400" />}
                {item.id === 'all_members' && <UserCheck className="w-3.5 h-3.5 text-emerald-400" />}
                <span>{item.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-[#d4af37] rounded-full shadow-[0_0_8px_#d4af37]" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
