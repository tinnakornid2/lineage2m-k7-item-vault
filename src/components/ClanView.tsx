import React, { useState } from 'react';
import {
  Shield,
  Plus,
  Trash2,
  Users,
  Zap,
  GripVertical,
  CheckSquare,
  Square,
  AlertCircle,
  MoveRight,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Palette,
  X,
  Check,
  ArrowLeftRight
} from 'lucide-react';
import { ClanGroup, Language, User, cleanClanName, OFFICIAL_CLANS } from '../types';
import { translations } from '../translations';
import { sounds } from '../utils/sound';

interface ClanViewProps {
  lang: Language;
  currentUser: User | null;
  allMembers: User[];
  clans: ClanGroup[];
  onAddClan: (clanName: string, color?: string) => Promise<void>;
  onUpdateClan: (clanId: string, newName: string, newColor?: string) => Promise<void>;
  onDeleteClan: (clanId: string) => Promise<void>;
  onReorderClans: (orderedClans: ClanGroup[]) => Promise<void>;
  onMoveMemberClan: (userId: string, newClanName: string) => Promise<void>;
  onDeleteMember: (userId: string) => Promise<void>;
  onBatchDeleteMembers: (userIds: string[]) => Promise<void>;
  onAddMemberQuick?: (member: Partial<User>) => Promise<void>;
}

const CLAN_COLOR_FALLBACK: Record<string, string> = {
  voltz: '#22c55e',
  levels: '#ef4444',
  stronk: '#eab308',
  'no-clan': '#3b82f6'
};

const COLOR_PRESETS = [
  { label: 'Emerald (Green)', hex: '#22c55e' },
  { label: 'Crimson (Red)', hex: '#ef4444' },
  { label: 'Gold (Yellow)', hex: '#eab308' },
  { label: 'Sapphire (Blue)', hex: '#3b82f6' },
  { label: 'Purple', hex: '#8b5cf6' },
  { label: 'Rose Pink', hex: '#ec4899' },
  { label: 'Cyan', hex: '#06b6d4' },
  { label: 'Fire Orange', hex: '#f97316' },
  { label: 'Teal', hex: '#14b8a6' },
  { label: 'Slate Gray', hex: '#64748b' }
];

