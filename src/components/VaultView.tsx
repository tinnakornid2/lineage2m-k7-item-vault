import React, { useState, useMemo, useEffect } from 'react';
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
  Square
} from 'lucide-react';
import {
  HunterRecord,
  ItemRarity,
  Language,
  QuickItem,
  User,
  VaultItem,
  cleanClanName,
  DEFAULT_CLAN
} from '../types';
import { translations } from '../translations';
import { sounds } from '../utils/sound';
import { compressImageFile } from '../utils/imageCompressor';
import { DistributionStatsModal } from './DistributionStatsModal';
import { GeminiKeyModal } from './GeminiKeyModal';
import {
  getCurrentUserIdToken,
  listenToGeminiAiSettings,
  updateVaultItemDoc
} from '../services/firebase';

interface VaultViewProps {
  lang: Language;
  currentUser: User | null;
  allMembers: User[];
  vaultItems: VaultItem[];
  quickItems: QuickItem[];
  onOpenQuickItemsModal: () => void;
  onSelectQuickItemForForm?: (item: QuickItem) => void;
  onCreateVaultItem: (item: Omit<VaultItem, 'id' | 'createdAt' | 'status' | 'claimants'>) => Promise<void>;
  onDeleteVaultItem: (itemId: string) => Promise<void>;
  onViewImageZoom: (
    url: string,
    title?: string,
    images?: string[],
    currentIndex?: number
  ) => void;
  onOpenOwnerResetModal?: () => void;
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
  onViewImageZoom,
  onOpenOwnerResetModal
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

