import React, { useMemo, useState } from 'react';
import {
  Crown,
  Plus,
  Trash2,
  CheckCircle,
  Clock,
  Sparkles,
  Upload,
  UserPlus,
  AlertCircle,
  UserCheck,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List,
  Users,
  PackageCheck,
  Coins,
  Zap,
  Edit3,
  History,
  ReceiptText,
  ImagePlus,
  X,
  Loader2,
  Eye,
  ShieldCheck,
  Layers3,
  Filter
} from 'lucide-react';
import {
  GeneralItem,
  GeneralItemReceipt,
  ItemRarity,
  Language,
  QueueMember,
  QuickItem,
  User,
  cleanClanName,
  getRarityBadge,
  getRarityBorder,
  getRarityTextGlow
} from '../types';
import { uploadImageToGoogleDrive } from '../services/googleSheetsBackupService';
import { compressImageFile } from '../utils/imageCompressor';
import { sounds } from '../utils/sound';

interface Props {
  lang: Language;
  currentUser: User | null;
  items: GeneralItem[];
  quickItems?: QuickItem[];
  allMembers?: User[];
  onAdd: (item: Omit<GeneralItem, 'id' | 'createdAt'>) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Omit<GeneralItem, 'id' | 'createdAt'>>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onViewImageZoom?: (url: string, title?: string) => void;
  showToast?: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

type Draft = Pick<GeneralItem, 'name' | 'imageUrl' | 'price' | 'quantity' | 'minPowerLevel' | 'rarity'>;
const emptyDraft: Draft = {
  name: '',
  imageUrl: '',
  price: 0,
  quantity: 1,
  minPowerLevel: 0,
  rarity: 'RARE'
};

async function uploadOrEmbed(file: File, prefix: string) {
  const compressed = await compressImageFile(file, { maxWidth: 700, maxHeight: 700, quality: 0.74 });
  try {
    const result = await uploadImageToGoogleDrive(compressed, `${prefix}-${Date.now()}-${file.name}`);
    if (result.success && result.imageUrl) return result.imageUrl;
  } catch {
    /* Fallback to compressed base64 if Drive quota is reached */
  }
  return compressed;
}

export const GeneralItemQueueCard: React.FC<Props> = ({
  lang,
  currentUser,
  items,
  quickItems = [],
  allMembers = [],
  onAdd,
  onUpdate,
  onDelete,
  onViewImageZoom,
  showToast
}) => {
  const th = lang === 'th';
  const isAdminOrOwner = currentUser?.role === 'owner' || currentUser?.role === 'admin';

  // View Mode: 'grid' (4 items per row) vs 'table' (horizontal detailed rows)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Add/Edit Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Item deletion state
  const [itemToDelete, setItemToDelete] = useState<GeneralItem | null>(null);

  // Add Member to Queue dropdown state
  const [activeQueueIdForAdd, setActiveQueueIdForAdd] = useState<string | null>(null);
  const [selectedMemberIdForQueue, setSelectedMemberIdForQueue] = useState<string>('');

  // Deliver Item Modal State (replaces window.prompt)
  const [deliveryModalData, setDeliveryModalData] = useState<{
    item: GeneralItem;
    member: QueueMember;
    quantity: number;
    note: string;
    receiptFile: File | null;
    receiptPreview: string;
  } | null>(null);
  const [isDelivering, setIsDelivering] = useState(false);

  // Edit Receipt Modal State
  const [editingReceiptData, setEditingReceiptData] = useState<{
    item: GeneralItem;
    receipt: GeneralItemReceipt;
    note: string;
    newReceiptFile: File | null;
    newReceiptPreview: string;
  } | null>(null);
  const [isUpdatingReceipt, setIsUpdatingReceipt] = useState(false);

  // Receipt History Expand Map
  const [expandedReceipts, setExpandedReceipts] = useState<Record<string, boolean>>({});

  // Busy action tracker
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  // Metrics
  const pendingTotal = useMemo(
    () => items.reduce((sum, item) => sum + (item.queueList || []).filter((m) => m.status === 'pending').length, 0),
    [items]
  );

  // Group clan members for add-to-queue dropdown
  const membersByClan = useMemo(() => {
    const groups: Record<string, User[]> = {};
    allMembers
      .filter((m) => m.status === 'active')
      .forEach((m) => {
        const clan = cleanClanName(m.clan) || (th ? 'ไม่มีแคลน' : 'No Clan');
        if (!groups[clan]) groups[clan] = [];
        groups[clan].push(m);
      });
    return groups;
  }, [allMembers, th]);

  // Form Reset / Open / Close
  const closeForm = () => {
    setShowAddForm(false);
    setEditingId(null);
    setDraft(emptyDraft);
    setImageFile(null);
    setImagePreview('');
    setFormError('');
  };

  const openAddForm = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setImageFile(null);
    setImagePreview('');
    setFormError('');
    setShowAddForm(true);
    sounds.playClick();
  };

  const openEditForm = (item: GeneralItem) => {
    setEditingId(item.id);
    setDraft({
      name: item.name,
      imageUrl: item.imageUrl || '',
      price: item.price || 0,
      quantity: item.quantity || 1,
      minPowerLevel: item.minPowerLevel || 0,
      rarity: item.rarity || 'RARE'
    });
    setImagePreview(item.imageUrl || '');
    setImageFile(null);
    setFormError('');
    setShowAddForm(true);
    sounds.playClick();
  };

  // Image Upload / Paste Handler
  const handleImageFile = async (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    setImageFile(file);
    const preview = await compressImageFile(file, { maxWidth: 700, maxHeight: 700, quality: 0.74 });
    setImagePreview(preview);
  };

