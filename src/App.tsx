import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AlertCircle, CheckCircle, Sparkles, X } from 'lucide-react';
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
  isUserStatsPending
} from './types';
import { getOrGenerateStatHistory } from './utils/growthTimelineHelper';
import { translations } from './translations';
import { sounds } from './utils/sound';
import { sendDiscordNotification } from './utils/discord';
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
  addDiamondTransactionDoc,
  updateDiamondTransactionNoteDoc,
  registerUserDoc,
  loginUserQuery,
  listenToFormulaSettings,
  INITIAL_QUICK_ITEMS,
  INITIAL_CLANS
} from './services/firebase';
import { setInMemoryFormulaSettings } from './services/powerFormulaService';

import { Sidebar } from './components/Sidebar';
import { AnnouncementBar } from './components/AnnouncementBar';
import { DiscordWebhookModal } from './components/DiscordWebhookModal';
import { LoginScreen } from './components/LoginScreen';
import { AuthModal } from './components/AuthModal';
import { DiamondVaultModal } from './components/DiamondVaultModal';
import { ImageViewerModal } from './components/ImageViewerModal';
import { DistributeItemModal } from './components/DistributeItemModal';
import { ClaimantsModal } from './components/ClaimantsModal';
import { QuickItemModal } from './components/QuickItemModal';
import { OwnerResetModal } from './components/OwnerResetModal';
import { RequestPowerLevelModal } from './components/RequestPowerLevelModal';
import { GeminiKeyModal } from './components/GeminiKeyModal';
import {
  BackgroundSettingsModal,
  BackgroundConfig,
  DEFAULT_BG_CONFIG
} from './components/BackgroundSettingsModal';
import { PowerFormulaSettingsModal } from './components/PowerFormulaSettingsModal';

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

  // 2. Navigation Tab State
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  // 3. Current User / Authentication
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('k7_logged_user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        if (u && (u.id === 'user_owner_eloni' || u.username?.toLowerCase() === 'eloni' || u.inGameName?.toLowerCase() === 'eloni')) {
          u.role = 'owner';
          u.status = 'active';
        }
        return u;
      } catch {
        return null;
      }
    }
    return null;
  });

  // 4. Data Collections State
  const [users, setUsers] = useState<User[]>([]);
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [quickItems, setQuickItems] = useState<QuickItem[]>(INITIAL_QUICK_ITEMS);
  const [clans, setClans] = useState<ClanGroup[]>([]);
  const [diamondLogs, setDiamondLogs] = useState<DiamondVaultRecord[]>([]);

  // 5. Modals State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showVaultModal, setShowVaultModal] = useState(false);
  const [showQuickItemsModal, setShowQuickItemsModal] = useState(false);
  const [showOwnerResetModal, setShowOwnerResetModal] = useState(false);
  const [showDiscordModal, setShowDiscordModal] = useState(false);
  const [showRequestCpModal, setShowRequestCpModal] = useState(false);
  const [showGeminiModal, setShowGeminiModal] = useState(false);
  const [announcementSettings, setAnnouncementSettings] = useState<AnnouncementSettings | null>(null);
  const [discordSettings, setDiscordSettings] = useState<DiscordSettings | null>(null);
  const [distributeTargetItem, setDistributeTargetItem] = useState<VaultItem | null>(null);
  const [distributeClaimantId, setDistributeClaimantId] = useState<string | undefined>(undefined);
  const [claimantsTargetItem, setClaimantsTargetItem] = useState<VaultItem | null>(null);
  const [imageViewerData, setImageViewerData] = useState<{
    url: string;
    title?: string;
    images?: string[];
    currentIndex?: number;
  } | null>(null);

  // 5c. Kain7 Power Formula State
  const [isPowerFormulaOpen, setIsPowerFormulaOpen] = useState(false);
  const [selectedClanScope, setSelectedClanScope] = useState<string>('all');

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

  // RBAC Guard for Vault item creation, Clan management and OCR
  const canAccessAdminFeatures =
    currentUser?.role === 'owner' ||
    currentUser?.role === 'admin' ||
    currentUser?.role === 'manager';

  useEffect(() => {
    if (!canAccessAdminFeatures && activeTab === 'vault') {
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
          localStorage.setItem('k7_logged_user', JSON.stringify(safeUser));
        }
      }
    });

    const unsubVault = listenToVaultItems((items) => setVaultItems(items));
    const unsubQueue = listenToQueueItems((items) => setQueueItems(items));
    const unsubQuick = listenToQuickItems((items) => {
      if (items.length > 0) setQuickItems(items);
    });
    const unsubClans = listenToClans((clanList) => {
      const validClans = clanList.filter((c) => !isNoClan(c.name));
      setClans(validClans);
    });
    const unsubDiamonds = listenToDiamondTransactions((logs) => setDiamondLogs(logs));
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

  // Calculate Diamond Vault / Clan Fund Balance (Memoized)
  const vaultBalance = useMemo(() => {
    return diamondLogs.reduce((acc, log) => {
      if (log.type === 'credit' || log.type === 'deposit') {
        return acc + (log.netAmount ?? log.amount);
      } else if (log.type === 'deduction' || log.type === 'expenditure' || log.type === 'withdraw') {
        return acc - Math.abs(log.amount);
      } else if (log.type === 'adjust') {
        return acc + log.amount; // delta can be positive or negative
      }
      return acc + log.amount;
    }, 150000); // 150,000 initial starting seed balance
  }, [diamondLogs]);

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

    setCurrentUser(user);
    localStorage.setItem('k7_logged_user', JSON.stringify(user));
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
    localStorage.removeItem('k7_logged_user');
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
      balanceAfter: details?.balanceAfter,
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
  };

  // Vault Items Handlers
  const handleCreateVaultItem = async (
    itemData: Omit<VaultItem, 'id' | 'createdAt' | 'status' | 'claimants'>
  ) => {
    const createdItem = await addVaultItemDoc({
      ...itemData,
      status: 'available',
      claimants: []
    });

    if (discordSettings?.enabled && discordSettings.notifyOnNewItem) {
      sendDiscordNotification(discordSettings, 'new_item', {
        item: createdItem,
        actorName: currentUser?.inGameName || currentUser?.username || 'Admin'
      }).catch((err) => console.warn('Discord notification error:', err));
    }
  };

  const handleDeleteVaultItem = async (itemId: string) => {
    sounds.playClick();
    setVaultItems((prev) => prev.filter((i) => i.id !== itemId));
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
    setVaultItems((prev) =>
      prev.map((it) =>
        it.id === itemId ? { ...it, claimants: updatedClaimants } : it
      )
    );

    try {
      await updateVaultItemDoc(itemId, { claimants: updatedClaimants });
      showToast(
        lang === 'th' ? 'ลงชื่อเครมไอเทมสำเร็จ!' : 'Claim submitted successfully!',
        'success'
      );
    } catch (err) {
      console.error('Failed to update claim in Firestore:', err);
      setVaultItems((prev) =>
        prev.map((it) =>
          it.id === itemId ? { ...it, claimants: item.claimants } : it
        )
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
    setVaultItems((prev) =>
      prev.map((it) =>
        it.id === itemId ? { ...it, claimants: updatedClaimants } : it
      )
    );

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
      setVaultItems((prev) =>
        prev.map((it) =>
          it.id === itemId ? { ...it, claimants: item.claimants } : it
        )
      );
    }
  };

  // Distribute Item Handler (Admin awards item, removes from Dashboard, stores in distributed archive)
  const handleDistributeItem = async (
    itemId: string,
    recipient: { name: string; clan: string; userId?: string }
  ) => {
    try {
      const distributedPayload: any = {
        name: recipient.name,
        clan: recipient.clan || 'No Clan',
        distributedAt: Date.now(),
        distributedBy: currentUser?.inGameName || currentUser?.username || 'Admin'
      };
      if (recipient.userId) {
        distributedPayload.userId = recipient.userId;
      }

      await updateVaultItemDoc(itemId, {
        status: 'distributed',
        distributedTo: distributedPayload
      });

      // Send Discord notification if enabled
      const targetItem = vaultItems.find((i) => i.id === itemId);
      if (targetItem && discordSettings?.enabled && discordSettings.notifyOnDistribute) {
        sendDiscordNotification(discordSettings, 'distribute', {
          item: { ...targetItem, status: 'distributed', distributedTo: distributedPayload },
          distributeInfo: distributedPayload,
          actorName: currentUser?.inGameName || currentUser?.username || 'Admin'
        }).catch((err) => console.warn('Discord notification error on distribute:', err));
      }

      setDistributeTargetItem(null);
      if (claimantsTargetItem?.id === itemId) {
        setClaimantsTargetItem(null);
      }
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

  // Queue Item Handlers
  const handleCreateQueueItem = async (
    itemData: Omit<QueueItem, 'id' | 'createdAt'>
  ) => {
    await addQueueItemDoc(itemData);
  };

  const handleDeleteQueueItem = async (queueId: string) => {
    sounds.playClick();
    setQueueItems((prev) => prev.filter((q) => q.id !== queueId));
    try {
      await deleteQueueItemDoc(queueId);
      showToast(lang === 'th' ? 'ลบคิวสำเร็จ' : 'Queue deleted', 'info');
    } catch (err) {
      console.error('Failed to delete queue item:', err);
    }
  };

  const handleUpdateQueueMembers = async (queueId: string, members: QueueMember[]) => {
    // 1. Optimistic UI update immediately
    setQueueItems((prev) =>
      prev.map((q) => (q.id === queueId ? { ...q, queueList: members } : q))
    );
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

    if (syncGlobally && canAccessAdminFeatures) {
      try {
        await saveBackgroundSettingsDoc({
          imageUrl: newConfig.imageUrl,
          brightness: newConfig.brightness,
          blur: newConfig.blur,
          vignetteOpacity: newConfig.vignetteOpacity,
          updatedBy: currentUser?.inGameName || 'Owner'
        });
        showToast(
          lang === 'th'
            ? 'ซิงค์ภาพพื้นหลังไปยังสมาชิกทุกคนในกิลด์เรียบร้อยแล้ว!'
            : 'Background synchronized to all guild members!',
          'success'
        );
      } catch (err) {
        console.error('Failed to sync background settings to Firestore:', err);
      }
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

      // Discord webhook notification
      if (discordSettings?.enabled) {
        const targetUser = users.find((u) => u.id === userId) || currentUser;
        if (targetUser) {
          sendDiscordNotification(discordSettings, 'stat_request', {
            memberName: targetUser.inGameName,
            memberClan: targetUser.clan,
            oldPowerLevel: targetUser.powerLevel,
            newPowerLevel,
            screenshotUrl
          });
        }
      }

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

      // Discord webhook notification
      if (discordSettings?.enabled) {
        sendDiscordNotification(discordSettings, 'stat_approval', {
          memberName: target.inGameName,
          memberClan: target.clan,
          oldPowerLevel: target.powerLevel,
          newPowerLevel: approvedPower,
          actorName: currentUser?.inGameName || 'Admin'
        });
      }

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

  // Available items to show on Dashboard (status === 'available') filtered by Clan Scope
  const availableDashboardItems = useMemo(() => {
    const available = vaultItems.filter((i) => i.status === 'available');
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
            onOpenBgModal={() => setShowBgModal(true)}
          />
        </div>

        <BackgroundSettingsModal
          isOpen={showBgModal}
          onClose={() => setShowBgModal(false)}
          lang={lang}
          config={bgConfig}
          onChangeConfig={setBgConfig}
        />
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
          if (!canAccessAdminFeatures && tab === 'vault') {
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
        onOpenBgModal={() => setShowBgModal(true)}
        onOpenDiscordModal={() => setShowDiscordModal(true)}
        onOpenGeminiModal={() => setShowGeminiModal(true)}
        onOpenRequestCp={() => setActiveTab('my_stats')}
        onOpenMyStats={() => setActiveTab('my_stats')}
        onOpenPowerFormula={() => setIsPowerFormulaOpen(true)}
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

        <main className="flex-1 w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
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
            onOpenStatApproval={() => setActiveTab('stat_approvals')}
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

      <BackgroundSettingsModal
        isOpen={showBgModal}
        onClose={() => setShowBgModal(false)}
        lang={lang}
        config={bgConfig}
        onChangeConfig={handleUpdateBackgroundConfig}
        isAdminOrOwner={canAccessAdminFeatures}
      />

      <OwnerResetModal
        isOpen={showOwnerResetModal}
        onClose={() => setShowOwnerResetModal(false)}
        lang={lang}
        currentUser={currentUser}
        vaultItemsCount={availableDashboardItems.length}
        distributedItemsCount={vaultItems.filter((i) => i.status === 'distributed').length}
        queuesCount={queueItems.length}
        diamondLogsCount={diamondLogs.length}
      />

      <DiscordWebhookModal
        isOpen={showDiscordModal && canAccessAdminFeatures}
        onClose={() => setShowDiscordModal(false)}
        settings={discordSettings}
        onSaveSettings={handleSaveDiscordSettings}
        currentUser={currentUser}
        lang={lang}
      />



      {/* Gemini AI OCR Settings Modal */}
      <GeminiKeyModal
        isOpen={showGeminiModal}
        onClose={() => setShowGeminiModal(false)}
        lang={lang}
        isOwner={currentUser?.role === 'owner'}
      />

      {/* 5. POWER FORMULA & CLAN MANAGEMENT MODALS */}
      {isPowerFormulaOpen && canAccessAdminFeatures && (
        <PowerFormulaSettingsModal
          isOpen={isPowerFormulaOpen}
          onClose={() => setIsPowerFormulaOpen(false)}
          lang={lang}
          showToast={showToast}
        />
      )}

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