  // Check Gemini API status and sync from Firestore in real-time
  useEffect(() => {
    // Browser clients never receive or persist Gemini API keys.
    const unsubscribe = listenToGeminiAiSettings((settings) => {
      void settings;
    });

    // 2. Also check local backend /api/gemini-status if available
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
            setGeminiMaskedKey(data.maskedKey || null);
            return;
          }
        }
      } catch {
        // Ignore and fallback below
      }
    };
    checkServerStatus();

    return () => {
      unsubscribe();
    };
  }, [isOwner, currentUser]);

  // Group active members by Clan for hunter dropdown selection
  const membersByClan = useMemo(() => {
    const groups: Record<string, User[]> = {};
    allMembers
      .filter((m) => m.status === 'active' && m.inGameName)
      .forEach((m) => {
        const clan = cleanClanName(m.clan) || 'No Clan';
        if (!groups[clan]) groups[clan] = [];
        groups[clan].push(m);
      });
    return groups;
  }, [allMembers]);

  // Active members who have an inGameName
  const activeMembersList = useMemo(() => {
    return allMembers.filter((m) => m.status === 'active' && m.inGameName);
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

  // Active view inside Vault: 'active' or 'distributed'
  const [vaultSubTab, setVaultSubTab] = useState<'create' | 'distributed'>('create');

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

      // Process resulting data safely. Gemini credentials remain backend-only.
      if (!data) {
        throw new Error('AI_SERVER_CONNECT_ERROR');
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

    if (!name.trim()) {
      setFormError(lang === 'th' ? 'กรุณาระบุชื่อไอเทม' : 'Item name required');
      return;
    }

    setIsCreating(true);
    try {
      sounds.playClaim();
      // Ensure strict deduplication before creating item
      const { unique: deduplicatedFinalHunters } = deduplicateHunterList(hunters);

      await onCreateVaultItem({
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
      });

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
        lang === 'th'
          ? 'เพิ่มไอเทมสำเร็จ!'
          : 'Item created!'
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
    } catch {
      setFormError(t.error);
    } finally {
      setIsCreating(false);
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

  const distributedItems = vaultItems.filter((i) => i.status === 'distributed');

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

      {/* Sub-Tabs: Add/Active Item Form VS Distributed Archive */}
      <div className="flex items-center gap-2 p-1 rounded-xl bg-[#0b0e17] border border-slate-800/80 w-fit">
        <button
          onClick={() => {
            sounds.playClick();
            setVaultSubTab('create');
          }}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
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
            setVaultSubTab('distributed');
          }}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
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

      {/* VIEW 1: CREATE / ADD ITEM FORM */}
      {vaultSubTab === 'create' && (
        <div className="space-y-6">
          
          {/* Quick presets shortcut strip */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#0d1525] via-[#0b101c] to-[#080d17] border border-[#d4af37]/35 shadow-xl space-y-2.5 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#f5d77f]" />
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  {t.selectFromQuickItem}:
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-[#f5d77f] font-mono border border-slate-700">
                  {quickItems.length}
                </span>
              </div>

              {/* Direct Manage Quick Items Button */}
              {isAdminOrOwner && (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    onOpenQuickItemsModal();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-[#1f2b42] to-[#141c2c] hover:from-[#263755] hover:to-[#1b263b] border border-[#d4af37]/50 hover:border-[#d4af37] text-[#f5d77f] hover:text-white text-xs font-bold transition-all shadow-sm cursor-pointer group"
                >
                  <Sparkles className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
                  <span>{t.manageQuickItems}</span>
                </button>
              )}
            </div>

            {quickItems.length > 0 ? (
              <div className="flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar">
                {quickItems.map((qi) => (
                  <button
                    key={qi.id}
                    onClick={() => handleApplyQuickItem(qi)}
                    className="flex items-center gap-2.5 p-2 rounded-xl bg-[#11192a]/90 hover:bg-[#18233a] border border-slate-700/80 hover:border-[#d4af37] transition-all shrink-0 text-left shadow-md hover:shadow-[#d4af37]/10 group cursor-pointer"
                  >
                    <img
                      src={qi.imageUrl}
                      alt={qi.name}
                      className="w-9 h-9 rounded-lg object-cover border border-slate-700 group-hover:border-[#d4af37]/80 group-hover:scale-105 transition-all"
                    />
                    <div className="pr-1">
                      <div className="text-xs font-bold text-slate-200 group-hover:text-white truncate max-w-[130px]">
                        {qi.name}
                      </div>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border ${getRarityBadge(qi.rarity)}`}>
                        {qi.rarity}
                      </span>
                    </div>
                  </button>
                ))}

                {/* Direct quick add button at the end of strip */}
                {isAdminOrOwner && (
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      onOpenQuickItemsModal();
                    }}
                    className="flex items-center gap-1.5 px-3 py-3 rounded-xl bg-[#0e1627]/60 hover:bg-[#18233b] border border-dashed border-slate-700 hover:border-[#d4af37] text-slate-400 hover:text-[#f5d77f] text-xs font-semibold shrink-0 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-[#f5d77f]" />
                    <span>{lang === 'th' ? '+ เพิ่มควิกไอเทม' : '+ Add Preset'}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#090e1a] border border-dashed border-slate-800 text-xs text-slate-400">
                <span>{lang === 'th' ? 'ยังไม่มีควิกไอเทม' : 'No quick items yet.'}</span>
                {isAdminOrOwner && (
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      onOpenQuickItemsModal();
                    }}
                    className="text-[#f5d77f] hover:underline font-bold"
                  >
                    {lang === 'th' ? '+ เพิ่มควิกไอเทม' : '+ Add Preset'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Main Item Form */}
          <form
            onSubmit={handleCreateItemSubmit}
            className="rounded-2xl bg-gradient-to-b from-[#131b2c] via-[#0d1320] to-[#080c14] border border-[#d4af37]/30 p-6 sm:p-8 shadow-2xl space-y-6"
          >
            <h2 className="text-lg font-bold font-cinzel text-slate-100 flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#f5d77f]" />
              <span>{t.addNewItem}</span>
            </h2>

            {formError && (
              <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-700 text-xs text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{formSuccess}</span>
              </div>
            )}

            {/* Grid 1: Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* 1. Item Image (Upload from device) */}
              <div className="lg:col-span-1">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  1. {t.itemImage} *
                </label>
                <div
                  tabIndex={0}
                  onPaste={handlePasteItemImageZone}
                  className="flex flex-col items-center justify-center p-3 rounded-xl bg-[#090d16] border border-dashed border-slate-700 hover:border-[#d4af37] focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37]/40 transition-all relative group min-h-[140px] outline-none"
                  title={lang === 'th' ? 'คลิกเลือกไฟล์ หรือกด Ctrl + V เพื่อวางรูป' : 'Click to choose or Ctrl + V to paste'}
                >
                  {itemImagePreview ? (
                    <div className="relative w-full h-28 rounded-lg overflow-hidden border border-slate-700">
                      <img
                        src={itemImagePreview}
                        alt="preview"
                        className="w-full h-full object-cover"
                      />
                      <label
                        htmlFor="file-item-image-replace"
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 text-xs font-bold text-white transition-opacity cursor-pointer"
                      >
                        <span>{t.chooseImage}</span>
                        <span className="text-[10px] text-amber-300 font-mono">{lang === 'th' ? 'หรือกด Ctrl + V' : 'or press Ctrl + V'}</span>
                      </label>
                    </div>
                  ) : (
                    <label
                      htmlFor="file-item-image"
                      className="w-full h-full flex flex-col items-center justify-center cursor-pointer text-center p-2"
                    >
                      <Upload className="w-6 h-6 text-[#d4af37] mb-1.5 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-semibold text-slate-200">
                        {t.chooseImage}
                      </span>
                      <span className="text-[10px] text-amber-300 font-mono mt-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 flex items-center gap-1">
                        <ClipboardCheck className="w-3 h-3" />
                        <span>Ctrl + V {lang === 'th' ? 'วางรูปได้' : 'Paste Ready'}</span>
                      </span>
                    </label>
                  )}
                  <input
                    id="file-item-image"
                    type="file"
                    accept="image/*"
                    onChange={handleItemImageUpload}
                    className="hidden"
                  />
                  <input
                    id="file-item-image-replace"
                    type="file"
                    accept="image/*"
                    onChange={handleItemImageUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {/* 2. Name */}
              <div className="lg:col-span-3 space-y-4">
                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-300">
                      2. {t.itemName} *
                    </label>
                    {rememberedNames.length > 0 && (
                      <span className="text-[10px] text-amber-300/80 font-mono">
                        ✨ {t.recentNamesHint}
                      </span>
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
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#090d16] border border-slate-700 focus:border-[#d4af37] text-slate-100 text-sm focus:outline-none"
                  />

                  {/* Autocomplete Suggestions Dropdown */}
                  {showNameSuggestions && filteredNameSuggestions.length > 0 && (
                    <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-slate-900 border border-[#d4af37]/40 rounded-xl shadow-2xl p-1.5 max-h-48 overflow-y-auto space-y-1">
                      <div className="text-[10px] text-slate-400 font-semibold px-2 py-1 uppercase tracking-wider flex items-center gap-1 border-b border-slate-800">
                        <Sparkles className="w-3 h-3 text-[#f5d77f]" />
                        <span>{t.rememberedItemNames}</span>
                      </div>
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
                          className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-200 hover:text-white hover:bg-[#1f2b42] flex items-center justify-between transition cursor-pointer"
                        >
                          <span className="font-semibold truncate">{suggestionName}</span>
                          <span className="text-[9px] text-[#f5d77f] font-mono shrink-0 ml-2">
                            {lang === 'th' ? 'เลือก' : 'Use'} ↵
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* 3. Price (Diamonds) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      3. {t.itemPrice} *
                    </label>
                    <div className="relative">
                      <Gem className="w-4 h-4 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.7)] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="input-vault-price"
                        type="number"
                        min="0"
                        required
                        placeholder={lang === 'th' ? 'ระบุราคา (เพชร)' : 'Price (Diamonds)'}
                        value={price}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPrice(val === '' ? '' : Math.max(0, Number(val)));
                        }}
                        className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#090d16] border border-slate-700 focus:border-[#d4af37] text-slate-100 text-sm font-mono focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* 4. Quantity (จำนวนชิ้น) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      4. {t.itemQuantity} *
                    </label>
                    <div className="relative">
                      <Layers className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="input-vault-quantity"
                        type="number"
                        min="1"
                        required
                        placeholder={t.itemQuantityPlaceholder}
                        value={quantity}
                        onChange={(e) => {
                          const val = e.target.value;
                          setQuantity(val === '' ? '' : Math.max(1, parseInt(val, 10) || 1));
                        }}
                        className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#090d16] border border-slate-700 focus:border-[#d4af37] text-slate-100 text-sm font-mono focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* 5. Min Power Level */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      5. {t.itemMinPower} *
                    </label>
                    <div className="relative">
                      <Zap className="w-4 h-4 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="input-vault-minpower"
                        type="number"
                        min="0"
                        required
                        placeholder={lang === 'th' ? 'ระบุพลังขั้นต่ำ (PL)' : 'Min PL required'}
                        value={minPowerLevel}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMinPowerLevel(val === '' ? '' : Math.max(0, Number(val)));
                        }}
                        className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#090d16] border border-slate-700 focus:border-[#d4af37] text-slate-100 text-sm font-mono focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* 6. Rarity: RARE (blue), Epic (red), LAGEND (purple), MYTHIC (gold) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      6. {t.itemRarity} *
                    </label>
                    <select
                      id="select-vault-rarity"
                      value={rarity}
                      onChange={(e) => setRarity(e.target.value as ItemRarity)}
                      className="w-full px-3 py-2 rounded-lg bg-[#090d16] border border-slate-700 focus:border-[#d4af37] text-slate-100 text-sm focus:outline-none cursor-pointer"
                    >
                      <option value="RARE">{t.rarityRare}</option>
                      <option value="EPIC">{t.rarityEpic}</option>
                      <option value="LAGEND">{t.rarityLegend}</option>
                      <option value="MYTHIC">{t.rarityMythic}</option>
                    </select>
                  </div>
                </div></div>

            </div>

            {/* Grid 2: 6. OCR Hunter Scanner & Clan Matcher */}
            <div className="p-5 rounded-xl bg-[#090d16] border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Scan className="w-4 h-4 text-[#38bdf8]" />
                    <span>7. {t.huntersOcr}</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {t.uploadHunterOcrDesc}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {isOwner ? (
                    <button
                      type="button"
                      onClick={() => {
                        sounds.playClick();
                        setShowGeminiModal(true);
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer shadow-sm ${
                        geminiConfigured
                          ? 'bg-emerald-950/40 border-emerald-500/40 hover:border-emerald-400 text-emerald-300'
                          : 'bg-amber-950/40 border-amber-500/50 hover:border-amber-400 text-amber-300 animate-pulse'
                      }`}
                      title={lang === 'th' ? 'ตั้งค่า Google Gemini API Key สำหรับ AI OCR (เฉพาะ Owner)' : 'Configure Google Gemini API Key for AI OCR (Owner Only)'}
                    >
                      <Cpu className="w-3.5 h-3.5 text-[#38bdf8]" />
                      <span>
                        {geminiConfigured
                          ? lang === 'th' ? 'Gemini AI: เชื่อมต่อแล้ว' : 'Gemini AI: Connected'
                          : lang === 'th' ? '⚠️ ตั้งค่า Gemini Key' : '⚠️ Set Gemini Key'}
                      </span>
                    </button>
                  ) : (
                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold shadow-sm ${
                        geminiConfigured
                          ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400'
                          : 'bg-amber-950/30 border-amber-500/30 text-amber-400'
                      }`}
                      title={lang === 'th' ? 'สถานะการเชื่อมต่อ AI OCR พร้อมใช้งานสำหรับแอดมินทุกคน' : 'AI OCR status ready for all Admins'}
                    >
                      <Cpu className="w-3.5 h-3.5 text-[#38bdf8]" />
                      <span>
                        {geminiConfigured
                          ? lang === 'th' ? 'Gemini AI: พร้อมใช้งาน' : 'Gemini AI: Ready'
                          : lang === 'th' ? 'Gemini AI: ยังไม่เชื่อมต่อ' : 'Gemini AI: Not Connected'}
                      </span>
                    </div>
                  )}

                  <label
                    tabIndex={0}
                    onPaste={handlePasteOcrZone}
                    htmlFor="file-ocr-upload"
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-white text-xs font-bold transition-all shrink-0 shadow-sm border outline-none ${canUseOcr ? 'bg-[#0284c7] hover:bg-[#0369a1] cursor-pointer border-sky-400/50 hover:border-sky-300' : 'bg-slate-700 cursor-not-allowed border-slate-600 opacity-60'}`}
                    title={lang === 'th' ? 'คลิกเลือกไฟล์ หรือกด Ctrl + V เพื่อวางภาพให้ AI สแกน' : 'Click to choose or Ctrl + V to paste & scan'}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{isScanningOCR ? t.uploadingAndScanning : lang === 'th' ? 'สแกน OCR (หรือ Ctrl+V วางภาพ)' : 'Scan OCR (or Ctrl+V)'}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-900 text-sky-200 border border-sky-600">
                      Ctrl + V
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
                </div>
              </div>

              {/* Gemini Key Missing Warning Banner */}
              {(!geminiConfigured || ocrErrorType === 'MISSING_API_KEY') && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-amber-950/40 border border-amber-500/50 text-amber-200 text-xs shadow-md">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{t.ocrMissingKeyWarning}</span>
                  </div>
                  {isOwner ? (
                    <button
                      type="button"
                      onClick={() => {
                        sounds.playClick();
                        setShowGeminiModal(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow cursor-pointer shrink-0"
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>{t.configureKeyBtn}</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-amber-300/80 font-medium shrink-0">
                      {t.geminiOwnerOnlyHint}
                    </span>
                  )}
                </div>
              )}

              {/* OCR Status Banner */}
              {dynamicOcrStatusMessage && (
                <div
                  className={`text-xs flex items-center gap-2 p-2.5 rounded-lg border ${
                    ocrErrorType === 'MISSING_API_KEY' || ocrErrorType === 'GEMINI_ERROR' || ocrErrorType === 'NETWORK_ERROR'
                      ? 'bg-red-950/40 border-red-800/40 text-red-300'
                      : 'bg-sky-950/40 border-sky-800/40 text-[#38bdf8]'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0 text-sky-400" />
                  <span className="flex-1">{dynamicOcrStatusMessage}</span>
                  {isOwner && ocrErrorType && (
                    <button
                      type="button"
                      onClick={() => setShowGeminiModal(true)}
                      className="px-2.5 py-1 rounded bg-sky-900/80 hover:bg-sky-800 text-sky-200 text-[11px] font-semibold border border-sky-600/50 shrink-0 cursor-pointer"
                    >
                      {lang === 'th' ? 'ตั้งค่า Key' : 'Configure Key'}
                    </button>
                  )}
                  {duplicatesRemovedCount !== null && duplicatesRemovedCount > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-medium shrink-0">
                      {lang === 'th' ? `ตัดชื่อซ้ำ ${duplicatesRemovedCount} คน` : `${duplicatesRemovedCount} dupes filtered`}
                    </span>
                  )}
                </div>
              )}

              {/* 7. Matched hunters grouped by Clan / Text View */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <label className="block text-xs font-semibold text-slate-300">
                      7. {t.scanResults} ({hunters.length} {lang === 'th' ? 'คน' : 'hunters'})
                    </label>

                    {/* View Mode Toggle (Cards vs Text) */}
                    <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#0e1422] border border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          sounds.playClick();
                          setHunterResultViewMode('cards');
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                          hunterResultViewMode === 'cards'
                            ? 'bg-sky-950/90 text-sky-300 border border-sky-600/60 shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                        title={t.viewAsCards}
                      >
                        <LayoutGrid className="w-3 h-3" />
                        <span>{t.viewAsCards}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          sounds.playClick();
                          setHunterResultViewMode('text');
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                          hunterResultViewMode === 'text'
                            ? 'bg-amber-950/90 text-amber-300 border border-amber-600/60 shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                        title={t.viewAsText}
                      >
                        <FileText className="w-3 h-3" />
                        <span>{t.viewAsText}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Copy All Button */}
                    {hunters.length > 0 && (
                      <button
                        type="button"
                        id="btn-copy-all-hunters"
                        onClick={() => handleCopyAllHunters()}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-950/70 hover:bg-emerald-900/90 border border-emerald-600/70 hover:border-emerald-500 text-emerald-300 hover:text-emerald-200 text-[11px] font-bold transition-all cursor-pointer shadow-sm"
                        title={lang === 'th' ? 'คัดลอกรายชื่อทั้งหมดลงคลิปบอร์ด' : 'Copy all hunter names to clipboard'}
                      >
                        {copiedHunters ? (
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

                    {hunters.length > 0 && (
                      <button
                        type="button"
                        id="btn-filter-duplicates"
                        onClick={handleFilterDuplicates}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-950/60 hover:bg-amber-900/80 border border-amber-600/60 hover:border-amber-500 text-amber-300 hover:text-amber-200 text-[11px] font-semibold transition-all cursor-pointer shadow-sm"
                        title={lang === 'th' ? 'ตรวจหาและลบรายชื่อผู้ล่าที่ซ้ำกันออก' : 'Check and filter out duplicate hunter names'}
                      >
                        <RotateCcw className="w-3 h-3 text-amber-400" />
                        <span>{t.filterDuplicatesBtn}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* NO HUNTERS FOUND EMPTY STATE */}
                {hunters.length === 0 ? (
                  <div className="p-4 rounded-lg bg-[#0e1422] border border-slate-800 text-center text-xs text-slate-500">
                    {t.noHuntersFound}
                  </div>
                ) : hunterResultViewMode === 'text' ? (
                  /* TEXT VIEW (Copyable format with Clan Separation) */
                  <div className="p-3.5 rounded-xl bg-[#0b101c] border border-amber-500/30 space-y-3 shadow-inner">
                    <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-slate-800">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-amber-400" />
                          <span>{t.viewAsText}</span>
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                          {hunters.length} {lang === 'th' ? 'คน' : 'names'}
                        </span>
                        {uniqueClansInHunters.length > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/60 border border-amber-800/50 text-amber-300 font-mono">
                            {uniqueClansInHunters.length} {t.clansCount}
                          </span>
                        )}
                      </div>

                      {/* Format selector: By Clan vs Plain vs Inline vs Comma */}
                      <div className="flex items-center gap-1 bg-[#111726] p-0.5 rounded-lg border border-slate-700 text-[11px] flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            sounds.playClick();
                            setHunterTextFormat('by-clan');
                          }}
                          className={`px-2.5 py-1 rounded transition-all cursor-pointer flex items-center gap-1 ${
                            hunterTextFormat === 'by-clan'
                              ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                          title={lang === 'th' ? 'แยกรายชื่อตามแคลน พร้อมหัวข้อแคลน' : 'Group list by clan with headers'}
                        >
                          <Layers className="w-3 h-3" />
                          <span>{t.formatByClan}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            sounds.playClick();
                            setHunterTextFormat('plain');
                          }}
                          className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                            hunterTextFormat === 'plain'
                              ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                          title={lang === 'th' ? 'แสดงเฉพาะชื่อตัวละคร' : 'Plain character names only'}
                        >
                          <span>{t.formatPlain}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            sounds.playClick();
                            setHunterTextFormat('inline');
                          }}
                          className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                            hunterTextFormat === 'inline'
                              ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                          title={lang === 'th' ? 'ชื่อพร้อมแคลนต่อท้าย' : 'Names with clan in parentheses'}
                        >
                          <span>{t.formatInline}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            sounds.playClick();
                            setHunterTextFormat('comma');
                          }}
                          className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                            hunterTextFormat === 'comma'
                              ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                          title={lang === 'th' ? 'คั่นด้วยจุลภาค เช่น Name1, Name2' : 'Comma separated: Name1, Name2'}
                        >
                          <span>{t.formatComma}</span>
                        </button>
                      </div>
                    </div>

                    {/* Clan Filter Tabs inside Text View (if multiple clans exist) */}
                    {uniqueClansInHunters.length > 1 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        <span className="text-[11px] text-slate-400 font-medium mr-1 flex items-center gap-1">
                          <Filter className="w-3 h-3 text-slate-400" />
                          <span>{lang === 'th' ? 'กรองแคลน:' : 'Filter Clan:'}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            sounds.playClick();
                            setTextClanFilter('all');
                          }}
                          className={`px-2.5 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                            textClanFilter === 'all'
                              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50'
                              : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-transparent'
                          }`}
                        >
                          {t.allClansFilter} ({hunters.length})
                        </button>
                        {uniqueClansInHunters.map((clanName) => {
                          const count = hunters.filter(
                            (h) => (cleanClanName(h.clan) || 'VoltZ').toLowerCase() === cleanClanName(clanName).toLowerCase()
                          ).length;
                          return (
                            <button
                              key={clanName}
                              type="button"
                              onClick={() => {
                                sounds.playClick();
                                setTextClanFilter(clanName);
                              }}
                              className={`px-2.5 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                                textClanFilter.toLowerCase() === clanName.toLowerCase()
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-transparent'
                              }`}
                            >
                              <span>{clanName}</span>
                              <span className="opacity-75">({count})</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Copyable Text Area */}
                    <div className="relative">
                      <textarea
                        readOnly
                        rows={Math.min(14, Math.max(6, (getFormattedHunterText().split('\n').length || 6) + 1))}
                        value={getFormattedHunterText()}
                        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                        className="w-full px-3.5 py-2.5 rounded-lg bg-[#070b13] border border-slate-800 hover:border-amber-500/50 text-xs font-mono text-slate-200 leading-relaxed focus:outline-none focus:border-amber-400 cursor-text resize-y shadow-inner select-all"
                        placeholder={lang === 'th' ? 'รายชื่อผู้ล่าจะแสดงที่นี่...' : 'Hunter names will appear here...'}
                      />
                      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopyAllHunters()}
                          className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 hover:text-amber-200 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                        >
                          {copiedHunters ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-300">{lang === 'th' ? 'คัดลอกแล้ว!' : 'Copied!'}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-amber-300" />
                              <span>{t.copyAllHunters}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Quick Clan Copy Buttons Row (when multiple clans are present) */}
                    {uniqueClansInHunters.length > 1 && textClanFilter === 'all' && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-800/80">
                        <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                          <Copy className="w-3 h-3 text-amber-400" />
                          <span>{lang === 'th' ? 'คัดลอกด่วนแยกแคลน:' : 'Quick Copy Clan:'}</span>
                        </span>
                        {uniqueClansInHunters.map((clanName) => (
                          <button
                            key={clanName}
                            type="button"
                            onClick={() => handleCopyAllHunters('plain', clanName)}
                            className="px-2 py-0.5 rounded bg-slate-800/80 hover:bg-amber-950/40 border border-slate-700 hover:border-amber-600/50 text-slate-300 hover:text-amber-300 text-[10px] font-medium transition-all cursor-pointer flex items-center gap-1"
                            title={lang === 'th' ? `คัดลอกเฉพาะรายชื่อของ ${clanName}` : `Copy names of ${clanName}`}
                          >
                            <Copy className="w-2.5 h-2.5" />
                            <span>{clanName}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* CARDS VIEW */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(groupedHunters).map(([clanName, memberNames]: [string, string[]]) => (
                      <div
                        key={clanName}
                        className="p-3 rounded-lg bg-[#0e1524] border border-[#38bdf8]/40 shadow-sm"
                      >
                        <div className="text-xs font-bold text-amber-300 font-mono border-b border-slate-700/80 pb-1.5 mb-2 flex items-center justify-between">
                          <span>{clanName}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({memberNames.length} {lang === 'th' ? 'คน' : 'hunters'})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const text = memberNames.join('\n');
                                navigator.clipboard.writeText(text);
                                sounds.playClaim();
                                setCopiedHunters(true);
                                setTimeout(() => setCopiedHunters(false), 2000);
                              }}
                              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
                              title={lang === 'th' ? `คัดลอกเฉพาะ ${clanName}` : `Copy ${clanName} only`}
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div className="space-y-1">
                          {memberNames.map((mName, idx) => (
                            <div
                              key={idx}
                              className="text-xs text-slate-200 font-medium flex items-center justify-between py-0.5 px-1 rounded bg-[#090d16]"
                            >
                              <span>{mName}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const targetIndex = hunters.findIndex(
                                    (h) => (cleanClanName(h.clan) || 'VoltZ') === (cleanClanName(clanName) || 'VoltZ') && h.name === mName
                                  );
                                  if (targetIndex >= 0) handleRemoveHunter(targetIndex);
                                }}
                                className="text-slate-500 hover:text-red-400 text-xs px-1 cursor-pointer"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* INTERACTIVE MEMBER CHECKLIST & SELECTOR (No typing needed) */}
                <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-amber-300">
                          {t.hunterChecklistTitle}
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          {t.hunterChecklistDesc}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-amber-950/60 border border-amber-600/50 text-amber-300 font-semibold">
                        {hunters.length} / {activeMembersList.length} {t.selectedHuntersCount}
                      </span>
                    </div>
                  </div>

                  {/* Search, Clan Filter Tabs & Batch Select/Deselect */}
                  <div className="p-3 rounded-xl bg-[#0e1422] border border-slate-800/80 space-y-2.5">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                      {/* Search input */}
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
                            ×
                          </button>
                        )}
                      </div>

                      {/* Batch Action Buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          id="btn-checklist-select-all"
                          onClick={handleSelectAllFiltered}
                          className="px-2.5 py-1.5 rounded-lg bg-sky-950/70 hover:bg-sky-900 border border-sky-600/50 hover:border-sky-500 text-sky-300 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                          title={lang === 'th' ? 'เลือกสมาชิกที่แสดงอยู่ทั้งหมด' : 'Select all currently filtered members'}
                        >
                          <CheckSquare className="w-3.5 h-3.5" />
                          <span>{t.selectAllMembers}</span>
                        </button>
                        <button
                          type="button"
                          id="btn-checklist-deselect-all"
                          onClick={handleDeselectAllFiltered}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                          title={lang === 'th' ? 'ยกเลิกการเลือกสมาชิกที่แสดงอยู่' : 'Deselect currently filtered members'}
                        >
                          <Square className="w-3.5 h-3.5" />
                          <span>{t.deselectAllMembers}</span>
                        </button>
                      </div>
                    </div>

                    {/* Clan Filter Tabs */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                      <button
                        type="button"
                        onClick={() => setHunterClanFilter('all')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer shrink-0 ${
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
                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
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

                  {/* 2-Channel Clan Layout (แสดงพร้อมกัน 2 ช่อง แยกแคลน) */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
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
                            {/* Clan Column Header */}
                            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span className="text-xs font-bold text-amber-300 truncate">{clanName}</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono shrink-0">
                                  {selectedInThisClan} / {cMembers.length}
                                </span>
                              </div>

                              {/* Quick Clan Action Buttons */}
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
                                  className="px-2 py-0.5 rounded bg-sky-950/80 hover:bg-sky-900 border border-sky-600/50 text-sky-300 text-[10px] font-semibold transition-all cursor-pointer shadow-sm"
                                  title={lang === 'th' ? `เลือกสมาชิก ${clanName} ทั้งหมด` : `Select all ${clanName}`}
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
                                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[10px] font-semibold transition-all cursor-pointer shadow-sm"
                                  title={lang === 'th' ? `ล้างที่เลือกใน ${clanName}` : `Clear ${clanName}`}
                                >
                                  {t.clearEntireClan}
                                </button>
                              </div>
                            </div>

                            {/* Compact Member Cards Grid inside this Clan Box */}
                            <div className="max-h-[360px] overflow-y-auto pr-1 space-y-1.5 custom-scrollbar flex-1">
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
                                        className={`px-2 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 select-none hover:scale-[1.01] active:scale-[0.99] ${
                                          isSelected
                                            ? 'bg-[#d4af37]/20 border-[#d4af37] text-amber-200 shadow-[0_0_8px_rgba(212,175,55,0.2)]'
                                            : 'bg-[#060a12] border-slate-800/80 hover:border-slate-700 text-slate-300 hover:bg-[#0c1220]'
                                        }`}
                                      >
                                        {/* Compact Checkbox */}
                                        <div
                                          className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border transition-all ${
                                            isSelected
                                              ? 'bg-[#d4af37] border-[#d4af37] text-slate-950 font-bold'
                                              : 'border-slate-600 bg-[#141b2b]'
                                          }`}
                                        >
                                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                        </div>

                                        {/* Name and Power in 1 line */}
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
              </div>
            </div>

            {/* Grid 3: Multiple Backup Hunter Screenshots Upload */}
            <div className="p-5 rounded-xl bg-[#090d16] border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-200 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-purple-400" />
                    <span>{t.addScreenshotFiles}</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {t.screenshotAttachedInfo}
                  </p>
                </div>

                <label
                  tabIndex={0}
                  onPaste={handlePasteBackupScreenshotsZone}
                  htmlFor="file-multiple-screenshots"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1b263b] hover:bg-[#253552] border border-dashed border-[#d4af37]/50 hover:border-[#d4af37] text-xs font-medium text-slate-200 cursor-pointer transition-all shrink-0 outline-none"
                  title={lang === 'th' ? 'คลิกเลือกไฟล์ หรือกด Ctrl + V เพื่อวางรูปหลักฐาน' : 'Click to choose or Ctrl + V to paste proof'}
                >
                  <Upload className="w-3.5 h-3.5 text-[#f5d77f]" />
                  <span>{lang === 'th' ? 'แนบสกรีนช็อต (หรือ Ctrl+V)' : 'Upload Screenshots (or Ctrl+V)'}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-amber-300 border border-slate-700">
                    Ctrl + V
                  </span>
                  <input
                    id="file-multiple-screenshots"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleBackupScreenshotsUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Thumbnails of attached screenshots */}
              {hunterScreenshots.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-[#0e1626] border border-sky-500/30">
                    <div className="flex items-center gap-2 text-xs text-sky-200">
                      <ImageIcon className="w-4 h-4 text-sky-400 shrink-0" />
                      <span>
                        {lang === 'th'
                          ? `แนบรูปภาพหลักฐานแล้ว ${hunterScreenshots.length} รูป`
                          : `${hunterScreenshots.length} screenshot(s) attached`}
                      </span>
                    </div>
                    <button
                      type="button"
                      id="btn-scan-attached-screenshots"
                      disabled={isScanningOCR || !canUseOcr}
                      onClick={scanExistingScreenshots}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                      title={lang === 'th' ? 'สั่งให้ AI OCR สแกนชื่อคนล่าจากภาพที่แนบไว้เหล่านี้ทันที' : 'Scan hunters from these attached images'}
                    >
                      <Scan className="w-3.5 h-3.5" />
                      <span>
                        {isScanningOCR
                          ? t.uploadingAndScanning
                          : lang === 'th'
                          ? `🔍 สแกนผู้ล่าจากรูปที่แนบอยู่นี้ (${hunterScreenshots.length} รูป)`
                          : `🔍 Scan Hunters from attached images (${hunterScreenshots.length})`}
                      </span>
                    </button>
                  </div>

                  <div className="flex items-center gap-3 overflow-x-auto p-2 rounded-lg bg-[#0a0f19] border border-slate-800">
                    {hunterScreenshots.map((shot, idx) => (
                      <div key={idx} className="relative group shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-slate-700">
                        <img
                          src={shot}
                          alt={`Screenshot ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 transition-opacity">
                          <button
                            type="button"
                            onClick={() => onViewImageZoom(shot, `Proof #${idx + 1}`, hunterScreenshots, idx)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-white"
                            title="Zoom"
                          >
                            <ZoomIn className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveScreenshot(idx)}
                            className="p-1 rounded bg-red-900 hover:bg-red-800 text-white"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Form Submit Button */}
            <div className="flex justify-end pt-2">
              <button
                id="btn-submit-create-item"
                type="submit"
                disabled={isCreating}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#d4af37] via-[#e5be49] to-[#aa841c] hover:brightness-110 text-slate-950 font-bold text-sm shadow-xl shadow-amber-950/40 transition-all cursor-pointer disabled:opacity-50"
              >
                {isCreating ? t.loading : t.addNewItem}
              </button>
            </div>

          </form>

        </div>
      )}

      {/* VIEW 2: DISTRIBUTED ITEMS SECTION (ไอเทมที่แจกแล้ว เก็บแยกต่างหาก แสดงตารางแนวนอน) */}
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
            {currentUser?.role === 'owner' && onOpenOwnerResetModal && (
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

          {distributedItems.length === 0 ? (
            <div className="p-10 rounded-xl bg-[#0c121e] border border-slate-800 text-center text-xs text-slate-500">
              {t.noDistributedItems}
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
                  {distributedItems.map((item) => (
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
                          className="w-12 h-12 rounded-lg overflow-hidden border border-slate-700 hover:border-[#38bdf8] bg-slate-900 shrink-0 cursor-pointer group/itemimg relative transition-all hover:scale-105 block"
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
                      <td className="py-3 px-4 font-bold text-slate-100">
                        {item.name}
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

                      {/* 4. Price */}
                      <td className="py-3 px-4 font-mono text-white font-bold drop-shadow-[0_0_4px_rgba(255,255,255,0.3)]">
                        {item.price.toLocaleString()} {t.diamonds}
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
                        {item.hunterScreenshots && item.hunterScreenshots.length > 0 ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {item.hunterScreenshots.map((shot, idx) => (
                                <button
                                  key={idx}
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
                                  className="relative group/shot w-11 h-11 rounded-lg overflow-hidden border border-slate-700 hover:border-sky-400 bg-slate-900 transition-all hover:scale-110 shadow-md cursor-pointer shrink-0"
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
                        ) : (
                          <span className="text-slate-600 text-[11px] italic">
                            {lang === 'th' ? 'ไม่มีรูปผู้ล่า' : 'No proof attached'}
                          </span>
                        )}
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

                          {/* Attach receipt button for Admin/Owner */}
                          {isAdminOrOwner && (
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

                          {(!item.receiptImages || item.receiptImages.length === 0) && !isAdminOrOwner && (
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
                <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 shrink-0">
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
                    <span className="text-xs font-mono text-white font-bold drop-shadow-[0_0_4px_rgba(255,255,255,0.3)]">
                      {viewingDistributedHuntersItem.price.toLocaleString()} {t.diamonds}
                    </span>
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
