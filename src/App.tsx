import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AlertCircle, CheckCircle, Sparkles, X, FileSpreadsheet, Database, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import {
  ActiveTab,
  ClanGroup,
  DiamondVaultRecord,
  HunterRecord,
  ItemRarity,
  Language,
  QueueItem,
  QueueMember,
  QuickItem,
  User,
  VaultItem,
  Claimant,
  AnnouncementSettings,
  DiscordSettings,
  ClanFundTxType,
  cleanClanName,
  isNoClan,
  StatHistoryPoint,
  UserRole,
  UserStatus,
  hasUserUpdatedStats,
  isUserStatsPending,
  AppNotification,
  DiscordMessageTemplate,
  DiscordMentionType
} from './types';
import { getOrGenerateStatHistory } from './utils/growthTimelineHelper';
import { translations } from './translations';
import { sounds } from './utils/sound';
import { sendDiscordNotification } from './utils/discord';
import { DiscordBroadcastModal } from './components/DiscordBroadcastModal';
import {
  listenToUsers,
  listenToVaultItems,
  listenToQueueItems,
  listenToQuickItems,
  listenToClans,
  listenToDiamondTransactions,
  listenToBackgroundSettings,
  saveBackgroundSettingsDoc,
  listenToAnnouncementSettings,
  saveAnnouncementSettingsDoc,
  listenToDiscordSettings,
  saveDiscordSettingsDoc,
  getCachedDiscordSettings,
  addVaultItemDoc,
  updateVaultItemDoc,
  deleteVaultItemDoc,
  addQueueItemDoc,
  updateQueueItemDoc,
  deleteQueueItemDoc,
  addQuickItemDoc,
  updateQuickItemDoc,
  deleteQuickItemDoc,
  addClanDoc,
  updateClanDoc,
  deleteClanDoc,
  updateUserDoc,
  deleteUserDoc,
  changeUserPassword,
  confirmVaultItemPayment,
  addDiamondTransactionDoc,
  updateDiamondTransactionNoteDoc,
  clearDiamondTransactionsDoc,
  registerUserDoc,
  loginUserQuery,
  listenToFormulaSettings,
  saveLocalSessionUser,
  clearLocalSessionUser,
  getLocalSessionUser,
  INITIAL_QUICK_ITEMS,
  INITIAL_CLANS,
  DEFAULT_OWNER,
  getCachedUsers,
  setCachedUsers,
  getCachedVaultItems,
  setCachedVaultItems,
  getCachedClans,
  setCachedClans,
  getCachedQueues,
  setCachedQueues,
  getCachedDiamondTransactions,
  setCachedDiamondTransactions,
  setOnQuotaExceededListener,
  syncBackupToFirestore,
  forceCheckAndFetchFirestore,
  testFirestoreHealth
} from './services/firebase';
import { calculateDiamondNetChange, computeTotalVaultBalance } from './utils/diamondHelper';
import { setInMemoryFormulaSettings, getFormulaSettings, saveFormulaSettings } from './services/powerFormulaService';

import { Sidebar } from './components/Sidebar';
import { AnnouncementBar } from './components/AnnouncementBar';
import { DiscordWebhookModal } from './components/DiscordWebhookModal';
import { LoginScreen } from './components/LoginScreen';
import { AuthModal } from './components/AuthModal';
import { DiamondVaultModal } from './components/DiamondVaultModal';
import { ImageViewerModal } from './components/ImageViewerModal';
import { DistributeItemModal } from './components/DistributeItemModal';
import { EditVaultItemModal } from './components/EditVaultItemModal';
import { ClaimantsModal } from './components/ClaimantsModal';
import { QuickItemModal } from './components/QuickItemModal';
import { OwnerResetModal } from './components/OwnerResetModal';
import { NotificationModal } from './components/NotificationModal';
import { RequestPowerLevelModal } from './components/RequestPowerLevelModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { GeminiKeyModal } from './components/GeminiKeyModal';
import { GoogleDriveBackupModal } from './components/GoogleDriveBackupModal';
import {
  triggerDebouncedAutoBackup,
  fetchDataFromGoogleSheets,
  getGoogleBackupConfig,
  setPendingFirebaseSync,
  isPendingFirebaseSync,
  initSharedGoogleBackupConfig,
  startGoogleRealtimeSync,
  stopGoogleRealtimeSync,
  broadcastLiveState,
  getIsApplyingRemoteUpdate,
  setLastBroadcastPayload,
  BackupDataPayload
} from './services/googleSheetsBackupService';
import {
  BackgroundSettingsModal,
  BackgroundConfig,
  DEFAULT_BG_CONFIG
} from './components/BackgroundSettingsModal';
import { PowerFormulaView } from './components/PowerFormulaView';

import { DashboardView } from './components/DashboardView';
import { VaultView } from './components/VaultView';
import { QueueView } from './components/QueueView';
import { MembersView } from './components/MembersView';
import { ClanView } from './components/ClanView';
import { ClanRosterView } from './components/ClanRosterView';
import { MyStatsView } from './components/MyStatsView';
import { StatApprovalView } from './components/StatApprovalView';

