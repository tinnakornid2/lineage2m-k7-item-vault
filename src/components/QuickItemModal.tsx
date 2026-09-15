import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit3,
  Sparkles,
  Upload,
  AlertCircle,
  Check,
  Search,
  RotateCcw,
  Layers,
  HelpCircle
} from 'lucide-react';
import { ItemRarity, Language, QuickItem, User } from '../types';
import { translations } from '../translations';
import { sounds } from '../utils/sound';

interface QuickItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  currentUser: User | null;
  quickItems: QuickItem[];
  onAddQuickItem: (item: Omit<QuickItem, 'id' | 'createdAt'>) => Promise<void>;
  onUpdateQuickItem?: (id: string, updates: Partial<Omit<QuickItem, 'id' | 'createdAt'>>) => Promise<void>;
  onDeleteQuickItem: (id: string) => Promise<void>;
  onSelectQuickItem?: (item: QuickItem) => void;
  initialEditItem?: QuickItem | null;
}

const PRESET_ICONS = [
  { name: 'Sword', labelTh: 'ดาบ', url: 'https://images.unsplash.com/photo-1595590424283-b8f17842773f?w=300&auto=format&fit=crop&q=80' },
  { name: 'Armor', labelTh: 'เกราะ', url: 'https://images.unsplash.com/photo-1514539079130-25950c84af65?w=300&auto=format&fit=crop&q=80' },
  { name: 'Ring', labelTh: 'แหวน', url: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=300&auto=format&fit=crop&q=80' },
  { name: 'Helmet', labelTh: 'หมวก', url: 'https://images.unsplash.com/photo-1533158307587-828f0a76ef96?w=300&auto=format&fit=crop&q=80' },
  { name: 'Shield', labelTh: 'โล่', url: 'https://images.unsplash.com/photo-1618336753974-aae8e04506aa?w=300&auto=format&fit=crop&q=80' },
  { name: 'Scroll', labelTh: 'คัมภีร์', url: 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=300&auto=format&fit=crop&q=80' },
  { name: 'Potion', labelTh: 'น้ำยา', url: 'https://images.unsplash.com/photo-1514733670139-4d87a1941d55?w=300&auto=format&fit=crop&q=80' },
  { name: 'Staff', labelTh: 'คฑา', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80' },
];

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 256;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export const QuickItemModal: React.FC<QuickItemModalProps> = ({
  isOpen,
  onClose,
  lang,
  currentUser,
  quickItems,
  onAddQuickItem,
  onUpdateQuickItem,
  onDeleteQuickItem,
  onSelectQuickItem,
  initialEditItem = null
}) => {
  const t = translations[lang];
  const isAdminOrOwner =
    currentUser?.role === 'owner' ||
    currentUser?.role === 'admin';

  // Form State
  const [editingItem, setEditingItem] = useState<QuickItem | null>(initialEditItem);
  const [name, setName] = useState('');
  const [rarity, setRarity] = useState<ItemRarity>('LAGEND');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setEditingItem(null);
    setName('');
    setRarity('LAGEND');
    setImageUrl('');
    setImagePreview('');
    setError('');
    setDeleteConfirmId(null);
  }, []);

  // Sync initialEditItem when opened
  useEffect(() => {
    if (!isOpen) {
      resetForm();
      return;
    }
    if (initialEditItem) {
      setEditingItem(initialEditItem);
      setName(initialEditItem.name);
      setRarity(initialEditItem.rarity);
      setImageUrl(initialEditItem.imageUrl);
      setImagePreview(initialEditItem.imageUrl);
    } else {
      resetForm();
    }
  }, [initialEditItem, isOpen, resetForm]);

  const handleStartEdit = (item: QuickItem) => {
    sounds.playClick();
    setEditingItem(item);
    setName(item.name);
    setRarity(item.rarity);
    setImageUrl(item.imageUrl);
    setImagePreview(item.imageUrl);
    setError('');
  };

  const handleCancelEdit = () => {
    sounds.playClick();
    resetForm();
  };

  const processQuickImageFile = async (file: File) => {
    try {
      const compressed = await compressImage(file);
      setImagePreview(compressed);
      setImageUrl(compressed);
      sounds.playClick();
    } catch (err) {
      console.error('File compression error:', err);
      setError(lang === 'th' ? 'ไม่สามารถประมวลผลไฟล์รูปภาพได้' : 'Failed to process image');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processQuickImageFile(file);
    e.target.value = '';
  };

  const handlePasteQuickImageZone = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          e.stopPropagation();
          processQuickImageFile(file);
          break;
        }
      }
    }
  };

  // Window paste listener when quick item modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handleWindowPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            processQuickImageFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => {
      window.removeEventListener('paste', handleWindowPaste);
    };
  }, [isOpen]);

  const handleSelectPreset = (url: string) => {
    sounds.playClick();
    setImagePreview(url);
    setImageUrl(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError(lang === 'th' ? 'กรุณาระบุชื่อไอเทม' : 'Item name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const finalImage = imageUrl?.trim() || editingItem?.imageUrl || PRESET_ICONS[0].url;
      if (editingItem) {
        // Edit Mode
        if (onUpdateQuickItem) {
          sounds.playEquip();
          await onUpdateQuickItem(editingItem.id, {
            name: name.trim(),
            rarity,
            imageUrl: finalImage,
          });
        }
        resetForm();
      } else {
        // Add Mode
        sounds.playClaim();
        await onAddQuickItem({
          name: name.trim(),
          rarity,
          imageUrl: finalImage,
        });
        resetForm();
      }
    } catch (err: any) {
      console.error('Error in QuickItemModal handleSubmit:', err);
      setError(err?.message || (lang === 'th' ? 'เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่อีกครั้ง' : 'Failed to save item, please try again'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    sounds.playClick();
    try {
      await onDeleteQuickItem(itemId);
      if (editingItem?.id === itemId) {
        resetForm();
      }
      setDeleteConfirmId(null);
    } catch {
      setError(t.error);
    }
  };

  const getRarityBadge = (r: ItemRarity) => {
    switch (r) {
      case 'MYTHIC':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/70 shadow-[0_0_10px_rgba(245,158,11,0.3)]';
      case 'LAGEND':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/70 shadow-[0_0_10px_rgba(168,85,247,0.3)]';
      case 'EPIC':
        return 'bg-red-500/20 text-red-300 border-red-500/70 shadow-[0_0_10px_rgba(239,68,68,0.3)]';
      case 'RARE':
      default:
        return 'bg-sky-500/20 text-sky-300 border-sky-500/70 shadow-[0_0_10px_rgba(56,189,248,0.3)]';
    }
  };

  const filteredItems = quickItems.filter((i) =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-2xl bg-gradient-to-b from-[#101828] via-[#0b101c] to-[#060912] border border-[#d4af37]/50 shadow-[0_20px_60px_rgba(0,0,0,0.95),0_0_30px_rgba(212,175,55,0.15)] p-5 sm:p-7 text-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        
        {/* Ornate Gold Frame Corners */}
        <div className="ornate-corner-tl" />
        <div className="ornate-corner-tr" />
        <div className="ornate-corner-bl" />
        <div className="ornate-corner-br" />

        {/* Modal Close Button */}
        <button
          id="btn-close-quick-modal"
          onClick={() => {
            sounds.playClick();
            onClose();
          }}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 border border-slate-700/60 hover:border-slate-500 transition-all cursor-pointer z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with Luxury Crest */}
        <div className="flex items-center gap-3.5 mb-5 pb-4 border-b border-[#1c2942]/80 shrink-0">
          <div className="relative p-3 rounded-xl bg-gradient-to-br from-[#d4af37]/30 to-[#45330a]/40 border border-[#d4af37]/60 text-[#f5d77f] shadow-lg shadow-[#d4af37]/10">
            <Sparkles className="w-6 h-6 text-[#f5d77f]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-[#fff2b8] via-[#e6be44] to-[#c99a22]">
                {t.quickItemsMenu}
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/50 text-[#f5d77f]">
                {quickItems.length} {lang === 'th' ? 'ชิ้น' : 'Items'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {lang === 'th'
                ? 'ระบบแม่แบบควิกไอเทม: เพิ่ม แก้ไข และลบไอเทมที่ใช้บ่อยเพื่อความสะดวกรวดเร็ว'
                : 'Quick Item Templates: Add, Edit, and Delete presets for fast boss loot logging'}
            </p>
          </div>
        </div>

        {/* SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-6">

          {/* 1. ADMIN/OWNER ADD OR EDIT FORM */}
          {isAdminOrOwner ? (
            <div className={`p-4 sm:p-5 rounded-xl transition-all duration-300 border ${
              editingItem
                ? 'bg-gradient-to-b from-[#1d1e15] to-[#0e141f] border-amber-500/70 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
                : 'bg-[#090f1d]/90 border-[#1e2e4b]'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${
                    editingItem ? 'bg-amber-500/25 text-amber-300' : 'bg-[#d4af37]/20 text-[#f5d77f]'
                  }`}>
                    {editingItem ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
                      <span>{editingItem ? t.editingItem : t.addQuickItem}</span>
                    </h3>
                    {editingItem && (
                      <p className="text-[11px] text-amber-300/80 font-medium">
                        {lang === 'th' ? 'กำลังทำการแก้ไข:' : 'Currently editing:'} <span className="font-bold underline">{editingItem.name}</span>
                      </p>
                    )}
                  </div>
                </div>

                {editingItem && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-600 transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t.cancelEdit}</span>
                  </button>
                )}
              </div>

              {error && (
                <div className="mb-3 p-2.5 rounded-lg bg-red-950/70 border border-red-800 text-xs text-red-200 flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Name Input */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {t.itemName} *
                    </label>
                    <input
                      id="input-quick-name"
                      type="text"
                      required
                      placeholder={lang === 'th' ? 'เช่น Archangel\'s Sword, Imperial Armor' : 'e.g. Imperial Crusader Armor'}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#070b14] border border-[#223250] focus:border-[#d4af37] text-slate-100 text-sm focus:outline-none transition-all shadow-inner"
                    />
                  </div>

                  {/* Rarity Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {t.itemRarity}
                    </label>
                    <select
                      id="select-quick-rarity"
                      value={rarity}
                      onChange={(e) => setRarity(e.target.value as ItemRarity)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#070b14] border border-[#223250] focus:border-[#d4af37] text-slate-100 text-sm focus:outline-none transition-all cursor-pointer"
                    >
                      <option value="RARE">{t.rarityRare} (Rare - ฟ้า)</option>
                      <option value="EPIC">{t.rarityEpic} (Epic - แดง)</option>
                      <option value="LAGEND">{t.rarityLegend} (Legendary - ม่วง)</option>
                      <option value="MYTHIC">{t.rarityMythic} (Mythic - ทอง)</option>
                    </select>
                  </div>
                </div>

                {/* Preset Icons Selection */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      {lang === 'th' ? 'เลือกไอคอนสำเร็จรูป หรืออัปโหลดรูปภาพ' : 'Choose Preset Icon or Upload'}
                    </label>
                    <span className="text-[10px] text-slate-400">
                      {lang === 'th' ? '(คลิกเพื่อเลือกทันที)' : '(Click to select)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                    {PRESET_ICONS.map((preset) => {
                      const isSelected = imagePreview === preset.url;
                      return (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => handleSelectPreset(preset.url)}
                          className={`group relative flex flex-col items-center gap-1 p-1.5 rounded-xl border transition-all shrink-0 cursor-pointer ${
                            isSelected
                              ? 'bg-[#d4af37]/20 border-[#d4af37] shadow-[0_0_12px_rgba(212,175,55,0.4)]'
                              : 'bg-[#0b111e] border-slate-800 hover:border-slate-600 hover:bg-[#121c30]'
                          }`}
                        >
                          <img
                            src={preset.url}
                            alt={preset.name}
                            className="w-10 h-10 rounded-lg object-cover border border-slate-700/80 group-hover:scale-105 transition-transform"
                          />
                          <span className="text-[9px] font-medium text-slate-300 whitespace-nowrap">
                            {lang === 'th' ? preset.labelTh : preset.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Image Upload & Submit Row */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-3">
                    <label
                      tabIndex={0}
                      onPaste={handlePasteQuickImageZone}
                      htmlFor="file-quick-image"
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#111c30] hover:bg-[#182845] border border-dashed border-[#d4af37]/50 hover:border-[#d4af37] text-xs font-medium text-slate-200 cursor-pointer transition-all shadow-sm outline-none"
                      title={lang === 'th' ? 'คลิกเลือกไฟล์ หรือกด Ctrl + V เพื่อวางรูป' : 'Click to choose or Ctrl + V to paste'}
                    >
                      <Upload className="w-4 h-4 text-[#d4af37]" />
                      <span>{t.chooseImage}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-amber-300 border border-slate-700">
                        Ctrl + V
                      </span>
                      <input
                        id="file-quick-image"
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>

                    {imagePreview && (
                      <div className="flex items-center gap-2 bg-[#060a12] p-1.5 rounded-xl border border-slate-700">
                        <img
                          src={imagePreview}
                          alt="preview"
                          className="w-9 h-9 rounded-lg object-cover border border-slate-600 shadow-sm"
                        />
                        <span className="text-xs text-emerald-400 font-semibold pr-2">
                          ✓ {lang === 'th' ? 'เลือกรูปแล้ว' : 'Ready'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {editingItem && (
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-600 transition-all cursor-pointer"
                      >
                        {t.cancel}
                      </button>
                    )}

                    <button
                      id="btn-save-quick-item"
                      type="submit"
                      disabled={isSubmitting}
                      className={`flex items-center justify-center gap-2 px-5 py-2 rounded-xl font-bold text-xs transition-all shadow-lg cursor-pointer ${
                        editingItem
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 border border-yellow-300/60 shadow-amber-500/25'
                          : 'btn-l2m-gold'
                      } disabled:opacity-50`}
                    >
                      {editingItem ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      <span>
                        {isSubmitting
                          ? t.loading
                          : editingItem
                          ? t.saveEdit
                          : t.addQuickItem}
                      </span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-[#0c121e] border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-sky-400 shrink-0" />
              <span>
                {lang === 'th'
                  ? 'เฉพาะหัวหน้ากิลด์ (Owner) และรองหัวหน้า (Admin) เท่านั้นที่สามารถเพิ่ม ลบ หรือแก้ไขควิกไอเทมได้'
                  : 'Only Clan Owner and Admins can Add, Edit, or Delete quick items.'}
              </span>
            </div>
          )}

          {/* 2. SEARCH & LIST HEADER */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#d4af37]" />
                <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-200">
                  {lang === 'th' ? 'รายการควิกไอเทมทั้งหมด' : 'Registered Quick Items'} ({filteredItems.length})
                </span>
              </div>

              {/* Search input */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder={lang === 'th' ? 'ค้นหาชื่อไอเทม...' : 'Search items...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#080d17] border border-[#1e2e4b] focus:border-[#d4af37] text-xs text-slate-200 focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* 3. QUICK ITEMS CARDS GRID */}
            {filteredItems.length === 0 ? (
              <div className="text-center py-10 rounded-xl bg-[#080d17] border border-dashed border-slate-800 text-slate-500 text-xs">
                {lang === 'th' ? 'ไม่พบควิกไอเทมที่ตรงกับการค้นหา' : 'No quick items match your filter'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredItems.map((item) => {
                  const isBeingEdited = editingItem?.id === item.id;
                  const isConfirmingDelete = deleteConfirmId === item.id;

                  return (
                    <div
                      key={item.id}
                      className={`relative p-3 rounded-xl border transition-all duration-200 flex items-center justify-between gap-3 group ${
                        isBeingEdited
                          ? 'bg-gradient-to-r from-amber-500/15 via-[#0e1628] to-[#0b101c] border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                          : 'bg-[#090e1a]/95 hover:bg-[#0f172a] border-[#1c2942]/90 hover:border-[#d4af37]/60 shadow-md shadow-black/40'
                      }`}
                    >
                      {/* Left: Thumbnail & Details */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="relative shrink-0">
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-11 h-11 rounded-lg object-cover border border-slate-700/80 shadow-md group-hover:scale-105 transition-transform"
                          />
                          <span
                            className={`absolute -bottom-1 -right-1 text-[8px] font-bold px-1 rounded border uppercase ${getRarityBadge(
                              item.rarity
                            )}`}
                          >
                            {item.rarity.substring(0, 3)}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-200 truncate group-hover:text-white">
                            {item.name}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className={`text-[9px] font-semibold px-2 py-0.2 rounded border ${getRarityBadge(
                                item.rarity
                              )}`}
                            >
                              {item.rarity}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions (Select, Edit, Delete) */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Select Button (when modal is used as a picker) */}
                        {onSelectQuickItem && (
                          <button
                            onClick={() => {
                              sounds.playClick();
                              onSelectQuickItem(item);
                              onClose();
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-[#142135] hover:bg-[#1f3454] text-xs font-semibold text-sky-300 border border-sky-600/50 hover:border-sky-400 transition-all cursor-pointer"
                            title={lang === 'th' ? 'เลือกใช้ไอเทมนี้' : 'Select item'}
                          >
                            {lang === 'th' ? 'เลือก' : 'Select'}
                          </button>
                        )}

                        {/* Admin/Owner Edit & Delete Controls */}
                        {isAdminOrOwner && (
                          <>
                            {/* Edit Button */}
                            <button
                              id={`btn-edit-qi-${item.id}`}
                              onClick={() => handleStartEdit(item)}
                              className={`p-1.5 rounded-lg transition-all cursor-pointer border ${
                                isBeingEdited
                                  ? 'bg-amber-500/25 border-amber-500 text-amber-300 shadow-sm'
                                  : 'bg-slate-800/80 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 border-slate-700/80 hover:border-amber-500/50'
                              }`}
                              title={t.editQuickItem}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Button with Confirmation State */}
                            {isConfirmingDelete ? (
                              <div className="flex items-center gap-1 animate-in fade-in">
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-[10px] font-bold text-white shadow transition-all cursor-pointer"
                                  title={lang === 'th' ? 'ยืนยันลบ' : 'Confirm delete'}
                                >
                                  {lang === 'th' ? 'ลบเลย' : 'Del'}
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white text-[10px] transition-all cursor-pointer"
                                  title={t.cancel}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                id={`btn-delete-qi-${item.id}`}
                                onClick={() => {
                                  sounds.playClick();
                                  setDeleteConfirmId(item.id);
                                }}
                                className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-red-950/60 text-slate-400 hover:text-red-300 border border-slate-700/80 hover:border-red-700/60 transition-all cursor-pointer"
                                title={t.delete}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
