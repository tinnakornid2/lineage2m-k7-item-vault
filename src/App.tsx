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
  DiscordSettings
} from './types';
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
  deleteClanDoc,
  updateUserDoc,
  deleteUserDoc,
  addDiamondTransactionDoc,
  registerUserDoc,
  loginUserQuery,
  listenToCharacterClasses,
  saveCharacterClassesDoc,
  DEFAULT_CHARACTER_CLASSES,
  INITIAL_QUICK_ITEMS,
  INITIAL_CLANS
} from './services/firebase';

import { Sidebar } from './components/Sidebar';
import { AnnouncementBar } from './components/AnnouncementBar';
import { DiscordWebhookModal } from './components/DiscordWebhookModal';
import { ClassSettingsModal } from './components/ClassSettingsModal';
import { LoginScreen } from './components/LoginScreen';
import { AuthModal } from './components/AuthModal';
import { DiamondVaultModal } from './components/DiamondVaultModal';
import { ImageViewerModal } from './components/ImageViewerModal';
import { DistributeItemModal } from './components/DistributeItemModal';
import { ClaimantsModal } from './components/ClaimantsModal';
import { QuickItemModal } from './components/QuickItemModal';
import { OwnerResetModal } from './components/OwnerResetModal';
import {
  BackgroundSettingsModal,
  BackgroundConfig,
  DEFAULT_BG_CONFIG
} from './components/BackgroundSettingsModal';