export const App: React.FC = () => {
  // 1. App-wide Language & Sound
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('k7_lang');
    return (saved === 'en' || saved === 'th' ? saved : 'th') as Language;
  });

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return sounds.isEnabled();
  });

  const handleToggleLanguage = () => {
    sounds.playClick();
    const next = lang === 'th' ? 'en' : 'th';
    setLang(next);
    localStorage.setItem('k7_lang', next);
  };

  const handleToggleSound = () => {
    const next = sounds.toggle();
    setSoundEnabled(next);
  };

  const VALID_TABS: ActiveTab[] = [
    'dashboard',
    'vault',
    'queue',
    'all_members',
    'clans',
    'bulk_swap',
    'my_stats',
    'stat_approvals',
    'power_formula'
  ];

  const getInitialTab = (): ActiveTab => {
    try {
      if (typeof window !== 'undefined') {
        // 1. Check URL hash (e.g. #queue, #vault)
        const hash = window.location.hash.replace(/^#\/?/, '') as ActiveTab;
        if (VALID_TABS.includes(hash)) return hash;

        // 2. Check URL search param (e.g. ?tab=queue)
        const searchTab = new URLSearchParams(window.location.search).get('tab') as ActiveTab;
        if (VALID_TABS.includes(searchTab)) return searchTab;

        // 3. Check localStorage
        const saved = localStorage.getItem('l2m_active_tab') as ActiveTab;
        if (VALID_TABS.includes(saved)) return saved;
      }
    } catch {}
    return 'dashboard';
  };

  // 2. Navigation Tab State (persists across refresh & syncs with URL hash)
  const [activeTab, setActiveTab] = useState<ActiveTab>(getInitialTab);

  // Synchronize activeTab to localStorage and URL hash
  useEffect(() => {
    try {
      localStorage.setItem('l2m_active_tab', activeTab);
      const currentHash = window.location.hash.replace(/^#\/?/, '');
      if (currentHash !== activeTab) {
        window.history.replaceState(null, '', `#${activeTab}`);
      }
    } catch {}
  }, [activeTab]);

  // Listen to hash changes (for browser back / forward buttons)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '') as ActiveTab;
      if (VALID_TABS.includes(hash)) {
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // 3. Current User / Authentication
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const u = getLocalSessionUser();
    if (u) {
      if (u.id === 'user_owner_eloni' || u.username?.toLowerCase() === 'eloni' || u.inGameName?.toLowerCase() === 'eloni') {
        u.role = 'owner';
        u.status = 'active';
        if (!u.powerLevel || u.powerLevel === 0) {
          u.powerLevel = DEFAULT_OWNER.powerLevel;
        }
      }
      return u;
    }
    return null;
  });

  // 4. Data Collections State (Resiliently initialized with cached/offline data)
  const [users, setUsers] = useState<User[]>(() => getCachedUsers());
  const [vaultItems, setVaultItems] = useState<VaultItem[]>(() => getCachedVaultItems());
  const [queueItems, setQueueItems] = useState<QueueItem[]>(() => getCachedQueues());
  const [quickItems, setQuickItems] = useState<QuickItem[]>(INITIAL_QUICK_ITEMS);
  const [clans, setClans] = useState<ClanGroup[]>(() => getCachedClans());
  const [diamondLogs, setDiamondLogs] = useState<DiamondVaultRecord[]>(() => getCachedDiamondTransactions());
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [showGoogleBackupModal, setShowGoogleBackupModal] = useState(false);

  useEffect(() => {
    // Automatically load the Owner's shared Google Sheets database URL for all members
    initSharedGoogleBackupConfig();

    // Proactively load active live relay state from server if available
    fetch(`/api/live-state?v=0&_t=${Date.now()}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.modified && json.data) {
          setLastBroadcastPayload(json.data);
          if (Array.isArray(json.data.users) && json.data.users.length > 0) setUsers(json.data.users);
          if (Array.isArray(json.data.vaultItems)) setVaultItems(json.data.vaultItems);
          if (Array.isArray(json.data.queueItems)) setQueueItems(json.data.queueItems);
          if (Array.isArray(json.data.clans) && json.data.clans.length > 0) setClans(json.data.clans);
          if (Array.isArray(json.data.diamondLogs)) setDiamondLogs(json.data.diamondLogs);
        }
      })
      .catch(() => {});

    setOnQuotaExceededListener((exceeded) => {
      setIsQuotaExceeded(exceeded);
      if (exceeded) {
        const config = getGoogleBackupConfig();
        if (config.webAppUrl && config.fallbackOnQuotaExceeded) {
          fetchDataFromGoogleSheets().then((res) => {
            if (res.success && res.data) {
              if (res.data.users && res.data.users.length > 0) setUsers(res.data.users);
              if (res.data.vaultItems && res.data.vaultItems.length > 0) setVaultItems(res.data.vaultItems);
              if (res.data.queueItems) setQueueItems(res.data.queueItems);
              if (res.data.clans && res.data.clans.length > 0) setClans(res.data.clans);
              if (res.data.diamondLogs) setDiamondLogs(res.data.diamondLogs);
            }
          }).catch(console.warn);
        }
      }
    });
  }, []);

  // 5. Modals State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showVaultModal, setShowVaultModal] = useState(false);
  const [showQuickItemsModal, setShowQuickItemsModal] = useState(false);
  const [showOwnerResetModal, setShowOwnerResetModal] = useState(false);
  const [showDiscordModal, setShowDiscordModal] = useState(false);
  const [broadcastTargetItem, setBroadcastTargetItem] = useState<VaultItem | null>(null);
  const [showRequestCpModal, setShowRequestCpModal] = useState(false);
  const [showGeminiModal, setShowGeminiModal] = useState(false);
  const [announcementSettings, setAnnouncementSettings] = useState<AnnouncementSettings | null>(null);
  const [discordSettings, setDiscordSettings] = useState<DiscordSettings | null>(null);
  const [distributeTargetItem, setDistributeTargetItem] = useState<VaultItem | null>(null);
  const [distributeClaimantId, setDistributeClaimantId] = useState<string | undefined>(undefined);
  const [claimantsTargetItem, setClaimantsTargetItem] = useState<VaultItem | null>(null);
  const [editingVaultItem, setEditingVaultItem] = useState<VaultItem | null>(null);
  const [imageViewerData, setImageViewerData] = useState<{
    url: string;
    title?: string;
    images?: string[];
    currentIndex?: number;
  } | null>(null);

  // 5c. Kain7 Power Formula State
  const [selectedClanScope, setSelectedClanScope] = useState<string>('all');

  // 5d. In-App Notification Center State (Admin & Owner)
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [passwordTargetUser, setPasswordTargetUser] = useState<User | null>(null);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('l2m_read_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('l2m_dismissed_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 5b. In-App Toast Feedback State
  const [toast, setToast] = useState<{
    message: string;
    type: 'info' | 'error' | 'success' | 'warning';
  } | null>(null);

  const showToast = (message: string, type: 'info' | 'error' | 'success' | 'warning' = 'info') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Firebase Quota Manual Status Check
  const [isCheckingFirebase, setIsCheckingFirebase] = useState(false);

  const handleManualCheckFirebase = async () => {
    sounds.playClick();
    setIsCheckingFirebase(true);
    showToast(
      lang === 'th'
        ? '🔍 กำลังตรวจสอบสถานะการเชื่อมต่อและโควต้า Firebase Cloud...'
        : '🔍 Checking Firebase Cloud connection and quota status...',
      'info'
    );
    try {
      const isHealthy = await testFirestoreHealth();
      if (isHealthy) {
        setIsQuotaExceeded(false);
        showToast(
          lang === 'th'
            ? '✅ Firebase Cloud ออนไลน์ปกติ! โควต้าอ่านรายวันยังไม่เกินลิมิต'
            : '✅ Firebase Cloud is online! Quota is within daily limits.',
          'success'
        );
      } else {
        setIsQuotaExceeded(true);
        showToast(
          lang === 'th'
            ? '⚠️ ตรวจพบ Firebase ยังติดโควต้าอ่านรายวัน — ระบบกำลังทำงานผ่าน Google Sheets & Drive สำรอง'
            : '⚠️ Firebase daily read quota is still exceeded — running via Google Sheets & Drive failover.',
          'warning'
        );
      }
    } catch (e: any) {
      showToast(
        lang === 'th'
          ? '⚠️ ไม่สามารถตรวจสอบสถานะได้ กรุณาลองใหม่อีกครั้ง'
          : '⚠️ Could not verify Firebase status, please retry.',
        'error'
      );
    } finally {
      setIsCheckingFirebase(false);
    }
  };

  // RBAC Guard for Owner, Admin, and Manager
  const isOwner = currentUser?.role === 'owner';
  const canAccessAdminFeatures =
    isOwner ||
    currentUser?.role === 'admin' ||
    currentUser?.role === 'manager';

  useEffect(() => {
    if (!canAccessAdminFeatures && (activeTab === 'vault' || activeTab === 'bulk_swap' || activeTab === 'stat_approvals')) {
      setActiveTab('dashboard');
    }
  }, [canAccessAdminFeatures, activeTab]);

  // 6. Wallpaper & Background Fantasy Atmosphere State
  const [bgConfig, setBgConfig] = useState<BackgroundConfig>(() => {
    try {
      const saved = localStorage.getItem('k7_bg_config');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_BG_CONFIG;
  });
  const [showBgModal, setShowBgModal] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Keep ref of currentUser to prevent re-attaching all 6 Firestore listeners on user login/logout
  const currentUserRef = useRef<User | null>(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // ─────────────────────────────────────────────────────────────
  // 5e. In-App Notification Center (Claims & Stat Verification Alerts)
  // ─────────────────────────────────────────────────────────────
  const notifications = useMemo<AppNotification[]>(() => {
    const list: AppNotification[] = [];

    // 1. Claim alerts from vault items (Auto-omits distributed items)
    vaultItems.forEach((item) => {
      // Auto-remove distributed items: distributed items must not show claim notifications!
      if (item.status === 'distributed' || Boolean(item.distributedTo?.name || item.distributedTo?.userId)) return;

      (item.claimants || []).forEach((c) => {
        const claimantId = c.userId || c.inGameName;
        const notifId = `claim_${item.id}_${claimantId}_${c.claimedAt || 0}`;
        if (dismissedNotificationIds.includes(notifId)) return;
        const th = lang === 'th';
        list.push({
          id: notifId,
          type: 'claim',
          title: th
            ? `${c.inGameName} (${cleanClanName(c.clan) || 'VoltZ'}) ลงชื่อขอรับไอเทม`
            : `${c.inGameName} (${cleanClanName(c.clan) || 'VoltZ'}) claimed an item`,
          description: th
            ? `ขอรับ [${item.rarity}] ${item.name} (x${item.quantity || 1}) • ${item.price > 0 ? `💎 ${item.price.toLocaleString()} เพชร` : '🎁 ฟรี'}`
            : `Claimed [${item.rarity}] ${item.name} (x${item.quantity || 1}) • ${item.price > 0 ? `💎 ${item.price.toLocaleString()} Dia` : '🎁 Free'}`,
          timestamp: c.claimedAt || item.createdAt || Date.now(),
          read: readNotificationIds.includes(notifId),
          item: item,
          claimant: c
        });
      });
    });

    // 2. Pending stat verification requests
    users.forEach((u) => {
      if (u.pendingPowerLevel && u.pendingPowerLevel > 0) {
        const notifId = `stat_req_${u.id}_${u.updatedAt || 0}`;
        if (dismissedNotificationIds.includes(notifId)) return;
        const th = lang === 'th';
        list.push({
          id: notifId,
          type: 'stat_request',
          title: th
            ? `${u.inGameName || u.username} (${cleanClanName(u.clan) || 'Alliance'}) ส่งคำขออัปเดตสเตตัส`
            : `${u.inGameName || u.username} (${cleanClanName(u.clan) || 'Alliance'}) requested stats update`,
          description: th
            ? `ค่าพลังใหม่: ⚡ ${Number(u.pendingPowerLevel).toLocaleString()} PL (รอ Admin ตรวจสอบและอนุมัติ)`
            : `New Power Level: ⚡ ${Number(u.pendingPowerLevel).toLocaleString()} PL (Pending Admin verification)`,
          timestamp: u.updatedAt || Date.now(),
          read: readNotificationIds.includes(notifId),
          user: u
        });
      }
    });

    // Sort newest first
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [vaultItems, users, lang, readNotificationIds, dismissedNotificationIds]);

  const unreadNotificationCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  // Real-time detection of new claims to alert Admin & Owner
  const previousClaimKeysRef = useRef<Set<string> | null>(null);
  const pageLoadedAtRef = useRef(Date.now());
  const hasInitializedClaimsRef = useRef(false);

  useEffect(() => {
    const currentClaimKeys = new Set<string>();
    const currentClaimsList: { item: VaultItem; claimant: Claimant }[] = [];

    vaultItems.forEach((item) => {
      // Ignore distributed items: distributed items must never trigger claim notifications!
      if (item.status === 'distributed' || Boolean(item.distributedTo?.name || item.distributedTo?.userId)) return;

      (item.claimants || []).forEach((c) => {
        const key = `${item.id}_${c.userId || c.inGameName}_${c.claimedAt || 0}`;
        currentClaimKeys.add(key);
        currentClaimsList.push({ item, claimant: c });
      });
    });

    // Initial load: record existing claims without playing chime or showing toast
    if (!hasInitializedClaimsRef.current) {
      if (vaultItems.length > 0) {
        previousClaimKeysRef.current = currentClaimKeys;
        hasInitializedClaimsRef.current = true;
      }
      return;
    }

    if (previousClaimKeysRef.current === null) {
      previousClaimKeysRef.current = currentClaimKeys;
      return;
    }

    // Only notify Admin or Owner when another user submits a fresh claim in real-time
    const isPrivileged = currentUser?.role === 'owner' || currentUser?.role === 'admin';
    if (isPrivileged) {
      const newClaims = currentClaimsList.filter(
        ({ item, claimant }) =>
          !previousClaimKeysRef.current!.has(
            `${item.id}_${claimant.userId || claimant.inGameName}_${claimant.claimedAt || 0}`
          ) &&
          claimant.userId !== currentUser?.id &&
          (claimant.claimedAt || 0) >= pageLoadedAtRef.current - 2000
      );

      if (newClaims.length > 0) {
        sounds.playNotification();
        const newest = newClaims[newClaims.length - 1];
        showToast(
          lang === 'th'
            ? `🔔 ${newest.claimant.inGameName} (${cleanClanName(newest.claimant.clan) || 'VoltZ'}) ลงชื่อขอรับ [${newest.item.name}]!`
            : `🔔 ${newest.claimant.inGameName} (${cleanClanName(newest.claimant.clan) || 'VoltZ'}) claimed [${newest.item.name}]!`,
          'info'
        );
      }
    }

    previousClaimKeysRef.current = currentClaimKeys;
  }, [vaultItems, currentUser, lang]);

  const handleMarkAllNotificationsAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    setReadNotificationIds(allIds);
    try {
      localStorage.setItem('l2m_read_notifications', JSON.stringify(allIds));
    } catch {}
  };

  const handleClearNotifications = () => {
    sounds.playClick();
    const allIds = notifications.map((n) => n.id);
    setDismissedNotificationIds((prev) => {
      const next = Array.from(new Set([...prev, ...allIds]));
      try {
        localStorage.setItem('l2m_dismissed_notifications', JSON.stringify(next));
      } catch {}
      return next;
    });
    setReadNotificationIds((prev) => {
      const next = Array.from(new Set([...prev, ...allIds]));
      try {
        localStorage.setItem('l2m_read_notifications', JSON.stringify(next));
      } catch {}
      return next;
    });
    showToast(
      lang === 'th' ? 'ล้างการแจ้งเตือนทั้งหมดเรียบร้อยแล้ว' : 'All notifications cleared',
      'info'
    );
  };

  const handleDeleteNotification = (id: string) => {
    sounds.playClick();
    setDismissedNotificationIds((prev) => {
      const next = Array.from(new Set([...prev, id]));
      try {
        localStorage.setItem('l2m_dismissed_notifications', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Continuously synchronize currentUser with latest user document in users state
  useEffect(() => {
    if (!currentUser) return;
    const isCurrentEloni =
      currentUser.id === 'user_owner_eloni' ||
      currentUser.username?.toLowerCase() === 'eloni' ||
      currentUser.inGameName?.toLowerCase() === 'eloni';

    const found = isCurrentEloni
      ? users.find((u) => u.id === 'user_owner_eloni') ||
        users.find((u) => u.username?.toLowerCase() === 'eloni') ||
        users.find((u) => u.inGameName?.toLowerCase() === 'eloni')
      : users.find((u) => u.id === currentUser.id);

    if (found) {
      const safeUser: User = isCurrentEloni
        ? { ...found, role: 'owner' as UserRole, status: 'active' as UserStatus }
        : found;

      if (
        safeUser.powerLevel !== currentUser.powerLevel ||
        safeUser.role !== currentUser.role ||
        safeUser.status !== currentUser.status ||
        safeUser.clan !== currentUser.clan ||
        safeUser.inGameName !== currentUser.inGameName ||
        safeUser.characterClass !== currentUser.characterClass ||
        safeUser.verified !== currentUser.verified ||
        JSON.stringify(safeUser.stats) !== JSON.stringify(currentUser.stats) ||
        JSON.stringify(safeUser.pendingStats) !== JSON.stringify(currentUser.pendingStats)
      ) {
        setCurrentUser(safeUser);
        saveLocalSessionUser(safeUser);
      }
    }
  }, [users, currentUser]);

  // Firestore Subscriptions (run once on mount)
  useEffect(() => {
    const unsubUsers = listenToUsers((updatedUsers) => {
      // Ensure Eloni is always owner in the users list
      const normalizedUsers = updatedUsers.map((u) => {
        if (u.id === 'user_owner_eloni' || u.username?.toLowerCase() === 'eloni' || u.inGameName?.toLowerCase() === 'eloni') {
          return { ...u, role: 'owner' as UserRole, status: 'active' as UserStatus };
        }
        return u;
      });

      // Consolidate & deduplicate into exactly ONE Eloni profile (user_owner_eloni)
      const seen = new Set<string>();
      const finalUsers: User[] = [];
      for (const u of normalizedUsers) {
        const isEloni = u.id === 'user_owner_eloni' || u.username?.toLowerCase() === 'eloni' || u.inGameName?.toLowerCase() === 'eloni';
        if (isEloni) {
          if (!seen.has('user_owner_eloni')) {
            seen.add('user_owner_eloni');
            const primaryEloni = normalizedUsers.find((x) => x.id === 'user_owner_eloni') || u;
            finalUsers.push({
              ...primaryEloni,
              role: 'owner' as UserRole,
              status: 'active' as UserStatus
            });
          }
        } else {
          finalUsers.push(u);
        }
      }

      setUsers(finalUsers);

      // Keep currentUser in sync if updated
      const current = currentUserRef.current;
      if (current) {
        const isCurrentEloni = current.id === 'user_owner_eloni' || current.username?.toLowerCase() === 'eloni' || current.inGameName?.toLowerCase() === 'eloni';
        const found = isCurrentEloni
          ? finalUsers.find((u) => u.id === 'user_owner_eloni') || finalUsers.find((u) => u.username?.toLowerCase() === 'eloni')
          : finalUsers.find((u) => u.id === current.id);
        if (found) {
          const safeUser: User = isCurrentEloni
            ? { ...found, role: 'owner' as UserRole, status: 'active' as UserStatus }
            : found;
          setCurrentUser(safeUser);
          saveLocalSessionUser(safeUser);
        }
      }
    });

    const unsubVault = listenToVaultItems((items) => {
      if (items && items.length > 0) {
        setVaultItems(items);
      }
    });
    const unsubQueue = listenToQueueItems((items) => {
      if (items && items.length > 0) {
        setQueueItems(items);
      }
    });
    const unsubQuick = listenToQuickItems((items) => {
      if (items && items.length > 0) {
        setQuickItems(items);
      }
    });
    const unsubClans = listenToClans((clanList) => {
      const validClans = clanList.filter((c) => !isNoClan(c.name));
      if (validClans && validClans.length > 0) {
        setClans(validClans);
      }
    });
    const unsubDiamonds = listenToDiamondTransactions((logs) => {
      if (logs && logs.length > 0) {
        setDiamondLogs(logs);
      }
    });
    const unsubBg = listenToBackgroundSettings((settings) => {
      if (settings && settings.imageUrl) {
        setBgConfig({
          imageUrl: settings.imageUrl,
          brightness: typeof settings.brightness === 'number' ? settings.brightness : DEFAULT_BG_CONFIG.brightness,
          blur: typeof settings.blur === 'number' ? settings.blur : DEFAULT_BG_CONFIG.blur,
          vignetteOpacity: typeof settings.vignetteOpacity === 'number' ? settings.vignetteOpacity : DEFAULT_BG_CONFIG.vignetteOpacity
        });
        localStorage.setItem('k7_bg_config', JSON.stringify(settings));
      }
    });

    const unsubAnnouncement = listenToAnnouncementSettings((settings) => {
      if (settings) setAnnouncementSettings(settings);
    });
    const unsubDiscord = listenToDiscordSettings((settings) => {
      if (settings) setDiscordSettings(settings);
    });
    const unsubFormula = listenToFormulaSettings((settings) => {
      if (settings) setInMemoryFormulaSettings(settings);
    });

    return () => {
      unsubUsers();
      unsubVault();
      unsubQueue();
      unsubQuick();
      unsubClans();
      unsubDiamonds();
      unsubBg();
      unsubAnnouncement();
      unsubDiscord();
      unsubFormula();
    };
  }, []);

  // Calculate Diamond Vault / Clan Fund Balance (Memoized directly from real transaction records)
  const vaultBalance = useMemo(() => {
    return computeTotalVaultBalance(diamondLogs);
  }, [diamondLogs]);

  // Automatic debounced sync to Google Sheets & Drive when data updates
  useEffect(() => {
    if (getIsApplyingRemoteUpdate()) return;
    if (users.length > 0 || vaultItems.length > 0) {
      if (isQuotaExceeded) {
        setPendingFirebaseSync(true);
      }
      triggerDebouncedAutoBackup({
        users,
        vaultItems,
        queueItems,
        clans,
        diamondLogs,
        vaultBalance,
        formulaSettings: getFormulaSettings(),
        announcementSettings,
        backgroundSettings: bgConfig,
        discordSettings
      });
    }
  }, [users, vaultItems, queueItems, clans, diamondLogs, vaultBalance, isQuotaExceeded, announcementSettings, bgConfig, discordSettings]);

  // Keep local cache in sync whenever core collections update (survives quota limits and offline refreshes)
  useEffect(() => {
    if (vaultItems.length > 0) {
      setCachedVaultItems(vaultItems);
    }
  }, [vaultItems]);

  useEffect(() => {
    if (users.length > 0) {
      setCachedUsers(users);
    }
  }, [users]);

  useEffect(() => {
    if (queueItems.length > 0) {
      setCachedQueues(queueItems);
    }
  }, [queueItems]);

  useEffect(() => {
    if (clans.length > 0) {
      setCachedClans(clans);
    }
  }, [clans]);

  useEffect(() => {
    if (diamondLogs.length > 0) {
      setCachedDiamondTransactions(diamondLogs);
    }
  }, [diamondLogs]);

  // Real-time live relay broadcast: whenever state changes locally, immediately notify all other clan members (debounced 300ms)
  useEffect(() => {
    if (users.length === 0 && vaultItems.length === 0) return;
    if (getIsApplyingRemoteUpdate()) return;

    const timer = setTimeout(() => {
      broadcastLiveState(
        {
          users,
          vaultItems,
          queueItems,
          clans,
          diamondLogs,
          vaultBalance,
          formulaSettings: getFormulaSettings(),
          announcementSettings,
          backgroundSettings: bgConfig,
          discordSettings
        },
        currentUser?.inGameName || currentUser?.username || 'Member'
      );
    }, 300);

    return () => clearTimeout(timer);
  }, [users, vaultItems, queueItems, clans, diamondLogs, vaultBalance, announcementSettings, bgConfig, discordSettings]);

  // Real-time live synchronization engine when in failover mode (or Quota Exceeded)
  useEffect(() => {
    if (isQuotaExceeded) {
      startGoogleRealtimeSync((incomingData: BackupDataPayload) => {
        if (!incomingData) return;
        if (Array.isArray(incomingData.users) && incomingData.users.length > 0) {
          setUsers(incomingData.users);
          const cur = currentUserRef.current;
          if (cur) {
            const found = incomingData.users.find((u) => u.id === cur.id);
            if (found) {
              setCurrentUser(found);
              saveLocalSessionUser(found);
            }
          }
        }
        if (Array.isArray(incomingData.vaultItems)) {
          setVaultItems((prev) => {
            const prevMap = new Map<string, VaultItem>(prev.map((i) => [i.id, i]));
            // Shield distributed items from being flipped back to available if done locally
            const resolvedIncoming = (incomingData.vaultItems as VaultItem[]).map((incItem: VaultItem) => {
              const local = prevMap.get(incItem.id);
              if (local && local.status === 'distributed' && incItem.status === 'available') {
                return local;
              }
              return incItem;
            });
            const incomingIds = new Set<string>(resolvedIncoming.map((i: VaultItem) => i.id));
            // Keep items created locally within the last 10 minutes that haven't hit the incoming snapshot yet
            const pendingLocalItems = prev.filter(
              (it) => !incomingIds.has(it.id) && Date.now() - (it.createdAt || 0) < 600000
            );
            const merged: VaultItem[] = [...pendingLocalItems, ...resolvedIncoming];
            setCachedVaultItems(merged);
            return merged;
          });
        }
        if (Array.isArray(incomingData.queueItems)) {
          setQueueItems(incomingData.queueItems);
        }
        if (Array.isArray(incomingData.clans) && incomingData.clans.length > 0) {
          setClans(incomingData.clans);
        }
        if (Array.isArray(incomingData.diamondLogs)) {
          setDiamondLogs(incomingData.diamondLogs);
        }
        if (incomingData.formulaSettings) {
          saveFormulaSettings(incomingData.formulaSettings);
        }
        if (incomingData.announcementSettings) {
          setAnnouncementSettings(incomingData.announcementSettings);
          try {
            localStorage.setItem('k7_announcement_config', JSON.stringify(incomingData.announcementSettings));
          } catch {}
        }
        if (incomingData.backgroundSettings) {
          setBgConfig(incomingData.backgroundSettings);
          try {
            localStorage.setItem('k7_bg_config', JSON.stringify(incomingData.backgroundSettings));
          } catch {}
        }
        if (incomingData.discordSettings) {
          setDiscordSettings(incomingData.discordSettings);
        }
      });
    } else {
      stopGoogleRealtimeSync();
    }

    return () => {
      stopGoogleRealtimeSync();
    };
  }, [isQuotaExceeded]);

  // Automated Heartbeat: Detects when Firebase recovers from quota limit, and auto-syncs newest data to Cloud!
  useEffect(() => {
    if (!isQuotaExceeded) return;

    let isChecking = false;
    const checkRecoveryAndAutoSync = async () => {
      if (isChecking) return;
      isChecking = true;
      try {
        const isHealthy = await testFirestoreHealth();
        if (isHealthy) {
          setIsQuotaExceeded(false);

          if (isPendingFirebaseSync()) {
            showToast(
              lang === 'th'
                ? '🔄 ตรวจพบ Firebase กลับมาออนไลน์แล้ว! กำลังซิงค์ข้อมูลล่าสุดจาก Google Sheets ขึ้น Cloud อัตโนมัติ...'
                : '🔄 Firebase is back online! Automatically syncing latest changes to Cloud...',
              'info'
            );
            const syncRes = await syncBackupToFirestore({
              users,
              vaultItems,
              queueItems,
              clans,
              diamondLogs,
              formulaSettings: getFormulaSettings(),
              announcementSettings,
              backgroundSettings: bgConfig ? {
                imageUrl: bgConfig.imageUrl,
                brightness: bgConfig.brightness,
                blur: bgConfig.blur,
                vignetteOpacity: bgConfig.vignetteOpacity,
                updatedBy: currentUser?.inGameName || 'Owner'
              } : undefined,
              discordSettings
            });
            if (syncRes.success) {
              setPendingFirebaseSync(false);
              showToast(
                lang === 'th'
                  ? `✅ ซิงค์ข้อมูลขึ้น Firebase Cloud สำเร็จ (${syncRes.writtenCount} รายการ)! ข้อมูลทั้งสองระบบตรงกัน 100%`
                  : `✅ Synced to Firebase Cloud successfully (${syncRes.writtenCount} records)! Both databases are in sync`,
                'success'
              );
            }
          } else {
            // No offline edits made: fetch authentic cloud records from Firebase
            const cloudRes = await forceCheckAndFetchFirestore();
            if (cloudRes.success && cloudRes.data) {
              if (cloudRes.data.users && cloudRes.data.users.length > 0) setUsers(cloudRes.data.users);
              if (cloudRes.data.vaultItems && cloudRes.data.vaultItems.length > 0) setVaultItems(cloudRes.data.vaultItems);
              if (cloudRes.data.queueItems) setQueueItems(cloudRes.data.queueItems);
              if (cloudRes.data.clans && cloudRes.data.clans.length > 0) setClans(cloudRes.data.clans);
              if (cloudRes.data.diamondLogs) setDiamondLogs(cloudRes.data.diamondLogs);
            }
            showToast(
              lang === 'th'
                ? '✅ ระบบหลัก Firebase กลับมาออนไลน์แล้ว! ข้อมูลเชื่อมต่อเป็นปัจจุบัน 100%'
                : '✅ Firebase Cloud is back online and fully synchronized!',
              'success'
            );
          }
        }
      } catch (err) {
        console.warn('Probe check warning:', err);
      } finally {
        isChecking = false;
      }
    };

    // 1. Probe every 60 seconds
    const interval = setInterval(checkRecoveryAndAutoSync, 60000);

    // 2. Also probe immediately on window focus
    const handleFocus = () => {
      checkRecoveryAndAutoSync();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isQuotaExceeded, users, vaultItems, queueItems, clans, diamondLogs, lang]);

  // Auth Handlers
  const handleLogin = async (username: string, pass: string): Promise<{ success: boolean; message?: string }> => {
    const user = await loginUserQuery(username, pass);
    if (!user) {
      return {
        success: false,
        message: lang === 'th' ? 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' : 'Invalid username or password'
      };
    }
    if (user.status === 'pending_approval') {
      return {
        success: false,
        message:
          lang === 'th'
            ? 'บัญชีของคุณอยู่ระหว่างรอโอเนอร์หรือแอดมินอนุมัติ'
            : 'Account is awaiting Admin/Owner manual approval'
      };
    }

    const isEloni =
      user.id === 'user_owner_eloni' ||
      user.username?.toLowerCase() === 'eloni' ||
      user.inGameName?.toLowerCase() === 'eloni';

    const matchedInUsers = isEloni
      ? users.find((u) => u.id === 'user_owner_eloni') ||
        users.find((u) => u.username?.toLowerCase() === 'eloni') ||
        users.find((u) => u.inGameName?.toLowerCase() === 'eloni')
      : users.find((u) => u.id === user.id || u.username?.toLowerCase() === user.username?.toLowerCase());

    const activeUser: User = matchedInUsers
      ? {
          ...user,
          ...matchedInUsers,
          ...(isEloni ? { role: 'owner' as UserRole, status: 'active' as UserStatus } : {})
        }
      : (isEloni ? { ...DEFAULT_OWNER, ...user, role: 'owner' as UserRole, status: 'active' as UserStatus } : user);

    setCurrentUser(activeUser);
    saveLocalSessionUser(activeUser);
    setShowAuthModal(false);
    return { success: true };
  };

  const handleRegister = async (data: {
    username: string;
    password: string;
    inGameName: string;
    clan: string;
    characterClass: any;
    powerLevel?: number;
  }): Promise<{ success: boolean; message?: string }> => {
    try {
      // Check if username already exists
      const existing = users.find(
        (u) => u.username.toLowerCase() === data.username.toLowerCase()
      );
      if (existing) {
        return {
          success: false,
          message: lang === 'th' ? 'มีชื่อผู้ใช้นี้ในระบบแล้ว' : 'Username already registered'
        };
      }

      await registerUserDoc(data);
      return {
        success: true,
        message:
          lang === 'th'
            ? 'ลงทะเบียนสำเร็จ! กรุณารอแอดมินหรือโอเนอร์อนุมัติบัญชีของคุณ'
            : 'Registration submitted! Please wait for Admin/Owner approval.'
      };
    } catch (err: any) {
      return { success: false, message: err.message || 'Registration failed' };
    }
  };

  const handleLogout = () => {
    sounds.playClick();
    setCurrentUser(null);
    clearLocalSessionUser();
  };

  // Diamond Vault / Clan Fund Transaction
  const handleVaultTransaction = async (
    type: ClanFundTxType,
    amount: number,
    note: string,
    details?: {
      grossAmount?: number;
      taxPct?: number;
      taxAmount?: number;
      netAmount?: number;
      clanScope?: string;
      recipientUserId?: string;
      recipientName?: string;
      recipientClan?: string;
      proofImageUrl?: string;
      balanceAfter?: number;
    }
  ) => {
    if (!currentUser) return;
    const currentBal = vaultBalance;
    const net = calculateDiamondNetChange({ type, amount, netAmount: details?.netAmount });
    const computedBalanceAfter = Math.max(0, currentBal + net);

    await addDiamondTransactionDoc({
      type,
      amount,
      note,
      grossAmount: details?.grossAmount,
      taxPct: details?.taxPct,
      taxAmount: details?.taxAmount,
      netAmount: details?.netAmount,
      clanScope: details?.clanScope || 'all',
      recipientUserId: details?.recipientUserId,
      recipientName: details?.recipientName,
      recipientClan: details?.recipientClan,
      proofImageUrl: details?.proofImageUrl,
      balanceAfter: typeof details?.balanceAfter === 'number' ? details.balanceAfter : computedBalanceAfter,
      performedBy: {
        userId: currentUser.id,
        name: currentUser.inGameName,
        role: currentUser.role
      }
    });
  };

  const handleUpdateVaultNote = async (recordId: string, newNote: string) => {
    await updateDiamondTransactionNoteDoc(recordId, newNote);
  };

  const handleResetVaultBalance = async (
    mode: 'wipe' | 'adjust',
    targetBalance: number,
    note?: string
  ) => {
    if (!currentUser || currentUser.role !== 'owner') return;
    if (mode === 'wipe') {
      await clearDiamondTransactionsDoc();
      if (targetBalance > 0) {
        await addDiamondTransactionDoc({
          type: 'deposit',
          amount: targetBalance,
          grossAmount: targetBalance,
          netAmount: targetBalance,
          note: note || (lang === 'th' ? 'ยอดเริ่มต้นกองทุน (รีเซ็ตโดย Owner)' : 'Initial Starting Fund (Owner Reset)'),
          clanScope: 'all',
          balanceAfter: targetBalance,
          performedBy: {
            userId: currentUser.id,
            name: currentUser.inGameName,
            role: currentUser.role
          }
        });
      }
    } else {
      const current = vaultBalance;
      const delta = targetBalance - current;
      if (delta !== 0) {
        await addDiamondTransactionDoc({
          type: 'adjust',
          amount: delta,
          grossAmount: Math.abs(delta),
          netAmount: delta,
          note: note || (lang === 'th' ? `ปรับยอดโดย Owner (เป้าหมาย: ${targetBalance.toLocaleString()} เพชร)` : `Owner Balance Adjustment (Target: ${targetBalance.toLocaleString()})`),
          clanScope: 'all',
          balanceAfter: targetBalance,
          performedBy: {
            userId: currentUser.id,
            name: currentUser.inGameName,
            role: currentUser.role
          }
        });
      }
    }
  };

  // Announcement & Discord Settings Handlers
  const handleSaveAnnouncement = async (newSettings: AnnouncementSettings) => {
    setAnnouncementSettings(newSettings);
    try {
      await saveAnnouncementSettingsDoc(newSettings);
      showToast(
        lang === 'th' ? 'บันทึกประกาศกิลด์สำเร็จแล้ว' : 'Announcement updated successfully',
        'success'
      );
    } catch (err) {
      console.error('Failed to save announcement:', err);
      showToast(
        lang === 'th' ? 'เกิดข้อผิดพลาดในการบันทึกประกาศ' : 'Failed to update announcement',
        'error'
      );
    }
    triggerDebouncedAutoBackup(
      {
        users,
        vaultItems,
        queueItems,
        clans,
        diamondLogs,
        vaultBalance,
        formulaSettings: getFormulaSettings(),
        announcementSettings: newSettings,
        backgroundSettings: bgConfig,
        discordSettings
      },
      currentUser?.inGameName || 'Admin',
      true
    );
  };

  const handleSaveDiscordSettings = async (newSettings: DiscordSettings) => {
    setDiscordSettings(newSettings);
    try {
      await saveDiscordSettingsDoc(newSettings);
      showToast(
        lang === 'th' ? 'บันทึกการตั้งค่า Discord เรียบร้อยแล้ว' : 'Discord settings saved successfully',
        'success'
      );
    } catch (err) {
      console.error('Failed to save discord settings:', err);
      showToast(
        lang === 'th' ? 'เกิดข้อผิดพลาดในการบันทึกการตั้งค่า Discord' : 'Failed to save Discord settings',
        'error'
      );
    }
    triggerDebouncedAutoBackup(
      {
        users,
        vaultItems,
        queueItems,
        clans,
        diamondLogs,
        vaultBalance,
        formulaSettings: getFormulaSettings(),
        announcementSettings,
        backgroundSettings: bgConfig,
        discordSettings: newSettings
      },
      currentUser?.inGameName || 'Admin',
      true
    );
    broadcastLiveState({
      users,
      vaultItems,
      queueItems,
      clans,
      diamondLogs,
      vaultBalance,
      formulaSettings: getFormulaSettings(),
      announcementSettings,
      backgroundSettings: bgConfig,
      discordSettings: newSettings
    });
  };

  // Broadcast single vault item to Discord (Owner only) - Opens template picker modal
  const handleBroadcastItemToDiscord = async (item: VaultItem) => {
    if (!isOwner) return;
    if (!discordSettings?.enabled) {
      showToast(
        lang === 'th'
          ? 'กรุณาเปิดใช้งานระบบ Discord ในการตั้งค่าก่อน'
          : 'Please enable Discord Webhook in settings first',
        'warning'
      );
      return;
    }
    setBroadcastTargetItem(item);
  };

  const handleConfirmBroadcast = async (
    item: VaultItem,
    template: DiscordMessageTemplate,
    customNote?: string,
    overrideMentionType?: DiscordMentionType,
    saveAsDefault?: boolean
  ) => {
    if (!isOwner || !discordSettings?.enabled) return;

    if (saveAsDefault) {
      handleSaveDiscordSettings({
        ...discordSettings,
        messageTemplate: template,
        mentionType: overrideMentionType || discordSettings.mentionType
      }).catch(console.warn);
    }

    const activeSettings = overrideMentionType
      ? { ...discordSettings, mentionType: overrideMentionType }
      : discordSettings;

    try {
      const res = await sendDiscordNotification(activeSettings, 'new_item', {
        item,
        actorName: currentUser?.inGameName || 'Owner',
        lang,
        template,
        customNote
      });

      if (res.success) {
        sounds.playSuccess();
        showToast(
          lang === 'th'
            ? `📢 ส่งไอเทม [${item.name}] เข้า Discord สำเร็จแล้ว!`
            : `📢 Broadcasted [${item.name}] to Discord successfully!`,
          'success'
        );
      } else {
        sounds.playError();
        showToast(
          res.message || (lang === 'th' ? 'ส่งไป Discord ไม่สำเร็จ' : 'Failed to send to Discord'),
          'error'
        );
      }
    } catch (err: any) {
      sounds.playError();
      showToast(
        err?.message || (lang === 'th' ? 'เกิดข้อผิดพลาดในการส่ง Discord' : 'Error sending to Discord'),
        'error'
      );
    }
  };

  // Broadcast all available vault items to Discord (Owner only)
  const handleSyncAllItemsToDiscord = async () => {
    if (!isOwner) return;
    const itemsToSend = availableDashboardItems;
    if (itemsToSend.length === 0) {
      showToast(lang === 'th' ? 'ไม่พบไอเทมในคลังที่จะส่ง' : 'No vault items to broadcast', 'info');
      return;
    }

    showToast(
      lang === 'th'
        ? `กำลังทยอยส่งไอเทม ${itemsToSend.length} ชิ้น เข้า Discord...`
        : `Broadcasting ${itemsToSend.length} items to Discord...`,
      'info'
    );

    let sentCount = 0;
    for (const item of itemsToSend) {
      try {
        await sendDiscordNotification(
          { ...discordSettings, enabled: true, notifyOnNewItem: true } as DiscordSettings,
          'new_item',
          {
            item,
            actorName: currentUser?.inGameName || 'Owner',
            lang,
            template: discordSettings?.messageTemplate || 'neon_glow'
          }
        );
        sentCount++;
        // 600ms delay between messages to respect Discord rate limits
        await new Promise((r) => setTimeout(r, 600));
      } catch (err) {
        console.warn('Failed to broadcast item:', item.name, err);
      }
    }

    showToast(
      lang === 'th'
        ? `ส่งไอเทมเข้า Discord สำเร็จแล้ว ${sentCount}/${itemsToSend.length} รายการ!`
        : `Broadcasted ${sentCount}/${itemsToSend.length} items to Discord successfully!`,
      'success'
    );
  };


  // Vault Items Handlers
  const handleCreateVaultItem = async (
    itemData: Omit<VaultItem, 'id' | 'createdAt' | 'status' | 'claimants'>
  ) => {
    try {
      const createdItem = await addVaultItemDoc({
        ...itemData,
        status: 'available',
        claimants: []
      });

      // 1. Optimistic UI update immediately so user sees the new item instantly
      let nextVaultItems: VaultItem[] = [];
      setVaultItems((prev) => {
        nextVaultItems = [createdItem, ...prev.filter((i) => i.id !== createdItem.id)];
        setCachedVaultItems(nextVaultItems);
        return nextVaultItems;
      });

      sounds.playSuccess();
      showToast(
        lang === 'th'
          ? `เพิ่มไอเทม [${createdItem.name}] เข้าคลังเรียบร้อยแล้ว!`
          : `Added [${createdItem.name}] to vault successfully!`,
        'success'
      );

      // 2. Immediate dual-cloud sync to Google Sheets & Drive (failover backup)
      triggerDebouncedAutoBackup(
        {
          users,
          vaultItems: nextVaultItems.length > 0 ? nextVaultItems : [createdItem, ...vaultItems],
          queueItems,
          clans,
          diamondLogs,
          vaultBalance,
          formulaSettings: getFormulaSettings()
        },
        currentUser?.inGameName || currentUser?.username || 'Admin',
        true
      );

      // 3. Discord notification if enabled (Rule 5: English 100%)
      if (discordSettings?.enabled && discordSettings.notifyOnNewItem) {
        sendDiscordNotification(discordSettings, 'new_item', {
          item: createdItem,
          actorName: currentUser?.inGameName || currentUser?.username || 'Admin',
          lang,
          template: discordSettings?.messageTemplate || 'neon_glow'
        }).then((res) => {
          if (res.success) {
            showToast(
              lang === 'th'
                ? `📢 ส่งแจ้งเตือน [${createdItem.name}] เข้า Discord เรียบร้อยแล้ว!`
                : `📢 Sent [${createdItem.name}] alert to Discord!`,
              'info'
            );
          }
        }).catch((err) => console.warn('Discord notification error:', err));
      }
    } catch (err: any) {
      console.error('Failed to create vault item:', err);
      sounds.playError();
      showToast(
        lang === 'th'
          ? `เกิดข้อผิดพลาดในการเพิ่มไอเทม: ${err?.message || 'Unknown error'}`
          : `Failed to add item: ${err?.message || 'Unknown error'}`,
        'error'
      );
    }
  };

  const handleDeleteVaultItem = async (itemId: string) => {
    sounds.playClick();
    setVaultItems((prev) => {
      const next = prev.filter((i) => i.id !== itemId);
      setCachedVaultItems(next);
      return next;
    });
    try {
      await deleteVaultItemDoc(itemId);
      showToast(lang === 'th' ? 'ลบรายการสำเร็จ' : 'Item deleted', 'info');
    } catch (err) {
      console.error('Failed to delete vault item in Firestore:', err);
    }
  };

  // Claim Item Handler (Member clicks claim on Dashboard)
  const handleClaimItem = async (itemId: string) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

    const item = vaultItems.find((i) => i.id === itemId);
    if (!item) return;

    const isPrivileged = currentUser.role === 'owner' || currentUser.role === 'admin';
    const hasStats = hasUserUpdatedStats(currentUser);

    // Block claim if member has not updated character stats
    if (!isPrivileged && !hasStats) {
      sounds.playClick();
      const isPending = isUserStatsPending(currentUser);
      showToast(
        lang === 'th'
          ? (isPending
              ? 'สเตตัสของคุณอยู่ระหว่างรอ Admin ตรวจสอบและอนุมัติ จึงยังไม่สามารถลงชื่อเคลมไอเทมได้'
              : 'คุณยังไม่ได้อัปเดตค่าสเตตัสตัวละคร กรุณาไปที่หน้า "ข้อมูลของฉัน" เพื่ออัปเดตสเตตัสก่อนเคลมไอเทม')
          : (isPending
              ? 'Your stats update is pending Admin approval. You cannot claim items yet.'
              : 'You must update your character stats in "My Stats" before claiming items.'),
        'warning'
      );
      return;
    }

    // Check power requirement (owner and admin bypass minimum PL)
    const userCP = Number(currentUser.powerLevel || 0);
    const requiredCP = Number(item.minPowerLevel || 0);

    if (!isPrivileged && userCP < requiredCP) {
      sounds.playClick();
      showToast(
        lang === 'th'
          ? `ค่าพลังของคุณ (⚡ ${userCP.toLocaleString()} PL) ไม่ถึงเกณฑ์ขั้นต่ำ (⚡ ${requiredCP.toLocaleString()} PL)`
          : `Your Power Level (⚡ ${userCP.toLocaleString()} PL) is below the required ⚡ ${requiredCP.toLocaleString()} PL`,
        'error'
      );
      return;
    }

    // Check if already claimed (by userId or inGameName)
    const existing = item.claimants?.find(
      (c) =>
        (c.userId && c.userId === currentUser.id) ||
        (c.inGameName &&
          currentUser.inGameName &&
          c.inGameName.trim().toLowerCase() ===
            currentUser.inGameName.trim().toLowerCase())
    );
    if (existing) return;

    const newClaimant: Claimant = {
      userId: currentUser.id,
      inGameName: currentUser.inGameName,
      clan: currentUser.clan,
      powerLevel: currentUser.powerLevel || 0,
      claimedAt: Date.now()
    };

    const updatedClaimants = [...(item.claimants || []), newClaimant];

    // Optimistic local state update
    setVaultItems((prev) => {
      const next = prev.map((it) =>
        it.id === itemId ? { ...it, claimants: updatedClaimants } : it
      );
      setCachedVaultItems(next);
      return next;
    });

    try {
      await updateVaultItemDoc(itemId, { claimants: updatedClaimants });
      showToast(
        lang === 'th' ? 'ลงชื่อเครมไอเทมสำเร็จ!' : 'Claim submitted successfully!',
        'success'
      );
    } catch (err) {
      console.error('Failed to update claim in Firestore:', err);
      setVaultItems((prev) => {
        const next = prev.map((it) =>
          it.id === itemId ? { ...it, claimants: item.claimants } : it
        );
        setCachedVaultItems(next);
        return next;
      });
    }
  };

  // Unclaim Item Handler (Member cancels claim or Admin removes claimant)
  const handleUnclaimItem = async (
    itemId: string,
    targetUserId?: string,
    targetInGameName?: string
  ) => {
    const userIdToRemove = targetUserId || currentUser?.id;
    const inGameNameToRemove =
      targetInGameName ||
      (!targetUserId || targetUserId === currentUser?.id
        ? currentUser?.inGameName
        : undefined);

    const item = vaultItems.find((i) => i.id === itemId);
    if (!item) return;

    const updatedClaimants = (item.claimants || []).filter((c) => {
      if (userIdToRemove && c.userId && c.userId === userIdToRemove) {
        return false;
      }
      if (
        inGameNameToRemove &&
        c.inGameName &&
        c.inGameName.trim().toLowerCase() === inGameNameToRemove.trim().toLowerCase()
      ) {
        return false;
      }
      return true;
    });

    // 1. Optimistic UI update immediately
    setVaultItems((prev) => {
      const next = prev.map((it) =>
        it.id === itemId ? { ...it, claimants: updatedClaimants } : it
      );
      setCachedVaultItems(next);
      return next;
    });

    if (claimantsTargetItem && claimantsTargetItem.id === itemId) {
      setClaimantsTargetItem({
        ...claimantsTargetItem,
        claimants: updatedClaimants
      });
    }

    // 2. Persist to Firestore
    try {
      await updateVaultItemDoc(itemId, { claimants: updatedClaimants });
      showToast(
        lang === 'th' ? 'ยกเลิกการลงชื่อเครมสำเร็จ' : 'Claim cancelled successfully',
        'info'
      );
    } catch (err) {
      console.error('Failed to unclaim item in Firestore:', err);
      // Revert if error
      setVaultItems((prev) => {
        const next = prev.map((it) =>
          it.id === itemId ? { ...it, claimants: item.claimants } : it
        );
        setCachedVaultItems(next);
        return next;
      });
    }
  };

  // Update/Edit Vault Item Handler
  const handleUpdateVaultItem = async (
    itemId: string,
    updates: Partial<VaultItem>
  ) => {
    let nextVaultItems: VaultItem[] = [];
    setVaultItems((prev) => {
      nextVaultItems = prev.map((it) => (it.id === itemId ? { ...it, ...updates } : it));
      setCachedVaultItems(nextVaultItems);
      return nextVaultItems;
    });

    try {
      await updateVaultItemDoc(itemId, updates);
      showToast(
        lang === 'th' ? 'อัปเดตข้อมูลไอเทมเรียบร้อยแล้ว' : 'Item updated successfully',
        'success'
      );

      triggerDebouncedAutoBackup({
        users,
        vaultItems: nextVaultItems,
        queueItems,
        clans,
        diamondLogs,
        vaultBalance,
        formulaSettings: getFormulaSettings()
      });
    } catch (err: any) {
      console.error('Error updating vault item:', err);
      showToast(
        lang === 'th' ? 'เกิดข้อผิดพลาดในการอัปเดตไอเทม' : 'Error updating item',
        'error'
      );
      throw err;
    }
  };

  // Distribute Item Handler (Admin awards item, removes from Dashboard, stores in distributed archive)
  const handleDistributeItem = async (
    itemId: string,
    recipient: { name: string; clan: string; userId?: string; receiptImages?: string[] }
  ) => {
    try {
      const targetItem = vaultItems.find((i) => i.id === itemId);
      const isNotFree = Boolean(targetItem && targetItem.price > 0);
      const initialPaymentStatus: 'pending' | 'paid' = isNotFree ? 'pending' : 'paid';

      const distributedPayload: any = {
        name: recipient.name,
        clan: recipient.clan || 'No Clan',
        distributedAt: Date.now(),
        distributedBy: currentUser?.inGameName || currentUser?.username || 'Admin',
        paymentStatus: initialPaymentStatus
      };
      if (recipient.userId) {
        distributedPayload.userId = recipient.userId;
      }
      if (recipient.receiptImages && recipient.receiptImages.length > 0) {
        distributedPayload.receiptImages = recipient.receiptImages;
      }

      await updateVaultItemDoc(itemId, {
        status: 'distributed',
        distributedTo: distributedPayload,
        receiptImages: recipient.receiptImages || [],
        paymentStatus: initialPaymentStatus
      });

      // Optimistic update local vaultItems and persist cache
      let nextVaultItems: VaultItem[] = [];
      setVaultItems((prev) => {
        nextVaultItems = prev.map((i) =>
          i.id === itemId
            ? {
                ...i,
                status: 'distributed',
                distributedTo: distributedPayload,
                receiptImages: recipient.receiptImages || [],
                paymentStatus: initialPaymentStatus
              }
            : i
        );
        setCachedVaultItems(nextVaultItems);
        return nextVaultItems;
      });

      // Dual-cloud failover: Immediately back up to Google Sheets & Drive
      triggerDebouncedAutoBackup(
        {
          users,
          vaultItems: nextVaultItems,
          queueItems,
          clans,
          diamondLogs,
          vaultBalance,
          formulaSettings: getFormulaSettings()
        },
        currentUser?.inGameName || currentUser?.username || 'Admin',
        true
      );

      // Send Discord notification if enabled
      if (targetItem && discordSettings?.enabled && discordSettings.notifyOnDistribute) {
        sendDiscordNotification(discordSettings, 'distribute', {
          item: { ...targetItem, status: 'distributed', distributedTo: distributedPayload, paymentStatus: initialPaymentStatus },
          distributeInfo: distributedPayload,
          actorName: currentUser?.inGameName || currentUser?.username || 'Admin'
        }).catch((err) => console.warn('Discord notification error on distribute:', err));
      }

      setDistributeTargetItem(null);
      if (claimantsTargetItem?.id === itemId) {
        setClaimantsTargetItem(null);
      }

      // Automatically clear notifications for this distributed item
      setDismissedNotificationIds((prev) => {
        const itemNotifIds = notifications
          .filter((n) => n.item?.id === itemId)
          .map((n) => n.id);
        if (itemNotifIds.length === 0) return prev;
        const next = Array.from(new Set([...prev, ...itemNotifIds]));
        try {
          localStorage.setItem('l2m_dismissed_notifications', JSON.stringify(next));
        } catch {}
        return next;
      });

      showToast(
        lang === 'th' ? 'แจกจ่ายไอเทมสำเร็จแล้ว!' : 'Item distributed successfully!',
        'success'
      );
    } catch (err) {
      console.error('Error distributing item:', err);
      showToast(
        lang === 'th'
          ? 'เกิดข้อผิดพลาดในการแจกไอเทม กรุณาลองใหม่อีกครั้ง'
          : 'Error distributing item, please try again',
        'error'
      );
    }
  };

  // Payment Status Handler for Distributed Items
  const handleConfirmPayment = async (
    item: VaultItem,
    targetStatus: 'pending' | 'paid' = 'paid'
  ) => {
    sounds.playClick();
    const isPaid = targetStatus === 'paid';
    const actorName = currentUser?.inGameName || currentUser?.username || 'Admin';
    const now = Date.now();

    // Optimistic update
    setVaultItems((prev) => {
      const next = prev.map((i) => {
        if (i.id !== item.id) return i;
        const updatedDistributedTo = i.distributedTo
          ? {
              ...i.distributedTo,
              paymentStatus: targetStatus,
              paidAt: isPaid ? now : undefined,
              paidBy: isPaid ? actorName : undefined
            }
          : undefined;
        return {
          ...i,
          paymentStatus: targetStatus,
          paidAt: isPaid ? now : undefined,
          paidBy: isPaid ? actorName : undefined,
          distributedTo: updatedDistributedTo
        };
      });
      setCachedVaultItems(next);
      return next;
    });

    try {
      await confirmVaultItemPayment(item.id, actorName, targetStatus);
      showToast(
        isPaid
          ? (lang === 'th' ? `ยืนยันการชำระเพชรสำหรับ "${item.name}" สำเร็จ!` : `Payment confirmed for "${item.name}"!`)
          : (lang === 'th' ? `เปลี่ยนสถานะ "${item.name}" เป็นรอชำระแล้ว` : `Status reverted to pending for "${item.name}"`),
        'success'
      );
    } catch (err) {
      console.error('Failed to update payment status:', err);
      showToast(
        lang === 'th' ? 'เกิดข้อผิดพลาดในการอัปเดตสถานะการชำระ' : 'Failed to update payment status',
        'error'
      );
    }
  };

  // Queue Item Handlers
  const handleCreateQueueItem = async (
    itemData: Omit<QueueItem, 'id' | 'createdAt'>
  ) => {
    try {
      const createdQueue = await addQueueItemDoc(itemData);
      setQueueItems((prev) => {
        const next = [createdQueue, ...prev.filter((q) => q.id !== createdQueue.id)];
        setCachedQueues(next);
        return next;
      });
      sounds.playSuccess();
      showToast(
        lang === 'th'
          ? `เพิ่มคิว [${createdQueue.name}] สำเร็จแล้ว!`
          : `Added queue [${createdQueue.name}] successfully!`,
        'success'
      );
    } catch (err: any) {
      console.error('Failed to add queue item:', err);
      showToast(
        lang === 'th' ? 'เกิดข้อผิดพลาดในการสร้างคิว' : 'Failed to create queue',
        'error'
      );
    }
  };

  const handleDeleteQueueItem = async (queueId: string) => {
    sounds.playClick();
    setQueueItems((prev) => {
      const next = prev.filter((q) => q.id !== queueId);
      setCachedQueues(next);
      return next;
    });
    try {
      await deleteQueueItemDoc(queueId);
      showToast(lang === 'th' ? 'ลบคิวสำเร็จ' : 'Queue deleted', 'info');
    } catch (err) {
      console.error('Failed to delete queue item:', err);
    }
  };

  const handleUpdateQueueMembers = async (queueId: string, members: QueueMember[]) => {
    // 1. Optimistic UI update immediately
    setQueueItems((prev) => {
      const next = prev.map((q) => (q.id === queueId ? { ...q, queueList: members } : q));
      setCachedQueues(next);
      return next;
    });
    // 2. Persist in Firestore
    try {
      await updateQueueItemDoc(queueId, { queueList: members });
    } catch (err) {
      console.error('Failed to update queue item doc in Firestore:', err);
    }
  };

  // Quick Items Handlers
  const handleAddQuickItem = async (item: Omit<QuickItem, 'id' | 'createdAt'>) => {
    const tempId = 'qi_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const fallbackImg = 'https://images.unsplash.com/photo-1595590424283-b8f17842773f?w=300&auto=format&fit=crop&q=80';
    const optimisticItem: QuickItem = {
      ...item,
      id: tempId,
      imageUrl: (item.imageUrl && item.imageUrl.trim().length > 0) ? item.imageUrl : fallbackImg,
      createdAt: Date.now()
    };
    // 1. Optimistic update
    setQuickItems((prev) => [optimisticItem, ...prev]);

    // 2. Persist in Firestore
    try {
      const saved = await addQuickItemDoc(item);
      setQuickItems((prev) => prev.map((q) => (q.id === tempId ? saved : q)));
    } catch (err) {
      console.error('Failed to add quick item to Firestore:', err);
      // Keep optimistic item in UI so user does not lose their creation
    }
  };

  const handleUpdateQuickItem = async (itemId: string, updates: Partial<Omit<QuickItem, 'id' | 'createdAt'>>) => {
    setQuickItems((prev) => prev.map((q) => (q.id === itemId ? { ...q, ...updates } : q)));
    try {
      await updateQuickItemDoc(itemId, updates);
    } catch (err) {
      console.error('Failed to update quick item in Firestore:', err);
    }
  };

  const handleDeleteQuickItem = async (itemId: string) => {
    setQuickItems((prev) => prev.filter((q) => q.id !== itemId));
    try {
      await deleteQuickItemDoc(itemId);
    } catch (err) {
      console.error('Failed to delete quick item in Firestore:', err);
    }
  };

  // Clan Handlers
  const handleUpdateBackgroundConfig = async (newConfig: BackgroundConfig, syncGlobally = false) => {
    setBgConfig(newConfig);
    localStorage.setItem('k7_bg_config', JSON.stringify(newConfig));

    if (syncGlobally && isOwner) {
      const bgPayload = {
        imageUrl: newConfig.imageUrl,
        brightness: newConfig.brightness,
        blur: newConfig.blur,
        vignetteOpacity: newConfig.vignetteOpacity,
        updatedBy: currentUser?.inGameName || 'Owner'
      };
      try {
        await saveBackgroundSettingsDoc(bgPayload);
        showToast(
          lang === 'th'
            ? 'ซิงค์ภาพพื้นหลังไปยังสมาชิกทุกคนในกิลด์เรียบร้อยแล้ว!'
            : 'Background synchronized to all guild members!',
          'success'
        );
      } catch (err) {
        console.error('Failed to sync background settings to Firestore:', err);
      }

      triggerDebouncedAutoBackup(
        {
          users,
          vaultItems,
          queueItems,
          clans,
          diamondLogs,
          vaultBalance,
          formulaSettings: getFormulaSettings(),
          announcementSettings,
          backgroundSettings: bgPayload,
          discordSettings
        },
        currentUser?.inGameName || 'Owner',
        true
      );
    }
  };

  const handleAddClan = async (clanName: string, color?: string) => {
    const cleanName = cleanClanName(clanName);
    if (!cleanName || isNoClan(cleanName)) return;

    // Prevent duplicate clan names
    const exists = clans.some(
      (c) => cleanClanName(c.name).toLowerCase() === cleanName.toLowerCase()
    );
    if (exists) {
      showToast(
        lang === 'th'
          ? `มีแคลนชื่อ "${cleanName}" อยู่ในระบบแล้ว`
          : `Clan "${cleanName}" already exists`,
        'error'
      );
      return;
    }

    const nextOrder = clans.length;
    const newClan: ClanGroup = {
      id: 'clan_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: cleanName,
      color: color || '#d4af37',
      order: nextOrder,
      enabled: true
    };
    setClans((prev) => [...prev, newClan]);
    try {
      await addClanDoc({ name: cleanName, color: color || '#d4af37', order: nextOrder });
      showToast(lang === 'th' ? `เพิ่มแคลน ${cleanName} สำเร็จ` : `Clan ${cleanName} added`, 'success');
    } catch (err) {
      console.error('Failed to add clan:', err);
      showToast(lang === 'th' ? 'เกิดข้อผิดพลาดในการเพิ่มแคลน' : 'Failed to add clan', 'error');
    }
  };

  const handleUpdateClan = async (clanId: string, newName: string, newColor?: string) => {
    const cleanNew = cleanClanName(newName);
    if (!cleanNew) return;
    const targetClan = clans.find((c) => c.id === clanId);
    const oldCleanName = targetClan ? cleanClanName(targetClan.name) : '';

    // Optimistic update clans state
    setClans((prev) =>
      prev.map((c) =>
        c.id === clanId
          ? { ...c, name: cleanNew, ...(newColor ? { color: newColor } : {}) }
          : c
      )
    );

    // Cascade update users state if name changed
    if (oldCleanName && oldCleanName.toLowerCase() !== cleanNew.toLowerCase()) {
      setUsers((prev) =>
        prev.map((u) => (cleanClanName(u.clan).toLowerCase() === oldCleanName.toLowerCase() ? { ...u, clan: cleanNew } : u))
      );
      if (currentUser && cleanClanName(currentUser.clan).toLowerCase() === oldCleanName.toLowerCase()) {
        const updated = { ...currentUser, clan: cleanNew };
        setCurrentUser(updated);
        localStorage.setItem('k7_vault_user', JSON.stringify(updated));
      }
    }

    try {
      await updateClanDoc(clanId, {
        name: cleanNew,
        ...(newColor ? { color: newColor } : {})
      });

      // Cascade update users in Firestore
      if (oldCleanName && oldCleanName.toLowerCase() !== cleanNew.toLowerCase()) {
        const affected = users.filter((u) => cleanClanName(u.clan).toLowerCase() === oldCleanName.toLowerCase());
        for (const mem of affected) {
          updateUserDoc(mem.id, { clan: cleanNew }).catch(console.error);
        }
      }
      showToast(lang === 'th' ? `แก้ไขแคลน ${cleanNew} สำเร็จ` : `Clan ${cleanNew} updated`, 'success');
    } catch (err) {
      console.error('Failed to update clan:', err);
      showToast(lang === 'th' ? 'เกิดข้อผิดพลาดในการแก้ไขแคลน' : 'Failed to update clan', 'error');
    }
  };

  const handleDeleteClan = async (clanId: string, clanName?: string) => {
    sounds.playClick();
    const targetClan = clans.find(
      (c) =>
        c.id === clanId ||
        (clanName && cleanClanName(c.name).toLowerCase() === cleanClanName(clanName).toLowerCase())
    );
    const resolvedName = targetClan ? cleanClanName(targetClan.name) : (clanName ? cleanClanName(clanName) : '');
    const resolvedId = targetClan ? targetClan.id : clanId;

    // Optimistic update clans state
    setClans((prev) =>
      prev.filter(
        (c) =>
          c.id !== resolvedId &&
          (!resolvedName || cleanClanName(c.name).toLowerCase() !== resolvedName.toLowerCase())
      )
    );

    // Reassign all members of this clan to 'no-clan'
    if (resolvedName) {
      setUsers((prev) =>
        prev.map((u) =>
          cleanClanName(u.clan).toLowerCase() === resolvedName.toLowerCase()
            ? { ...u, clan: 'no-clan' }
            : u
        )
      );
      if (currentUser && cleanClanName(currentUser.clan).toLowerCase() === resolvedName.toLowerCase()) {
        const updated = { ...currentUser, clan: 'no-clan' };
        setCurrentUser(updated);
        localStorage.setItem('k7_vault_user', JSON.stringify(updated));
      }
    }

    try {
      await deleteClanDoc(resolvedId);
      if (resolvedName) {
        const affected = users.filter(
          (u) => cleanClanName(u.clan).toLowerCase() === resolvedName.toLowerCase()
        );
        for (const mem of affected) {
          updateUserDoc(mem.id, { clan: 'no-clan' }).catch(console.error);
        }
      }
      showToast(
        lang === 'th'
          ? `ลบแคลน ${resolvedName} สำเร็จ (สมาชิกถูกย้ายไปที่ ไม่มีแคลน)`
          : `Clan ${resolvedName} deleted (members moved to Unassigned)`,
        'info'
      );
    } catch (err) {
      console.error('Failed to delete clan:', err);
      showToast(lang === 'th' ? 'เกิดข้อผิดพลาดในการลบแคลน' : 'Failed to delete clan', 'error');
    }
  };

  const handleToggleClanVisibility = async (clanId: string) => {
    sounds.playClick();
    const targetClan = clans.find((c) => c.id === clanId);
    if (!targetClan) return;
    const nextEnabled = targetClan.enabled === false ? true : false;

    setClans((prev) =>
      prev.map((c) => (c.id === clanId ? { ...c, enabled: nextEnabled } : c))
    );

    try {
      await updateClanDoc(clanId, { enabled: nextEnabled });
      showToast(
        lang === 'th'
          ? `${nextEnabled ? 'เปิดแสดง' : 'ซ่อน'}แคลน ${cleanClanName(targetClan.name)} เรียบร้อย`
          : `Clan ${cleanClanName(targetClan.name)} is now ${nextEnabled ? 'visible' : 'hidden'}`,
        'info'
      );
    } catch (err) {
      console.error('Failed to toggle clan visibility:', err);
      showToast(lang === 'th' ? 'เกิดข้อผิดพลาดในการตั้งค่าแคลน' : 'Failed to toggle clan visibility', 'error');
    }
  };

  const handleReorderClans = async (orderedClans: ClanGroup[]) => {
    sounds.playClick();
    const updatedClans = orderedClans.map((c, idx) => ({ ...c, order: idx }));
    setClans(updatedClans);

    try {
      for (let i = 0; i < updatedClans.length; i++) {
        const c = updatedClans[i];
        await updateClanDoc(c.id, { order: i, name: c.name, color: c.color });
      }
      showToast(lang === 'th' ? 'จัดตำแหน่งแคลนสำเร็จ' : 'Clan order updated', 'success');
    } catch (err) {
      console.error('Failed to reorder clans in Firestore:', err);
      showToast(lang === 'th' ? 'เกิดข้อผิดพลาดในการจัดตำแหน่งแคลน' : 'Failed to save clan order', 'error');
    }
  };

  const handleMoveMemberClan = async (userId: string, newClanName: string) => {
    sounds.playClaim();
    const cleanTarget = isNoClan(newClanName) ? 'no-clan' : (cleanClanName(newClanName) || 'no-clan');
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, clan: cleanTarget } : u))
    );
    if (currentUser && currentUser.id === userId) {
      setCurrentUser((prev) => (prev ? { ...prev, clan: cleanTarget } : null));
    }
    try {
      await updateUserDoc(userId, { clan: cleanTarget });
      showToast(
        lang === 'th'
          ? (cleanTarget === 'no-clan' ? 'ปลดสมาชิกออกจากแคลนแล้ว' : `ย้ายเข้าแคลน ${cleanTarget} สำเร็จ`)
          : (cleanTarget === 'no-clan' ? 'Member unassigned from clan' : `Member moved to ${cleanTarget}`),
        'success'
      );
    } catch (err) {
      console.error('Failed to move member clan:', err);
    }
  };

  const handleBatchMoveMembersClan = async (userIds: string[], targetClan: string) => {
    sounds.playClaim();
    const cleanTarget = isNoClan(targetClan) ? 'no-clan' : (cleanClanName(targetClan) || 'no-clan');
    const swaps = userIds.map((id) => ({ memberId: id, toClan: cleanTarget }));
    await handleBulkUpdateClans(swaps);
  };

  // Members Handlers (Approvals & Management)
  const handleApproveMember = async (userId: string) => {
    const target = users.find((u) => u.id === userId);
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, status: 'active' } : u))
    );
    try {
      await updateUserDoc(userId, { status: 'active' });
      showToast(
        lang === 'th'
          ? `อนุมัติสมาชิก ${target?.inGameName || ''} สำเร็จ 🎉`
          : `Approved member ${target?.inGameName || ''} successfully 🎉`,
        'success'
      );
    } catch (err) {
      console.error('Failed to approve member in Firestore:', err);
      showToast(
        lang === 'th' ? 'เกิดข้อผิดพลาดในการอนุมัติสมาชิก' : 'Failed to approve member',
        'error'
      );
    }
  };

  const handleRejectMember = async (userId: string) => {
    const target = users.find((u) => u.id === userId);
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    try {
      await deleteUserDoc(userId);
      showToast(
        lang === 'th'
          ? `ปฏิเสธคำขอสมัครของ ${target?.inGameName || ''} แล้ว`
          : `Rejected registration for ${target?.inGameName || ''}`,
        'info'
      );
    } catch (err) {
      console.error('Failed to reject member in Firestore:', err);
      showToast(
        lang === 'th' ? 'เกิดข้อผิดพลาดในการปฏิเสธสมาชิก' : 'Failed to reject member',
        'error'
      );
    }
  };

  const handleUpdateMember = async (userId: string, updates: Partial<User>) => {
    const isOwnerTarget = userId === 'user_owner_eloni';
    const safeUpdates = isOwnerTarget && updates.role && updates.role !== 'owner'
      ? { ...updates, role: 'owner' as UserRole }
      : updates;

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const isOwnerU = u.id === 'user_owner_eloni' || u.role === 'owner' || u.username?.toLowerCase() === 'eloni' || u.inGameName?.toLowerCase() === 'eloni';
          const finalRole = isOwnerU ? 'owner' : (safeUpdates.role || u.role);
          return { ...u, ...safeUpdates, role: finalRole };
        }
        return u;
      })
    );
    try {
      await updateUserDoc(userId, safeUpdates);
    } catch (err) {
      console.error('Failed to update member in Firestore:', err);
    }
  };

  const handleDeleteMember = async (userId: string) => {
    const target = users.find((u) => u.id === userId);
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    try {
      await deleteUserDoc(userId);
      showToast(
        lang === 'th'
          ? `ลบสมาชิก ${target?.inGameName || ''} สำเร็จ`
          : `Deleted member ${target?.inGameName || ''}`,
        'info'
      );
    } catch (err) {
      console.error('Failed to delete member in Firestore:', err);
      showToast(lang === 'th' ? 'เกิดข้อผิดพลาดในการลบสมาชิก' : 'Failed to delete member', 'error');
    }
  };

  const handleChangePassword = async (targetUser: User, newPass: string) => {
    try {
      await changeUserPassword(targetUser.id, newPass);
      showToast(
        lang === 'th' ? 'เปลี่ยนรหัสผ่านสำเร็จแล้ว!' : 'Password changed successfully!',
        'success'
      );
    } catch (err: any) {
      console.error('Error changing password:', err);
      showToast(
        err?.message || (lang === 'th' ? 'เปลี่ยนรหัสผ่านไม่สำเร็จ' : 'Failed to change password'),
        'error'
      );
      throw err;
    }
  };

  // PL & Stat Update Request Handlers (Kain7 Power Formula & Spirit Enhancements)
  const handleRequestStatUpdate = async (
    userId: string,
    newStats: Record<string, number>,
    newSpiritEnhancements: Record<string, number>,
    newPowerLevel: number,
    screenshotUrl?: string,
    profileData?: {
      classes?: string[];
      level?: number;
      legendClasses?: number;
      legendAgathions?: number;
      inGameName?: string;
      role?: UserRole;
      status?: UserStatus;
      clan?: string;
    }
  ) => {
    const timestamp = Date.now();
    const reqClasses = profileData?.classes;
    const reqLevel = profileData?.level;
    const reqLegendClasses = profileData?.legendClasses;
    const reqLegendAgathions = profileData?.legendAgathions;
    const reqInGameName = profileData?.inGameName;
    const reqRole = profileData?.role;
    const reqStatus = profileData?.status;
    const reqClan = profileData?.clan;

    const targetUser = users.find((u) => u.id === userId) || currentUser;
    const isOwnerUser = userId === 'user_owner_eloni' || targetUser?.username?.toLowerCase() === 'eloni' || targetUser?.inGameName?.toLowerCase() === 'eloni' || targetUser?.role === 'owner';
    const isAuthorized = currentUser?.role === 'owner' || currentUser?.role === 'admin';

    const safeRole: UserRole = isOwnerUser
      ? 'owner'
      : (isAuthorized && reqRole ? reqRole : (targetUser?.role || 'member'));
    const safeStatus: UserStatus = isAuthorized && reqStatus ? reqStatus : (targetUser?.status || 'active');
    const safeClan: string = isAuthorized && reqClan ? reqClan : (targetUser?.clan || 'VoltZ');

    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              inGameName: reqInGameName || u.inGameName,
              role: isOwnerUser ? 'owner' : (isAuthorized && reqRole ? reqRole : u.role),
              status: isAuthorized && reqStatus ? reqStatus : u.status,
              clan: isAuthorized && reqClan ? reqClan : u.clan,
              pendingPowerLevel: newPowerLevel,
              pendingPowerLevelRequestedAt: timestamp,
              pendingStats: newStats,
              pendingSpiritEnhancements: newSpiritEnhancements,
              pendingStatScreenshotUrl: screenshotUrl || null,
              pendingClasses: reqClasses ?? u.classes,
              pendingLevel: reqLevel ?? u.level,
              pendingLegendClasses: reqLegendClasses ?? u.legendClasses,
              pendingLegendAgathions: reqLegendAgathions ?? u.legendAgathions,
              statRejectionReason: null,
              statRejectionAt: null
            }
          : u
      )
    );
    if (currentUser && currentUser.id === userId) {
      setCurrentUser((prev) =>
        prev
          ? {
              ...prev,
              inGameName: reqInGameName || prev.inGameName,
              role: isOwnerUser ? 'owner' : (isAuthorized && reqRole ? reqRole : prev.role),
              status: isAuthorized && reqStatus ? reqStatus : prev.status,
              clan: isAuthorized && reqClan ? reqClan : prev.clan,
              pendingPowerLevel: newPowerLevel,
              pendingPowerLevelRequestedAt: timestamp,
              pendingStats: newStats,
              pendingSpiritEnhancements: newSpiritEnhancements,
              pendingStatScreenshotUrl: screenshotUrl || null,
              pendingClasses: reqClasses ?? prev.classes,
              pendingLevel: reqLevel ?? prev.level,
              pendingLegendClasses: reqLegendClasses ?? prev.legendClasses,
              pendingLegendAgathions: reqLegendAgathions ?? prev.legendAgathions,
              statRejectionReason: null,
              statRejectionAt: null
            }
          : null
      );
    }
    try {
      const docUpdates: Record<string, any> = {
        pendingPowerLevel: newPowerLevel,
        pendingPowerLevelRequestedAt: timestamp,
        pendingStats: newStats,
        pendingSpiritEnhancements: newSpiritEnhancements,
        pendingStatScreenshotUrl: screenshotUrl || null,
        pendingClasses: reqClasses ?? null,
        pendingLevel: reqLevel ?? null,
        pendingLegendClasses: reqLegendClasses ?? null,
        pendingLegendAgathions: reqLegendAgathions ?? null,
        statRejectionReason: null,
        statRejectionAt: null
      };
      if (reqInGameName) docUpdates.inGameName = reqInGameName;
      if (isOwnerUser) {
        docUpdates.role = 'owner';
      } else if (isAuthorized && reqRole) {
        docUpdates.role = reqRole;
      }
      if (isAuthorized && reqStatus) docUpdates.status = reqStatus;
      if (isAuthorized && reqClan) docUpdates.clan = reqClan;

      await updateUserDoc(userId, docUpdates);

      showToast(
        lang === 'th'
          ? 'ส่งคำขออัปเดตสเตตัสและค่าพลังเรียบร้อยแล้ว รอการอนุมัติ'
          : 'Stat & PL update request submitted! Waiting for Admin approval',
        'success'
      );
    } catch (err) {
      console.error('Failed to submit stat update request:', err);
      showToast(
        lang === 'th' ? 'เกิดข้อผิดพลาดในการส่งคำขอ' : 'Failed to submit stat request',
        'error'
      );
    }
  };

  const handleApproveStatUpdate = async (userId: string) => {
    const target = users.find((u) => u.id === userId);
    if (!target || !target.pendingPowerLevel) return;

    const approvedPower = target.pendingPowerLevel;
    const approvedStats = target.pendingStats || target.stats;
    const approvedSpirits = target.pendingSpiritEnhancements || target.spiritEnhancements;

    const approvedClasses = target.pendingClasses !== undefined && target.pendingClasses !== null
      ? target.pendingClasses
      : (target.classes || (target.characterClass ? [target.characterClass] : []));
    const approvedLevel = target.pendingLevel !== undefined && target.pendingLevel !== null
      ? target.pendingLevel
      : (target.level || 0);
    const approvedLegendClasses = target.pendingLegendClasses !== undefined && target.pendingLegendClasses !== null
      ? target.pendingLegendClasses
      : (target.legendClasses || 0);
    const approvedLegendAgathions = target.pendingLegendAgathions !== undefined && target.pendingLegendAgathions !== null
      ? target.pendingLegendAgathions
      : (target.legendAgathions || 0);
    const primaryClass = approvedClasses.length > 0 ? approvedClasses[0] : (target.characterClass || '');
    const approvedScreenshot = target.pendingStatScreenshotUrl || target.statScreenshotUrl || null;

    const newHistoryPoint: StatHistoryPoint = {
      id: `approval_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      date: Date.now(),
      powerLevel: approvedPower,
      level: approvedLevel,
      classes: approvedClasses,
      damage: approvedStats?.['damage'] || 0,
      accuracy: approvedStats?.['accuracy'] || 0,
      defense: approvedStats?.['defense'] || 0,
      damageReduction: approvedStats?.['damage_reduction'] || 0,
      skillDamageBoost: approvedStats?.['skill_damage_boost_percent'] || 0,
      weaponDamageBoost: approvedStats?.['weapon_damage_boost_percent'] || 0,
      note: `อนุมัติสเตตัสโดย ${currentUser?.inGameName || 'Admin'}`,
      type: 'approval',
      verifiedBy: currentUser?.inGameName || 'Admin',
      statsSnapshot: approvedStats
    };
    const targetHistory = target.statHistory && target.statHistory.length > 0
      ? target.statHistory
      : getOrGenerateStatHistory(target);
    const updatedHistory = [...targetHistory, newHistoryPoint];

    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              powerLevel: approvedPower,
              stats: approvedStats,
              spiritEnhancements: approvedSpirits,
              classes: approvedClasses,
              characterClass: primaryClass,
              level: approvedLevel,
              legendClasses: approvedLegendClasses,
              legendAgathions: approvedLegendAgathions,
              statHistory: updatedHistory,
              pendingPowerLevel: null,
              pendingPowerLevelRequestedAt: null,
              pendingStats: null,
              pendingSpiritEnhancements: null,
              pendingStatScreenshotUrl: null,
              statScreenshotUrl: approvedScreenshot,
              pendingClasses: null,
              pendingLevel: null,
              pendingLegendClasses: null,
              pendingLegendAgathions: null,
              statRejectionReason: null,
              statRejectionAt: null
            }
          : u
      )
    );
    if (currentUser && currentUser.id === userId) {
      setCurrentUser((prev) =>
        prev
          ? {
              ...prev,
              powerLevel: approvedPower,
              stats: approvedStats,
              spiritEnhancements: approvedSpirits,
              classes: approvedClasses,
              characterClass: primaryClass,
              level: approvedLevel,
              legendClasses: approvedLegendClasses,
              legendAgathions: approvedLegendAgathions,
              statHistory: updatedHistory,
              pendingPowerLevel: null,
              pendingPowerLevelRequestedAt: null,
              pendingStats: null,
              pendingSpiritEnhancements: null,
              pendingStatScreenshotUrl: null,
              statScreenshotUrl: approvedScreenshot,
              pendingClasses: null,
              pendingLevel: null,
              pendingLegendClasses: null,
              pendingLegendAgathions: null,
              statRejectionReason: null,
              statRejectionAt: null
            }
          : null
      );
    }
    try {
      await updateUserDoc(userId, {
        powerLevel: approvedPower,
        stats: approvedStats,
        spiritEnhancements: approvedSpirits,
        classes: approvedClasses,
        characterClass: primaryClass,
        level: approvedLevel,
        legendClasses: approvedLegendClasses,
        legendAgathions: approvedLegendAgathions,
        statHistory: updatedHistory,
        pendingPowerLevel: null,
        pendingPowerLevelRequestedAt: null,
        pendingStats: null,
        pendingSpiritEnhancements: null,
        pendingStatScreenshotUrl: null,
        statScreenshotUrl: approvedScreenshot,
        pendingClasses: null,
        pendingLevel: null,
        pendingLegendClasses: null,
        pendingLegendAgathions: null,
        statRejectionReason: null,
        statRejectionAt: null
      });

      showToast(
        lang === 'th'
          ? `อนุมัติสเตตัสใหม่ของ ${target.inGameName} (⚡ ${approvedPower.toLocaleString()} PL) สำเร็จ!`
          : `Approved new stats for ${target.inGameName} (⚡ ${approvedPower.toLocaleString()} PL)!`,
        'success'
      );
    } catch (err) {
      console.error('Failed to approve stat update:', err);
      showToast(lang === 'th' ? 'เกิดข้อผิดพลาดในการอนุมัติ' : 'Failed to approve request', 'error');
    }
  };

  const handleRejectStatUpdate = async (userId: string, reason?: string) => {
    const target = users.find((u) => u.id === userId);
    const rejectionReason = reason || (lang === 'th' ? 'ข้อมูลไม่ตรงกับภาพสกรีนช็อต' : 'Stats do not match screenshot');

    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              pendingPowerLevel: null,
              pendingPowerLevelRequestedAt: null,
              pendingStats: null,
              pendingSpiritEnhancements: null,
              pendingStatScreenshotUrl: null,
              pendingClasses: null,
              pendingLevel: null,
              pendingLegendClasses: null,
              pendingLegendAgathions: null,
              statRejectionReason: rejectionReason,
              statRejectionAt: Date.now()
            }
          : u
      )
    );
    if (currentUser && currentUser.id === userId) {
      setCurrentUser((prev) =>
        prev
          ? {
              ...prev,
              pendingPowerLevel: null,
              pendingPowerLevelRequestedAt: null,
              pendingStats: null,
              pendingSpiritEnhancements: null,
              pendingStatScreenshotUrl: null,
              pendingClasses: null,
              pendingLevel: null,
              pendingLegendClasses: null,
              pendingLegendAgathions: null,
              statRejectionReason: rejectionReason,
              statRejectionAt: Date.now()
            }
          : null
      );
    }
    try {
      await updateUserDoc(userId, {
        pendingPowerLevel: null,
        pendingPowerLevelRequestedAt: null,
        pendingStats: null,
        pendingSpiritEnhancements: null,
        pendingStatScreenshotUrl: null,
        pendingClasses: null,
        pendingLevel: null,
        pendingLegendClasses: null,
        pendingLegendAgathions: null,
        statRejectionReason: rejectionReason,
        statRejectionAt: Date.now()
      });
      showToast(
        lang === 'th'
          ? `ส่งผลการปฏิเสธคำขอของ ${target?.inGameName || 'สมาชิก'} เรียบร้อยแล้ว`
          : `Rejected stat update request for ${target?.inGameName || 'member'}`,
        'info'
      );
    } catch (err) {
      console.error('Failed to reject stat update:', err);
    }
  };

  const handleSaveUserHistory = async (newHistory: StatHistoryPoint[]) => {
    if (!currentUser) return;
    const updatedUser = { ...currentUser, statHistory: newHistory };
    setCurrentUser(updatedUser);
    setUsers((prev) => prev.map((u) => (u.id === currentUser.id ? { ...u, statHistory: newHistory } : u)));
    try {
      await updateUserDoc(currentUser.id, { statHistory: newHistory });
    } catch (err) {
      console.error('Failed to save user history:', err);
    }
  };

  // Bulk Swap Clan Organizer Batch Handler
  const handleBulkUpdateClans = async (swaps: { memberId: string; toClan: string }[]) => {
    const swapMap = new Map(swaps.map((s) => [s.memberId, s.toClan]));
    setUsers((prev) =>
      prev.map((u) => (swapMap.has(u.id) ? { ...u, clan: swapMap.get(u.id)! } : u))
    );
    if (currentUser && swapMap.has(currentUser.id)) {
      setCurrentUser((prev) =>
        prev ? { ...prev, clan: swapMap.get(prev.id)! } : null
      );
    }
    try {
      await Promise.all(
        swaps.map((s) => updateUserDoc(s.memberId, { clan: s.toClan }))
      );
      showToast(
        lang === 'th'
          ? `ย้ายสังกัดสมาชิกสำเร็จ ${swaps.length} คน`
          : `Transferred ${swaps.length} members successfully`,
        'success'
      );
    } catch (err) {
      console.error('Failed to apply bulk clan swaps:', err);
      showToast(lang === 'th' ? 'เกิดข้อผิดพลาดในการย้ายสังกัด' : 'Failed to apply clan swaps', 'error');
    }
  };

  // Legacy manual power level update fallback
  const handleRequestPowerLevelUpdate = async (userId: string, newPowerLevel: number) => {
    const timestamp = Date.now();
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? { ...u, pendingPowerLevel: newPowerLevel, pendingPowerLevelRequestedAt: timestamp }
          : u
      )
    );
    if (currentUser && currentUser.id === userId) {
      setCurrentUser((prev) =>
        prev ? { ...prev, pendingPowerLevel: newPowerLevel, pendingPowerLevelRequestedAt: timestamp } : null
      );
    }
    try {
      await updateUserDoc(userId, {
        pendingPowerLevel: newPowerLevel,
        pendingPowerLevelRequestedAt: timestamp
      });
      showToast(
        lang === 'th'
          ? 'ส่งคำขออัปเดตค่าพลังแล้ว รอ Admin/Owner อนุมัติ'
          : 'PL update request submitted! Waiting for Admin/Owner approval',
        'success'
      );
    } catch (err) {
      console.error('Failed to request power level update:', err);
      showToast(lang === 'th' ? 'เกิดข้อผิดพลาดในการส่งคำขอ' : 'Failed to submit request', 'error');
    }
  };

  const handleCancelPowerLevelRequest = async (userId: string) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              pendingPowerLevel: null,
              pendingPowerLevelRequestedAt: null,
              pendingStats: null,
              pendingSpiritEnhancements: null,
              pendingStatScreenshotUrl: null,
              pendingClasses: null,
              pendingLevel: null,
              pendingLegendClasses: null,
              pendingLegendAgathions: null
            }
          : u
      )
    );
    if (currentUser && currentUser.id === userId) {
      setCurrentUser((prev) =>
        prev
          ? {
              ...prev,
              pendingPowerLevel: null,
              pendingPowerLevelRequestedAt: null,
              pendingStats: null,
              pendingSpiritEnhancements: null,
              pendingStatScreenshotUrl: null,
              pendingClasses: null,
              pendingLevel: null,
              pendingLegendClasses: null,
              pendingLegendAgathions: null
            }
          : null
      );
    }
    try {
      await updateUserDoc(userId, {
        pendingPowerLevel: null,
        pendingPowerLevelRequestedAt: null,
        pendingStats: null,
        pendingSpiritEnhancements: null,
        pendingStatScreenshotUrl: null,
        pendingClasses: null,
        pendingLevel: null,
        pendingLegendClasses: null,
        pendingLegendAgathions: null
      });
      showToast(
        lang === 'th' ? 'ยกเลิกคำขออัปเดตค่าพลังแล้ว' : 'PL update request cancelled',
        'info'
      );
    } catch (err) {
      console.error('Failed to cancel power level request:', err);
    }
  };

  const handleApprovePowerLevelUpdate = async (userId: string) => {
    await handleApproveStatUpdate(userId);
  };

  const handleRejectPowerLevelUpdate = async (userId: string) => {
    await handleRejectStatUpdate(userId);
  };

  const handleBatchDeleteMembers = async (userIds: string[]) => {
    const idSet = new Set(userIds);
    const count = userIds.length;
    setUsers((prev) => prev.filter((u) => !idSet.has(u.id)));
    try {
      for (const uid of userIds) {
        await deleteUserDoc(uid);
      }
      showToast(
        lang === 'th' ? `ลบสมาชิกทั้งหมด ${count} คนสำเร็จ` : `Deleted ${count} members successfully`,
        'info'
      );
    } catch (err) {
      console.error('Failed to batch delete member:', err);
      showToast(lang === 'th' ? 'เกิดข้อผิดพลาดในการลบสมาชิกแบบกลุ่ม' : 'Failed to batch delete members', 'error');
    }
  };

  // Helper to determine if an item is distributed (bulletproof safeguard against status mismatch)
  const isItemDistributed = (item: VaultItem) => {
    if (item.status === 'distributed') return true;
    if (item.distributedTo && Boolean(item.distributedTo.name || item.distributedTo.userId)) return true;
    return false;
  };

  // Available items to show on Dashboard (status === 'available' and not distributed) filtered by Clan Scope
  const availableDashboardItems = useMemo(() => {
    const available = vaultItems.filter((i) => i.status === 'available' && !isItemDistributed(i));
    if (!selectedClanScope || selectedClanScope === 'all') return available;
    const scope = cleanClanName(selectedClanScope).toLowerCase();
    return available.filter((item) =>
      item.hunters?.some((h) => cleanClanName(h.clan).toLowerCase() === scope) ||
      item.claimants?.some((c) => cleanClanName(c.clan).toLowerCase() === scope)
    );
  }, [vaultItems, selectedClanScope]);

  // If user is not logged in, display the centered Login/Register screen before entering the app
  if (!currentUser) {
    return (
      <div className="relative min-h-screen bg-[#04070d] text-slate-100 overflow-x-hidden font-prompt selection:bg-[#d4af37]/30 selection:text-[#f5d77f]">
        {/* Fantasy Castle Background Layer */}
        <div
          className="fixed inset-0 pointer-events-none z-0 bg-cover bg-center bg-no-repeat transition-all duration-700"
          style={{
            backgroundImage: `url('${bgConfig.imageUrl || '/fantasy-original.png'}')`,
            filter: `brightness(${bgConfig.brightness}%) blur(${bgConfig.blur}px)`
          }}
        />
        {/* Contrast Vignette Overlay */}
        <div
          className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-500"
          style={{
            background: `radial-gradient(ellipse at 50% 35%, rgba(6, 11, 23, ${bgConfig.vignetteOpacity * 0.4}) 0%, rgba(4, 7, 16, ${bgConfig.vignetteOpacity * 0.85}) 60%, rgba(2, 4, 10, ${bgConfig.vignetteOpacity}) 100%)`
          }}
        />
        <div className="fixed inset-0 pointer-events-none z-0 bg-gradient-to-b from-transparent via-[#0284c7]/5 to-[#02050b]/80" />

        <div className="relative z-10">
          <LoginScreen
            lang={lang}
            onToggleLanguage={handleToggleLanguage}
            soundEnabled={soundEnabled}
            onToggleSound={handleToggleSound}
            onLogin={handleLogin}
            onRegister={handleRegister}
            users={users}
            clans={clans}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#04070d] text-slate-100 flex flex-col font-prompt selection:bg-[#d4af37]/30 selection:text-[#f5d77f]">
      
      {/* 0. IMMERSIVE FANTASY CASTLE BACKGROUND */}
      <div
        className="fixed inset-0 pointer-events-none z-0 bg-cover bg-center bg-no-repeat transition-all duration-700"
        style={{
          backgroundImage: `url('${bgConfig.imageUrl || '/fantasy-original.png'}')`,
          filter: `brightness(${bgConfig.brightness}%) blur(${bgConfig.blur}px)`
        }}
      />
      {/* Atmospheric Contrast Vignette */}
      <div
        className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-500"
        style={{
          background: `radial-gradient(ellipse at 50% 25%, rgba(6, 11, 23, ${bgConfig.vignetteOpacity * 0.35}) 0%, rgba(4, 7, 16, ${bgConfig.vignetteOpacity * 0.8}) 65%, rgba(2, 4, 10, ${bgConfig.vignetteOpacity}) 100%)`
        }}
      />
      <div className="fixed inset-0 pointer-events-none z-0 bg-gradient-to-b from-transparent via-[#0284c7]/5 to-[#02050b]/85" />

      {/* 1. LEFT SIDEBAR & MOBILE HEADER */}
      <Sidebar
        lang={lang}
        activeTab={activeTab}
        onTabChange={(tab) => {
          sounds.playClick();
          if (!canAccessAdminFeatures && (tab === 'vault' || tab === 'bulk_swap' || tab === 'stat_approvals' || tab === 'power_formula')) {
            setActiveTab('dashboard');
            return;
          }
          setActiveTab(tab);
        }}
        currentUser={currentUser}
        onOpenAuth={() => {
          sounds.playClick();
          setShowAuthModal(true);
        }}
        onLogout={handleLogout}
        vaultBalance={vaultBalance}
        onOpenVaultModal={() => {
          sounds.playClick();
          setShowVaultModal(true);
        }}
        onToggleLanguage={handleToggleLanguage}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        onOpenBgModal={isOwner ? () => setShowBgModal(true) : undefined}
        onOpenDiscordModal={isOwner ? () => setShowDiscordModal(true) : undefined}
        onOpenGeminiModal={isOwner ? () => setShowGeminiModal(true) : undefined}
        onOpenGoogleBackupModal={isOwner ? () => setShowGoogleBackupModal(true) : undefined}
        onOpenRequestCp={() => setActiveTab('my_stats')}
        onOpenMyStats={() => setActiveTab('my_stats')}
        onOpenChangePassword={currentUser ? () => setPasswordTargetUser(currentUser) : undefined}
        onOpenPowerFormula={() => setActiveTab('power_formula')}
        onOpenBulkSwap={() => setActiveTab('bulk_swap')}
        onOpenStatApproval={() => setActiveTab('stat_approvals')}
        pendingStatApprovalCount={users.filter((u) => u.pendingPowerLevel && u.pendingPowerLevel > 0).length}
        discordEnabled={discordSettings?.enabled}
        pendingQueueCount={queueItems.filter((i) => i.status === 'queued').length}
        selectedClanScope={selectedClanScope}
        onSelectClanScope={setSelectedClanScope}
        clans={clans}
        allMembers={users}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        unreadNotificationCount={unreadNotificationCount}
        onOpenNotifications={() => setShowNotificationModal(true)}
        isQuotaExceeded={isQuotaExceeded}
        onCheckFirebaseHealth={handleManualCheckFirebase}
      />

      {/* 2. MAIN CONTENT AREA (Padded on left for desktop sidebar: lg:pl-64 xl:pl-72) */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0 lg:pl-64 xl:pl-72 min-h-screen">
        {/* Guild Ticker Announcement Bar */}
        <AnnouncementBar
          announcement={announcementSettings}
          currentUser={currentUser}
          lang={lang}
          onSaveAnnouncement={handleSaveAnnouncement}
        />

        <main className="flex-1 w-full max-w-full 2xl:max-w-[1920px] mx-auto px-2.5 sm:px-4 md:px-6 lg:px-7 py-3 sm:py-5 min-w-0 transition-all">
          {activeTab === 'dashboard' && (
          <DashboardView
            lang={lang}
            currentUser={currentUser}
            vaultBalance={vaultBalance}
            transactions={diamondLogs}
            onOpenVaultModal={() => setShowVaultModal(true)}
            availableItems={availableDashboardItems}
            queueItems={queueItems}
            onClaimItem={handleClaimItem}
            onUnclaimItem={handleUnclaimItem}
            onViewClaimants={(item) => setClaimantsTargetItem(item)}
            onOpenDistributeModal={(item) => setDistributeTargetItem(item)}
            onNavigateTab={(tab) => {
              if (!canAccessAdminFeatures && (tab === 'vault' || tab === 'clan')) return;
              setActiveTab(tab);
            }}
            onOpenAuth={() => setShowAuthModal(true)}
            onViewImage={(url, title) => setImageViewerData({ url, title })}
            onOpenOwnerResetModal={() => setShowOwnerResetModal(true)}
            onDeleteItem={handleDeleteVaultItem}
            onEditItem={(item) => setEditingVaultItem(item)}
            allMembers={users}
            distributedItems={vaultItems.filter((i) => isItemDistributed(i))}
            clans={clans}
            onBroadcastToDiscord={handleBroadcastItemToDiscord}
            isQuotaExceeded={isQuotaExceeded}
            onOpenGoogleBackupModal={isOwner ? () => setShowGoogleBackupModal(true) : undefined}
            onCheckFirebaseHealth={handleManualCheckFirebase}
            onConfirmPayment={handleConfirmPayment}
          />
        )}

        {activeTab === 'vault' && canAccessAdminFeatures && (
          <VaultView
            lang={lang}
            currentUser={currentUser}
            allMembers={users}
            vaultItems={vaultItems}
            quickItems={quickItems}
            onOpenQuickItemsModal={() => setShowQuickItemsModal(true)}
            onCreateVaultItem={handleCreateVaultItem}
            onDeleteVaultItem={handleDeleteVaultItem}
            onViewImageZoom={(url, title, images, currentIndex) =>
              setImageViewerData({ url, title, images, currentIndex })
            }
            onOpenOwnerResetModal={() => setShowOwnerResetModal(true)}
            onConfirmPayment={handleConfirmPayment}
          />
        )}

        {activeTab === 'queue' && (
          <QueueView
            lang={lang}
            currentUser={currentUser}
            allMembers={users}
            queueItems={queueItems}
            quickItems={quickItems}
            onOpenQuickItemsModal={() => setShowQuickItemsModal(true)}
            onCreateQueueItem={handleCreateQueueItem}
            onDeleteQueueItem={handleDeleteQueueItem}
            onUpdateQueueMembers={handleUpdateQueueMembers}
            onOpenOwnerResetModal={() => setShowOwnerResetModal(true)}
            onOpenAuth={() => setShowAuthModal(true)}
            showToast={showToast}
            onViewImageZoom={(url, title) => setImageViewerData({ url, title })}
          />
        )}

        {activeTab === 'all_members' && (
          <MembersView
            lang={lang}
            currentUser={currentUser}
            allMembers={users}
            clans={clans}
            selectedClanScope={selectedClanScope}
            onSelectClanScope={setSelectedClanScope}
            onOpenRequestCp={() => setActiveTab('my_stats')}
            onOpenBulkSwap={() => setActiveTab('bulk_swap')}
            onApproveMember={handleApproveMember}
            onRejectMember={handleRejectMember}
            onApproveCpUpdate={handleApprovePowerLevelUpdate}
            onRejectCpUpdate={handleRejectPowerLevelUpdate}
            onUpdateMember={handleUpdateMember}
            onDeleteMember={handleDeleteMember}
            onChangePassword={(user) => setPasswordTargetUser(user)}
            onOpenStatApproval={() => setActiveTab('stat_approvals')}
            onViewImageZoom={(url, title, images, currentIndex) =>
              setImageViewerData({ url, title, images, currentIndex })
            }
          />
        )}

        {activeTab === 'clans' && (
          <ClanRosterView
            lang={lang}
            currentUser={currentUser}
            allMembers={users}
            clans={clans}
            onNavigateToBulkSwap={() => setActiveTab('bulk_swap')}
          />
        )}

        {activeTab === 'bulk_swap' && canAccessAdminFeatures && (
          <ClanView
            lang={lang}
            currentUser={currentUser}
            allMembers={users}
            clans={clans}
            onAddClan={handleAddClan}
            onUpdateClan={handleUpdateClan}
            onDeleteClan={handleDeleteClan}
            onReorderClans={handleReorderClans}
            onMoveMemberClan={handleMoveMemberClan}
            onBatchMoveMembers={handleBatchMoveMembersClan}
            onToggleClanVisibility={handleToggleClanVisibility}
            onDeleteMember={handleDeleteMember}
            onBatchDeleteMembers={handleBatchDeleteMembers}
            onNavigateToClans={() => setActiveTab('clans')}
          />
        )}

        {activeTab === 'bulk_swap' && !canAccessAdminFeatures && (
          <div className="p-8 text-center bg-slate-900/80 rounded-2xl border border-slate-800">
            <p className="text-slate-300 font-semibold mb-4">
              {lang === 'th' ? 'หน้านี้สำหรับ Admin และ Owner เท่านั้น' : 'This page is restricted to Admin and Owner.'}
            </p>
            <button
              onClick={() => setActiveTab('clans')}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#aa841c] text-slate-950 font-bold text-xs cursor-pointer"
            >
              {lang === 'th' ? 'กลับไปหน้าแคลน' : 'Go to Clans'}
            </button>
          </div>
        )}

        {activeTab === 'my_stats' && (
          <MyStatsView
            currentUser={currentUser}
            lang={lang}
            clans={clans}
            onUpdateMember={handleUpdateMember}
            onRequestStatUpdate={handleRequestStatUpdate}
            onCancelPendingRequest={handleCancelPowerLevelRequest}
            onNavigateTab={(tab) => setActiveTab(tab)}
            showToast={showToast}
            onViewImageZoom={(url, title) => setImageViewerData({ url, title })}
            onSaveHistory={handleSaveUserHistory}
            onOpenChangePassword={currentUser ? () => setPasswordTargetUser(currentUser) : undefined}
          />
        )}

        {activeTab === 'stat_approvals' && canAccessAdminFeatures && (
          <StatApprovalView
            pendingUsers={users.filter((u) => u.pendingPowerLevel && u.pendingPowerLevel > 0)}
            lang={lang}
            onApproveStatUpdate={handleApproveStatUpdate}
            onRejectStatUpdate={handleRejectStatUpdate}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onViewImageZoom={(url, title) => setImageViewerData({ url, title })}
            showToast={showToast}
          />
        )}

        {activeTab === 'power_formula' && canAccessAdminFeatures && (
          <PowerFormulaView
            lang={lang}
            showToast={showToast}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'power_formula' && !canAccessAdminFeatures && (
          <div className="p-8 text-center bg-slate-900/80 rounded-2xl border border-slate-800">
            <p className="text-slate-300 font-semibold mb-4">
              {lang === 'th' ? 'หน้านี้สำหรับ Admin และ Owner เท่านั้น' : 'This page is restricted to Admin and Owner.'}
            </p>
            <button
              onClick={() => setActiveTab('dashboard')}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#aa841c] text-slate-950 font-bold text-xs cursor-pointer"
            >
              {lang === 'th' ? 'กลับไปหน้าหลัก' : 'Go to Dashboard'}
            </button>
          </div>
        )}
      </main>

      {/* 3. FOOTER */}
      <footer className="border-t border-[#1c2942]/60 bg-[#04060a]/90 py-5 text-center text-xs text-slate-500 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="font-cinzel text-slate-400 font-bold">
            LINEAGE 2M • CLAN HUB
          </div>
          <div className="text-[11px] text-slate-600">
            Firebase: K7-item (hybrid-box-753bd) • Bilingual EN/TH Active
          </div>
        </div>
      </footer>
      </div>

      {/* 4. MODALS */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        lang={lang}
        onLogin={handleLogin}
        onRegister={handleRegister}
        users={users}
      />

      <RequestPowerLevelModal
        isOpen={showRequestCpModal}
        onClose={() => setShowRequestCpModal(false)}
        currentUser={currentUser}
        lang={lang}
        onRequestUpdate={handleRequestPowerLevelUpdate}
        onCancelRequest={handleCancelPowerLevelRequest}
      />

      <DiamondVaultModal
        isOpen={showVaultModal}
        onClose={() => setShowVaultModal(false)}
        lang={lang}
        currentUser={currentUser}
        vaultBalance={vaultBalance}
        transactions={diamondLogs}
        onPerformTransaction={handleVaultTransaction}
        clans={clans}
        allMembers={users}
        onUpdateNote={handleUpdateVaultNote}
        onResetVaultBalance={handleResetVaultBalance}
      />

      {distributeTargetItem && canAccessAdminFeatures && (
        <DistributeItemModal
          isOpen={true}
          onClose={() => {
            setDistributeTargetItem(null);
            setDistributeClaimantId(undefined);
          }}
          item={distributeTargetItem}
          lang={lang}
          currentUser={currentUser}
          allMembers={users}
          initialClaimantUserId={distributeClaimantId}
          onDistribute={handleDistributeItem}
        />
      )}

      {editingVaultItem && canAccessAdminFeatures && (
        <EditVaultItemModal
          isOpen={Boolean(editingVaultItem)}
          onClose={() => setEditingVaultItem(null)}
          item={editingVaultItem}
          lang={lang}
          currentUser={currentUser}
          allMembers={users}
          quickItems={quickItems}
          vaultItems={vaultItems}
          onUpdateItem={handleUpdateVaultItem}
          onViewImageZoom={(url, title) => setImageViewerData({ url, title })}
          onBroadcastToDiscord={handleBroadcastItemToDiscord}
        />
      )}

      {claimantsTargetItem && (
        <ClaimantsModal
          isOpen={true}
          onClose={() => setClaimantsTargetItem(null)}
          item={claimantsTargetItem}
          lang={lang}
          currentUser={currentUser}
          allMembers={users}
          onUnclaim={handleUnclaimItem}
          onDistributeToClaimant={(item, claimant) => {
            setClaimantsTargetItem(null);
            setDistributeClaimantId(claimant.userId || claimant.inGameName);
            setDistributeTargetItem(item);
          }}
        />
      )}

      {showNotificationModal && (
        <NotificationModal
          isOpen={showNotificationModal}
          onClose={() => setShowNotificationModal(false)}
          lang={lang}
          notifications={notifications}
          onMarkAllAsRead={handleMarkAllNotificationsAsRead}
          onClearNotifications={handleClearNotifications}
          onDeleteNotification={handleDeleteNotification}
          onOpenDistributeModal={(item) => {
            setShowNotificationModal(false);
            setDistributeTargetItem(item);
          }}
          onViewClaimants={(item) => {
            setShowNotificationModal(false);
            setClaimantsTargetItem(item);
          }}
          onNavigateTab={(tab) => {
            setShowNotificationModal(false);
            setActiveTab(tab);
          }}
          onViewImageZoom={(url, title) => setImageViewerData({ url, title, images: [url], currentIndex: 0 })}
        />
      )}

      {passwordTargetUser && (
        <ChangePasswordModal
          isOpen={Boolean(passwordTargetUser)}
          onClose={() => setPasswordTargetUser(null)}
          targetUser={passwordTargetUser}
          currentUser={currentUser}
          lang={lang}
          onSubmit={handleChangePassword}
        />
      )}

      <QuickItemModal
        isOpen={showQuickItemsModal && canAccessAdminFeatures}
        onClose={() => setShowQuickItemsModal(false)}
        lang={lang}
        currentUser={currentUser}
        quickItems={quickItems}
        onAddQuickItem={handleAddQuickItem}
        onUpdateQuickItem={handleUpdateQuickItem}
        onDeleteQuickItem={handleDeleteQuickItem}
      />

      {isOwner && (
        <BackgroundSettingsModal
          isOpen={showBgModal}
          onClose={() => setShowBgModal(false)}
          lang={lang}
          config={bgConfig}
          onChangeConfig={handleUpdateBackgroundConfig}
          isOwner={isOwner}
        />
      )}

      <OwnerResetModal
        isOpen={showOwnerResetModal}
        onClose={() => setShowOwnerResetModal(false)}
        lang={lang}
        currentUser={currentUser}
        vaultItemsCount={availableDashboardItems.length}
        distributedItemsCount={vaultItems.filter((i) => isItemDistributed(i)).length}
        queuesCount={queueItems.length}
        diamondLogsCount={diamondLogs.length}
      />

      <DiscordWebhookModal
        isOpen={showDiscordModal && isOwner}
        onClose={() => setShowDiscordModal(false)}
        settings={discordSettings || getCachedDiscordSettings()}
        onSaveSettings={handleSaveDiscordSettings}
        currentUser={currentUser}
        lang={lang}
        vaultItemsCount={availableDashboardItems.length}
        onSyncAllToDiscord={handleSyncAllItemsToDiscord}
      />

      {broadcastTargetItem && isOwner && (
        <DiscordBroadcastModal
          isOpen={Boolean(broadcastTargetItem)}
          onClose={() => setBroadcastTargetItem(null)}
          item={broadcastTargetItem}
          settings={discordSettings}
          currentUser={currentUser}
          lang={lang}
          onConfirmBroadcast={handleConfirmBroadcast}
        />
      )}



      {/* Gemini AI OCR Settings Modal */}
      <GeminiKeyModal
        isOpen={showGeminiModal}
        onClose={() => setShowGeminiModal(false)}
        lang={lang}
        isOwner={currentUser?.role === 'owner'}
      />

      {/* Google Sheets & Drive Backup Modal (Owner Only) */}
      <GoogleDriveBackupModal
        isOpen={showGoogleBackupModal}
        onClose={() => setShowGoogleBackupModal(false)}
        lang={lang}
        isOwner={currentUser?.role === 'owner'}
        currentData={{
          users,
          vaultItems,
          queueItems,
          clans,
          diamondLogs,
          vaultBalance,
          formulaSettings: getFormulaSettings()
        }}
        onDataRestored={(restored) => {
          if (restored.users && restored.users.length > 0) setUsers(restored.users);
          if (restored.vaultItems && restored.vaultItems.length > 0) setVaultItems(restored.vaultItems);
          if (restored.queueItems) setQueueItems(restored.queueItems);
          if (restored.clans && restored.clans.length > 0) setClans(restored.clans);
          if (restored.diamondLogs) setDiamondLogs(restored.diamondLogs);
          if (restored.formulaSettings) saveFormulaSettings(restored.formulaSettings);
        }}
        showToast={showToast}
      />



      {/* Global Fullscreen Image Viewer Modal */}
      {imageViewerData && (
        <ImageViewerModal
          isOpen={!!imageViewerData}
          onClose={() => setImageViewerData(null)}
          imageUrl={imageViewerData.url}
          title={imageViewerData.title}
          images={imageViewerData.images}
          initialIndex={imageViewerData.currentIndex}
          lang={lang}
        />
      )}

      {/* In-App Toast Notification (Replaces native alert/blocking popups) */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-300">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md text-xs font-semibold max-w-md ${
              toast.type === 'error'
                ? 'bg-red-950/95 border-red-500/80 text-red-100 shadow-red-950/60'
                : toast.type === 'success'
                ? 'bg-emerald-950/95 border-emerald-500/80 text-emerald-100 shadow-emerald-950/60'
                : toast.type === 'warning'
                ? 'bg-amber-950/95 border-amber-500/80 text-amber-100 shadow-amber-950/60'
                : 'bg-[#0b121e]/95 border-[#d4af37]/80 text-[#f5d77f] shadow-black/90'
            }`}
          >
            <div className="shrink-0">
              {toast.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-red-400" />
              ) : toast.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              ) : (
                <Sparkles className="w-4 h-4 text-[#d4af37]" />
              )}
            </div>
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
