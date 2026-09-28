import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Plus,
  Sparkles,
  Upload,
  Scan,
  Camera,
  Image as ImageIcon,
  Trash2,
  ZoomIn,
  Eye,
  CheckCircle2,
  CheckCircle,
  Clock,
  AlertCircle,
  Gem,
  Zap,
  Users,
  Shield,
  Layers,
  UserCheck,
  RotateCcw,
  Search,
  Filter,
  Download,
  Copy,
  Check,
  BarChart3,
  SlidersHorizontal,
  ArrowUpDown,
  ClipboardCheck,
  Key,
  Cpu,
  ExternalLink,
  FileText,
  LayoutGrid,
  CheckSquare,
  Square,
  Gift,
  Receipt,
  Edit,
  X
} from 'lucide-react';
import {
  HunterRecord,
  ItemRarity,
  Language,
  QuickItem,
  User,
  VaultItem,
  DirectDistributionPayload,
  cleanClanName,
  DEFAULT_CLAN,
  isItemDistributed,
  isDistributedItemPaymentPending
} from '../types';
import { translations } from '../translations';
import { sounds } from '../utils/sound';
import { scanHuntersLocally } from '../services/localOcrService';
import { compressImageFile } from '../utils/imageCompressor';
import { DistributionStatsModal } from './DistributionStatsModal';
import { GeminiKeyModal } from './GeminiKeyModal';
import {
  getCurrentUserIdToken,
  updateVaultItemDoc,
  clearDistributedVaultItemsDoc
} from '../services/firebase';

interface VaultViewProps {
  lang: Language;
  currentUser: User | null;
  allMembers: User[];
  vaultItems: VaultItem[];
  quickItems: QuickItem[];
  onOpenQuickItemsModal: () => void;
  onCreateVaultItem: (
    item: Omit<VaultItem, 'id' | 'createdAt' | 'status' | 'claimants'>,
    directDistribution?: DirectDistributionPayload
  ) => Promise<void>;
  onDeleteVaultItem: (itemId: string) => Promise<void>;
  onEditItem?: (item: VaultItem) => void;
  onViewImageZoom: (
    url: string,
    title?: string,
    images?: string[],
    currentIndex?: number
  ) => void;
  onOpenOwnerResetModal?: () => void;
  onConfirmPayment?: (item: VaultItem, targetStatus?: 'pending' | 'paid') => void;
}

