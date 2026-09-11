import React, { useState, useMemo, useEffect } from 'react';
import {
  Crown,
  Plus,
  Trash2,
  CheckCircle,
  Clock,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Sparkles,
  Upload,
  UserPlus,
  AlertCircle,
  UserCheck,
  ChevronDown,
  RotateCcw,
  ClipboardCheck
} from 'lucide-react';
import { compressImageFile } from '../utils/imageCompressor';
import {
  ItemRarity,
  Language,
  QueueItem,
  QueueMember,
  QuickItem,
  User
} from '../types';
import { translations } from '../translations';
import { sounds } from '../utils/sound';

interface QueueViewProps {
  lang: Language;
  currentUser: User | null;
  allMembers: User[];
  queueItems: QueueItem[];
  quickItems: QuickItem[];
  onOpenQuickItemsModal?: () => void;
  onCreateQueueItem: (item: Omit<QueueItem, 'id' | 'createdAt'>) => Promise<void>;
  onDeleteQueueItem: (queueId: string) => Promise<void>;
  onUpdateQueueMembers: (queueId: string, members: QueueMember[]) => Promise<void>;
  onOpenOwnerResetModal?: () => void;
  onOpenAuth?: () => void;
  showToast?: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export const QueueView: React.FC<QueueViewProps> = ({
  lang,
  currentUser,
  allMembers,
  queueItems,
  quickItems,
  onOpenQuickItemsModal,
  onCreateQueueItem,
  onDeleteQueueItem,
  onUpdateQueueMembers,
  onOpenOwnerResetModal,
  onOpenAuth,
  showToast
}) => {
  const t = translations[lang];
  const isAdminOrOwner =
    currentUser?.role === 'owner' ||
    currentUser?.role === 'admin' ||
    currentUser?.role === 'manager';

  // Create queue modal form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [queueToDelete, setQueueToDelete] = useState<QueueItem | null>(null);
  const [name, setName] = useState('');
  const [rarity, setRarity] = useState<ItemRarity>('LAGEND');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Add player to queue inline state
  const [activeQueueIdForAdd, setActiveQueueIdForAdd] = useState<string | null>(null);
  const [selectedMemberIdForQueue, setSelectedMemberIdForQueue] = useState<string>('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerClan, setNewPlayerClan] = useState('Clan:VoltZ');

  // Group active members by Clan for dropdown selection
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

  // Dragging state for queue reordering
  const [draggedQueueId, setDraggedQueueId] = useState<string | null>(null);
  const [draggedMemberIndex, setDraggedMemberIndex] = useState<number | null>(null);

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

  const processQueueImageFile = async (file: File, isPaste = false) => {
    try {
      const compressed = await compressImageFile(file, { maxWidth: 600, maxHeight: 600, quality: 0.8 });
      setImagePreview(compressed);
      setImageUrl(compressed);
      sounds.playClick();
      if (isPaste && showToast) {
        showToast(
          lang === 'th' ? 'วางรูปภาพไอเทมสำเร็จ (Ctrl + V) 📋' : 'Queue item image pasted (Ctrl + V) 📋',
          'success'
        );
      }
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result as string;
        setImagePreview(res);
        setImageUrl(res);
        sounds.playClick();
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processQueueImageFile(file, false);
    e.target.value = '';
  };

  const handlePasteQueueImageZone = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          e.stopPropagation();
          processQueueImageFile(file, true);
          break;
        }
      }
    }
  };

  // Window paste listener when create queue form is visible
  useEffect(() => {
    if (!showAddForm) return;

    const handleWindowPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            processQueueImageFile(file, true);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => {
      window.removeEventListener('paste', handleWindowPaste);
    };
  }, [showAddForm, lang, showToast]);

  const handleApplyQuickItem = (item: QuickItem) => {
    sounds.playClick();
    setName(item.name);
    setRarity(item.rarity);
    setImageUrl(item.imageUrl);
    setImagePreview(item.imageUrl);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim()) {
      setFormError(lang === 'th' ? 'กรุณาระบุชื่อไอเทม' : 'Item name required');
      return;
    }

    setIsSubmitting(true);
    try {
      sounds.playClaim();
      await onCreateQueueItem({
        name: name.trim(),
        rarity,
        imageUrl: imageUrl.trim() || undefined,
        queueList: []
      });
      setName('');
      setImageUrl('');
      setImagePreview('');
      setShowAddForm(false);
    } catch {
      setFormError(t.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add member to specific queue
  const handleAddMemberToQueue = async (queueId: string) => {
    if (!newPlayerName.trim()) return;
    const queue = queueItems.find((q) => q.id === queueId);
    if (!queue) return;

    sounds.playClick();
    const matched = allMembers.find(
      (m) =>
        (selectedMemberIdForQueue && m.id === selectedMemberIdForQueue) ||
        m.inGameName.toLowerCase() === newPlayerName.trim().toLowerCase()
    );

    const newMember: QueueMember = {
      id: 'qm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      userId: matched?.id,
      name: newPlayerName.trim() || matched?.inGameName || '',
      clan: newPlayerClan.trim() || matched?.clan || 'Clan:VoltZ',
      powerLevel: matched?.powerLevel,
      status: 'pending'
    };

    const updated = [...queue.queueList, newMember];
    await onUpdateQueueMembers(queueId, updated);
    setNewPlayerName('');
    setNewPlayerClan('');
    setSelectedMemberIdForQueue('');
    setActiveQueueIdForAdd(null);
  };

  // Remove member from queue
  const handleRemoveMember = async (queueId: string, memberId: string) => {
    sounds.playClick();
    const queue = queueItems.find((q) => q.id === queueId);
    if (!queue) return;
    const updated = queue.queueList.filter((m) => m.id !== memberId);
    await onUpdateQueueMembers(queueId, updated);
  };

  // Toggle status (received / pending)
  const handleToggleStatus = async (queueId: string, memberId: string) => {
    sounds.playClick();
    const queue = queueItems.find((q) => q.id === queueId);
    if (!queue) return;

    const updated = queue.queueList.map((m) => {
      if (m.id === memberId) {
        const nextStatus = m.status === 'received' ? 'pending' : 'received';
        return {
          ...m,
          status: nextStatus as 'pending' | 'received',
          receivedAt: nextStatus === 'received' ? Date.now() : undefined
        };
      }
      return m;
    });

    await onUpdateQueueMembers(queueId, updated);
  };

  // Move member up/down
  const handleMoveMember = async (queueId: string, index: number, direction: 'up' | 'down') => {
    sounds.playClick();
    const queue = queueItems.find((q) => q.id === queueId);
    if (!queue) return;

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= queue.queueList.length) return;

    const list = [...queue.queueList];
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;

    await onUpdateQueueMembers(queueId, list);
  };

  // Drag and drop member reorder
  const handleDragStart = (queueId: string, index: number) => {
    setDraggedQueueId(queueId);
    setDraggedMemberIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (queueId: string, dropIndex: number) => {
    if (draggedQueueId !== queueId || draggedMemberIndex === null) return;
    if (draggedMemberIndex === dropIndex) return;

    const queue = queueItems.find((q) => q.id === queueId);
    if (!queue) return;

    const list = [...queue.queueList];
    const [movedItem] = list.splice(draggedMemberIndex, 1);
    list.splice(dropIndex, 0, movedItem);

    setDraggedQueueId(null);
    setDraggedMemberIndex(null);
    sounds.playClick();
    await onUpdateQueueMembers(queueId, list);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-[#fff2b8] via-[#e6be44] to-[#c99a22]">
            {t.queueTitle}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            {t.queueDesc}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {currentUser?.role === 'owner' && onOpenOwnerResetModal && (
            <button
              id="btn-queue-owner-reset"
              onClick={() => {
                sounds.playClick();
                onOpenOwnerResetModal();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-950/80 border border-red-800/80 hover:border-red-500 text-red-200 hover:text-white text-xs font-bold shadow-md transition-all cursor-pointer group"
              title={t.ownerResetDesc}
            >
              <RotateCcw className="w-4 h-4 text-red-400 group-hover:-rotate-90 transition-transform" />
              <span>{t.ownerResetBtn}</span>
            </button>
          )}

          {isAdminOrOwner && (
            <button
              id="btn-open-add-queue"
              onClick={() => {
                sounds.playClick();
                setShowAddForm(!showAddForm);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#aa841c] hover:brightness-110 text-slate-950 text-xs font-bold shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t.addQueueItem}</span>
            </button>
          )}
        </div>
      </div>

      {/* CREATE QUEUE ITEM FORM */}
      {showAddForm && isAdminOrOwner && (
        <form
          onSubmit={handleCreateSubmit}
          className="rounded-xl bg-[#0e1422] border border-[#d4af37]/40 p-6 shadow-2xl space-y-4 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold font-cinzel text-[#f5d77f] flex items-center gap-2">
              <Crown className="w-4 h-4" />
              <span>{t.addQueueItem}</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-slate-400 hover:text-white text-xs"
            >
              {t.cancel}
            </button>
          </div>

          {/* Quick preset pick */}
          <div className="p-3 rounded-xl bg-[#090e1a] border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                {t.selectFromQuickItem}:
              </span>
              {onOpenQuickItemsModal && isAdminOrOwner && (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    onOpenQuickItemsModal();
                  }}
                  className="flex items-center gap-1 text-[11px] font-bold text-[#f5d77f] hover:text-white px-2 py-0.5 rounded bg-[#1a253a] hover:bg-[#223250] border border-[#d4af37]/40 transition-all cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-[#f5d77f]" />
                  <span>{t.manageQuickItems}</span>
                </button>
              )}
            </div>
            {quickItems.length > 0 ? (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {quickItems.map((qi) => (
                  <button
                    key={qi.id}
                    type="button"
                    onClick={() => handleApplyQuickItem(qi)}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-[#111827] hover:bg-[#1e293b] border border-slate-700/80 hover:border-[#d4af37]/60 text-slate-200 hover:text-white flex items-center gap-2 shrink-0 transition-all shadow-sm cursor-pointer"
                  >
                    <img
                      src={qi.imageUrl}
                      alt={qi.name}
                      className="w-6 h-6 rounded object-cover border border-slate-600 shrink-0"
                    />
                    <span className="font-semibold">{qi.name}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-slate-800 text-amber-300 border border-slate-700">
                      {qi.rarity}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                {lang === 'th' ? 'ยังไม่มีควิกไอเทม' : 'No quick items registered yet'}
              </p>
            )}
          </div>

          {formError && (
            <div className="p-2 rounded bg-red-950/70 border border-red-800 text-xs text-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {t.itemName} *
              </label>
              <input
                id="input-queue-item-name"
                type="text"
                required
                placeholder="e.g. Archangel's Sword"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#090d16] border border-slate-700 focus:border-[#d4af37] text-slate-100 text-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {t.itemRarity}
              </label>
              <select
                id="select-queue-rarity"
                value={rarity}
                onChange={(e) => setRarity(e.target.value as ItemRarity)}
                className="w-full px-3 py-2 rounded-lg bg-[#090d16] border border-slate-700 focus:border-[#d4af37] text-slate-100 text-sm focus:outline-none"
              >
                <option value="RARE">{t.rarityRare}</option>
                <option value="EPIC">{t.rarityEpic}</option>
                <option value="LAGEND">{t.rarityLegend}</option>
                <option value="MYTHIC">{t.rarityMythic}</option>
              </select>
            </div>
          </div>

          {/* Optional image upload */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <label
              tabIndex={0}
              onPaste={handlePasteQueueImageZone}
              htmlFor="file-queue-image"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#162032] hover:bg-[#202f48] border border-dashed border-[#d4af37]/50 hover:border-[#d4af37] text-xs text-slate-200 cursor-pointer transition-all outline-none"
              title={lang === 'th' ? 'คลิกเลือกไฟล์ หรือกด Ctrl + V เพื่อวางรูป' : 'Click to choose or Ctrl + V to paste'}
            >
              <Upload className="w-4 h-4 text-[#d4af37]" />
              <span>{lang === 'th' ? 'เลือกรูปภาพ หรือกด Ctrl + V วางรูป' : 'Choose Image or Ctrl + V to paste'}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-amber-300 border border-slate-700">
                Ctrl + V
              </span>
              <input
                id="file-queue-image"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>

            {imagePreview && (
              <div className="flex items-center gap-2">
                <img
                  src={imagePreview}
                  alt="preview"
                  className="w-9 h-9 rounded object-cover border border-slate-700"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview('');
                    setImageUrl('');
                  }}
                  className="text-xs text-red-400 hover:underline"
                >
                  {t.delete}
                </button>
              </div>
            )}

            <div className="flex-1 flex justify-end gap-2">
              <button
                id="btn-submit-queue-item"
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg bg-[#d4af37] hover:bg-[#e6be44] text-slate-950 font-bold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? t.loading : t.addQueueItem}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* QUEUE ITEMS LIST (แสดงเป็นตารางแนวนอนพร้อมรูปภาพ หรือกล่องรอรูปภาพ) */}
      <div className="space-y-6">
        {queueItems.length === 0 ? (
          <div className="p-12 rounded-xl bg-[#0c121e] border border-slate-800 text-center text-xs text-slate-500">
            {t.noQueueItems}
          </div>
        ) : (
          queueItems.map((queue) => {
            const userIndex = currentUser
              ? queue.queueList.findIndex(
                  (m) =>
                    (m.userId && m.userId === currentUser.id) ||
                    (m.name && currentUser.inGameName && m.name.trim().toLowerCase() === currentUser.inGameName.trim().toLowerCase())
                )
              : -1;
            const isUserInQueue = userIndex !== -1;

            return (
              <div
                key={queue.id}
                className="rounded-xl bg-gradient-to-b from-[#111726] to-[#090d16] border border-slate-800 shadow-xl overflow-hidden"
              >
              {/* Header row for this Queue Item */}
              <div className="p-4 bg-[#0d1320] border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  
                  {/* Image or Placeholder box waiting for image */}
                  {queue.imageUrl ? (
                    <img
                      src={queue.imageUrl}
                      alt={queue.name}
                      className="w-14 h-14 rounded-lg object-cover border border-slate-700 shadow-sm shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-[#141b2b] border border-dashed border-slate-700 flex items-center justify-center text-[10px] text-slate-400 text-center p-1.5 shrink-0">
                      {t.waitingForImage}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-100 font-cinzel">
                        {queue.name}
                      </h3>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${getRarityBadge(queue.rarity)}`}>
                        {queue.rarity}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {queue.queueList.length} {lang === 'th' ? 'คน' : 'players'}
                      {queue.queueList.some((m) => m.status === 'received') && (
                        <span className="ml-2 text-emerald-400">
                          ({queue.queueList.filter((m) => m.status === 'received').length} {t.statusReceived})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Queue controls (Admin/Owner only) */}
                <div className="flex items-center gap-2">

                  {isAdminOrOwner && (
                    <>
                      <button
                        id={`btn-toggle-add-member-${queue.id}`}
                        onClick={() => {
                          sounds.playClick();
                          setActiveQueueIdForAdd(
                            activeQueueIdForAdd === queue.id ? null : queue.id
                          );
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#162235] hover:bg-[#1f314c] border border-slate-700 text-xs font-semibold text-slate-200 transition-all cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-[#38bdf8]" />
                        <span>{t.addMemberToQueue}</span>
                      </button>

                      <button
                        id={`btn-delete-queue-${queue.id}`}
                        onClick={() => {
                          sounds.playClick();
                          setQueueToDelete(queue);
                        }}
                        className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-300 hover:text-white transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
                        title={t.removeQueueItem}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Inline Add Player form - Dropdown Selection (No typing needed) */}
              {activeQueueIdForAdd === queue.id && isAdminOrOwner && (
                <div className="p-3 bg-[#0a0e18] border-b border-slate-800 flex flex-wrap items-center gap-2.5 animate-in fade-in duration-150">
                  <div className="flex items-center gap-2 flex-1 min-w-[280px]">
                    <div className="flex items-center gap-1.5 text-xs text-amber-300 font-bold shrink-0">
                      <UserCheck className="w-4 h-4 text-amber-400" />
                      <span>{lang === 'th' ? 'เลือกสมาชิก:' : 'Select Member:'}</span>
                    </div>
                    <select
                      id={`select-queue-member-${queue.id}`}
                      value={selectedMemberIdForQueue}
                      onChange={(e) => {
                        const mId = e.target.value;
                        setSelectedMemberIdForQueue(mId);
                        const mem = allMembers.find((m) => m.id === mId);
                        if (mem) {
                          setNewPlayerName(mem.inGameName);
                          setNewPlayerClan(mem.clan);
                        } else {
                          setNewPlayerName('');
                          setNewPlayerClan('');
                        }
                      }}
                      className="flex-1 px-3 py-2 rounded-lg bg-[#111726] border border-amber-500/50 hover:border-amber-400 text-xs text-slate-100 focus:border-[#d4af37] focus:outline-none cursor-pointer"
                    >
                      <option value="">
                        {lang === 'th'
                          ? '-- คลิกเลือกชื่อสมาชิกจากดรอปดาวน์ (ไม่ต้องพิมพ์) --'
                          : '-- Select member from dropdown (No typing) --'}
                      </option>
                      {(Object.entries(membersByClan) as [string, User[]][]).map(([clanName, members]) => (
                        <optgroup key={clanName} label={`🛡️ ${clanName} (${members.length} คน)`}>
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.inGameName} | {m.clan} {m.powerLevel ? `(${(m.powerLevel).toLocaleString()} CP)` : ''} {m.characterClass ? `• ${m.characterClass}` : ''}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  {newPlayerName && (
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs font-semibold">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{newPlayerName}</span>
                      <span className="text-slate-400 text-[11px]">({newPlayerClan})</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={!newPlayerName}
                      onClick={() => handleAddMemberToQueue(queue.id)}
                      className="px-3.5 py-2 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] disabled:opacity-40 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{lang === 'th' ? 'ยืนยันเพิ่มเข้าคิว' : 'Confirm Add'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveQueueIdForAdd(null);
                        setNewPlayerName('');
                        setNewPlayerClan('');
                        setSelectedMemberIdForQueue('');
                      }}
                      className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-all cursor-pointer"
                    >
                      {t.cancel}
                    </button>
                  </div>
                </div>
              )}

              {/* Horizontal table for Queue Members */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300 min-w-[650px]">
                  <thead className="bg-[#080d16] text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4 w-12 text-center">#</th>
                      <th className="py-2.5 px-4">{t.inGameName}</th>
                      <th className="py-2.5 px-4">{t.clanName}</th>
                      <th className="py-2.5 px-4">{t.powerLevel}</th>
                      <th className="py-2.5 px-4">Status</th>
                      {isAdminOrOwner && (
                        <th className="py-2.5 px-4 text-right">{t.actions}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {queue.queueList.length === 0 ? (
                      <tr>
                        <td colSpan={isAdminOrOwner ? 6 : 5} className="py-6 text-center text-slate-500 text-xs">
                          {lang === 'th' ? 'ยังไม่มีสมาชิกในคิว' : 'No players in queue'}
                        </td>
                      </tr>
                    ) : (
                      queue.queueList.map((member, index) => {
                        const isReceived = member.status === 'received';
                        const isThisUser = Boolean(
                          currentUser && (
                            (member.userId && member.userId === currentUser.id) ||
                            (member.name && currentUser.inGameName && member.name.trim().toLowerCase() === currentUser.inGameName.trim().toLowerCase())
                          )
                        );
                        return (
                          <tr
                            key={member.id}
                            draggable={isAdminOrOwner}
                            onDragStart={() => handleDragStart(queue.id, index)}
                            onDragOver={handleDragOver}
                            onDrop={() => handleDrop(queue.id, index)}
                            className={`hover:bg-[#111a2d]/50 transition-colors ${
                              isThisUser ? 'bg-[#211639]/50 border-l-2 border-[#a855f7]' : ''
                            } ${
                              isReceived ? 'opacity-60 bg-[#080d15]' : ''
                            }`}
                          >
                            {/* Priority Position & Drag Handle */}
                            <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-400">
                              <div className="flex items-center justify-center gap-1">
                                {isAdminOrOwner && (
                                  <GripVertical className="w-3.5 h-3.5 text-slate-600 hover:text-slate-300 cursor-grab active:cursor-grabbing" />
                                )}
                                <span>{index + 1}</span>
                              </div>
                            </td>

                            {/* Player Name */}
                            <td className="py-2.5 px-4 font-bold text-slate-100">
                              <div className="flex items-center gap-2">
                                <span>{member.name}</span>
                                {isThisUser && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 border border-purple-500/50 text-purple-300">
                                    {lang === 'th' ? 'คุณ' : 'You'}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Clan */}
                            <td className="py-2.5 px-4 text-slate-300">
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                                {member.clan}
                              </span>
                            </td>

                            {/* Power Level */}
                            <td className="py-2.5 px-4 font-mono text-amber-400 font-semibold">
                              {member.powerLevel ? `${member.powerLevel.toLocaleString()} CP` : '-'}
                            </td>

                            {/* Status: Received or Pending */}
                            <td className="py-2.5 px-4">
                              <button
                                disabled={!isAdminOrOwner}
                                onClick={() => handleToggleStatus(queue.id, member.id)}
                                className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold border transition-all ${
                                  isReceived
                                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60 hover:bg-emerald-900/60'
                                    : 'bg-amber-950/60 text-amber-300 border-amber-700/60 hover:bg-amber-900/60'
                                } ${!isAdminOrOwner ? 'cursor-default' : 'cursor-pointer'}`}
                                title={isAdminOrOwner ? 'Click to toggle status' : ''}
                              >
                                {isReceived ? (
                                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Clock className="w-3 h-3 text-amber-400" />
                                )}
                                <span>{isReceived ? t.statusReceived : t.statusPending}</span>
                              </button>
                            </td>

                            {/* Action controls (Move up, down, remove) */}
                            {isAdminOrOwner && (
                              <td className="py-2.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleMoveMember(queue.id, index, 'up')}
                                    disabled={index === 0}
                                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                    title="Move Up"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleMoveMember(queue.id, index, 'down')}
                                    disabled={index === queue.queueList.length - 1}
                                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                    title="Move Down"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleRemoveMember(queue.id, member.id)}
                                    className="p-1 rounded bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-white cursor-pointer transition-colors"
                                    title={t.delete}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer drag tip */}
              {isAdminOrOwner && queue.queueList.length > 1 && (
                <div className="p-2 bg-[#080d16] text-[10px] text-slate-500 text-center border-t border-slate-800/80">
                  {t.dragToReorder}
                </div>
              )}
            </div>
          );
        })
      )}
      </div>

      {/* IN-APP CONFIRM DELETE QUEUE MODAL */}
      {queueToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-2xl bg-gradient-to-b from-[#181015] via-[#100a0e] to-[#080507] border border-red-500/50 shadow-[0_20px_60px_rgba(0,0,0,0.95),0_0_30px_rgba(239,68,68,0.25)] p-6 text-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/50 text-red-400 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  {lang === 'th' ? 'ยืนยันการลบคิว' : 'Confirm Delete Queue'}
                </h3>
                <p className="text-xs text-red-400/90 font-medium">
                  {lang === 'th' ? 'การกระทำนี้จะลบคิวไอเทมและรายชื่อทั้งหมด' : 'Permanently removes queue and members'}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300 mb-5 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">{t.itemName}:</span>
                <span className="font-bold text-slate-100">{queueToDelete.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{t.rarity}:</span>
                <span className="font-semibold text-amber-300">{queueToDelete.rarity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'th' ? 'จำนวนในคิว:' : 'Members in queue:'}</span>
                <span className="font-mono text-sky-400 font-bold">{queueToDelete.queueList?.length || 0}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setQueueToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-600 transition-all cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                id="btn-confirm-delete-queue-modal"
                onClick={() => {
                  sounds.playClick();
                  onDeleteQueueItem(queueToDelete.id);
                  setQueueToDelete(null);
                }}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-xs shadow-lg shadow-red-900/50 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{lang === 'th' ? 'ยืนยันลบคิว' : 'Delete Queue'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
