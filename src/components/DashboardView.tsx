import React from 'react';
import {
  Gem,
  Trophy,
  Medal,
  Award,
  UserCheck,
  Layers,
  ExternalLink,
  Bookmark,
  ArrowDownCircle,
  ArrowUpCircle,
  Gift,
  CheckCircle,
  Check,
  Lock,
  Zap,
  Users,
  Sparkles,
  ShieldAlert,
  Crown,
  LayoutGrid,
  List,
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
  AlertCircle,
  Edit2,
  Edit3,
  Megaphone,
  MessageSquare,
  Database
} from 'lucide-react';
import {
  ActiveTab,
  DiamondVaultRecord,
  ItemRarity,
  Language,
  QueueItem,
  QuickItem,
  GeneralItem,
  User,
  VaultItem,
  ClanGroup,
  QueueAnnouncementSettings,
  cleanClanName,
  hasUserUpdatedStats,
  isUserStatsPending
} from '../types';
import { translations } from '../translations';
import { sounds } from '../utils/sound';
import { calculateDiamondNetChange } from '../utils/diamondHelper';
import { GeneralItemQueueCard } from './GeneralItemQueueCard';

interface DashboardViewProps {
  lang: Language;
  currentUser: User | null;
  vaultBalance: number;
  transactions?: DiamondVaultRecord[];
  onOpenVaultModal: () => void;
  availableItems: VaultItem[];
  queueItems: QueueItem[];
  quickItems?: QuickItem[];
  generalItems?: GeneralItem[];
  onAddGeneralItem?: (item: Omit<GeneralItem, 'id' | 'createdAt'>) => Promise<void>;
  onUpdateGeneralItem?: (id: string, updates: Partial<Omit<GeneralItem, 'id' | 'createdAt'>>) => Promise<void>;
  onDeleteGeneralItem?: (id: string) => Promise<void>;
  onRecordDiamondLog?: (record: Omit<DiamondVaultRecord, 'id' | 'timestamp'>) => Promise<void>;
  allMembers?: User[];
  distributedItems?: VaultItem[];
  clans?: ClanGroup[];
  onClaimItem: (itemId: string) => Promise<void>;
  onUnclaimItem?: (itemId: string) => Promise<void>;
  onViewClaimants?: (item: VaultItem) => void;
  onOpenDistributeModal: (item: VaultItem) => void;
  onNavigateTab: (tab: ActiveTab) => void;
  onOpenAuth: () => void;
  onViewImage?: (url: string, title?: string) => void;
  onOpenOwnerResetModal?: () => void;
  onDeleteItem?: (itemId: string) => void;
  onEditItem?: (item: VaultItem) => void;
  onBroadcastToDiscord?: (item: VaultItem) => Promise<void>;
  isQuotaExceeded?: boolean;
  onOpenGoogleBackupModal?: () => void;
  onCheckFirebaseHealth?: () => void;
  onConfirmPayment?: (item: VaultItem, targetStatus?: 'pending' | 'paid') => void;
  queueAnnouncement?: QueueAnnouncementSettings | null;
  onSaveQueueAnnouncement?: (settings: QueueAnnouncementSettings) => Promise<void>;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  lang,
  currentUser,
  vaultBalance,
  transactions = [],
  onOpenVaultModal,
  availableItems,
  queueItems,
  quickItems = [],
  generalItems = [],
  onAddGeneralItem,
  onUpdateGeneralItem,
  onDeleteGeneralItem,
  onRecordDiamondLog,
  allMembers = [],
  distributedItems = [],
  clans = [],
  onClaimItem,
  onUnclaimItem,
  onViewClaimants,
  onOpenDistributeModal,
  onNavigateTab,
  onOpenAuth,
  onViewImage,
  onOpenOwnerResetModal,
  onDeleteItem,
  onEditItem,
  onBroadcastToDiscord,
  isQuotaExceeded = false,
  onOpenGoogleBackupModal,
  onCheckFirebaseHealth,
  onConfirmPayment,
  queueAnnouncement,
  onSaveQueueAnnouncement,
  showToast
}) => {
  const t = translations[lang];
  const isOwner = currentUser?.role === 'owner';
  const isAdmin = currentUser?.role === 'admin' || isOwner;
  const canEditAnnouncement = isOwner || currentUser?.role === 'admin';

  // Queue Announcement editing modal state
  const [isEditAnnouncementOpen, setIsEditAnnouncementOpen] = React.useState(false);
  const [announcementTextTh, setAnnouncementTextTh] = React.useState('');
  const [announcementTextEn, setAnnouncementTextEn] = React.useState('');
  const [announcementEnabled, setAnnouncementEnabled] = React.useState(true);
  const [isSavingAnnouncement, setIsSavingAnnouncement] = React.useState(false);

  const activeAnnouncement: QueueAnnouncementSettings = queueAnnouncement || {
    textTh: '📢 สมาชิกที่ต้องการขอรับไอเทม กรุณาติดต่อ Admin เพื่อเพิ่มรายชื่อลงในคิว',
    textEn: '📢 Members who wish to receive items, please contact an Admin to be added to the queue.',
    enabled: true
  };

  const handleOpenEditAnnouncement = () => {
    sounds.playClick();
    setAnnouncementTextTh(activeAnnouncement.textTh);
    setAnnouncementTextEn(activeAnnouncement.textEn);
    setAnnouncementEnabled(activeAnnouncement.enabled);
    setIsEditAnnouncementOpen(true);
  };

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveQueueAnnouncement) return;
    setIsSavingAnnouncement(true);
    sounds.playClick();
    try {
      await onSaveQueueAnnouncement({
        textTh: announcementTextTh.trim() || '📢 สมาชิกที่ต้องการขอรับไอเทม กรุณาติดต่อ Admin เพื่อเพิ่มรายชื่อลงในคิว',
        textEn: announcementTextEn.trim() || '📢 Members who wish to receive items, please contact an Admin to be added to the queue.',
        enabled: announcementEnabled,
        updatedBy: currentUser?.inGameName || currentUser?.username || 'Owner',
        updatedAt: Date.now()
      });
      sounds.playSuccess();
      setIsEditAnnouncementOpen(false);
      if (showToast) {
        showToast(lang === 'th' ? 'บันทึกข้อความประกาศคิวสำเร็จแล้ว' : 'Queue announcement saved successfully', 'success');
      }
    } catch (err: any) {
      console.error(err);
      if (showToast) {
        showToast(lang === 'th' ? 'บันทึกประกาศไม่สำเร็จ' : 'Failed to save announcement', 'error');
      }
    } finally {
      setIsSavingAnnouncement(false);
    }
  };
  const [broadcastingItemId, setBroadcastingItemId] = React.useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = React.useState<VaultItem | null>(null);
  const [statWarningModalItem, setStatWarningModalItem] = React.useState<VaultItem | null>(null);
  const [filterAvailableToMe, setFilterAvailableToMe] = React.useState(false);
  const [claimableViewMode, setClaimableViewMode] = React.useState<'grid' | 'table'>(() => {
    try {
      const saved = localStorage.getItem('l2m_claimable_view_mode');
      if (saved === 'grid' || saved === 'table') return saved;
    } catch {}
    return 'grid';
  });
  const [queueSearchQuery, setQueueSearchQuery] = React.useState('');
  const [queueRarityFilter, setQueueRarityFilter] = React.useState<string>('all');
  const [expandedQueues, setExpandedQueues] = React.useState<Record<string, boolean>>({});

  // Toggle show all states for the 3 compact cards
  const [showAllUserQueues, setShowAllUserQueues] = React.useState(false);
  const [showAllUserClaims, setShowAllUserClaims] = React.useState(false);
  const [showAllLeaderboard, setShowAllLeaderboard] = React.useState(false);
  const [showAllDistributions, setShowAllDistributions] = React.useState(false);

  // Clan Filter for Top Power Leaderboard
  const [leaderboardClanFilter, setLeaderboardClanFilter] = React.useState<string>('all');

  // Members for Leaderboard (5 by default, expandable to all)
  const allLeaderboardMembers = React.useMemo(() => {
    const list = (allMembers || []).filter((m) => m.status === 'active' && (m.powerLevel || 0) > 0);
    const filtered =
      leaderboardClanFilter === 'all'
        ? list
        : list.filter((m) => cleanClanName(m.clan).toLowerCase() === leaderboardClanFilter.toLowerCase());
    return [...filtered].sort((a, b) => (b.powerLevel || 0) - (a.powerLevel || 0));
  }, [allMembers, leaderboardClanFilter]);

  const displayedLeaderboardMembers = React.useMemo(() => {
    return showAllLeaderboard ? allLeaderboardMembers : allLeaderboardMembers.slice(0, 5);
  }, [allLeaderboardMembers, showAllLeaderboard]);

  // Unique Clans list for leaderboard filter (case-insensitive deduplication)
  const availableClansList = React.useMemo(() => {
    const map = new Map<string, string>();
    (allMembers || []).forEach((m) => {
      const c = cleanClanName(m.clan);
      if (c && !map.has(c.toLowerCase())) {
        map.set(c.toLowerCase(), c);
      }
    });
    return Array.from(map.values());
  }, [allMembers]);

  // Recent Distributed Items for Feed (5 by default, expandable to all)
  const allDistributedList = React.useMemo(() => {
    return [...(distributedItems || [])].sort((a, b) => {
      const timeA = a.distributedTo?.distributedAt || a.createdAt || 0;
      const timeB = b.distributedTo?.distributedAt || b.createdAt || 0;
      return timeB - timeA;
    });
  }, [distributedItems]);

  const displayedDistributedList = React.useMemo(() => {
    return showAllDistributions ? allDistributedList : allDistributedList.slice(0, 5);
  }, [allDistributedList, showAllDistributions]);

  // Current User's Rank in their Clan
  const userRankInClan = React.useMemo(() => {
    if (!currentUser) return null;
    const userClan = cleanClanName(currentUser.clan);
    const clanMembers = (allMembers || [])
      .filter((m) => m.status === 'active' && cleanClanName(m.clan) === userClan)
      .sort((a, b) => (b.powerLevel || 0) - (a.powerLevel || 0));
    const index = clanMembers.findIndex(
      (m) => m.id === currentUser.id || m.inGameName?.toLowerCase() === currentUser.inGameName?.toLowerCase()
    );
    return index !== -1 ? { rank: index + 1, total: clanMembers.length, clanName: userClan } : null;
  }, [currentUser, allMembers]);

  // Current User's Active Item Claims
  const userActiveClaims = React.useMemo(() => {
    if (!currentUser) return [];
    return (availableItems || []).filter((item) =>
      item.claimants?.some(
        (c) =>
          (c.userId && c.userId === currentUser.id) ||
          (c.inGameName &&
            currentUser.inGameName &&
            c.inGameName.trim().toLowerCase() === currentUser.inGameName.trim().toLowerCase())
      )
    );
  }, [currentUser, availableItems]);

  // Current User's Queue Positions
  const userQueues = React.useMemo(() => {
    if (!currentUser) return [];
    const results: { item: QueueItem; rank: number; totalWaiting: number }[] = [];
    (queueItems || []).forEach((q) => {
      const pendingList = q.queueList.filter((m) => m.status !== 'received');
      const rankIdx = pendingList.findIndex(
        (m) =>
          (m.userId && m.userId === currentUser.id) ||
          (m.name && currentUser.inGameName && m.name.trim().toLowerCase() === currentUser.inGameName.trim().toLowerCase())
      );
      if (rankIdx !== -1) {
        results.push({ item: q, rank: rankIdx + 1, totalWaiting: pendingList.length });
      }
    });
    return results;
  }, [currentUser, queueItems]);


  const toggleExpandQueue = (queueId: string) => {
    sounds.playClick();
    setExpandedQueues((prev) => ({
      ...prev,
      [queueId]: !prev[queueId]
    }));
  };

  const isAdminOrOwner =
    currentUser?.role === 'owner' ||
    currentUser?.role === 'admin';

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
        return 'bg-amber-500/25 text-amber-200 border-[#ffb800] glow-mythic';
      case 'LAGEND':
        return 'bg-[#8500fd]/25 text-[#e0b0ff] border-[#8500fd] glow-legend';
      case 'EPIC':
        return 'bg-red-500/25 text-red-200 border-[#ff1744] glow-epic';
      case 'RARE':
      default:
        return 'bg-cyan-500/25 text-cyan-200 border-[#00e5ff] glow-rare';
    }
  };

  const getRarityBorder = (r: ItemRarity) => {
    switch (r) {
      case 'MYTHIC':
        return 'border-[#ffb800]/80 hover:border-[#ffb800] shadow-[0_0_15px_rgba(255,184,0,0.4)] hover:shadow-[0_0_28px_rgba(255,184,0,0.8)]';
      case 'LAGEND':
        return 'border-[#8500fd]/85 hover:border-[#8500fd] shadow-[0_0_16px_rgba(133,0,253,0.5)] hover:shadow-[0_0_30px_rgba(133,0,253,0.9)]';
      case 'EPIC':
        return 'border-[#ff1744]/80 hover:border-[#ff1744] shadow-[0_0_15px_rgba(255,23,68,0.4)] hover:shadow-[0_0_28px_rgba(255,23,68,0.8)]';
      case 'RARE':
      default:
        return 'border-[#00e5ff]/80 hover:border-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.4)] hover:shadow-[0_0_28px_rgba(0,229,255,0.8)]';
    }
  };

  const getRarityTextGlow = (r: ItemRarity) => {
    switch (r) {
      case 'MYTHIC':
        return 'font-glow-mythic';
      case 'LAGEND':
        return 'font-glow-legend';
      case 'EPIC':
        return 'font-glow-epic';
      case 'RARE':
      default:
        return 'font-glow-rare';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* 1. CLAN HUB COMMAND CENTER - TOP-LEFT DIAMOND VAULT & COMPACT COMMAND GRID */}
      <section className="relative rounded-2xl overflow-hidden l2m-panel border border-[#d4af37]/30 p-2.5 sm:p-3.5 lg:p-4 space-y-2.5 sm:space-y-3">
        <div className="absolute -right-16 -top-16 w-80 h-80 bg-gradient-to-bl from-[#d4af37]/15 via-[#38bdf8]/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        
        {/* ─────────────────────────────────────────────────────────────
            ROW 1: TOP ROW (50 / 50 SPLIT - ZERO EMPTY SPACE, COMPACT)
            Left: Diamond Reserve Vault (เพชร บนมุมซ้าย)
            Right: Lineage 2M Clan Hub & Alliance Overview (ลดขนาด)
           ───────────────────────────────────────────────────────────── */}
        <div className="relative z-10 grid grid-cols-1 xl:grid-cols-2 gap-2.5 sm:gap-3 items-stretch">
          
          {/* TOP-LEFT BOX: CLAN RESERVE VAULT & ACTIVITY TIMELINE */}
          <div
            id="diamond-vault-card"
            className="rounded-xl bg-gradient-to-b from-[#111827] via-[#0c121d] to-[#070b12] border border-[#38bdf8]/35 hover:border-[#38bdf8]/60 p-2.5 sm:p-3 shadow-md flex flex-col justify-between transition-all relative overflow-hidden group min-h-[155px]"
          >
            <div className="absolute -right-8 -top-8 w-24 h-24 bg-sky-500/10 rounded-full blur-xl pointer-events-none" />

            <div>
              {/* Card Header */}
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80 mb-2">
                <div className="flex items-center gap-1.5">
                  <div className="p-1 rounded-md bg-gradient-to-br from-sky-500/20 to-sky-950/40 border border-sky-500/40 text-sky-300 shadow-sm">
                    <Gem className="w-3.5 h-3.5 text-sky-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.6)]" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold font-cinzel text-slate-100 flex items-center gap-1">
                      <span>{t.diamondVault}</span>
                    </h3>
                    <p className="text-[10px] sm:text-xs text-slate-300">
                      {lang === 'th' ? 'กองทุนเพชรกลางกิลด์' : 'Clan Reserve Vault'}
                    </p>
                  </div>
                </div>

                {isAdminOrOwner ? (
                  <button
                    id="btn-dash-vault-manage"
                    onClick={() => {
                      sounds.playClick();
                      onOpenVaultModal();
                    }}
                    className="py-1 px-2.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-sky-200 hover:text-white text-[11px] font-bold transition-all flex items-center gap-1 shadow cursor-pointer shrink-0"
                  >
                    <ArrowDownCircle className="w-3 h-3 text-sky-400" />
                    <span>{t.deposit} / {t.withdraw}</span>
                  </button>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
                    {lang === 'th' ? 'กองทุนกลาง' : 'Clan Pool'}
                  </span>
                )}
              </div>

              {/* Sub-grid: Balance on Left + Activity Timeline on Right */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 items-center">
                {/* Balance Area (2 cols) */}
                <div className="sm:col-span-2 p-2 rounded-lg bg-[#090e18] border border-slate-800/80 flex flex-col justify-center space-y-1">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase font-cinzel flex items-center gap-1">
                    <span>{lang === 'th' ? 'ยอดเพชรคงเหลือ' : 'Vault Balance'}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl sm:text-2xl font-extrabold font-mono text-white drop-shadow">
                      💎 {vaultBalance.toLocaleString()}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      onOpenVaultModal();
                    }}
                    className="text-[10px] sm:text-[11px] text-[#38bdf8] hover:text-white flex items-center gap-0.5 font-medium transition-colors cursor-pointer w-fit"
                  >
                    <span>{lang === 'th' ? 'ดูประวัติทั้งหมด' : 'View Ledger'}</span>
                    <ChevronRight className="w-2.5 h-2.5" />
                  </button>
                </div>

                {/* Timeline Area (3 cols) */}
                <div className="sm:col-span-3 space-y-1">
                  <div className="flex items-center justify-between px-0.5">
                    <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-300 font-cinzel">
                      <History className="w-3 h-3 text-amber-400" />
                      <span>{lang === 'th' ? 'ธุรกรรมล่าสุด' : 'Recent Activity'}</span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                      {(transactions || []).length} {lang === 'th' ? 'รายการ' : 'records'}
                    </span>
                  </div>

                  <div className="h-[75px] overflow-y-auto pr-1 relative space-y-1">
                    {(!transactions || transactions.length === 0) ? (
                      <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-[10px] py-1.5">
                        <Clock className="w-3.5 h-3.5 mb-0.5 text-slate-500" />
                        <span>{lang === 'th' ? 'ยังไม่มีประวัติธุรกรรมเพชร' : 'No transactions yet'}</span>
                      </div>
                    ) : (
                      <div className="relative pl-2.5 space-y-1 before:absolute before:left-1 before:top-1 before:bottom-1 before:w-[2px] before:bg-slate-800">
                        {transactions.slice(0, 3).map((tx) => {
                          const netChange = calculateDiamondNetChange(tx);
                          const isCredit = tx.type === 'credit' || tx.type === 'deposit';
                          const isDeduct = tx.type === 'deduction' || tx.type === 'withdraw';
                          const isExpenditure = tx.type === 'expenditure';
                          const isAdjust = tx.type === 'adjust';

                          let dotColor = 'bg-emerald-400 ring-emerald-500/20';
                          let textColor = 'text-emerald-400';
                          let prefix = '+';

                          if (isCredit) {
                            dotColor = 'bg-emerald-400 ring-emerald-500/20';
                            textColor = 'text-emerald-400';
                            prefix = '+';
                          } else if (isDeduct) {
                            dotColor = 'bg-rose-400 ring-rose-500/20';
                            textColor = 'text-rose-400';
                            prefix = '-';
                          } else if (isExpenditure) {
                            dotColor = 'bg-violet-400 ring-violet-500/20';
                            textColor = 'text-violet-400';
                            prefix = '-';
                          } else if (isAdjust) {
                            dotColor = 'bg-amber-400 ring-amber-500/20';
                            textColor = 'text-amber-400';
                            prefix = netChange >= 0 ? '+' : '-';
                          } else {
                            const isPositive = netChange >= 0;
                            dotColor = isPositive ? 'bg-emerald-400 ring-emerald-500/20' : 'bg-rose-400 ring-rose-500/20';
                            textColor = isPositive ? 'text-emerald-400' : 'text-rose-400';
                            prefix = isPositive ? '+' : '-';
                          }

                          const adminLabel = lang === 'th' ? 'แอดมิน' : 'Admin';
                          const performerName = tx.performedBy?.name || adminLabel;

                          return (
                            <div key={tx.id} className="relative flex items-center justify-between gap-1 text-[11px]">
                              <div
                                className={`absolute -left-2.5 top-1.5 w-1.5 h-1.5 rounded-full ring-1 ${dotColor}`}
                              />
                              <div className="min-w-0 flex-1 pl-1 truncate">
                                <span className={`font-mono font-bold text-[11px] mr-1 ${textColor}`}>
                                  {prefix}{Math.abs(netChange).toLocaleString()} 💎
                                </span>
                                <span
                                  className="text-[10px] text-slate-300 truncate"
                                  title={tx.note ? `${tx.note} (${performerName})` : performerName}
                                >
                                  <strong className="text-slate-200 font-semibold">{performerName}</strong>
                                  {tx.note && (
                                    <span className="text-slate-400 font-normal ml-1">· {tx.note}</span>
                                  )}
                                </span>
                              </div>
                              <span className="text-[9px] text-slate-400 shrink-0 font-mono">
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
          </div>

          {/* TOP-RIGHT BOX: ALLIANCE COMMAND & METRICS BANNER (REDUCED SIZE) */}
          <div className="rounded-xl bg-gradient-to-b from-[#111827] via-[#0c121d] to-[#070b12] border border-[#d4af37]/35 hover:border-[#d4af37]/60 p-2.5 sm:p-3 shadow-md flex flex-col justify-between transition-all relative overflow-hidden group min-h-[155px]">
            <div className="absolute -right-8 -top-8 w-24 h-24 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />

            <div>
              {/* Card Header */}
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80 mb-2">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 text-[11px] font-semibold text-[#f5d77f]">
                  <Crown className="w-3 h-3 text-amber-400" />
                  <span>LINEAGE 2M • CLAN HUB</span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {/* Database / Server Status Badge */}
                  {isOwner && onOpenGoogleBackupModal ? (
                    <button
                      type="button"
                      id="btn-dashboard-db-status"
                      onClick={() => {
                        sounds.playClick();
                        onOpenGoogleBackupModal();
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all cursor-pointer shadow-sm ${
                        isQuotaExceeded
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25 animate-pulse'
                          : 'bg-sky-500/15 border-sky-500/40 text-sky-300 hover:bg-sky-500/25'
                      }`}
                      title={
                        lang === 'th'
                          ? (isQuotaExceeded ? 'ฐานข้อมูล: Google Sheets (โควต้า Firebase เต็ม) • คลิกเพื่อจัดการ' : 'ฐานข้อมูล: Firebase Cloud (ปกติ) • คลิกเพื่อจัดการ')
                          : (isQuotaExceeded ? 'DB: Google Sheets (Quota Exceeded) • Click to manage' : 'DB: Firebase Cloud (Normal) • Click to manage')
                      }
                      aria-label={lang === 'th' ? 'สถานะเซิร์ฟเวอร์' : 'Server Status'}
                    >
                      <Database className={`w-3 h-3 ${isQuotaExceeded ? 'text-amber-400' : 'text-sky-400'}`} />
                      <span>{isQuotaExceeded ? 'Google Sheets' : 'Firebase'}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${isQuotaExceeded ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                    </button>
                  ) : (
                    <div
                      id="dashboard-db-status-readonly"
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border select-none cursor-default ${
                        isQuotaExceeded
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                          : 'bg-sky-500/10 border-sky-500/30 text-sky-300'
                      }`}
                      title={
                        lang === 'th'
                          ? (isQuotaExceeded ? 'ฐานข้อมูล: Google Sheets (โควต้า Firebase เต็ม)' : 'ฐานข้อมูล: Firebase Cloud (ปกติ)')
                          : (isQuotaExceeded ? 'DB: Google Sheets (Quota Exceeded)' : 'DB: Firebase Cloud (Normal)')
                      }
                    >
                      <Database className={`w-3 h-3 ${isQuotaExceeded ? 'text-amber-400' : 'text-sky-400'}`} />
                      <span>{isQuotaExceeded ? 'Google Sheets' : 'Firebase'}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${isQuotaExceeded ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                    </div>
                  )}

                  {/* Online Status */}
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-[10px] text-emerald-300 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{lang === 'th' ? 'ระบบออนไลน์' : 'Online'}</span>
                  </div>
                </div>
              </div>

              {/* Title & Subtitle + 4 Stat Tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 items-center">
                {/* Branding Left (2 cols) */}
                <div className="sm:col-span-2 space-y-0.5">
                  <h1 className="text-base sm:text-lg font-extrabold font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-[#fff2b8] via-[#e6be44] to-[#b8860b] leading-tight">
                    {t.appTitle}
                  </h1>
                  <p className="text-[11px] text-slate-300 leading-normal line-clamp-2">
                    {t.appSubtitle}
                  </p>
                </div>

                {/* 4 Metrics Matrix (3 cols) */}
                <div className="sm:col-span-3 grid grid-cols-2 gap-1.5">
                  {/* Active Members */}
                  <div className="p-1.5 rounded-lg bg-[#090e18] border border-slate-800/80 flex items-center gap-1.5">
                    <div className="p-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
                      <Users className="w-3 h-3" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-xs text-slate-100 leading-none">
                        {(allMembers || []).filter((m) => m.status === 'active').length}
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5 truncate">
                        {lang === 'th' ? 'สมาชิกทั้งหมด' : 'Members'}
                      </div>
                    </div>
                  </div>

                  {/* Total Clans */}
                  <div className="p-1.5 rounded-lg bg-[#090e18] border border-slate-800/80 flex items-center gap-1.5">
                    <div className="p-1 rounded bg-purple-500/10 border border-purple-500/30 text-purple-400 shrink-0">
                      <ShieldAlert className="w-3 h-3" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-xs text-slate-100 leading-none">
                        {availableClansList.length}
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5 truncate">
                        {lang === 'th' ? 'แคลนพันธมิตร' : 'Clans'}
                      </div>
                    </div>
                  </div>

                  {/* Claimable Items */}
                  <div className="p-1.5 rounded-lg bg-[#090e18] border border-slate-800/80 flex items-center gap-1.5">
                    <div className="p-1 rounded bg-sky-500/10 border border-sky-500/30 text-sky-400 shrink-0">
                      <Sparkles className="w-3 h-3" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-xs text-sky-300 leading-none">
                        {(availableItems || []).length}
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5 truncate">
                        {lang === 'th' ? 'ไอเทมเปิดรับ' : 'Claimable'}
                      </div>
                    </div>
                  </div>

                  {/* Total Queues Joined */}
                  <div className="p-1.5 rounded-lg bg-[#090e18] border border-slate-800/80 flex items-center gap-1.5">
                    <div className="p-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0">
                      <Zap className="w-3 h-3" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-xs text-emerald-300 leading-none">
                        {(queueItems || []).length}
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5 truncate">
                        {lang === 'th' ? 'คิวเปิดรอรับ' : 'Active Queues'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ─────────────────────────────────────────────────────────────
            ROW 2: BOTTOM 3 COMPACT BALANCED CARDS (REDUCED SIZES)
            (1. My Clan Status | 2. Top Power Leaderboard | 3. Recent Distributions)
           ───────────────────────────────────────────────────────────── */}
        <div className="relative z-10 pt-1.5 border-t border-[#d4af37]/20 grid grid-cols-1 lg:grid-cols-3 gap-2.5 sm:gap-3 items-stretch">
          
          {/* BOX 1: MY CLAN STATUS (REDUCED SIZE) */}
          <div className="rounded-xl bg-gradient-to-b from-[#111827] via-[#0c121d] to-[#070b12] border border-[#d4af37]/30 hover:border-[#d4af37]/50 p-2.5 sm:p-3 shadow-md flex flex-col justify-between transition-all relative overflow-hidden group min-h-[225px]">
            <div className="absolute -right-8 -top-8 w-24 h-24 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
            
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="p-1 rounded-md bg-gradient-to-br from-amber-500/20 to-amber-950/40 border border-amber-500/40 text-amber-400 shadow-sm">
                    <UserCheck className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold font-cinzel text-slate-100 flex items-center gap-1">
                      <span>{t.myClanStatusTitle}</span>
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      {t.myClanStatusDesc}
                    </p>
                  </div>
                </div>

                {currentUser && (
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      onNavigateTab('my_stats');
                    }}
                    className="text-[11px] text-amber-300 hover:text-white flex items-center gap-0.5 px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all font-semibold cursor-pointer"
                    title={t.tabMyStats}
                  >
                    <span>{t.tabMyStats}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>

              {/* Logged in vs Guest */}
              {currentUser ? (
                <div className="space-y-1.5">
                  {/* Profile Banner */}
                  <div className="flex items-center justify-between p-1.5 rounded-lg bg-[#090e18] border border-slate-800/80">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#d4af37]/30 via-slate-800 to-slate-900 border border-[#d4af37]/50 flex items-center justify-center font-bold text-amber-300 font-cinzel shrink-0 shadow-inner text-xs">
                        {(currentUser.inGameName || currentUser.username || 'M')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-xs font-bold text-slate-100 truncate">
                            {currentUser.inGameName || currentUser.username}
                          </span>
                          <span className="text-[9px] px-1 py-0.2 rounded font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/40 uppercase">
                            {currentUser.role}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <span className="font-semibold text-slate-300">{cleanClanName(currentUser.clan)}</span>
                          <span>•</span>
                          <span className="truncate">{currentUser.characterClass || 'Adventurer'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Power Level Badge */}
                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-xs text-amber-300 flex items-center gap-0.5 justify-end drop-shadow">
                        <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span>{Number(currentUser.powerLevel || 0).toLocaleString()} PL</span>
                      </div>
                      {userRankInClan ? (
                        <span className="text-[9px] text-slate-300 font-medium">
                          {lang === 'th' ? `อันดับ #${userRankInClan.rank} ใน ${userRankInClan.clanName}` : `Rank #${userRankInClan.rank} in ${userRankInClan.clanName}`}
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-400">
                          {isUserStatsPending(currentUser) ? `⏳ ${t.myPowerStatusPending}` : `✓ ${t.myPowerStatusVerified}`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Sub-block: Queues Waiting (คิวไอเทมที่รอรับ - 5 rows max then scroll) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                      <span className="flex items-center gap-1 text-slate-200">
                        <Crown className="w-3 h-3 text-purple-400" />
                        <span>{t.myQueuePositions}</span>
                      </span>
                      <span className="text-[10px] font-mono px-1.5 rounded-full bg-slate-800 text-purple-300 border border-slate-700">
                        {userQueues.length}
                      </span>
                    </div>

                    {userQueues.length === 0 ? (
                      <div className="p-1.5 rounded bg-[#070b14] border border-slate-800/60 text-[10px] text-slate-400 text-center italic">
                        {t.noQueuesJoined}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className={`space-y-1 ${showAllUserQueues ? 'max-h-[220px] overflow-y-auto pr-0.5 custom-scrollbar' : ''}`}>
                          {(showAllUserQueues ? userQueues : userQueues.slice(0, 5)).map(({ item, rank, totalWaiting }) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between p-1 rounded bg-[#080d18] border border-slate-800/70 hover:border-purple-500/40 transition-colors text-[11px]"
                            >
                              <span className="text-slate-200 font-medium truncate pr-1 text-[11px]">
                                {item.name}
                              </span>
                              <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 rounded-full bg-purple-950/70 border border-purple-500/50 text-purple-300 shrink-0">
                                #{rank} / {totalWaiting}
                              </span>
                            </div>
                          ))}
                        </div>
                        {userQueues.length > 5 && (
                          <button
                            type="button"
                            onClick={() => {
                              sounds.playClick();
                              setShowAllUserQueues((prev) => !prev);
                            }}
                            className="w-full py-1 px-2 rounded-md bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 hover:border-purple-500/50 text-purple-300 hover:text-purple-200 text-[10px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer"
                          >
                            {showAllUserQueues ? (
                              <>
                                <ChevronUp className="w-3 h-3 text-purple-400" />
                                <span>{lang === 'th' ? 'แสดงแค่ 5 รายการแรก' : 'Show 5 Items Only'}</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-3 h-3 text-purple-400" />
                                <span>{lang === 'th' ? `ดูทั้งหมด (${userQueues.length} รายการ)` : `View All (${userQueues.length} Items)`}</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Sub-block: Active Claims (ไอเทมที่ลงชื่อรอแจก - 5 rows max then scroll) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                      <span className="flex items-center gap-1 text-slate-200">
                        <Bookmark className="w-3 h-3 text-sky-400" />
                        <span>{t.myActiveClaims}</span>
                      </span>
                      <span className="text-[10px] font-mono px-1.5 rounded-full bg-slate-800 text-sky-300 border border-slate-700">
                        {userActiveClaims.length}
                      </span>
                    </div>

                    {userActiveClaims.length === 0 ? (
                      <div className="p-1.5 rounded bg-[#070b14] border border-slate-800/60 text-[10px] text-slate-400 text-center italic">
                        {t.noActiveClaims}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className={`space-y-1 ${showAllUserClaims ? 'max-h-[220px] overflow-y-auto pr-0.5 custom-scrollbar' : ''}`}>
                          {(showAllUserClaims ? userActiveClaims : userActiveClaims.slice(0, 5)).map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between p-1 rounded bg-[#080d18] border border-slate-800/70 hover:border-sky-500/40 transition-colors text-[11px]"
                            >
                              <div className="flex items-center gap-1.5 min-w-0 pr-1">
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="w-7 h-7 rounded-lg object-cover border border-slate-700 shrink-0 shadow-sm"
                                />
                                <span className="text-slate-100 font-medium truncate text-[11px]">{item.name}</span>
                                <span className="text-[9px] font-bold font-mono px-1 rounded bg-emerald-950/70 border border-emerald-500/50 text-emerald-300">
                                  x{item.quantity || 1}
                                </span>
                              </div>
                              {item.price > 0 ? (
                                <span className="text-[11px] font-mono text-amber-300 shrink-0 font-bold">
                                  💎 {item.price.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-[11px] font-bold text-emerald-400 shrink-0">
                                  🎁 {t.itemFree || (lang === 'th' ? 'ฟรี' : 'Free')}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                        {userActiveClaims.length > 5 && (
                          <button
                            type="button"
                            onClick={() => {
                              sounds.playClick();
                              setShowAllUserClaims((prev) => !prev);
                            }}
                            className="w-full py-1 px-2 rounded-md bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 hover:border-sky-500/50 text-sky-300 hover:text-sky-200 text-[10px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer"
                          >
                            {showAllUserClaims ? (
                              <>
                                <ChevronUp className="w-3 h-3 text-sky-400" />
                                <span>{lang === 'th' ? 'แสดงแค่ 5 รายการแรก' : 'Show 5 Items Only'}</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-3 h-3 text-sky-400" />
                                <span>{lang === 'th' ? `ดูทั้งหมด (${userActiveClaims.length} รายการ)` : `View All (${userActiveClaims.length} Items)`}</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-5 text-center space-y-2">
                  <Lock className="w-5 h-5 mx-auto text-amber-400" />
                  <p className="text-[11px] text-slate-300">
                    {lang === 'th' ? 'เข้าสู่ระบบเพื่อดูสถานะของคุณ' : 'Log in to view your status'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      onOpenAuth();
                    }}
                    className="px-3 py-1 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#aa841c] text-slate-950 font-bold text-[11px] shadow cursor-pointer"
                  >
                    {t.loginBtn}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* BOX 2: TOP POWER LEADERBOARD (REDUCED SIZE) */}
          <div className="rounded-xl bg-gradient-to-b from-[#111827] via-[#0c121d] to-[#070b12] border border-[#a855f7]/30 hover:border-[#a855f7]/50 p-2.5 sm:p-3 shadow-md flex flex-col justify-between transition-all relative overflow-hidden group min-h-[225px]">
            <div className="absolute -right-8 -top-8 w-24 h-24 bg-purple-500/10 rounded-full blur-xl pointer-events-none" />

            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="p-1 rounded-md bg-gradient-to-br from-yellow-500/20 to-amber-950/40 border border-amber-500/40 text-amber-300 shadow-sm">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold font-cinzel text-slate-100 flex items-center gap-1">
                      <span>{t.leaderboardTitle}</span>
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      {t.leaderboardDesc}
                    </p>
                  </div>
                </div>

                <span className="text-[10px] font-bold text-amber-400 flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/30">
                  <Crown className="w-2.5 h-2.5" />
                  <span>
                    {showAllLeaderboard
                      ? (lang === 'th' ? `ทั้งหมด (${allLeaderboardMembers.length})` : `ALL (${allLeaderboardMembers.length})`)
                      : 'TOP 5'}
                  </span>
                </span>
              </div>

              {/* Clan Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-1.5 no-scrollbar text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setLeaderboardClanFilter('all');
                  }}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer shrink-0 border ${
                    leaderboardClanFilter === 'all'
                      ? 'bg-purple-500 text-slate-950 border-purple-400 font-bold shadow-sm'
                      : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {t.topAllClans}
                </button>
                {availableClansList.map((clanName) => (
                  <button
                    key={clanName}
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setLeaderboardClanFilter(clanName);
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer shrink-0 border ${
                      leaderboardClanFilter.toLowerCase() === clanName.toLowerCase()
                        ? 'bg-purple-500 text-slate-950 border-purple-400 font-bold shadow-sm'
                        : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {clanName}
                  </button>
                ))}
              </div>

              {/* Top 5 / All Members List */}
              {allLeaderboardMembers.length === 0 ? (
                <div className="py-5 text-center text-[11px] text-slate-400 space-y-1">
                  <Trophy className="w-5 h-5 mx-auto text-slate-600 opacity-60" />
                  <p>{lang === 'th' ? 'ไม่พบข้อมูลสมาชิกในแคลนนี้' : 'No verified members found'}</p>
                </div>
              ) : (
                <>
                  <div className={`space-y-1 ${showAllLeaderboard ? 'max-h-[360px] sm:max-h-[420px] overflow-y-auto pr-0.5 custom-scrollbar' : ''}`}>
                    {displayedLeaderboardMembers.map((m, idx) => {
                      const isCurrentUser =
                        currentUser &&
                        (m.id === currentUser.id ||
                          m.inGameName?.toLowerCase() === currentUser.inGameName?.toLowerCase());
                      const medalBadge =
                        idx === 0
                          ? '🥇'
                          : idx === 1
                          ? '🥈'
                          : idx === 2
                          ? '🥉'
                          : `#${idx + 1}`;

                      return (
                        <div
                          key={m.id || idx}
                          className={`flex items-center justify-between p-1 sm:p-1.5 rounded-lg border transition-all text-xs ${
                            isCurrentUser
                              ? 'bg-purple-950/40 border-purple-500/60 shadow-sm ring-1 ring-purple-500/30'
                              : idx === 0
                              ? 'bg-gradient-to-r from-amber-950/30 to-[#090e18] border-amber-500/40 shadow-sm'
                              : 'bg-[#090e18] border-slate-800/80 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 pr-1">
                            <div
                              className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[10px] shrink-0 font-mono ${
                                idx === 0
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                                  : idx === 1
                                  ? 'bg-slate-300/20 text-slate-200 border border-slate-400/40'
                                  : idx === 2
                                  ? 'bg-amber-700/20 text-amber-400 border border-amber-700/40'
                                  : 'bg-slate-800/80 text-slate-400 border border-slate-700/50 text-[9px]'
                              }`}
                            >
                              {medalBadge}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1 flex-wrap">
                                <span
                                  className={`font-bold truncate text-xs ${
                                    isCurrentUser ? 'text-purple-200' : idx === 0 ? 'text-amber-200' : 'text-slate-100'
                                  }`}
                                >
                                  {m.inGameName || m.username}
                                </span>
                                {isCurrentUser && (
                                  <span className="text-[8px] font-bold px-1 py-0.2 rounded bg-purple-500/30 text-purple-300 border border-purple-400/40">
                                    {lang === 'th' ? 'คุณ' : 'You'}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                <span className="font-semibold text-slate-300">{cleanClanName(m.clan)}</span>
                                <span>•</span>
                                <span className="truncate">{m.characterClass || 'Adventurer'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Power Level */}
                          <div className="text-right shrink-0">
                            <div className="font-mono font-bold text-xs text-amber-300 flex items-center gap-0.5 justify-end drop-shadow">
                              <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
                              <span>{Number(m.powerLevel || 0).toLocaleString()}</span>
                            </div>
                            <span className="text-[9px] text-slate-400 font-mono">PL</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {allLeaderboardMembers.length > 5 && (
                    <button
                      type="button"
                      onClick={() => {
                        sounds.playClick();
                        setShowAllLeaderboard((prev) => !prev);
                      }}
                      className="w-full mt-2 py-1.5 px-2 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/35 hover:border-purple-500/60 text-purple-300 hover:text-purple-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm shrink-0"
                    >
                      {showAllLeaderboard ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5 text-purple-400" />
                          <span>{lang === 'th' ? 'แสดงแค่ 5 อันดับแรก' : 'Show Top 5 Only'}</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5 text-purple-400" />
                          <span>{lang === 'th' ? `ดูทั้งหมด (${allLeaderboardMembers.length} คน)` : `View All (${allLeaderboardMembers.length} Members)`}</span>
                        </>
                      )}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* BOX 3: RECENT DISTRIBUTION FEED (EXPAND TO FILL BOX HEIGHT BEFORE SCROLLING) */}
          <div className="rounded-xl bg-gradient-to-b from-[#111827] via-[#0c121d] to-[#070b12] border border-[#38bdf8]/30 hover:border-[#38bdf8]/50 p-2.5 sm:p-3 shadow-md flex flex-col transition-all relative overflow-hidden group min-h-[225px]">
            <div className="absolute -right-8 -top-8 w-24 h-24 bg-sky-500/10 rounded-full blur-xl pointer-events-none" />

            <div className="flex flex-col flex-1 min-h-0">
              {/* Header */}
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80 mb-1.5 shrink-0">
                <div className="flex items-center gap-1.5">
                  <div className="p-1 rounded-md bg-gradient-to-br from-sky-500/20 to-sky-950/40 border border-sky-500/40 text-sky-400 shadow-sm">
                    <Gift className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold font-cinzel text-slate-100 flex items-center gap-1">
                      <span>{t.recentDistributionsTitle}</span>
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      {t.recentDistributionsDesc}
                    </p>
                  </div>
                </div>

                <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-sky-950/70 text-sky-300 border border-sky-500/40 font-bold">
                  {distributedItems.length} {lang === 'th' ? 'ชิ้น' : 'items'}
                </span>
              </div>

              {/* List */}
              {allDistributedList.length === 0 ? (
                <div className="py-5 text-center text-[11px] text-slate-400 space-y-1 my-auto">
                  <Gift className="w-5 h-5 mx-auto text-slate-600 opacity-60" />
                  <p>{t.noRecentDistributions}</p>
                </div>
              ) : (
                <>
                  <div className={`space-y-1 overflow-y-auto pr-0.5 custom-scrollbar flex-1 min-h-0 ${showAllDistributions ? 'max-h-[360px] sm:max-h-[420px]' : 'max-h-[280px] sm:max-h-[320px]'}`}>
                    {displayedDistributedList.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-1.5 rounded-lg bg-[#090e18] border border-slate-800/80 hover:border-sky-500/30 transition-all text-xs group/item"
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-1">
                          <button
                            type="button"
                            onClick={() => {
                              sounds.playClick();
                              onViewImage?.(item.imageUrl, item.name);
                            }}
                            className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg overflow-hidden border border-slate-700 group-hover/item:border-sky-400 shrink-0 cursor-pointer shadow-sm relative transition-all"
                            title={t.zoomImage}
                          >
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          </button>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="font-bold text-slate-100 text-xs truncate max-w-[120px]">
                                {item.name}
                              </span>
                              <span className="text-[9px] font-mono font-bold px-1 rounded bg-emerald-950/70 border border-emerald-500/50 text-emerald-300">
                                x{item.quantity || 1}
                              </span>
                              <span
                                className={`text-[8px] font-bold px-1 py-0.2 rounded border uppercase ${getRarityBadge(
                                  item.rarity
                                )}`}
                              >
                                {item.rarity}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.2">
                              <span>{t.distributedToMember}</span>
                              <strong className="text-amber-300 font-semibold truncate max-w-[90px]">
                                {item.distributedTo?.name || 'Member'}
                              </strong>
                              {item.distributedTo?.clan && (
                                <span className="text-slate-400 truncate">
                                  ({cleanClanName(item.distributedTo.clan)})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                          <div className="text-xs font-mono font-bold text-white">
                            {item.price > 0 ? `💎 ${item.price.toLocaleString()}` : `🎁 ${t.itemFree || (lang === 'th' ? 'ฟรี' : 'Free')}`}
                          </div>

                          {/* Payment Status for non-free distributed item (Status only, no button on dashboard) */}
                          {item.price > 0 && (
                            <div className="flex items-center gap-1 my-0.5 justify-end">
                              {item.paymentStatus === 'paid' ? (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                                  title={
                                    lang === 'th'
                                      ? `ชำระแล้ว ${item.paidBy ? `(ยืนยันโดย ${item.paidBy})` : ''}`
                                      : `Paid ${item.paidBy ? `(verified by ${item.paidBy})` : ''}`
                                  }
                                >
                                  <CheckCircle className="w-2.5 h-2.5 text-emerald-400" />
                                  <span>{t.paymentStatusPaid || (lang === 'th' ? 'ชำระแล้ว' : 'Paid')}</span>
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm animate-pulse"
                                  title={lang === 'th' ? 'รอการชำระเพชร' : 'Pending diamond payment'}
                                >
                                  <Clock className="w-2.5 h-2.5 text-amber-400" />
                                  <span>{t.paymentStatusPending || (lang === 'th' ? 'รอชำระ' : 'Pending Payment')}</span>
                                </span>
                              )}
                            </div>
                          )}

                          <div className="text-[9px] text-slate-400 font-mono mt-0.2">
                            {formatTimeAgo(item.distributedTo?.distributedAt || item.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {allDistributedList.length > 5 && (
                    <button
                      type="button"
                      onClick={() => {
                        sounds.playClick();
                        setShowAllDistributions((prev) => !prev);
                      }}
                      className="w-full mt-2 py-1.5 px-2 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 hover:border-sky-500/60 text-sky-300 hover:text-sky-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm shrink-0"
                    >
                      {showAllDistributions ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5 text-sky-400" />
                          <span>{lang === 'th' ? 'แสดงแค่ 5 รายการแรก' : 'Show 5 Items Only'}</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5 text-sky-400" />
                          <span>{lang === 'th' ? `ดูทั้งหมด (${allDistributedList.length} รายการ)` : `View All (${allDistributedList.length} Items)`}</span>
                        </>
                      )}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

        </div>
      </section>

      {/* Announcement Banner for Item Queue (Moved to Dashboard) */}
      {(activeAnnouncement.enabled || canEditAnnouncement) && (
        <div className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          activeAnnouncement.enabled
            ? 'bg-gradient-to-r from-[#191508]/90 via-[#231b0a]/90 to-[#120f06]/90 border-[#d4af37]/45 shadow-[0_0_20px_rgba(212,175,55,0.12)]'
            : 'bg-slate-900/60 border-dashed border-slate-700/60 opacity-60'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#d4af37]/20 to-[#8c6b12]/20 border border-[#d4af37]/40 text-[#f5d77f] shrink-0 shadow-md">
              <Megaphone className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/40 text-[#f5d77f] font-mono tracking-wider uppercase">
                  {lang === 'th' ? 'ประกาศจากกิลด์' : 'ANNOUNCEMENT'}
                </span>
                {!activeAnnouncement.enabled && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                    {lang === 'th' ? 'ซ่อนอยู่ (ปิดใช้งาน)' : 'Hidden (Disabled)'}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm font-semibold text-slate-100 mt-1 leading-relaxed">
                {lang === 'th' ? activeAnnouncement.textTh : activeAnnouncement.textEn}
              </p>
            </div>
          </div>

          {canEditAnnouncement && (
            <button
              type="button"
              id="btn-edit-queue-announcement"
              onClick={handleOpenEditAnnouncement}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1f2838] hover:bg-[#28354a] border border-[#d4af37]/40 hover:border-[#d4af37] text-[#f5d77f] hover:text-white text-xs font-bold transition-all shadow cursor-pointer shrink-0 self-start sm:self-center group"
              title={lang === 'th' ? 'แก้ไขข้อความประกาศ (เฉพาะ Owner/Admin)' : 'Edit Announcement (Owner/Admin)'}
            >
              <Edit3 className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
              <span>{lang === 'th' ? 'แก้ไขประกาศ' : 'Edit Announcement'}</span>
            </button>
          )}
        </div>
      )}

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
            {/* View Mode Switcher: Cards vs Table */}
            <div className="flex items-center p-1 rounded-xl bg-[#090d16] border border-slate-800 shadow-inner">
              <button
                type="button"
                id="btn-claimable-view-grid"
                onClick={() => {
                  sounds.playClick();
                  setClaimableViewMode('grid');
                  try { localStorage.setItem('l2m_claimable_view_mode', 'grid'); } catch {}
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  claimableViewMode === 'grid'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow font-black'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
                title={lang === 'th' ? 'แสดงแบบการ์ด (Card View)' : 'Card View (Grid)'}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>{lang === 'th' ? 'การ์ด' : 'Cards'}</span>
              </button>
              <button
                type="button"
                id="btn-claimable-view-table"
                onClick={() => {
                  sounds.playClick();
                  setClaimableViewMode('table');
                  try { localStorage.setItem('l2m_claimable_view_mode', 'table'); } catch {}
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  claimableViewMode === 'table'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow font-black'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
                title={lang === 'th' ? 'แสดงแบบตารางแนวนอน (Table View)' : 'Table View'}
              >
                <List className="w-3.5 h-3.5" />
                <span>{lang === 'th' ? 'ตาราง' : 'Table'}</span>
              </button>
            </div>
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
        {currentUser && !isAdminOrOwner && !hasUserUpdatedStats(currentUser) && (
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
                className="text-xs text-amber-400 hover:underline cursor-pointer"
              >
                {lang === 'th' ? 'แสดงไอเทมทั้งหมด' : 'Show all items'}
              </button>
            ) : isAdminOrOwner && (
              <button
                onClick={() => onNavigateTab('vault')}
                className="text-xs text-[#f5d77f] hover:underline cursor-pointer"
              >
                + {t.addNewItem}
              </button>
            )}
          </div>
        ) : (
          <div className="max-h-[640px] overflow-y-auto pr-1 custom-scrollbar">
            {claimableViewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
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
                  <div
                    key={item.id}
                    className={`p-2 sm:p-2.5 rounded-xl bg-gradient-to-b from-[#101726] via-[#0c121e] to-[#070b14] border border-[#23314f] hover:border-[#d4af37]/60 transition-all duration-200 flex items-center gap-2 sm:gap-2.5 shadow-md group relative overflow-hidden min-w-0 ${getRarityBorder(
                      item.rarity
                    )}`}
                  >
                    {/* Left: Thumbnail Image */}
                    <button
                      type="button"
                      onClick={() => {
                        sounds.playClick();
                        onViewImage?.(item.imageUrl, item.name);
                      }}
                      title={t.zoomImage}
                      className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border bg-[#080d18] cursor-pointer shadow-md group-hover:scale-105 transition-transform block shrink-0 ${getRarityBorder(
                        item.rarity
                      )}`}
                    >
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Eye className="w-3.5 h-3.5 text-white drop-shadow" />
                      </div>
                    </button>

                    {/* Right: Exactly 2 Lines per item */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between gap-1 sm:gap-1.5">
                      {/* Line 1: [Rarity] Item Name xQty + Price */}
                      <div className="flex items-center justify-between gap-1.5 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0 truncate">
                          <span
                            className={`text-[8px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider shrink-0 ${getRarityBadge(
                              item.rarity
                            )}`}
                          >
                            {item.rarity}
                          </span>
                          <h4
                            className={`text-xs font-bold text-slate-100 group-hover:brightness-125 transition-all truncate ${getRarityTextGlow(
                              item.rarity
                            )}`}
                            title={item.name}
                          >
                            {item.name}
                          </h4>
                          {item.quantity && item.quantity > 1 && (
                            <span className="text-[9px] font-bold font-mono px-1 py-0.2 rounded bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 shrink-0">
                              x{item.quantity}
                            </span>
                          )}
                        </div>

                        {/* Price */}
                        <div className="shrink-0 ml-1">
                          {item.price > 0 ? (
                            <div className="flex items-center gap-0.5 font-mono font-bold text-xs text-white">
                              <Gem className="w-3 h-3 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.7)] shrink-0" />
                              <span>{item.price.toLocaleString()}</span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-950/70 border border-emerald-500/50 text-emerald-300">
                              🎁 {t.itemFree || (lang === 'th' ? 'ฟรี' : 'Free')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Line 2: Min PL + Claimants + Action Buttons */}
                      <div className="flex flex-wrap items-center justify-between gap-x-1.5 gap-y-1 min-w-0">
                        {/* Left: Min Power (PL) & Claimants Count */}
                        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 min-w-0">
                          <div
                            className="flex items-center gap-0.5 text-[9.5px] sm:text-[10px] font-mono shrink-0"
                            title={`Min Power: ${item.minPowerLevel.toLocaleString()} PL`}
                          >
                            <Zap className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                            <span className="text-amber-300 font-bold">{item.minPowerLevel.toLocaleString()}</span>
                            {currentUser && (
                              <span className="text-[8.5px] ml-0.5 font-bold">
                                {hasEnoughPower ? (
                                  <span
                                    className="text-emerald-400"
                                    title={`⚡ ${userPower.toLocaleString()} PL: ${lang === 'th' ? 'ถึงเกณฑ์' : 'Eligible'}`}
                                  >
                                    ✓
                                  </span>
                                ) : (
                                  <span
                                    className="text-red-400"
                                    title={`⚡ ${userPower.toLocaleString()} PL: ${lang === 'th' ? 'ไม่ถึงเกณฑ์' : 'Low PL'}`}
                                  >
                                    ✗
                                  </span>
                                )}
                              </span>
                            )}
                          </div>

                          {/* Claimants Button */}
                          <button
                            type="button"
                            id={`btn-view-claimants-${item.id}`}
                            onClick={() => {
                              sounds.playClick();
                              if (onViewClaimants) onViewClaimants(item);
                            }}
                            className="inline-flex items-center gap-0.5 px-1 sm:px-1.5 py-0.5 rounded bg-[#0d1524] hover:bg-[#16243d] border border-slate-700/60 hover:border-sky-500/60 text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm text-[9.5px] sm:text-[10px] group/btn shrink-0"
                            title={lang === 'th' ? 'คลิกดูรายชื่อผู้ลงชื่อเครม' : 'Click to view claimants list'}
                          >
                            <Users className="w-2.5 h-2.5 text-sky-400 group-hover/btn:scale-110 transition-transform shrink-0" />
                            <span className="font-bold text-sky-300 font-mono">
                              {item.claimants?.length || 0}
                            </span>
                            <span className="text-[8.5px] text-slate-400 hidden xs:inline">
                              {lang === 'th' ? 'คน' : 'p'}
                            </span>
                          </button>
                        </div>

                        {/* Right: Action Buttons */}
                        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                          {!currentUser ? (
                            <button
                              onClick={() => {
                                sounds.playClick();
                                onOpenAuth();
                              }}
                              className="px-1.5 sm:px-2 py-0.5 rounded bg-[#1a2538] hover:bg-[#233149] text-[9.5px] sm:text-[10px] font-bold text-[#f5d77f] border border-[#d4af37]/30 transition-all cursor-pointer whitespace-nowrap"
                            >
                              {t.login}
                            </button>
                          ) : hasClaimed ? (
                            <div className="flex items-center gap-0.5 shrink-0">
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-700/50 text-emerald-300 text-[9px] sm:text-[10px] font-bold whitespace-nowrap">
                                <CheckCircle className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                                <span>{lang === 'th' ? 'ขอรับแล้ว' : 'Claimed'}</span>
                              </span>
                              {onUnclaimItem && (
                                <button
                                  type="button"
                                  id={`btn-unclaim-dashboard-${item.id}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    sounds.playClick();
                                    onUnclaimItem(item.id);
                                  }}
                                  className="p-1 rounded bg-red-950/70 hover:bg-red-900 border border-red-800/70 text-red-300 hover:text-white text-[10px] font-semibold transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
                                  title={t.cancelClaimBtn}
                                >
                                  <X className="w-2.5 h-2.5 text-red-400" />
                                </button>
                              )}
                            </div>
                          ) : !hasStats && !isPrivileged ? (
                            <button
                              id={`btn-claim-${item.id}`}
                              onClick={() => {
                                sounds.playClick();
                                setStatWarningModalItem(item);
                              }}
                              className="px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold transition-all flex items-center gap-0.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 shadow-sm cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
                              title={isStatsPendingState ? t.statsPendingBadge : t.updateStatsFirst}
                            >
                              {isStatsPendingState ? (
                                <>
                                  <Clock className="w-2.5 h-2.5 text-amber-400 animate-pulse shrink-0" />
                                  <span>{lang === 'th' ? 'รออนุมัติ' : 'Pending'}</span>
                                </>
                              ) : (
                                <>
                                  <AlertCircle className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                  <span>{lang === 'th' ? 'สเตตัสก่อน' : 'Need Stats'}</span>
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
                              className={`px-1.5 sm:px-2 py-0.5 rounded text-[9.5px] sm:text-[10px] font-bold transition-all flex items-center gap-0.5 whitespace-nowrap shrink-0 ${
                                hasEnoughPower
                                  ? 'btn-l2m-gold text-slate-950 font-bold shadow-sm cursor-pointer active:scale-95'
                                  : 'bg-slate-800/60 text-slate-500 border border-slate-700/40 cursor-not-allowed'
                              }`}
                            >
                              {hasEnoughPower ? (
                                <>
                                  <Sparkles className="w-2.5 h-2.5 shrink-0" />
                                  <span>{lang === 'th' ? 'ขอรับ' : 'Claim'}</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="w-2.5 h-2.5 shrink-0" />
                                  <span>{lang === 'th' ? 'พลังไม่ถึง' : 'Low PL'}</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* Admin / Owner Mini Action Toolbar */}
                          {isAdminOrOwner && (
                            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-md bg-slate-900/90 border border-slate-700/60 shrink-0 shadow-inner">
                              {/* Distribute Button */}
                              <button
                                id={`btn-distribute-${item.id}`}
                                onClick={() => {
                                  sounds.playClick();
                                  onOpenDistributeModal(item);
                                }}
                                className="p-1 rounded hover:bg-sky-600/30 text-sky-400 hover:text-sky-200 transition-all cursor-pointer shrink-0"
                                title={t.distributeItemBtn}
                              >
                                <Gift className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                              </button>

                              {/* Edit Button */}
                              {onEditItem && (
                                <button
                                  id={`btn-edit-active-item-${item.id}`}
                                  onClick={() => {
                                    sounds.playClick();
                                    onEditItem(item);
                                  }}
                                  className="p-1 rounded hover:bg-amber-500/30 text-amber-400 hover:text-amber-200 transition-all cursor-pointer shrink-0"
                                  title={t.editItem}
                                >
                                  <Edit2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                </button>
                              )}

                              {/* Owner Discord Broadcast Button */}
                              {isOwner && onBroadcastToDiscord && (
                                <button
                                  id={`btn-discord-broadcast-${item.id}`}
                                  disabled={broadcastingItemId === item.id}
                                  onClick={async () => {
                                    sounds.playClick();
                                    setBroadcastingItemId(item.id);
                                    try {
                                      await onBroadcastToDiscord(item);
                                    } finally {
                                      setBroadcastingItemId(null);
                                    }
                                  }}
                                  className="p-1 rounded hover:bg-[#5865F2]/35 text-[#8ea1e1] hover:text-white transition-all cursor-pointer disabled:opacity-50 shrink-0"
                                  title={t.sendToDiscord || (lang === 'th' ? 'ส่งไป Discord' : 'Send to Discord')}
                                >
                                  <MessageSquare className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                </button>
                              )}

                              {/* Delete Active Item Button */}
                              {onDeleteItem && (
                                <button
                                  id={`btn-delete-active-item-${item.id}`}
                                  onClick={() => {
                                    sounds.playClick();
                                    setItemToDelete(item);
                                  }}
                                  className="p-1 rounded hover:bg-red-900/50 text-red-400 hover:text-red-200 transition-all cursor-pointer shrink-0"
                                  title={lang === 'th' ? 'ลบไอเทมนี้' : 'Delete item'}
                                >
                                  <Trash2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-800/80 bg-[#090e18]/90 shadow-xl backdrop-blur">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-[#0c1322] text-slate-400 uppercase text-[11px] tracking-wider font-cinzel">
                      <th className="py-3 px-3 w-16 text-center">{lang === 'th' ? 'รูป' : 'Image'}</th>
                      <th className="py-3 px-3">{lang === 'th' ? 'ชื่อไอเทม & ระดับ' : 'Item & Rarity'}</th>
                      <th className="py-3 px-3 text-center">{lang === 'th' ? 'ราคาเพชร' : 'Price'}</th>
                      <th className="py-3 px-3 text-center">{lang === 'th' ? 'พลังขั้นต่ำ (PL)' : 'Min PL'}</th>
                      <th className="py-3 px-3 text-center">{lang === 'th' ? 'ผู้ขอรับ' : 'Claimants'}</th>
                      <th className="py-3 px-3 text-center">{lang === 'th' ? 'สถานะ / ขอรับ' : 'Claim Status'}</th>
                      {isAdminOrOwner && (
                        <th className="py-3 px-3 text-center">{lang === 'th' ? 'จัดการ' : 'Actions'}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
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
                          className="hover:bg-slate-800/30 transition-colors group"
                        >
                          {/* Col 1: Image Thumbnail with zoom */}
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                sounds.playClick();
                                onViewImage?.(item.imageUrl, item.name);
                              }}
                              title={t.zoomImage}
                              className={`relative w-11 h-11 mx-auto rounded-lg overflow-hidden border bg-[#080d18] cursor-pointer shadow group-hover:scale-105 transition-transform block ${getRarityBorder(
                                item.rarity
                              )}`}
                            >
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Eye className="w-3 h-3 text-white drop-shadow" />
                              </div>
                            </button>
                          </td>

                          {/* Col 2: Name & Rarity */}
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-[8.5px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider shrink-0 ${getRarityBadge(
                                  item.rarity
                                )}`}
                              >
                                {item.rarity}
                              </span>
                              <span
                                className={`text-xs font-bold text-slate-100 group-hover:brightness-125 transition-all ${getRarityTextGlow(
                                  item.rarity
                                )}`}
                              >
                                {item.name}
                              </span>
                              {item.quantity && item.quantity > 1 && (
                                <span className="text-[9px] font-bold font-mono px-1 py-0.2 rounded bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 shrink-0">
                                  x{item.quantity}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Col 3: Price */}
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            {item.price > 0 ? (
                              <div className="inline-flex items-center gap-1 font-mono font-bold text-xs text-white">
                                <Gem className="w-3 h-3 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.7)]" />
                                <span>{item.price.toLocaleString()}</span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/70 border border-emerald-500/50 text-emerald-300">
                                🎁 {t.itemFree || (lang === 'th' ? 'ฟรี' : 'Free')}
                              </span>
                            )}
                          </td>

                          {/* Col 4: Min PL */}
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-1 text-[11px] font-mono">
                              <Zap className="w-3 h-3 text-amber-400" />
                              <span className="text-amber-300 font-bold">{item.minPowerLevel.toLocaleString()}</span>
                              {currentUser && (
                                <span className="text-[9px] font-bold">
                                  {hasEnoughPower ? (
                                    <span className="text-emerald-400" title={lang === 'th' ? 'พลังถึงเกณฑ์' : 'Eligible'}>✓</span>
                                  ) : (
                                    <span className="text-red-400" title={lang === 'th' ? 'พลังไม่ถึงเกณฑ์' : 'Low PL'}>✗</span>
                                  )}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Col 5: Claimants */}
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              id={`btn-table-view-claimants-${item.id}`}
                              onClick={() => {
                                sounds.playClick();
                                if (onViewClaimants) onViewClaimants(item);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#0d1524] hover:bg-[#16243d] border border-slate-700/60 hover:border-sky-500/60 text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm text-xs group/btn"
                              title={lang === 'th' ? 'คลิกดูรายชื่อผู้ลงชื่อเครม' : 'Click to view claimants list'}
                            >
                              <Users className="w-3 h-3 text-sky-400 group-hover/btn:scale-110 transition-transform" />
                              <span className="font-bold text-sky-300 font-mono">
                                {item.claimants?.length || 0}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {lang === 'th' ? 'คน' : 'p'}
                              </span>
                            </button>
                          </td>

                          {/* Col 6: Claim Status / Action */}
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            {!currentUser ? (
                              <button
                                onClick={() => {
                                  sounds.playClick();
                                  onOpenAuth();
                                }}
                                className="px-2.5 py-1 rounded-lg bg-[#1a2538] hover:bg-[#233149] text-xs font-bold text-[#f5d77f] border border-[#d4af37]/30 transition-all cursor-pointer"
                              >
                                {t.login}
                              </button>
                            ) : hasClaimed ? (
                              <div className="inline-flex items-center gap-1">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-700/50 text-emerald-300 text-xs font-bold">
                                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                                  <span>{lang === 'th' ? 'ขอรับแล้ว' : 'Claimed'}</span>
                                </span>
                                {onUnclaimItem && (
                                  <button
                                    type="button"
                                    id={`btn-table-unclaim-${item.id}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      sounds.playClick();
                                      onUnclaimItem(item.id);
                                    }}
                                    className="p-1 rounded-lg bg-red-950/70 hover:bg-red-900 border border-red-800/70 text-red-300 hover:text-white text-xs font-semibold transition-all cursor-pointer shadow-sm active:scale-95"
                                    title={t.cancelClaimBtn}
                                  >
                                    <X className="w-3 h-3 text-red-400" />
                                  </button>
                                )}
                              </div>
                            ) : !hasStats && !isPrivileged ? (
                              <button
                                id={`btn-table-claim-${item.id}`}
                                onClick={() => {
                                  sounds.playClick();
                                  setStatWarningModalItem(item);
                                }}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 shadow-sm cursor-pointer active:scale-95"
                                title={isStatsPendingState ? t.statsPendingBadge : t.updateStatsFirst}
                              >
                                {isStatsPendingState ? (
                                  <>
                                    <Clock className="w-3 h-3 text-amber-400 animate-pulse" />
                                    <span>{lang === 'th' ? 'รออนุมัติ' : 'Pending'}</span>
                                  </>
                                ) : (
                                  <>
                                    <AlertCircle className="w-3 h-3 text-amber-400" />
                                    <span>{lang === 'th' ? 'สเตตัสก่อน' : 'Need Stats'}</span>
                                  </>
                                )}
                              </button>
                            ) : (
                              <button
                                id={`btn-table-claim-${item.id}`}
                                disabled={!hasEnoughPower}
                                onClick={() => {
                                  sounds.playClaim();
                                  onClaimItem(item.id);
                                }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 ${
                                  hasEnoughPower
                                    ? 'btn-l2m-gold text-slate-950 font-bold shadow cursor-pointer active:scale-95'
                                    : 'bg-slate-800/60 text-slate-500 border border-slate-700/40 cursor-not-allowed'
                                }`}
                              >
                                {hasEnoughPower ? (
                                  <>
                                    <Sparkles className="w-3 h-3" />
                                    <span>{lang === 'th' ? 'ขอรับไอเทม' : 'Claim Item'}</span>
                                  </>
                                ) : (
                                  <>
                                    <Lock className="w-3 h-3" />
                                    <span>{lang === 'th' ? 'พลังไม่ถึง' : 'Low PL'}</span>
                                  </>
                                )}
                              </button>
                            )}
                          </td>

                          {/* Col 7: Actions for Admin / Owner */}
                          {isAdminOrOwner && (
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-slate-900/90 border border-slate-700/60 shadow-inner">
                                <button
                                  id={`btn-table-distribute-${item.id}`}
                                  onClick={() => {
                                    sounds.playClick();
                                    onOpenDistributeModal(item);
                                  }}
                                  className="p-1.5 rounded hover:bg-sky-600/30 text-sky-400 hover:text-sky-200 transition-all cursor-pointer"
                                  title={t.distributeItemBtn}
                                >
                                  <Gift className="w-3.5 h-3.5" />
                                </button>
                                {onEditItem && (
                                  <button
                                    id={`btn-table-edit-${item.id}`}
                                    onClick={() => {
                                      sounds.playClick();
                                      onEditItem(item);
                                    }}
                                    className="p-1.5 rounded hover:bg-amber-500/30 text-amber-400 hover:text-amber-200 transition-all cursor-pointer"
                                    title={t.editItem}
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {isOwner && onBroadcastToDiscord && (
                                  <button
                                    id={`btn-table-discord-${item.id}`}
                                    disabled={broadcastingItemId === item.id}
                                    onClick={async () => {
                                      sounds.playClick();
                                      setBroadcastingItemId(item.id);
                                      try {
                                        await onBroadcastToDiscord(item);
                                      } finally {
                                        setBroadcastingItemId(null);
                                      }
                                    }}
                                    className="p-1.5 rounded hover:bg-[#5865F2]/35 text-[#8ea1e1] hover:text-white transition-all cursor-pointer disabled:opacity-50"
                                    title={t.sendToDiscord || (lang === 'th' ? 'ส่งไป Discord' : 'Send to Discord')}
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {onDeleteItem && (
                                  <button
                                    id={`btn-table-delete-${item.id}`}
                                    onClick={() => {
                                      sounds.playClick();
                                      setItemToDelete(item);
                                    }}
                                    className="p-1.5 rounded hover:bg-red-900/50 text-red-400 hover:text-red-200 transition-all cursor-pointer"
                                    title={lang === 'th' ? 'ลบไอเทมนี้' : 'Delete item'}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {onAddGeneralItem && onUpdateGeneralItem && onDeleteGeneralItem && (
        <GeneralItemQueueCard
          lang={lang}
          currentUser={currentUser}
          items={generalItems}
          quickItems={quickItems}
          allMembers={allMembers}
          onAdd={onAddGeneralItem}
          onUpdate={onUpdateGeneralItem}
          onDelete={onDeleteGeneralItem}
          onRecordDiamondLog={onRecordDiamondLog}
          onViewImageZoom={onViewImage}
        />
      )}

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
              <span>{lang === 'th' ? 'จัดการคิวทั้งหมด' : 'Manage All Queues'}</span>
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
                          <h4 className={`text-xs sm:text-sm font-bold text-slate-100 truncate ${getRarityTextGlow(q.rarity)}`} title={q.name}>
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

      {/* Queue Announcement Edit Modal */}
      {isEditAnnouncementOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl bg-gradient-to-b from-[#111827] via-[#0d131f] to-[#080c14] border border-[#d4af37]/40 shadow-2xl p-5 sm:p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold font-cinzel text-slate-100">
                    {lang === 'th' ? 'แก้ไขข้อความประกาศคิว' : 'Edit Queue Announcement'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {lang === 'th' ? 'ข้อความแจ้งเตือนสำหรับผู้ที่ต้องการรับไอเทม' : 'Notice message for members wishing to receive items'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditAnnouncementOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveAnnouncement} className="space-y-4">
              {/* Thai Text */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <span>🇹🇭 {lang === 'th' ? 'ข้อความภาษาไทย' : 'Thai Message'}</span>
                </label>
                <textarea
                  rows={2}
                  value={announcementTextTh}
                  onChange={(e) => setAnnouncementTextTh(e.target.value)}
                  placeholder="เช่น: 📢 สมาชิกที่ต้องการขอรับไอเทม กรุณาติดต่อ Admin เพื่อเพิ่มรายชื่อลงในคิว"
                  className="w-full px-3 py-2 rounded-xl bg-[#090d16] border border-slate-700 text-slate-200 text-xs focus:border-amber-400 focus:outline-none transition-colors"
                  required
                />
              </div>

              {/* English Text */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <span>🇬🇧 {lang === 'th' ? 'ข้อความภาษาอังกฤษ' : 'English Message'}</span>
                </label>
                <textarea
                  rows={2}
                  value={announcementTextEn}
                  onChange={(e) => setAnnouncementTextEn(e.target.value)}
                  placeholder="e.g.: 📢 Members who wish to receive items, please contact an Admin to be added to the queue."
                  className="w-full px-3 py-2 rounded-xl bg-[#090d16] border border-slate-700 text-slate-200 text-xs focus:border-amber-400 focus:outline-none transition-colors"
                  required
                />
              </div>

              {/* Toggle Switch */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#090d16] border border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-200">
                    {lang === 'th' ? 'แสดงแถบประกาศ' : 'Display Announcement'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {lang === 'th' ? 'เปิด/ปิดการมองเห็นสำหรับสมาชิกทุกคน' : 'Toggle visibility for all members'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAnnouncementEnabled(!announcementEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    announcementEnabled ? 'bg-amber-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      announcementEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Reset to Default Button */}
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setAnnouncementTextTh('📢 สมาชิกที่ต้องการขอรับไอเทม กรุณาติดต่อ Admin เพื่อเพิ่มรายชื่อลงในคิว');
                    setAnnouncementTextEn('📢 Members who wish to receive items, please contact an Admin to be added to the queue.');
                    setAnnouncementEnabled(true);
                  }}
                  className="text-[11px] text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{lang === 'th' ? 'คืนค่าข้อความเริ่มต้น' : 'Reset to Default'}</span>
                </button>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditAnnouncementOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSavingAnnouncement}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#aa841c] hover:brightness-110 text-slate-950 text-xs font-bold transition-all shadow cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSavingAnnouncement ? (lang === 'th' ? 'กำลังบันทึก...' : 'Saving...') : (lang === 'th' ? 'บันทึกประกาศ' : 'Save Announcement')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
