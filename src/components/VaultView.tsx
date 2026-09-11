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
  ExternalLink
} from 'lucide-react';
import {
  HunterRecord,
  ItemRarity,
  Language,
  QuickItem,
  User,
  VaultItem
} from '../types';
import { translations } from '../translations';
import { sounds } from '../utils/sound';
import { compressImageFile } from '../utils/imageCompressor';
import { DistributionStatsModal } from './DistributionStatsModal';
import { GeminiKeyModal } from './GeminiKeyModal';

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
  const isAdminOrOwner =
    currentUser?.role === 'owner' ||
    currentUser?.role === 'admin' ||
    currentUser?.role === 'manager';

  // State for in-app deletion confirmation
  const [itemToDelete, setItemToDelete] = useState<VaultItem | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [minPowerLevel, setMinPowerLevel] = useState<number | ''>('');
  const [rarity, setRarity] = useState<ItemRarity>('LAGEND');
  const [itemImageUrl, setItemImageUrl] = useState('');
  const [itemImagePreview, setItemImagePreview] = useState('');
  
  // OCR & Hunters State
  const [hunters, setHunters] = useState<HunterRecord[]>([]);
  const [selectedHunterMemberId, setSelectedHunterMemberId] = useState('');
  const [customHunterName, setCustomHunterName] = useState('');
  const [customHunterClan, setCustomHunterClan] = useState('Clan:VoltZ');
  const [hunterScreenshots, setHunterScreenshots] = useState<string[]>([]);
  const [isScanningOCR, setIsScanningOCR] = useState(false);
  const [ocrStatusText, setOcrStatusText] = useState('');
  const [ocrErrorType, setOcrErrorType] = useState<string | null>(null);
  const [showGeminiModal, setShowGeminiModal] = useState(false);
  const [geminiConfigured, setGeminiConfigured] = useState<boolean>(false);
  const [geminiMaskedKey, setGeminiMaskedKey] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Check Gemini API status on mount
  useEffect(() => {
    const checkGeminiStatus = async () => {
      try {
        const res = await fetch('/api/gemini-status');
        const data = await res.json();
        const localKey = localStorage.getItem('k7_gemini_api_key');
        const isOk = Boolean(data.configured || (localKey && localKey.length > 10));
        setGeminiConfigured(isOk);
        if (data.maskedKey) {
          setGeminiMaskedKey(data.maskedKey);
        } else if (localKey) {
          setGeminiMaskedKey(`${localKey.slice(0, 6)}...${localKey.slice(-4)}`);
        }
      } catch {
        const localKey = localStorage.getItem('k7_gemini_api_key');
        if (localKey && localKey.length > 10) {
          setGeminiConfigured(true);
          setGeminiMaskedKey(`${localKey.slice(0, 6)}...${localKey.slice(-4)}`);
        }
      }
    };
    checkGeminiStatus();
  }, []);

  // Group active members by Clan for hunter dropdown selection
  const membersByClan = useMemo(() => {
    const groups: Record<string, User[]> = {};
    allMembers
      .filter((m) => m.status === 'active' && m.inGameName)
      .forEach((m) => {
        const clan = m.clan || 'No Clan';
        if (!groups[clan]) groups[clan] = [];
        groups[clan].push(m);
      });
    return groups;
  }, [allMembers]);

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
          clan: (h.clan || 'Clan:VoltZ').trim()
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
      setOcrStatusText(
        lang === 'th'
          ? `ตัดรายชื่อซ้ำออก ${removedCount} รายการ สำเร็จ`
          : `Filtered ${removedCount} duplicate hunter(s)`
      );
    } else {
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
    setIsScanningOCR(true);
    setOcrErrorType(null);
    setOcrStatusText(
      lang === 'th'
        ? `กำลังสแกนรายชื่อผู้ล่าจาก ${sourceCount} รูปภาพ${isPaste ? ' (จาก Ctrl + V)' : ''}...`
        : `Analyzing & scanning ${sourceCount} screenshot(s)${isPaste ? ' (from Ctrl + V)' : ''}...`
    );

    try {
      const localKey = localStorage.getItem('k7_gemini_api_key') || undefined;

      const response = await fetch('/api/scan-hunters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imagesBase64: base64Images,
          imageBase64: base64Images[0],
          customApiKey: localKey,
          knownMembers: allMembers.map((m) => ({
            inGameName: m.inGameName,
            clan: m.clan,
            powerLevel: m.powerLevel
          }))
        })
      });

      const data = await response.json();

      if (data.error === 'MISSING_API_KEY') {
        setOcrErrorType('MISSING_API_KEY');
        setGeminiConfigured(false);
        setOcrStatusText(
          lang === 'th'
            ? '⚠️ ยังไม่ได้ตั้งค่า Gemini API Key ทำให้ระบบ AI ไม่สามารถอ่านตัวหนังสือจากรูปได้'
            : '⚠️ Gemini API Key is not configured. AI cannot read text from screenshots.'
        );
        sounds.playError();
        return;
      }

      if (data.error === 'GEMINI_ERROR') {
        setOcrErrorType('GEMINI_ERROR');
        setOcrStatusText(`❌ ${data.message || (lang === 'th' ? 'เกิดข้อผิดพลาดจาก Gemini API' : 'Gemini API error')}`);
        sounds.playError();
        return;
      }

      if (data.success && data.detectedClanGroups && data.detectedClanGroups.length > 0) {
        setGeminiConfigured(true);
        const extractedHunters: HunterRecord[] = [];
        data.detectedClanGroups.forEach((group: { clanName: string; members: string[] }) => {
          group.members.forEach((memName: string) => {
            extractedHunters.push({
              name: memName,
              clan: group.clanName || 'Clan:VoltZ'
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
              clan: h.clan.trim() || 'Clan:VoltZ'
            });
          }
        }

        const totalDuplicatesFiltered = (data.duplicatesFilteredCount || 0) + duplicateCounter;
        setDuplicatesRemovedCount(totalDuplicatesFiltered);

        setHunters((prev) => [...prev, ...incomingUnique]);
        sounds.playClaim();

        setOcrStatusText(
          lang === 'th'
            ? `สแกนสำเร็จจาก ${sourceCount} รูปภาพ: พบผู้ล่าใหม่ ${incomingUnique.length} คน (กรองชื่อซ้ำออก ${totalDuplicatesFiltered} คน)`
            : `Scan successful from ${sourceCount} image(s): ${incomingUnique.length} new hunters added (${totalDuplicatesFiltered} duplicates filtered)`
        );
      } else {
        setOcrStatusText(
          lang === 'th'
            ? `สแกน ${sourceCount} รูปภาพแล้ว แต่ไม่พบรายชื่อผู้ล่าที่ตรงกับกิลด์ในระบบ สามารถเลือกจากดรอปดาวน์ด้านล่างได้`
            : `Scanned ${sourceCount} screenshot(s), but no matching clan members found. You can pick hunters from the dropdown below.`
        );
      }
    } catch (err: any) {
      console.error('OCR scanning error:', err);
      setOcrErrorType('NETWORK_ERROR');
      setOcrStatusText(
        lang === 'th'
          ? `เกิดข้อผิดพลาดในการเชื่อมต่อ: ${err.message || 'Network error'}`
          : `Network error scanning screenshots: ${err.message || 'Network error'}`
      );
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
    const finalClan = (overrideClan || customHunterClan).trim() || 'Clan:VoltZ';
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
        minPowerLevel: Number(minPowerLevel) || 0,
        rarity,
        imageUrl:
          itemImageUrl ||
          'https://images.unsplash.com/photo-1595590424283-b8f17842773f?w=400&auto=format&fit=crop&q=80',
        hunters: deduplicatedFinalHunters,
        hunterScreenshots
      });

      setFormSuccess(
        lang === 'th'
          ? 'เพิ่มไอเทมสำเร็จ!'
          : 'Item created!'
      );

      // Reset form
      setName('');
      setPrice('');
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

  // Group hunters by Clan (for matching display: Clan:VoltZ / Zenkaii, Clan:LevelS / DVD)
  const groupedHunters = hunters.reduce((acc, h) => {
    const clanKey = h.clan || 'Clan:VoltZ';
    if (!acc[clanKey]) acc[clanKey] = [];
    acc[clanKey].push(h.name);
    return acc;
  }, {} as Record<string, string[]>);

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
                        <span className="text-[10px] text-amber-300 font-mono">หรือกด Ctrl + V</span>
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
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    2. {t.itemName} *
                  </label>
                  <input
                    id="input-vault-name"
                    type="text"
                    required
                    placeholder="e.g. Imperial Crusader Armor"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#090d16] border border-slate-700 focus:border-[#d4af37] text-slate-100 text-sm focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* 3. Price (Diamonds) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      3. {t.itemPrice} *
                    </label>
                    <div className="relative">
                      <Gem className="w-4 h-4 text-[#38bdf8] absolute left-3 top-1/2 -translate-y-1/2" />
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

                  {/* 4. Min Power Level */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      4. {t.itemMinPower} *
                    </label>
                    <div className="relative">
                      <Zap className="w-4 h-4 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="input-vault-minpower"
                        type="number"
                        min="0"
                        required
                        placeholder={lang === 'th' ? 'ระบุพลังขั้นต่ำ (CP)' : 'Min CP required'}
                        value={minPowerLevel}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMinPowerLevel(val === '' ? '' : Math.max(0, Number(val)));
                        }}
                        className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#090d16] border border-slate-700 focus:border-[#d4af37] text-slate-100 text-sm font-mono focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* 5. Rarity: RARE (blue), Epic (red), LAGEND (purple), MYTHIC (gold) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      5. {t.itemRarity} *
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
                </div>
              </div>

            </div>

            {/* Grid 2: 6. OCR Hunter Scanner & Clan Matcher */}
            <div className="p-5 rounded-xl bg-[#090d16] border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Scan className="w-4 h-4 text-[#38bdf8]" />
                    <span>6. {t.huntersOcr}</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {t.uploadHunterOcrDesc}
                  </p>
                </div>

                <div className="flex items-center gap-2">
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
                    title={lang === 'th' ? 'ตั้งค่า Google Gemini API Key สำหรับ AI OCR' : 'Configure Google Gemini API Key for AI OCR'}
                  >
                    <Cpu className="w-3.5 h-3.5 text-[#38bdf8]" />
                    <span>
                      {geminiConfigured
                        ? lang === 'th' ? 'Gemini AI: เชื่อมต่อแล้ว' : 'Gemini AI: Connected'
                        : lang === 'th' ? '⚠️ ตั้งค่า Gemini Key' : '⚠️ Set Gemini Key'}
                    </span>
                  </button>

                  <label
                    tabIndex={0}
                    onPaste={handlePasteOcrZone}
                    htmlFor="file-ocr-upload"
                    className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold cursor-pointer transition-all shrink-0 shadow-sm border border-sky-400/50 hover:border-sky-300 outline-none"
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
                      disabled={isScanningOCR}
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
                </div>
              )}

              {/* OCR Status Banner */}
              {ocrStatusText && (
                <div
                  className={`text-xs flex items-center gap-2 p-2.5 rounded-lg border ${
                    ocrErrorType === 'MISSING_API_KEY' || ocrErrorType === 'GEMINI_ERROR' || ocrErrorType === 'NETWORK_ERROR'
                      ? 'bg-red-950/40 border-red-800/40 text-red-300'
                      : 'bg-sky-950/40 border-sky-800/40 text-[#38bdf8]'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0 text-sky-400" />
                  <span className="flex-1">{ocrStatusText}</span>
                  {ocrErrorType && (
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

              {/* Matched hunters grouped by Clan */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-300">
                    7. {t.scanResults} ({hunters.length} {lang === 'th' ? 'คน' : 'hunters'})
                  </label>

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
                
                {Object.keys(groupedHunters).length === 0 ? (
                  <div className="p-3 rounded-lg bg-[#0e1422] border border-slate-800 text-center text-xs text-slate-500">
                    {t.noHuntersFound}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(groupedHunters).map(([clanName, memberNames]: [string, string[]]) => (
                      <div
                        key={clanName}
                        className="p-3 rounded-lg bg-[#0e1524] border border-[#38bdf8]/40 shadow-sm"
                      >
                        <div className="text-xs font-bold text-amber-300 font-mono border-b border-slate-700/80 pb-1.5 mb-2 flex items-center justify-between">
                          <span>{clanName}</span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({memberNames.length} {lang === 'th' ? 'คน' : 'hunters'})
                          </span>
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
                                    (h) => h.clan === clanName && h.name === mName
                                  );
                                  if (targetIndex >= 0) handleRemoveHunter(targetIndex);
                                }}
                                className="text-slate-500 hover:text-red-400 text-xs px-1"
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

                {/* Dropdown Selector for Hunters (No typing needed) */}
                <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-amber-300 font-bold">
                    <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t.selectHunterDropdown}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      id="select-vault-hunter-dropdown"
                      value={selectedHunterMemberId}
                      onChange={(e) => {
                        const mId = e.target.value;
                        setSelectedHunterMemberId(mId);
                        const mem = allMembers.find((m) => m.id === mId);
                        if (mem) {
                          setCustomHunterName(mem.inGameName);
                          setCustomHunterClan(mem.clan);
                        } else {
                          setCustomHunterName('');
                          setCustomHunterClan('');
                        }
                      }}
                      className="flex-1 min-w-[240px] px-3 py-2 rounded-lg bg-[#111726] border border-amber-500/50 hover:border-amber-400 text-xs text-slate-100 focus:border-[#d4af37] focus:outline-none cursor-pointer"
                    >
                      <option value="">
                        {lang === 'th'
                          ? '-- คลิกเลือกชื่อคนล่าจากดรอปดาวน์ (ไม่ต้องพิมพ์) --'
                          : '-- Select hunter from dropdown (No typing) --'}
                      </option>
                      {(Object.entries(membersByClan) as [string, User[]][]).map(([clanName, members]) => (
                        <optgroup key={clanName} label={`🛡️ ${clanName} (${members.length} คน)`}>
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.inGameName} | {m.clan} {m.powerLevel ? `(${(m.powerLevel).toLocaleString()} CP)` : ''}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>

                    <button
                      type="button"
                      id="btn-add-hunter-from-dropdown"
                      disabled={!customHunterName}
                      onClick={() => handleAddManualHunter()}
                      className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 text-xs font-bold text-slate-950 transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{lang === 'th' ? 'เพิ่มคนล่า' : 'Add Hunter'}</span>
                    </button>
                  </div>

                  {customHunterName && (
                    <div className="flex items-center gap-2 text-[11px] text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{lang === 'th' ? 'เลือกแล้ว:' : 'Selected:'} <strong>{customHunterName}</strong> ({customHunterClan})</span>
                    </div>
                  )}
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
                      disabled={isScanningOCR}
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
                    <th className="py-3 px-4">{t.itemRarity}</th>
                    <th className="py-3 px-4">{t.itemPrice}</th>
                    <th className="py-3 px-4">{t.distributedTo}</th>
                    <th className="py-3 px-4">{t.distributedDate}</th>
                    <th className="py-3 px-4 min-w-[170px]">{lang === 'th' ? 'รูปรายชื่อผู้ล่า' : 'Hunter Proofs'}</th>
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

                      {/* 3. Rarity */}
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${getRarityBadge(item.rarity)}`}>
                          {item.rarity}
                        </span>
                      </td>

                      {/* 4. Price */}
                      <td className="py-3 px-4 font-mono text-[#38bdf8] font-bold">
                        {item.price.toLocaleString()} {t.diamonds}
                      </td>

                      {/* 5. Distributed To */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-200">
                          {item.distributedTo?.name || 'Unknown'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {item.distributedTo?.clan || 'No Clan'}
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
                            <div className="flex items-center gap-1 text-[10px] text-slate-400">
                              <span className="text-sky-400 font-mono font-semibold">
                                {item.hunterScreenshots.length} {lang === 'th' ? 'รูป' : 'imgs'}
                              </span>
                              {item.hunters && item.hunters.length > 0 && (
                                <>
                                  <span>•</span>
                                  <span>{item.hunters.length} {lang === 'th' ? 'ผู้ล่า' : 'hunters'}</span>
                                </>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-[11px] italic">
                            {lang === 'th' ? 'ไม่มีรูปผู้ล่า' : 'No proof attached'}
                          </span>
                        )}
                      </td>

                      {/* 8. Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          
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

      {/* GEMINI AI KEY MODAL */}
      <GeminiKeyModal
        isOpen={showGeminiModal}
        onClose={() => setShowGeminiModal(false)}
        lang={lang}
        onKeySaved={(newKey) => {
          setGeminiConfigured(true);
          setGeminiMaskedKey(`${newKey.slice(0, 6)}...${newKey.slice(-4)}`);
          setOcrErrorType(null);
        }}
      />

    </div>
  );
};