export const VaultView: React.FC<VaultViewProps> = ({
  lang,
  currentUser,
  allMembers,
  vaultItems,
  quickItems,
  onOpenQuickItemsModal,
  onCreateVaultItem,
  onDeleteVaultItem,
  onEditItem,
  onViewImageZoom,
  onOpenOwnerResetModal,
  onConfirmPayment
}) => {
  const t = translations[lang];
  const isOwner = currentUser?.role === 'owner';
  const isAdminOrOwner =
    isOwner ||
    currentUser?.role === 'admin' ||
    currentUser?.role === 'manager';
  const canUseOcr = isAdminOrOwner;

  // State for in-app deletion confirmation
  const [itemToDelete, setItemToDelete] = useState<VaultItem | null>(null);

  // State for quick purge of distributed items (storage optimization)
  const [showQuickPurgeModal, setShowQuickPurgeModal] = useState(false);
  const [isPurgingDistributed, setIsPurgingDistributed] = useState(false);
  const [purgeSuccessMsg, setPurgeSuccessMsg] = useState<string | null>(null);

  const handleQuickPurgeDistributed = async () => {
    if (!isOwner) return;
    setIsPurgingDistributed(true);
    try {
      sounds.playClick();
      const count = await clearDistributedVaultItemsDoc();
      sounds.playSuccess();
      setPurgeSuccessMsg(
        lang === 'th'
          ? `ล้างประวัติไอเทมที่แจกแล้วสำเร็จ (${count} รายการ) คืนพื้นที่ฟรีเรียบร้อย!`
          : `Successfully purged ${count} distributed items, freeing up database storage!`
      );
      setShowQuickPurgeModal(false);
      setTimeout(() => setPurgeSuccessMsg(null), 5000);
    } catch (err) {
      console.error('Purge error:', err);
    } finally {
      setIsPurgingDistributed(false);
    }
  };

  // Form State
  const [name, setName] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [quantity, setQuantity] = useState<number | ''>(1);
  const [minPowerLevel, setMinPowerLevel] = useState<number | ''>('');
  const [rarity, setRarity] = useState<ItemRarity>('LAGEND');
  const [itemImageUrl, setItemImageUrl] = useState('');
  const [itemImagePreview, setItemImagePreview] = useState('');

  // Remembered item names state & aggregator
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);

  const rememberedNames = useMemo(() => {
    const namesSet = new Set<string>();
    vaultItems.forEach((i) => {
      if (i.name && i.name.trim()) namesSet.add(i.name.trim());
    });
    quickItems.forEach((q) => {
      if (q.name && q.name.trim()) namesSet.add(q.name.trim());
    });
    try {
      const stored = localStorage.getItem('l2m_recent_item_names');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          parsed.forEach((n) => {
            if (typeof n === 'string' && n.trim()) namesSet.add(n.trim());
          });
        }
      }
    } catch {
      // ignore
    }
    return Array.from(namesSet);
  }, [vaultItems, quickItems]);

  const filteredNameSuggestions = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (!q) return rememberedNames.slice(0, 10);
    return rememberedNames
      .filter((n) => n.toLowerCase().includes(q) && n.toLowerCase() !== q)
      .slice(0, 8);
  }, [name, rememberedNames]);
  
  // OCR & Hunters State
  const [hunters, setHunters] = useState<HunterRecord[]>([]);
  const [selectedHunterMemberId, setSelectedHunterMemberId] = useState('');
  const [customHunterName, setCustomHunterName] = useState('');
  const [customHunterClan, setCustomHunterClan] = useState('VoltZ');
  const [hunterScreenshots, setHunterScreenshots] = useState<string[]>([]);
  const [isScanningOCR, setIsScanningOCR] = useState(false);
  const [ocrStatusText, setOcrStatusText] = useState('');
  const [ocrErrorType, setOcrErrorType] = useState<string | null>(null);
  const [ocrScanSummary, setOcrScanSummary] = useState<{
    type: 'scanning' | 'success' | 'empty' | 'duplicates_filtered' | 'no_duplicates' | 'pasted_ready' | 'missing_key' | 'error';
    sourceCount?: number;
    newCount?: number;
    duplicates?: number;
    errorReason?: 'ai_server_connect' | 'high_demand' | 'glitch' | 'missing_key' | 'custom';
    rawMsg?: string;
    errorMsg?: string;
  } | null>(null);
  const [showGeminiModal, setShowGeminiModal] = useState(false);
  const [geminiConfigured, setGeminiConfigured] = useState<boolean>(true);
  const [geminiMaskedKey, setGeminiMaskedKey] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Direct Distribution Mode State
  const [itemEntryMode, setItemEntryMode] = useState<'normal' | 'direct_distribute'>('normal');
  const [directRecipient, setDirectRecipient] = useState<User | null>(null);
  const [directReceiptImages, setDirectReceiptImages] = useState<string[]>([]);
  const [directPaymentStatus, setDirectPaymentStatus] = useState<'pending' | 'paid'>('pending');
  const [showHunterChecklistModal, setShowHunterChecklistModal] = useState(false);
  const [showQuickItemsDropdown, setShowQuickItemsDropdown] = useState(false);

  const handleResetCreateForm = () => {
    if (name || itemImagePreview || hunters.length > 0 || hunterScreenshots.length > 0 || price !== '') {
      if (window.confirm(lang === 'th' ? 'ต้องการล้างข้อมูลในฟอร์มทั้งหมดหรือไม่?' : 'Do you want to reset the form?')) {
        sounds.playClick();
        setName('');
        setPrice('');
        setQuantity(1);
        setMinPowerLevel('');
        setItemImageUrl('');
        setItemImagePreview('');
        setHunters([]);
        setHunterScreenshots([]);
        setOcrStatusText('');
        setDuplicatesRemovedCount(null);
        setDirectRecipient(null);
        setDirectReceiptImages([]);
        setDirectPaymentStatus('pending');
        setFormError('');
        setFormSuccess('');
      }
    }
  };

  const activeMembersByClan = useMemo(() => {
    const groups: Record<string, User[]> = {};
    allMembers.filter((m) => m.status === 'active').forEach((m) => {
      const clan = m.clan || 'No Clan';
      if (!groups[clan]) groups[clan] = [];
      groups[clan].push(m);
    });
    Object.keys(groups).forEach((clan) => {
      groups[clan].sort((a, b) => (b.powerLevel || 0) - (a.powerLevel || 0));
    });
    return groups;
  }, [allMembers]);

  // Section 7 Scan Results Copy & View Mode State
  const [hunterResultViewMode, setHunterResultViewMode] = useState<'cards' | 'text'>('cards');
  const [hunterTextFormat, setHunterTextFormat] = useState<'by-clan' | 'plain' | 'inline' | 'comma'>('by-clan');
  const [textClanFilter, setTextClanFilter] = useState<string>('all');
  const [copiedHunters, setCopiedHunters] = useState<boolean>(false);

  // Section Hunter Checklist Picker State
  const [hunterSearchQuery, setHunterSearchQuery] = useState('');
  const [hunterClanFilter, setHunterClanFilter] = useState<string>('all');

  // Distributed Items Hunters Viewer Modal State
  const [viewingDistributedHuntersItem, setViewingDistributedHuntersItem] = useState<VaultItem | null>(null);
  const [distHuntersViewMode, setDistHuntersViewMode] = useState<'cards' | 'text'>('cards');
  const [distHuntersTextFormat, setDistHuntersTextFormat] = useState<'by-clan' | 'plain' | 'inline' | 'comma'>('by-clan');
  const [distHuntersClanFilter, setDistHuntersClanFilter] = useState<string>('all');
  const [copiedDistHunters, setCopiedDistHunters] = useState<boolean>(false);
  const [distFilterStatus, setDistFilterStatus] = useState<'all' | 'incomplete' | 'complete'>('all');

  // Check server-side Gemini availability without exposing the API key to this screen.
  useEffect(() => {
    const checkServerStatus = async () => {
      try {
        const token = await getCurrentUserIdToken();
        const res = await fetch('/api/gemini-status', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        const text = await res.text();
        if (text && !text.trim().startsWith('<')) {
          const data = JSON.parse(text);
          if (typeof data?.configured === 'boolean') {
            setGeminiConfigured(data.configured);
            if (data.maskedKey) {
              setGeminiMaskedKey(data.maskedKey);
            }
            return;
          }
        }
      } catch {
        // Ignore and fallback below
      }
    };
    checkServerStatus();

  }, [isOwner, currentUser]);

  // Group active members by Clan for hunter dropdown selection, sorted by powerLevel descending
  const membersByClan = useMemo(() => {
    const groups: Record<string, User[]> = {};
    allMembers
      .filter((m) => m.status === 'active' && m.inGameName)
      .forEach((m) => {
        const clan = cleanClanName(m.clan) || 'No Clan';
        if (!groups[clan]) groups[clan] = [];
        groups[clan].push(m);
      });
    Object.keys(groups).forEach((clan) => {
      groups[clan].sort((a, b) => (b.powerLevel || 0) - (a.powerLevel || 0));
    });
    return groups;
  }, [allMembers]);

  // Active members who have an inGameName, sorted by power level descending
  const activeMembersList = useMemo(() => {
    return allMembers
      .filter((m) => m.status === 'active' && m.inGameName)
      .sort((a, b) => (b.powerLevel || 0) - (a.powerLevel || 0));
  }, [allMembers]);

  // Set of selected hunter names (case-insensitive for fast lookup)
  const selectedHunterNameSet = useMemo(() => {
    return new Set(hunters.map((h) => h.name.trim().toLowerCase()));
  }, [hunters]);

  // Filtered members for the checklist based on search and clan
  const filteredChecklistMembers = useMemo(() => {
    return activeMembersList.filter((m) => {
      const matchesClan =
        hunterClanFilter === 'all' ||
        cleanClanName(m.clan).toLowerCase() === cleanClanName(hunterClanFilter).toLowerCase();
      const q = hunterSearchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        m.inGameName.toLowerCase().includes(q) ||
        (m.clan && cleanClanName(m.clan).toLowerCase().includes(q)) ||
        (m.characterClass && m.characterClass.toLowerCase().includes(q));
      return matchesClan && matchesSearch;
    });
  }, [activeMembersList, hunterClanFilter, hunterSearchQuery]);

  // Toggle individual member in checklist
  const handleToggleHunterMember = (member: User) => {
    sounds.playClick();
    const nameKey = member.inGameName.trim().toLowerCase();
    const existingIdx = hunters.findIndex((h) => h.name.trim().toLowerCase() === nameKey);

    if (existingIdx >= 0) {
      // Remove from list
      setHunters((prev) => prev.filter((_, idx) => idx !== existingIdx));
    } else {
      // Add to list
      setHunters((prev) => [
        ...prev,
        {
          name: member.inGameName.trim(),
          clan: cleanClanName(member.clan) || 'VoltZ'
        }
      ]);
    }
  };

  // Select all currently filtered members
  const handleSelectAllFiltered = () => {
    sounds.playClaim();
    const newHunters = [...hunters];
    const existingNames = new Set(newHunters.map((h) => h.name.trim().toLowerCase()));

    filteredChecklistMembers.forEach((m) => {
      const nameKey = m.inGameName.trim().toLowerCase();
      if (!existingNames.has(nameKey)) {
        existingNames.add(nameKey);
        newHunters.push({
          name: m.inGameName.trim(),
          clan: cleanClanName(m.clan) || 'VoltZ'
        });
      }
    });

    setHunters(newHunters);
  };

  // Deselect all currently filtered members
  const handleDeselectAllFiltered = () => {
    sounds.playClick();
    const filteredKeys = new Set(filteredChecklistMembers.map((m) => m.inGameName.trim().toLowerCase()));
    setHunters((prev) => prev.filter((h) => !filteredKeys.has(h.name.trim().toLowerCase())));
  };

  // Helper to generate formatted text based on format and clan filter
  const getFormattedHunterText = (
    format: 'by-clan' | 'plain' | 'inline' | 'comma' = hunterTextFormat,
    targetClan: string = textClanFilter
  ): string => {
    if (hunters.length === 0) return '';

    const sourceHunters =
      targetClan === 'all'
        ? hunters
        : hunters.filter((h) => (cleanClanName(h.clan) || 'VoltZ').toLowerCase() === cleanClanName(targetClan).toLowerCase());

    if (sourceHunters.length === 0) return '';

    if (format === 'comma') {
      return sourceHunters.map((h) => h.name).join(', ');
    }

    if (format === 'plain') {
      return sourceHunters.map((h) => h.name).join('\n');
    }

    if (format === 'inline') {
      return sourceHunters
        .map((h, i) => `${i + 1}. ${h.name} (${cleanClanName(h.clan) || 'VoltZ'})`)
        .join('\n');
    }

    // Default: 'by-clan' (Grouped cleanly by Clan with headers and member counts)
    const grouped = sourceHunters.reduce((acc, h) => {
      const clanKey = cleanClanName(h.clan) || 'VoltZ';
      if (!acc[clanKey]) acc[clanKey] = [];
      acc[clanKey].push(h.name);
      return acc;
    }, {} as Record<string, string[]>);

    return (Object.entries(grouped) as [string, string[]][])
      .map(([clan, names]) => {
        const clanHeader = `[${clan}] (${names.length} ${lang === 'th' ? 'คน' : 'members'})`;
        const memberList = names.map((name, idx) => `${idx + 1}. ${name}`).join('\n');
        return `${clanHeader}\n${memberList}`;
      })
      .join('\n\n');
  };

  // Copy all hunters to clipboard with chosen format and clan filter
  const handleCopyAllHunters = (
    customFormat?: 'by-clan' | 'plain' | 'inline' | 'comma',
    customClan?: string
  ) => {
    if (hunters.length === 0) return;
    const textToCopy = getFormattedHunterText(
      customFormat || hunterTextFormat,
      customClan !== undefined ? customClan : textClanFilter
    );
    if (!textToCopy) return;

    navigator.clipboard.writeText(textToCopy);
    setCopiedHunters(true);
    sounds.playClaim();
    setTimeout(() => setCopiedHunters(false), 2500);
  };

  // Dynamic bilingual OCR status text that reacts instantly when user switches language
  const dynamicOcrStatusMessage = useMemo(() => {
    if (!ocrScanSummary) return ocrStatusText;
    switch (ocrScanSummary.type) {
      case 'scanning':
        return lang === 'th'
          ? `กำลังส่งรูปภาพ ${ocrScanSummary.sourceCount || 1} รูป ให้ Google Gemini AI OCR สแกนชื่อผู้ล่า...`
          : `Sending ${ocrScanSummary.sourceCount || 1} image(s) to Google Gemini AI OCR for hunter extraction...`;
      case 'direct_fallback':
        return lang === 'th'
          ? 'กำลังเชื่อมต่อไปยัง Google Gemini REST API โดยตรง...'
          : 'Connecting directly to Google Gemini REST API...';
      case 'success':
        return lang === 'th'
            ? `สแกนสำเร็จจาก ${ocrScanSummary.sourceCount || 1} รูปภาพ: พบผู้ล่าใหม่ ${ocrScanSummary.newCount || 0} คน (กรองชื่อซ้ำออก ${ocrScanSummary.duplicates || 0} คน)`
            : `Scan successful from ${ocrScanSummary.sourceCount || 1} image(s): ${ocrScanSummary.newCount || 0} new hunters added (${ocrScanSummary.duplicates || 0} duplicates filtered)`;
      case 'empty':
        return lang === 'th'
          ? `สแกน ${ocrScanSummary.sourceCount || 1} รูปภาพแล้ว แต่ไม่พบรายชื่อผู้ล่าที่ตรงกับกิลด์ในระบบ สามารถเลือกจากรายการเช็คลิสต์ด้านล่างได้`
          : `Scanned ${ocrScanSummary.sourceCount || 1} screenshot(s), but no matching clan members found. You can pick hunters from the checklist below.`;
      case 'duplicates_filtered':
        return lang === 'th'
          ? `ตรวจพบและลบรายชื่อซ้ำออกแล้ว ${ocrScanSummary.duplicates || 0} คน`
          : `Detected and removed ${ocrScanSummary.duplicates || 0} duplicate names`;
      case 'no_duplicates':
        return lang === 'th'
          ? 'ไม่พบรายชื่อผู้ล่าที่ซ้ำกัน รายชื่อทั้งหมดไม่ซ้ำกันแล้ว'
          : 'No duplicate hunter names found. All names are unique.';
      case 'pasted_ready':
        return lang === 'th'
          ? `วางรูปภาพ ${ocrScanSummary.sourceCount || 1} รูปลงในระบบแล้ว พร้อมสำหรับการสแกน`
          : `Pasted ${ocrScanSummary.sourceCount || 1} image(s) successfully, ready to scan.`;
      case 'missing_key':
        return lang === 'th'
          ? 'ยังไม่ได้ตั้งค่า Gemini API Key กรุณาตั้งค่าเพื่อเปิดใช้งาน OCR'
          : 'Gemini API Key is not configured. Please configure it to enable OCR.';
      case 'error': {
        const prefix = t.ocrConnectionErrorPrefix;
        if (ocrScanSummary.errorReason === 'ai_server_connect') {
          return `${prefix}${t.ocrServerConnectError}`;
        }
        if (ocrScanSummary.errorReason === 'high_demand') {
          return `${prefix}${t.ocrHighDemandGlitch}`;
        }
        if (ocrScanSummary.errorReason === 'glitch') {
          return `${prefix}${t.ocrConnectionGlitch}`;
        }
        if (ocrScanSummary.errorReason === 'missing_key') {
          return `${prefix}${t.geminiKeyNoticeMissing}`;
        }
        return `${prefix}${ocrScanSummary.rawMsg || t.ocrGeneralError}`;
      }
      default:
        return ocrStatusText;
    }
  }, [ocrScanSummary, lang, ocrStatusText, t]);

  // Formatter for hunters of a distributed item
  const getFormattedDistributedHuntersText = (item: VaultItem): string => {
    const list = item.hunters || [];
    if (list.length === 0) return '';

    const sourceHunters =
      distHuntersClanFilter === 'all'
        ? list
        : list.filter((h) => (cleanClanName(h.clan) || 'VoltZ').toLowerCase() === cleanClanName(distHuntersClanFilter).toLowerCase());

    if (sourceHunters.length === 0) return '';

    if (distHuntersTextFormat === 'comma') {
      return sourceHunters.map((h) => h.name).join(', ');
    }
    if (distHuntersTextFormat === 'plain') {
      return sourceHunters.map((h) => h.name).join('\n');
    }
    if (distHuntersTextFormat === 'inline') {
      return sourceHunters
        .map((h, i) => `${i + 1}. ${h.name} (${cleanClanName(h.clan) || 'VoltZ'})`)
        .join('\n');
    }

    // Default: 'by-clan'
    const grouped = sourceHunters.reduce((acc, h) => {
      const clanKey = cleanClanName(h.clan) || 'VoltZ';
      if (!acc[clanKey]) acc[clanKey] = [];
      acc[clanKey].push(h.name);
      return acc;
    }, {} as Record<string, string[]>);

    return (Object.entries(grouped) as [string, string[]][])
      .map(([clan, names]) => {
        const clanHeader = `[${clan}] (${names.length} ${lang === 'th' ? 'คน' : 'members'})`;
        const memberList = names.map((name, idx) => `${idx + 1}. ${name}`).join('\n');
        return `${clanHeader}\n${memberList}`;
      })
      .join('\n\n');
  };

  const handleCopyDistributedHunters = (item: VaultItem) => {
    const text = getFormattedDistributedHuntersText(item);
    if (!text) return;
    navigator.clipboard.writeText(text);
    sounds.playClaim();
    setCopiedDistHunters(true);
    setTimeout(() => setCopiedDistHunters(false), 2500);
  };

  // Clear all hunters with confirmation
  const handleClearAllHunters = () => {
    if (hunters.length === 0) return;
    if (window.confirm(t.clearAllHuntersConfirm)) {
      sounds.playClick();
      setHunters([]);
      setDuplicatesRemovedCount(null);
    }
  };

  // Active view inside Vault: 'create', 'active', or 'distributed'
  const [vaultSubTab, setVaultSubTab] = useState<'create' | 'active' | 'distributed'>('active');
  const [distViewMode, setDistViewMode] = useState<'boxes' | 'table'>('boxes');

  // State to track deduplication stats
  const [duplicatesRemovedCount, setDuplicatesRemovedCount] = useState<number | null>(null);

  // Helper function to deduplicate hunter list
  const deduplicateHunterList = (list: HunterRecord[]): { unique: HunterRecord[]; removedCount: number } => {
    const seen = new Set<string>();
    const unique: HunterRecord[] = [];
    let removedCount = 0;

    for (const h of list) {
      const nameKey = (h.name || '').trim().toLowerCase();
      if (!nameKey) continue;
      if (seen.has(nameKey)) {
        removedCount++;
      } else {
        seen.add(nameKey);
        unique.push({
          name: h.name.trim(),
          clan: cleanClanName(h.clan) || 'VoltZ'
        });
      }
    }
    return { unique, removedCount };
  };

  // Manual trigger to filter duplicates from current hunters list
  const handleFilterDuplicates = () => {
    sounds.playClick();
    const { unique, removedCount } = deduplicateHunterList(hunters);
    setHunters(unique);
    setDuplicatesRemovedCount(removedCount);
    if (removedCount > 0) {
      setOcrScanSummary({
        type: 'duplicates_filtered',
        duplicates: removedCount
      });
      setOcrStatusText(
        lang === 'th'
          ? `ตัดรายชื่อซ้ำออก ${removedCount} รายการ สำเร็จ`
          : `Filtered ${removedCount} duplicate hunter(s)`
      );
    } else {
      setOcrScanSummary({
        type: 'no_duplicates'
      });
      setOcrStatusText(
        lang === 'th'
          ? 'ไม่พบรายชื่อซ้ำ รายชื่อทั้งหมดมีเอกลักษณ์แล้ว'
          : 'No duplicates found. All hunter names are unique.'
      );
    }
  };

  // Helper to extract image files from a ClipboardEvent
  const extractImageFilesFromClipboard = (e: React.ClipboardEvent | ClipboardEvent): File[] => {
    const clipboardData = 'clipboardData' in e ? e.clipboardData : null;
    if (!clipboardData || !clipboardData.items) return [];
    const files: File[] = [];
    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i];
      if (item.type && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    return files;
  };

  // Reusable processor for item image (file picker or Ctrl+V paste)
  const processItemImageFile = async (file: File, isPaste = false) => {
    try {
      const compressedDataUrl = await compressImageFile(file, {
        maxWidth: 600,
        maxHeight: 600,
        quality: 0.8
      });
      setItemImagePreview(compressedDataUrl);
      setItemImageUrl(compressedDataUrl);
      sounds.playClaim();
      if (isPaste) {
        setFormSuccess(
          lang === 'th'
            ? 'วางรูปภาพไอเทมสำเร็จ (Ctrl + V) 📋'
            : 'Item image pasted successfully (Ctrl + V) 📋'
        );
      }
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setItemImagePreview(result);
        setItemImageUrl(result);
        sounds.playClaim();
      };
      reader.readAsDataURL(file);
    }
  };

  // Reusable processor for backup hunter screenshots
  const processBackupScreenshotsFiles = async (files: File[], isPaste = false) => {
    if (!files || files.length === 0) return;
    try {
      const compressedPromises = files.map((file) =>
        compressImageFile(file, { maxWidth: 1280, maxHeight: 1280, quality: 0.75 })
      );
      const compressedResults = await Promise.all(compressedPromises);
      setHunterScreenshots((prev) => [...prev, ...compressedResults]);
      sounds.playClick();
      if (isPaste) {
        setOcrStatusText(
          lang === 'th'
            ? `วางรูปภาพหลักฐาน ${files.length} รูปสำเร็จ (Ctrl + V) 📋`
            : `Pasted ${files.length} screenshot(s) (Ctrl + V) 📋`
        );
      }
    } catch {
      files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          setHunterScreenshots((prev) => [...prev, result]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  // Core OCR Scanner Runner
  const executeHunterOcr = async (base64Images: string[], sourceCount: number, isPaste = false) => {
    if (!base64Images || base64Images.length === 0) return;
    if (!canUseOcr) {
      setOcrErrorType('FORBIDDEN');
      setOcrStatusText(lang === 'th' ? 'เฉพาะ Admin และ Owner เท่านั้นที่ใช้ OCR ได้' : 'OCR is available to Admin and Owner roles only.');
      return;
    }
    setIsScanningOCR(true);
    setOcrErrorType(null);
    setOcrStatusText(
      lang === 'th'
        ? `กำลังสแกนรายชื่อผู้ล่าจาก ${sourceCount} รูปภาพ${isPaste ? ' (จาก Ctrl + V)' : ''}...`
        : `Analyzing & scanning ${sourceCount} screenshot(s)${isPaste ? ' (from Ctrl + V)' : ''}...`
    );

    try {
      const knownMemberList = allMembers.map((m) => ({
        inGameName: m.inGameName,
        clan: cleanClanName(m.clan) || 'VoltZ',
        powerLevel: m.powerLevel
      }));

      let data: any = null;
      // Use the authenticated backend on localhost and deployed environments.
        try {
          const token = await getCurrentUserIdToken();
          const response = await fetch('/api/scan-hunters', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
              imagesBase64: base64Images,
              imageBase64: base64Images[0],
              knownMembers: knownMemberList,
              lang
            })
          });

          const respText = await response.text();
          if (respText && !respText.trim().startsWith('<')) {
            try {
              data = JSON.parse(respText);
            } catch {
              data = null;
            }
          }
        } catch (fetchErr) {
          console.warn('Backend /api/scan-hunters fetch failed:', fetchErr);
          data = null;
        }

      // Free local OCR fallback: runs in the browser and consumes no Google quota.
      if (!data?.success) {
        setOcrStatusText(lang === 'th' ? 'Google ไม่พร้อมใช้งาน กำลังใช้ OCR ฟรีบนเครื่อง...' : 'Google unavailable. Running free on-device OCR...');
        const localHunters = await scanHuntersLocally(base64Images, allMembers);
        const grouped = new Map<string, string[]>();
        localHunters.forEach((hunter) => grouped.set(hunter.clan, [...(grouped.get(hunter.clan) || []), hunter.name]));
        data = {
          success: true,
          localOcr: true,
          detectedClanGroups: [...grouped.entries()].map(([clanName, members]) => ({ clanName, members })),
          rawNames: localHunters.map((hunter) => hunter.name),
          duplicatesFilteredCount: 0
        };
      }

      if (data.error === 'MISSING_API_KEY') {
        setOcrErrorType('MISSING_API_KEY');
        setGeminiConfigured(false);
        setOcrScanSummary({
          type: 'error',
          errorReason: 'missing_key'
        });
        setOcrStatusText(
          lang === 'th'
            ? '⚠️ ยังไม่ได้ตั้งค่า Gemini API Key ทำให้ระบบ AI ไม่สามารถอ่านตัวหนังสือจากรูปได้'
            : '⚠️ Gemini API Key is not configured. AI cannot read text from screenshots.'
        );
        sounds.playError();
        return;
      }

      if (!data.success) {
        setOcrErrorType('GEMINI_ERROR');
        const rawMsg = data.message || '';
        let errorReason: 'high_demand' | 'glitch' | 'custom' = 'custom';
        if (rawMsg.includes('high demand') || rawMsg.includes('503') || rawMsg.includes('หนาแน่น')) {
          errorReason = 'high_demand';
        } else if (rawMsg.includes('JSON') || rawMsg.includes('Unexpected token') || rawMsg.includes('The page c')) {
          errorReason = 'glitch';
        }

        setOcrScanSummary({
          type: 'error',
          errorReason,
          rawMsg: errorReason === 'custom' ? rawMsg : undefined
        });

        const localizedMsg =
          errorReason === 'high_demand'
            ? t.ocrHighDemandGlitch
            : errorReason === 'glitch'
            ? t.ocrConnectionGlitch
            : rawMsg || t.ocrGeneralError;

        setOcrStatusText(`❌ ${localizedMsg}`);
        sounds.playError();
        return;
      }

      if (data.detectedClanGroups && data.detectedClanGroups.length > 0) {
        setGeminiConfigured(true);
        const extractedHunters: HunterRecord[] = [];
        data.detectedClanGroups.forEach((group: { clanName: string; members: string[] }) => {
          const cleanGroupClan = cleanClanName(group.clanName) || 'VoltZ';
          group.members.forEach((memName: string) => {
            extractedHunters.push({
              name: memName,
              clan: cleanGroupClan
            });
          });
        });

        // Strict Deduplication against both current list and incoming list
        const existingNames = new Set(hunters.map((h) => h.name.trim().toLowerCase()));
        const incomingUnique: HunterRecord[] = [];
        let duplicateCounter = 0;

        for (const h of extractedHunters) {
          const nameKey = h.name.trim().toLowerCase();
          if (!nameKey) continue;
          if (existingNames.has(nameKey)) {
            duplicateCounter++;
          } else {
            existingNames.add(nameKey);
            incomingUnique.push({
              name: h.name.trim(),
              clan: cleanClanName(h.clan) || 'VoltZ'
            });
          }
        }

        const totalDuplicatesFiltered = (data.duplicatesFilteredCount || 0) + duplicateCounter;
        setDuplicatesRemovedCount(totalDuplicatesFiltered);

        setHunters((prev) => [...prev, ...incomingUnique]);
        sounds.playClaim();

        setOcrScanSummary({
          type: 'success',
          sourceCount,
          newCount: incomingUnique.length,
          duplicates: totalDuplicatesFiltered
        });

        setOcrStatusText(
          lang === 'th'
            ? `สแกนสำเร็จจาก ${sourceCount} รูปภาพ: พบผู้ล่าใหม่ ${incomingUnique.length} คน (กรองชื่อซ้ำออก ${totalDuplicatesFiltered} คน)`
            : `Scan successful from ${sourceCount} image(s): ${incomingUnique.length} new hunters added (${totalDuplicatesFiltered} duplicates filtered)`
        );
      } else {
        setOcrScanSummary({
          type: 'empty',
          sourceCount
        });
        setOcrStatusText(
          lang === 'th'
            ? `สแกน ${sourceCount} รูปภาพแล้ว แต่ไม่พบรายชื่อผู้ล่าที่ตรงกับกิลด์ในระบบ สามารถเลือกจากรายการเช็คลิสต์ด้านล่างได้`
            : `Scanned ${sourceCount} screenshot(s), but no matching clan members found. You can pick hunters from the checklist below.`
        );
      }
    } catch (err: any) {
      console.error('OCR scanning error:', err);
      setOcrErrorType('NETWORK_ERROR');
      const rawMsg = err?.message || '';
      let errorReason: 'ai_server_connect' | 'high_demand' | 'glitch' | 'custom' = 'custom';

      if (
        rawMsg === 'AI_SERVER_CONNECT_ERROR' ||
        rawMsg.includes('เซิร์ฟเวอร์') ||
        rawMsg.toLowerCase().includes('connect') ||
        rawMsg.toLowerCase().includes('failed to fetch')
      ) {
        errorReason = 'ai_server_connect';
      } else if (rawMsg.includes('503') || rawMsg.toLowerCase().includes('high demand') || rawMsg.includes('หนาแน่น')) {
        errorReason = 'high_demand';
      } else if (rawMsg.includes('JSON') || rawMsg.includes('Unexpected token') || rawMsg.includes('The page c')) {
        errorReason = 'glitch';
      }

      setOcrScanSummary({
        type: 'error',
        errorReason,
        rawMsg: errorReason === 'custom' ? rawMsg : undefined
      });

      const localizedMsg =
        errorReason === 'ai_server_connect'
          ? t.ocrServerConnectError
          : errorReason === 'high_demand'
          ? t.ocrHighDemandGlitch
          : errorReason === 'glitch'
          ? t.ocrConnectionGlitch
          : rawMsg || t.ocrGeneralError;

      setOcrStatusText(`${t.ocrConnectionErrorPrefix}${localizedMsg}`);
      sounds.playError();
    } finally {
      setIsScanningOCR(false);
    }
  };

  // Reusable processor for OCR hunter scan (from file picker or Ctrl+V paste)
  const processOcrScreenshotFiles = async (files: File[], isPaste = false) => {
    if (!files || files.length === 0) return;
    try {
      const compressedBase64List = await Promise.all(
        files.map((file) =>
          compressImageFile(file, { maxWidth: 1280, maxHeight: 1280, quality: 0.75 })
        )
      );

      // Add all screenshots to backup list automatically
      setHunterScreenshots((prev) => [...prev, ...compressedBase64List]);

      // Trigger OCR
      await executeHunterOcr(compressedBase64List, files.length, isPaste);
    } catch (err) {
      console.error('File compression error in processOcrScreenshotFiles:', err);
    }
  };

  // Scan from existing attached hunter screenshots
  const scanExistingScreenshots = async () => {
    if (hunterScreenshots.length === 0) return;
    await executeHunterOcr(hunterScreenshots, hunterScreenshots.length, false);
  };

  // Handle Item Image file upload with compression
  const handleItemImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processItemImageFile(file, false);
      e.target.value = '';
    }
  };

  // Handle Backup Hunter Screenshots file upload
  const handleBackupScreenshotsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processBackupScreenshotsFiles(Array.from(files), false);
      e.target.value = '';
    }
  };

  // Handle OCR Hunter Image Scan file upload
  const handleOcrScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processOcrScreenshotFiles(Array.from(files), false);
      e.target.value = '';
    }
  };

  // Direct Distribution: Receipt / Bill Upload & Paste handlers
  const handleDirectReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      try {
        const compressedList = await Promise.all(
          (Array.from(files) as File[]).map((file) =>
            compressImageFile(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.8 })
          )
        );
        setDirectReceiptImages((prev) => [...prev, ...compressedList]);
      } catch (err) {
        console.error('Failed to compress receipt image:', err);
      }
      e.target.value = '';
    }
  };

  const handleRemoveDirectReceipt = (idx: number) => {
    sounds.playClick();
    setDirectReceiptImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePasteDirectReceiptZone = async (e: React.ClipboardEvent) => {
    const images = extractImageFilesFromClipboard(e);
    if (images.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      try {
        const compressedList = await Promise.all(
          images.map((file) =>
            compressImageFile(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.8 })
          )
        );
        setDirectReceiptImages((prev) => [...prev, ...compressedList]);
      } catch (err) {
        console.error('Failed to compress pasted receipt image:', err);
      }
    }
  };

  // Direct paste handlers on specific dropzones
  const handlePasteItemImageZone = (e: React.ClipboardEvent) => {
    const images = extractImageFilesFromClipboard(e);
    if (images.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      processItemImageFile(images[0], true);
    }
  };

  const handlePasteBackupScreenshotsZone = (e: React.ClipboardEvent) => {
    const images = extractImageFilesFromClipboard(e);
    if (images.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      processBackupScreenshotsFiles(images, true);
    }
  };

  const handlePasteOcrZone = (e: React.ClipboardEvent) => {
    const images = extractImageFilesFromClipboard(e);
    if (images.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      processOcrScreenshotFiles(images, true);
    }
  };

  // Global window paste listener when viewing Create Item form
  useEffect(() => {
    if (vaultSubTab !== 'create') return;

    const handleWindowPaste = (e: ClipboardEvent) => {
      // Don't intercept if user is typing text in an input and clipboard only has text
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      const images = extractImageFilesFromClipboard(e);
      if (images.length === 0) return; // Allow normal text copy-paste

      // If user pasted image files, prevent default browser action
      e.preventDefault();

      if (!itemImagePreview) {
        // If item image isn't set, use first pasted image as item icon
        processItemImageFile(images[0], true);
        if (images.length > 1) {
          processOcrScreenshotFiles(images.slice(1), true);
        }
      } else {
        // If item image is already set, treat pasted images as hunter screenshots & trigger OCR
        processOcrScreenshotFiles(images, true);
      }
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => {
      window.removeEventListener('paste', handleWindowPaste);
    };
  }, [vaultSubTab, itemImagePreview, hunters, allMembers, lang]);

  // Add Hunter via Dropdown or Selection (No typing needed)
  const handleAddManualHunter = (overrideName?: string, overrideClan?: string) => {
    const finalName = (overrideName || customHunterName).trim();
    const finalClan = cleanClanName(overrideClan || customHunterClan) || 'VoltZ';
    if (!finalName) return;
    sounds.playClick();
    if (!hunters.some((h) => h.name.toLowerCase() === finalName.toLowerCase())) {
      setHunters((prev) => [
        ...prev,
        { name: finalName, clan: finalClan }
      ]);
    }
    setCustomHunterName('');
    setSelectedHunterMemberId('');
  };

  const handleRemoveHunter = (index: number) => {
    sounds.playClick();
    setHunters((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveScreenshot = (index: number) => {
    sounds.playClick();
    setHunterScreenshots((prev) => prev.filter((_, i) => i !== index));
  };

  // Select a Quick Item to populate form
  const handleApplyQuickItem = (item: QuickItem) => {
    sounds.playClick();
    setName(item.name);
    setRarity(item.rarity);
    setItemImageUrl(item.imageUrl);
    setItemImagePreview(item.imageUrl);
    setQuantity(item.quantity && item.quantity > 0 ? item.quantity : 1);
  };

  // Form Submit
  const handleCreateItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (itemEntryMode === 'direct_distribute') {
      if (!directRecipient || !directRecipient.inGameName?.trim()) {
        setFormError(t.recipientRequired);
        return;
      }
    }

    setIsCreating(true);
    try {
      sounds.playClaim();
      // Ensure strict deduplication before creating item
      const { unique: deduplicatedFinalHunters } = deduplicateHunterList(hunters);

      const isFreeItem = (Number(price) || 0) === 0;
      const directPayload: DirectDistributionPayload | undefined =
        itemEntryMode === 'direct_distribute' && directRecipient
          ? {
              recipient: {
                name: directRecipient.inGameName.trim(),
                clan: directRecipient.clan || 'No Clan',
                userId: directRecipient.id
              },
              receiptImages: isFreeItem ? [] : directReceiptImages,
              paymentStatus: isFreeItem ? 'paid' : directPaymentStatus
            }
          : undefined;

      await Promise.race([
        onCreateVaultItem(
          {
            name: name.trim(),
            price: Number(price) || 0,
            quantity: Math.max(1, Number(quantity) || 1),
            minPowerLevel: Number(minPowerLevel) || 0,
            rarity,
            imageUrl:
              itemImageUrl ||
              'https://images.unsplash.com/photo-1595590424283-b8f17842773f?w=400&auto=format&fit=crop&q=80',
            hunters: deduplicatedFinalHunters,
            hunterScreenshots
          },
          directPayload
        ),
        new Promise((resolve) => setTimeout(resolve, 3500))
      ]);

      // Save item name to localStorage
      try {
        const stored = localStorage.getItem('l2m_recent_item_names');
        const parsed = stored ? JSON.parse(stored) : [];
        const updated = [
          name.trim(),
          ...(Array.isArray(parsed) ? parsed.filter((n: string) => n.toLowerCase() !== name.trim().toLowerCase()) : [])
        ].slice(0, 40);
        localStorage.setItem('l2m_recent_item_names', JSON.stringify(updated));
      } catch {
        // ignore
      }

      setFormSuccess(
        itemEntryMode === 'direct_distribute'
          ? t.directDistributeSuccess
          : (lang === 'th' ? 'เพิ่มไอเทมสำเร็จ!' : 'Item created!')
      );

      // Reset form
      setName('');
      setPrice('');
      setQuantity(1);
      setMinPowerLevel('');
      setItemImageUrl('');
      setItemImagePreview('');
      setHunters([]);
      setHunterScreenshots([]);
      setOcrStatusText('');
      setDuplicatesRemovedCount(null);
      setDirectRecipient(null);
      setDirectReceiptImages([]);
      setDirectPaymentStatus('pending');
    } catch {
      setFormError(t.error);
    } finally {
      setIsCreating(false);
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

  // Group hunters by Clan (for matching display: VoltZ / Zenkaii, LevelS / DVD)
  const groupedHunters = hunters.reduce((acc, h) => {
    const clanKey = cleanClanName(h.clan) || 'VoltZ';
    if (!acc[clanKey]) acc[clanKey] = [];
    acc[clanKey].push(h.name);
    return acc;
  }, {} as Record<string, string[]>);

  // List of unique clans present in scanned hunters
  const uniqueClansInHunters = useMemo(() => {
    const clanSet = new Set<string>();
    hunters.forEach((h) => {
      const c = cleanClanName(h.clan);
      if (c) clanSet.add(c);
    });
    return Array.from(clanSet);
  }, [hunters]);

  const distributedItems = useMemo(() => {
    return vaultItems
      .filter((i) => isItemDistributed(i))
      .sort((a, b) => {
        const timeA = Number(a.distributedTo?.distributedAt || a.updatedAt || a.createdAt || 0);
        const timeB = Number(b.distributedTo?.distributedAt || b.updatedAt || b.createdAt || 0);
        return timeB - timeA;
      });
  }, [vaultItems]);

  const incompleteDistributedItems = useMemo(() => {
    return distributedItems.filter(isDistributedItemPaymentPending);
  }, [distributedItems]);

  const completeDistributedItems = useMemo(() => {
    return distributedItems.filter((i) => !isDistributedItemPaymentPending(i));
  }, [distributedItems]);

  const displayedDistributedItems = useMemo(() => {
    if (distFilterStatus === 'incomplete') return incompleteDistributedItems;
    if (distFilterStatus === 'complete') return completeDistributedItems;
    return distributedItems;
  }, [distFilterStatus, incompleteDistributedItems, completeDistributedItems, distributedItems]);

  const renderDistributedCard = (item: VaultItem, forcePending?: boolean) => {
    const isPending = forcePending !== undefined ? forcePending : isDistributedItemPaymentPending(item);
    return (
      <div
        key={item.id}
        className={`p-3 rounded-xl border transition-all ${
          isPending
            ? 'bg-[#15111c] border-amber-500/40 hover:border-amber-400/70 shadow-md'
            : 'bg-[#0b1424] border-slate-800 hover:border-emerald-500/40 shadow-md'
        }`}
      >
        {/* Top Row: Thumbnail + Item info + Price */}
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onViewImageZoom(item.imageUrl, item.name);
            }}
            className="w-14 h-14 rounded-xl overflow-hidden border border-slate-700 hover:border-sky-400 bg-slate-900 shrink-0 cursor-pointer relative group/thumb shadow"
            title={t.zoomImage}
          >
            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
              <ZoomIn className="w-4 h-4 text-white drop-shadow" />
            </div>
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase ${getRarityBadge(item.rarity)}`}>
                {item.rarity}
              </span>
              {item.quantity && item.quantity > 1 && (
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-500/40">
                  x{item.quantity}
                </span>
              )}
              <span className="text-[10px] text-slate-400 font-mono ml-auto">
                {item.distributedTo?.distributedAt ? new Date(item.distributedTo.distributedAt).toLocaleDateString() : '-'}
              </span>
            </div>

            <h4 className={`text-xs sm:text-sm font-bold truncate mt-0.5 text-slate-100 ${getRarityTextGlow(item.rarity)}`}>
              {item.name}
            </h4>

            {/* Recipient + Clan */}
            <div className="flex items-center gap-1 text-[11px] text-slate-300 mt-0.5 truncate">
              <span className="text-slate-400">{lang === 'th' ? 'ผู้รับ:' : 'To:'}</span>
              <strong className="text-amber-300 font-bold truncate">
                {item.distributedTo?.name || 'Unknown'}
              </strong>
              <span className="text-[10px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700/60 shrink-0">
                {cleanClanName(item.distributedTo?.clan) || 'No Clan'}
              </span>
            </div>
          </div>

          {/* Price badge */}
          <div className="shrink-0 text-right">
            {item.price > 0 ? (
              <span className="text-xs sm:text-sm font-mono font-bold text-white drop-shadow block">
                💎 {item.price.toLocaleString()}
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/70 text-emerald-300 border border-emerald-500/40 font-bold">
                🎁 {lang === 'th' ? 'ฟรี' : 'Free'}
              </span>
            )}
          </div>
        </div>

        {/* Middle Row: Proof screenshots & Receipts */}
        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
          {/* Proof thumbnails / buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {item.hunterScreenshots && item.hunterScreenshots.length > 0 ? (
              <div className="flex items-center gap-1">
                {item.hunterScreenshots.slice(0, 3).map((shot, sIdx) => (
                  <div key={sIdx} className="relative group/hshot shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        sounds.playClick();
                        onViewImageZoom(shot, `${item.name} - Hunter Proof #${sIdx + 1}`, item.hunterScreenshots, sIdx);
                      }}
                      className="w-7 h-7 rounded-lg overflow-hidden border border-slate-700 hover:border-sky-400 bg-slate-900 shrink-0 shadow-sm cursor-pointer block"
                    >
                      <img src={shot} alt="Proof" className="w-full h-full object-cover" />
                    </button>
                    {isAdminOrOwner && (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (window.confirm(t.deleteHunterProofConfirm || (lang === 'th' ? 'ต้องการลบรูปผู้ล่านี้ใช่หรือไม่?' : 'Delete this hunter proof?'))) {
                            sounds.playClick();
                            const updatedHunters = (item.hunterScreenshots || []).filter((_, i) => i !== sIdx);
                            await updateVaultItemDoc(item.id, { hunterScreenshots: updatedHunters });
                          }
                        }}
                        className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow text-[8px] opacity-0 group-hover/hshot:opacity-100 transition-opacity cursor-pointer z-10"
                        title={lang === 'th' ? 'ลบรูปผู้ล่านี้' : 'Delete hunter proof'}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {item.hunterScreenshots.length > 3 && (
                  <span className="text-[9px] font-mono text-sky-400">+{item.hunterScreenshots.length - 3}</span>
                )}
              </div>
            ) : null}

            {item.hunters && item.hunters.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setViewingDistributedHuntersItem(item);
                  setDistHuntersViewMode('cards');
                  setDistHuntersTextFormat('by-clan');
                  setDistHuntersClanFilter('all');
                }}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[10px] font-semibold cursor-pointer"
              >
                <Users className="w-2.5 h-2.5 text-amber-400" />
                <span>{item.hunters.length} {lang === 'th' ? 'ผู้ล่า' : 'hunters'}</span>
              </button>
            )}

            {/* Attach Hunter Proof for Admin/Owner */}
            {isAdminOrOwner && (
              <label
                htmlFor={`card-file-hunter-${item.id}`}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-sky-950/40 hover:bg-sky-900/60 border border-sky-600/30 text-sky-300 text-[10px] font-medium cursor-pointer"
                title={t.attachHunterProof || (lang === 'th' ? 'แนบรูปรายชื่อผู้ล่า' : 'Attach Hunter Proof')}
              >
                <Upload className="w-2.5 h-2.5 text-sky-400" />
                <span>+{t.attachHunterProof || (lang === 'th' ? 'รูปผู้ล่า' : 'Hunter Proof')}</span>
                <input
                  id={`card-file-hunter-${item.id}`}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (!files || files.length === 0) return;
                    try {
                      sounds.playClick();
                      const compressedList = await Promise.all(
                        (Array.from(files) as File[]).map((f) => compressImageFile(f, { maxWidth: 1600, maxHeight: 1600, quality: 0.8 }))
                      );
                      const existing = item.hunterScreenshots || [];
                      await updateVaultItemDoc(item.id, { hunterScreenshots: [...existing, ...compressedList] });
                      sounds.playSuccess();
                    } catch (err) {
                      console.error('Error uploading hunter proof:', err);
                    } finally {
                      e.target.value = '';
                    }
                  }}
                  className="hidden"
                />
              </label>
            )}

            {/* Receipts */}
            {item.receiptImages && item.receiptImages.length > 0 && (
              <div className="flex items-center gap-1">
                {item.receiptImages.slice(0, 2).map((rImg, rIdx) => (
                  <div key={rIdx} className="relative group/rshot shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        sounds.playClick();
                        onViewImageZoom(rImg, `${item.name} - Receipt #${rIdx + 1}`, item.receiptImages, rIdx);
                      }}
                      className="w-7 h-7 rounded-lg overflow-hidden border border-emerald-500/40 hover:border-emerald-400 bg-slate-900 shrink-0 shadow-sm cursor-pointer block"
                    >
                      <img src={rImg} alt="Receipt" className="w-full h-full object-cover" />
                    </button>
                    {isAdminOrOwner && (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (window.confirm(t.deleteReceiptConfirm)) {
                            sounds.playClick();
                            const updatedReceipts = (item.receiptImages || []).filter((_, i) => i !== rIdx);
                            await updateVaultItemDoc(item.id, { receiptImages: updatedReceipts });
                          }
                        }}
                        className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow text-[8px] opacity-0 group-hover/rshot:opacity-100 transition-opacity cursor-pointer z-10"
                        title={lang === 'th' ? 'ลบรูปบิลนี้' : 'Delete receipt'}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Attach Receipt for Admin (Only if item has price > 0) */}
            {isAdminOrOwner && item.price > 0 && (
              <label
                htmlFor={`card-file-receipt-${item.id}`}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-600/30 text-emerald-300 text-[10px] font-medium cursor-pointer"
                title={t.attachReceipt}
              >
                <Upload className="w-2.5 h-2.5 text-emerald-400" />
                <span>+{t.attachReceipt}</span>
                <input
                  id={`card-file-receipt-${item.id}`}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (!files || files.length === 0) return;
                    try {
                      sounds.playClick();
                      const compressedList = await Promise.all(
                        (Array.from(files) as File[]).map((f) => compressImageFile(f, { maxWidth: 1600, maxHeight: 1600, quality: 0.8 }))
                      );
                      const existing = item.receiptImages || [];
                      await updateVaultItemDoc(item.id, { receiptImages: [...existing, ...compressedList] });
                      sounds.playClaim();
                    } catch (err) {
                      console.error('Error uploading receipts:', err);
                    } finally {
                      e.target.value = '';
                    }
                  }}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Action Button: Confirm Paid / Paid Status / Revert */}
          <div className="flex items-center gap-1.5 ml-auto">
            {isPending ? (
              onConfirmPayment && (
                <button
                  type="button"
                  id={`btn-card-confirm-pay-${item.id}`}
                  onClick={() => {
                    sounds.playClick();
                    onConfirmPayment(item, 'paid');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md cursor-pointer transition-all hover:scale-105 active:scale-95 border border-emerald-400/40 flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{t.confirmPayment || (lang === 'th' ? 'ยืนยันการชำระ' : 'Confirm Payment')}</span>
                </button>
              )
            ) : item.price > 0 ? (
              <button
                type="button"
                onClick={() => {
                  if (!onConfirmPayment) return;
                  sounds.playClick();
                  if (window.confirm(lang === 'th' ? `ต้องการเปลี่ยนสถานะ "${item.name}" กลับเป็นรอชำระใช่หรือไม่?` : `Revert "${item.name}" status to pending payment?`)) {
                    onConfirmPayment(item, 'pending');
                  }
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-pointer hover:bg-emerald-500/30 transition-all"
                title={lang === 'th' ? 'ชำระแล้ว - คลิกเพื่อเปลี่ยนกลับเป็นรอชำระ' : 'Paid - Click to revert to pending'}
              >
                <CheckCircle className="w-3 h-3 text-emerald-400" />
                <span>{t.paymentStatusPaid || (lang === 'th' ? 'ชำระแล้ว' : 'Paid')}</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/70 border border-emerald-500/40 text-emerald-300">
                🎁 {t.itemFree || (lang === 'th' ? 'ฟรี' : 'Free')}
              </span>
            )}

            {/* Admin Edit */}
            {isAdminOrOwner && onEditItem && (
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  onEditItem(item);
                }}
                className="p-1 rounded-lg bg-amber-950/40 hover:bg-amber-900/60 text-amber-400 border border-amber-800/40 transition cursor-pointer"
                title={t.editItem}
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Admin Delete */}
            {isAdminOrOwner && (
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setItemToDelete(item);
                }}
                className="p-1 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/40 transition cursor-pointer"
                title={t.deleteDistributedItem}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Header & Quick Items Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-[#fff2b8] via-[#e6be44] to-[#c99a22]">
            {t.itemsTitle}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            {lang === 'th'
              ? 'คลังไอเทมบอส ควิกไอเทม และประวัติแจก'
              : 'Boss hunt inventory, quick item presets, and distributed archive'}
          </p>
        </div>

        {/* Action Buttons: Owner Reset & Quick Items */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {currentUser?.role === 'owner' && onOpenOwnerResetModal && (
            <button
              id="btn-open-owner-reset"
              onClick={() => {
                sounds.playClick();
                onOpenOwnerResetModal();
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-red-950/90 via-red-900/70 to-[#1b151f] border border-red-500/60 hover:border-red-400 text-red-200 hover:text-white transition-all shadow-md group cursor-pointer"
              title={t.ownerResetDesc}
            >
              <RotateCcw className="w-4 h-4 text-red-400 group-hover:-rotate-90 transition-transform" />
              <span className="text-xs font-bold text-red-200">{t.ownerResetBtn}</span>
            </button>
          )}

          {/* Quick Items Menu Button */}
          <button
            id="btn-open-quick-menu"
            onClick={() => {
              sounds.playClick();
              onOpenQuickItemsModal();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#1b2538] to-[#121926] border border-[#d4af37]/40 hover:border-[#d4af37] text-slate-100 hover:text-white transition-all shadow-md group cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[#f5d77f] group-hover:rotate-12 transition-transform" />
            <span className="text-xs font-bold text-[#f5d77f]">{t.quickItemsMenu}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
              {quickItems.length}
            </span>
          </button>
        </div>
      </div>

      {/* Fast workflow overview */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button type="button" onClick={() => setVaultSubTab('active')} className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/45 to-slate-950 p-4 text-left transition hover:border-emerald-400/60 cursor-pointer">
          <div className="text-xs font-bold text-emerald-300">{lang === 'th' ? 'พร้อมแจก' : 'Available'}</div>
          <div className="mt-1 text-2xl font-black text-white">{vaultItems.filter((item) => item.status === 'available' && !isItemDistributed(item)).length}</div>
          <div className="mt-1 text-[11px] text-slate-400">{lang === 'th' ? 'ดูรายการและจัดการไอเทมปัจจุบัน' : 'View and manage active items'}</div>
        </button>
        <button type="button" onClick={() => setVaultSubTab('create')} className="rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-cyan-950/45 to-slate-950 p-4 text-left transition hover:border-cyan-400/60 cursor-pointer">
          <div className="text-xs font-bold text-cyan-300">{lang === 'th' ? 'ควิกไอเทม' : 'Quick presets'}</div>
          <div className="mt-1 text-2xl font-black text-white">{quickItems.length}</div>
          <div className="mt-1 text-[11px] text-slate-400">{lang === 'th' ? 'เลือกเพื่อกรอกข้อมูลไอเทมอย่างรวดเร็ว' : 'Fill item details instantly'}</div>
        </button>
        <button type="button" onClick={() => setVaultSubTab('distributed')} className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-950/45 to-slate-950 p-4 text-left transition hover:border-violet-400/60 cursor-pointer">
          <div className="text-xs font-bold text-violet-300">{lang === 'th' ? 'แจกแล้ว' : 'Distributed'}</div>
          <div className="mt-1 text-2xl font-black text-white">{distributedItems.length}</div>
          <div className="mt-1 text-[11px] text-slate-400">{lang === 'th' ? 'ดูประวัติ ผู้รับ และหลักฐานย้อนหลัง' : 'Review recipients and evidence'}</div>
        </button>
      </div>

      {/* Sub-Tabs: Add/Active Item Form VS Active Items VS Distributed Archive */}
      <div className="sticky top-[108px] lg:top-[56px] z-20 flex w-fit items-center gap-2 rounded-xl border border-slate-700/80 bg-[#0b0e17]/95 p-1 shadow-xl backdrop-blur">
        <button
          onClick={() => {
            sounds.playClick();
            setVaultSubTab('create');
          }}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            vaultSubTab === 'create'
              ? 'bg-[#1b263b] text-[#f5d77f] border border-[#d4af37]/50 shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t.addNewItem}</span>
        </button>
        <button
          onClick={() => {
            sounds.playClick();
            setVaultSubTab('active');
          }}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            vaultSubTab === 'active'
              ? 'bg-[#1b263b] text-[#f5d77f] border border-[#d4af37]/50 shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{lang === 'th' ? 'ไอเทมในคลัง' : 'Vault Items'}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono">
            {vaultItems.filter((item) => item.status === 'available' && !isItemDistributed(item)).length}
          </span>
        </button>
        <button
          onClick={() => {
            sounds.playClick();
            setVaultSubTab('distributed');
          }}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            vaultSubTab === 'distributed'
              ? 'bg-[#1b263b] text-[#f5d77f] border border-[#d4af37]/50 shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{t.distributedItemsSection}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono">
            {distributedItems.length}
          </span>
        </button>
      </div>

      {/* VIEW 1: CREATE / ADD ITEM FORM (Zero-Scroll Cockpit Dashboard) */}
      {vaultSubTab === 'create' && (
        <div className="space-y-3">
          {/* 1. TOP HEADER & ACTIONS ROW */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 rounded-xl bg-gradient-to-r from-[#0d1525] via-[#0b101c] to-[#080d17] border border-[#d4af37]/30 shadow-md">
            {/* Left: Mode Switcher */}
            <div className="flex items-center bg-[#060a12] p-0.5 rounded-lg border border-slate-800 text-xs shrink-0">
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setItemEntryMode('normal');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                  itemEntryMode === 'normal'
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 shadow font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{t.modeNormalVault}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setItemEntryMode('direct_distribute');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                  itemEntryMode === 'direct_distribute'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 shadow font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Gift className="w-3.5 h-3.5" />
                <span>{t.modeDirectDistribute}</span>
              </button>
            </div>

            {/* Right: Quick Presets & Form Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Quick Presets Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowQuickItemsDropdown((prev) => !prev)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#11192a] hover:bg-[#18233a] border border-[#d4af37]/40 text-[#f5d77f] text-xs font-semibold transition cursor-pointer shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#f5d77f]" />
                  <span>{t.selectFromQuickItem}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 font-mono text-amber-300">
                    {quickItems.length}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-0.5">▾</span>
                </button>

                {/* Quick Presets Floating Menu */}
                {showQuickItemsDropdown && (
                  <div className="absolute right-0 top-full mt-1.5 w-72 max-h-80 overflow-y-auto rounded-xl bg-slate-900 border border-[#d4af37]/40 shadow-2xl p-2 z-40 space-y-1 custom-scrollbar">
                    <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-slate-800 text-[11px] text-slate-400 font-semibold px-1">
                      <span>{t.selectFromQuickItem}</span>
                      {isAdminOrOwner && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowQuickItemsDropdown(false);
                            onOpenQuickItemsModal();
                          }}
                          className="text-[#f5d77f] hover:underline"
                        >
                          {t.manageQuickItems}
                        </button>
                      )}
                    </div>

                    {quickItems.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-500">
                        {lang === 'th' ? 'ยังไม่มีควิกไอเทม' : 'No quick items yet.'}
                      </div>
                    ) : (
                      quickItems.map((qi) => (
                        <button
                          key={qi.id}
                          type="button"
                          onClick={() => {
                            handleApplyQuickItem(qi);
                            setShowQuickItemsDropdown(false);
                          }}
                          className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-800 text-left transition cursor-pointer group"
                        >
                          {qi.imageUrl ? (
                            <img src={qi.imageUrl} alt={qi.name} className="w-8 h-8 rounded object-cover border border-slate-700" />
                          ) : (
                            <span className="w-8 h-8 rounded bg-slate-800 border border-slate-700 flex items-center justify-center">
                              <Sparkles className="w-4 h-4 text-[#f5d77f]" />
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">
                              {qi.name}
                            </div>
                            <span className={`text-[9px] px-1 py-0.2 rounded font-mono border ${getRarityBadge(qi.rarity)}`}>
                              {qi.rarity}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Manage Presets direct button for Admin/Owner */}
              {isAdminOrOwner && (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    onOpenQuickItemsModal();
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0e1627] hover:bg-[#162138] border border-slate-700 hover:border-[#d4af37]/60 text-slate-300 hover:text-[#f5d77f] text-xs font-semibold transition cursor-pointer"
                  title={t.manageQuickItems}
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#f5d77f]" />
                  <span className="hidden sm:inline">{t.manageQuickItems}</span>
                </button>
              )}

              {/* Reset form button */}
              <button
                type="button"
                onClick={handleResetCreateForm}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-slate-200 text-xs font-medium transition cursor-pointer"
                title={lang === 'th' ? 'ล้างข้อมูลในฟอร์ม' : 'Reset Form'}
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">{lang === 'th' ? 'ล้างฟอร์ม' : 'Reset'}</span>
              </button>
            </div>
          </div>

          {/* Form Feedback Alerts (compact) */}
          {formError && (
            <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{formError}</span>
            </div>
          )}
          {formSuccess && (
            <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-700 text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{formSuccess}</span>
            </div>
          )}

          {/* MAIN COCKPIT FORM */}
          <form onSubmit={handleCreateItemSubmit} className="space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
              
              {/* LEFT COLUMN: ITEM INFO & DIRECT DISTRIBUTE SETTINGS (5 Cols) */}
              <div className="lg:col-span-5 space-y-3">
                
                {/* Card: Basic Item Info */}
                <div className="p-3.5 rounded-xl bg-gradient-to-b from-[#131b2c] via-[#0d1320] to-[#080c14] border border-[#d4af37]/30 shadow-lg space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#f5d77f]" />
                      <span>{lang === 'th' ? 'ข้อมูลไอเทม' : 'Item Info'}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">* {lang === 'th' ? 'จำเป็น' : 'Required'}</span>
                  </div>

                  {/* Row 1: Image Dropzone (Left) + Name with Autocomplete (Right) */}
                  <div className="flex items-start gap-3">
                    {/* Compact Image Dropzone / Ctrl+V */}
                    <div
                      tabIndex={0}
                      onPaste={handlePasteItemImageZone}
                      className="w-20 h-20 sm:w-22 sm:h-22 rounded-xl bg-[#090d16] border border-dashed border-slate-700 hover:border-[#d4af37] focus:border-[#d4af37] transition-all relative group flex flex-col items-center justify-center shrink-0 cursor-pointer outline-none overflow-hidden"
                      title={lang === 'th' ? 'คลิกเลือกไฟล์ หรือกด Ctrl + V เพื่อวางรูป' : 'Click to choose or Ctrl + V to paste'}
                    >
                      {itemImagePreview ? (
                        <div className="relative w-full h-full">
                          <img src={itemImagePreview} alt="preview" className="w-full h-full object-contain p-1" />
                          <label
                            htmlFor="file-item-image-replace"
                            className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-[10px] font-bold text-white transition-opacity cursor-pointer text-center p-1"
                          >
                            <Camera className="w-4 h-4 mb-0.5 text-amber-300" />
                            <span>{lang === 'th' ? 'เปลี่ยนรูป' : 'Change'}</span>
                            <span className="text-[8px] text-amber-300 font-mono">Ctrl+V</span>
                          </label>
                        </div>
                      ) : (
                        <label
                          htmlFor="file-item-image"
                          className="w-full h-full flex flex-col items-center justify-center cursor-pointer text-center p-1"
                        >
                          <Upload className="w-5 h-5 text-[#d4af37] mb-1 group-hover:scale-110 transition-transform" />
                          <span className="text-[10px] font-semibold text-slate-300 leading-tight">
                            {lang === 'th' ? 'ใส่รูป' : 'Image'}
                          </span>
                          <span className="text-[8px] text-amber-300 font-mono mt-0.5">Ctrl+V</span>
                        </label>
                      )}
                      <input id="file-item-image" type="file" accept="image/*" onChange={handleItemImageUpload} className="hidden" />
                      <input id="file-item-image-replace" type="file" accept="image/*" onChange={handleItemImageUpload} className="hidden" />
                    </div>

                    {/* Item Name Input with Autocomplete */}
                    <div className="flex-1 min-w-0 space-y-1 relative">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-300">
                          {t.itemName} *
                        </label>
                        {name && (
                          <button
                            type="button"
                            onClick={() => setName('')}
                            className="text-[10px] text-slate-500 hover:text-slate-300"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <input
                        id="input-vault-name"
                        type="text"
                        required
                        placeholder="e.g. Imperial Crusader Armor"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          setShowNameSuggestions(true);
                        }}
                        onFocus={() => setShowNameSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowNameSuggestions(false), 200)}
                        className="w-full px-3 py-2 rounded-lg bg-[#090d16] border border-slate-700 focus:border-[#d4af37] text-slate-100 text-xs sm:text-sm font-semibold focus:outline-none"
                      />

                      {/* Autocomplete Suggestions Dropdown */}
                      {showNameSuggestions && filteredNameSuggestions.length > 0 && (
                        <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-slate-900 border border-[#d4af37]/40 rounded-xl shadow-2xl p-1 max-h-40 overflow-y-auto space-y-0.5 custom-scrollbar">
                          {filteredNameSuggestions.map((suggestionName, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setName(suggestionName);
                                setShowNameSuggestions(false);
                                sounds.playClick();
                              }}
                              className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-slate-200 hover:text-white hover:bg-[#1f2b42] flex items-center justify-between transition cursor-pointer"
                            >
                              <span className="font-semibold truncate">{suggestionName}</span>
                              <span className="text-[9px] text-[#f5d77f] font-mono shrink-0 ml-1">↵</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Small indicator when item image is attached */}
                      {itemImagePreview && (
                        <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium pt-0.5">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{lang === 'th' ? 'มีรูปภาพไอเทมแล้ว' : 'Image ready'}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 2: 4-Field Grid (2x2) */}
                  <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-slate-800/80">
                    {/* Price */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-semibold text-slate-300">
                          {t.itemPrice} *
                        </label>
                        {price === 0 && (
                          <span className="text-[9px] text-emerald-400 font-bold">🎁 {t.itemFree || (lang === 'th' ? 'ฟรี' : 'Free')}</span>
                        )}
                      </div>
                      <div className="relative">
                        <Gem className="w-3.5 h-3.5 text-white absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          id="input-vault-price"
                          type="number"
                          min="0"
                          required
                          placeholder="0 = ฟรี"
                          value={price}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPrice(val === '' ? '' : Math.max(0, Number(val)));
                          }}
                          className="w-full pl-8 pr-2 py-1.5 rounded-lg bg-[#090d16] border border-slate-700 focus:border-[#d4af37] text-slate-100 text-xs font-mono focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Quantity */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        {t.itemQuantity} *
                      </label>
                      <div className="relative">
                        <Layers className="w-3.5 h-3.5 text-emerald-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          id="input-vault-quantity"
                          type="number"
                          min="1"
                          required
                          value={quantity}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const val = e.target.value;
                            setQuantity(val === '' ? '' : Math.max(1, parseInt(val, 10) || 1));
                          }}
                          className="w-full pl-8 pr-2 py-1.5 rounded-lg bg-[#090d16] border border-slate-700 focus:border-[#d4af37] text-slate-100 text-xs font-mono focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Min Power Level */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        {t.itemMinPower} *
                      </label>
                      <div className="relative">
                        <Zap className="w-3.5 h-3.5 text-amber-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          id="input-vault-minpower"
                          type="number"
                          min="0"
                          required
                          placeholder="0"
                          value={minPowerLevel}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const val = e.target.value;
                            setMinPowerLevel(val === '' ? '' : Math.max(0, Number(val)));
                          }}
                          className="w-full pl-8 pr-2 py-1.5 rounded-lg bg-[#090d16] border border-slate-700 focus:border-[#d4af37] text-slate-100 text-xs font-mono focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Rarity */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        {t.itemRarity} *
                      </label>
                      <select
                        id="select-vault-rarity"
                        value={rarity}
                        onChange={(e) => setRarity(e.target.value as ItemRarity)}
                        className={`w-full px-2.5 py-1.5 rounded-lg bg-[#090d16] border text-slate-100 text-xs font-semibold focus:outline-none cursor-pointer ${
                          rarity === 'MYTHIC'
                            ? 'border-amber-500/80 text-amber-300'
                            : rarity === 'LAGEND'
                            ? 'border-purple-500/80 text-purple-300'
                            : rarity === 'EPIC'
                            ? 'border-red-500/80 text-red-300'
                            : 'border-cyan-500/80 text-cyan-300'
                        }`}
                      >
                        <option value="RARE">🟦 {t.rarityRare}</option>
                        <option value="EPIC">🟥 {t.rarityEpic}</option>
                        <option value="LAGEND">🟪 {t.rarityLegend}</option>
                        <option value="MYTHIC">🟨 {t.rarityMythic}</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Card: Direct Distribution Settings (when active) OR Mode Info Note */}
                {itemEntryMode === 'direct_distribute' ? (
                  <div className="p-3.5 rounded-xl bg-gradient-to-b from-[#0a141e] to-[#070b14] border border-emerald-500/40 shadow-lg space-y-2.5">
                    <div className="flex items-center justify-between pb-1.5 border-b border-emerald-500/20">
                      <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                        <Gift className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{lang === 'th' ? 'การแจกไอเทมโดยตรง' : 'Direct Distribution'}</span>
                      </span>
                      <span className="text-[9px] px-2 py-0.2 rounded-full bg-emerald-950 border border-emerald-600/40 text-emerald-300 font-mono">
                        {lang === 'th' ? 'แจกทันที' : 'Instant'}
                      </span>
                    </div>

                    {/* Recipient Dropdown */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-200 mb-1 flex items-center justify-between">
                        <span>{t.selectRecipient} *</span>
                        {directRecipient && (
                          <span className="text-[10px] text-emerald-400 font-mono font-bold">
                            ✓ {directRecipient.inGameName} ({directRecipient.clan})
                          </span>
                        )}
                      </label>
                      <select
                        id="select-direct-recipient"
                        value={directRecipient?.id || ''}
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          const found = allMembers.find((m) => m.id === selectedId) || null;
                          setDirectRecipient(found);
                          sounds.playClick();
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#090d16] border border-emerald-500/50 focus:border-emerald-400 text-slate-100 text-xs focus:outline-none cursor-pointer"
                      >
                        <option value="">{t.selectRecipientPlaceholder}</option>
                        {(Object.entries(activeMembersByClan) as [string, User[]][]).map(([clanName, cMembers]) => (
                          <optgroup key={clanName} label={`🏰 ${clanName} (${cMembers.length})`}>
                            {cMembers.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.inGameName} {m.characterClass ? `• ${m.characterClass}` : ''} {m.powerLevel ? `• PL ${m.powerLevel.toLocaleString()}` : ''}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>

                    {/* Payment Status & Receipts: Free notice when price is 0, or payment controls when price > 0 */}
                    {(price === '' || Number(price) === 0) ? (
                      <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300">
                        <Gift className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>
                          {lang === 'th'
                            ? '🎁 ไอเทมแจกฟรี ไม่ต้องแนบรูปบิล และไม่ต้องยืนยันชำระ (บันทึกเป็นแจกฟรีทันที)'
                            : '🎁 Free item: No bill attachment and no payment confirmation needed.'}
                        </span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-emerald-500/20">
                        {/* Payment toggle */}
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-300 mb-1">
                            {t.paymentStatusChoice}
                          </label>
                          <div className="grid grid-cols-2 gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                sounds.playClick();
                                setDirectPaymentStatus('pending');
                              }}
                              className={`py-1 rounded text-[10px] font-bold transition cursor-pointer flex items-center justify-center gap-1 ${
                                directPaymentStatus === 'pending'
                                  ? 'bg-amber-950/80 border border-amber-500 text-amber-300'
                                  : 'bg-[#090d16] border border-slate-800 text-slate-400'
                              }`}
                            >
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span>{t.paymentStatusPending}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                sounds.playClick();
                                setDirectPaymentStatus('paid');
                              }}
                              className={`py-1 rounded text-[10px] font-bold transition cursor-pointer flex items-center justify-center gap-1 ${
                                directPaymentStatus === 'paid'
                                  ? 'bg-emerald-950/80 border border-emerald-500 text-emerald-300'
                                  : 'bg-[#090d16] border border-slate-800 text-slate-400'
                              }`}
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>{t.paymentStatusPaid}</span>
                            </button>
                          </div>
                        </div>

                        {/* Receipt slip attach */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-semibold text-slate-300">
                              {t.attachReceiptBills}
                            </label>
                            {directReceiptImages.length > 0 && (
                              <span className="text-[9px] text-teal-400 font-mono">{directReceiptImages.length} {lang === 'th' ? 'รูป' : 'files'}</span>
                            )}
                          </div>
                          <label
                            tabIndex={0}
                            onPaste={handlePasteDirectReceiptZone}
                            htmlFor="file-direct-receipts"
                            className="w-full py-1 px-2 rounded bg-teal-950/40 hover:bg-teal-900/60 border border-dashed border-teal-500/50 text-[10px] font-medium text-teal-200 cursor-pointer transition flex items-center justify-center gap-1.5 outline-none"
                            title={lang === 'th' ? 'คลิกเลือกไฟล์ หรือกด Ctrl + V เพื่อวางรูปบิล' : 'Click to choose or Ctrl + V to paste bill'}
                          >
                            <Upload className="w-3 h-3 text-teal-300" />
                            <span>{lang === 'th' ? 'แนบบิล (Ctrl+V)' : 'Upload Bill'}</span>
                            <input id="file-direct-receipts" type="file" accept="image/*" multiple onChange={handleDirectReceiptUpload} className="hidden" />
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Receipt Slips Thumbnails Preview */}
                    {directReceiptImages.length > 0 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto p-1.5 rounded-lg bg-[#060a12] border border-teal-900/40 no-scrollbar">
                        {directReceiptImages.map((receiptImg, idx) => (
                          <div key={idx} className="relative group shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-teal-700/50">
                            <img src={receiptImg} alt={`Receipt ${idx + 1}`} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity">
                              <button
                                type="button"
                                onClick={() => onViewImageZoom(receiptImg, `Receipt #${idx + 1}`, directReceiptImages, idx)}
                                className="p-0.5 rounded bg-slate-800 text-white"
                              >
                                <ZoomIn className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveDirectReceipt(idx)}
                                className="p-0.5 rounded bg-red-900 text-white"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-[#090d16]/80 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                    <div className="text-slate-300 font-semibold flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                      <span>{lang === 'th' ? 'โหมดคลังไอเทมปกติ (Normal Vault Mode)' : 'Normal Vault Mode'}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      {lang === 'th'
                        ? 'ไอเทมที่เพิ่มจะถูกนำเข้าสู่คลังหลัก เพื่อให้สมาชิกในแคลนที่มีสิทธิ์และคะแนน PL ถึงเกณฑ์สามารถกดเคลมได้'
                        : 'Items will be added to the active vault for eligible members to claim.'}
                    </p>
                  </div>
                )}

              </div>

              {/* RIGHT COLUMN: HUNTERS & EVIDENCE PROOFS (7 Cols) */}
              <div className="lg:col-span-7 space-y-3">
                
                {/* Card: Hunters Cockpit */}
                <div className="p-3.5 rounded-xl bg-gradient-to-b from-[#131b2c] via-[#0d1320] to-[#080c14] border border-[#d4af37]/30 shadow-lg space-y-2.5">
                  
                  {/* Action Bar: AI OCR & Gemini Key */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      {/* AI OCR Button */}
                      <label
                        tabIndex={0}
                        onPaste={handlePasteOcrZone}
                        htmlFor="file-ocr-upload"
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold transition shrink-0 shadow-sm border outline-none ${
                          canUseOcr
                            ? 'bg-sky-600 hover:bg-sky-500 cursor-pointer border-sky-400/50'
                            : 'bg-slate-700 cursor-not-allowed border-slate-600 opacity-60'
                        }`}
                        title={lang === 'th' ? 'คลิกเลือกไฟล์ หรือกด Ctrl + V เพื่อสแกนภาพ' : 'Click to choose or Ctrl + V to paste & scan'}
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>{isScanningOCR ? t.uploadingAndScanning : lang === 'th' ? 'สแกน AI OCR' : 'Scan OCR'}</span>
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-sky-950 text-sky-200 border border-sky-500/60">
                          Ctrl+V
                        </span>
                        <input
                          id="file-ocr-upload"
                          type="file"
                          accept="image/*"
                          multiple
                          disabled={isScanningOCR || !canUseOcr}
                          onChange={handleOcrScreenshotUpload}
                          className="hidden"
                        />
                      </label>

                      {/* Gemini Status / Config Button */}
                      {isOwner ? (
                        <button
                          type="button"
                          onClick={() => {
                            sounds.playClick();
                            setShowGeminiModal(true);
                          }}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
                            geminiConfigured
                              ? 'bg-emerald-950/40 border-emerald-500/40 hover:border-emerald-400 text-emerald-300'
                              : 'bg-amber-950/40 border-amber-500/50 hover:border-amber-400 text-amber-300 animate-pulse'
                          }`}
                          title={lang === 'th' ? 'ตั้งค่า Gemini API Key' : 'Configure Gemini API Key'}
                        >
                          <Cpu className="w-3 h-3 text-[#38bdf8]" />
                          <span>{geminiConfigured ? (lang === 'th' ? 'Key: ต่อแล้ว' : 'Key: Connected') : '⚠️ Set Key'}</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-800 bg-[#090d16] text-[10px] text-slate-400 font-mono">
                          <Cpu className="w-3 h-3 text-sky-400" />
                          <span>{geminiConfigured ? 'AI Ready' : 'AI Offline'}</span>
                        </div>
                      )}
                    </div>

                    {/* Status or Duplicate badge */}
                    <div className="flex items-center gap-1.5 text-xs">
                      {isScanningOCR && (
                        <span className="text-sky-300 animate-pulse text-[11px] flex items-center gap-1">
                          <Sparkles className="w-3 h-3 animate-spin text-sky-400" />
                          <span>{t.uploadingAndScanning}...</span>
                        </span>
                      )}
                      {duplicatesRemovedCount !== null && duplicatesRemovedCount > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                          {lang === 'th' ? `ตัดชื่อซ้ำ ${duplicatesRemovedCount}` : `${duplicatesRemovedCount} dupes`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Dynamic OCR Status Message (if error or message) */}
                  {dynamicOcrStatusMessage && !isScanningOCR && (
                    <div className="p-2 rounded-lg bg-sky-950/30 border border-sky-800/40 text-[11px] text-sky-300 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <Sparkles className="w-3.5 h-3.5 shrink-0 text-sky-400" />
                        <span className="truncate">{dynamicOcrStatusMessage}</span>
                      </div>
                      {isOwner && ocrErrorType && (
                        <button
                          type="button"
                          onClick={() => setShowGeminiModal(true)}
                          className="text-[10px] text-amber-300 underline shrink-0 font-semibold"
                        >
                          {lang === 'th' ? 'ตั้งค่า Key' : 'Config Key'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Screenshot Proofs Strip */}
                  <div className="flex items-center gap-2 overflow-x-auto p-1.5 rounded-lg bg-[#080c16] border border-slate-800 no-scrollbar">
                    {/* Mini dropzone to add screenshot */}
                    <label
                      tabIndex={0}
                      onPaste={handlePasteBackupScreenshotsZone}
                      htmlFor="file-multiple-screenshots"
                      className="w-12 h-12 rounded-lg bg-[#111929] hover:bg-[#18233a] border border-dashed border-slate-700 hover:border-[#d4af37] flex flex-col items-center justify-center cursor-pointer shrink-0 transition text-slate-400 hover:text-[#f5d77f] outline-none"
                      title={lang === 'th' ? 'แนบสกรีนช็อต (Ctrl + V)' : 'Attach screenshot (Ctrl + V)'}
                    >
                      <Upload className="w-4 h-4 mb-0.5" />
                      <span className="text-[8px] font-mono">Ctrl+V</span>
                      <input id="file-multiple-screenshots" type="file" accept="image/*" multiple onChange={handleBackupScreenshotsUpload} className="hidden" />
                    </label>

                    {/* Thumbnails */}
                    {hunterScreenshots.map((shot, idx) => (
                      <div key={idx} className="relative group shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-slate-700">
                        <img src={shot} alt={`Proof ${idx + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity">
                          <button
                            type="button"
                            onClick={() => onViewImageZoom(shot, `Proof #${idx + 1}`, hunterScreenshots, idx)}
                            className="p-0.5 rounded bg-slate-800 text-white"
                          >
                            <ZoomIn className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveScreenshot(idx)}
                            className="p-0.5 rounded bg-red-900 text-white"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Quick Scan from Attached Button */}
                    {hunterScreenshots.length > 0 && (
                      <button
                        type="button"
                        id="btn-scan-attached-screenshots"
                        disabled={isScanningOCR || !canUseOcr}
                        onClick={scanExistingScreenshots}
                        className="px-2.5 py-2 rounded-lg bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 text-white text-[11px] font-bold transition shadow shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title={lang === 'th' ? 'สแกนชื่อคนล่าจากภาพเหล่านี้' : 'Scan hunters from these images'}
                      >
                        <Scan className="w-3.5 h-3.5" />
                        <span>
                          {isScanningOCR
                            ? '...'
                            : lang === 'th'
                            ? `สแกนจากรูปที่แนบ (${hunterScreenshots.length})`
                            : `Scan Attached (${hunterScreenshots.length})`}
                        </span>
                      </button>
                    )}

                    {hunterScreenshots.length === 0 && (
                      <span className="text-[10px] text-slate-500 pl-1 font-mono">
                        {lang === 'th' ? 'แนบรูปหลักฐานผู้ล่า (เลือกไฟล์หรือวาง Ctrl+V)' : 'Attach proof screenshots (drop or Ctrl+V)'}
                      </span>
                    )}
                  </div>

                  {/* Hunters Tags / List Box */}
                  <div className="space-y-1.5">
                    {/* Header with Modal Trigger & Quick Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-200">
                          👥 {t.scanResults} ({hunters.length} {lang === 'th' ? 'คน' : 'hunters'})
                        </span>
                        {uniqueClansInHunters.length > 1 && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-950/60 border border-amber-800/50 text-amber-300 font-mono">
                            {uniqueClansInHunters.length} {t.clansCount}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 flex-wrap">
                        {/* OPEN HUNTER CHECKLIST MODAL BUTTON */}
                        <button
                          type="button"
                          id="btn-open-hunter-checklist-modal"
                          onClick={() => {
                            sounds.playClick();
                            setShowHunterChecklistModal(true);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-gradient-to-r from-amber-500 to-yellow-600 hover:brightness-110 text-slate-950 text-xs font-bold transition shadow cursor-pointer"
                          title={lang === 'th' ? 'เปิดหน้าต่างเลือกสมาชิกแคลน' : 'Open clan member checklist modal'}
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>{lang === 'th' ? '+ เลือกสมาชิก' : '+ Pick Members'}</span>
                        </button>

                        {/* Copy All Hunters */}
                        {hunters.length > 0 && (
                          <button
                            type="button"
                            id="btn-copy-all-hunters"
                            onClick={() => handleCopyAllHunters()}
                            className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-600/70 text-emerald-300 text-[11px] font-semibold transition cursor-pointer"
                            title={lang === 'th' ? 'คัดลอกรายชื่อทั้งหมด' : 'Copy all'}
                          >
                            {copiedHunters ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span>{lang === 'th' ? '✓ แล้ว' : '✓ Copied'}</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-emerald-400" />
                                <span>{lang === 'th' ? 'ก๊อปปี้' : 'Copy'}</span>
                              </>
                            )}
                          </button>
                        )}

                        {/* Filter Duplicates */}
                        {hunters.length > 0 && (
                          <button
                            type="button"
                            id="btn-filter-duplicates"
                            onClick={handleFilterDuplicates}
                            className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-950/60 hover:bg-amber-900 border border-amber-600/60 text-amber-300 text-[11px] font-semibold transition cursor-pointer"
                            title={lang === 'th' ? 'ตรวจหาและลบรายชื่อผู้ล่าที่ซ้ำกัน' : 'Filter duplicates'}
                          >
                            <RotateCcw className="w-3 h-3 text-amber-400" />
                            <span>{lang === 'th' ? 'ลบซ้ำ' : 'Dedupe'}</span>
                          </button>
                        )}

                        {/* Clear All */}
                        {hunters.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearAllHunters}
                            className="p-1 rounded-md bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 transition cursor-pointer"
                            title={t.clearEntireClan}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Scrollable Hunter Chips / Empty State */}
                    <div className="min-h-[90px] max-h-[150px] overflow-y-auto p-2 rounded-xl bg-[#060a12] border border-slate-800/80 custom-scrollbar">
                      {hunters.length === 0 ? (
                        <div className="h-full min-h-[74px] flex flex-col items-center justify-center text-center p-2 text-slate-500 text-xs">
                          <p>{lang === 'th' ? 'ยังไม่มีรายชื่อผู้ล่า' : 'No hunters added yet'}</p>
                          <p className="text-[10px] text-slate-600 mt-0.5">
                            {lang === 'th' ? 'กด "📸 สแกน AI OCR" หรือกด "+ เลือกสมาชิก" เพื่อเลือกจากแคลน' : 'Use AI OCR or click "+ Pick Members" to select'}
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {hunters.map((h, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#0e1628] border border-slate-700/80 hover:border-slate-600 text-xs text-slate-200 shadow-sm"
                            >
                              <span className="text-[9px] font-mono font-bold text-amber-400 px-1 py-0.2 rounded bg-amber-950/60 border border-amber-700/40">
                                {h.clan}
                              </span>
                              <span className="font-semibold text-slate-100">{h.name}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveHunter(idx)}
                                className="text-slate-500 hover:text-red-400 text-sm leading-none pl-0.5 cursor-pointer"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Quick Copy Formats Strip */}
                    {hunters.length > 0 && (
                      <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-800/80 text-[10px]">
                        <span className="text-slate-500 font-mono hidden sm:inline">{lang === 'th' ? 'คัดลอกแบบ:' : 'Copy:'}</span>
                        <div className="flex items-center gap-1 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleCopyAllHunters('by-clan')}
                            className="px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-medium transition cursor-pointer"
                          >
                            {t.formatByClan}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyAllHunters('plain')}
                            className="px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-medium transition cursor-pointer"
                          >
                            {t.formatPlain}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyAllHunters('inline')}
                            className="px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-medium transition cursor-pointer"
                          >
                            {t.formatInline}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyAllHunters('comma')}
                            className="px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-medium transition cursor-pointer"
                          >
                            {t.formatComma}
                          </button>
                        </div>
                      </div>
                    )}

                  </div>

                </div>

              </div>

            </div>

            {/* 3. BOTTOM SUMMARY & SUBMIT BAR (Single compact row) */}
            <div className="p-3 rounded-xl bg-gradient-to-r from-[#0d1525] via-[#0b101c] to-[#080d17] border border-[#d4af37]/35 shadow-lg flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              {/* Live Summary Chips */}
              <div className="flex items-center gap-2 text-xs flex-wrap font-mono">
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-300 font-semibold">
                  💎 {price === 0 || price === '' ? (price === 0 ? (lang === 'th' ? 'ฟรี' : 'Free') : '0') : price} {t.diamonds}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-300 font-semibold">
                  📦 {quantity || 1} {lang === 'th' ? 'ชิ้น' : 'pcs'}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-sky-300 font-semibold">
                  👥 {hunters.length} {lang === 'th' ? 'ผู้ล่า' : 'hunters'}
                </span>
                {itemEntryMode === 'direct_distribute' && directRecipient && (
                  <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-600/40 text-emerald-300 font-semibold">
                    🏆 {directRecipient.inGameName} ({directRecipient.clan})
                  </span>
                )}
              </div>

              {/* Action Button */}
              <button
                id="btn-submit-create-item"
                type="submit"
                disabled={isCreating}
                className={`px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-xl transition cursor-pointer disabled:opacity-50 shrink-0 ${
                  itemEntryMode === 'direct_distribute'
                    ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:brightness-110 text-slate-950 shadow-emerald-950/40'
                    : 'bg-gradient-to-r from-[#d4af37] via-[#e5be49] to-[#aa841c] hover:brightness-110 text-slate-950 shadow-amber-950/40'
                }`}
              >
                {isCreating
                  ? t.loading
                  : itemEntryMode === 'direct_distribute'
                  ? (lang === 'th' ? '🏆 บันทึกแจกไอเทมทันที' : '🏆 Distribute Item Now')
                  : t.addNewItem}
              </button>
            </div>

          </form>
        </div>
      )}

      {/* VIEW 2: ACTIVE VAULT ITEMS SECTION (รายการไอเทมในคลังปัจจุบัน) */}
      {vaultSubTab === 'active' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold font-cinzel text-slate-100">
                {lang === 'th' ? 'รายการไอเทมในคลัง (Active Vault Items)' : 'Active Vault Items'}
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'th'
                  ? 'ไอเทมที่พร้อมแจกหรือเปิดให้สมาชิกเคลม สามารถกดแก้ไขหรือลบได้'
                  : 'Items ready for distribution or claiming. Click Edit or Delete to manage.'}
              </p>
            </div>
            <button
              onClick={() => {
                sounds.playClick();
                setVaultSubTab('create');
              }}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-xs font-bold transition-all shadow flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t.addNewItem}</span>
            </button>
          </div>

          {vaultItems.filter((item) => item.status === 'available' && !isItemDistributed(item)).length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-slate-800 bg-[#0d131f]/70 space-y-3">
              <Layers className="size-10 text-slate-600 mx-auto" />
              <p className="text-sm font-medium text-slate-400">
                {lang === 'th' ? 'ยังไม่มีไอเทมค้างอยู่ในคลัง' : 'No items currently in vault'}
              </p>
              <button
                onClick={() => setVaultSubTab('create')}
                className="px-4 py-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold hover:bg-amber-500/30 transition cursor-pointer"
              >
                + {t.addNewItem}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vaultItems.filter((item) => item.status === 'available' && !isItemDistributed(item)).map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-700/80 bg-gradient-to-b from-[#111827] to-[#0b0f19] p-4 shadow-xl flex flex-col justify-between gap-3 relative group"
                >
                  <div className="flex items-start gap-3">
                    {/* Item Image with Click to Zoom */}
                    <div
                      className="size-14 rounded-xl bg-slate-800/80 border border-slate-700 overflow-hidden shrink-0 cursor-pointer relative group/img flex items-center justify-center"
                      onClick={() => onViewImageZoom(item.imageUrl || '', item.name)}
                    >
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover/img:scale-110 transition duration-300"
                        />
                      ) : (
                        <ImageIcon className="size-6 text-slate-500" />
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition">
                        <ZoomIn className="size-4 text-white" />
                      </div>
                    </div>

                    {/* Item Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border font-mono ${
                          item.rarity === 'MYTHIC'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                            : item.rarity === 'LAGEND' || item.rarity === 'LEGEND'
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
                            : item.rarity === 'EPIC'
                            ? 'bg-red-500/20 text-red-300 border-red-500/50'
                            : 'bg-blue-500/20 text-blue-300 border-blue-500/50'
                        }`}>
                          {item.rarity}
                        </span>
                        {item.quantity && item.quantity > 1 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                            x{item.quantity}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-sm text-slate-100 truncate mt-1" title={item.name}>
                        {item.name}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 text-xs">
                        <span className="text-amber-400 font-mono font-bold flex items-center gap-1">
                          <Gem className="size-3 text-amber-400" />
                          {item.price > 0 ? `${item.price.toLocaleString()} Dia` : (lang === 'th' ? 'ฟรี' : 'Free')}
                        </span>
                        {item.minPowerLevel && item.minPowerLevel > 0 && (
                          <span className="text-cyan-300 font-mono text-[11px] flex items-center gap-0.5">
                            <Zap className="size-3 text-cyan-400" />
                            {item.minPowerLevel.toLocaleString()} PL
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Hunters & Claimants info */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Users className="size-3 text-slate-400" />
                      <span>{item.hunters?.length || 0} {lang === 'th' ? 'คนล่า' : 'hunters'}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <UserCheck className="size-3 text-emerald-400" />
                      <span>{(item.claimants || []).length} {lang === 'th' ? 'ขอรับ' : 'claims'}</span>
                    </span>
                  </div>

                  {/* Action Buttons: Edit and Delete */}
                  {isAdminOrOwner && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
                      {onEditItem && (
                        <button
                          id={`btn-edit-active-item-${item.id}`}
                          onClick={() => {
                            sounds.playClick();
                            onEditItem(item);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 text-xs font-semibold transition cursor-pointer"
                          title={t.editItem}
                        >
                          <Edit className="size-3.5" />
                          <span>{t.edit}</span>
                        </button>
                      )}
                      <button
                        id={`btn-delete-active-item-${item.id}`}
                        onClick={() => {
                          sounds.playClick();
                          setItemToDelete(item);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/50 text-xs font-semibold transition cursor-pointer"
                        title={lang === 'th' ? 'ลบไอเทมนี้' : 'Delete item'}
                      >
                        <Trash2 className="size-3.5" />
                        <span>{lang === 'th' ? 'ลบ' : 'Delete'}</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: DISTRIBUTED ITEMS SECTION (ไอเทมที่แจกแล้ว เก็บแยกต่างหาก แสดงตารางแนวนอน) */}
      {vaultSubTab === 'distributed' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold font-cinzel text-slate-100">
                {t.distributedItemsSection}
              </h2>
              <p className="text-xs text-slate-400">
                {t.distributedItemsDesc}
              </p>
            </div>
            {currentUser?.role === 'owner' && (
              <div className="flex items-center gap-2">
                <button
                  id="btn-owner-quick-purge-distributed"
                  onClick={() => {
                    sounds.playClick();
                    setShowQuickPurgeModal(true);
                  }}
                  disabled={distributedItems.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-600/70 hover:border-emerald-400 text-emerald-200 hover:text-white text-xs font-bold transition-all cursor-pointer shadow disabled:opacity-40 disabled:cursor-not-allowed"
                  title={lang === 'th' ? 'ล้างประวัติไอเทมที่แจกแล้วเพื่อคืนพื้นที่ฐานข้อมูลฟรี' : 'Purge distributed items to preserve free database storage'}
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{lang === 'th' ? 'ล้างประวัติที่แจกแล้ว (คืนพื้นที่)' : 'Purge Distributed (Free Space)'}</span>
                </button>

                {onOpenOwnerResetModal && (
                  <button
                    id="btn-owner-clear-distributed-tab"
                    onClick={() => {
                      sounds.playClick();
                      onOpenOwnerResetModal();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/70 border border-red-700/80 hover:border-red-500 text-red-200 hover:text-white text-xs font-bold transition-all cursor-pointer shadow"
                    title={t.clearDistributedOptionDesc}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    <span>{t.clearDistributedOption}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {purgeSuccessMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{purgeSuccessMsg}</span>
            </div>
          )}

          {isOwner && distributedItems.length > 0 && (
            <div className="p-3 rounded-xl bg-[#0e1726]/90 border border-sky-500/30 text-slate-300 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-amber-400 text-sm shrink-0">💡</span>
                <span className="text-[11px] text-slate-300 leading-relaxed">
                  {lang === 'th'
                    ? `มีประวัติไอเทมที่แจกจ่ายแล้วสะสม ${distributedItems.length} รายการ แนะนำให้กดล้างข้อมูลเก่าเป็นระยะเพื่อรักษาพื้นที่ฐานข้อมูลฟรี 100% ตลอดไป`
                    : `Accumulated ${distributedItems.length} distributed item records. Periodic purging is recommended to preserve 100% free database storage.`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setShowQuickPurgeModal(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shrink-0 transition shadow cursor-pointer"
              >
                {lang === 'th' ? 'ล้างทันที' : 'Purge Now'}
              </button>
            </div>
          )}

          {distributedItems.length === 0 ? (
            <div className="p-10 rounded-xl bg-[#0c121e] border border-slate-800 text-center text-xs text-slate-500">
              {t.noDistributedItems}
            </div>
          ) : (
            <div className="space-y-4">
              {/* View Mode Switcher: Dual-Box (กล่องคู่) VS Table (ตาราง) */}
              <div className="flex items-center justify-between flex-wrap gap-2.5 pb-1">
                <div className="flex items-center p-1 rounded-xl bg-[#090d16] border border-slate-800 shadow-inner">
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setDistViewMode('boxes');
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      distViewMode === 'boxes'
                        ? 'bg-gradient-to-r from-[#d4af37] to-[#aa841c] text-slate-950 shadow'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>{lang === 'th' ? 'มุมมองกล่องคู่ (แยกค้างชำระ)' : 'Dual-Box View (Split Debt)'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setDistViewMode('table');
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      distViewMode === 'table'
                        ? 'bg-gradient-to-r from-[#d4af37] to-[#aa841c] text-slate-950 shadow'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>{lang === 'th' ? 'มุมมองตาราง' : 'Table View'}</span>
                  </button>
                </div>
              </div>

              {distViewMode === 'boxes' ? (
                /* Dual-Box Layout (กล่องคู่: แยกค้างชำระ กับ แจกเสร็จสิ้น) */
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
                  
                  {/* BOX 1: ค้างชำระ (Pending Payment / Debt) */}
                  <div className="rounded-2xl bg-gradient-to-b from-[#18131d] via-[#120f18] to-[#0a0710] border border-amber-500/40 p-4 shadow-xl flex flex-col space-y-3">
                    <div className="flex items-center justify-between pb-2.5 border-b border-amber-500/20">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-inner">
                          <Clock className="w-4 h-4 animate-pulse" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-amber-200 font-cinzel">
                            {lang === 'th' ? 'รายการค้างชำระเพชร' : 'Pending Diamond Payments'}
                          </h3>
                          <p className="text-[11px] text-amber-400/80">
                            {lang === 'th' ? 'ไอเทมที่แจกแล้วแต่ยังรอชำระเพชรเข้ากองทุน' : 'Distributed items awaiting diamond payment'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          {incompleteDistributedItems.length} {lang === 'th' ? 'รายการ' : 'items'}
                        </span>
                      </div>
                    </div>

                    {incompleteDistributedItems.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-800/80 rounded-xl space-y-1 bg-[#090d16]/50">
                        <CheckCircle className="w-7 h-7 mx-auto text-emerald-400/60" />
                        <p className="text-emerald-400 font-semibold">{lang === 'th' ? 'ไม่มีรายการค้างชำระ' : 'No pending payments'}</p>
                        <p className="text-[10px] text-slate-400">{lang === 'th' ? 'สมาชิกทุกคนชำระเพชรครบถ้วนแล้ว' : 'All members have cleared their balances'}</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
                        {incompleteDistributedItems.map((item) => renderDistributedCard(item, true))}
                      </div>
                    )}
                  </div>

                  {/* BOX 2: แจกเสร็จสิ้น (Completed Distributions) */}
                  <div className="rounded-2xl bg-gradient-to-b from-[#101b2b] via-[#0b1320] to-[#070b14] border border-emerald-500/40 p-4 shadow-xl flex flex-col space-y-3">
                    <div className="flex items-center justify-between pb-2.5 border-b border-emerald-500/20">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-inner">
                          <CheckCircle className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-emerald-200 font-cinzel">
                            {lang === 'th' ? 'แจกเสร็จสิ้นแล้ว' : 'Completed Distributions'}
                          </h3>
                          <p className="text-[11px] text-emerald-400/80">
                            {lang === 'th' ? 'ไอเทมที่ชำระแล้วหรือแจกฟรี เรียงล่าสุดบนสุด' : 'Paid and free items, sorted latest first'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          {completeDistributedItems.length} {lang === 'th' ? 'รายการ' : 'items'}
                        </span>
                      </div>
                    </div>

                    {completeDistributedItems.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-800/80 rounded-xl space-y-1 bg-[#090d16]/50">
                        <Gift className="w-7 h-7 mx-auto text-slate-600" />
                        <p>{lang === 'th' ? 'ยังไม่มีประวัติการแจก' : 'No completed distributions yet'}</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
                        {completeDistributedItems.map((item) => renderDistributedCard(item, false))}
                      </div>
                    )}
                  </div>

                </div>
              ) : (
                /* Table View */
                <div className="space-y-3">
                  {/* Category Filter Pills: All / Incomplete / Complete */}
                  <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setDistFilterStatus('all');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    distFilterStatus === 'all'
                      ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-md'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  <span>{lang === 'th' ? 'ทั้งหมด' : 'All'}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 font-mono">
                    {distributedItems.length}
                  </span>
                </button>

                {incompleteDistributedItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setDistFilterStatus('incomplete');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      distFilterStatus === 'incomplete'
                        ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-slate-950 font-black shadow-md'
                        : 'bg-amber-950/40 hover:bg-amber-950/60 text-amber-300 border border-amber-600/40'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span>{t.boxIncompleteDist}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 font-mono">
                      {incompleteDistributedItems.length}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setDistFilterStatus('complete');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    distFilterStatus === 'complete'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                      : 'bg-emerald-950/40 hover:bg-emerald-950/60 text-emerald-300 border border-emerald-600/40'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>{t.boxCompleteDist}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 font-mono">
                    {completeDistributedItems.length}
                  </span>
                </button>
              </div>

              {displayedDistributedItems.length === 0 ? (
                <div className="p-8 rounded-xl bg-[#0c121e] border border-slate-800 text-center text-xs text-slate-500">
                  {lang === 'th' ? 'ไม่มีรายการในหมวดหมู่นี้' : 'No items in this category'}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0d1422] shadow-xl">
                  <table className="w-full text-left text-xs text-slate-300 min-w-[760px]">
                    <thead className="bg-[#090d16] text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">{t.itemImage}</th>
                        <th className="py-3 px-4">{t.itemName}</th>
                        <th className="py-3 px-4 text-center">{t.itemQuantityLabel || t.itemQuantity}</th>
                        <th className="py-3 px-4">{t.itemRarity}</th>
                        <th className="py-3 px-4">{t.itemPrice}</th>
                        <th className="py-3 px-4">{t.distributedTo}</th>
                        <th className="py-3 px-4">{t.distributedDate}</th>
                        <th className="py-3 px-4 min-w-[170px]">{lang === 'th' ? 'รูปรายชื่อผู้ล่า' : 'Hunter Proofs'}</th>
                        <th className="py-3 px-4 min-w-[160px]">{t.receiptBills}</th>
                        <th className="py-3 px-4 text-right">{t.actions}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {displayedDistributedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-[#121a2c]/60 transition-colors">
                      
                      {/* 1. Item Image (Click to Zoom) */}
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => {
                            sounds.playClick();
                            onViewImageZoom(item.imageUrl, item.name);
                          }}
                          title={t.zoomImage}
                          className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border border-slate-700 hover:border-[#38bdf8] bg-slate-900 shrink-0 cursor-pointer group/itemimg relative transition-all hover:scale-105 block shadow-md"
                        >
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/itemimg:opacity-100 flex items-center justify-center transition-opacity">
                            <ZoomIn className="w-3.5 h-3.5 text-white drop-shadow" />
                          </div>
                        </button>
                      </td>

                      {/* 2. Item Name */}
                      <td className={`py-3 px-4 font-bold text-slate-100 ${getRarityTextGlow(item.rarity)}`}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{item.name}</span>
                          {item.source === 'item_queue' && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/50 text-cyan-300">
                              {lang === 'th' ? 'คิวไอเทม' : 'Queue'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Quantity */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-emerald-950/60 border border-emerald-600/40 text-emerald-300">
                          x{item.quantity || 1}
                        </span>
                      </td>

                      {/* 3. Rarity */}
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${getRarityBadge(item.rarity)}`}>
                          {item.rarity}
                        </span>
                      </td>

                      {/* 4. Price & Payment Status */}
                      <td className="py-3 px-4 font-mono font-bold">
                        {item.price > 0 ? (
                          <div className="space-y-1.5">
                            <span className="text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.3)] block text-xs">
                              {item.price.toLocaleString()} {t.diamonds}
                            </span>
                            {!isDistributedItemPaymentPending(item) ? (
                              <button
                                type="button"
                                onClick={() => {
                                  if (!onConfirmPayment) return;
                                  sounds.playClick();
                                  if (window.confirm(
                                    lang === 'th'
                                      ? `ต้องการเปลี่ยนสถานะ "${item.name}" กลับเป็นรอชำระใช่หรือไม่?`
                                      : `Revert "${item.name}" status to pending payment?`
                                  )) {
                                    onConfirmPayment(item, 'pending');
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-pointer hover:bg-emerald-500/30 transition-all shadow-sm"
                                title={
                                  lang === 'th'
                                    ? `ชำระแล้ว ${item.paidBy ? `(ยืนยันโดย ${item.paidBy})` : ''} - คลิกเพื่อเปลี่ยนกลับเป็นรอชำระ`
                                    : `Paid ${item.paidBy ? `(verified by ${item.paidBy})` : ''} - Click to revert to pending`
                                }
                              >
                                <CheckCircle className="w-3 h-3 text-emerald-400" />
                                <span>{t.paymentStatusPaid || (lang === 'th' ? 'ชำระแล้ว' : 'Paid')}</span>
                              </button>
                            ) : (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse shadow-sm">
                                  <Clock className="w-3 h-3 text-amber-400" />
                                  <span>{t.paymentStatusPending || (lang === 'th' ? 'รอชำระ' : 'Pending Payment')}</span>
                                </span>
                                {onConfirmPayment && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      sounds.playClick();
                                      onConfirmPayment(item, 'paid');
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[10px] font-bold shadow cursor-pointer transition-all hover:scale-105 active:scale-95 border border-emerald-400/40"
                                    title={lang === 'th' ? 'กดยืนยันว่าสมาชิกชำระเพชรแล้ว' : 'Click to confirm member has paid diamonds'}
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>{t.confirmPayment || (lang === 'th' ? 'ยืนยันการชำระ' : 'Confirm Payment')}</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-emerald-950/70 border border-emerald-500/50 text-emerald-300">
                            🎁 {t.itemFree || (lang === 'th' ? 'ฟรี' : 'Free')}
                          </span>
                        )}
                      </td>

                      {/* 5. Distributed To */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-200">
                          {item.distributedTo?.name || 'Unknown'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {cleanClanName(item.distributedTo?.clan) || 'No Clan'}
                        </div>
                      </td>

                      {/* 6. Distributed Date */}
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {item.distributedTo?.distributedAt
                          ? new Date(item.distributedTo.distributedAt).toLocaleDateString()
                          : '-'}
                      </td>

                      {/* 7. Hunter Proofs (รูปรายชื่อผู้ล่า - ดูได้ทุกรูป) */}
                      <td className="py-3 px-4">
                        <div className="space-y-1.5">
                          {item.hunterScreenshots && item.hunterScreenshots.length > 0 ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {item.hunterScreenshots.map((shot, idx) => (
                                  <div key={idx} className="relative group/hshot shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        sounds.playClick();
                                        onViewImageZoom(
                                          shot,
                                          `${item.name} - ${lang === 'th' ? `รูปรายชื่อผู้ล่า #${idx + 1}` : `Hunter Proof #${idx + 1}`}`,
                                          item.hunterScreenshots,
                                          idx
                                        );
                                      }}
                                      className="relative group/shot w-11 h-11 rounded-lg overflow-hidden border border-slate-700 hover:border-sky-400 bg-slate-900 transition-all hover:scale-110 shadow-md cursor-pointer block"
                                      title={
                                        lang === 'th'
                                          ? `คลิกดูรูปรายชื่อผู้ล่าใบที่ ${idx + 1} จากทั้งหมด ${item.hunterScreenshots.length} รูป (ใช้สกอลล์เม้าส์ซูมเข้า-ออกได้)`
                                          : `Click to view hunter proof #${idx + 1} of ${item.hunterScreenshots.length} (scroll wheel to zoom)`
                                      }
                                    >
                                      <img
                                        src={shot}
                                        alt={`Hunter Proof ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/shot:opacity-100 flex items-center justify-center transition-opacity">
                                        <ZoomIn className="w-3.5 h-3.5 text-sky-300 drop-shadow" />
                                      </div>
                                      <span className="absolute bottom-0 right-0 px-1 py-0.2 bg-black/80 text-[8.5px] font-mono text-sky-300 font-bold rounded-tl border-t border-l border-slate-700/60">
                                        #{idx + 1}
                                      </span>
                                    </button>
                                    {isAdminOrOwner && (
                                      <button
                                        type="button"
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          if (window.confirm(t.deleteHunterProofConfirm || (lang === 'th' ? 'ต้องการลบรูปผู้ล่านี้ใช่หรือไม่?' : 'Delete this hunter proof?'))) {
                                            sounds.playClick();
                                            const updatedHunters = (item.hunterScreenshots || []).filter((_, i) => i !== idx);
                                            await updateVaultItemDoc(item.id, { hunterScreenshots: updatedHunters });
                                          }
                                        }}
                                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow text-[9px] opacity-0 group-hover/hshot:opacity-100 transition-opacity cursor-pointer z-10"
                                        title={lang === 'th' ? 'ลบรูปผู้ล่านี้' : 'Delete hunter proof'}
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                <span className="text-sky-400 font-mono font-semibold">
                                  {item.hunterScreenshots.length} {lang === 'th' ? 'รูป' : 'imgs'}
                                </span>
                                {item.hunters && item.hunters.length > 0 && (
                                  <>
                                    <span>•</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        sounds.playClick();
                                        setViewingDistributedHuntersItem(item);
                                        setDistHuntersViewMode('cards');
                                        setDistHuntersTextFormat('by-clan');
                                        setDistHuntersClanFilter('all');
                                      }}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold hover:text-amber-200 cursor-pointer transition-all shadow-sm"
                                      title={lang === 'th' ? 'คลิกเพื่อดูรายชื่อผู้ล่า (เลือกดูแบบ Card หรือ Text ได้)' : 'View hunter names (Card or Text)'}
                                    >
                                      <Users className="w-2.5 h-2.5 text-amber-400" />
                                      <span>{item.hunters.length} {lang === 'th' ? 'ผู้ล่า (ดูชื่อ)' : 'Hunters (View)'}</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          ) : item.hunters && item.hunters.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => {
                                sounds.playClick();
                                setViewingDistributedHuntersItem(item);
                                setDistHuntersViewMode('cards');
                                setDistHuntersTextFormat('by-clan');
                                setDistHuntersClanFilter('all');
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/60 hover:bg-amber-900/80 border border-amber-600/60 text-amber-300 text-xs font-bold transition-all cursor-pointer shadow-sm"
                              title={lang === 'th' ? 'คลิกเพื่อดูรายชื่อผู้ล่า (เลือกดูแบบ Card หรือ Text ได้)' : 'View hunter names (Card or Text)'}
                            >
                              <Users className="w-3.5 h-3.5 text-amber-400" />
                              <span>{item.hunters.length} {lang === 'th' ? 'ผู้ล่า (ดูรายชื่อ)' : 'Hunters (View)'}</span>
                            </button>
                          ) : item.source === 'item_queue' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                              <span>-</span>
                              <span className="text-[10px] text-cyan-400/80 font-medium">({lang === 'th' ? 'คิวไอเทม ไม่มีผู้ล่า' : 'Item Queue'})</span>
                            </span>
                          ) : (
                            <span className="text-slate-600 text-[11px] italic">
                              {lang === 'th' ? 'ไม่มีรูปผู้ล่า' : 'No proof attached'}
                            </span>
                          )}

                          {/* Attach Hunter Proof button for Admin/Owner */}
                          {isAdminOrOwner && (
                            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                              <label
                                htmlFor={`table-file-hunter-${item.id}`}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-950/50 hover:bg-sky-900/60 border border-sky-600/40 text-sky-300 text-[11px] font-semibold transition-all cursor-pointer shadow-sm active:scale-95"
                                title={t.hunterProofDesc || (lang === 'th' ? 'แนบรูปภาพสกรีนช็อตรายชื่อผู้ล่า' : 'Attach hunter screenshots')}
                              >
                                <Upload className="w-3 h-3 text-sky-400" />
                                <span>+ {t.attachHunterProof || (lang === 'th' ? 'แนบรูปผู้ล่า' : 'Hunter Proof')}</span>
                              </label>
                              <input
                                id={`table-file-hunter-${item.id}`}
                                type="file"
                                multiple
                                accept="image/*"
                                onChange={async (e) => {
                                  const files = e.target.files;
                                  if (!files || files.length === 0) return;
                                  try {
                                    sounds.playClick();
                                    const compressedList = await Promise.all(
                                      (Array.from(files) as File[]).map((f) => compressImageFile(f, { maxWidth: 1600, maxHeight: 1600, quality: 0.8 }))
                                    );
                                    const existing = item.hunterScreenshots || [];
                                    await updateVaultItemDoc(item.id, { hunterScreenshots: [...existing, ...compressedList] });
                                    sounds.playSuccess();
                                  } catch (err) {
                                    console.error('Error uploading hunter screenshots:', err);
                                  } finally {
                                    e.target.value = '';
                                  }
                                }}
                                className="hidden"
                              />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 7.5. Receipt Bills (รูปบิล / ใบเสร็จ - แนบได้หลายใบ) */}
                      <td className="py-3 px-4">
                        <div className="space-y-1.5">
                          {item.receiptImages && item.receiptImages.length > 0 ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {item.receiptImages.map((receiptUrl, rIdx) => (
                                <div key={rIdx} className="relative group/receipt shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      sounds.playClick();
                                      onViewImageZoom(
                                        receiptUrl,
                                        `${item.name} - ${lang === 'th' ? `บิล/ใบเสร็จ #${rIdx + 1}` : `Receipt #${rIdx + 1}`}`,
                                        item.receiptImages,
                                        rIdx
                                      );
                                    }}
                                    className="w-11 h-11 rounded-lg overflow-hidden border border-emerald-500/40 hover:border-emerald-400 bg-slate-900 transition-all hover:scale-110 shadow-md cursor-pointer block"
                                    title={lang === 'th' ? `คลิกดูรูปบิล #${rIdx + 1}` : `View receipt #${rIdx + 1}`}
                                  >
                                    <img
                                      src={receiptUrl}
                                      alt={`Receipt ${rIdx + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/receipt:opacity-100 flex items-center justify-center transition-opacity">
                                      <ZoomIn className="w-3.5 h-3.5 text-emerald-300 drop-shadow" />
                                    </div>
                                    <span className="absolute bottom-0 right-0 px-1 py-0.2 bg-black/80 text-[8.5px] font-mono text-emerald-300 font-bold rounded-tl border-t border-l border-emerald-700/60">
                                      #{rIdx + 1}
                                    </span>
                                  </button>

                                  {isAdminOrOwner && (
                                    <button
                                      type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (window.confirm(t.deleteReceiptConfirm)) {
                                          sounds.playClick();
                                          const updatedReceipts = (item.receiptImages || []).filter((_, i) => i !== rIdx);
                                          await updateVaultItemDoc(item.id, { receiptImages: updatedReceipts });
                                        }
                                      }}
                                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow text-[9px] opacity-0 group-hover/receipt:opacity-100 transition-opacity cursor-pointer z-10"
                                      title={lang === 'th' ? 'ลบรูปบิลนี้' : 'Delete receipt'}
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : null}

                          {/* Attach receipt button for Admin/Owner (Only for items with price > 0; free items do not require bill) */}
                          {isAdminOrOwner && item.price > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <label
                                htmlFor={`file-receipt-${item.id}`}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-600/40 text-emerald-300 text-[11px] font-semibold transition-all cursor-pointer shadow-sm active:scale-95"
                                title={t.receiptBillsDesc}
                              >
                                <Upload className="w-3 h-3 text-emerald-400" />
                                <span>+ {t.attachReceipt}</span>
                              </label>
                              <input
                                id={`file-receipt-${item.id}`}
                                type="file"
                                multiple
                                accept="image/*"
                                onChange={async (e) => {
                                  const files = e.target.files;
                                  if (!files || files.length === 0) return;
                                  try {
                                    sounds.playClick();
                                    const compressedList = await Promise.all(
                                      (Array.from(files) as File[]).map((f) => compressImageFile(f, { maxWidth: 1600, maxHeight: 1600, quality: 0.8 })
                                      )
                                    );
                                    const existing = item.receiptImages || [];
                                    await updateVaultItemDoc(item.id, {
                                      receiptImages: [...existing, ...compressedList]
                                    });
                                    sounds.playClaim();
                                  } catch (err) {
                                    console.error('Error uploading receipts:', err);
                                  } finally {
                                    e.target.value = '';
                                  }
                                }}
                                className="hidden"
                              />
                              {item.receiptImages && item.receiptImages.length > 0 && (
                                <span className="text-[10px] font-mono text-emerald-400/80">
                                  ({item.receiptImages.length} {lang === 'th' ? 'บิล' : 'bills'})
                                </span>
                              )}
                            </div>
                          )}

                          {item.price <= 0 && (!item.receiptImages || item.receiptImages.length === 0) && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-950/40 text-emerald-400/80 border border-emerald-500/20">
                              🎁 {lang === 'th' ? 'แจกฟรี (ไม่ต้องแนบบิล)' : 'Free (No bill needed)'}
                            </span>
                          )}

                          {item.price > 0 && (!item.receiptImages || item.receiptImages.length === 0) && !isAdminOrOwner && (
                            <span className="text-slate-600 text-[11px] italic">
                              {t.noReceipts}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 8. Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          
                          {/* Quick view hunters as text or card */}
                          {item.hunters && item.hunters.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                sounds.playClick();
                                setViewingDistributedHuntersItem(item);
                                setDistHuntersViewMode('cards');
                                setDistHuntersTextFormat('by-clan');
                                setDistHuntersClanFilter('all');
                              }}
                              className="px-2 py-1.5 rounded-lg bg-amber-950/50 hover:bg-amber-900/70 text-amber-300 hover:text-amber-200 border border-amber-600/50 transition-all flex items-center gap-1 text-xs cursor-pointer shadow-sm"
                              title={lang === 'th' ? 'ดูรายชื่อผู้ล่าแบบ Text หรือ Card' : 'View hunter names as Text or Cards'}
                            >
                              <FileText className="w-3.5 h-3.5 text-amber-400" />
                              <span className="text-[10px] font-bold hidden sm:inline">
                                {t.viewDistributedHunters}
                              </span>
                            </button>
                          )}

                          {/* Quick view all proof screenshots */}
                          {item.hunterScreenshots && item.hunterScreenshots.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                sounds.playClick();
                                onViewImageZoom(
                                  item.hunterScreenshots[0],
                                  `${item.name} - ${lang === 'th' ? 'รูปรายชื่อผู้ล่า' : 'Hunter Proof'}`,
                                  item.hunterScreenshots,
                                  0
                                );
                              }}
                              className="px-2 py-1.5 rounded-lg bg-[#162235] hover:bg-[#20314d] text-sky-400 hover:text-sky-300 border border-sky-800/60 transition-all flex items-center gap-1 text-xs cursor-pointer shadow-sm"
                              title={lang === 'th' ? 'เปิดดูรูปรายชื่อผู้ล่าทั้งหมด' : 'View all hunter proofs'}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span className="text-[10px] font-medium hidden sm:inline">
                                {lang === 'th' ? 'ดูรูป' : 'View'} ({item.hunterScreenshots.length})
                              </span>
                            </button>
                          )}

                          {/* Admin / Owner Edit Item */}
                          {isAdminOrOwner && onEditItem && (
                            <button
                              id={`btn-edit-distributed-record-${item.id}`}
                              onClick={() => {
                                sounds.playClick();
                                onEditItem(item);
                              }}
                              className="p-1.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/60 text-amber-400 border border-amber-800/50 transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
                              title={t.editItem}
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}

                          {/* Admin / Owner Delete Item */}
                          {isAdminOrOwner && (
                            <button
                              id={`btn-delete-distributed-record-${item.id}`}
                              onClick={() => {
                                sounds.playClick();
                                setItemToDelete(item);
                              }}
                              className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/50 transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
                              title={t.deleteDistributedItem}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}

                        </div>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )}
</div>
)}

      {/* IN-APP CONFIRM DELETE VAULT ITEM MODAL */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-2xl bg-gradient-to-b from-[#181015] via-[#100a0e] to-[#080507] border border-red-500/50 shadow-[0_20px_60px_rgba(0,0,0,0.95),0_0_30px_rgba(239,68,68,0.25)] p-6 text-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/50 text-red-400 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  {lang === 'th' ? 'ยืนยันการลบรายการ' : 'Confirm Delete Record'}
                </h3>
                <p className="text-xs text-red-400/90 font-medium">
                  {lang === 'th' ? 'การกระทำนี้จะลบรายการนี้ออกจากระบบถาวร' : 'Permanently removes this record from archive'}
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
                id="btn-confirm-delete-vault-record"
                onClick={() => {
                  sounds.playClick();
                  onDeleteVaultItem(itemToDelete.id);
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

      {/* DISTRIBUTED ITEM HUNTERS VIEWER MODAL (CARD & TEXT VIEW) */}
      {viewingDistributedHuntersItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b111e] border border-slate-700/80 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 bg-[#070b14] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-700 bg-slate-900 shrink-0 shadow-md">
                  <img
                    src={viewingDistributedHuntersItem.imageUrl}
                    alt={viewingDistributedHuntersItem.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-slate-100 truncate">
                      {viewingDistributedHuntersItem.name}
                    </h3>
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border uppercase ${getRarityBadge(viewingDistributedHuntersItem.rarity)}`}>
                      {viewingDistributedHuntersItem.rarity}
                    </span>
                    {viewingDistributedHuntersItem.price > 0 ? (
                      <span className="text-xs font-mono text-white font-bold drop-shadow-[0_0_4px_rgba(255,255,255,0.3)]">
                        {viewingDistributedHuntersItem.price.toLocaleString()} {t.diamonds}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-950/70 border border-emerald-500/50 text-emerald-300">
                        🎁 {t.itemFree || (lang === 'th' ? 'ฟรี' : 'Free')}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {t.distributedHuntersModalDesc}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViewingDistributedHuntersItem(null)}
                className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Modal Controls Bar (View Mode: Cards vs Text + Copy buttons) */}
            <div className="p-3 bg-[#0d1424] border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                {/* Cards vs Text view toggle */}
                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#070b13] border border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setDistHuntersViewMode('cards');
                    }}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      distHuntersViewMode === 'cards'
                        ? 'bg-sky-950 text-sky-300 border border-sky-600/60 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>{t.viewAsCards}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setDistHuntersViewMode('text');
                    }}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      distHuntersViewMode === 'text'
                        ? 'bg-amber-950 text-amber-300 border border-amber-600/60 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>{t.viewAsText}</span>
                  </button>
                </div>

                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  {viewingDistributedHuntersItem.hunters?.length || 0} {lang === 'th' ? 'คน' : 'names'}
                </span>
              </div>

              {/* Copy All Button */}
              {(viewingDistributedHuntersItem.hunters?.length || 0) > 0 && (
                <button
                  type="button"
                  onClick={() => handleCopyDistributedHunters(viewingDistributedHuntersItem)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/70 hover:border-emerald-500 text-emerald-300 text-[11px] font-bold transition-all cursor-pointer shadow-sm"
                >
                  {copiedDistHunters ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{lang === 'th' ? '✓ คัดลอกแล้ว!' : '✓ Copied!'}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{t.copyAllHunters}</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Modal Content Body */}
            <div className="p-4 overflow-y-auto flex-1 custom-scrollbar space-y-3 bg-[#080d17]">
              {(!viewingDistributedHuntersItem.hunters || viewingDistributedHuntersItem.hunters.length === 0) ? (
                <div className="p-8 text-center text-xs text-slate-500 bg-[#0b101c] rounded-xl border border-slate-800">
                  {t.noHuntersRecorded}
                </div>
              ) : distHuntersViewMode === 'cards' ? (
                /* Cards View */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(() => {
                    const grouped = (viewingDistributedHuntersItem.hunters || []).reduce((acc, h) => {
                      const cKey = cleanClanName(h.clan) || 'VoltZ';
                      if (!acc[cKey]) acc[cKey] = [];
                      acc[cKey].push(h.name);
                      return acc;
                    }, {} as Record<string, string[]>);

                    return (Object.entries(grouped) as [string, string[]][]).map(([clanName, memberNames]) => (
                      <div key={clanName} className="p-3 rounded-lg bg-[#0e1524] border border-sky-500/40 shadow-sm flex flex-col">
                        <div className="text-xs font-bold text-amber-300 font-mono border-b border-slate-700/80 pb-1.5 mb-2 flex items-center justify-between">
                          <span>{cleanClanName(clanName)}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({memberNames.length} {lang === 'th' ? 'คน' : 'hunters'})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(memberNames.join('\n'));
                                sounds.playClaim();
                                setCopiedDistHunters(true);
                                setTimeout(() => setCopiedDistHunters(false), 2000);
                              }}
                              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
                              title={lang === 'th' ? `คัดลอกเฉพาะ ${clanName}` : `Copy ${clanName}`}
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div className="space-y-1 overflow-y-auto max-h-[220px] custom-scrollbar pr-1">
                          {memberNames.map((mName, idx) => (
                            <div
                              key={idx}
                              className="text-xs text-slate-200 font-medium py-1 px-2 rounded bg-[#090d16] border border-slate-800/60"
                            >
                              {mName}
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              ) : (
                /* Text View with Clan Separation */
                <div className="space-y-3">
                  {/* Format selector: By Clan vs Plain vs Inline vs Comma */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1 bg-[#111726] p-0.5 rounded-lg border border-slate-700 text-[11px] flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          sounds.playClick();
                          setDistHuntersTextFormat('by-clan');
                        }}
                        className={`px-2.5 py-1 rounded transition-all cursor-pointer flex items-center gap-1 ${
                          distHuntersTextFormat === 'by-clan'
                            ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Layers className="w-3 h-3" />
                        <span>{t.formatByClan}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          sounds.playClick();
                          setDistHuntersTextFormat('plain');
                        }}
                        className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                          distHuntersTextFormat === 'plain'
                            ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span>{t.formatPlain}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          sounds.playClick();
                          setDistHuntersTextFormat('inline');
                        }}
                        className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                          distHuntersTextFormat === 'inline'
                            ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span>{t.formatInline}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          sounds.playClick();
                          setDistHuntersTextFormat('comma');
                        }}
                        className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                          distHuntersTextFormat === 'comma'
                            ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span>{t.formatComma}</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopyDistributedHunters(viewingDistributedHuntersItem)}
                      className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedDistHunters ? (lang === 'th' ? '✓ คัดลอกแล้ว' : '✓ Copied') : t.copyAllHunters}</span>
                    </button>
                  </div>

                  {/* Readonly Textarea */}
                  <textarea
                    readOnly
                    rows={Math.min(16, Math.max(6, (getFormattedDistributedHuntersText(viewingDistributedHuntersItem).split('\n').length || 6) + 1))}
                    value={getFormattedDistributedHuntersText(viewingDistributedHuntersItem)}
                    onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#04070d] border border-slate-800 hover:border-amber-500/50 text-xs font-mono text-slate-200 leading-relaxed focus:outline-none focus:border-amber-400 cursor-text resize-y shadow-inner select-all"
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-800 bg-[#070b14] flex justify-end">
              <button
                type="button"
                onClick={() => setViewingDistributedHuntersItem(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
              >
                {t.closeZoom}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* QUICK PURGE CONFIRMATION MODAL */}
      {showQuickPurgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-[#0f172a] border border-emerald-500/40 shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {lang === 'th' ? 'ล้างประวัติไอเทมที่แจกจ่ายแล้ว' : 'Purge Distributed Item Records'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {lang === 'th' ? 'คืนพื้นที่ฐานข้อมูลและรักษาความเร็วระบบ (ฟรี 100%)' : 'Free up database storage and optimize performance'}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {lang === 'th'
                ? `คุณต้องการล้างข้อมูลไอเทมที่แจกจ่ายเสร็จสิ้นแล้วทั้งหมด ${distributedItems.length} รายการใช่หรือไม่? ข้อมูลประวัตินี้จะถูกลบออกจากฐานข้อมูลเพื่อรักษาพื้นที่ฟรีของระบบ (ไอเทมที่เปิดรับอยู่ในคลังจะไม่ได้รับผลกระทบ)`
                : `Are you sure you want to purge all ${distributedItems.length} distributed items? These records will be permanently removed to conserve your free tier quota (active vault items remain untouched).`}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                disabled={isPurgingDistributed}
                onClick={() => setShowQuickPurgeModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={isPurgingDistributed}
                onClick={handleQuickPurgeDistributed}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/30 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {isPurgingDistributed && <Clock className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {isPurgingDistributed
                    ? (lang === 'th' ? 'กำลังล้างข้อมูล...' : 'Purging...')
                    : (lang === 'th' ? 'ยืนยันล้างข้อมูล' : 'Confirm Purge')}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HUNTER CHECKLIST SELECTION MODAL */}
      {showHunterChecklistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl bg-gradient-to-b from-[#111827] via-[#0d1322] to-[#070b14] border border-[#d4af37]/40 shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 bg-[#0c1220] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <UserCheck className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <span>{t.hunterChecklistTitle}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                      {hunters.length} / {activeMembersList.length} {t.selectedHuntersCount}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">{t.hunterChecklistDesc}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHunterChecklistModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Toolbar: Search + Filter Tabs + Batch Actions */}
            <div className="p-3 border-b border-slate-800/80 bg-[#090e1a] space-y-2.5">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                {/* Search bar */}
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={hunterSearchQuery}
                    onChange={(e) => setHunterSearchQuery(e.target.value)}
                    placeholder={t.searchMembersList}
                    className="w-full pl-8 pr-8 py-1.5 rounded-lg bg-[#141b2d] border border-slate-700/80 hover:border-slate-600 focus:border-[#d4af37] text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                  />
                  {hunterSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setHunterSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Batch select / deselect */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="px-2.5 py-1.5 rounded-lg bg-sky-950/70 hover:bg-sky-900 border border-sky-600/50 hover:border-sky-500 text-sky-300 text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>{t.selectAllMembers}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAllFiltered}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>{t.deselectAllMembers}</span>
                  </button>
                </div>
              </div>

              {/* Clan Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                <button
                  type="button"
                  onClick={() => setHunterClanFilter('all')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer shrink-0 ${
                    hunterClanFilter === 'all'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.allClansFilter} ({activeMembersList.length})
                </button>
                {(Object.entries(membersByClan) as [string, User[]][]).map(([clanName, cMembers]) => {
                  const clanSelectedCount = cMembers.filter((m) =>
                    selectedHunterNameSet.has(m.inGameName.trim().toLowerCase())
                  ).length;
                  return (
                    <button
                      key={clanName}
                      type="button"
                      onClick={() => setHunterClanFilter(clanName)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                        hunterClanFilter === clanName
                          ? 'bg-sky-600 text-white shadow-sm'
                          : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>{clanName}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
                        {clanSelectedCount}/{cMembers.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modal Body: 2-Channel Clan Layout */}
            <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {(Object.entries(membersByClan) as [string, User[]][])
                  .filter(([cName]) => hunterClanFilter === 'all' || hunterClanFilter.toLowerCase() === cName.toLowerCase())
                  .map(([clanName, cMembers]) => {
                    const visibleMembers = cMembers.filter((m) => {
                      if (!hunterSearchQuery.trim()) return true;
                      const q = hunterSearchQuery.trim().toLowerCase();
                      return (
                        m.inGameName.toLowerCase().includes(q) ||
                        m.clan.toLowerCase().includes(q) ||
                        (m.characterClass && m.characterClass.toLowerCase().includes(q))
                      );
                    });

                    const selectedInThisClan = cMembers.filter((m) =>
                      selectedHunterNameSet.has(m.inGameName.trim().toLowerCase())
                    ).length;

                    return (
                      <div
                        key={clanName}
                        className="rounded-xl border border-slate-800 bg-[#090e1a] p-3 flex flex-col shadow-md hover:border-slate-700/80 transition-colors"
                      >
                        {/* Clan Header */}
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="text-xs font-bold text-amber-300 truncate">{clanName}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono shrink-0">
                              {selectedInThisClan} / {cMembers.length}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                sounds.playClick();
                                const targetMembers = visibleMembers.length > 0 ? visibleMembers : cMembers;
                                const currentNames = new Set(hunters.map((h) => h.name.trim().toLowerCase()));
                                const toAdd: HunterRecord[] = [];
                                targetMembers.forEach((m) => {
                                  const key = m.inGameName.trim().toLowerCase();
                                  if (!currentNames.has(key)) {
                                    toAdd.push({ name: m.inGameName.trim(), clan: cleanClanName(m.clan) || cleanClanName(clanName) || 'VoltZ' });
                                    currentNames.add(key);
                                  }
                                });
                                if (toAdd.length > 0) setHunters((prev) => [...prev, ...toAdd]);
                              }}
                              className="px-2 py-0.5 rounded bg-sky-950/80 hover:bg-sky-900 border border-sky-600/50 text-sky-300 text-[10px] font-semibold transition cursor-pointer"
                            >
                              {t.selectEntireClan}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                sounds.playClick();
                                const targetKeys = new Set(
                                  (visibleMembers.length > 0 ? visibleMembers : cMembers).map((m) =>
                                    m.inGameName.trim().toLowerCase()
                                  )
                                );
                                setHunters((prev) => prev.filter((h) => !targetKeys.has(h.name.trim().toLowerCase())));
                              }}
                              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[10px] font-semibold transition cursor-pointer"
                            >
                              {t.clearEntireClan}
                            </button>
                          </div>
                        </div>

                        {/* Members Grid inside clan */}
                        <div className="max-h-[300px] overflow-y-auto pr-1 space-y-1.5 custom-scrollbar flex-1">
                          {visibleMembers.length === 0 ? (
                            <div className="p-4 rounded-lg bg-[#060a12] border border-slate-800/80 text-center text-[11px] text-slate-500">
                              {lang === 'th' ? 'ไม่พบสมาชิกที่ค้นหา' : 'No matching members'}
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {visibleMembers.map((member) => {
                                const isSelected = selectedHunterNameSet.has(
                                  member.inGameName.trim().toLowerCase()
                                );
                                return (
                                  <div
                                    key={member.id}
                                    onClick={() => handleToggleHunterMember(member)}
                                    className={`px-2 py-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1.5 select-none hover:scale-[1.01] active:scale-[0.99] ${
                                      isSelected
                                        ? 'bg-[#d4af37]/20 border-[#d4af37] text-amber-200 shadow-[0_0_8px_rgba(212,175,55,0.2)]'
                                        : 'bg-[#060a12] border-slate-800/80 hover:border-slate-700 text-slate-300 hover:bg-[#0c1220]'
                                    }`}
                                  >
                                    <div
                                      className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border transition ${
                                        isSelected
                                          ? 'bg-[#d4af37] border-[#d4af37] text-slate-950 font-bold'
                                          : 'border-slate-600 bg-[#141b2b]'
                                      }`}
                                    >
                                      {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                    </div>

                                    <div className="min-w-0 flex-1 flex items-center justify-between gap-1">
                                      <span className={`text-[11px] font-bold truncate ${isSelected ? 'text-amber-200' : 'text-slate-200'}`}>
                                        {member.inGameName}
                                      </span>
                                      {member.powerLevel ? (
                                        <span className="text-[9.5px] text-amber-400/90 font-mono shrink-0">
                                          ⚡{(member.powerLevel / 1000).toFixed(0)}k
                                        </span>
                                      ) : member.characterClass ? (
                                        <span className="text-[9px] text-slate-500 truncate shrink-0">
                                          {member.characterClass}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-800 bg-[#0a0f1d] flex items-center justify-between">
              <span className="text-xs text-slate-300 font-medium">
                {lang === 'th' ? `เลือกแล้วทั้งหมด ${hunters.length} คน` : `Total selected: ${hunters.length}`}
              </span>
              <button
                type="button"
                onClick={() => {
                  sounds.playClaim();
                  setShowHunterChecklistModal(false);
                }}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 font-bold text-xs shadow-md hover:brightness-110 cursor-pointer"
              >
                {lang === 'th' ? `✓ ยืนยันรายชื่อ (${hunters.length} คน)` : `✓ Confirm Hunters (${hunters.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GEMINI AI KEY MODAL */}
      <GeminiKeyModal
        isOpen={showGeminiModal}
        onClose={() => setShowGeminiModal(false)}
        lang={lang}
        isOwner={isOwner}
        onKeySaved={() => {
          setGeminiConfigured(true);
          setGeminiMaskedKey(null);
          setOcrErrorType(null);
        }}
      />

    </div>
  );
};