  const handlePasteImage = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          handleImageFile(file);
          sounds.playSuccess();
          break;
        }
      }
    }
  };

  // 1-Click Apply Quick Item Preset
  const handleApplyQuickItem = (qi: QuickItem) => {
    sounds.playClick();
    setDraft((prev) => ({
      ...prev,
      name: qi.name,
      rarity: qi.rarity || 'RARE',
      imageUrl: qi.imageUrl || ''
    }));
    setImagePreview(qi.imageUrl || '');
    setImageFile(null);
  };

  // Save Item
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) {
      setFormError(th ? 'กรุณากรอกชื่อไอเทม' : 'Item name is required');
      return;
    }
    setIsSubmitting(true);
    setFormError('');
    try {
      let finalImageUrl = draft.imageUrl;
      if (imageFile) {
        finalImageUrl = await uploadOrEmbed(imageFile, 'general-item');
      }

      const payload = {
        name: draft.name.trim(),
        imageUrl: finalImageUrl,
        price: Math.max(0, draft.price || 0),
        quantity: Math.max(1, draft.quantity || 1),
        minPowerLevel: Math.max(0, draft.minPowerLevel || 0),
        rarity: draft.rarity || 'RARE'
      };

      if (editingId) {
        await onUpdate(editingId, payload);
        if (showToast) showToast(th ? 'แก้ไขไอเทมทั่วไปสำเร็จ' : 'General item updated', 'success');
      } else {
        await onAdd({
          ...payload,
          queueList: [],
          receiptHistory: []
        });
        if (showToast) showToast(th ? 'เพิ่มไอเทมทั่วไปลงคิวสำเร็จ' : 'General item added to queue', 'success');
      }
      closeForm();
    } catch (err: any) {
      setFormError(err?.message || (th ? 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' : 'Failed to save, please retry'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Member Queue Actions: Join / Leave
  const handleToggleQueue = async (item: GeneralItem) => {
    if (!currentUser) return;
    const pendingList = (item.queueList || []).filter((m) => m.status === 'pending');
    const isAlreadyInQueue = pendingList.some((m) => m.userId === currentUser.id);

    if (!isAlreadyInQueue && currentUser.powerLevel < (item.minPowerLevel || 0)) {
      if (showToast) {
        showToast(
          th
            ? `พลังของคุณ (${currentUser.powerLevel.toLocaleString()}) ยังไม่ถึงเกณฑ์ขั้นต่ำ (${item.minPowerLevel.toLocaleString()})`
            : `Your power level (${currentUser.powerLevel.toLocaleString()}) is below requirement (${item.minPowerLevel.toLocaleString()})`,
          'warning'
        );
      }
      return;
    }

    setBusyItemId(item.id);
    sounds.playClick();
    try {
      let updatedQueueList: QueueMember[];
      if (isAlreadyInQueue) {
        // Remove user's pending entry
        updatedQueueList = (item.queueList || []).filter(
          (m) => !(m.userId === currentUser.id && m.status === 'pending')
        );
        if (showToast) showToast(th ? 'ยกเลิกการต่อคิวเรียบร้อย' : 'Left queue successfully', 'info');
      } else {
        // Add user to queue
        const newMember: QueueMember = {
          id: `gqm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          userId: currentUser.id,
          name: currentUser.inGameName || currentUser.username,
          clan: cleanClanName(currentUser.clan) || 'VoltZ',
          powerLevel: currentUser.powerLevel || 0,
          status: 'pending'
        };
        updatedQueueList = [...(item.queueList || []), newMember];
        if (showToast) showToast(th ? 'ลงชื่อต่อคิวสำเร็จ!' : 'Joined queue successfully!', 'success');
      }
      await onUpdate(item.id, { queueList: updatedQueueList });
    } catch (err: any) {
      if (showToast) showToast(err?.message || (th ? 'เกิดข้อผิดพลาด' : 'An error occurred'), 'error');
    } finally {
      setBusyItemId(null);
    }
  };

  // Admin: Add specific member to queue
  const handleAdminAddMember = async (itemId: string) => {
    if (!selectedMemberIdForQueue) return;
    const mem = allMembers.find((m) => m.id === selectedMemberIdForQueue);
    if (!mem) return;

    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    sounds.playClick();
    setBusyItemId(itemId);
    try {
      const newMember: QueueMember = {
        id: `gqm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        userId: mem.id,
        name: mem.inGameName || mem.username,
        clan: cleanClanName(mem.clan) || 'VoltZ',
        powerLevel: mem.powerLevel || 0,
        status: 'pending'
      };
      const updatedQueue = [...(item.queueList || []), newMember];
      await onUpdate(itemId, { queueList: updatedQueue });
      setActiveQueueIdForAdd(null);
      setSelectedMemberIdForQueue('');
      if (showToast) showToast(th ? `เพิ่ม ${mem.inGameName} ลงคิวสำเร็จ` : `Added ${mem.inGameName} to queue`, 'success');
    } catch (err: any) {
      if (showToast) showToast(err?.message || (th ? 'เพิ่มไม่สำเร็จ' : 'Failed to add member'), 'error');
    } finally {
      setBusyItemId(null);
    }
  };

  // Open In-App Delivery Modal (replaces window.prompt)
  const openDeliverModal = (item: GeneralItem, member: QueueMember) => {
    sounds.playClick();
    setDeliveryModalData({
      item,
      member,
      quantity: 1,
      note: '',
      receiptFile: null,
      receiptPreview: ''
    });
  };

  // Confirm Delivery Submit
  const handleConfirmDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryModalData) return;
    const { item, member, quantity, note, receiptFile } = deliveryModalData;

    setIsDelivering(true);
    try {
      let receiptImages: string[] = [];
      if (receiptFile) {
        const uploaded = await uploadOrEmbed(receiptFile, 'general-item-receipt');
        receiptImages = [uploaded];
      }

      const queueList = (item.queueList || []).map((m) =>
        m.id === member.id ? { ...m, status: 'received' as const, receivedAt: Date.now() } : m
      );

      const newReceipt: GeneralItemReceipt = {
        id: `receipt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        userId: member.userId,
        name: member.name,
        clan: member.clan,
        quantity: Math.max(1, quantity),
        receiptImages,
        note: note.trim(),
        deliveredAt: Date.now(),
        deliveredBy: currentUser?.inGameName || currentUser?.username || 'Admin'
      };

      const receiptHistory = [...(item.receiptHistory || []), newReceipt];
      await onUpdate(item.id, { queueList, receiptHistory });

      sounds.playSuccess();
      if (showToast) {
        showToast(
          th
            ? `ส่งมอบไอเทมให้ ${member.name} (x${quantity} ชิ้น) เรียบร้อยแล้ว!`
            : `Delivered item to ${member.name} (x${quantity} pcs) successfully!`,
          'success'
        );
      }
      setDeliveryModalData(null);
    } catch (err: any) {
      if (showToast) showToast(err?.message || (th ? 'การส่งมอบขัดข้อง' : 'Delivery failed'), 'error');
    } finally {
      setIsDelivering(false);
    }
  };

  // Confirm Edit Receipt
  const handleConfirmEditReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReceiptData) return;
    const { item, receipt, note, newReceiptFile } = editingReceiptData;

    setIsUpdatingReceipt(true);
    try {
      let receiptImages = receipt.receiptImages || [];
      if (newReceiptFile) {
        const uploaded = await uploadOrEmbed(newReceiptFile, 'general-item-receipt');
        receiptImages = [uploaded];
      }

      const updatedHistory = (item.receiptHistory || []).map((r) =>
        r.id === receipt.id
          ? {
              ...r,
              note: note.trim(),
              receiptImages,
              updatedAt: Date.now()
            }
          : r
      );

      await onUpdate(item.id, { receiptHistory: updatedHistory });
      sounds.playSuccess();
      if (showToast) showToast(th ? 'อัปเดตบันทึกบิลสำเร็จ' : 'Receipt note updated', 'success');
      setEditingReceiptData(null);
    } catch (err: any) {
      if (showToast) showToast(err?.message || (th ? 'อัปเดตไม่สำเร็จ' : 'Update failed'), 'error');
    } finally {
      setIsUpdatingReceipt(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* SECTION HEADER & CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-400/40 text-cyan-300 shadow-md">
              <PackageCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-[#e0f2fe] via-[#7dd3fc] to-[#38bdf8]">
              {th ? 'ระบบคิวไอเทมทั่วไป' : 'General Item Queue'}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
            <span>
              {items.length} {th ? 'รายการไอเทม' : 'items'}
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-cyan-400 font-semibold">
              {pendingTotal} {th ? 'คนกำลังรอรับคิว' : 'players in queue'}
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-emerald-400 text-xs bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              {th ? 'ผู้ที่เคยได้รับแล้ว สามารถลงชื่อต่อคิวซ้ำได้' : 'Recipients may join queue again'}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* View Mode Switcher: 4 Items / Row vs Full Table */}
          <div className="flex items-center p-1 rounded-xl bg-[#090d16] border border-slate-800 shadow-inner">
            <button
              type="button"
              id="btn-general-queue-view-grid"
              onClick={() => {
                sounds.playClick();
                setViewMode('grid');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
              title={th ? 'แสดงแบบการ์ด 4 แถว (Grid View)' : 'Grid View (4 columns)'}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>{th ? 'การ์ด 4 แถว' : 'Grid'}</span>
            </button>
            <button
              type="button"
              id="btn-general-queue-view-table"
              onClick={() => {
                sounds.playClick();
                setViewMode('table');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
              title={th ? 'แสดงแบบตารางแนวนอน (Table View)' : 'Table View'}
            >
              <List className="w-3.5 h-3.5" />
              <span>{th ? 'ตาราง' : 'Table'}</span>
            </button>
          </div>

          {/* Add General Item Button */}
          {isAdminOrOwner && (
            <button
              id="btn-open-add-general-item"
              type="button"
              onClick={showAddForm ? closeForm : openAddForm}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#aa841c] hover:brightness-110 text-slate-950 text-xs font-bold shadow-md transition-all cursor-pointer"
            >
              {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{showAddForm ? (th ? 'ปิดฟอร์ม' : 'Close Form') : (th ? 'เพิ่มไอเทมทั่วไป' : 'Add General Item')}</span>
            </button>
          )}
        </div>
      </div>

      {/* BEAUTIFUL & SIMPLE ADD / EDIT ITEM FORM */}
      {showAddForm && isAdminOrOwner && (
        <form
          onSubmit={handleSaveItem}
          className="rounded-2xl bg-[#0e1422] border border-[#d4af37]/40 p-5 sm:p-6 shadow-2xl space-y-5 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm sm:text-base font-bold font-cinzel text-[#f5d77f] flex items-center gap-2">
              <Crown className="w-4 h-4 text-[#f5d77f]" />
              <span>{editingId ? (th ? 'แก้ไขไอเทมทั่วไป' : 'Edit General Item') : (th ? 'เพิ่มไอเทมทั่วไปลงคิว' : 'Add General Item to Queue')}</span>
            </h3>
            <button
              type="button"
              onClick={closeForm}
              className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-800/60 hover:bg-slate-700 transition-colors"
            >
              {th ? 'ยกเลิก' : 'Cancel'}
            </button>
          </div>

          {/* 1-Click Quick Item Preset Selector */}
          {quickItems.length > 0 && !editingId && (
            <div className="p-3 rounded-xl bg-[#090e1a] border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#f5d77f]" />
                  <span>{th ? 'เลือกด่วนจากควิกไอเทม (คลิกเดียวเติมข้อมูลอัตโนมัติ):' : 'Select from Quick Item preset (1-Click autofill):'}</span>
                </span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1.5 no-scrollbar">
                {quickItems.map((qi) => (
                  <button
                    key={qi.id}
                    type="button"
                    onClick={() => handleApplyQuickItem(qi)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg bg-[#111827] hover:bg-[#1e293b] border text-slate-200 hover:text-white flex items-center gap-2 shrink-0 transition-all shadow-sm cursor-pointer ${
                      draft.name === qi.name ? 'border-cyan-400 bg-cyan-950/40 text-cyan-200' : 'border-slate-700/80 hover:border-[#d4af37]/60'
                    }`}
                  >
                    {qi.imageUrl ? (
                      <img src={qi.imageUrl} alt={qi.name} className="w-7 h-7 rounded-lg object-cover border border-slate-600 shrink-0" />
                    ) : (
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 bg-slate-800">
                        <Sparkles className="h-3.5 w-3.5 text-[#f5d77f]" />
                      </span>
                    )}
                    <span className="font-semibold">{qi.name}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-slate-800 text-amber-300 border border-slate-700">
                      {qi.rarity}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {formError && (
            <div className="p-3 rounded-xl bg-red-950/70 border border-red-800 text-xs text-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{formError}</span>
            </div>
          )}

          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Drag & Drop / Paste Image Box (4 cols) */}
            <div className="lg:col-span-4 flex flex-col">
              <span className="text-xs font-semibold text-slate-300 mb-1.5 block">
                {th ? 'รูปภาพไอเทม' : 'Item Image'}
              </span>
              <div
                tabIndex={0}
                onPaste={handlePasteImage}
                className="relative flex-1 min-h-[160px] rounded-xl border-2 border-dashed border-slate-700 hover:border-[#d4af37]/70 bg-[#090d16] flex flex-col items-center justify-center p-3 text-center transition-all group outline-none cursor-pointer overflow-hidden"
              >
                {imagePreview ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img
                      src={imagePreview}
                      alt="preview"
                      className="max-h-36 max-w-full rounded-lg object-contain shadow-md"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImagePreview('');
                        setImageFile(null);
                        setDraft((prev) => ({ ...prev, imageUrl: '' }));
                      }}
                      className="absolute top-1 right-1 p-1 rounded-full bg-red-900/80 hover:bg-red-700 text-white text-xs shadow transition-colors"
                      title={th ? 'ลบรูป' : 'Remove image'}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <label htmlFor="file-general-item-image" className="cursor-pointer flex flex-col items-center gap-1.5 w-full h-full justify-center">
                    <div className="p-2.5 rounded-full bg-slate-800/80 group-hover:bg-[#d4af37]/10 text-slate-400 group-hover:text-[#f5d77f] transition-colors">
                      <ImagePlus className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-semibold text-slate-200">
                      {th ? 'คลิกเลือกรูปภาพ' : 'Click to upload'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                      Ctrl + V {th ? 'เพื่อวางรูป' : 'to paste'}
                    </span>
                    <input
                      id="file-general-item-image"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        handleImageFile(e.target.files?.[0]);
                        e.currentTarget.value = '';
                      }}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Right: Data Inputs (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              {/* Row 1: Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {th ? 'ชื่อไอเทม' : 'Item Name'} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={th ? 'เช่น Scroll of Blessing, Potion, Dragon Stone...' : "e.g. Scroll of Blessing, Potion..."}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#090d16] border border-slate-700 focus:border-[#d4af37] text-slate-100 text-sm focus:outline-none transition-colors"
                />
              </div>

              {/* Row 2: Rarity, Quantity, Price */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Rarity */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {th ? 'ระดับความหายาก' : 'Rarity'}
                  </label>
                  <select
                    value={draft.rarity}
                    onChange={(e) => setDraft({ ...draft, rarity: e.target.value as ItemRarity })}
                    className="w-full px-3 py-2 rounded-xl bg-[#090d16] border border-slate-700 focus:border-[#d4af37] text-slate-100 text-xs font-semibold focus:outline-none"
                  >
                    <option value="RARE">🟦 RARE (ฟ้า)</option>
                    <option value="EPIC">🟥 EPIC (แดง)</option>
                    <option value="LAGEND">🟪 LEGEND (ม่วง)</option>
                    <option value="MYTHIC">🟨 MYTHIC (ทอง)</option>
                  </select>
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span>{th ? 'จำนวน' : 'Quantity'}</span>
                    <span className="text-[10px] text-emerald-400 font-mono">{th ? 'ชิ้น' : 'pcs'}</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={draft.quantity}
                    onChange={(e) => setDraft({ ...draft, quantity: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-full px-3 py-2 rounded-xl bg-[#090d16] border border-slate-700 focus:border-[#d4af37] text-slate-100 text-xs font-mono font-bold focus:outline-none"
                  />
                </div>

                {/* Price (Diamonds) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span>{th ? 'ราคา (ไดมอนด์)' : 'Price (Diamonds)'}</span>
                    <span className="text-[10px] text-amber-400 font-mono">0 = {th ? 'ฟรี' : 'Free'}</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      value={draft.price}
                      onChange={(e) => setDraft({ ...draft, price: Math.max(0, Number(e.target.value) || 0) })}
                      className="w-full pl-7 pr-3 py-2 rounded-xl bg-[#090d16] border border-slate-700 focus:border-[#d4af37] text-amber-300 text-xs font-mono font-bold focus:outline-none"
                    />
                    <Coins className="w-3.5 h-3.5 text-amber-400 absolute left-2.5 top-2.5 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Row 3: Minimum Power Level Requirement */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span>{th ? 'พลังขั้นต่ำในการรับ (PL)' : 'Minimum Power (PL)'}</span>
                    <span className="text-[10px] text-sky-400 font-mono">0 = {th ? 'ไม่จำกัด' : 'None'}</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={draft.minPowerLevel}
                      onChange={(e) => setDraft({ ...draft, minPowerLevel: Math.max(0, Number(e.target.value) || 0) })}
                      className="w-full pl-7 pr-3 py-2 rounded-xl bg-[#090d16] border border-slate-700 focus:border-[#d4af37] text-sky-300 text-xs font-mono font-bold focus:outline-none"
                    />
                    <Zap className="w-3.5 h-3.5 text-sky-400 absolute left-2.5 top-2.5 pointer-events-none" />
                  </div>
                </div>

                <div className="flex items-center text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 mr-2 shrink-0" />
                  <span>
                    {th
                      ? 'สมาชิกที่มีพลังถึงเกณฑ์นี้เท่านั้น จึงจะสามารถกดลงชื่อต่อคิวรับไอเทมได้'
                      : 'Only members meeting this verified PL requirement can join the queue.'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={closeForm}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              {th ? 'ยกเลิก' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !draft.name.trim()}
              className="flex items-center gap-2 px-6 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#aa841c] hover:brightness-110 text-slate-950 font-bold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
              <span>{isSubmitting ? (th ? 'กำลังบันทึก...' : 'Saving...') : (editingId ? (th ? 'บันทึกการแก้ไข' : 'Save Changes') : (th ? 'เพิ่มไอเทมลงคิว' : 'Add Item to Queue'))}</span>
            </button>
          </div>
        </form>
      )}

      {/* ITEMS DISPLAY: 4 ITEMS PER ROW (GRID) OR FULL TABLE VIEW */}
      {items.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[#0c121e] border border-slate-800 text-center text-xs text-slate-500 space-y-2">
          <PackageCheck className="w-10 h-10 mx-auto text-slate-600 opacity-40" />
          <p>{th ? 'ยังไม่มีรายการไอเทมทั่วไปในคิวขณะนี้' : 'No general items in the queue yet'}</p>
          {isAdminOrOwner && (
            <button
              type="button"
              onClick={openAddForm}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#d4af37]/15 hover:bg-[#d4af37]/25 border border-[#d4af37]/40 text-[#f5d77f] text-xs font-bold transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{th ? 'เพิ่มไอเทมแรก' : 'Add First Item'}</span>
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* COMPACT 4 ITEMS PER ROW (GRID) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item) => {
            const pendingList = (item.queueList || []).filter((m) => m.status === 'pending');
            const receivedList = (item.queueList || []).filter((m) => m.status === 'received');
            const userIndex = currentUser
              ? pendingList.findIndex(
                  (m) =>
                    (m.userId && m.userId === currentUser.id) ||
                    (m.name && currentUser.inGameName && m.name.trim().toLowerCase() === currentUser.inGameName.trim().toLowerCase())
                )
              : -1;
            const isUserInQueue = userIndex !== -1;
            const meetsPowerReq = !currentUser || currentUser.powerLevel >= (item.minPowerLevel || 0);

            // Progress: delivered receipts count vs total item quantity
            const totalDelivered = (item.receiptHistory || []).reduce((sum, r) => sum + (r.quantity || 1), 0);
            const percentProgress = Math.min(100, Math.round((totalDelivered / Math.max(1, item.quantity)) * 100));

            return (
              <div
                key={item.id}
                className="flex flex-col rounded-xl bg-gradient-to-b from-[#111726] to-[#090d16] border border-slate-800 hover:border-slate-700 shadow-xl overflow-hidden transition-all duration-200"
              >
                {/* Card Header with Image and Rarity styling */}
                <div className="p-3 bg-[#0d1320] border-b border-slate-800 flex items-start gap-2.5">
                  {/* Thumbnail with zoom click */}
                  {item.imageUrl ? (
                    <button
                      type="button"
                      onClick={() => {
                        sounds.playClick();
                        if (onViewImageZoom) onViewImageZoom(item.imageUrl, item.name);
                      }}
                      className="shrink-0 group relative overflow-hidden rounded-xl border border-slate-700 hover:border-[#d4af37] transition-colors cursor-pointer shadow-md"
                      title={th ? 'คลิกเพื่อดูรูปขยาย' : 'Click to zoom image'}
                    >
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-14 h-14 object-cover group-hover:scale-105 transition-transform"
                      />
                    </button>
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-[#141b2b] border border-dashed border-slate-700 flex items-center justify-center text-[9px] text-slate-500 text-center p-1 shrink-0">
                      <PackageCheck className="w-6 h-6 text-slate-600" />
                    </div>
                  )}

                  {/* Title & Key Badges */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[8.5px] font-bold px-1.5 py-0.2 rounded border uppercase ${getRarityBadge(item.rarity || 'RARE')}`}>
                        {item.rarity || 'RARE'}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-sky-400">
                        {pendingList.length} {th ? 'คนรอ' : 'waiting'}
                      </span>
                      {totalDelivered > 0 && (
                        <span className="text-[9.5px] font-mono text-emerald-400 font-semibold">
                          ({totalDelivered}/{item.quantity} {th ? 'ส่งแล้ว' : 'sent'})
                        </span>
                      )}
                    </div>

                    <h3
                      className={`text-xs sm:text-sm font-bold font-cinzel line-clamp-2 mt-0.5 leading-snug ${getRarityTextGlow(item.rarity || 'RARE')}`}
                      title={item.name}
                    >
                      {item.name}
                    </h3>

                    {/* Price, Quantity, Min Power Pills */}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap text-[10px] font-mono">
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold flex items-center gap-1">
                        <Coins className="w-3 h-3 text-amber-400" />
                        <span>{item.price ? item.price.toLocaleString() : (th ? 'ฟรี' : 'Free')}</span>
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold flex items-center gap-1">
                        <Layers3 className="w-3 h-3 text-emerald-400" />
                        <span>x{item.quantity}</span>
                      </span>
                      {item.minPowerLevel > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-300 font-bold flex items-center gap-1">
                          <Zap className="w-3 h-3 text-sky-400" />
                          <span>PL {item.minPowerLevel.toLocaleString()}+</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions for Admin / Owner */}
                  {isAdminOrOwner && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditForm(item)}
                        className="p-1.5 rounded-lg bg-[#162235] hover:bg-[#1f314c] border border-slate-700 text-amber-300 transition-all cursor-pointer shadow-sm"
                        title={th ? 'แก้ไขไอเทม' : 'Edit item'}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          sounds.playClick();
                          setActiveQueueIdForAdd(activeQueueIdForAdd === item.id ? null : item.id);
                        }}
                        className={`p-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                          activeQueueIdForAdd === item.id
                            ? 'bg-sky-500/20 border-sky-400/50 text-sky-300'
                            : 'bg-[#162235] hover:bg-[#1f314c] border-slate-700 text-slate-200'
                        }`}
                        title={th ? 'เพิ่มสมาชิกลงคิวด้วยตนเอง' : 'Add member to queue manually'}
                      >
                        <UserPlus className="w-3.5 h-3.5 text-[#38bdf8]" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setItemToDelete(item)}
                        className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-300 hover:text-white transition-all cursor-pointer shadow-sm"
                        title={th ? 'ลบไอเทม' : 'Delete item'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Inline Add Member Expander */}
                {activeQueueIdForAdd === item.id && isAdminOrOwner && (
                  <div className="p-2.5 bg-[#0a0e18] border-b border-slate-800 space-y-2 animate-in fade-in duration-150">
                    <div className="text-[11px] text-amber-300 font-bold flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                      <span>{th ? 'เลือกสมาชิกลงคิว:' : 'Select Member:'}</span>
                    </div>
                    <select
                      value={selectedMemberIdForQueue}
                      onChange={(e) => setSelectedMemberIdForQueue(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg bg-[#111726] border border-amber-500/50 hover:border-amber-400 text-xs text-slate-100 focus:border-[#d4af37] focus:outline-none cursor-pointer"
                    >
                      <option value="">{th ? '-- คลิกเลือกชื่อสมาชิก --' : '-- Select member --'}</option>
                      {(Object.entries(membersByClan) as [string, User[]][]).map(([clanName, members]) => (
                        <optgroup key={clanName} label={`🛡️ ${cleanClanName(clanName)} (${members.length} ${th ? 'คน' : 'members'})`}>
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.inGameName} ({cleanClanName(m.clan)}) {m.powerLevel ? `• ⚡ ${m.powerLevel.toLocaleString()} PL` : ''}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>

                    <div className="flex items-center justify-end gap-1.5 pt-0.5">
                      <button
                        type="button"
                        disabled={!selectedMemberIdForQueue || busyItemId === item.id}
                        onClick={() => handleAdminAddMember(item.id)}
                        className="px-2.5 py-1 rounded bg-[#0284c7] hover:bg-[#0369a1] disabled:opacity-40 text-white text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{th ? 'เพิ่มลงคิว' : 'Add'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveQueueIdForAdd(null);
                          setSelectedMemberIdForQueue('');
                        }}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] cursor-pointer"
                      >
                        {th ? 'ยกเลิก' : 'Cancel'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Progress Bar (Sent vs Total) */}
                <div className="px-3 pt-2 pb-1 bg-[#090d16]">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span>{th ? 'สถานะการส่งมอบ' : 'Delivery Progress'}</span>
                    <span className="font-mono font-bold text-slate-300">{percentProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-300"
                      style={{ width: `${percentProgress}%` }}
                    />
                  </div>
                </div>

                {/* Queue Member Items List */}
                <div className="flex-1 p-2.5 space-y-1.5 overflow-y-auto max-h-[300px] min-h-[130px] custom-scrollbar bg-[#090d16]/50">
                  {pendingList.length === 0 ? (
                    <div className="h-24 flex flex-col items-center justify-center text-slate-500 text-xs gap-1.5">
                      <Users className="w-5 h-5 opacity-30 text-slate-400" />
                      <span>{th ? 'ยังไม่มีสมาชิกในคิว' : 'No players in queue'}</span>
                    </div>
                  ) : (
                    pendingList.map((member, index) => {
                      const isCurrentUserMember = currentUser && (member.userId === currentUser.id || member.name === currentUser.inGameName);

                      return (
                        <div
                          key={member.id}
                          className={`flex items-center justify-between p-2 rounded-lg border text-xs transition-all shadow-sm ${
                            isCurrentUserMember
                              ? 'bg-amber-950/25 border-[#d4af37]/60'
                              : 'bg-[#0e1422] border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {/* Rank & Name */}
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold shrink-0 shadow-sm ${
                                index === 0
                                  ? 'bg-gradient-to-r from-amber-400 to-yellow-600 text-slate-950 font-black'
                                  : index === 1
                                  ? 'bg-slate-300 text-slate-950'
                                  : index === 2
                                  ? 'bg-amber-700 text-white'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className={`font-bold truncate text-[11px] ${isCurrentUserMember ? 'text-amber-200' : 'text-slate-100'}`}>
                                  {member.name}
                                </span>
                                {member.clan && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                                    {cleanClanName(member.clan)}
                                  </span>
                                )}
                              </div>
                              {member.powerLevel ? (
                                <span className="text-[9.5px] font-mono text-sky-400 block">
                                  ⚡ {member.powerLevel.toLocaleString()} PL
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {/* Deliver Button for Admin/Owner */}
                          {isAdminOrOwner && (
                            <button
                              type="button"
                              onClick={() => openDeliverModal(item, member)}
                              className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:brightness-110 text-slate-950 text-[10.5px] font-black shadow-sm transition-all cursor-pointer flex items-center gap-1 shrink-0"
                              title={th ? 'ส่งมอบไอเทมให้สมาชิกคนนี้' : 'Deliver item to this member'}
                            >
                              <ReceiptText className="w-3 h-3" />
                              <span>{th ? 'ส่งมอบ' : 'Deliver'}</span>
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Receipt History Accordion */}
                {(item.receiptHistory || []).length > 0 && (
                  <div className="border-t border-slate-800/80 bg-[#0a0f1a] p-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedReceipts((prev) => ({
                          ...prev,
                          [item.id]: !prev[item.id]
                        }))
                      }
                      className="w-full flex items-center justify-between text-xs font-semibold text-cyan-400 hover:text-cyan-300 cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{th ? 'ประวัติผู้ได้รับ' : 'Delivery History'} ({(item.receiptHistory || []).length})</span>
                      </span>
                      {expandedReceipts[item.id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {expandedReceipts[item.id] && (
                      <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pt-1">
                        {(item.receiptHistory || [])
                          .slice()
                          .reverse()
                          .map((r) => (
                            <div key={r.id} className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-white">
                                  {r.name} <span className="text-emerald-400 font-mono">x{r.quantity} {th ? 'ชิ้น' : 'pcs'}</span>
                                </span>
                                <span className="text-[9.5px] text-slate-500 font-mono">
                                  {new Date(r.deliveredAt).toLocaleDateString(th ? 'th-TH' : 'en-US')}
                                </span>
                              </div>
                              {r.note && <p className="text-slate-400 text-[10px] italic">"{r.note}"</p>}
                              <div className="flex items-center justify-between pt-1">
                                <div className="flex items-center gap-2">
                                  {(r.receiptImages || []).map((url, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => {
                                        if (onViewImageZoom) onViewImageZoom(url, `${r.name} - ${th ? 'บิลส่งมอบ' : 'Receipt'}`);
                                      }}
                                      className="text-emerald-300 hover:underline flex items-center gap-0.5 text-[10px] font-bold"
                                    >
                                      <ReceiptText className="w-3 h-3" />
                                      <span>{th ? 'ดูบิล' : 'View bill'}</span>
                                    </button>
                                  ))}
                                </div>
                                {isAdminOrOwner && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingReceiptData({
                                        item,
                                        receipt: r,
                                        note: r.note || '',
                                        newReceiptFile: null,
                                        newReceiptPreview: (r.receiptImages && r.receiptImages[0]) || ''
                                      })
                                    }
                                    className="text-amber-300 hover:text-amber-200 text-[10px] font-bold hover:underline cursor-pointer"
                                  >
                                    {th ? 'แก้ไขบิล' : 'Edit bill'}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Card Footer: Join Queue / Leave Queue Action Button */}
                <div className="p-3 bg-[#0d1320] border-t border-slate-800">
                  <button
                    type="button"
                    disabled={!currentUser || busyItemId === item.id || (!meetsPowerReq && !isUserInQueue)}
                    onClick={() => handleToggleQueue(item)}
                    className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      isUserInQueue
                        ? 'bg-red-950/80 hover:bg-red-900 border border-red-800/80 text-red-200 hover:text-white'
                        : meetsPowerReq
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 text-white shadow-cyan-900/30'
                        : 'bg-slate-800 border border-slate-700 text-slate-500'
                    }`}
                  >
                    {busyItemId === item.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : isUserInQueue ? (
                      <>
                        <X className="w-4 h-4 text-red-400" />
                        <span>{th ? 'ยกเลิกการต่อคิว' : 'Leave Queue'}</span>
                      </>
                    ) : meetsPowerReq ? (
                      <>
                        <Plus className="w-4 h-4 text-white" />
                        <span>{th ? 'ลงชื่อต่อคิวรับไอเทม' : 'Join Queue'}</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 text-slate-500" />
                        <span>{th ? `พลังไม่ถึงขั้นต่ำ (${item.minPowerLevel.toLocaleString()})` : `Power too low (${item.minPowerLevel.toLocaleString()})`}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW (FULL-WIDTH DETAILED TABLE) */
        <div className="rounded-2xl border border-slate-800 bg-[#090d16] overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0e1422] border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">{th ? 'ไอเทม' : 'Item'}</th>
                  <th className="py-3 px-3">{th ? 'ระดับ' : 'Rarity'}</th>
                  <th className="py-3 px-3">{th ? 'ราคา' : 'Price'}</th>
                  <th className="py-3 px-3">{th ? 'จำนวน' : 'Quantity'}</th>
                  <th className="py-3 px-3">{th ? 'พลังขั้นต่ำ' : 'Min PL'}</th>
                  <th className="py-3 px-4">{th ? 'คิวที่รอรับ' : 'Current Queue'}</th>
                  <th className="py-3 px-4">{th ? 'การกระทำ' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {items.map((item) => {
                  const pendingList = (item.queueList || []).filter((m) => m.status === 'pending');
                  const isUserInQueue = currentUser && pendingList.some((m) => m.userId === currentUser.id);
                  const meetsPowerReq = !currentUser || currentUser.powerLevel >= (item.minPowerLevel || 0);

                  return (
                    <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                      {/* Item Info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {item.imageUrl ? (
                            <button
                              type="button"
                              onClick={() => {
                                sounds.playClick();
                                if (onViewImageZoom) onViewImageZoom(item.imageUrl, item.name);
                              }}
                              className="w-10 h-10 rounded-lg overflow-hidden border border-slate-700 shrink-0 hover:border-[#d4af37]"
                            >
                              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                            </button>
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                              <PackageCheck className="w-5 h-5 text-slate-500" />
                            </div>
                          )}
                          <div>
                            <span className={`font-bold block text-sm ${getRarityTextGlow(item.rarity || 'RARE')}`}>
                              {item.name}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {(item.receiptHistory || []).length} {th ? 'บิลส่งมอบ' : 'receipts'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Rarity */}
                      <td className="py-3 px-3">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${getRarityBadge(item.rarity || 'RARE')}`}>
                          {item.rarity || 'RARE'}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="py-3 px-3 font-mono font-bold text-amber-300">
                        {item.price ? `${item.price.toLocaleString()} 💎` : (th ? 'ฟรี' : 'Free')}
                      </td>

                      {/* Quantity */}
                      <td className="py-3 px-3 font-mono font-bold text-emerald-300">
                        x{item.quantity}
                      </td>

                      {/* Min Power */}
                      <td className="py-3 px-3 font-mono text-sky-300">
                        {item.minPowerLevel ? `${item.minPowerLevel.toLocaleString()}+` : '-'}
                      </td>

                      {/* Queue List Preview */}
                      <td className="py-3 px-4">
                        {pendingList.length === 0 ? (
                          <span className="text-slate-500 text-[11px]">{th ? 'ไม่มีคนรอ' : 'Empty queue'}</span>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap max-w-xs">
                            {pendingList.slice(0, 3).map((m, idx) => (
                              <span key={m.id} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-semibold text-slate-200">
                                #{idx + 1} {m.name}
                              </span>
                            ))}
                            {pendingList.length > 3 && (
                              <span className="text-[10px] text-slate-500 font-mono">
                                +{pendingList.length - 3} {th ? 'คน' : 'more'}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={!currentUser || (!meetsPowerReq && !isUserInQueue)}
                            onClick={() => handleToggleQueue(item)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              isUserInQueue
                                ? 'bg-red-950 border border-red-800 text-red-200 hover:text-white'
                                : meetsPowerReq
                                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:brightness-110'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            {isUserInQueue ? (th ? 'ยกเลิก' : 'Leave') : (th ? 'ลงชื่อ' : 'Join')}
                          </button>

                          {isAdminOrOwner && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditForm(item)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300"
                                title={th ? 'แก้ไข' : 'Edit'}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setItemToDelete(item)}
                                className="p-1.5 rounded-lg bg-red-950/60 hover:bg-red-800 text-red-300"
                                title={th ? 'ลบ' : 'Delete'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DELIVER ITEM MODAL (Replaces window.prompt) */}
      {deliveryModalData && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-150"
          onMouseDown={(e) => e.target === e.currentTarget && setDeliveryModalData(null)}
        >
          <form
            onSubmit={handleConfirmDelivery}
            className="w-full max-w-lg rounded-2xl border border-amber-500/40 bg-[#0b101b] shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4 bg-[#0e1524]">
              <div className="flex items-center gap-2">
                <ReceiptText className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold font-cinzel text-white">
                  {th ? 'ส่งมอบไอเทมทั่วไป & แนบบิล' : 'Deliver Item & Attach Receipt'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDeliveryModalData(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Recipient & Item Summary */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">{th ? 'ไอเทมที่ส่งมอบ:' : 'Item to deliver:'}</span>
                  <span className="font-bold text-white text-sm">{deliveryModalData.item.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">{th ? 'ผู้รับไอเทม:' : 'Recipient:'}</span>
                  <span className="font-bold text-amber-300 text-sm">{deliveryModalData.member.name}</span>
                  <span className="text-slate-500 ml-1">({cleanClanName(deliveryModalData.member.clan)})</span>
                </div>
              </div>

              {/* Quantity Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {th ? 'จำนวนที่ส่งมอบ' : 'Quantity to deliver'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={deliveryModalData.item.quantity}
                  value={deliveryModalData.quantity}
                  onChange={(e) =>
                    setDeliveryModalData({
                      ...deliveryModalData,
                      quantity: Math.max(1, Math.min(deliveryModalData.item.quantity, Number(e.target.value) || 1))
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#090d16] border border-slate-700 focus:border-amber-400 text-white font-mono font-bold text-sm focus:outline-none"
                />
              </div>

              {/* Note / Bill Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {th ? 'หมายเหตุ / เลขที่บิล (เว้นว่างได้)' : 'Note / Bill Number (optional)'}
                </label>
                <input
                  type="text"
                  placeholder={th ? 'เช่น บิลรอบที่ 1, มอบให้ตัวหลัก' : 'e.g. Round 1, Delivered in-game'}
                  value={deliveryModalData.note}
                  onChange={(e) => setDeliveryModalData({ ...deliveryModalData, note: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#090d16] border border-slate-700 focus:border-amber-400 text-white text-xs focus:outline-none"
                />
              </div>

              {/* Receipt Image Upload & Paste */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {th ? 'รูปถ่ายใบเสร็จ / บิลส่งมอบ (ถ้ามี)' : 'Receipt image (optional)'}
                </label>
                <div
                  tabIndex={0}
                  onPaste={(e) => {
                    const file = e.clipboardData?.items?.[0]?.getAsFile();
                    if (file && file.type.startsWith('image/')) {
                      compressImageFile(file, { maxWidth: 800, maxHeight: 800, quality: 0.74 }).then((preview) => {
                        setDeliveryModalData({
                          ...deliveryModalData,
                          receiptFile: file,
                          receiptPreview: preview
                        });
                      });
                    }
                  }}
                  className="p-3 rounded-xl border border-dashed border-slate-700 bg-slate-900/60 flex items-center justify-between gap-3 cursor-pointer hover:border-amber-400 outline-none"
                >
                  <label htmlFor="file-delivery-receipt" className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <Upload className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{th ? 'เลือกรูปภาพ หรือกด Ctrl + V เพื่อวางรูป' : 'Choose image or press Ctrl + V'}</span>
                    <input
                      id="file-delivery-receipt"
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const preview = await compressImageFile(file, { maxWidth: 800, maxHeight: 800, quality: 0.74 });
                          setDeliveryModalData({
                            ...deliveryModalData,
                            receiptFile: file,
                            receiptPreview: preview
                          });
                        }
                        e.currentTarget.value = '';
                      }}
                      className="hidden"
                    />
                  </label>
                  {deliveryModalData.receiptPreview && (
                    <div className="relative shrink-0">
                      <img
                        src={deliveryModalData.receiptPreview}
                        alt="receipt preview"
                        className="w-10 h-10 rounded object-cover border border-amber-400"
                      />
                      <button
                        type="button"
                        onClick={() => setDeliveryModalData({ ...deliveryModalData, receiptFile: null, receiptPreview: '' })}
                        className="absolute -top-1 -right-1 p-0.5 bg-red-600 rounded-full text-white"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-800 px-5 py-3.5 bg-[#0e1524]">
              <button
                type="button"
                onClick={() => setDeliveryModalData(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                {th ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isDelivering}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:brightness-110 text-slate-950 text-xs font-bold shadow-md"
              >
                {isDelivering ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                <span>{isDelivering ? (th ? 'กำลังส่งมอบ...' : 'Delivering...') : (th ? 'ยืนยันส่งมอบ' : 'Confirm Delivery')}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EDIT RECEIPT MODAL */}
      {editingReceiptData && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-150"
          onMouseDown={(e) => e.target === e.currentTarget && setEditingReceiptData(null)}
        >
          <form
            onSubmit={handleConfirmEditReceipt}
            className="w-full max-w-lg rounded-2xl border border-cyan-500/40 bg-[#0b101b] shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4 bg-[#0e1524]">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold font-cinzel text-white">
                  {th ? 'แก้ไขข้อมูลบิลส่งมอบ' : 'Edit Delivery Receipt'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingReceiptData(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {th ? 'หมายเหตุ / เลขที่บิล' : 'Note / Bill Number'}
                </label>
                <input
                  type="text"
                  value={editingReceiptData.note}
                  onChange={(e) => setEditingReceiptData({ ...editingReceiptData, note: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#090d16] border border-slate-700 focus:border-cyan-400 text-white text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {th ? 'เปลี่ยนรูปใบเสร็จใหม่ (ถ้าต้องการ)' : 'Replace receipt image (optional)'}
                </label>
                <label className="p-3 rounded-xl border border-dashed border-slate-700 bg-slate-900/60 flex items-center justify-between gap-3 cursor-pointer hover:border-cyan-400">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <Upload className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>{th ? 'คลิกเพื่อเลือกไฟล์รูปใหม่' : 'Click to select new image'}</span>
                  </div>
                  {editingReceiptData.newReceiptPreview && (
                    <img
                      src={editingReceiptData.newReceiptPreview}
                      alt="receipt"
                      className="w-10 h-10 rounded object-cover border border-cyan-400 shrink-0"
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const preview = await compressImageFile(file, { maxWidth: 800, maxHeight: 800, quality: 0.74 });
                        setEditingReceiptData({
                          ...editingReceiptData,
                          newReceiptFile: file,
                          newReceiptPreview: preview
                        });
                      }
                      e.currentTarget.value = '';
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-800 px-5 py-3.5 bg-[#0e1524]">
              <button
                type="button"
                onClick={() => setEditingReceiptData(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                {th ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isUpdatingReceipt}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 text-white text-xs font-bold shadow-md"
              >
                {isUpdatingReceipt ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                <span>{isUpdatingReceipt ? (th ? 'กำลังบันทึก...' : 'Saving...') : (th ? 'บันทึกการแก้ไข' : 'Save Changes')}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CONFIRM DELETE ITEM DIALOG */}
      {itemToDelete && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-150"
          onMouseDown={(e) => e.target === e.currentTarget && setItemToDelete(null)}
        >
          <div className="w-full max-w-sm rounded-2xl border border-red-500/40 bg-[#0f1422] p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2 rounded-xl bg-red-950/80 border border-red-800/80">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold font-cinzel text-white">
                {th ? 'ยืนยันลบไอเทม' : 'Confirm Delete Item'}
              </h3>
            </div>
            <p className="text-xs text-slate-300">
              {th
                ? `คุณแน่ใจหรือไม่ว่าต้องการลบไอเทม "${itemToDelete.name}" ออกจากคิว? ข้อมูลคิวและประวัติจะถูกลบทั้งหมด`
                : `Are you sure you want to remove "${itemToDelete.name}" from the queue? All waiting members and receipts will be removed.`}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                {th ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = itemToDelete.id;
                  setItemToDelete(null);
                  await onDelete(id);
                  if (showToast) showToast(th ? 'ลบไอเทมเรียบร้อยแล้ว' : 'Item deleted', 'info');
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md"
              >
                {th ? 'ลบไอเทม' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
