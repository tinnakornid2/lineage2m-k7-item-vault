import React from 'react';
import {
  Gem,
  ArrowDownCircle,
  ArrowUpCircle,
  Gift,
  CheckCircle,
  Lock,
  Zap,
  Users,
  Sparkles,
  ShieldAlert,
  Crown,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  SlidersHorizontal,
  X,
  Trash2,
  Eye,
  RotateCcw,
  History,
  Clock,
  AlertTriangle,
  AlertCircle
} from 'lucide-react';
import {
  ActiveTab,
  DiamondVaultRecord,
  ItemRarity,
  Language,
  QueueItem,
  User,
  VaultItem,
  hasUserUpdatedStats,
  isUserStatsPending
} from '../types';
import { translations } from '../translations';
import { sounds } from '../utils/sound';

interface DashboardViewProps {
  lang: Language;
  currentUser: User | null;
  vaultBalance: number;
  transactions?: DiamondVaultRecord[];
  onOpenVaultModal: () => void;
  availableItems: VaultItem[];
  queueItems: QueueItem[];
  onClaimItem: (itemId: string) => Promise<void>;
  onUnclaimItem?: (itemId: string) => Promise<void>;
  onViewClaimants?: (item: VaultItem) => void;
  onOpenDistributeModal: (item: VaultItem) => void;
  onNavigateTab: (tab: ActiveTab) => void;
  onOpenAuth: () => void;
  onViewImage?: (url: string, title?: string) => void;
  onOpenOwnerResetModal?: () => void;
  onDeleteItem?: (itemId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  lang,
  currentUser,
  vaultBalance,
  transactions = [],
  onOpenVaultModal,
  availableItems,
  queueItems,
  onClaimItem,
  onUnclaimItem,
  onViewClaimants,
  onOpenDistributeModal,
  onNavigateTab,
  onOpenAuth,
  onViewImage,
  onOpenOwnerResetModal,
  onDeleteItem
}) => {
  const t = translations[lang];
  const [itemToDelete, setItemToDelete] = React.useState<VaultItem | null>(null);
  const [statWarningModalItem, setStatWarningModalItem] = React.useState<VaultItem | null>(null);
  const [filterAvailableToMe, setFilterAvailableToMe] = React.useState(false);
  const [queueSearchQuery, setQueueSearchQuery] = React.useState('');
  const [queueRarityFilter, setQueueRarityFilter] = React.useState<string>('all');
  const [expandedQueues, setExpandedQueues] = React.useState<Record<string, boolean>>({});

  const toggleExpandQueue = (queueId: string) => {
    sounds.playClick();
    setExpandedQueues((prev) => ({
      ...prev,
      [queueId]: !prev[queueId]
    }));
  };

  const isAdminOrOwner =
    currentUser?.role === 'owner' ||
    currentUser?.role === 'admin' ||
    currentUser?.role === 'manager';

  const displayedAvailableItems = React.useMemo(() => {
    if (!filterAvailableToMe || !currentUser) return availableItems;
    const userPower = Number(currentUser.powerLevel || 0);
    const isPrivileged = currentUser.role === 'owner' || currentUser.role === 'admin';
    return availableItems.filter((item) => isPrivileged || userPower >= Number(item.minPowerLevel || 0));
  }, [availableItems, filterAvailableToMe, currentUser]);

  const displayedQueueItems = React.useMemo(() => {
    return queueItems.filter((q) => {
      const qQuery = queueSearchQuery.trim().toLowerCase();
      const matchesSearch =
        !qQuery ||
        q.name.toLowerCase().includes(qQuery) ||
        q.queueList.some((m) => m.name.toLowerCase().includes(qQuery) || m.clan.toLowerCase().includes(qQuery));
      const matchesRarity = queueRarityFilter === 'all' || q.rarity === queueRarityFilter;
      return matchesSearch && matchesRarity;
    });
  }, [queueItems, queueSearchQuery, queueRarityFilter]);

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (lang === 'th') {
      if (minutes < 1) return 'เมื่อสักครู่';
      if (minutes < 60) return `${minutes} น. ที่แล้ว`;
      if (hours < 24) return `${hours} ชม. ที่แล้ว`;
      if (days < 7) return `${days} วันที่แล้ว`;
      const d = new Date(timestamp);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    } else {
      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      if (days < 7) return `${days}d ago`;
      const d = new Date(timestamp);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    }
  };

  const getRarityBadge = (r: ItemRarity) => {
    switch (r) {
      case 'MYTHIC':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/60 glow-mythic';
      case 'LAGEND':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/60 glow-legend';
      case 'EPIC':
        return 'bg-red-500/20 text-red-300 border-red-500/60 glow-epic';
      case 'RARE':
      default:
        return 'bg-sky-500/20 text-sky-300 border-sky-500/60 glow-rare';
    }
  };

  const getRarityBorder = (r: ItemRarity) => {
    switch (r) {
      case 'MYTHIC':
        return 'border-[#eab308]/60 hover:border-[#eab308]';
      case 'LAGEND':
        return 'border-[#a855f7]/60 hover:border-[#a855f7]';
      case 'EPIC':
        return 'border-[#ef4444]/60 hover:border-[#ef4444]';
      case 'RARE':
      default:
        return 'border-[#38bdf8]/60 hover:border-[#38bdf8]';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* 1. HERO & DIAMOND VAULT BOX */}
      <section className="relative rounded-2xl overflow-hidden l2m-panel border border-[#d4af37]/30 p-6 sm:p-8">
        <div className="absolute -right-16 -top-16 w-80 h-80 bg-gradient-to-bl from-[#d4af37]/15 via-[#38bdf8]/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl xl:max-w-md 2xl:max-w-lg">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 text-xs font-semibold text-[#f5d77f]">
              <Crown className="w-3.5 h-3.5" />
              <span>LINEAGE 2M • CLAN HUB</span>
            </div>
            <h1 className="text-2xl sm:text-3xl 2xl:text-4xl font-extrabold font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-[#fff2b8] via-[#e6be44] to-[#b8860b] leading-tight">
              {t.appTitle}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {t.appSubtitle}
            </p>
          </div>

          {/* Right Area: Resized Diamonds Box + Transaction Timeline Log Box */}
          <div className="w-full xl:w-auto flex flex-col sm:flex-row items-stretch gap-3.5">
            {/* 1. Resized/Compact Diamond Vault Box */}
            <div
              id="diamond-vault-card"
              className="w-full sm:w-56 md:w-60 rounded-xl bg-gradient-to-b from-[#131929] to-[#080c14] border border-white/20 hover:border-white/45 p-4 shadow-2xl relative flex flex-col justify-between group transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-white/10 border border-white/25 text-white shadow-inner">
                      <Gem className="w-4 h-4 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.7)] group-hover:scale-110 transition-transform" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-cinzel">
                        {t.diamondVault}
                      </h3>
                      <p className="text-[10px] text-slate-400">
                        {lang === 'th' ? 'กล่องเพชรกลาง' : 'Guild Vault'}
                      </p>
                    </div>
                  </div>
                  <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
                </div>

                <div className="flex items-baseline gap-1.5 my-2">
                  <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.35)]">
                    {vaultBalance.toLocaleString()}
                  </span>
                  <span className="text-xs font-medium text-slate-400">
                    {t.diamonds}
                  </span>
                </div>
              </div>

              {/* Admin/Owner Deposit/Withdraw controls */}
              {isAdminOrOwner ? (
                <button
                  id="btn-dash-vault-manage"
                  onClick={() => {
                    sounds.playClick();
                    onOpenVaultModal();
                  }}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/25 text-white text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                >
                  <ArrowDownCircle className="w-3.5 h-3.5 text-white" />
                  <span>{t.deposit} / {t.withdraw}</span>
                </button>
              ) : (
                <div className="text-[10px] text-slate-400 italic">
                  {lang === 'th' ? 'กองทุนเพชรกลางกิลด์' : 'Clan reserve pool'}
                </div>
              )}
            </div>

            {/* 2. Transaction Log Timeline Box */}
            <div
              id="diamond-timeline-card"
              className="w-full sm:w-80 md:w-96 rounded-xl bg-gradient-to-b from-[#111927] to-[#0a0f18] border border-slate-800 hover:border-[#38bdf8]/40 p-4 shadow-2xl relative flex flex-col justify-between transition-all"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400">
                    <History className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-cinzel">
                      {lang === 'th' ? 'ไทม์ไลน์ธุรกรรม' : 'Transaction Timeline'}
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      {lang === 'th' ? 'ประวัติฝาก-ถอนล่าสุด' : 'Recent vault log'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    sounds.playClick();
                    onOpenVaultModal();
                  }}
                  className="text-[10px] text-[#38bdf8] hover:text-white flex items-center gap-0.5 px-2 py-0.5 rounded-md hover:bg-[#38bdf8]/10 transition-colors cursor-pointer font-medium"
                >
                  <span>{lang === 'th' ? 'ดูทั้งหมด' : 'View all'}</span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                    {transactions.length}
                  </span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {/* Timeline Items List */}
              <div className="h-[96px] overflow-y-auto pr-1 relative space-y-2">
                {transactions.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 text-xs py-2">
                    <Clock className="w-4 h-4 mb-1 text-slate-600" />
                    <span>{lang === 'th' ? 'ยังไม่มีประวัติธุรกรรมเพชร' : 'No transactions recorded yet'}</span>
                  </div>
                ) : (
                  <div className="relative pl-3 space-y-2 before:absolute before:left-1 before:top-1 before:bottom-1 before:w-[2px] before:bg-slate-800">
                    {transactions.slice(0, 10).map((tx) => {
                      const isDeposit = tx.type === 'deposit';
                      return (
                        <div key={tx.id} className="relative flex items-start justify-between gap-2 text-xs">
                          {/* Timeline Dot */}
                          <div
                            className={`absolute -left-3 top-1 w-2 h-2 rounded-full ring-2 ${
                              isDeposit
                                ? 'bg-emerald-400 ring-emerald-500/20'
                                : 'bg-amber-400 ring-amber-500/20'
                            }`}
                          />

                          {/* Content */}
                          <div className="min-w-0 flex-1 pl-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`font-mono font-bold text-[11px] ${
                                  isDeposit ? 'text-emerald-400' : 'text-amber-400'
                                }`}
                              >
                                {isDeposit ? '+' : '-'}{tx.amount.toLocaleString()} 💎
                              </span>
                              <span className="text-[10px] text-slate-400 truncate">
                                {isDeposit
                                  ? (lang === 'th' ? 'ฝากโดย' : 'by')
                                  : (lang === 'th' ? 'ถอนโดย' : 'by')} <strong className="text-slate-300 font-normal">{tx.performedBy?.name || 'Admin'}</strong>
                              </span>
                            </div>
                            {tx.note && (
                              <p className="text-[10px] text-slate-500 truncate italic">
                                "{tx.note}"
                              </p>
                            )}
                          </div>

                          {/* Time */}
                          <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                            {formatTimeAgo(tx.timestamp)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. ACTIVE CLAIMABLE ITEMS (กล่องไอเทมเปิดรับ - แสดงแบบตารางแนวนอน ขนาดกะทัดรัด) */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-cinzel text-slate-100 flex items-center gap-2">
                <span>{t.availableItems}</span>
                <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono">
                  {availableItems.length}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                {lang === 'th'
                  ? 'รายการไอเทมเปิดรับเครม'
                  : 'Active claimable items'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter: Available to me */}
            {currentUser && (
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setFilterAvailableToMe(!filterAvailableToMe);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                  filterAvailableToMe
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                    : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:border-slate-600'
                }`}
                title={lang === 'th' ? 'กรองเฉพาะไอเทมที่พลังของคุณถึงเกณฑ์ขอรับได้' : 'Show only items you can claim'}
              >
                <Zap className={`size-3.5 ${filterAvailableToMe ? 'text-slate-950 fill-slate-950' : 'text-amber-400'}`} />
                <span>{lang === 'th' ? '⚡ พลังถึงเกณฑ์' : '⚡ Available to me'}</span>
              </button>
            )}

            {currentUser?.role === 'owner' && onOpenOwnerResetModal && (
              <button
                id="btn-dash-owner-reset"
                onClick={() => {
                  sounds.playClick();
                  onOpenOwnerResetModal();
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-950/70 border border-red-800/80 hover:border-red-500 text-red-200 hover:text-white text-[11px] font-bold transition-all shadow cursor-pointer group"
                title={t.ownerResetDesc}
              >
                <RotateCcw className="w-3 h-3 text-red-400 group-hover:-rotate-90 transition-transform" />
                <span>{t.ownerResetBtn}</span>
              </button>
            )}

            {isAdminOrOwner && (
              <button
                onClick={() => {
                  sounds.playClick();
                  onNavigateTab('vault');
                }}
                className="text-xs font-semibold text-[#f5d77f] hover:text-white flex items-center gap-1 transition-colors"
              >
                <span>{t.tabVault}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Stat Update Alert Banner for members who haven't updated stats */}
        {currentUser && !hasUserUpdatedStats(currentUser) && (
          <div className="p-3.5 sm:p-4 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-[#181308] to-[#0d121f] text-slate-200 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 shrink-0 mt-0.5 sm:mt-0">
                {isUserStatsPending(currentUser) ? (
                  <Clock className="w-4 h-4 animate-pulse" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-amber-300">
                    {isUserStatsPending(currentUser)
                      ? t.statsPendingBannerTitle
                      : t.statsRequiredBannerTitle}
                  </h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {isUserStatsPending(currentUser)
                      ? t.statsPendingBadge
                      : (lang === 'th' ? 'ต้องอัปเดตก่อน' : 'Action Required')}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-300 mt-1 leading-relaxed">
                  {isUserStatsPending(currentUser)
                    ? t.statsPendingBannerDesc
                    : t.statsRequiredBannerDesc}
                </p>
              </div>
            </div>

            {!isUserStatsPending(currentUser) && (
              <button
                type="button"
                id="btn-banner-go-update-stats"
                onClick={() => {
                  sounds.playClick();
                  onNavigateTab('my_stats');
                }}
                className="w-full sm:w-auto px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#aa841c] hover:brightness-110 text-slate-950 text-xs font-bold shadow transition-all cursor-pointer shrink-0 flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                <span>{t.goToUpdateStats}</span>
              </button>
            )}
          </div>
        )}

        {displayedAvailableItems.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-[#0d131f]/60 p-6 text-center text-slate-400 space-y-1.5">
            <p className="text-xs sm:text-sm font-medium">
              {filterAvailableToMe
                ? (lang === 'th' ? 'ไม่มีไอเทมที่พลังของคุณถึงเกณฑ์ในขณะนี้' : 'No items matching your Power Level right now')
                : t.noAvailableItems}
            </p>
            {filterAvailableToMe ? (
              <button
                onClick={() => setFilterAvailableToMe(false)}
                className="text-xs text-amber-400 hover:underline"
              >
                {lang === 'th' ? 'แสดงไอเทมทั้งหมด' : 'Show all items'}
              </button>
            ) : isAdminOrOwner && (
              <button
                onClick={() => onNavigateTab('vault')}
                className="text-xs text-[#f5d77f] hover:underline"
              >
                + {t.addNewItem}
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-[#23314f] bg-gradient-to-b from-[#101726] via-[#0c121e] to-[#070b14] shadow-xl overflow-hidden">
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-left border-collapse min-w-[680px]">
                <thead className="sticky top-0 z-10 bg-[#090e1a]/95 backdrop-blur-sm shadow-sm">
                  <tr className="border-b border-[#1f2d47] text-[10px] font-bold tracking-wider text-[#d4af37] uppercase font-cinzel">
                    <th className="py-2 px-3 w-14 text-center">{t.itemImage}</th>
                    <th className="py-2 px-3 min-w-[150px]">{t.itemName}</th>
                    <th className="py-2 px-3 min-w-[110px]">{t.itemPrice}</th>
                    <th className="py-2 px-3 min-w-[140px]">{t.itemMinPower}</th>
                    <th className="py-2 px-3 text-center min-w-[80px]">{t.claimCount}</th>
                    <th className="py-2 px-3 text-right min-w-[160px]">{t.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#18233a]/70 text-xs">
                  {displayedAvailableItems.map((item) => {
                    const hasClaimed = Boolean(
                      currentUser &&
                      item.claimants?.some(
                        (c) =>
                          (c.userId && c.userId === currentUser.id) ||
                          (c.inGameName &&
                            currentUser.inGameName &&
                            c.inGameName.trim().toLowerCase() ===
                              currentUser.inGameName.trim().toLowerCase())
                      )
                    );
                    const isPrivileged = currentUser?.role === 'owner' || currentUser?.role === 'admin';
                    const hasStats = hasUserUpdatedStats(currentUser);
                    const isStatsPendingState = isUserStatsPending(currentUser);
                    const userPower = Number(currentUser?.powerLevel || 0);
                    const hasEnoughPower = isPrivileged || (hasStats && userPower >= Number(item.minPowerLevel || 0));

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-[#121c2e]/70 transition-colors group"
                      >
                        {/* 1. Item Image (Compact & Zoomable) */}
                        <td className="py-1.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              sounds.playClick();
                              onViewImage?.(item.imageUrl, item.name);
                            }}
                            title={t.zoomImage}
                            className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-lg overflow-hidden border bg-[#080d18] mx-auto cursor-pointer shadow-sm group-hover:scale-105 transition-transform block shrink-0 ${getRarityBorder(
                              item.rarity
                            )}`}
                          >
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        </td>

                        {/* 2. Name & Rarity */}
                        <td className="py-1.5 px-3">
                          <div className="flex flex-col gap-0.5 max-w-[220px]">
                            <span className="text-xs sm:text-sm font-bold text-slate-100 group-hover:text-[#f5d77f] transition-colors truncate">
                              {item.name}
                            </span>
                            <span
                              className={`self-start text-[8.5px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider ${getRarityBadge(
                                item.rarity
                              )}`}
                            >
                              {item.rarity}
                            </span>
                          </div>
                        </td>

                        {/* 3. Price */}
                        <td className="py-1.5 px-3">
                          <div className="flex items-center gap-1 font-mono font-bold text-xs sm:text-sm text-white">
                            <Gem className="w-3.5 h-3.5 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.7)] shrink-0" />
                            <span>{item.price.toLocaleString()}</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {t.diamonds}
                            </span>
                          </div>
                        </td>

                        {/* 4. Min Power (PL) */}
                        <td className="py-1.5 px-3">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 font-mono font-bold text-xs text-amber-300">
                              <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                              <span>⚡ {item.minPowerLevel.toLocaleString()} PL</span>
                            </div>
                            {currentUser && (
                              <div className="text-[9px]">
                                {hasEnoughPower ? (
                                  <span className="text-emerald-400 font-medium">
                                    ✓ {t.eligibleToClaim} (⚡ {userPower.toLocaleString()} PL)
                                  </span>
                                ) : (
                                  <span className="text-red-400 font-medium">
                                    ✗ {t.insufficientPower} (⚡ {userPower.toLocaleString()} PL)
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 5. Claimants */}
                        <td className="py-1.5 px-3 text-center">
                          <button
                            type="button"
                            id={`btn-view-claimants-${item.id}`}
                            onClick={() => {
                              sounds.playClick();
                              if (onViewClaimants) onViewClaimants(item);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#0d1524] hover:bg-[#16243d] border border-slate-700/60 hover:border-sky-500/60 text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm group"
                            title={lang === 'th' ? 'คลิกดูรายชื่อผู้ลงชื่อเครม' : 'Click to view claimants list'}
                          >
                            <Users className="w-3 h-3 text-sky-400 group-hover:scale-110 transition-transform" />
                            <span className="font-bold text-sky-300 font-mono text-xs">
                              {item.claimants?.length || 0}
                            </span>
                            <span className="text-[9px] text-slate-400 group-hover:text-slate-200">
                              {lang === 'th' ? 'คน' : 'p'}
                            </span>
                            <Eye className="w-2.5 h-2.5 text-sky-400 opacity-60 group-hover:opacity-100 transition-opacity ml-0.5" />
                          </button>
                        </td>

                        {/* 6. Action */}
                        <td className="py-1.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Member Claim Button / Status */}
                            {!currentUser ? (
                              <button
                                onClick={() => {
                                  sounds.playClick();
                                  onOpenAuth();
                                }}
                                className="px-2.5 py-1 rounded-lg bg-[#1a2538] hover:bg-[#233149] text-[11px] font-bold text-[#f5d77f] border border-[#d4af37]/30 transition-all"
                              >
                                {t.login}
                              </button>
                            ) : hasClaimed ? (
                              <div className="flex items-center gap-1">
                                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-950/50 border border-emerald-700/50 text-emerald-300 text-[11px] font-bold">
                                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                                  <span>{t.alreadyClaimed}</span>
                                </div>
                                {onUnclaimItem && (
                                  <button
                                    type="button"
                                    id={`btn-unclaim-dashboard-${item.id}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      sounds.playClick();
                                      onUnclaimItem(item.id);
                                    }}
                                    className="px-2 py-1 rounded-lg bg-red-950/70 hover:bg-red-900 border border-red-800/70 text-red-300 hover:text-white text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 shadow-sm active:scale-95"
                                    title={t.cancelClaimBtn}
                                  >
                                    <X className="w-3 h-3 text-red-400" />
                                    <span className="hidden sm:inline">{t.cancelClaimBtn}</span>
                                  </button>
                                )}
                              </div>
                            ) : !currentUser ? (
                              <button
                                id={`btn-claim-${item.id}`}
                                onClick={() => onOpenAuth()}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 btn-l2m-gold text-slate-950 shadow-md cursor-pointer active:scale-95"
                              >
                                <Sparkles className="w-3 h-3" />
                                <span>{t.claimItemBtn}</span>
                              </button>
                            ) : !hasStats && !isPrivileged ? (
                              <button
                                id={`btn-claim-${item.id}`}
                                onClick={() => {
                                  sounds.playClick();
                                  setStatWarningModalItem(item);
                                }}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 shadow-sm cursor-pointer active:scale-95"
                                title={isStatsPendingState ? t.statsPendingBadge : t.updateStatsFirst}
                              >
                                {isStatsPendingState ? (
                                  <>
                                    <Clock className="w-3 h-3 text-amber-400 animate-pulse" />
                                    <span>{t.statsPendingBadge}</span>
                                  </>
                                ) : (
                                  <>
                                    <AlertCircle className="w-3 h-3 text-amber-400" />
                                    <span>{t.updateStatsFirst}</span>
                                  </>
                                )}
                              </button>
                            ) : (
                              <button
                                id={`btn-claim-${item.id}`}
                                disabled={!hasEnoughPower}
                                onClick={() => {
                                  sounds.playClaim();
                                  onClaimItem(item.id);
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
                                  hasEnoughPower
                                    ? 'btn-l2m-gold text-slate-950 font-bold shadow-md cursor-pointer active:scale-95'
                                    : 'bg-slate-800/60 text-slate-500 border border-slate-700/40 cursor-not-allowed'
                                }`}
                              >
                                {hasEnoughPower ? (
                                  <>
                                    <Sparkles className="w-3 h-3" />
                                    <span>{t.claimItemBtn}</span>
                                  </>
                                ) : (
                                  <>
                                    <Lock className="w-3 h-3" />
                                    <span>{t.insufficientPower}</span>
                                  </>
                                )}
                              </button>
                            )}

                            {/* Admin / Owner Distribute Button */}
                            {isAdminOrOwner && (
                              <button
                                id={`btn-distribute-${item.id}`}
                                onClick={() => {
                                  sounds.playClick();
                                  onOpenDistributeModal(item);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white text-[11px] font-bold transition-all flex items-center gap-1 shadow-md cursor-pointer shrink-0"
                                title={t.distributeItemBtn}
                              >
                                <Gift className="w-3 h-3" />
                                <span className="hidden sm:inline">{t.distributeItemBtn}</span>
                              </button>
                            )}

                            {/* Admin / Owner Delete Active Item Button */}
                            {isAdminOrOwner && onDeleteItem && (
                              <button
                                id={`btn-delete-active-item-${item.id}`}
                                onClick={() => {
                                  sounds.playClick();
                                  setItemToDelete(item);
                                }}
                                className="p-1 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/40 transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95 shrink-0"
                                title={lang === 'th' ? 'ลบไอเทมนี้' : 'Delete item'}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* 3. ITEM QUEUE PREVIEW (คิวไอเทมบนแดชบอร์ด - แสดงทุกรายการ) */}
      <section className="space-y-4">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 shadow-sm shrink-0">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold font-cinzel text-slate-100 flex flex-wrap items-center gap-2">
                <span>{t.queueTitle}</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono font-bold">
                  {queueItems.length} {lang === 'th' ? 'รายการทั้งหมด' : 'total items'}
                </span>
                {displayedQueueItems.length !== queueItems.length && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                    {lang === 'th' ? `ตรงกับค้นหา ${displayedQueueItems.length}` : `Matches: ${displayedQueueItems.length}`}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'th'
                  ? 'แสดงลำดับคิวและผู้รอรับไอเทมทุกรายการในระบบ'
                  : 'Displaying all item queues and waiting claimants in the system'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
            {/* Quick search input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={queueSearchQuery}
                onChange={(e) => setQueueSearchQuery(e.target.value)}
                placeholder={lang === 'th' ? 'ค้นหาคิว / ชื่อคน...' : 'Search queue / name...'}
                className="pl-8 pr-7 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500/70 focus:ring-1 focus:ring-purple-500/50 w-36 sm:w-48 transition-all"
              />
              {queueSearchQuery && (
                <button
                  type="button"
                  onClick={() => setQueueSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Link to Full Queue Management Tab */}
            <button
              onClick={() => {
                sounds.playClick();
                onNavigateTab('queue');
              }}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600/30 to-purple-500/20 hover:from-purple-600/40 hover:to-purple-500/30 text-[#f5d77f] hover:text-white border border-purple-500/40 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0"
            >
              <span>{lang === 'th' ? 'จัดการคิวทั้งหมด' : 'Full Queue Manager'}</span>
              <ChevronRight className="w-3.5 h-3.5 text-[#f5d77f]" />
            </button>
          </div>
        </div>

        {/* Rarity Quick Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[11px] text-slate-500 mr-1 flex items-center gap-1">
            <SlidersHorizontal className="w-3 h-3" />
            <span>{lang === 'th' ? 'ระดับ:' : 'Rarity:'}</span>
          </span>
          {[
            { id: 'all', labelTh: 'ทั้งหมด', labelEn: 'All' },
            { id: 'MYTHIC', labelTh: 'MYTHIC (ทอง)', labelEn: 'Mythic' },
            { id: 'LAGEND', labelTh: 'LAGEND (ม่วง)', labelEn: 'Legend' },
            { id: 'EPIC', labelTh: 'EPIC (แดง)', labelEn: 'Epic' },
            { id: 'RARE', labelTh: 'RARE (ฟ้า)', labelEn: 'Rare' }
          ].map((pill) => {
            const isSelected = queueRarityFilter === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setQueueRarityFilter(pill.id);
                }}
                className={`px-2.5 py-0.5 rounded-lg text-[11px] font-medium transition cursor-pointer border ${
                  isSelected
                    ? 'bg-purple-500/25 border-purple-500/60 text-purple-200 shadow-sm'
                    : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {lang === 'th' ? pill.labelTh : pill.labelEn}
              </button>
            );
          })}
        </div>

        {/* Queue Items Grid */}
        {displayedQueueItems.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-[#0d131f]/60 p-10 text-center space-y-2">
            <Crown className="w-8 h-8 mx-auto text-slate-600 opacity-60" />
            <div className="text-slate-400 font-semibold text-xs">
              {queueItems.length === 0
                ? t.noQueueItems
                : (lang === 'th' ? 'ไม่พบคิวไอเทมที่ตรงกับเงื่อนไขค้นหา' : 'No queue items matching your filter')}
            </div>
            {queueItems.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setQueueSearchQuery('');
                  setQueueRarityFilter('all');
                }}
                className="text-[11px] text-purple-400 hover:text-purple-300 underline cursor-pointer"
              >
                {lang === 'th' ? 'ล้างตัวกรองทั้งหมด' : 'Clear all filters'}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {displayedQueueItems.map((q) => {
              const isExpanded = !!expandedQueues[q.id];
              const pendingList = q.queueList.filter((m) => m.status !== 'received');
              const receivedList = q.queueList.filter((m) => m.status === 'received');
              const displayedMembers = isExpanded ? q.queueList : q.queueList.slice(0, 3);

              return (
                <div
                  key={q.id}
                  className={`p-4 rounded-2xl bg-gradient-to-b from-[#101728] to-[#090e18] border border-slate-800/90 hover:border-purple-500/50 transition-all duration-200 flex flex-col justify-between gap-3 shadow-xl ${getRarityBorder(
                    q.rarity
                  )}`}
                >
                  <div>
                    {/* Top Header: Image, Title, Rarity */}
                    <div className="flex items-start gap-3">
                      {q.imageUrl ? (
                        <button
                          type="button"
                          onClick={() => {
                            sounds.playClick();
                            onViewImage?.(q.imageUrl, q.name);
                          }}
                          title={t.zoomImage}
                          className="shrink-0 relative group cursor-pointer"
                        >
                          <img
                            src={q.imageUrl}
                            alt={q.name}
                            className="w-13 h-13 rounded-xl object-cover border border-slate-700 group-hover:border-[#d4af37] transition-all shadow-md group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 rounded-xl flex items-center justify-center transition">
                            <Eye className="w-3.5 h-3.5 text-white drop-shadow" />
                          </div>
                        </button>
                      ) : (
                        <div className="w-13 h-13 rounded-xl bg-[#151d2f] border border-dashed border-slate-700 flex items-center justify-center text-[10px] text-slate-500 text-center p-1 shrink-0">
                          {t.waitingForImage}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1.5">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-100 truncate" title={q.name}>
                            {q.name}
                          </h4>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded border shrink-0 ${getRarityBadge(
                              q.rarity
                            )}`}
                          >
                            {q.rarity}
                          </span>
                        </div>

                        {/* Counts summary badge */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            {q.queueList.length} {lang === 'th' ? 'คน' : 'total'}
                          </span>
                          {pendingList.length > 0 && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              {pendingList.length} {lang === 'th' ? 'รอรับ' : 'waiting'}
                            </span>
                          )}
                          {receivedList.length > 0 && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              {receivedList.length} {lang === 'th' ? 'ได้รับแล้ว' : 'received'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Members In Queue List */}
                    <div className="mt-3">
                      {q.queueList.length === 0 ? (
                        <div className="p-2.5 rounded-xl bg-[#060a12] border border-slate-800/80 text-center text-[11px] text-slate-500">
                          {lang === 'th' ? 'ยังไม่มีรายชื่อในคิว' : 'No members queued yet'}
                        </div>
                      ) : (
                        <div className={`space-y-1 ${isExpanded ? 'max-h-56 overflow-y-auto pr-1' : ''}`}>
                          {displayedMembers.map((m, idx) => (
                            <div
                              key={m.id || idx}
                              className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-[#070c16] border border-slate-800/50 hover:border-slate-700/60 transition-colors"
                            >
                              <div className="flex items-center gap-1.5 truncate min-w-0 pr-1">
                                <span className="text-[10px] font-mono text-purple-400 font-bold shrink-0">
                                  #{idx + 1}
                                </span>
                                <span className="text-slate-200 font-medium truncate text-xs">
                                  {m.name}
                                </span>
                                <span className="text-[10px] text-slate-400 shrink-0">
                                  ({m.clan})
                                </span>
                              </div>
                              <span
                                className={`text-[9px] px-1.5 py-0.2 rounded font-semibold shrink-0 ${
                                  m.status === 'received'
                                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                    : 'bg-amber-950 text-amber-400 border border-amber-800'
                                }`}
                              >
                                {m.status === 'received' ? t.statusReceived : t.statusPending}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Expand / Collapse Toggle Button */}
                  {q.queueList.length > 3 && (
                    <div className="pt-2 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => toggleExpandQueue(q.id)}
                        className="w-full py-1 text-[11px] font-semibold text-purple-300 hover:text-purple-200 bg-purple-950/30 hover:bg-purple-900/40 rounded-lg border border-purple-800/30 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        {isExpanded ? (
                          <>
                            <span>{lang === 'th' ? 'ย่อรายการ' : 'Show less'}</span>
                            <ChevronUp className="w-3.5 h-3.5" />
                          </>
                        ) : (
                          <>
                            <span>
                              {lang === 'th'
                                ? `+ดูคิวทั้งหมด (อีก ${q.queueList.length - 3} คน)`
                                : `+Show full queue (${q.queueList.length - 3} more)`}
                            </span>
                            <ChevronDown className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* IN-APP CONFIRM DELETE ACTIVE ITEM MODAL */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-2xl bg-gradient-to-b from-[#181015] via-[#100a0e] to-[#080507] border border-red-500/50 shadow-[0_20px_60px_rgba(0,0,0,0.95),0_0_30px_rgba(239,68,68,0.25)] p-6 text-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/50 text-red-400 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  {lang === 'th' ? 'ยืนยันการลบไอเทม' : 'Confirm Delete Item'}
                </h3>
                <p className="text-xs text-red-400/90 font-medium">
                  {lang === 'th' ? 'การกระทำนี้จะลบไอเทมนี้ออกจากรายการรอแจก' : 'Permanently removes this active item'}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300 mb-5 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">{t.itemName}:</span>
                <span className="font-bold text-slate-100">{itemToDelete.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{t.rarity}:</span>
                <span className="font-semibold text-amber-300">{itemToDelete.rarity}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-600 transition-all cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                id="btn-confirm-delete-active-item"
                onClick={() => {
                  sounds.playClick();
                  if (onDeleteItem) onDeleteItem(itemToDelete.id);
                  setItemToDelete(null);
                }}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-xs shadow-lg shadow-red-900/50 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{lang === 'th' ? 'ยืนยันลบ' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STAT UPDATE REQUIRED MODAL
         ───────────────────────────────────────────────────────────── */}
      {statWarningModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-gradient-to-b from-[#18151f] via-[#100e17] to-[#09080d] border border-amber-500/50 shadow-[0_20px_60px_rgba(0,0,0,0.95),0_0_30px_rgba(245,158,11,0.2)] p-6 text-slate-200">
            {/* Modal Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-400 shrink-0">
                {isUserStatsPending(currentUser) ? (
                  <Clock className="w-6 h-6 animate-pulse" />
                ) : (
                  <AlertTriangle className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold font-cinzel text-amber-300">
                  {t.statsRequiredModalTitle}
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  {isUserStatsPending(currentUser) ? t.statsPendingBadge : (lang === 'th' ? 'ต้องระบุข้อมูลสเตตัส' : 'Stat Verification Needed')}
                </p>
              </div>
            </div>

            {/* Target Item Overview */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300 mb-4 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">{t.itemName}:</span>
                <span className="font-bold text-slate-100">{statWarningModalItem.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{t.itemMinPower}:</span>
                <span className="font-mono font-bold text-amber-400">⚡ {Number(statWarningModalItem.minPowerLevel || 0).toLocaleString()} PL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'th' ? 'ค่าพลังของคุณขณะนี้:' : 'Your Current Power:'}</span>
                <span className="font-mono text-slate-400">⚡ {Number(currentUser?.powerLevel || 0).toLocaleString()} PL</span>
              </div>
            </div>

            {/* Reassurance/Instruction Callout */}
            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-200/90 mb-5 leading-relaxed">
              {isUserStatsPending(currentUser)
                ? t.statsPendingModalDesc
                : t.statsRequiredModalDesc}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                id="btn-close-stat-required-modal"
                onClick={() => setStatWarningModalItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-600 transition-all cursor-pointer"
              >
                {t.close}
              </button>
              {!isUserStatsPending(currentUser) && (
                <button
                  type="button"
                  id="btn-modal-go-update-stats"
                  onClick={() => {
                    sounds.playClick();
                    setStatWarningModalItem(null);
                    onNavigateTab('my_stats');
                  }}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#aa841c] hover:brightness-110 text-slate-950 font-bold text-xs shadow-lg shadow-amber-900/40 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t.goToUpdateStats}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