import { DashboardView } from './components/DashboardView';
import { VaultView } from './components/VaultView';
import { QueueView } from './components/QueueView';
import { MembersView } from './components/MembersView';
import { ClanView } from './components/ClanView';

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
        return JSON.parse(saved);
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
  const [clans, setClans] = useState<ClanGroup[]>(INITIAL_CLANS);
  const [diamondLogs, setDiamondLogs] = useState<DiamondVaultRecord[]>([]);

  // 5. Modals State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showVaultModal, setShowVaultModal] = useState(false);
  const [showQuickItemsModal, setShowQuickItemsModal] = useState(false);
  const [showOwnerResetModal, setShowOwnerResetModal] = useState(false);
  const [showDiscordModal, setShowDiscordModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [characterClasses, setCharacterClasses] = useState<string[]>(DEFAULT_CHARACTER_CLASSES);
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

  // 5b. In-App Toast Feedback State
  const [toast, setToast] = useState<{
    message: string;
    type: 'info' | 'error' | 'success';
  } | null>(null);

  const showToast = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
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
    if (!canAccessAdminFeatures && (activeTab === 'vault' || activeTab === 'clan')) {
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
      setUsers(updatedUsers);
      // Keep currentUser in sync if updated
      const current = currentUserRef.current;
      if (current) {
        const found = updatedUsers.find((u) => u.id === current.id);
        if (found) {
          setCurrentUser(found);
          localStorage.setItem('k7_logged_user', JSON.stringify(found));
        }
      }
    });

    const unsubVault = listenToVaultItems((items) => setVaultItems(items));
    const unsubQueue = listenToQueueItems((items) => setQueueItems(items));
    const unsubQuick = listenToQuickItems((items) => {
      if (items.length > 0) setQuickItems(items);
    });
    const unsubClans = listenToClans((clanList) => {
      if (clanList.length > 0) setClans(clanList);
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
    const unsubClasses = listenToCharacterClasses((classList) => {
      if (classList && classList.length > 0) {
        setCharacterClasses(classList);
      }
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
      unsubClasses();
    };
  }, []);

  // Calculate Diamond Vault Balance (Memoized)
  const vaultBalance = useMemo(() => {
    return diamondLogs.reduce((acc, log) => {
      return log.type === 'deposit' ? acc + log.amount : acc - log.amount;
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

  // Diamond Vault Transaction (Deposit / Withdraw)
  const handleVaultTransaction = async (type: 'deposit' | 'withdraw', amount: number, note: string) => {
    if (!currentUser) return;
    await addDiamondTransactionDoc({
      type,
      amount,
      note,
      performedBy: {
        userId: currentUser.id,
        name: currentUser.inGameName,
        role: currentUser.role
      }
    });
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

  // Character Classes Handlers (Owner Management)
  const handleAddClass = async (newClass: string) => {
    const trimmed = newClass.trim();
    if (!trimmed) return;
    if (characterClasses.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      showToast(lang === 'th' ? `มีอาชีพ "${trimmed}" ในระบบอยู่แล้ว` : `Class "${trimmed}" already exists`, 'error');
      return;
    }
    const updated = [...characterClasses, trimmed];
    setCharacterClasses(updated);
    try {
      await saveCharacterClassesDoc(updated, currentUser?.inGameName || 'Owner');
      sounds.playSuccess();
      showToast(lang === 'th' ? `เพิ่มอาชีพ "${trimmed}" เรียบร้อยแล้ว` : `Class "${trimmed}" added`, 'success');
    } catch (err) {
      console.error('Failed to save character classes:', err);
      showToast(lang === 'th' ? 'เกิดข้อผิดพลาดในการบันทึกอาชีพ' : 'Failed to save class', 'error');
    }
  };

  const handleDeleteClass = async (targetClass: string) => {
    if (characterClasses.length <= 1) {
      showToast(lang === 'th' ? 'ต้องมีอาชีพในระบบอย่างน้อย 1 อาชีพ' : 'Must have at least 1 class', 'error');
      return;
    }
    const updated = characterClasses.filter((c) => c !== targetClass);
    setCharacterClasses(updated);
    try {
      await saveCharacterClassesDoc(updated, currentUser?.inGameName || 'Owner');
      sounds.playClick();
      showToast(lang === 'th' ? `ลบอาชีพ "${targetClass}" เรียบร้อยแล้ว` : `Class "${targetClass}" removed`, 'info');
    } catch (err) {
      console.error('Failed to delete character class:', err);
      showToast(lang === 'th' ? 'เกิดข้อผิดพลาดในการลบอาชีพ' : 'Failed to delete class', 'error');
    }
  };

  const handleResetClasses = async () => {
    setCharacterClasses(DEFAULT_CHARACTER_CLASSES as unknown as string[]);
    try {
      await saveCharacterClassesDoc(DEFAULT_CHARACTER_CLASSES as unknown as string[], currentUser?.inGameName || 'Owner');
      sounds.playSuccess();
      showToast(lang === 'th' ? 'คืนค่าอาชีพมาตรฐานเรียบร้อยแล้ว' : 'Reset default classes successfully', 'success');
    } catch (err) {
      console.error('Failed to reset character classes:', err);
      showToast(lang === 'th' ? 'เกิดข้อผิดพลาดในการรีเซ็ตอาชีพ' : 'Failed to reset classes', 'error');
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

    // Check power requirement (owner and admin bypass minimum CP)
    const isPrivileged = currentUser.role === 'owner' || currentUser.role === 'admin';
    const userCP = Number(currentUser.powerLevel || 0);
    const requiredCP = Number(item.minPowerLevel || 0);

    if (!isPrivileged && userCP < requiredCP) {
      sounds.playClick();
      showToast(
        lang === 'th'
          ? `ค่าพลังของคุณ (${userCP.toLocaleString()} CP) ไม่ถึงเกณฑ์ขั้นต่ำ (${requiredCP.toLocaleString()} CP)`
          : `Your Power Level (${userCP.toLocaleString()} CP) is below the required ${requiredCP.toLocaleString()} CP`,
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

  const handleAddClan = async (clanName: string) => {
    await addClanDoc({ name: clanName });
    showToast(lang === 'th' ? 'เพิ่มแคลนใหม่สำเร็จ' : 'Clan added', 'success');
  };

  const handleDeleteClan = async (clanId: string) => {
    sounds.playClick();
    setClans((prev) => prev.filter((c) => c.id !== clanId));
    try {
      await deleteClanDoc(clanId);
      showToast(lang === 'th' ? 'ลบแคลนสำเร็จ' : 'Clan deleted', 'info');
    } catch (err) {
      console.error('Failed to delete clan:', err);
    }
  };

  const handleMoveMemberClan = async (userId: string, newClanName: string) => {
    sounds.playClaim();
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, clan: newClanName } : u))
    );
    try {
      await updateUserDoc(userId, { clan: newClanName });
      showToast(lang === 'th' ? 'ย้ายแคลนสำเร็จ' : 'Member moved', 'success');
    } catch (err) {
      console.error('Failed to move member clan:', err);
    }
  };

  // Members Handlers (Approvals & Management)
  const handleApproveMember = async (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, status: 'active' } : u))
    );
    try {
      await updateUserDoc(userId, { status: 'active' });
    } catch (err) {
      console.error('Failed to approve member in Firestore:', err);
    }
  };

  const handleRejectMember = async (userId: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    try {
      await deleteUserDoc(userId);
    } catch (err) {
      console.error('Failed to reject member in Firestore:', err);
    }
  };

  const handleUpdateMember = async (userId: string, updates: Partial<User>) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, ...updates } : u))
    );
    try {
      await updateUserDoc(userId, updates);
    } catch (err) {
      console.error('Failed to update member in Firestore:', err);
    }
  };

  const handleDeleteMember = async (userId: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    try {
      await deleteUserDoc(userId);
    } catch (err) {
      console.error('Failed to delete member in Firestore:', err);
    }
  };

  const handleBatchDeleteMembers = async (userIds: string[]) => {
    const idSet = new Set(userIds);
    setUsers((prev) => prev.filter((u) => !idSet.has(u.id)));
    for (const uid of userIds) {
      try {
        await deleteUserDoc(uid);
      } catch (err) {
        console.error('Failed to batch delete member:', uid, err);
      }
    }
  };

  // Available items to show on Dashboard (status === 'available') - Memoized
  const availableDashboardItems = useMemo(
    () => vaultItems.filter((i) => i.status === 'available'),
    [vaultItems]
  );

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
            characterClasses={characterClasses}
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
          if (!canAccessAdminFeatures && (tab === 'vault' || tab === 'clan')) {
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
        onOpenClassModal={() => setShowClassModal(true)}
        discordEnabled={discordSettings?.enabled}
        pendingQueueCount={queueItems.filter((i) => i.status === 'queued').length}
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

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
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
          />
        )}

        {activeTab === 'all_members' && (
          <MembersView
            lang={lang}
            currentUser={currentUser}
            allMembers={users}
            characterClasses={characterClasses}
            onOpenClassModal={() => setShowClassModal(true)}
            onApproveMember={handleApproveMember}
            onRejectMember={handleRejectMember}
            onUpdateMember={handleUpdateMember}
            onDeleteMember={handleDeleteMember}
          />
        )}

        {activeTab === 'clan' && canAccessAdminFeatures && (
          <ClanView
            lang={lang}
            currentUser={currentUser}
            allMembers={users}
            clans={clans}
            onAddClan={handleAddClan}
            onDeleteClan={handleDeleteClan}
            onMoveMemberClan={handleMoveMemberClan}
            onDeleteMember={handleDeleteMember}
            onBatchDeleteMembers={handleBatchDeleteMembers}
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
        characterClasses={characterClasses}
      />

      <DiamondVaultModal
        isOpen={showVaultModal}
        onClose={() => setShowVaultModal(false)}
        lang={lang}
        currentUser={currentUser}
        vaultBalance={vaultBalance}
        transactions={diamondLogs}
        onPerformTransaction={handleVaultTransaction}
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
          onUnclaim={handleUnclaimItem}
          onDistributeToClaimant={(item, claimant) => {
            setClaimantsTargetItem(null);
            setDistributeClaimantId(claimant.userId || claimant.inGameName);
            setDistributeTargetItem(item);
          }}
        />
      )}

      {imageViewerData && (
        <ImageViewerModal
          isOpen={true}
          onClose={() => setImageViewerData(null)}
          imageUrl={imageViewerData.url}
          title={imageViewerData.title}
          images={imageViewerData.images}
          initialIndex={imageViewerData.currentIndex}
          lang={lang}
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

      <ClassSettingsModal
        isOpen={showClassModal && canAccessAdminFeatures}
        onClose={() => setShowClassModal(false)}
        classes={characterClasses}
        members={users}
        onAddClass={handleAddClass}
        onDeleteClass={handleDeleteClass}
        onResetClasses={handleResetClasses}
        isOwner={currentUser?.role === 'owner'}
        lang={lang}
      />

      {/* In-App Toast Notification (Replaces native alert/blocking popups) */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-300">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md text-xs font-semibold max-w-md ${
              toast.type === 'error'
                ? 'bg-red-950/95 border-red-500/80 text-red-100 shadow-red-950/60'
                : toast.type === 'success'
                ? 'bg-emerald-950/95 border-emerald-500/80 text-emerald-100 shadow-emerald-950/60'
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
