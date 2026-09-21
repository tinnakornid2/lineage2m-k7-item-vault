import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Edit2,
  Check,
  Upload,
  Gem,
  Zap,
  Shield,
  Layers,
  Sparkles,
  Camera,
  Trash2,
  ZoomIn,
  AlertCircle,
  Clock,
  CheckCircle2,
  Users,
  Plus,
  MessageSquare
} from 'lucide-react';
import {
  ItemRarity,
  Language,
  QuickItem,
  User,
  VaultItem,
  HunterRecord,
  cleanClanName
} from '../types';
import { translations } from '../translations';
import { sounds } from '../utils/sound';
import { compressImageFile } from '../utils/imageCompressor';

interface EditVaultItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  currentUser: User | null;
  item: VaultItem | null;
  allMembers?: User[];
  quickItems?: QuickItem[];
  vaultItems?: VaultItem[];
  onUpdateItem: (itemId: string, updates: Partial<VaultItem>) => Promise<void>;
  onViewImageZoom?: (url: string, title?: string) => void;
  onBroadcastToDiscord?: (item: VaultItem) => Promise<void>;
}

export const EditVaultItemModal: React.FC<EditVaultItemModalProps> = ({
  isOpen,
  onClose,
  lang,
  currentUser,
  item,
  allMembers = [],
  quickItems = [],
  vaultItems = [],
  onUpdateItem,
  onViewImageZoom,
  onBroadcastToDiscord
}) => {
  const t = translations[lang];
  const isOwner = currentUser?.role === 'owner';
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [price, setPrice] = useState<number | ''>(0);
  const [quantity, setQuantity] = useState<number | ''>(1);
  const [minPowerLevel, setMinPowerLevel] = useState<number | ''>(0);
  const [rarity, setRarity] = useState<ItemRarity>('LAGEND');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [hunters, setHunters] = useState<HunterRecord[]>([]);
  const [hunterScreenshots, setHunterScreenshots] = useState<string[]>([]);

  // Hunter add helper
  const [selectedHunterMemberId, setSelectedHunterMemberId] = useState('');
  const [customHunterName, setCustomHunterName] = useState('');
  const [customHunterClan, setCustomHunterClan] = useState('VoltZ');

  // Name suggestions state
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Status state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Sync form when item changes or modal opens
  useEffect(() => {
    if (isOpen && item) {
      setName(item.name || '');
      setPrice(typeof item.price === 'number' ? item.price : 0);
      setQuantity(item.quantity || 1);
      setMinPowerLevel(item.minPowerLevel || 0);
      setRarity(item.rarity || 'LAGEND');
      setImageUrl(item.imageUrl || '');
      setImagePreview(item.imageUrl || '');
      setHunters(item.hunters || []);
      setHunterScreenshots(item.hunterScreenshots || []);
      setError('');
      setSuccessToast('');
    }
  }, [isOpen, item]);

  // Remembered item names aggregator (from current vault, quick items, and localStorage)
  const rememberedNames = useMemo(() => {
    const namesSet = new Set<string>();

    // 1. From active and historical vault items
    vaultItems.forEach((i) => {
      if (i.name && i.name.trim()) namesSet.add(i.name.trim());
    });

    // 2. From quick items
    quickItems.forEach((q) => {
      if (q.name && q.name.trim()) namesSet.add(q.name.trim());
    });

    // 3. From localStorage
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

  // Filter suggestions matching current input
  const filteredNameSuggestions = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (!q) return rememberedNames.slice(0, 8);
    return rememberedNames
      .filter((n) => n.toLowerCase().includes(q) && n.toLowerCase() !== q)
      .slice(0, 8);
  }, [rememberedNames, name]);

  // Handle Ctrl+V paste for item image
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      // Don't intercept paste if typing inside text input / textarea
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') {
        return;
      }

      if (!e.clipboardData) return;
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            compressImageFile(blob, { maxWidth: 600, maxHeight: 600, quality: 0.85 })
              .then((base64) => {
                setImageUrl(base64);
                setImagePreview(base64);
                sounds.playClick();
                setSuccessToast(lang === 'th' ? 'วางรูปภาพไอเทมจาก Clipboard แล้ว' : 'Item image pasted from clipboard');
                setTimeout(() => setSuccessToast(''), 3000);
              })
              .catch((err) => {
                console.error('Failed to process pasted image:', err);
              });
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, lang]);

  // Handle image upload from file picker
  const handleItemImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await compressImageFile(file, { maxWidth: 600, maxHeight: 600, quality: 0.85 });
      setImageUrl(base64);
      setImagePreview(base64);
      sounds.playClick();
    } catch (err) {
      console.error('Failed to upload image:', err);
      setError(lang === 'th' ? 'อัปโหลดรูปภาพไม่สำเร็จ' : 'Failed to upload image');
    }
  };

  // Handle backup screenshots upload
  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const compressedList = await Promise.all(
        (Array.from(files) as File[]).map((f) =>
          compressImageFile(f, { maxWidth: 1280, maxHeight: 1280, quality: 0.75 })
        )
      );
      setHunterScreenshots((prev) => [...prev, ...compressedList].slice(0, 8));
      sounds.playClick();
    } catch (err) {
      console.error('Failed to process screenshot:', err);
    }
  };

  // Add a hunter from active members dropdown
  const handleAddHunterFromMember = () => {
    if (!selectedHunterMemberId) return;
    const member = allMembers.find((m) => m.id === selectedHunterMemberId);
    if (!member || !member.inGameName) return;

    const nameKey = member.inGameName.trim().toLowerCase();
    if (hunters.some((h) => h.name.trim().toLowerCase() === nameKey)) {
      setError(lang === 'th' ? 'มีชื่อผู้ล่าคนนี้อยู่ในรายการแล้ว' : 'This hunter is already in the list');
      return;
    }

    setHunters((prev) => [
      ...prev,
      {
        name: member.inGameName.trim(),
        clan: cleanClanName(member.clan) || 'VoltZ'
      }
    ]);
    setSelectedHunterMemberId('');
    setError('');
    sounds.playClick();
  };

  // Add a custom hunter
  const handleAddCustomHunter = () => {
    const cleanName = customHunterName.trim();
    if (!cleanName) return;

    const nameKey = cleanName.toLowerCase();
    if (hunters.some((h) => h.name.trim().toLowerCase() === nameKey)) {
      setError(lang === 'th' ? 'มีชื่อผู้ล่าคนนี้อยู่ในรายการแล้ว' : 'This hunter is already in the list');
      return;
    }

    setHunters((prev) => [
      ...prev,
      {
        name: cleanName,
        clan: cleanClanName(customHunterClan) || 'VoltZ'
      }
    ]);
    setCustomHunterName('');
    setError('');
    sounds.playClick();
  };

  // Remove individual hunter
  const handleRemoveHunter = (index: number) => {
    setHunters((prev) => prev.filter((_, i) => i !== index));
    sounds.playClick();
  };

  // Remove individual screenshot
  const handleRemoveScreenshot = (index: number) => {
    setHunterScreenshots((prev) => prev.filter((_, i) => i !== index));
    sounds.playClick();
  };

  // Form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(lang === 'th' ? 'กรุณาระบุชื่อไอเทม' : 'Item name is required');
      sounds.playError();
      return;
    }

    if (!imageUrl) {
      setError(lang === 'th' ? 'กรุณาเลือกหรือวางรูปภาพไอเทม' : 'Please upload or paste an item image');
      sounds.playError();
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      const numericPrice = typeof price === 'number' ? Math.max(0, price) : 0;
      const numericQty = typeof quantity === 'number' ? Math.max(1, quantity) : 1;
      const numericPower = typeof minPowerLevel === 'number' ? Math.max(0, minPowerLevel) : 0;

      await onUpdateItem(item.id, {
        name: trimmedName,
        price: numericPrice,
        quantity: numericQty,
        minPowerLevel: numericPower,
        rarity,
        imageUrl,
        hunters,
        hunterScreenshots
      });

      // Save trimmed name to localStorage for future autocomplete
      try {
        const stored = localStorage.getItem('l2m_recent_item_names');
        const list: string[] = stored ? JSON.parse(stored) : [];
        const updated = [trimmedName, ...list.filter((n) => n.toLowerCase() !== trimmedName.toLowerCase())].slice(0, 30);
        localStorage.setItem('l2m_recent_item_names', JSON.stringify(updated));
      } catch {
        // ignore
      }

      sounds.playClaim();
      onClose();
    } catch (err: any) {
      console.error('Failed to update vault item:', err);
      setError(err?.message || (lang === 'th' ? 'บันทึกการแก้ไขไม่สำเร็จ' : 'Failed to update item'));
      sounds.playError();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-gradient-to-b from-[#131b2c] via-[#0d1424] to-[#070b14] border border-[#d4af37]/40 shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#090e1a]/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#d4af37]/15 text-[#f5d77f] border border-[#d4af37]/30">
              <Edit2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-cinzel text-white flex items-center gap-2">
                <span>{t.editItemTitle}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  {item.name}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {t.editItemDesc}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="mx-5 mt-3 p-2.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError('')} className="text-red-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {successToast && (
          <div className="mx-5 mt-3 p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* Grid 1: Basic Info & Image */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* 1. Item Image Preview & Upload */}
            <div className="sm:col-span-1 space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                1. {t.itemImage} <span className="text-rose-400">*</span>
              </label>

              <div className="relative group rounded-xl overflow-hidden border border-slate-700 bg-slate-950 flex flex-col items-center justify-center min-h-[140px] text-center p-2">
                {imagePreview ? (
                  <>
                    <img
                      src={imagePreview}
                      alt="Item Preview"
                      className="w-full h-40 object-contain bg-black/40 rounded-lg p-1"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 transition-opacity">
                      <label
                        htmlFor="edit-file-item-image"
                        className="px-3 py-1 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold cursor-pointer transition shadow"
                      >
                        {t.chooseImage}
                      </label>
                      <span className="text-[10px] text-slate-300 font-mono">
                        Ctrl+V {lang === 'th' ? 'วางภาพได้' : 'Paste'}
                      </span>
                    </div>
                  </>
                ) : (
                  <label
                    htmlFor="edit-file-item-image"
                    className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-4 text-slate-400 hover:text-slate-200 transition"
                  >
                    <Upload className="w-6 h-6 text-[#d4af37] mb-1" />
                    <span className="text-xs font-semibold text-slate-300">{t.chooseImage}</span>
                    <span className="text-[10px] text-amber-300 font-mono mt-1">Ctrl + V</span>
                  </label>
                )}
                <input
                  id="edit-file-item-image"
                  type="file"
                  accept="image/*"
                  onChange={handleItemImageUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* 2. Item Details (Name, Price, Quantity, Power, Rarity) */}
            <div className="sm:col-span-2 space-y-3.5">
              
              {/* Item Name with Autocomplete / Remembered suggestions */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    2. {t.itemName} <span className="text-rose-400">*</span>
                  </label>
                  {rememberedNames.length > 0 && (
                    <span className="text-[10px] text-amber-300/80 font-mono">
                      ✨ {t.recentNamesHint}
                    </span>
                  )}
                </div>

                <input
                  ref={nameInputRef}
                  id="edit-input-item-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setShowNameSuggestions(true);
                  }}
                  onFocus={() => setShowNameSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowNameSuggestions(false), 200)}
                  placeholder="e.g. Imperial Crusader Armor"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37]/50 text-white text-sm font-semibold focus:outline-none"
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

              {/* Price, Quantity, Power, Rarity Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                
                {/* Quantity */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    {t.itemQuantity}
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantity}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setQuantity(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:border-[#d4af37] focus:outline-none"
                  />
                </div>

                {/* Price (0 = Free) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-300">
                      {t.itemPrice}
                    </label>
                    {price === 0 && (
                      <span className="text-[9px] text-emerald-400 font-bold">🎁 {t.freeBadge || (lang === 'th' ? 'ฟรี' : 'Free')}</span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      required
                      placeholder={lang === 'th' ? '0 = ฟรี' : '0 = Free'}
                      value={price}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setPrice(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-full pl-2 pr-6 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:border-[#d4af37] focus:outline-none"
                    />
                    <span className="absolute right-2 top-2 text-[11px] text-slate-400">💎</span>
                  </div>
                </div>

                {/* Min Power Level */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    {t.itemMinPower}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      required
                      value={minPowerLevel}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setMinPowerLevel(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-full pl-2 pr-6 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:border-[#d4af37] focus:outline-none"
                    />
                    <span className="absolute right-2 top-2 text-[10px] text-amber-400 font-mono">PL</span>
                  </div>
                </div>

                {/* Rarity */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    {t.itemRarity}
                  </label>
                  <select
                    value={rarity}
                    onChange={(e) => setRarity(e.target.value as ItemRarity)}
                    className="w-full px-2 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs focus:border-[#d4af37] focus:outline-none cursor-pointer"
                  >
                    <option value="RARE">{lang === 'th' ? 'RARE (ฟ้า)' : 'RARE (Blue)'}</option>
                    <option value="EPIC">{lang === 'th' ? 'EPIC (แดง)' : 'EPIC (Red)'}</option>
                    <option value="LAGEND">{lang === 'th' ? 'LEGEND (ม่วง)' : 'LEGEND (Purple)'}</option>
                    <option value="MYTHIC">{lang === 'th' ? 'MYTHIC (ทอง)' : 'MYTHIC (Gold)'}</option>
                  </select>
                </div>
              </div>

            </div>
          </div>

          {/* 3. Hunters List Management */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold text-slate-200">
                  {t.scanResults} ({hunters.length} {lang === 'th' ? 'คน' : 'hunters'})
                </h3>
              </div>
              {hunters.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(lang === 'th' ? 'ต้องการล้างรายชื่อผู้ล่าทั้งหมดหรือไม่?' : 'Clear all hunters?')) {
                      setHunters([]);
                      sounds.playClick();
                    }
                  }}
                  className="text-[10px] text-red-400 hover:text-red-300 hover:underline cursor-pointer"
                >
                  {t.clearAllHunters}
                </button>
              )}
            </div>

            {/* Existing Hunters Chips */}
            {hunters.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                {lang === 'th' ? 'ยังไม่มีรายชื่อผู้ล่าในไอเทมนี้' : 'No hunters recorded for this item.'}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
                {hunters.map((h, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#111929] border border-slate-700 text-slate-200 shadow-sm"
                  >
                    <span>{h.name}</span>
                    <span className="text-[10px] px-1 py-0.2 rounded bg-slate-800 text-sky-300 font-mono">
                      {h.clan}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveHunter(idx)}
                      className="ml-1 text-slate-400 hover:text-red-400 transition cursor-pointer"
                      title={lang === 'th' ? 'ลบออก' : 'Remove'}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Quick Add Hunter Bar */}
            <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row items-center gap-2">
              <select
                value={selectedHunterMemberId}
                onChange={(e) => setSelectedHunterMemberId(e.target.value)}
                className="w-full sm:w-1/2 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none"
              >
                <option value="">-- {t.selectHunterDropdown} --</option>
                {allMembers
                  .filter((m) => m.status === 'active' && m.inGameName)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.inGameName} [{m.clan || 'No Clan'}]
                    </option>
                  ))}
              </select>

              <button
                type="button"
                onClick={handleAddHunterFromMember}
                disabled={!selectedHunterMemberId}
                className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-600 disabled:opacity-40 text-white text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'th' ? 'เพิ่มจากสมาชิก' : 'Add Member'}</span>
              </button>

              <div className="flex-1 flex items-center gap-1.5 w-full">
                <input
                  type="text"
                  placeholder={lang === 'th' ? 'หรือพิมพ์ชื่อเอง...' : 'Or type custom name...'}
                  value={customHunterName}
                  onChange={(e) => setCustomHunterName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomHunter();
                    }
                  }}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddCustomHunter}
                  disabled={!customHunterName.trim()}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white text-xs font-bold transition cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* 4. Hunter Proof Screenshots */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-bold text-slate-200">
                  {t.addScreenshotFiles} ({hunterScreenshots.length} {lang === 'th' ? 'รูป' : 'photos'})
                </h3>
              </div>

              <label
                htmlFor="edit-file-backup-screenshots"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200 border border-slate-700 transition cursor-pointer"
              >
                <Upload className="w-3 h-3 text-[#f5d77f]" />
                <span>{lang === 'th' ? '+ แนบรูปเพิ่ม' : '+ Attach More'}</span>
                <input
                  id="edit-file-backup-screenshots"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleScreenshotUpload}
                  className="hidden"
                />
              </label>
            </div>

            {hunterScreenshots.length > 0 ? (
              <div className="flex items-center gap-2 overflow-x-auto p-1.5 rounded-lg bg-[#080d16] border border-slate-800">
                {hunterScreenshots.map((shot, idx) => (
                  <div
                    key={idx}
                    className="relative group shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-slate-700 bg-slate-900"
                  >
                    <img
                      src={shot}
                      alt={`Proof ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity">
                      {onViewImageZoom && (
                        <button
                          type="button"
                          onClick={() => onViewImageZoom(shot, `Proof #${idx + 1}`)}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-white"
                          title="Zoom"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                      )}
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
            ) : (
              <p className="text-xs text-slate-500 italic">
                {lang === 'th' ? 'ไม่มีรูปหลักฐานแนบไว้' : 'No proof screenshots attached.'}
              </p>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800">
            {isOwner && onBroadcastToDiscord && item && (
              <button
                type="button"
                disabled={isBroadcasting}
                onClick={async () => {
                  sounds.playClick();
                  setIsBroadcasting(true);
                  try {
                    await onBroadcastToDiscord(item);
                  } finally {
                    setIsBroadcasting(false);
                  }
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#5865F2]/20 hover:bg-[#5865F2]/30 text-[#8ea1e1] hover:text-white border border-[#5865F2]/50 text-xs font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50"
                title={t.sendToDiscord || 'ส่งไป Discord'}
              >
                <MessageSquare className="w-3.5 h-3.5 text-[#5865F2]" />
                <span>
                  {isBroadcasting
                    ? (lang === 'th' ? 'กำลังส่ง...' : 'Sending...')
                    : (t.sendToDiscord || 'ส่งไป Discord')}
                </span>
              </button>
            )}

            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                {t.cancel}
              </button>
            <button
              id="btn-confirm-save-edit-item"
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#d4af37] via-[#e5be49] to-[#aa841c] hover:brightness-110 text-slate-950 text-xs font-bold shadow-lg transition-all cursor-pointer disabled:opacity-50 active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  <span>{t.loading}</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{t.saveItemEdit}</span>
                </>
              )}
            </button>
          </div>
        </div>

        </form>

      </div>
    </div>
  );
};
