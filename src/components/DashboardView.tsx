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
  X,
  Trash2,
  Eye,
  RotateCcw,
  History,
  Clock
} from 'lucide-react';
import {
  ActiveTab,
  DiamondVaultRecord,
  ItemRarity,
  Language,
  QueueItem,
  User,
  VaultItem
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
  const isAdminOrOwner =
    currentUser?.role === 'owner' ||
    currentUser?.role === 'admin' ||
    currentUser?.role === 'manager';

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
              className="w-full sm:w-56 md:w-60 rounded-xl bg-gradient-to-b from-[#111927] to-[#0a0f18] border border-[#38bdf8]/40 p-4 shadow-2xl relative flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-[#0284c7]/20 border border-[#38bdf8]/40 text-[#38bdf8]">
                      <Gem className="w-4 h-4 group-hover:scale-110 transition-transform" />
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
                  <Sparkles className="w-3.5 h-3.5 text-[#38bdf8] animate-pulse" />
                </div>

                <div className="flex items-baseline gap-1.5 my-2">
                  <span className="text-2xl sm:text-3xl font-extrabold font-mono text-[#38bdf8] drop-shadow-md">
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
                  className="w-full py-1.5 px-2.5 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                >
                  <ArrowDownCircle className="w-3.5 h-3.5" />
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

          <div className="flex items-center gap-2">
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

        {availableItems.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-[#0d131f]/60 p-6 text-center text-slate-400 space-y-1.5">
            <p className="text-xs sm:text-sm font-medium">{t.noAvailableItems}</p>
            {isAdminOrOwner && (
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
                  {availableItems.map((item) => {
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
                    const userPower = Number(currentUser?.powerLevel || 0);
                    const hasEnoughPower = isPrivileged || userPower >= Number(item.minPowerLevel || 0);

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
                          <div className="flex items-center gap-1 font-mono font-bold text-xs sm:text-sm text-[#38bdf8]">
                            <Gem className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
                            <span>{item.price.toLocaleString()}</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {t.diamonds}
                            </span>
                          </div>
                        </td>

                        {/* 4. Min Power (CP) */}
                        <td className="py-1.5 px-3">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 font-mono font-bold text-xs text-amber-300">
                              <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                              <span>{item.minPowerLevel.toLocaleString()} CP</span>
                            </div>
                            {currentUser && (
                              <div className="text-[9px]">
                                {hasEnoughPower ? (
                                  <span className="text-emerald-400 font-medium">
                                    ✓ {t.eligibleToClaim} ({userPower.toLocaleString()} CP)
                                  </span>
                                ) : (
                                  <span className="text-red-400 font-medium">
                                    ✗ {t.insufficientPower} ({userPower.toLocaleString()} CP)
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
                                    ? 'btn-l2m-gold text-slate-950 font-bold shadow-md cursor-pointer'
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

      {/* 3. ITEM QUEUE PREVIEW (คิวไอเทมบนแดชบอร์ด) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold font-cinzel text-slate-100 flex items-center gap-2">
                <span>{t.queueTitle}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 font-mono">
                  {queueItems.length}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'th'
                  ? 'ลำดับคิวรับไอเทม'
                  : 'Item queue distribution list'}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sounds.playClick();
              onNavigateTab('queue');
            }}
            className="text-xs font-semibold text-[#f5d77f] hover:text-white flex items-center gap-1 transition-colors"
          >
            <span>{t.tabQueue}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {queueItems.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-[#0d131f]/60 p-8 text-center text-slate-500 text-xs">
            {t.noQueueItems}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {queueItems.slice(0, 4).map((q) => (
              <div
                key={q.id}
                className="p-4 rounded-xl bg-[#0d1422] border border-slate-800 hover:border-purple-800/40 transition-all flex items-start gap-3.5"
              >
                {q.imageUrl ? (
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      onViewImage?.(q.imageUrl, q.name);
                    }}
                    title={t.zoomImage}
                    className="shrink-0"
                  >
                    <img
                      src={q.imageUrl}
                      alt={q.name}
                      className="w-14 h-14 rounded-lg object-cover border border-slate-700 hover:border-[#d4af37] transition-colors"
                    />
                  </button>
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-[#151d2f] border border-dashed border-slate-700 flex items-center justify-center text-[10px] text-slate-500 text-center p-1 shrink-0">
                    {t.waitingForImage}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-200 truncate">
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

                  <div className="mt-2 space-y-1">
                    {q.queueList.slice(0, 3).map((m, idx) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between text-xs py-0.5 px-2 rounded bg-[#080d16]"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-[10px] font-mono text-slate-500 font-bold">
                            #{idx + 1}
                          </span>
                          <span className="text-slate-200 font-medium truncate">
                            {m.name}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            ({m.clan})
                          </span>
                        </div>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                            m.status === 'received'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}
                        >
                          {m.status === 'received' ? t.statusReceived : t.statusPending}
                        </span>
                      </div>
                    ))}
                    {q.queueList.length > 3 && (
                      <p className="text-[10px] text-slate-500 text-center">
                        +{q.queueList.length - 3} {lang === 'th' ? 'คน' : 'more'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
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

    </div>
  );
};