export const ClanView: React.FC<ClanViewProps> = ({
  lang,
  currentUser,
  allMembers,
  clans,
  onAddClan,
  onUpdateClan,
  onDeleteClan,
  onReorderClans,
  onMoveMemberClan,
  onDeleteMember,
  onBatchDeleteMembers
}) => {
  const t = translations[lang];
  const isAdminOrOwner =
    currentUser?.role === 'owner' ||
    currentUser?.role === 'admin' ||
    currentUser?.role === 'manager';

  // Add clan state
  const [showAddClan, setShowAddClan] = useState(false);
  const [newClanName, setNewClanName] = useState('');
  const [newClanColor, setNewClanColor] = useState('#d4af37');

  // Edit clan state
  const [editingClan, setEditingClan] = useState<ClanGroup | null>(null);
  const [editClanName, setEditClanName] = useState('');
  const [editClanColor, setEditClanColor] = useState('#d4af37');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete clan state
  const [clanToDelete, setClanToDelete] = useState<ClanGroup | null>(null);

  // Batch delete selection
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [memberToDelete, setMemberToDelete] = useState<User | null>(null);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);

  // Drag-and-drop state: Members & Column Clan Reordering
  const [draggedUserId, setDraggedUserId] = useState<string | null>(null);
  const [draggedClanId, setDraggedClanId] = useState<string | null>(null);
  const [dragOverClanId, setDragOverClanId] = useState<string | null>(null);

  // Only active members
  const activeMembers = allMembers.filter((m) => m.status === 'active');

  // Compile list of clans dynamically preserving custom order
  const clanMap = new Map<string, ClanGroup>();
  clans.forEach((c, idx) => {
    const cleanName = cleanClanName(c.name);
    if (cleanName && !clanMap.has(cleanName.toLowerCase())) {
      clanMap.set(cleanName.toLowerCase(), {
        ...c,
        name: cleanName,
        color: c.color || CLAN_COLOR_FALLBACK[cleanName.toLowerCase()] || '#d4af37',
        order: c.order ?? idx
      });
    }
  });

  // Ensure any member whose clan isn't registered yet is included
  activeMembers.forEach((m) => {
    const cleanName = cleanClanName(m.clan);
    if (cleanName && !clanMap.has(cleanName.toLowerCase())) {
      clanMap.set(cleanName.toLowerCase(), {
        id: 'clan_' + cleanName.toLowerCase(),
        name: cleanName,
        color: CLAN_COLOR_FALLBACK[cleanName.toLowerCase()] || '#64748b',
        order: clanMap.size
      });
    }
  });

  // Fallback to official 4 clans if totally empty
  if (clanMap.size === 0) {
    OFFICIAL_CLANS.forEach((c) => clanMap.set(cleanClanName(c.name).toLowerCase(), c));
  }

  // Sorted list of clans by order
  const displayClans = Array.from(clanMap.values()).sort(
    (a, b) => (a.order ?? 999) - (b.order ?? 999)
  );

  // Member Drag-and-drop handlers
  const handleMemberDragStart = (userId: string) => {
    setDraggedUserId(userId);
  };

  const handleMemberDropOnClan = async (targetClanName: string) => {
    if (!draggedUserId) return;
    const cleanTarget = cleanClanName(targetClanName);
    const member = activeMembers.find((m) => m.id === draggedUserId);
    if (!member || cleanClanName(member.clan) === cleanTarget) {
      setDraggedUserId(null);
      return;
    }

    sounds.playClaim();
    await onMoveMemberClan(draggedUserId, cleanTarget);
    setDraggedUserId(null);
  };

  // Clan Column Reordering (Arrow Buttons & Drag-and-Drop)
  const handleMoveClan = async (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= displayClans.length) return;
    sounds.playClick();
    const reordered = [...displayClans];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;
    await onReorderClans(reordered);
  };

  const handleClanDragStart = (e: React.DragEvent, clanId: string) => {
    // Only trigger if dragging column handle
    setDraggedClanId(clanId);
    e.dataTransfer.setData('text/plain', clanId);
  };

  const handleClanHeaderDrop = async (targetClanId: string) => {
    if (!draggedClanId || draggedClanId === targetClanId) {
      setDraggedClanId(null);
      setDragOverClanId(null);
      return;
    }
    sounds.playClaim();
    const fromIdx = displayClans.findIndex((c) => c.id === draggedClanId);
    const toIdx = displayClans.findIndex((c) => c.id === targetClanId);
    if (fromIdx === -1 || toIdx === -1) {
      setDraggedClanId(null);
      setDragOverClanId(null);
      return;
    }
    const reordered = [...displayClans];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setDraggedClanId(null);
    setDragOverClanId(null);
    await onReorderClans(reordered);
  };

  // Edit Clan Handlers
  const handleOpenEditClan = (clan: ClanGroup) => {
    sounds.playClick();
    setEditingClan(clan);
    setEditClanName(clan.name);
    setEditClanColor(clan.color || '#d4af37');
  };

  const handleSaveEditClan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClan) return;
    const cleanNew = cleanClanName(editClanName.trim());
    if (!cleanNew) return;

    setIsSavingEdit(true);
    try {
      sounds.playClaim();
      await onUpdateClan(editingClan.id, cleanNew, editClanColor);
      setEditingClan(null);
    } catch (err) {
      console.error('Failed to update clan:', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Add Clan Handler
  const handleAddClanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNew = cleanClanName(newClanName.trim());
    if (!cleanNew) return;
    sounds.playClaim();
    await onAddClan(cleanNew, newClanColor);
    setNewClanName('');
    setNewClanColor('#d4af37');
    setShowAddClan(false);
  };

  // Delete Clan Handler
  const handleConfirmDeleteClan = async () => {
    if (!clanToDelete) return;
    sounds.playClick();
    await onDeleteClan(clanToDelete.id);
    setClanToDelete(null);
  };

  // Batch delete handlers
  const handleToggleSelectUser = (id: string) => {
    sounds.playClick();
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllInClan = (clanMembers: User[]) => {
    sounds.playClick();
    const ids = clanMembers.map((m) => m.id);
    const allSelected = ids.every((id) => selectedUserIds.includes(id));
    if (allSelected) {
      setSelectedUserIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedUserIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  const handleBatchDelete = () => {
    if (selectedUserIds.length === 0) return;
    sounds.playClick();
    setShowBatchDeleteModal(true);
  };

  const handleConfirmBatchDelete = async () => {
    sounds.playClick();
    await onBatchDeleteMembers(selectedUserIds);
    setSelectedUserIds([]);
    setShowBatchDeleteModal(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-[#fff2b8] via-[#e6be44] to-[#c99a22]">
            {t.clanManagementTitle}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            {t.clanManagementDesc}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Batch delete button */}
          {isAdminOrOwner && selectedUserIds.length > 0 && (
            <button
              id="btn-batch-delete"
              onClick={handleBatchDelete}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-700 text-red-200 text-xs font-bold transition-all shadow cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
              <span>
                {t.batchDeleteSelected} ({selectedUserIds.length})
              </span>
            </button>
          )}

          {/* Add Clan button */}
          {isAdminOrOwner && (
            <button
              id="btn-add-clan-open"
              onClick={() => {
                sounds.playClick();
                setShowAddClan(!showAddClan);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#aa841c] hover:brightness-110 text-slate-950 text-xs font-bold shadow transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t.addNewClan}</span>
            </button>
          )}
        </div>
      </div>

      {/* Helpful Instructions Banner */}
      {isAdminOrOwner && (
        <div className="p-3 rounded-xl bg-[#0f1728] border border-[#38bdf8]/30 text-xs text-[#7dd3fc] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-[#38bdf8] shrink-0" />
            <span>
              {lang === 'th'
                ? 'กดปุ่ม ◀ ▶ ที่หัวกล่องเพื่อสลับตำแหน่งแคลน หรือกดไอคอนดินสอ ✏️ เพื่อแก้ไขชื่อ/สีแคลน'
                : 'Use ◀ ▶ buttons on clan headers to reorder clan boxes, or click ✏️ to rename and change color.'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400 shrink-0">
            <MoveRight className="w-3.5 h-3.5 text-amber-400" />
            <span>{t.dragMemberHint}</span>
          </div>
        </div>
      )}

      {/* Add Clan Form Strip */}
      {showAddClan && isAdminOrOwner && (
        <form
          onSubmit={handleAddClanSubmit}
          className="p-4 rounded-2xl bg-[#0e1422] border border-[#d4af37]/40 shadow-xl space-y-3 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-[#f5d77f]">
              <Plus className="w-4 h-4" />
              <span>{t.addNewClan}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAddClan(false)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                required
                id="input-new-clan-name"
                placeholder={t.clanNamePlaceholder}
                value={newClanName}
                onChange={(e) => setNewClanName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#090d16] border border-slate-700 text-xs text-slate-100 focus:border-[#d4af37] focus:outline-none"
              />
            </div>

            {/* Color swatches */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-slate-400 mr-1">{t.clanColor}:</span>
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color.hex}
                  type="button"
                  onClick={() => setNewClanColor(color.hex)}
                  title={color.label}
                  className={`w-6 h-6 rounded-lg transition-transform ${
                    newClanColor === color.hex
                      ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-slate-900 shadow-md'
                      : 'hover:scale-105 opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: color.hex }}
                />
              ))}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowAddClan(false)}
                className="px-3 py-2 text-xs text-slate-400 hover:text-white"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                id="btn-confirm-add-clan"
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b89327] text-slate-950 font-bold text-xs hover:brightness-110 transition-all shadow"
              >
                + {t.addNewClan}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* CLAN BOXES GRID (เรียงตามลำดับ order สลับตำแหน่งได้ ลากได้ แก้ไขได้ ลบได้) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
        {displayClans.map((clan, idx) => {
          const cleanName = cleanClanName(clan.name);
          const clanMembers = activeMembers
            .filter((m) => (cleanClanName(m.clan) || 'No Clan') === cleanName)
            .sort((a, b) => (b.powerLevel || 0) - (a.powerLevel || 0));

          const totalClanPower = clanMembers.reduce(
            (sum, m) => sum + (m.powerLevel || 0),
            0
          );
          const avgPower = clanMembers.length
            ? Math.round(totalClanPower / clanMembers.length)
            : 0;

          const isTargetMemberDrag = draggedUserId !== null;
          const isTargetClanDrag = dragOverClanId === clan.id;
          const clanColor = clan.color || CLAN_COLOR_FALLBACK[cleanName.toLowerCase()] || '#d4af37';
          const clanInitial =
            cleanName.length >= 2
              ? cleanName.substring(0, 2).toUpperCase()
              : cleanName.toUpperCase();

          return (
            <div
              key={clan.id || cleanName}
              onDragOver={(e) => {
                e.preventDefault();
                if (draggedClanId && draggedClanId !== clan.id) {
                  setDragOverClanId(clan.id);
                }
              }}
              onDragLeave={() => {
                if (dragOverClanId === clan.id) setDragOverClanId(null);
              }}
              onDrop={() => {
                if (draggedClanId) {
                  handleClanHeaderDrop(clan.id);
                } else if (draggedUserId) {
                  handleMemberDropOnClan(cleanName);
                }
              }}
              className={`rounded-2xl bg-gradient-to-b from-[#111726] to-[#0a0f19] border transition-all duration-200 shadow-xl flex flex-col justify-between overflow-hidden ${
                isTargetClanDrag
                  ? 'border-[#d4af37] ring-2 ring-[#d4af37]/40 bg-[#162138]'
                  : isTargetMemberDrag
                  ? 'border-[#38bdf8]/80 hover:bg-[#142036]'
                  : 'border-slate-800'
              }`}
            >
              {/* Clan Card Header with Reordering & Action Controls */}
              <div className="p-3 bg-[#0d1422] border-b border-slate-800 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  {/* Left: Reorder buttons & Column Drag Handle */}
                  <div className="flex items-center gap-1">
                    {isAdminOrOwner && (
                      <div
                        draggable={true}
                        onDragStart={(e) => handleClanDragStart(e, clan.id)}
                        className="p-1 text-slate-500 hover:text-[#d4af37] cursor-grab active:cursor-grabbing rounded hover:bg-slate-800/80 transition-colors"
                        title={lang === 'th' ? 'ลากเพื่อสลับตำแหน่งกล่องแคลน' : 'Drag to reorder clan column'}
                      >
                        <GripVertical className="w-4 h-4" />
                      </div>
                    )}

                    {/* Move Left Button (◀) */}
                    {isAdminOrOwner && (
                      <button
                        type="button"
                        id={`btn-move-left-${cleanName}`}
                        disabled={idx === 0}
                        onClick={() => handleMoveClan(idx, 'left')}
                        className={`p-1 rounded-lg border transition-all cursor-pointer ${
                          idx === 0
                            ? 'opacity-30 border-transparent text-slate-600 cursor-not-allowed'
                            : 'border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white hover:border-[#d4af37]/50 active:scale-90'
                        }`}
                        title={t.moveClanLeft}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Move Right Button (▶) */}
                    {isAdminOrOwner && (
                      <button
                        type="button"
                        id={`btn-move-right-${cleanName}`}
                        disabled={idx === displayClans.length - 1}
                        onClick={() => handleMoveClan(idx, 'right')}
                        className={`p-1 rounded-lg border transition-all cursor-pointer ${
                          idx === displayClans.length - 1
                            ? 'opacity-30 border-transparent text-slate-600 cursor-not-allowed'
                            : 'border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white hover:border-[#d4af37]/50 active:scale-90'
                        }`}
                        title={t.moveClanRight}
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Right: Select All, Edit, Delete buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isAdminOrOwner && clanMembers.length > 0 && (
                      <button
                        onClick={() => handleSelectAllInClan(clanMembers)}
                        className="text-[10px] text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800/60 hover:bg-slate-800 cursor-pointer"
                      >
                        <span>{t.selectAll}</span>
                      </button>
                    )}

                    {/* Edit Clan Name & Color */}
                    {isAdminOrOwner && (
                      <button
                        id={`btn-edit-clan-${cleanName}`}
                        onClick={() => handleOpenEditClan(clan)}
                        className="p-1.5 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-300 hover:text-white border border-indigo-800/40 transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
                        title={t.editClan}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Delete Clan */}
                    {isAdminOrOwner && (
                      <button
                        id={`btn-delete-clan-${cleanName}`}
                        onClick={() => {
                          sounds.playClick();
                          setClanToDelete(clan);
                        }}
                        className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-white border border-red-800/40 transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
                        title={t.deleteClan}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Clan Info & Avatar */}
                <div className="flex items-center gap-2.5 min-w-0 pt-1">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white font-mono text-xs shrink-0 shadow-md border border-white/10"
                    style={{ backgroundColor: clanColor }}
                  >
                    {clanInitial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-bold font-cinzel text-slate-100 truncate">
                        {cleanName}
                      </h3>
                      <span className="text-[10px] font-mono text-slate-500">
                        #{idx + 1}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5 truncate">
                      <span>
                        {clanMembers.length} {lang === 'th' ? 'คน' : 'members'}
                      </span>
                      <span>•</span>
                      <span className="text-amber-400 font-mono font-bold">
                        ⚡ {totalClanPower.toLocaleString()} PL
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Clan Members Drop Zone & List */}
              <div className="p-3 flex-1 space-y-2 min-h-[160px] max-h-[620px] overflow-y-auto">
                {clanMembers.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                    <p>
                      {lang === 'th'
                        ? 'ไม่มีสมาชิกในแคลนนี้'
                        : 'No members in this clan'}
                    </p>
                    {isAdminOrOwner && (
                      <p className="text-[10px] text-slate-600 mt-1">
                        {lang === 'th'
                          ? 'ลากการ์ดสมาชิกมาวางที่นี่'
                          : 'Drag member cards here'}
                      </p>
                    )}
                  </div>
                ) : (
                  clanMembers.map((member, mIdx) => {
                    const isSelected = selectedUserIds.includes(member.id);
                    const primaryClass =
                      member.classes && member.classes.length > 0
                        ? member.classes[0]
                        : member.characterClass || '';

                    return (
                      <div
                        key={member.id}
                        draggable={isAdminOrOwner}
                        onDragStart={() => handleMemberDragStart(member.id)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                          isSelected
                            ? 'bg-[#18263d] border-[#38bdf8] text-white shadow'
                            : 'bg-[#0a0f19] border-slate-800 hover:border-slate-700 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {/* Batch select checkbox */}
                          {isAdminOrOwner && (
                            <button
                              type="button"
                              onClick={() => handleToggleSelectUser(member.id)}
                              className="text-slate-400 hover:text-[#38bdf8] shrink-0"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-3.5 h-3.5 text-[#38bdf8]" />
                              ) : (
                                <Square className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}

                          {/* Drag handle */}
                          {isAdminOrOwner && (
                            <GripVertical className="w-3.5 h-3.5 text-slate-600 hover:text-slate-300 cursor-grab active:cursor-grabbing shrink-0" />
                          )}

                          <span className="text-[10px] font-mono font-bold text-slate-500 w-4 shrink-0">
                            #{mIdx + 1}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-slate-100 truncate flex items-center gap-1.5">
                              <span className="truncate">{member.inGameName}</span>
                              {Boolean(member.level && member.level > 0) && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono shrink-0">
                                  {member.level}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                              {primaryClass && (
                                <span className="text-purple-300 font-medium truncate">
                                  {primaryClass}
                                </span>
                              )}
                              {primaryClass && <span>•</span>}
                              <span className="text-amber-400 font-mono font-semibold shrink-0">
                                ⚡ {(member.powerLevel || 0).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Individual Delete for Admin/Owner */}
                        {isAdminOrOwner && member.role !== 'owner' && (
                          <button
                            id={`btn-delete-clan-member-${member.id}`}
                            onClick={() => {
                              sounds.playClick();
                              setMemberToDelete(member);
                            }}
                            className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-all shrink-0 cursor-pointer"
                            title={t.deleteMember}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Clan Footer Info */}
              <div className="p-3 bg-[#090d16] border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                <span>
                  {t.avgPower}: ⚡ {avgPower.toLocaleString()} PL
                </span>
                {isAdminOrOwner && (
                  <span className="text-[10px] text-slate-500 italic">
                    {lang === 'th' ? 'ลากการ์ดย้ายแคลน' : 'Drag to move'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* EDIT CLAN MODAL (แก้ไขชื่อแคลน & สีประจำแคลน) */}
      {editingClan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-gradient-to-b from-[#141d33] via-[#0e1626] to-[#080d18] border border-[#d4af37]/60 shadow-[0_20px_60px_rgba(0,0,0,0.95),0_0_30px_rgba(212,175,55,0.25)] p-6 text-slate-200">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white font-mono text-sm shadow-md border border-white/20"
                  style={{ backgroundColor: editClanColor }}
                >
                  {cleanClanName(editClanName).substring(0, 2).toUpperCase() || '??'}
                </div>
                <div>
                  <h3 className="text-base font-bold font-cinzel text-slate-100">
                    {t.editClan}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {t.editClanDesc}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingClan(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditClan} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {t.clanName}
                </label>
                <input
                  type="text"
                  required
                  id="input-edit-clan-name"
                  value={editClanName}
                  onChange={(e) => setEditClanName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#090f1a] border border-slate-700 text-xs text-slate-100 focus:border-[#d4af37] focus:outline-none"
                  placeholder={t.clanNamePlaceholder}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  {t.clanColor}
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color.hex}
                      type="button"
                      onClick={() => setEditClanColor(color.hex)}
                      className={`h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-transform ${
                        editClanColor === color.hex
                          ? 'scale-105 ring-2 ring-white ring-offset-2 ring-offset-slate-900 shadow-lg'
                          : 'hover:scale-105 opacity-85 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: color.hex }}
                      title={color.label}
                    >
                      {editClanColor === color.hex && (
                        <Check className="w-4 h-4 text-white drop-shadow" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200">
                {lang === 'th'
                  ? '💡 เมื่อเปลี่ยนชื่อแคลน สมาชิกทุกคนที่สังกัดแคลนนี้จะถูกอัปเดตชื่อแคลนใหม่โดยอัตโนมัติ'
                  : '💡 Renaming this clan will automatically update all member affiliations in this clan.'}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingClan(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-600 transition-all cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  id="btn-confirm-save-edit-clan"
                  disabled={isSavingEdit}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#aa841c] hover:brightness-110 text-slate-950 font-bold text-xs shadow-lg transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSavingEdit ? t.loading : t.saveChanges}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE CLAN MODAL (ยืนยันการลบแคลน & โอนย้ายสมาชิกไป no-clan) */}
      {clanToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-2xl bg-gradient-to-b from-[#181015] via-[#100a0e] to-[#080507] border border-red-500/50 shadow-[0_20px_60px_rgba(0,0,0,0.95),0_0_30px_rgba(239,68,68,0.25)] p-6 text-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/50 text-red-400 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  {t.confirmDeleteClan}
                </h3>
                <p className="text-xs text-red-400/90 font-medium">
                  {t.confirmDeleteClanDesc}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300 mb-4 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">{t.clanName}: </span>
                <span className="font-bold text-amber-300">
                  {cleanClanName(clanToDelete.name)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'th' ? 'จำนวนสมาชิก:' : 'Members:'}</span>
                <span className="font-mono text-slate-200 font-bold">
                  {activeMembers.filter((m) => cleanClanName(m.clan) === cleanClanName(clanToDelete.name)).length} {lang === 'th' ? 'คน' : 'members'}
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-red-950/30 border border-red-800/30 text-[11px] text-red-300 mb-5">
              ⚠️ {lang === 'th' ? 'สมาชิกในแคลนนี้จะไม่ถูกลบออกจากระบบ แต่จะถูกย้ายไปยัง "no-clan" โดยอัตโนมัติ' : 'Members will not be deleted, but will be safely moved to "no-clan".'}
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setClanToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-600 transition-all cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                id="btn-confirm-delete-clan-modal"
                onClick={handleConfirmDeleteClan}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-xs shadow-lg shadow-red-900/50 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{lang === 'th' ? 'ยืนยันลบแคลน' : 'Delete Clan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE INDIVIDUAL MEMBER MODAL */}
      {memberToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-2xl bg-gradient-to-b from-[#181015] via-[#100a0e] to-[#080507] border border-red-500/50 shadow-[0_20px_60px_rgba(0,0,0,0.95),0_0_30px_rgba(239,68,68,0.25)] p-6 text-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/50 text-red-400 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  {lang === 'th' ? 'ยืนยันการลบสมาชิก' : 'Confirm Delete Member'}
                </h3>
                <p className="text-xs text-red-400/90 font-medium">
                  {lang === 'th'
                    ? 'การกระทำนี้จะลบข้อมูลสมาชิกออกจากระบบ'
                    : 'Permanently removes this member'}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300 mb-5 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">{t.inGameName}:</span>
                <span className="font-bold text-slate-100">
                  {memberToDelete.inGameName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{t.clanName}:</span>
                <span className="text-amber-300">
                  {cleanClanName(memberToDelete.clan)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setMemberToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-600 transition-all cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                id="btn-confirm-delete-member-modal"
                onClick={() => {
                  sounds.playClick();
                  onDeleteMember(memberToDelete.id);
                  setMemberToDelete(null);
                }}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-xs shadow-lg shadow-red-900/50 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{lang === 'th' ? 'ยืนยันลบสมาชิก' : 'Delete Member'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM BATCH DELETE MODAL */}
      {showBatchDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-2xl bg-gradient-to-b from-[#181015] via-[#100a0e] to-[#080507] border border-red-500/50 shadow-[0_20px_60px_rgba(0,0,0,0.95),0_0_30px_rgba(239,68,68,0.25)] p-6 text-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/50 text-red-400 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  {lang === 'th' ? 'ยืนยันการลบแบบกลุ่ม' : 'Confirm Batch Delete'}
                </h3>
                <p className="text-xs text-red-400/90 font-medium">
                  {lang === 'th'
                    ? `จะลบสมาชิกที่เลือกทั้งหมด ${selectedUserIds.length} คน`
                    : `Delete all ${selectedUserIds.length} selected members`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowBatchDeleteModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-600 transition-all cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                id="btn-confirm-batch-delete-modal"
                onClick={handleConfirmBatchDelete}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-xs shadow-lg shadow-red-900/50 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {lang === 'th' ? `ลบทั้ง ${selectedUserIds.length} คน` : 'Delete All'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
