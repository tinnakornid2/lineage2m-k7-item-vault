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
  GeneralItem,
  User,
  VaultItem,
  Claimant,
  AnnouncementSettings,
  QueueAnnouncementSettings,
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
  DiscordMentionType,
  isItemDistributed,
  normalizeDistributedItem,
  DirectDistributionPayload,
  StatUpdateSettings,
  DEFAULT_STAT_UPDATE_SETTINGS
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
  listenToGeneralItems,
  listenToClans,
  listenToDiamondTransactions,
  listenToBackgroundSettings,
  saveBackgroundSettingsDoc,
  listenToAnnouncementSettings,
  saveAnnouncementSettingsDoc,
  subscribeToQueueAnnouncementSettings,
  saveQueueAnnouncementSettingsDoc,
  listenToDiscordSettings,
  saveDiscordSettingsDoc,
  getCachedDiscordSettings,
  DEFAULT_DISCORD_SETTINGS,
  listenToStatUpdateSettings,
  saveStatUpdateSettingsDoc,
  getCachedStatUpdateSettings,
  addVaultItemDoc,
  updateVaultItemDoc,
  deleteVaultItemDoc,
  addQueueItemDoc,
  updateQueueItemDoc,
  deleteQueueItemDoc,
  addQuickItemDoc,
  updateQuickItemDoc,
  deleteQuickItemDoc,
  addGeneralItemDoc,
  updateGeneralItemDoc,
  deleteGeneralItemDoc,
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
  getCurrentUserIdToken,
  auth,
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
  getCachedQuickItems,
  setCachedQuickItems,
  getCachedGeneralItems,
  setCachedGeneralItems,
  setOnQuotaExceededListener,
  syncBackupToFirestore,
  forceCheckAndFetchFirestore,
  testFirestoreHealth,
  mergeVaultItems,
  mergeQueueItems,
  mergeGeneralItems,
  mergeUsers,
  clearAllLocalCaches,
  markVaultItemAsDeleted,
  unmarkVaultItemAsDeleted,
  markQueueItemAsDeleted,
  unmarkQueueItemAsDeleted,
  markUserAsDeleted,
  unmarkUserAsDeleted,
  markGeneralItemAsDeleted,
  markQueueMemberAsRemoved,
  listenToGlobalTombstones,
  getDeletedUserIds,
  markClaimAsCancelled,
  unmarkClaimAsCancelled,
  ensureFirebaseAuthSession
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
  backupAllDataToGoogleSheets,
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
  applyIncomingSyncMeta,
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

        // Note: Default to 'dashboard' on clean base URL so all users see the same landing page
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
  const [generalItems, setGeneralItems] = useState<GeneralItem[]>(() => getCachedGeneralItems());
  const [clans, setClans] = useState<ClanGroup[]>(() => getCachedClans());
  const [diamondLogs, setDiamondLogs] = useState<DiamondVaultRecord[]>(() => getCachedDiamondTransactions());
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [showGoogleBackupModal, setShowGoogleBackupModal] = useState(false);

  useEffect(() => {
    const unsubTombstones = listenToGlobalTombstones();
    // Always hydrate from the durable Google snapshot first. Firestore listeners
    // then replace it with newer cloud values when that service is available.
    let cancelled = false;
    (async () => {
      await initSharedGoogleBackupConfig();
      if (!isQuotaExceeded) return;
      const google = await fetchDataFromGoogleSheets();
      if (cancelled || !google.success || !google.data) return;
      const data = google.data;
      if (data.vaultItems && data.vaultItems.length > 0) {
        setVaultItems((prev) => {
          const merged = mergeVaultItems(prev, data.vaultItems);
          setCachedVaultItems(merged);
          return merged;
        });
      }
      if (data.queueItems && data.queueItems.length > 0) {
        setQueueItems((prev) => {
          const merged = mergeQueueItems(prev, data.queueItems);
          setCachedQueues(merged);
          return merged;
        });
      }
      if (data.users && data.users.length > 0) {
        setUsers((prev) => {
          const mergedUsers = mergeUsers(prev, data.users);
          setCachedUsers(mergedUsers);
          return mergedUsers;
        });
      }
      if (data.quickItems && data.quickItems.length > 0) {
        setQuickItems(data.quickItems);
        setCachedQuickItems(data.quickItems);
      }
      if (data.generalItems && data.generalItems.length > 0) {
        setGeneralItems((prev) => {
          const merged = mergeGeneralItems(prev, data.generalItems);
          setCachedGeneralItems(merged);
          return merged;
        });
      }
      if (data.clans && data.clans.length > 0) {
        setClans(data.clans);
        setCachedClans(data.clans);
      }
      if (data.diamondLogs && data.diamondLogs.length > 0) {
        setDiamondLogs(data.diamondLogs);
        setCachedDiamondTransactions(data.diamondLogs);
      }
    })().catch(console.warn);

    // Proactively load active live relay state from server if available
    fetch(`/api/live-state?v=0&_t=${Date.now()}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.modified && json.data) {
          applyIncomingSyncMeta(json.data);
          setLastBroadcastPayload(json.data);
          if (Array.isArray(json.data.users) && json.data.users.length > 0) {
            setUsers((prev) => {
              const merged = mergeUsers(prev, json.data.users);
              setCachedUsers(merged);
              return merged;
            });
          }
          if (Array.isArray(json.data.vaultItems)) {
            setVaultItems((prev) => {
              const merged = mergeVaultItems(prev, json.data.vaultItems);
              setCachedVaultItems(merged);
              return merged;
            });
          }
          if (Array.isArray(json.data.queueItems)) {
            setQueueItems((prev) => {
              const merged = mergeQueueItems(prev, json.data.queueItems);
              setCachedQueues(merged);
              return merged;
            });
          }
          if (Array.isArray(json.data.quickItems)) {
            setQuickItems(json.data.quickItems);
            setCachedQuickItems(json.data.quickItems);
          }
          if (Array.isArray(json.data.generalItems)) {
            setGeneralItems((prev) => {
              const merged = mergeGeneralItems(prev, json.data.generalItems);
              setCachedGeneralItems(merged);
              return merged;
            });
          }
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
              if (res.data.users && res.data.users.length > 0) {
                setUsers((prev) => {
                  const merged = mergeUsers(prev, res.data.users);
                  setCachedUsers(merged);
                  return merged;
                });
              }
              if (res.data.vaultItems && res.data.vaultItems.length > 0) {
                setVaultItems((prev) => {
                  const merged = mergeVaultItems(prev, res.data.vaultItems);
                  setCachedVaultItems(merged);
                  return merged;
                });
              }
              if (res.data.quickItems && res.data.quickItems.length > 0) {
                setQuickItems(res.data.quickItems);
                setCachedQuickItems(res.data.quickItems);
              }
              if (res.data.generalItems && res.data.generalItems.length > 0) {
                setGeneralItems((prev) => {
                  const merged = mergeGeneralItems(prev, res.data.generalItems);
                  setCachedGeneralItems(merged);
                  return merged;
                });
              }
              if (res.data.queueItems) {
                setQueueItems((prev) => {
                  const merged = mergeQueueItems(prev, res.data.queueItems);
                  setCachedQueues(merged);
                  return merged;
                });
              }
              if (res.data.clans && res.data.clans.length > 0) setClans(res.data.clans);
              if (res.data.diamondLogs) setDiamondLogs(res.data.diamondLogs);
            }
          }).catch(console.warn);
        }
      }
    });
    return () => {
      cancelled = true;
      unsubTombstones();
    };
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
  const [queueAnnouncement, setQueueAnnouncement] = useState<QueueAnnouncementSettings | null>(null);
  const [discordSettings, setDiscordSettings] = useState<DiscordSettings | null>(null);
  const [statUpdateSettings, setStatUpdateSettings] = useState<StatUpdateSettings>(() => getCachedStatUpdateSettings());
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

  // Cloud Synchronization & Cache Management
  const [isSyncingData, setIsSyncingData] = useState(false);

  const handleForceCloudSync = async () => {
    sounds.playClick();
    setIsSyncingData(true);
    showToast(
      lang === 'th'
        ? '🔄 กำลังดึงและซิงค์ข้อมูลล่าสุดจากคลาวด์...'
        : '🔄 Fetching and syncing latest data from cloud...',
      'info'
    );
    try {
      // 1. Fetch latest snapshot from Google Sheets
      const google = await fetchDataFromGoogleSheets();
      if (google.success && google.data) {
        const data = google.data;
        if (data.vaultItems && data.vaultItems.length > 0) {
          setVaultItems((prev) => {
            const merged = mergeVaultItems(prev, data.vaultItems);
            setCachedVaultItems(merged);
            return merged;
          });
        }
        if (data.queueItems && data.queueItems.length > 0) {
          setQueueItems((prev) => {
            const merged = mergeQueueItems(prev, data.queueItems);
            setCachedQueues(merged);
            return merged;
          });
        }
        if (data.users && data.users.length > 0) {
          setUsers((prev) => {
            const merged = mergeUsers(prev, data.users);
            setCachedUsers(merged);
            return merged;
          });
        }
        if (data.clans && data.clans.length > 0) {
          setClans(data.clans);
          setCachedClans(data.clans);
        }
        if (data.diamondLogs && data.diamondLogs.length > 0) {
          setDiamondLogs(data.diamondLogs);
          setCachedDiamondTransactions(data.diamondLogs);
        }
        if (data.quickItems && data.quickItems.length > 0) {
          setQuickItems(data.quickItems);
          setCachedQuickItems(data.quickItems);
        }
        if (data.generalItems && data.generalItems.length > 0) {
          setGeneralItems((prev) => {
            const merged = mergeGeneralItems(prev, data.generalItems);
            setCachedGeneralItems(merged);
            return merged;
          });
        }
      }

      // 2. Also check and merge Firestore if logged in and not quota exceeded
      if (currentUser && !isQuotaExceeded) {
        try {
          const cloudRes = await forceCheckAndFetchFirestore();
          if (cloudRes.success && cloudRes.data) {
            if (cloudRes.data.vaultItems?.length) {
              setVaultItems((prev) => {
                const merged = mergeVaultItems(prev, cloudRes.data.vaultItems);
                setCachedVaultItems(merged);
                return merged;
              });
            }
            if (cloudRes.data.queueItems?.length) {
              setQueueItems((prev) => {
                const merged = mergeQueueItems(prev, cloudRes.data.queueItems);
                setCachedQueues(merged);
                return merged;
              });
            }
            if (cloudRes.data.users?.length) {
              setUsers((prev) => {
                const merged = mergeUsers(prev, cloudRes.data.users);
                setCachedUsers(merged);
                return merged;
              });
            }
          }
        } catch (e) {}
      }

      showToast(
        lang === 'th'
          ? '✅ ซิงค์ข้อมูลล่าสุดจากคลาวด์สำเร็จ! ข้อมูลในหน้านี้เป็นปัจจุบันแล้ว'
          : '✅ Successfully synced latest data from cloud! Everything is up to date.',
        'success'
      );
    } catch (err: any) {
      console.error('Force sync error:', err);
      showToast(
        lang === 'th'
          ? '⚠️ ไม่สามารถซิงค์ข้อมูลได้ กรุณาลองใหม่อีกครั้ง'
          : '⚠️ Failed to sync data, please try again.',
        'error'
      );
    } finally {
      setIsSyncingData(false);
    }
  };

  const handleClearCacheAndReload = () => {
    sounds.playClick();
    const confirmed = window.confirm(
      lang === 'th'
        ? 'ต้องการล้างแคชในเครื่องและรีเฟรชหน้าเว็บใช่หรือไม่?\n(ข้อมูลไอเทมและสมาชิกบนคลาวด์จะไม่สูญหาย)'
        : 'Clear local browser cache and reload the page?\n(Cloud items and member data are safe)'
    );
    if (confirmed) {
      clearAllLocalCaches();
      window.location.reload();
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
      if (isItemDistributed(item)) return;

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
      if (isUserStatsPending(u)) {
        const reqTimestamp = u.pendingPowerLevelRequestedAt || u.updatedAt || 0;
        const notifId = `stat_req_${u.id}_${reqTimestamp}`;
        if (dismissedNotificationIds.includes(notifId)) return;
        const th = lang === 'th';
        const displayPL = u.pendingPowerLevel != null ? Number(u.pendingPowerLevel) : (u.powerLevel || 0);
        list.push({
          id: notifId,
          type: 'stat_request',
          title: th
            ? `${u.inGameName || u.username} (${cleanClanName(u.clan) || 'Alliance'}) ส่งคำขออัปเดตสเตตัส`
            : `${u.inGameName || u.username} (${cleanClanName(u.clan) || 'Alliance'}) requested stats update`,
          description: th
            ? `ค่าพลังใหม่: ⚡ ${displayPL.toLocaleString()} PL (รอ Admin ตรวจสอบและอนุมัติ)`
            : `New Power Level: ⚡ ${displayPL.toLocaleString()} PL (Pending Admin verification)`,
          timestamp: u.pendingPowerLevelRequestedAt || u.updatedAt || Date.now(),
          read: readNotificationIds.includes(notifId),
          user: u
        });
      }
    });

    // 3. Requests from General Item Queue (queueList pending)
    generalItems.forEach((gItem) => {
      (gItem.queueList || []).forEach((m) => {
        if (m.status === 'received') return;
        const notifId = `gen_claim_${gItem.id}_${m.id}_${m.joinedAt || 0}`;
        if (dismissedNotificationIds.includes(notifId)) return;
        const th = lang === 'th';
        list.push({
          id: notifId,
          type: 'claim',
          title: th
            ? `${m.name} (${cleanClanName(m.clan) || 'VoltZ'}) ขอรับไอเทมทั่วไป`
            : `${m.name} (${cleanClanName(m.clan) || 'VoltZ'}) requested general item`,
          description: th
            ? `ขอรับ [${gItem.rarity || 'RARE'}] ${gItem.name} (x${gItem.quantity || 1}) • ${gItem.price > 0 ? `💎 ${gItem.price.toLocaleString()} เพชร` : '🎁 ฟรี'} • ⚡ ${m.powerLevel ? `${m.powerLevel.toLocaleString()} PL` : '0 PL'}`
            : `Requested [${gItem.rarity || 'RARE'}] ${gItem.name} (x${gItem.quantity || 1}) • ${gItem.price > 0 ? `💎 ${gItem.price.toLocaleString()} Dia` : '🎁 Free'} • ⚡ ${m.powerLevel ? `${m.powerLevel.toLocaleString()} PL` : '0 PL'}`,
          timestamp: m.joinedAt || gItem.createdAt || Date.now(),
          read: readNotificationIds.includes(notifId),
          generalItem: gItem,
          item: {
            id: gItem.id,
            name: gItem.name,
            imageUrl: gItem.imageUrl,
            price: gItem.price,
            minPowerLevel: gItem.minPowerLevel,
            rarity: gItem.rarity,
            quantity: gItem.quantity,
            hunters: [],
            hunterScreenshots: [],
            status: 'available',
            claimants: [],
            createdAt: gItem.createdAt
          } as VaultItem,
          claimant: {
            userId: m.userId || m.id,
            inGameName: m.name,
            clan: m.clan,
            powerLevel: m.powerLevel || 0,
            claimedAt: m.joinedAt || gItem.createdAt || Date.now()
          }
        });
      });
    });

    // 4. Pending member registration requests (for Admin & Owner)
    if (currentUser?.role === 'admin' || currentUser?.role === 'owner') {
      users.forEach((u) => {
        if (u.status === 'pending_approval' || (u.status as any) === 'pending') {
          const notifId = `reg_pending_${u.id}_${u.createdAt || 0}`;
          if (dismissedNotificationIds.includes(notifId)) return;
          const th = lang === 'th';
          list.push({
            id: notifId,
            type: 'member_registration',
            title: th
              ? `👤 สมาชิกสมัครใหม่: ${u.inGameName || u.username} (${cleanClanName(u.clan) || 'Alliance'})`
              : `👤 New Member Registration: ${u.inGameName || u.username} (${cleanClanName(u.clan) || 'Alliance'})`,
            description: th
              ? `ชื่อในเกม: ${u.inGameName || u.username} • แคลน: ${cleanClanName(u.clan) || '-'} • รอ Admin/Owner ตรวจสอบและอนุมัติเข้าใช้งาน`
              : `IGN: ${u.inGameName || u.username} • Clan: ${cleanClanName(u.clan) || '-'} • Awaiting Admin/Owner approval`,
            timestamp: u.createdAt || Date.now(),
            read: readNotificationIds.includes(notifId),
            user: u
          });
        }
      });
    }

    // Sort newest first
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [vaultItems, generalItems, users, lang, readNotificationIds, dismissedNotificationIds, currentUser]);

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
      if (isItemDistributed(item)) return;

      (item.claimants || []).forEach((c) => {
        const key = `vault_${item.id}_${c.userId || c.inGameName}_${c.claimedAt || 0}`;
        currentClaimKeys.add(key);
        currentClaimsList.push({ item, claimant: c });
      });
    });

    // Detect General Items queue requests as well
    generalItems.forEach((gItem) => {
      (gItem.queueList || []).forEach((m) => {
        if (m.status === 'received') return;
        const key = `gen_${gItem.id}_${m.userId || m.id}_${m.joinedAt || 0}`;
        currentClaimKeys.add(key);
        currentClaimsList.push({
          item: {
            id: gItem.id,
            name: gItem.name,
            imageUrl: gItem.imageUrl,
            price: gItem.price,
            minPowerLevel: gItem.minPowerLevel,
            rarity: gItem.rarity,
            quantity: gItem.quantity,
            hunters: [],
            hunterScreenshots: [],
            status: 'available',
            claimants: [],
            createdAt: gItem.createdAt
          } as VaultItem,
          claimant: {
            userId: m.userId || m.id,
            inGameName: m.name,
            clan: m.clan,
            powerLevel: m.powerLevel || 0,
            claimedAt: m.joinedAt || gItem.createdAt || Date.now()
          }
        });
      });
    });

    // Initial load: record existing claims without playing chime or showing toast
    if (!hasInitializedClaimsRef.current) {
      if (vaultItems.length > 0 || generalItems.length > 0) {
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
            `${item.id.startsWith('gen') ? 'gen' : 'vault'}_${item.id}_${claimant.userId || claimant.inGameName}_${claimant.claimedAt || 0}`
          ) &&
          claimant.userId !== currentUser?.id &&
          (claimant.claimedAt || 0) >= pageLoadedAtRef.current - 2000
      );

      if (newClaims.length > 0) {
        sounds.playNotification();
        const newest = newClaims[newClaims.length - 1];
        showToast(
          lang === 'th'
            ? `🔔 ${newest.claimant.inGameName} (${cleanClanName(newest.claimant.clan) || 'VoltZ'}) ขอรับ [${newest.item.name}]!`
            : `🔔 ${newest.claimant.inGameName} (${cleanClanName(newest.claimant.clan) || 'VoltZ'}) requested [${newest.item.name}]!`,
          'info'
        );
      }
    }

    previousClaimKeysRef.current = currentClaimKeys;
  }, [vaultItems, generalItems, currentUser, lang]);

  // Real-time detection of new member registrations to alert Admin & Owner
  const previousPendingUserIdsRef = useRef<Set<string> | null>(null);
  const hasInitializedPendingUsersRef = useRef(false);

  useEffect(() => {
    const isPrivileged = currentUser?.role === 'owner' || currentUser?.role === 'admin';
    if (!isPrivileged) return;

    const currentPendingUsers = users.filter((u) => u.status === 'pending_approval' || (u.status as any) === 'pending');
    const currentPendingIds = new Set(currentPendingUsers.map((u) => u.id));

    // Initial load: record existing pending users without playing chime or showing toast
    if (!hasInitializedPendingUsersRef.current) {
      if (users.length > 0) {
        previousPendingUserIdsRef.current = currentPendingIds;
        hasInitializedPendingUsersRef.current = true;
      }
      return;
    }

    if (previousPendingUserIdsRef.current === null) {
      previousPendingUserIdsRef.current = currentPendingIds;
      return;
    }

    const newlyRegistered = currentPendingUsers.filter(
      (u) => !previousPendingUserIdsRef.current!.has(u.id) && u.id !== currentUser?.id
    );

    if (newlyRegistered.length > 0) {
      sounds.playNotification();
      const newest = newlyRegistered[newlyRegistered.length - 1];
      showToast(
        lang === 'th'
          ? `👤 มีสมาชิกสมัครใหม่: ${newest.inGameName || newest.username} (${cleanClanName(newest.clan) || 'Alliance'}) รอการอนุมัติ!`
          : `👤 New member registered: ${newest.inGameName || newest.username} (${cleanClanName(newest.clan) || 'Alliance'}) pending approval!`,
        'info'
      );
    }

    previousPendingUserIdsRef.current = currentPendingIds;
  }, [users, currentUser, lang]);

  // Real-time detection of new stat update requests to alert Admin & Owner
  const previousPendingStatKeysRef = useRef<Set<string> | null>(null);
  const hasInitializedPendingStatsRef = useRef(false);

  useEffect(() => {
    const isPrivileged = currentUser?.role === 'owner' || currentUser?.role === 'admin';
    if (!isPrivileged) return;

    const currentPendingUsers = users.filter((u) => isUserStatsPending(u));
    const currentKeys = new Set(
      currentPendingUsers.map((u) => `${u.id}_${u.pendingPowerLevelRequestedAt || u.updatedAt || 0}`)
    );

    // Initial load: record existing pending stat requests without playing chime or showing toast
    if (!hasInitializedPendingStatsRef.current) {
      if (users.length > 0) {
        previousPendingStatKeysRef.current = currentKeys;
        hasInitializedPendingStatsRef.current = true;
      }
      return;
    }

    if (previousPendingStatKeysRef.current === null) {
      previousPendingStatKeysRef.current = currentKeys;
      return;
    }

    const newlyRequested = currentPendingUsers.filter((u) => {
      const key = `${u.id}_${u.pendingPowerLevelRequestedAt || u.updatedAt || 0}`;
      return !previousPendingStatKeysRef.current!.has(key) && u.id !== currentUser?.id;
    });

    if (newlyRequested.length > 0) {
      sounds.playNotification();
      const newest = newlyRequested[newlyRequested.length - 1];
      const displayPL = newest.pendingPowerLevel != null ? Number(newest.pendingPowerLevel) : (newest.powerLevel || 0);
      showToast(
        lang === 'th'
          ? `⚡ มีคำขออัปเดตสเตตัสใหม่: ${newest.inGameName || newest.username} (${cleanClanName(newest.clan) || 'Alliance'}) ⚡ ${displayPL.toLocaleString()} PL รอตรวจสอบ!`
          : `⚡ New stat update request: ${newest.inGameName || newest.username} (${cleanClanName(newest.clan) || 'Alliance'}) ⚡ ${displayPL.toLocaleString()} PL pending approval!`,
        'info'
      );
    }

    previousPendingStatKeysRef.current = currentKeys;
  }, [users, currentUser, lang]);

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
    // Stop listeners while quota failover is active. Google becomes the live source then.
    if (isQuotaExceeded) return;
    ensureFirebaseAuthSession(currentUser);
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
        setVaultItems((prev) => {
          const merged = mergeVaultItems(prev, items);
          setCachedVaultItems(merged);
          return merged;
        });
      }
    });
    const unsubQueue = listenToQueueItems((items) => {
      if (items && items.length > 0) {
        setQueueItems((prev) => {
          const merged = mergeQueueItems(prev, items);
          setCachedQueues(merged);
          return merged;
        });
      }
    });
    const unsubQuick = listenToQuickItems((items) => {
      if (items && items.length > 0) {
        setQuickItems(items);
      }
    });
    const unsubGeneral = listenToGeneralItems(setGeneralItems);
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
    const unsubQueueAnnouncement = subscribeToQueueAnnouncementSettings((settings) => {
      if (settings) setQueueAnnouncement(settings);
    });
    const unsubDiscord = listenToDiscordSettings((settings) => {
      if (settings) setDiscordSettings(settings);
    });
    const unsubFormula = listenToFormulaSettings((settings) => {
      if (settings) setInMemoryFormulaSettings(settings);
    });
    const unsubStatUpdates = listenToStatUpdateSettings((settings) => {
      if (settings) setStatUpdateSettings(settings);
    });

    return () => {
      unsubUsers();
      unsubVault();
      unsubQueue();
      unsubQuick();
      unsubGeneral();
      unsubClans();
      unsubDiamonds();
      unsubBg();
      unsubAnnouncement();
      unsubQueueAnnouncement();
      unsubDiscord();
      unsubFormula();
      unsubStatUpdates();
    };
  }, [currentUser?.id, isQuotaExceeded]);

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
        quickItems,
        generalItems,
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
  }, [users, vaultItems, quickItems, generalItems, queueItems, clans, diamondLogs, vaultBalance, isQuotaExceeded, announcementSettings, bgConfig, discordSettings]);

  // Keep local cache in sync whenever core collections update (survives quota limits and offline refreshes)
  useEffect(() => {
    setCachedVaultItems(vaultItems);
  }, [vaultItems]);

  useEffect(() => {
    if (users.length > 0) {
      setCachedUsers(users);
    }
  }, [users]);

  useEffect(() => {
    setCachedQueues(queueItems);
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

  useEffect(() => {
    if (quickItems.length > 0) {
      setCachedQuickItems(quickItems);
    }
  }, [quickItems]);

  useEffect(() => {
    if (generalItems.length > 0) {
      setCachedGeneralItems(generalItems);
    }
  }, [generalItems]);

  // Real-time live relay broadcast: whenever state changes locally, immediately notify all other clan members (debounced 300ms)
  useEffect(() => {
    if (!currentUser || !auth.currentUser) return;
    if (users.length === 0 && vaultItems.length === 0) return;
    if (getIsApplyingRemoteUpdate()) return;

    const timer = setTimeout(() => {
      broadcastLiveState(
        {
          users,
          vaultItems,
          quickItems,
          generalItems,
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
  }, [users, vaultItems, quickItems, generalItems, queueItems, clans, diamondLogs, vaultBalance, announcementSettings, bgConfig, discordSettings]);

  // Real-time live synchronization engine across all devices (Dual-Cloud Resilience)
  useEffect(() => {
    startGoogleRealtimeSync((incomingData: BackupDataPayload) => {
      if (!incomingData) return;
      if (Array.isArray(incomingData.users) && incomingData.users.length > 0) {
        setUsers((prev) => {
          const merged = mergeUsers(prev, incomingData.users);
          setCachedUsers(merged);
          return merged;
        });
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
          const merged = mergeVaultItems(prev, incomingData.vaultItems);
          setCachedVaultItems(merged);
          return merged;
        });
      }
      if (Array.isArray(incomingData.quickItems)) {
        setQuickItems(incomingData.quickItems);
      }
      if (Array.isArray(incomingData.generalItems)) {
        setGeneralItems((prev) => {
          const merged = mergeGeneralItems(prev, incomingData.generalItems);
          setCachedGeneralItems(merged);
          return merged;
        });
      }
      if (Array.isArray(incomingData.queueItems)) {
        setQueueItems((prev) => {
          const merged = mergeQueueItems(prev, incomingData.queueItems);
          setCachedQueues(merged);
          return merged;
        });
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

    return () => {
      stopGoogleRealtimeSync();
    };
  }, []);

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
              quickItems,
              generalItems,
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
              if (cloudRes.data.users && cloudRes.data.users.length > 0) {
                setUsers((prev) => {
                  const merged = mergeUsers(prev, cloudRes.data.users);
                  setCachedUsers(merged);
                  return merged;
                });
              }
              if (cloudRes.data.vaultItems && cloudRes.data.vaultItems.length > 0) {
                setVaultItems((prev) => {
                  const merged = mergeVaultItems(prev, cloudRes.data.vaultItems);
                  setCachedVaultItems(merged);
                  return merged;
                });
              }
              if (cloudRes.data.queueItems) {
                setQueueItems((prev) => {
                  const merged = mergeQueueItems(prev, cloudRes.data.queueItems);
                  setCachedQueues(merged);
                  return merged;
                });
              }
              if (cloudRes.data.quickItems) setQuickItems(cloudRes.data.quickItems);
              if (cloudRes.data.generalItems) {
                setGeneralItems((prev) => {
                  const merged = mergeGeneralItems(prev, cloudRes.data.generalItems);
                  setCachedGeneralItems(merged);
                  return merged;
                });
              }
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

    // Probe every 5 minutes to avoid consuming Firestore reads while quota is exhausted.
    const interval = setInterval(checkRecoveryAndAutoSync, 300000);

    // 2. Also probe immediately on window focus
    const handleFocus = () => {
      checkRecoveryAndAutoSync();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isQuotaExceeded, users, vaultItems, queueItems, quickItems, generalItems, clans, diamondLogs, lang]);

  // Auth Handlers
  const handleLogin = async (username: string, pass: string): Promise<{ success: boolean; message?: string }> => {
    const user = await loginUserQuery(username, pass, users);
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
      : users.find(
          (u) =>
            u.id === user.id ||
            (u.username && u.username.toLowerCase() === user.username?.toLowerCase()) ||
            (u.inGameName && u.inGameName.toLowerCase() === user.inGameName?.toLowerCase())
        );

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
    clan?: string;
    characterClass?: any;
    powerLevel?: number;
  }): Promise<{ success: boolean; message?: string }> => {
    try {
      const lowerNewUser = data.username.trim().toLowerCase();
      const lowerNewIgn = data.inGameName.trim().toLowerCase();

      // Check if username or in-game character name already exists
      const existing = users.find(
        (u) =>
          u.username?.trim().toLowerCase() === lowerNewUser ||
          u.inGameName?.trim().toLowerCase() === lowerNewIgn
      );
      if (existing) {
        const isDuplicateUser = existing.username?.trim().toLowerCase() === lowerNewUser;
        return {
          success: false,
          message:
            lang === 'th'
              ? isDuplicateUser
                ? 'มีชื่อผู้ใช้นี้ในระบบแล้ว กรุณาใช้ชื่ออื่น'
                : 'มีชื่อตัวละครนี้ในระบบแล้ว กรุณาใช้ชื่ออื่น'
              : isDuplicateUser
                ? 'Username already registered. Please choose another.'
                : 'Character name already registered. Please choose another.'
        };
      }

      const registered = await registerUserDoc({
        username: data.username,
        password: data.password,
        inGameName: data.inGameName
      });

      unmarkUserAsDeleted(registered.id);

      // Update local state and cached users immediately
      const updatedUsers = [...users, registered];
      setUsers(updatedUsers);
      setCachedUsers(updatedUsers);

      // Trigger debounced auto-backup to Google Sheets
      const googleConfig = getGoogleBackupConfig();
      if (googleConfig.webAppUrl) {
        triggerDebouncedAutoBackup(
          {
            users: updatedUsers,
            vaultItems,
            queueItems,
            clans,
            diamondLogs,
            vaultBalance: computeTotalVaultBalance(diamondLogs)
          },
          'New Member Registration',
          true
        );
      }

      return {
        success: true,
        message:
          lang === 'th'
            ? 'ลงทะเบียนสำเร็จ! กรุณารอแอดมินหรือโอเนอร์อนุมัติบัญชีของคุณ'
            : 'Registration submitted! Please wait for Admin/Owner approval.'
      };
    } catch (err: any) {
      console.error('Registration failed:', err);
      return {
        success: false,
        message: err.message || (lang === 'th' ? 'การลงทะเบียนล้มเหลว' : 'Registration failed')
      };
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

  const handleRecordDiamondLog = async (record: Omit<DiamondVaultRecord, 'id' | 'timestamp'>) => {
    const full = await addDiamondTransactionDoc(record);
    setDiamondLogs((prev) => [full, ...prev]);
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

  const handleSaveQueueAnnouncement = async (newSettings: QueueAnnouncementSettings) => {
    setQueueAnnouncement(newSettings);
    try {
      await saveQueueAnnouncementSettingsDoc(newSettings);
      showToast(
        lang === 'th' ? 'บันทึกข้อความประกาศคิวสำเร็จแล้ว' : 'Queue announcement updated successfully',
        'success'
      );
    } catch (err) {
      console.error('Failed to save queue announcement:', err);
      showToast(
        lang === 'th' ? 'เกิดข้อผิดพลาดในการบันทึกประกาศคิว' : 'Failed to update queue announcement',
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


  // Stat Updates Lock/Unlock Handler (Owner only)
  const handleToggleStatUpdates = async (allow: boolean) => {
    if (currentUser?.role !== 'owner') {
      showToast(lang === 'th' ? 'เฉพาะ Owner เท่านั้นที่มีสิทธิ์กำหนด' : 'Only Owner can change this setting', 'error');
      return;
    }
    const nextSettings: StatUpdateSettings = {
      allowMemberUpdates: allow,
      updatedAt: Date.now(),
      updatedBy: currentUser?.inGameName || currentUser?.username || 'Owner'
    };
    setStatUpdateSettings(nextSettings);
    sounds.playClick();
    try {
      await saveStatUpdateSettingsDoc(nextSettings);
      sounds.playSuccess();
      showToast(
        allow
          ? (lang === 'th' ? '🔓 เปิดรับการอัปเดตสเตตัสประจำเดือนเรียบร้อยแล้ว' : '🔓 Monthly stat updates unlocked for members!')
          : (lang === 'th' ? '🔒 ล็อกการอัปเดตสเตตัสประจำเดือนเรียบร้อยแล้ว' : '🔒 Monthly stat updates locked for members!'),
        'success'
      );
    } catch (err) {
      console.error('Failed to update stat settings:', err);
      showToast(lang === 'th' ? 'เกิดข้อผิดพลาดในการบันทึก' : 'Failed to update settings', 'error');
    }
  };

  // Vault Items Handlers
  const handleCreateVaultItem = async (
    itemData: Omit<VaultItem, 'id' | 'createdAt' | 'status' | 'claimants'>,
    directDistribution?: DirectDistributionPayload
  ) => {
    try {
      const isDirectDistribute = Boolean(directDistribution && directDistribution.recipient);
      const initialPaymentStatus = directDistribution?.paymentStatus || 'pending';
      const recName = directDistribution?.recipient?.name || directDistribution?.recipient?.inGameName || 'Member';

      const distributedPayload: any = isDirectDistribute
        ? {
            name: recName,
            clan: directDistribution!.recipient.clan,
            date: Date.now(),
            distributedAt: Date.now(),
            distributedBy: currentUser?.inGameName || currentUser?.username || 'Admin',
            price: itemData.price || 0,
            userId: directDistribution!.recipient.userId,
            receiptImages: directDistribution!.receiptImages || [],
            paymentStatus: initialPaymentStatus,
            slipUrl:
              directDistribution!.receiptImages && directDistribution!.receiptImages.length > 0
                ? directDistribution!.receiptImages[0]
                : undefined
          }
        : undefined;

      const createdItem = await addVaultItemDoc({
        ...itemData,
        status: isDirectDistribute ? 'distributed' : 'available',
        claimants: [],
        ...(isDirectDistribute
          ? {
              distributedTo: distributedPayload,
              receiptImages: directDistribution!.receiptImages || [],
              paymentStatus: initialPaymentStatus
            }
          : {})
      });

      unmarkVaultItemAsDeleted(createdItem.id);
      setPendingFirebaseSync(true);

      // 1. Optimistic UI update immediately so user sees the new item instantly
      const nextVaultItems: VaultItem[] = [createdItem, ...vaultItems.filter((i) => i.id !== createdItem.id)];
      setVaultItems(nextVaultItems);
      setCachedVaultItems(nextVaultItems);

      // Instant live state broadcast (< 20ms) to ensure server relay and all clan tabs have the new item
      broadcastLiveState(
        {
          users,
          vaultItems: nextVaultItems,
          queueItems,
          clans,
          diamondLogs,
          vaultBalance,
          formulaSettings: getFormulaSettings()
        },
        currentUser?.inGameName || currentUser?.username || 'Admin'
      );

      sounds.playSuccess();
      if (isDirectDistribute) {
        showToast(
          lang === 'th'
            ? `แจกไอเทม [${createdItem.name}] ให้กับ ${recName} เรียบร้อยแล้ว!`
            : `Directly distributed [${createdItem.name}] to ${recName}!`,
          'success'
        );
      } else {
        showToast(
          lang === 'th'
            ? `เพิ่มไอเทม [${createdItem.name}] เข้าคลังเรียบร้อยแล้ว!`
            : `Added [${createdItem.name}] to vault successfully!`,
          'success'
        );
      }

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

      // 3. Discord notification if enabled (Rule 5: English 100%, item-only)
      const activeDiscord = discordSettings || getCachedDiscordSettings();
      const localWebhookUrl = (typeof window !== 'undefined' ? localStorage.getItem('vault_discord_webhook_url') || '' : '');
      const localDistWebhookUrl = (typeof window !== 'undefined' ? localStorage.getItem('vault_discord_distribute_webhook_url') || '' : '');
      const effectiveWebhookUrl = activeDiscord?.webhookUrl || localWebhookUrl;
      const effectiveDistWebhookUrl = activeDiscord?.distributeWebhookUrl || localDistWebhookUrl;

      if (isDirectDistribute) {
        // Direct Distribution: send notification strictly to Distribution channel (event: 'distribute')
        const isDistDiscordActive = Boolean(activeDiscord?.enabled || effectiveDistWebhookUrl);
        if (isDistDiscordActive && (activeDiscord?.notifyOnDistribute ?? true)) {
          const payloadSettings: DiscordSettings = {
            ...DEFAULT_DISCORD_SETTINGS,
            ...activeDiscord,
            enabled: true,
            webhookUrl: effectiveDistWebhookUrl,
            distributeWebhookUrl: effectiveDistWebhookUrl
          };
          sendDiscordNotification(payloadSettings, 'distribute', {
            item: createdItem,
            distributeInfo: distributedPayload,
            actorName: currentUser?.inGameName || currentUser?.username || 'Admin',
            webhookUrl: effectiveDistWebhookUrl
          }).then((res) => {
            if (res.success) {
              showToast(
                lang === 'th'
                  ? `📢 ส่งผลการแจก [${createdItem.name}] เข้า Discord ห้องแจกเรียบร้อย!`
                  : `📢 Sent [${createdItem.name}] distribution result to Discord!`,
                'info'
              );
            }
          }).catch((err) => console.warn('Discord direct distribute error:', err));
        }
      } else {
        // Normal Vault Entry: send notification to Item Entry channel (event: 'new_item')
        const isDiscordActive = Boolean(activeDiscord?.enabled || effectiveWebhookUrl);
        if (isDiscordActive && (activeDiscord?.notifyOnNewItem ?? true)) {
          const payloadSettings: DiscordSettings = {
            ...DEFAULT_DISCORD_SETTINGS,
            ...activeDiscord,
            enabled: true,
            webhookUrl: effectiveWebhookUrl
          };
          sendDiscordNotification(payloadSettings, 'new_item', {
            item: createdItem,
            actorName: currentUser?.inGameName || currentUser?.username || 'Admin',
            lang,
            template: activeDiscord?.messageTemplate || 'neon_glow',
            webhookUrl: effectiveWebhookUrl
          }).then((res) => {
            if (res.success) {
              showToast(
                lang === 'th'
                  ? `📢 ส่งแจ้งเตือน [${createdItem.name}] เข้า Discord เรียบร้อยแล้ว!`
                  : `📢 Sent [${createdItem.name}] alert to Discord!`,
                'info'
              );
            } else {
              console.warn('Discord notification notice:', res.message);
            }
          }).catch((err) => console.warn('Discord notification error:', err));
        }
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
    markVaultItemAsDeleted(itemId);
    setPendingFirebaseSync(true);
    const nextVaultItems: VaultItem[] = vaultItems.filter((i) => i.id !== itemId);
    setVaultItems(nextVaultItems);
    setCachedVaultItems(nextVaultItems);

    broadcastLiveState(
      {
        users,
        vaultItems: nextVaultItems,
        queueItems,
        clans,
        diamondLogs,
        vaultBalance,
        formulaSettings: getFormulaSettings()
      },
      currentUser?.inGameName || currentUser?.username || 'Admin'
    );

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
    if (isItemDistributed(item)) {
      sounds.playClick();
      showToast(
        lang === 'th' ? 'ไอเทมนี้ถูกแจกจ่ายไปแล้ว' : 'This item has already been distributed',
        'info'
      );
      return;
    }

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

    const previousVaultItems = vaultItems;

    try {
      const token = await getCurrentUserIdToken();
      if (!token) {
        showToast(
          lang === 'th' ? 'กรุณาเข้าสู่ระบบก่อนลงชื่อเคลม' : 'Please login before claiming',
          'error'
        );
        return;
      }

      const res = await fetch('/api/claim-vault-item', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ itemId })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMsg = errorData.message || (lang === 'th' ? 'การลงชื่อเคลมไม่สำเร็จ' : 'Failed to claim item');
        showToast(errorMsg, 'error');
        return;
      }

      const responseData = await res.json();
      const authoritativeClaimant: Claimant = responseData.claimant || {
        userId: currentUser.id,
        inGameName: currentUser.inGameName,
        clan: currentUser.clan,
        powerLevel: currentUser.powerLevel || 0,
        claimedAt: Date.now()
      };

      const now = Date.now();
      const currentClaimants = (item.claimants || []).filter(
        (c) => c.userId !== authoritativeClaimant.userId &&
               (!authoritativeClaimant.inGameName || c.inGameName?.trim().toLowerCase() !== authoritativeClaimant.inGameName.trim().toLowerCase())
      );
      const updatedClaimants = [...currentClaimants, authoritativeClaimant];

      const nextVaultItems = vaultItems.map((it) =>
        it.id === itemId ? { ...it, claimants: updatedClaimants, updatedAt: now } : it
      );

      // Update state and cache
      setVaultItems(nextVaultItems);
      setCachedVaultItems(nextVaultItems);

      // Clear cancellation tombstone if this user previously cancelled
      if (currentUser.id) {
        unmarkClaimAsCancelled(itemId, currentUser.id);
      }
      if (currentUser.inGameName) {
        unmarkClaimAsCancelled(itemId, currentUser.inGameName);
      }

      // Real-time broadcast and immediate Google Sheets backup
      broadcastLiveState(
        {
          users,
          vaultItems: nextVaultItems,
          quickItems,
          generalItems,
          queueItems,
          clans,
          diamondLogs,
          vaultBalance,
          formulaSettings: getFormulaSettings()
        },
        currentUser?.inGameName || currentUser?.username || 'Member'
      );

      triggerDebouncedAutoBackup(
        {
          users,
          vaultItems: nextVaultItems,
          quickItems,
          generalItems,
          queueItems,
          clans,
          diamondLogs,
          vaultBalance,
          formulaSettings: getFormulaSettings()
        },
        currentUser?.inGameName || currentUser?.username || 'Member',
        true
      );

      showToast(
        lang === 'th' ? 'ลงชื่อเครมไอเทมสำเร็จ!' : 'Claim submitted successfully!',
        'success'
      );
    } catch (err: any) {
      console.error('Failed to claim item via backend:', err);
      setVaultItems(previousVaultItems);
      setCachedVaultItems(previousVaultItems);
      showToast(
        lang === 'th' ? 'เกิดข้อผิดพลาดในการลงชื่อเคลม' : 'Error submitting claim',
        'error'
      );
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
    if (!item || isItemDistributed(item)) return;

    const previousVaultItems = vaultItems;

    try {
      const token = await getCurrentUserIdToken();
      if (!token) {
        showToast(
          lang === 'th' ? 'กรุณาเข้าสู่ระบบก่อนยกเลิกการเคลม' : 'Please login before cancelling claim',
          'error'
        );
        return;
      }

      const res = await fetch('/api/unclaim-vault-item', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ itemId, userId: userIdToRemove, inGameName: inGameNameToRemove })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMsg = errorData.message || (lang === 'th' ? 'ยกเลิกการลงชื่อเคลมไม่สำเร็จ' : 'Failed to cancel claim');
        showToast(errorMsg, 'error');
        return;
      }

      // Record cancellation tombstone
      if (userIdToRemove) {
        markClaimAsCancelled(itemId, userIdToRemove);
      }
      if (inGameNameToRemove) {
        markClaimAsCancelled(itemId, inGameNameToRemove);
      }

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

      const now = Date.now();
      const nextVaultItems = vaultItems.map((it) =>
        it.id === itemId ? { ...it, claimants: updatedClaimants, updatedAt: now } : it
      );

      setVaultItems(nextVaultItems);
      setCachedVaultItems(nextVaultItems);

      if (claimantsTargetItem && claimantsTargetItem.id === itemId) {
        setClaimantsTargetItem({
          ...claimantsTargetItem,
          claimants: updatedClaimants,
          updatedAt: now
        });
      }

      broadcastLiveState(
        {
          users,
          vaultItems: nextVaultItems,
          quickItems,
          generalItems,
          queueItems,
          clans,
          diamondLogs,
          vaultBalance,
          formulaSettings: getFormulaSettings()
        },
        currentUser?.inGameName || currentUser?.username || 'Member'
      );

      triggerDebouncedAutoBackup(
        {
          users,
          vaultItems: nextVaultItems,
          quickItems,
          generalItems,
          queueItems,
          clans,
          diamondLogs,
          vaultBalance,
          formulaSettings: getFormulaSettings()
        },
        currentUser?.inGameName || currentUser?.username || 'Member',
        true
      );

      showToast(
        lang === 'th' ? 'ยกเลิกการลงชื่อเครมสำเร็จ' : 'Claim cancelled successfully',
        'info'
      );
    } catch (err: any) {
      console.error('Failed to unclaim item via backend:', err);
      setVaultItems(previousVaultItems);
      setCachedVaultItems(previousVaultItems);
      showToast(
        lang === 'th' ? 'เกิดข้อผิดพลาดในการยกเลิกการเคลม' : 'Error cancelling claim',
        'error'
      );
    }
  };

  // Update/Edit Vault Item Handler
  const handleUpdateVaultItem = async (
    itemId: string,
    updates: Partial<VaultItem>
  ) => {
    const now = Date.now();
    const versionedUpdates = { ...updates, updatedAt: now };
    const nextVaultItems: VaultItem[] = vaultItems.map((it) => (it.id === itemId ? { ...it, ...versionedUpdates } : it));
    setVaultItems(nextVaultItems);
    setCachedVaultItems(nextVaultItems);

    try {
      await updateVaultItemDoc(itemId, versionedUpdates);
      showToast(
        lang === 'th' ? 'อัปเดตข้อมูลไอเทมเรียบร้อยแล้ว' : 'Item updated successfully',
        'success'
      );

      broadcastLiveState(
        {
          users,
          vaultItems: nextVaultItems,
          queueItems,
          clans,
          diamondLogs,
          vaultBalance,
          formulaSettings: getFormulaSettings()
        },
        currentUser?.inGameName || currentUser?.username || 'Admin'
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

      // 1. Synchronously construct nextVaultItems with the distributed status & payload
      const nextVaultItems: VaultItem[] = vaultItems.map((i) =>
        i.id === itemId
          ? {
              ...i,
              status: 'distributed' as const,
              distributedTo: distributedPayload,
              receiptImages: recipient.receiptImages || [],
              paymentStatus: initialPaymentStatus,
              updatedAt: Date.now()
            }
          : i
      );

      // 2. Immediate local state and cache update (< 1ms zero lag)
      setVaultItems(nextVaultItems);
      setCachedVaultItems(nextVaultItems);

      // 3. Broadcast immediately to live relay server (< 20ms) so all screens stay in sync
      broadcastLiveState(
        {
          users,
          vaultItems: nextVaultItems,
          queueItems,
          clans,
          diamondLogs,
          vaultBalance,
          formulaSettings: getFormulaSettings()
        },
        currentUser?.inGameName || currentUser?.username || 'Admin'
      );

      // 4. Dual-cloud failover: Immediately back up to Google Sheets & Drive with updated items
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

      // 5. Update Firestore with setDoc merge
      try {
        await updateVaultItemDoc(itemId, {
          status: 'distributed',
          distributedTo: distributedPayload,
          receiptImages: recipient.receiptImages || [],
          paymentStatus: initialPaymentStatus,
          updatedAt: Date.now()
        });
      } catch (firestoreErr) {
        console.warn('Notice: Firestore update distributed item failover:', firestoreErr);
      }

      // Send Discord notification if enabled (Rule 5: English 100%)
      const activeDistDiscord = discordSettings || getCachedDiscordSettings();
      const localDistWebhookUrl = (typeof window !== 'undefined' ? localStorage.getItem('vault_discord_distribute_webhook_url') || '' : '');
      const effectiveDistWebhookUrl = activeDistDiscord?.distributeWebhookUrl || localDistWebhookUrl;
      const isDistDiscordActive = Boolean(activeDistDiscord?.enabled || effectiveDistWebhookUrl);

      if (targetItem && isDistDiscordActive && (activeDistDiscord?.notifyOnDistribute ?? true)) {
        const payloadSettings: DiscordSettings = {
          ...DEFAULT_DISCORD_SETTINGS,
          ...activeDistDiscord,
          enabled: true,
          webhookUrl: effectiveDistWebhookUrl,
          distributeWebhookUrl: effectiveDistWebhookUrl
        };
        sendDiscordNotification(payloadSettings, 'distribute', {
          item: { ...targetItem, status: 'distributed', distributedTo: distributedPayload, paymentStatus: initialPaymentStatus },
          distributeInfo: distributedPayload,
          actorName: currentUser?.inGameName || currentUser?.username || 'Admin',
          webhookUrl: effectiveDistWebhookUrl
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
    const nextVaultItems: VaultItem[] = vaultItems.map((i) => {
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
        distributedTo: updatedDistributedTo,
        updatedAt: now
      };
    });
    setVaultItems(nextVaultItems);
    setCachedVaultItems(nextVaultItems);

    broadcastLiveState(
      {
        users,
        vaultItems: nextVaultItems,
        queueItems,
        clans,
        diamondLogs,
        vaultBalance,
        formulaSettings: getFormulaSettings()
      },
      actorName
    );

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
      unmarkQueueItemAsDeleted(createdQueue.id);
      setPendingFirebaseSync(true);
      const nextQueues = [createdQueue, ...queueItems.filter((q) => q.id !== createdQueue.id)];
      setQueueItems(nextQueues);
      setCachedQueues(nextQueues);

      broadcastLiveState(
        {
          users,
          vaultItems,
          queueItems: nextQueues,
          clans,
          diamondLogs,
          vaultBalance,
          formulaSettings: getFormulaSettings()
        },
        currentUser?.inGameName || currentUser?.username || 'Admin'
      );

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
    markQueueItemAsDeleted(queueId);
    setPendingFirebaseSync(true);
    const nextQueues = queueItems.filter((q) => q.id !== queueId);
    setQueueItems(nextQueues);
    setCachedQueues(nextQueues);

    broadcastLiveState(
      {
        users,
        vaultItems,
        queueItems: nextQueues,
        generalItems,
        quickItems,
        clans,
        diamondLogs,
        vaultBalance,
        formulaSettings: getFormulaSettings()
      },
      currentUser?.inGameName || currentUser?.username || 'Admin'
    );

    try {
      await deleteQueueItemDoc(queueId);
      showToast(lang === 'th' ? 'ลบคิวสำเร็จ' : 'Queue deleted', 'info');
    } catch (err) {
      console.error('Failed to delete queue item:', err);
    }
  };

  const handleUpdateQueueMembers = async (queueId: string, members: QueueMember[]) => {
    // 1. Optimistic UI update immediately
    const now = Date.now();
    const nextQueues = queueItems.map((q) => (q.id === queueId ? { ...q, queueList: members, updatedAt: now } : q));
    setQueueItems(nextQueues);
    setCachedQueues(nextQueues);

    broadcastLiveState(
      {
        users,
        vaultItems,
        queueItems: nextQueues,
        generalItems,
        quickItems,
        clans,
        diamondLogs,
        vaultBalance,
        formulaSettings: getFormulaSettings()
      },
      currentUser?.inGameName || currentUser?.username || 'Admin'
    );

    // 2. Persist in Firestore
    try {
      await updateQueueItemDoc(queueId, { queueList: members, updatedAt: now });
    } catch (err) {
      console.error('Failed to update queue item doc in Firestore:', err);
    }
  };

  // Quick Items Handlers
  const saveFailoverSnapshot = async (nextQuickItems: QuickItem[], nextGeneralItems: GeneralItem[], reason: string) => {
    setPendingFirebaseSync(true);
    return backupAllDataToGoogleSheets({
      users, vaultItems, quickItems: nextQuickItems, generalItems: nextGeneralItems,
      queueItems, clans, diamondLogs, vaultBalance,
      formulaSettings: getFormulaSettings(), announcementSettings,
      backgroundSettings: bgConfig, discordSettings
    }, reason);
  };

  const handleAddQuickItem = async (item: Omit<QuickItem, 'id' | 'createdAt'>) => {
    const tempId = 'qi_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const optimisticItem: QuickItem = {
      ...item,
      id: tempId,
      imageUrl: item.imageUrl?.trim() || '',
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
      const fallbackItems = [optimisticItem, ...quickItems];
      const googleResult = await saveFailoverSnapshot(fallbackItems, generalItems, 'Quick Item Failover');
      if (!googleResult.success) {
        setQuickItems((prev) => prev.filter((q) => q.id !== tempId));
        throw err;
      }
    }
  };

  const handleUpdateQuickItem = async (itemId: string, updates: Partial<Omit<QuickItem, 'id' | 'createdAt'>>) => {
    const nextItems = quickItems.map((q) => (q.id === itemId ? { ...q, ...updates } : q));
    setQuickItems(nextItems);
    try {
      await updateQuickItemDoc(itemId, updates);
    } catch (err) {
      console.error('Failed to update quick item in Firestore:', err);
      const googleResult = await saveFailoverSnapshot(nextItems, generalItems, 'Quick Item Update Failover');
      if (!googleResult.success) throw err;
    }
  };

  const handleDeleteQuickItem = async (itemId: string) => {
    const nextItems = quickItems.filter((q) => q.id !== itemId);
    setQuickItems(nextItems);
    try {
      await deleteQuickItemDoc(itemId);
    } catch (err) {
      console.error('Failed to delete quick item in Firestore:', err);
      const googleResult = await saveFailoverSnapshot(nextItems, generalItems, 'Quick Item Delete Failover');
      if (!googleResult.success) throw err;
    }
  };

  const handleAddGeneralItem = async (item: Omit<GeneralItem, 'id' | 'createdAt'>) => {
    const now = Date.now();
    const newId = 'gi_' + now + '_' + Math.random().toString(36).substring(2, 6);
    const fullItem: GeneralItem = {
      ...item,
      id: newId,
      name: item.name.trim(),
      price: Math.max(0, item.price || 0),
      quantity: Math.max(1, item.quantity || 1),
      minPowerLevel: Math.max(0, item.minPowerLevel || 0),
      rarity: item.rarity || 'RARE',
      queueList: Array.isArray(item.queueList) ? item.queueList : [],
      receiptHistory: Array.isArray(item.receiptHistory) ? item.receiptHistory : [],
      createdAt: now,
      updatedAt: now
    };

    // 1. Instant Optimistic React State update (<1ms)
    const nextItems = [fullItem, ...generalItems.filter((entry) => entry.id !== newId)];
    setGeneralItems(nextItems);

    // 2. Instant LocalStorage caching
    setCachedGeneralItems(nextItems);

    // 3. Instant Live State Relay Broadcast to peers
    broadcastLiveState({
      users,
      vaultItems,
      quickItems,
      generalItems: nextItems,
      queueItems,
      clans,
      diamondLogs,
      vaultBalance,
      formulaSettings: getFormulaSettings(),
      announcementSettings,
      backgroundSettings: bgConfig,
      discordSettings
    }, currentUser?.inGameName || 'Admin');

    // 4. Debounced auto backup to Google Sheets & Drive
    triggerDebouncedAutoBackup(
      {
        users,
        vaultItems,
        quickItems,
        generalItems: nextItems,
        queueItems,
        clans,
        diamondLogs,
        vaultBalance,
        formulaSettings: getFormulaSettings(),
        announcementSettings,
        backgroundSettings: bgConfig,
        discordSettings
      },
      currentUser?.inGameName || 'Admin',
      true
    );

    // 5. Safe Firestore persistence (non-blocking)
    try {
      await addGeneralItemDoc(fullItem);
    } catch (err) {
      console.warn('General item saved locally/relay/sheets; firestore write deferred:', err);
    }
  };

  const handleUpdateGeneralItem = async (itemId: string, updates: Partial<Omit<GeneralItem, 'id' | 'createdAt'>>) => {
    const now = Date.now();
    const fullUpdates = { ...updates, updatedAt: now };

    // 1. Instant Optimistic React State update (<1ms)
    const nextItems = generalItems.map((entry) => entry.id === itemId ? { ...entry, ...fullUpdates } : entry);
    setGeneralItems(nextItems);

    // 2. Instant LocalStorage caching
    setCachedGeneralItems(nextItems);

    // 3. Instant Live State Relay Broadcast to peers
    broadcastLiveState({
      users,
      vaultItems,
      quickItems,
      generalItems: nextItems,
      queueItems,
      clans,
      diamondLogs,
      vaultBalance,
      formulaSettings: getFormulaSettings(),
      announcementSettings,
      backgroundSettings: bgConfig,
      discordSettings
    }, currentUser?.inGameName || 'Member');

    // 4. Debounced auto backup to Google Sheets & Drive
    triggerDebouncedAutoBackup(
      {
        users,
        vaultItems,
        quickItems,
        generalItems: nextItems,
        queueItems,
        clans,
        diamondLogs,
        vaultBalance,
        formulaSettings: getFormulaSettings(),
        announcementSettings,
        backgroundSettings: bgConfig,
        discordSettings
      },
      currentUser?.inGameName || 'Member',
      true
    );

    // 5. Safe Firestore persistence (non-blocking)
    try {
      await updateGeneralItemDoc(itemId, fullUpdates);
    } catch (err) {
      console.warn('General item updated locally/relay/sheets; firestore update deferred:', err);
    }
  };

  const handleDeleteGeneralItem = async (itemId: string) => {
    // 0. Mark as deleted globally and locally
    markGeneralItemAsDeleted(itemId);

    // 1. Instant Optimistic React State update (<1ms)
    const nextItems = generalItems.filter((entry) => entry.id !== itemId);
    setGeneralItems(nextItems);

    // 2. Instant LocalStorage caching
    setCachedGeneralItems(nextItems);

    // 3. Instant Live State Relay Broadcast to peers
    broadcastLiveState({
      users,
      vaultItems,
      quickItems,
      generalItems: nextItems,
      queueItems,
      clans,
      diamondLogs,
      vaultBalance,
      formulaSettings: getFormulaSettings(),
      announcementSettings,
      backgroundSettings: bgConfig,
      discordSettings
    }, currentUser?.inGameName || 'Admin');

    // 4. Debounced auto backup
    triggerDebouncedAutoBackup(
      {
        users,
        vaultItems,
        quickItems,
        generalItems: nextItems,
        queueItems,
        clans,
        diamondLogs,
        vaultBalance,
        formulaSettings: getFormulaSettings(),
        announcementSettings,
        backgroundSettings: bgConfig,
        discordSettings
      },
      currentUser?.inGameName || 'Admin',
      true
    );

    // 5. Safe Firestore persistence (non-blocking)
    try {
      await deleteGeneralItemDoc(itemId);
    } catch (err) {
      console.warn('General item deleted locally/relay/sheets; firestore delete deferred:', err);
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
    const now = Date.now();
    const updatedUsers = users.map((u) => (u.id === userId ? { ...u, status: 'active' as UserStatus, updatedAt: now } : u));
    setUsers(updatedUsers);
    setCachedUsers(updatedUsers);

    broadcastLiveState(
      {
        users: updatedUsers,
        vaultItems,
        quickItems,
        generalItems,
        queueItems,
        clans,
        diamondLogs,
        vaultBalance: computeTotalVaultBalance(diamondLogs),
        formulaSettings: getFormulaSettings(),
        announcementSettings,
        backgroundSettings: bgConfig,
        discordSettings
      },
      currentUser?.inGameName || 'Admin'
    );

    const googleConfig = getGoogleBackupConfig();
    if (googleConfig.webAppUrl) {
      triggerDebouncedAutoBackup(
        {
          users: updatedUsers,
          vaultItems,
          quickItems,
          generalItems,
          queueItems,
          clans,
          diamondLogs,
          vaultBalance: computeTotalVaultBalance(diamondLogs),
          formulaSettings: getFormulaSettings(),
          announcementSettings,
          backgroundSettings: bgConfig,
          discordSettings
        },
        'Approve Member',
        true
      );
    }

    try {
      await updateUserDoc(userId, { status: 'active', updatedAt: now });
      showToast(
        lang === 'th'
          ? `อนุมัติสมาชิก ${target?.inGameName || ''} สำเร็จ 🎉`
          : `Approved member ${target?.inGameName || ''} successfully 🎉`,
        'success'
      );
    } catch (err) {
      console.warn('Failed to approve member in Firestore (fallback mode active):', err);
      showToast(
        lang === 'th'
          ? `อนุมัติสมาชิก ${target?.inGameName || ''} สำเร็จ 🎉`
          : `Approved member ${target?.inGameName || ''} successfully 🎉`,
        'success'
      );
    }
  };

  const handleRejectMember = async (userId: string) => {
    const target = users.find((u) => u.id === userId);
    try {
      const res = await deleteUserDoc(userId, {
        deleteReason: 'registration_rejected',
        deleteAuthAccount: true,
        deletedBy: currentUser?.id
      });

      markUserAsDeleted(userId);
      const updatedUsers = users.filter((u) => u.id !== userId);
      setUsers(updatedUsers);
      setCachedUsers(updatedUsers);

      broadcastLiveState(
        {
          users: updatedUsers,
          vaultItems,
          queueItems,
          generalItems,
          quickItems,
          clans,
          diamondLogs,
          vaultBalance: computeTotalVaultBalance(diamondLogs)
        },
        currentUser?.inGameName || 'Admin'
      );

      const googleConfig = getGoogleBackupConfig();
      if (googleConfig.webAppUrl) {
        triggerDebouncedAutoBackup(
          {
            users: updatedUsers,
            vaultItems,
            queueItems,
            generalItems,
            quickItems,
            clans,
            diamondLogs,
            vaultBalance: computeTotalVaultBalance(diamondLogs)
          },
          'Reject Member',
          true
        );
      }

      if (res?.partial) {
        showToast(
          lang === 'th'
            ? `ปฏิเสธคำขอของ ${target?.inGameName || ''} สำเร็จ แต่ลบบัญชี Auth ไม่สำเร็จ (กรุณากดปฏิเสธอีกครั้งเพื่อลองล้างบัญชี Auth)`
            : `Rejected registration for ${target?.inGameName || ''}, but Auth cleanup failed (please retry rejection to complete Auth cleanup)`,
          'warning'
        );
      } else {
        showToast(
          lang === 'th'
            ? `ปฏิเสธคำขอสมัครของ ${target?.inGameName || ''} แล้ว`
            : `Rejected registration for ${target?.inGameName || ''}`,
          'info'
        );
      }
    } catch (err: any) {
      console.error('Failed to reject member via authoritative backend:', err);
      showToast(
        lang === 'th'
          ? `ปฏิเสธคำขอสมัครล้มเหลว: ${err?.message || 'ข้อผิดพลาดเครือข่ายหรือสิทธิ์ไม่เพียงพอ'}`
          : `Failed to reject registration: ${err?.message || 'Network error or permission denied'}`,
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
    try {
      await deleteUserDoc(userId, {
        deleteReason: 'admin_removal',
        deleteAuthAccount: false,
        deletedBy: currentUser?.id
      });

      markUserAsDeleted(userId);
      const updatedUsers = users.filter((u) => u.id !== userId);
      setUsers(updatedUsers);
      setCachedUsers(updatedUsers);

      broadcastLiveState(
        {
          users: updatedUsers,
          vaultItems,
          queueItems,
          generalItems,
          quickItems,
          clans,
          diamondLogs,
          vaultBalance: computeTotalVaultBalance(diamondLogs)
        },
        currentUser?.inGameName || 'Admin'
      );

      const googleConfig = getGoogleBackupConfig();
      if (googleConfig.webAppUrl) {
        triggerDebouncedAutoBackup(
          {
            users: updatedUsers,
            vaultItems,
            queueItems,
            generalItems,
            quickItems,
            clans,
            diamondLogs,
            vaultBalance: computeTotalVaultBalance(diamondLogs)
          },
          'Delete Member',
          true
        );
      }

      showToast(
        lang === 'th'
          ? `ลบสมาชิก ${target?.inGameName || ''} สำเร็จ`
          : `Deleted member ${target?.inGameName || ''}`,
        'info'
      );
    } catch (err: any) {
      console.error('Failed to delete member via authoritative backend:', err);
      showToast(
        lang === 'th'
          ? `ลบสมาชิกล้มเหลว: ${err?.message || 'ข้อผิดพลาดเครือข่ายหรือสิทธิ์ไม่เพียงพอ'}`
          : `Failed to delete member: ${err?.message || 'Network error or permission denied'}`,
        'error'
      );
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

    const updatedUsers = users.map((u) =>
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
            statRejectionAt: null,
            updatedAt: timestamp
          }
        : u
    );
    setUsers(updatedUsers);
    setCachedUsers(updatedUsers);

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
              statRejectionAt: null,
              updatedAt: timestamp
            }
          : null
      );
    }

    // Instant Live State Relay Broadcast to peers
    broadcastLiveState(
      {
        users: updatedUsers,
        vaultItems,
        quickItems,
        generalItems,
        queueItems,
        clans,
        diamondLogs,
        vaultBalance,
        formulaSettings: getFormulaSettings(),
        announcementSettings,
        backgroundSettings: bgConfig,
        discordSettings
      },
      currentUser?.inGameName || 'Member'
    );

    // Debounced auto backup to Google Sheets & Drive
    triggerDebouncedAutoBackup(
      {
        users: updatedUsers,
        vaultItems,
        quickItems,
        generalItems,
        queueItems,
        clans,
        diamondLogs,
        vaultBalance,
        formulaSettings: getFormulaSettings(),
        announcementSettings,
        backgroundSettings: bgConfig,
        discordSettings
      },
      currentUser?.inGameName || 'Member',
      true
    );

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
        statRejectionAt: null,
        updatedAt: timestamp
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
    if (!target) return;

    const approvedPower = typeof target.pendingPowerLevel === 'number'
      ? target.pendingPowerLevel
      : (target.powerLevel || 0);
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

    const now = Date.now();
    const newHistoryPoint: StatHistoryPoint = {
      id: `approval_${now}_${Math.random().toString(36).substring(2, 7)}`,
      date: now,
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

    const updatedUsers = users.map((u) =>
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
            statRejectionAt: null,
            statApprovalAt: now,
            updatedAt: now
          }
        : u
    );
    setUsers(updatedUsers);
    setCachedUsers(updatedUsers);

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
              statRejectionAt: null,
              statApprovalAt: now,
              updatedAt: now
            }
          : null
      );
    }

    broadcastLiveState(
      {
        users: updatedUsers,
        vaultItems,
        quickItems,
        generalItems,
        queueItems,
        clans,
        diamondLogs,
        vaultBalance,
        formulaSettings: getFormulaSettings(),
        announcementSettings,
        backgroundSettings: bgConfig,
        discordSettings
      },
      currentUser?.inGameName || 'Admin'
    );

    triggerDebouncedAutoBackup(
      {
        users: updatedUsers,
        vaultItems,
        quickItems,
        generalItems,
        queueItems,
        clans,
        diamondLogs,
        vaultBalance,
        formulaSettings: getFormulaSettings(),
        announcementSettings,
        backgroundSettings: bgConfig,
        discordSettings
      },
      currentUser?.inGameName || 'Admin',
      true
    );

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
        statRejectionAt: null,
        statApprovalAt: now,
        updatedAt: now
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
    const now = Date.now();

    const updatedUsers = users.map((u) =>
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
            statRejectionAt: now,
            updatedAt: now
          }
        : u
    );
    setUsers(updatedUsers);
    setCachedUsers(updatedUsers);

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
              statRejectionAt: now,
              updatedAt: now
            }
          : null
      );
    }

    broadcastLiveState(
      {
        users: updatedUsers,
        vaultItems,
        quickItems,
        generalItems,
        queueItems,
        clans,
        diamondLogs,
        vaultBalance,
        formulaSettings: getFormulaSettings(),
        announcementSettings,
        backgroundSettings: bgConfig,
        discordSettings
      },
      currentUser?.inGameName || 'Admin'
    );

    triggerDebouncedAutoBackup(
      {
        users: updatedUsers,
        vaultItems,
        quickItems,
        generalItems,
        queueItems,
        clans,
        diamondLogs,
        vaultBalance,
        formulaSettings: getFormulaSettings(),
        announcementSettings,
        backgroundSettings: bgConfig,
        discordSettings
      },
      currentUser?.inGameName || 'Admin',
      true
    );

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
        statRejectionAt: now,
        updatedAt: now
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
    const updatedUsers = users.map((u) =>
      u.id === userId
        ? { ...u, pendingPowerLevel: newPowerLevel, pendingPowerLevelRequestedAt: timestamp, updatedAt: timestamp }
        : u
    );
    setUsers(updatedUsers);
    setCachedUsers(updatedUsers);

    if (currentUser && currentUser.id === userId) {
      setCurrentUser((prev) =>
        prev ? { ...prev, pendingPowerLevel: newPowerLevel, pendingPowerLevelRequestedAt: timestamp, updatedAt: timestamp } : null
      );
    }

    broadcastLiveState(
      {
        users: updatedUsers,
        vaultItems,
        quickItems,
        generalItems,
        queueItems,
        clans,
        diamondLogs,
        vaultBalance,
        formulaSettings: getFormulaSettings(),
        announcementSettings,
        backgroundSettings: bgConfig,
        discordSettings
      },
      currentUser?.inGameName || 'Member'
    );

    triggerDebouncedAutoBackup(
      {
        users: updatedUsers,
        vaultItems,
        quickItems,
        generalItems,
        queueItems,
        clans,
        diamondLogs,
        vaultBalance,
        formulaSettings: getFormulaSettings(),
        announcementSettings,
        backgroundSettings: bgConfig,
        discordSettings
      },
      currentUser?.inGameName || 'Member',
      true
    );

    try {
      await updateUserDoc(userId, {
        pendingPowerLevel: newPowerLevel,
        pendingPowerLevelRequestedAt: timestamp,
        updatedAt: timestamp
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
    const now = Date.now();
    const updatedUsers = users.map((u) =>
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
            updatedAt: now
          }
        : u
    );
    setUsers(updatedUsers);
    setCachedUsers(updatedUsers);

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
              updatedAt: now
            }
          : null
      );
    }

    broadcastLiveState(
      {
        users: updatedUsers,
        vaultItems,
        quickItems,
        generalItems,
        queueItems,
        clans,
        diamondLogs,
        vaultBalance,
        formulaSettings: getFormulaSettings(),
        announcementSettings,
        backgroundSettings: bgConfig,
        discordSettings
      },
      currentUser?.inGameName || 'Member'
    );

    triggerDebouncedAutoBackup(
      {
        users: updatedUsers,
        vaultItems,
        quickItems,
        generalItems,
        queueItems,
        clans,
        diamondLogs,
        vaultBalance,
        formulaSettings: getFormulaSettings(),
        announcementSettings,
        backgroundSettings: bgConfig,
        discordSettings
      },
      currentUser?.inGameName || 'Member',
      true
    );

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
        updatedAt: now
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
    const succeededIds: string[] = [];
    const failedIds: string[] = [];

    for (const uid of userIds) {
      try {
        await deleteUserDoc(uid, {
          deleteReason: 'batch_admin_removal',
          deleteAuthAccount: false,
          deletedBy: currentUser?.id
        });
        markUserAsDeleted(uid);
        succeededIds.push(uid);
      } catch (err) {
        console.error(`Failed to delete member ${uid} in batch:`, err);
        failedIds.push(uid);
      }
    }

    if (succeededIds.length > 0) {
      const succSet = new Set(succeededIds);
      const updatedUsers = users.filter((u) => !succSet.has(u.id));
      setUsers(updatedUsers);
      setCachedUsers(updatedUsers);

      broadcastLiveState(
        {
          users: updatedUsers,
          vaultItems,
          queueItems,
          generalItems,
          quickItems,
          clans,
          diamondLogs,
          vaultBalance: computeTotalVaultBalance(diamondLogs)
        },
        currentUser?.inGameName || 'Admin'
      );

      const googleConfig = getGoogleBackupConfig();
      if (googleConfig.webAppUrl) {
        triggerDebouncedAutoBackup(
          {
            users: updatedUsers,
            vaultItems,
            queueItems,
            generalItems,
            quickItems,
            clans,
            diamondLogs,
            vaultBalance: computeTotalVaultBalance(diamondLogs)
          },
          'Batch Delete Members',
          true
        );
      }
    }

    if (failedIds.length === 0) {
      showToast(
        lang === 'th'
          ? `ลบสมาชิกทั้งหมด ${succeededIds.length} คนสำเร็จ`
          : `Deleted all ${succeededIds.length} members successfully`,
        'info'
      );
    } else if (succeededIds.length > 0) {
      showToast(
        lang === 'th'
          ? `ลบสำเร็จ ${succeededIds.length} คน, ล้มเหลว ${failedIds.length} คน`
          : `Deleted ${succeededIds.length} members, ${failedIds.length} failed`,
        'warning'
      );
    } else {
      showToast(
        lang === 'th'
          ? `ลบสมาชิกล้มเหลวทั้งหมด (${failedIds.length} คน)`
          : `Failed to delete all ${failedIds.length} members`,
        'error'
      );
    }
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
        pendingStatApprovalCount={users.filter((u) => isUserStatsPending(u)).length}
        pendingRegistrationsCount={users.filter((u) => u.status === 'pending_approval' || (u.status as any) === 'pending').length}
        discordEnabled={discordSettings?.enabled}
        pendingQueueCount={
          generalItems.reduce((acc, item) => acc + (item.queueList ? item.queueList.filter((m) => m.status === 'pending').length : 0), 0) +
          queueItems.reduce((acc, item) => acc + (item.queueList ? item.queueList.filter((m) => m.status === 'pending').length : 0), 0)
        }
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
        onClearCacheAndReload={handleClearCacheAndReload}
        statUpdateSettings={statUpdateSettings}
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
            quickItems={quickItems}
            generalItems={generalItems}
            onAddGeneralItem={handleAddGeneralItem}
            onUpdateGeneralItem={handleUpdateGeneralItem}
            onDeleteGeneralItem={handleDeleteGeneralItem}
            onRecordDiamondLog={handleRecordDiamondLog}
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
            queueAnnouncement={queueAnnouncement}
            onSaveQueueAnnouncement={handleSaveQueueAnnouncement}
            showToast={showToast}
            onClearCacheAndReload={handleClearCacheAndReload}
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
            onEditItem={(item) => setEditingVaultItem(item)}
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
            generalItems={generalItems}
            queueAnnouncement={queueAnnouncement}
            onSaveQueueAnnouncement={handleSaveQueueAnnouncement}
            onAddGeneralItem={handleAddGeneralItem}
            onUpdateGeneralItem={handleUpdateGeneralItem}
            onDeleteGeneralItem={handleDeleteGeneralItem}
            onRecordDiamondLog={handleRecordDiamondLog}
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
            statUpdateSettings={statUpdateSettings}
          />
        )}

        {activeTab === 'stat_approvals' && canAccessAdminFeatures && (
          <StatApprovalView
            currentUser={currentUser}
            statUpdateSettings={statUpdateSettings}
            onToggleStatUpdates={handleToggleStatUpdates}
            pendingUsers={users.filter((u) => isUserStatsPending(u))}
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
        statUpdateSettings={statUpdateSettings}
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
        onDataRestored={async (restored) => {
          if (restored.users && restored.users.length > 0) {
            // Anti-resurrection guard: Do NOT unmark deleted users. Filter out soft-deleted and shadow users.
            const deletedUserIds = getDeletedUserIds();
            const safeRestoredUsers = restored.users.filter((u) => {
              if (!u || !u.id) return false;
              if (u.status === 'deleted' || u.status === 'shadow' || u.isAuthShadow) return false;
              if (deletedUserIds.has(u.id)) return false;
              return true;
            });
            const restoredAt = Date.now();
            const finalUsers = safeRestoredUsers.map((u) => ({ ...u, updatedAt: restoredAt }));
            setUsers(finalUsers);
            setCachedUsers(finalUsers);
            restored.users = finalUsers;
          }
          if (restored.vaultItems && restored.vaultItems.length > 0) {
            const restoredAt = Date.now();
            restored.vaultItems = restored.vaultItems.map((item) => ({ ...item, updatedAt: restoredAt }));
            restored.vaultItems.forEach((i) => unmarkVaultItemAsDeleted(i.id));
            setVaultItems(restored.vaultItems);
            setCachedVaultItems(restored.vaultItems);
          }
          if (restored.queueItems) {
            const restoredAt = Date.now();
            restored.queueItems = restored.queueItems.map((queue) => ({ ...queue, updatedAt: restoredAt }));
            restored.queueItems.forEach((q) => unmarkQueueItemAsDeleted(q.id));
            setQueueItems(restored.queueItems);
            setCachedQueues(restored.queueItems);
          }
          if (restored.quickItems && restored.quickItems.length > 0) setQuickItems(restored.quickItems);
          if (restored.generalItems && restored.generalItems.length > 0) setGeneralItems(restored.generalItems);
          if (restored.clans && restored.clans.length > 0) setClans(restored.clans);
          if (restored.diamondLogs) setDiamondLogs(restored.diamondLogs);
          if (restored.formulaSettings) saveFormulaSettings(restored.formulaSettings);

          broadcastLiveState(
            {
              users: (restored.users && restored.users.length > 0) ? restored.users : users,
              vaultItems: (restored.vaultItems && restored.vaultItems.length > 0) ? restored.vaultItems : vaultItems,
              queueItems: restored.queueItems || queueItems,
              quickItems: (restored.quickItems && restored.quickItems.length > 0) ? restored.quickItems : quickItems,
              generalItems: (restored.generalItems && restored.generalItems.length > 0) ? restored.generalItems : generalItems,
              clans: (restored.clans && restored.clans.length > 0) ? restored.clans : clans,
              diamondLogs: restored.diamondLogs || diamondLogs,
              vaultBalance,
              formulaSettings: restored.formulaSettings || getFormulaSettings()
            },
            currentUser?.inGameName || currentUser?.username || 'Owner'
          );

          // Asynchronously sync restored data back into Firebase Cloud
          try {
            const syncRes = await syncBackupToFirestore({
              users: restored.users,
              vaultItems: restored.vaultItems,
              queueItems: restored.queueItems,
              quickItems: restored.quickItems,
              generalItems: restored.generalItems,
              clans: restored.clans,
              diamondLogs: restored.diamondLogs,
              formulaSettings: restored.formulaSettings,
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
            if (syncRes?.success) {
              console.log('Successfully synced restored data to Firestore:', syncRes.writtenCount);
            }
          } catch (syncErr) {
            console.warn('Sync to Firestore on restore warning:', syncErr);
          }
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
