import React from 'react';
import {
  Crown,
  Shield,
  Sword,
  UserCheck,
  Gem,
  Sparkles,
  Globe,
  Volume2,
  VolumeX,
  LogOut,
  X,
  Menu,
  LayoutDashboard,
  Users,
  Castle,
  Clock,
  Bell,
  Zap,
  Cpu,
  Sliders,
  ArrowRightLeft,
  CheckSquare,
  Check,
  ChevronDown,
  MessageSquare,
  FileSpreadsheet,
  KeyRound,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { ActiveTab, Language, User, ClanGroup, cleanClanName } from '../types';
import { translations } from '../translations';
import { sounds } from '../utils/sound';
import { getGoogleBackupConfig } from '../services/googleSheetsBackupService';

export interface SidebarProps {
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
  onOpenDiscordModal?: () => void;
  onOpenGeminiModal?: () => void;
  onOpenGoogleBackupModal?: () => void;
  onOpenRequestCp?: () => void;
  onOpenMyStats?: () => void;
  onOpenChangePassword?: () => void;
  onOpenPowerFormula?: () => void;
  onOpenBulkSwap?: () => void;
  onOpenStatApproval?: () => void;
  pendingStatApprovalCount?: number;
  discordEnabled?: boolean;
  pendingQueueCount?: number;
  selectedClanScope?: string;
  onSelectClanScope?: (scope: string) => void;
  clans?: ClanGroup[];
  allMembers?: User[];
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  unreadNotificationCount?: number;
  onOpenNotifications?: () => void;
  isQuotaExceeded?: boolean;
  onCheckFirebaseHealth?: () => void;
  onForceSync?: () => void;
  isSyncingData?: boolean;
  onClearCacheAndReload?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
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
  onOpenDiscordModal,
  onOpenGeminiModal,
  onOpenGoogleBackupModal,
  onOpenRequestCp,
  onOpenMyStats,
  onOpenChangePassword,
  onOpenPowerFormula,
  onOpenBulkSwap,
  onOpenStatApproval,
  pendingStatApprovalCount = 0,
  discordEnabled = false,
  pendingQueueCount = 0,
  selectedClanScope = 'all',
  onSelectClanScope,
  clans = [],
  allMembers = [],
  isMobileOpen,
  setIsMobileOpen,
  unreadNotificationCount,
  onOpenNotifications,
  isQuotaExceeded = false,
  onCheckFirebaseHealth,
  onForceSync,
  isSyncingData = false,
  onClearCacheAndReload
}) => {
  const t = translations[lang];
  const effectiveCurrentTab = currentTab || activeTab || 'dashboard';
  const isGoogleConnected = Boolean(getGoogleBackupConfig().webAppUrl);

  const handleTabSelect = (tab: ActiveTab) => {
    sounds.playClick();
    if (setCurrentTab) setCurrentTab(tab);
    if (onTabChange) onTabChange(tab);
    // Auto-close mobile drawer when selecting a tab
    setIsMobileOpen(false);
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

  const isOwner = currentUser?.role === 'owner';
  const canAccessVault =
    isOwner ||
    currentUser?.role === 'admin';

  const allNavItems: {
    id: ActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    badge?: number;
    restricted?: boolean;
  }[] = [
    {
      id: 'dashboard',
      label: t.tabDashboard,
      icon: LayoutDashboard,
      accentColor: 'text-sky-400'
    },
    {
      id: 'vault',
      label: t.tabVault,
      icon: Sword,
      accentColor: 'text-amber-400',
      restricted: true
    },
    {
      id: 'queue',
      label: t.tabQueue,
      icon: Clock,
      accentColor: 'text-purple-400',
      badge: pendingQueueCount > 0 ? pendingQueueCount : undefined
    },
    {
      id: 'all_members',
      label: t.tabMembers,
      icon: Users,
      accentColor: 'text-emerald-400'
    },
    {
      id: 'clans',
      label: t.tabClans,
      icon: Shield,
      accentColor: 'text-rose-400',
      restricted: false
    },
    {
      id: 'my_stats',
      label: t.tabMyStats,
      icon: Zap,
      accentColor: 'text-amber-400'
    }
  ];

  const [isClanPickerOpen, setIsClanPickerOpen] = React.useState(false);
  const currentClanObj = clans.find((c) => cleanClanName(c.name).toLowerCase() === cleanClanName(selectedClanScope).toLowerCase());

  const navItems = allNavItems.filter(
    (item) => (!item.restricted || canAccessVault) && (item.id !== 'my_stats' || !!currentUser)
  );

  return (
    <>
      {/* 1. MOBILE TOP NAVIGATION BAR (Visible on screens < lg) */}
      <header className="lg:hidden sticky top-0 z-30 w-full bg-[#070c18]/90 border-b border-[#1c2942]/80 backdrop-blur-xl px-4 py-3 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              setIsMobileOpen(!isMobileOpen);
            }}
            aria-label="Toggle menu"
            className="p-2 rounded-lg bg-[#0d1627] border border-[#1e2e4b] text-slate-300 hover:text-[#f5d77f] hover:border-[#d4af37]/60 transition-all cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div
            onClick={() => handleTabSelect('dashboard')}
            className="flex items-center gap-2 cursor-pointer select-none"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#d4af37] via-[#91711e] to-[#45330a] p-[1.5px] shadow-sm">
              <div className="w-full h-full bg-[#090f1d] rounded-[6px] flex items-center justify-center">
                <Crown className="w-4 h-4 text-[#f5d77f]" />
              </div>
            </div>
            <div>
              <span className="font-cinzel text-sm font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#fff2b8] via-[#e6be44] to-[#c99a22]">
                LINEAGE <span className="text-[#38bdf8]">2M</span>
              </span>
              <span className="ml-1 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#d4af37]/20 border border-[#d4af37]/30 text-[#f5d77f] uppercase">
                CLAN HUB
              </span>
            </div>
          </div>
        </div>

        {/* Right Mobile Actions: Notifications, Discord & Wallpaper */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Mobile Data Source & Quota Status Badge */}
          {isQuotaExceeded ? (
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-[9px] font-bold text-amber-300 shadow-sm"
              title={lang === 'th' ? 'แหล่งข้อมูล: Google Sheets (โควต้า Firebase เต็ม)' : 'Source: Google Sheets (Firebase Quota Exceeded)'}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              <span>{lang === 'th' ? 'Google Sheets' : 'Google Sheets'}</span>
            </div>
          ) : (
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[9px] font-bold text-emerald-300 shadow-sm"
              title={lang === 'th' ? 'แหล่งข้อมูล: Firebase Cloud (โควต้าปกติ)' : 'Source: Firebase Cloud (Quota Normal)'}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>{lang === 'th' ? 'Firebase' : 'Firebase'}</span>
            </div>
          )}

          {/* Mobile Force Cloud Sync Button */}
          {onForceSync && (
            <button
              id="btn-mobile-force-sync"
              type="button"
              onClick={() => {
                sounds.playClick();
                onForceSync();
              }}
              disabled={isSyncingData}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                isSyncingData
                  ? 'bg-sky-500/20 border-sky-500/60 text-sky-300'
                  : 'bg-[#0c1424]/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
              title={isSyncingData ? t.syncingCloudData : t.syncCloudData}
              aria-label={t.syncCloudData}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingData ? 'animate-spin text-sky-400' : ''}`} />
            </button>
          )}

          {/* In-App Notifications Bell (Admin & Owner) */}
          {canAccessVault && onOpenNotifications && (
            <button
              onClick={() => {
                sounds.playClick();
                onOpenNotifications();
              }}
              className={`relative p-1.5 rounded-lg border transition-all cursor-pointer ${
                (unreadNotificationCount || 0) > 0
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                  : 'bg-[#0c1424]/80 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title={t.notificationsTitle}
              aria-label={t.notificationsTitle}
            >
              <Bell className="w-4 h-4" />
              {(unreadNotificationCount || 0) > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 flex items-center justify-center rounded-full bg-red-500 text-[8px] font-bold font-mono text-white shadow ring-1 ring-[#090e1a] animate-pulse">
                  {(unreadNotificationCount || 0) > 9 ? '9+' : unreadNotificationCount}
                </span>
              )}
            </button>
          )}

          {isOwner && onOpenDiscordModal && (
            <button
              onClick={() => {
                sounds.playClick();
                onOpenDiscordModal();
              }}
              className="relative p-1.5 rounded-lg bg-[#0c1424]/80 border border-[#5865F2]/50 text-[#8ea1e1] hover:text-white cursor-pointer"
              title={lang === 'th' ? 'ตั้งค่าแจ้งเตือน Discord' : 'Discord Webhook'}
              aria-label="Discord Webhook"
            >
              <MessageSquare className="w-4 h-4" />
              {discordEnabled && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_6px_#34d399]" />
              )}
            </button>
          )}

          {isOwner && onOpenGeminiModal && (
            <button
              onClick={() => {
                sounds.playClick();
                onOpenGeminiModal();
              }}
              className="relative p-1.5 rounded-lg bg-[#0c1424]/80 border border-[#38bdf8]/50 text-[#7dd3fc] hover:text-white cursor-pointer"
              title={lang === 'th' ? 'ตั้งค่า Gemini AI OCR Key (เฉพาะ Owner)' : 'Gemini AI OCR Key (Owner Only)'}
              aria-label="Gemini AI OCR"
            >
              <Cpu className="w-4 h-4" />
            </button>
          )}

          {isOwner && onOpenGoogleBackupModal && (
            <button
              onClick={() => {
                sounds.playClick();
                onOpenGoogleBackupModal();
              }}
              className="relative p-1.5 rounded-lg bg-[#0c1424]/80 border border-emerald-500/50 text-emerald-400 hover:text-white cursor-pointer transition-all shadow-sm"
              title={lang === 'th' ? 'สำรองข้อมูล Google Sheets & Drive (เฉพาะ Owner)' : 'Google Sheets & Drive Backup (Owner Only)'}
              aria-label={lang === 'th' ? 'สำรองข้อมูล Google Sheets' : 'Google Sheets Backup'}
            >
              <FileSpreadsheet className="w-4 h-4" />
              {isGoogleConnected && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#0c1424] shadow-[0_0_6px_#34d399]" />
              )}
            </button>
          )}

          <button
            onClick={() => {
              sounds.playClick();
              onOpenVaultModal();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0d1627]/90 border border-white/25 hover:border-white/50 text-xs font-mono font-bold text-white shadow-sm cursor-pointer transition-all"
          >
            <Gem className="w-3.5 h-3.5 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]" />
            <span>{vaultBalance.toLocaleString()}</span>
          </button>

          {isOwner && onOpenBgModal && (
            <button
              onClick={() => {
                sounds.playClick();
                onOpenBgModal();
              }}
              className="p-1.5 rounded-lg bg-[#0c1424]/80 border border-[#1e2e4b] text-[#f5d77f] cursor-pointer"
              title={lang === 'th' ? 'ตั้งค่าพื้นหลัง (Owner)' : 'Wallpaper (Owner)'}
            >
              <Sparkles className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* 2. BACKDROP OVERLAY FOR MOBILE (When sidebar is open) */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-black/75 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
        />
      )}

      {/* 3. MAIN LEFT SIDEBAR CONTAINER */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 xl:w-72 bg-[#070c18]/95 lg:bg-[#070c18]/85 border-r border-[#1c2942]/80 backdrop-blur-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* SIDEBAR HEADER / BRAND */}
        <div className="p-4 sm:p-5 border-b border-[#1c2942]/70 flex items-center justify-between">
          <div
            id="brand-logo"
            onClick={() => handleTabSelect('dashboard')}
            className="flex items-center gap-3 cursor-pointer group select-none flex-1 min-w-0"
          >
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-[#d4af37] via-[#91711e] to-[#45330a] p-[1.5px] shadow-lg shadow-[#d4af37]/20 group-hover:shadow-[#d4af37]/40 transition-all duration-300 shrink-0">
              <div className="w-full h-full bg-[#090f1d] rounded-[10px] flex items-center justify-center">
                <Crown className="w-5 h-5 text-[#f5d77f] group-hover:scale-110 transition-transform duration-300" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-cinzel text-base xl:text-lg font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#fff2b8] via-[#e6be44] to-[#c99a22] truncate">
                  LINEAGE <span className="text-[#38bdf8]">2M</span>
                </span>
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#d4af37]/20 border border-[#d4af37]/40 text-[#f5d77f] tracking-wide uppercase shrink-0">
                  CLAN HUB
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate">
                {t.appSubtitle}
              </p>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            type="button"
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors ml-2 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* GLOBAL CLAN SCOPE SWITCHER */}
        <div className="px-3 sm:px-4 pt-2 pb-1">
          <div className="relative">
            <button
              id="sidebar-clan-scope-btn"
              type="button"
              onClick={() => {
                sounds.playClick();
                setIsClanPickerOpen(!isClanPickerOpen);
              }}
              className="w-full flex items-center justify-between gap-2 p-2 rounded-xl bg-gradient-to-r from-[#0c1424] to-[#070b14] border border-slate-700/70 hover:border-[#d4af37]/60 text-slate-200 transition-all cursor-pointer shadow-sm"
              title={lang === 'th' ? 'สลับมุมมองตามแคลน' : 'Switch clan scope'}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center font-bold text-[10px] text-white shadow-sm shrink-0"
                  style={{
                    backgroundColor: currentClanObj ? (currentClanObj.color || '#3b82f6') : '#475569'
                  }}
                >
                  {currentClanObj ? currentClanObj.name.substring(0, 2).toUpperCase() : 'ALL'}
                </div>
                <div className="text-left min-w-0">
                  <div className="text-xs font-bold truncate text-slate-200">
                    {selectedClanScope === 'all' ? (lang === 'th' ? 'ทุกแคลน' : 'All Clans') : selectedClanScope}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono leading-none">
                    {selectedClanScope === 'all' ? `${allMembers.length} คน` : `${allMembers.filter(m => cleanClanName(m.clan).toLowerCase() === cleanClanName(selectedClanScope).toLowerCase()).length} คน`}
                  </div>
                </div>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isClanPickerOpen ? 'rotate-180' : ''}`} />
            </button>

            {isClanPickerOpen && (
              <div className="absolute top-full inset-x-0 mt-1 z-50 rounded-xl bg-[#090f1d] border border-slate-700 p-1.5 shadow-2xl space-y-1 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  {lang === 'th' ? 'สลับมุมมองแคลน' : 'Switch Clan Scope'}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    if (onSelectClanScope) onSelectClanScope('all');
                    setIsClanPickerOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                    selectedClanScope === 'all'
                      ? 'bg-[#1b273d] text-[#f5d77f] font-bold border border-[#d4af37]/40'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-slate-700 flex items-center justify-center font-bold text-[9px] text-white">
                      ALL
                    </div>
                    <span>{lang === 'th' ? 'ทุกแคลน (All Clans)' : 'All Clans'}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">{allMembers.length}</span>
                </button>

                <div className="h-px bg-slate-800 my-1" />

                {clans.map((c) => {
                  const isSelected = cleanClanName(selectedClanScope).toLowerCase() === cleanClanName(c.name).toLowerCase();
                  const cCount = allMembers.filter(m => cleanClanName(m.clan).toLowerCase() === cleanClanName(c.name).toLowerCase()).length;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        sounds.playClick();
                        if (onSelectClanScope) onSelectClanScope(c.name);
                        setIsClanPickerOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#1b273d] text-[#f5d77f] font-bold border border-[#d4af37]/40'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-5 h-5 rounded flex items-center justify-center font-bold text-[9px] text-white shadow-sm"
                          style={{ backgroundColor: c.color || '#3b82f6' }}
                        >
                          {c.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="truncate">{c.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">{cCount}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>


        {/* DIAMOND VAULT QUICK CARD IN SIDEBAR */}
        <div className="p-3 sm:p-4">
          <div
            id="diamond-vault-trigger"
            onClick={() => {
              sounds.playClick();
              onOpenVaultModal();
            }}
            className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-[#131929] via-[#0d131f] to-[#070a12] border border-white/20 hover:border-white/45 p-3 shadow-lg shadow-black/50 transition-all duration-200 cursor-pointer"
          >
            {/* Ambient inner glow */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none -mr-6 -mt-6" />

            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-white/10 border border-white/25 group-hover:scale-105 transition-transform shadow-inner">
                  <Gem className="w-4 h-4 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-300 group-hover:text-white flex items-center gap-1">
                    <span>{t.diamondVault}</span>
                    <Sparkles className="w-2.5 h-2.5 text-white animate-pulse" />
                  </div>
                  <div className="text-base sm:text-lg font-bold font-mono text-white tracking-tight drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
                    {vaultBalance.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-slate-200 font-medium border border-white/20 group-hover:bg-white/20 group-hover:text-white transition-colors">
                  {lang === 'th' ? 'เปิดคลัง' : 'Open'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* NAVIGATION LINKS LIST */}
        <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1.5 custom-scrollbar">
          <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {lang === 'th' ? 'เมนูระบบกิลด์' : 'Guild Navigation'}
          </div>

          {navItems.map((item) => {
            const isActive = effectiveCurrentTab === item.id;
            const IconComponent = item.icon;

            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                onClick={() => handleTabSelect(item.id)}
                className={`relative w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all group select-none cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-[#d4af37]/20 via-[#d4af37]/10 to-transparent text-[#f5d77f] border border-[#d4af37]/60 shadow-lg shadow-black/40 font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-[#111929]/80 border border-transparent'
                }`}
              >
                {/* Active left indicator bar */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#d4af37] rounded-r-full shadow-[0_0_8px_#d4af37]" />
                )}

                <div className="flex items-center gap-3">
                  <div
                    className={`p-1.5 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-[#d4af37]/25 text-[#f5d77f]'
                        : 'bg-slate-900/60 text-slate-400 group-hover:text-slate-200 group-hover:bg-slate-800/80'
                    }`}
                  >
                    <IconComponent
                      className={`w-4 h-4 ${isActive ? 'text-[#f5d77f]' : item.accentColor}`}
                    />
                  </div>
                  <span className="tracking-wide">{item.label}</span>
                </div>

                {/* Optional notification badge (e.g. queue items count) */}
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-purple-500/25 border border-purple-500/50 text-purple-300 shadow-sm">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Dedicated Section: Power Formula & Clan Management Tools (Admin) */}
          {canAccessVault && (
            <div className="pt-2 pb-1">
              <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {lang === 'th' ? 'ระบบค่าพลัง & จัดทัพ' : 'Power & Organization'}
              </div>

              {/* Admin Power Formula Button */}
              {onOpenPowerFormula && (
                <button
                  id="btn-sidebar-power-formula"
                  onClick={() => {
                    sounds.playClick();
                    handleTabSelect('power_formula');
                    if (onOpenPowerFormula) onOpenPowerFormula();
                    setIsMobileOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer mb-1 ${
                    effectiveCurrentTab === 'power_formula'
                      ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-500/60 font-semibold shadow-inner'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Sliders className="size-3.5 text-cyan-400" />
                    <span>{lang === 'th' ? 'สูตรค่าพลัง (Power Formula)' : 'Power Formula'}</span>
                  </div>
                </button>
              )}

              {/* Admin Bulk Swap Button */}
              {onOpenBulkSwap && (
                <button
                  id="btn-sidebar-bulk-swap"
                  onClick={() => {
                    sounds.playClick();
                    handleTabSelect('bulk_swap');
                    if (onOpenBulkSwap) onOpenBulkSwap();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer mb-1 ${
                    effectiveCurrentTab === 'bulk_swap'
                      ? 'bg-purple-500/25 text-purple-200 border border-purple-500/60 font-semibold shadow-inner'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <ArrowRightLeft className="size-3.5 text-purple-400" />
                    <span>{t.tabBulkSwap}</span>
                  </div>
                </button>
              )}

              {/* Admin Stat Approvals Button with Badge */}
              {onOpenStatApproval && (
                <button
                  id="btn-sidebar-stat-approvals"
                  onClick={() => {
                    sounds.playClick();
                    handleTabSelect('stat_approvals');
                    if (onOpenStatApproval) onOpenStatApproval();
                    setIsMobileOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer mb-1 ${
                    effectiveCurrentTab === 'stat_approvals'
                      ? 'bg-rose-500/25 text-rose-200 border border-rose-500/60 font-semibold shadow-inner'
                      : pendingStatApprovalCount > 0
                      ? 'bg-rose-500/15 text-rose-300 border border-rose-500/40 hover:bg-rose-500/25 font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <CheckSquare className="size-3.5 text-rose-400" />
                    <span>{lang === 'th' ? 'ตรวจคำขอสเตตัส' : 'Stat Approvals'}</span>
                  </div>
                  {pendingStatApprovalCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white animate-pulse">
                      {pendingStatApprovalCount}
                    </span>
                  )}
                </button>
              )}

              {/* Admin Notifications Button with Badge */}
              {onOpenNotifications && (
                <button
                  id="btn-sidebar-notifications"
                  onClick={() => {
                    sounds.playClick();
                    onOpenNotifications();
                    setIsMobileOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer mb-1 ${
                    (unreadNotificationCount || 0) > 0
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/25 font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Bell className="size-3.5 text-amber-400" />
                    <span>{t.notificationsTitle}</span>
                  </div>
                  {(unreadNotificationCount || 0) > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-red-500 text-white animate-pulse">
                      {unreadNotificationCount}
                    </span>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* SIDEBAR FOOTER: USER PROFILE & UTILITIES */}
        <div className="p-3 sm:p-4 border-t border-[#1c2942]/80 bg-[#050913]/70 space-y-3">
          
          {/* User Profile Card */}
          {currentUser ? (
            <div className="p-2.5 rounded-xl bg-[#0a101f]/80 border border-slate-800/80 flex items-center justify-between gap-2 shadow-inner">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-slate-200 truncate">
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
                <div className="flex items-center gap-1.5 mt-1">
                  <button
                    id="btn-sidebar-request-cp"
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      if (onOpenMyStats) onOpenMyStats();
                      else onOpenRequestCp?.();
                    }}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/40 hover:border-amber-400 text-amber-300 font-mono text-[10px] font-medium transition-all cursor-pointer group shadow-sm"
                    title={lang === 'th' ? 'คลิกเพื่อเปิดหน้าสเตตัสของฉัน (My Stats)' : 'Click to open My Stats'}
                  >
                    <Zap className="w-2.5 h-2.5 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
                    <span>⚡ {(currentUser.powerLevel || 0).toLocaleString()} PL</span>
                    {currentUser.pendingPowerLevel && currentUser.pendingPowerLevel > 0 && (
                      <span className="ml-0.5 px-1 py-0.2 rounded bg-amber-400/25 text-[#f5d77f] text-[8px] font-sans font-bold animate-pulse">
                        ⏳
                      </span>
                    )}
                  </button>
                  <span className="text-[10px] text-slate-400 truncate">
                    • {cleanClanName(currentUser.clan) || 'No Clan'}
                  </span>
                </div>
              </div>

              {onOpenChangePassword && (
                <button
                  id="btn-sidebar-change-password"
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    onOpenChangePassword();
                  }}
                  className="p-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/40 hover:border-amber-400 text-amber-300 hover:text-white transition-all cursor-pointer shrink-0 shadow-sm"
                  title={t.changePasswordModalTitle}
                  aria-label={t.changePasswordModalTitle}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                id="btn-logout"
                onClick={() => {
                  sounds.playClick();
                  onLogout();
                }}
                className="p-2 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-300 hover:text-white transition-all cursor-pointer shrink-0"
                title={t.logout}
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              id="btn-open-login"
              onClick={() => {
                sounds.playClick();
                onOpenAuth();
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#aa841c] hover:from-[#f5d77f] hover:to-[#c99a22] text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span>{t.login}</span>
            </button>
          )}

          {/* Quick Utility Icons Row (Wallpaper, Sound, Language) */}
          <div className="flex items-center justify-between gap-1.5 pt-1">
            {/* Wallpaper Settings (Owner Only) */}
            {isOwner && onOpenBgModal && (
              <button
                id="btn-wallpaper-settings"
                onClick={() => {
                  sounds.playClick();
                  onOpenBgModal();
                }}
                className="relative p-1.5 rounded-lg border border-[#d4af37]/40 bg-[#d4af37]/15 hover:bg-[#d4af37]/30 text-[#f5d77f] hover:text-white transition-all cursor-pointer shrink-0"
                title={lang === 'th' ? 'ตั้งค่าภาพพื้นหลังปราสาท (Owner)' : 'Wallpaper Settings (Owner)'}
                aria-label={lang === 'th' ? 'ตั้งค่าภาพพื้นหลังปราสาท' : 'Wallpaper Settings'}
              >
                <Sparkles className="w-4 h-4 text-[#d4af37]" />
              </button>
            )}

            {/* In-App Notifications Bell (For Admin / Owner) */}
            {canAccessVault && onOpenNotifications && (
              <button
                id="btn-sidebar-notification-bell"
                onClick={() => {
                  sounds.playClick();
                  onOpenNotifications();
                }}
                className={`relative p-1.5 rounded-lg border transition-all cursor-pointer ${
                  (unreadNotificationCount || 0) > 0
                    ? 'border-amber-500/60 bg-amber-500/20 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                    : 'border-slate-800 text-slate-400 hover:text-white bg-[#0c1424]/80'
                }`}
                title={t.notificationsTitle}
                aria-label={t.notificationsTitle}
              >
                <Bell className="w-4 h-4" />
                {(unreadNotificationCount || 0) > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 flex items-center justify-center rounded-full bg-red-500 text-[8px] font-bold font-mono text-white shadow ring-1 ring-[#090e1a] animate-pulse">
                    {(unreadNotificationCount || 0) > 9 ? '9+' : unreadNotificationCount}
                  </span>
                )}
              </button>
            )}

            {/* Discord Webhook Settings (For Owner Only) */}
            {isOwner && onOpenDiscordModal && (
              <button
                id="btn-discord-settings"
                onClick={() => {
                  sounds.playClick();
                  onOpenDiscordModal();
                }}
                className="relative p-1.5 rounded-lg border border-[#5865F2]/40 bg-[#5865F2]/15 hover:bg-[#5865F2]/30 text-[#8ea1e1] hover:text-white transition-all cursor-pointer"
                title={lang === 'th' ? 'ตั้งค่าแจ้งเตือน Discord' : 'Discord Webhook'}
                aria-label="Discord Webhook"
              >
                <MessageSquare className="w-4 h-4" />
                {discordEnabled && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_6px_#34d399]" />
                )}
              </button>
            )}

            {/* Gemini AI OCR Settings (For Owner Only) */}
            {isOwner && onOpenGeminiModal && (
              <button
                id="btn-gemini-settings"
                onClick={() => {
                  sounds.playClick();
                  onOpenGeminiModal();
                }}
                className="relative p-1.5 rounded-lg border border-[#38bdf8]/40 bg-[#38bdf8]/15 hover:bg-[#38bdf8]/30 text-[#7dd3fc] hover:text-white transition-all cursor-pointer"
                title={lang === 'th' ? 'ตั้งค่า Gemini AI OCR Key (เฉพาะ Owner)' : 'Gemini AI OCR Key (Owner Only)'}
                aria-label="Gemini AI OCR"
              >
                <Cpu className="w-4 h-4" />
              </button>
            )}

            {/* Google Sheets & Drive Backup (For Owner Only) */}
            {isOwner && onOpenGoogleBackupModal && (
              <button
                id="btn-google-backup"
                onClick={() => {
                  sounds.playClick();
                  onOpenGoogleBackupModal();
                }}
                className="relative p-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 hover:text-white transition-all cursor-pointer"
                title={lang === 'th' ? 'สำรองข้อมูล Google Sheets & Drive (เฉพาะ Owner)' : 'Google Sheets & Drive Backup (Owner Only)'}
                aria-label={lang === 'th' ? 'สำรองข้อมูล Google Sheets' : 'Google Sheets Backup'}
              >
                <FileSpreadsheet className="w-4 h-4" />
                {isGoogleConnected && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#0f172a] shadow-[0_0_6px_#34d399]" />
                )}
              </button>
            )}

            {/* Sound Toggle */}
            <button
              id="btn-sound-toggle"
              onClick={toggleSound}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                soundEnabled
                  ? 'border-[#d4af37]/40 text-[#f5d77f] bg-[#1a2332]/80'
                  : 'border-slate-800 text-slate-500 bg-[#0d121d]/80'
              }`}
              title={t.soundToggle}
              aria-label={t.soundToggle}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Language Switcher */}
            <button
              id="btn-language-toggle"
              onClick={toggleLang}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#d4af37]/40 bg-[#162030]/80 hover:bg-[#1f2d45] text-[11px] font-semibold text-[#f5d77f] hover:text-white transition-all shadow-sm cursor-pointer"
              title="Switch Language / เปลี่ยนภาษา"
            >
              <Globe className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>{lang === 'th' ? 'TH' : 'EN'}</span>
            </button>
          </div>

          {/* Quick Cloud Sync & Reset Cache Row */}
          {(onForceSync || onClearCacheAndReload) && (
            <div className="flex items-center gap-1.5 pt-2">
              {onForceSync && (
                <button
                  id="btn-sidebar-force-sync"
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    onForceSync();
                  }}
                  disabled={isSyncingData}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 hover:border-sky-400/50 text-[10px] font-semibold text-sky-300 hover:text-white transition-all cursor-pointer shadow-sm disabled:opacity-50"
                  title={isSyncingData ? t.syncingCloudData : t.syncCloudData}
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncingData ? 'animate-spin text-sky-400' : 'text-sky-400'}`} />
                  <span>{isSyncingData ? t.syncingCloudData : t.syncCloudData}</span>
                </button>
              )}
              {onClearCacheAndReload && (
                <button
                  id="btn-sidebar-clear-cache"
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    onClearCacheAndReload();
                  }}
                  className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/25 border border-red-500/30 hover:border-red-400/50 text-red-300 hover:text-white transition-all cursor-pointer shrink-0"
                  title={t.clearCacheReload}
                  aria-label={t.clearCacheReload}
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
              )}
            </div>
          )}

          {/* System Version & Status Indicator */}
          <div className="pt-2 pb-0.5 flex items-center justify-between gap-1.5 px-1">
            <span
              className="text-[9px] font-mono font-medium text-emerald-400 animate-pulse tracking-tight truncate drop-shadow-[0_0_8px_rgba(52,211,153,0.35)]"
              title="Lineage2M Clan Hub Made By Elon"
            >
              Lineage2M Clan Hub Made By Elon
            </span>
            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[9px] font-mono text-emerald-400 font-bold shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>v2.8.13</span>
            </div>
          </div>

        </div>

      </aside>
    </>
  );
};
