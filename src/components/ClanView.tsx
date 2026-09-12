import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  ArrowLeftRight,
  UserX,
  Search,
  HelpCircle,
  ChevronDown,
  ArrowRight,
  Sparkles,
  Info,
  Eye,
  EyeOff,
  Crown,
  ShieldCheck
} from 'lucide-react';
import { ClanGroup, Language, User, cleanClanName, isNoClan } from '../types';
import { translations } from '../translations';
import { sounds } from '../utils/sound';

interface ClanViewProps {
  lang: Language;
  currentUser: User | null;
  allMembers: User[];
  clans: ClanGroup[];
  onAddClan: (clanName: string, color?: string) => Promise<void>;
  onUpdateClan: (clanId: string, newName: string, newColor?: string) => Promise<void>;
  onDeleteClan: (clanId: string, clanName?: string) => Promise<void>;
  onReorderClans: (orderedClans: ClanGroup[]) => Promise<void>;
  onMoveMemberClan: (userId: string, newClanName: string) => Promise<void>;
  onBatchMoveMembers?: (userIds: string[], newClanName: string) => Promise<void>;
  onToggleClanVisibility?: (clanId: string) => Promise<void>;
  onDeleteMember: (userId: string) => Promise<void>;
  onBatchDeleteMembers: (userIds: string[]) => Promise<void>;
  onAddMemberQuick?: (member: Partial<User>) => Promise<void>;
  onNavigateToClans?: () => void;
}

const CLAN_COLOR_FALLBACK: Record<string, string> = {
  voltz: '#22c55e',
  levels: '#ef4444',
  stronk: '#eab308'
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
  onBatchMoveMembers,
  onToggleClanVisibility,
  onDeleteMember,
  onBatchDeleteMembers,
  onNavigateToClans
}) => {
  const t = translations[lang];
  const isAdminOrOwner =
    currentUser?.role === 'owner' ||
    currentUser?.role === 'admin' ||
    currentUser?.role === 'manager';

  // Search & Help State
  const [searchQuery, setSearchQuery] = useState('');
  const [showHelpGuide, setShowHelpGuide] = useState(false);

  // Clan Visibility State (Toggles show/hide clans)
  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [showHiddenOnBoard, setShowHiddenOnBoard] = useState(false);
  const [togglingClanId, setTogglingClanId] = useState<string | null>(null);

  // Add clan state
  const [showAddClan, setShowAddClan] = useState(false);
  const [newClanName, setNewClanName] = useState('');
  const [newClanColor, setNewClanColor] = useState('#22c55e');

  // Edit clan state
  const [editingClan, setEditingClan] = useState<ClanGroup | null>(null);
  const [editClanName, setEditClanName] = useState('');
  const [editClanColor, setEditClanColor] = useState('#d4af37');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete clan state
  const [clanToDelete, setClanToDelete] = useState<ClanGroup | null>(null);

  // Batch delete & Move selection
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [memberToDelete, setMemberToDelete] = useState<User | null>(null);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [showBatchMoveDropdown, setShowBatchMoveDropdown] = useState(false);

  // Quick Move Popover state (which member card has the quick-move menu open)
  const [quickMoveUserId, setQuickMoveUserId] = useState<string | null>(null);

  // Drag-and-drop state: Members & Column Clan Reordering
  const [draggedUserId, setDraggedUserId] = useState<string | null>(null);
  const [draggedClanId, setDraggedClanId] = useState<string | null>(null);
  const [dragOverClanId, setDragOverClanId] = useState<string | null>(null);

  // Close quick move and batch move popovers when clicking outside
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.quick-move-popover-container')) {
        setQuickMoveUserId(null);
      }
      if (!target.closest('.batch-move-dropdown-container')) {
        setShowBatchMoveDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Only active members
  const activeMembers = useMemo(
    () => allMembers.filter((m) => m.status === 'active'),
    [allMembers]
  );

  // Compile list of valid registered clans (exclude phantom 'no-clan' columns)
  const displayClans = useMemo(() => {
    const clanMap = new Map<string, ClanGroup>();
    clans.forEach((c, idx) => {
      const cleanName = cleanClanName(c.name);
      if (cleanName && !isNoClan(cleanName) && !clanMap.has(cleanName.toLowerCase())) {
        clanMap.set(cleanName.toLowerCase(), {
          ...c,
          name: cleanName,
          color: c.color || CLAN_COLOR_FALLBACK[cleanName.toLowerCase()] || '#d4af37',
          order: c.order ?? idx,
          enabled: c.enabled !== false
        });
      }
    });

    // Return registered clans sorted by order
    return Array.from(clanMap.values()).sort(
      (a, b) => (a.order ?? 999) - (b.order ?? 999)
    );
  }, [clans]);

  const visibleClans = useMemo(
    () => displayClans.filter((c) => c.enabled !== false),
    [displayClans]
  );

  const hiddenClans = useMemo(
    () => displayClans.filter((c) => c.enabled === false),
    [displayClans]
  );

  const clansToRender = useMemo(() => {
    if (showHiddenOnBoard) return displayClans;
    return visibleClans.length > 0 ? visibleClans : displayClans;
  }, [showHiddenOnBoard, displayClans, visibleClans]);

  // Set of valid clan names for lookup
  const validClanNamesLower = useMemo(
    () => new Set(displayClans.map((c) => cleanClanName(c.name).toLowerCase())),
    [displayClans]
  );

  // Unassigned Members (No Clan Pool)
  // Members who have isNoClan, empty clan, or a clan that does not match any registered clan!
  const unassignedMembers = useMemo(() => {
    return activeMembers
      .filter((m) => {
        if (isNoClan(m.clan)) return true;
        const clean = cleanClanName(m.clan).toLowerCase();
        return !validClanNamesLower.has(clean);
      })
      .sort((a, b) => (b.powerLevel || 0) - (a.powerLevel || 0));
  }, [activeMembers, validClanNamesLower]);

  // Search Filter
  const cleanSearch = searchQuery.trim().toLowerCase();
  const filterMember = (m: User) => {
    if (!cleanSearch) return true;
    const ign = (m.inGameName || '').toLowerCase();
    const primaryClass = ((m.classes && m.classes[0]) || m.characterClass || '').toLowerCase();
    const lvl = m.level ? m.level.toString() : '';
    return ign.includes(cleanSearch) || primaryClass.includes(cleanSearch) || lvl.includes(cleanSearch);
  };

  const filteredUnassignedMembers = useMemo(
    () => unassignedMembers.filter(filterMember),
    [unassignedMembers, cleanSearch]
  );

  const unassignedTotalPower = useMemo(
    () => unassignedMembers.reduce((sum, m) => sum + (m.powerLevel || 0), 0),
    [unassignedMembers]
  );
  const avgUnassignedPower = unassignedMembers.length
    ? Math.round(unassignedTotalPower / unassignedMembers.length)
    : 0;

  // Drag-and-drop Handlers
  const handleMemberDragStart = (userId: string) => {
    setDraggedUserId(userId);
  };

  const handleMemberDropOnTarget = async (targetClanName: string) => {
    if (!draggedUserId) return;
    const cleanTarget = isNoClan(targetClanName) ? 'no-clan' : cleanClanName(targetClanName);
    const member = activeMembers.find((m) => m.id === draggedUserId);
    if (!member) {
      setDraggedUserId(null);
      setDragOverClanId(null);
      return;
    }

    const currentClan = isNoClan(member.clan) ? 'no-clan' : cleanClanName(member.clan);
    if (currentClan.toLowerCase() === cleanTarget.toLowerCase()) {
      setDraggedUserId(null);
      setDragOverClanId(null);
      return;
    }

    sounds.playClaim();
    await onMoveMemberClan(draggedUserId, cleanTarget);
    setDraggedUserId(null);
    setDragOverClanId(null);
  };

  // Clan Column Reordering
  const handleMoveClan = async (clanId: string, direction: 'left' | 'right') => {
    const currIdx = displayClans.findIndex((c) => c.id === clanId);
    if (currIdx === -1) return;
    const targetIdx = direction === 'left' ? currIdx - 1 : currIdx + 1;
    if (targetIdx < 0 || targetIdx >= displayClans.length) return;
    sounds.playClick();
    const reordered = [...displayClans];
    const temp = reordered[currIdx];
    reordered[currIdx] = reordered[targetIdx];
    reordered[targetIdx] = temp;
    await onReorderClans(reordered);
  };

  const handleClanDragStart = (e: React.DragEvent, clanId: string) => {
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
    if (!cleanNew || isNoClan(cleanNew)) return;

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
    if (!cleanNew || isNoClan(cleanNew)) return;
    sounds.playClaim();
    await onAddClan(cleanNew, newClanColor);
    setNewClanName('');
    setNewClanColor('#22c55e');
    setShowAddClan(false);
  };

  // Delete Clan Handler
  const handleConfirmDeleteClan = async () => {
    if (!clanToDelete) return;
    sounds.playClick();
    await onDeleteClan(clanToDelete.id, clanToDelete.name);
    setClanToDelete(null);
  };

  // Quick Move & Batch Move
  const handleQuickMove = async (userId: string, targetClan: string) => {
    sounds.playClaim();
    setQuickMoveUserId(null);
    const cleanTarget = isNoClan(targetClan) ? 'no-clan' : cleanClanName(targetClan);
    await onMoveMemberClan(userId, cleanTarget);
  };

  const handleBatchMove = async (targetClan: string) => {
    if (selectedUserIds.length === 0) return;
    sounds.playClaim();
    setShowBatchMoveDropdown(false);
    const cleanTarget = isNoClan(targetClan) ? 'no-clan' : cleanClanName(targetClan);
    if (onBatchMoveMembers) {
      await onBatchMoveMembers(selectedUserIds, cleanTarget);
    } else {
      for (const id of selectedUserIds) {
        await onMoveMemberClan(id, cleanTarget);
      }
    }
    setSelectedUserIds([]);
  };

  // Batch Select Handlers
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
    <div ref={containerRef} className="space-y-6 animate-in fade-in duration-300">
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER & TOP ACTION CONTROLS
         ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-[#111728] via-[#0d1322] to-[#0a0f1a] p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-[#fff2b8] via-[#e6be44] to-[#c99a22]">
              {t.clanManagementTitle}
            </h1>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
              {displayClans.length} {lang === 'th' ? 'แคลน' : 'Clans'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {t.clanManagementDesc}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Real-time Search Box */}
          <div className="relative flex-1 sm:w-56 min-w-[180px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.filterClanMembers || (lang === 'th' ? 'ค้นหาชื่อหรือคลาส...' : 'Search name or class...')}
              className="w-full pl-8 pr-7 py-2 rounded-xl bg-[#090d16] border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:border-[#d4af37] focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Help Guide Toggle */}
          <button
            type="button"
            id="btn-toggle-clan-guide"
            onClick={() => {
              sounds.playClick();
              setShowHelpGuide(!showHelpGuide);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              showHelpGuide
                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow'
                : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title={t.clanHelpGuide}
          >
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <span>{lang === 'th' ? 'วิธีใช้งาน' : 'Guide'}</span>
          </button>

          {/* Clan Visibility Toggle Modal Button */}
          {isAdminOrOwner && onToggleClanVisibility && (
            <button
              type="button"
              id="btn-open-clan-visibility"
              onClick={() => {
                sounds.playClick();
                setShowVisibilityModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold shadow transition-all cursor-pointer"
              title={t.clanVisibility}
            >
              <Eye className="w-4 h-4 text-sky-400" />
              <span>{t.clanVisibility}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-sky-500/20 text-sky-300 font-mono border border-sky-500/30">
                {visibleClans.length}/{displayClans.length}
              </span>
            </button>
          )}

          {/* View Public Clan Page Button */}
          {onNavigateToClans && (
            <button
              type="button"
              id="btn-navigate-to-clans"
              onClick={() => {
                sounds.playClick();
                onNavigateToClans();
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold shadow transition-all cursor-pointer shrink-0"
              title={t.goToClans || (lang === 'th' ? 'ดูหน้าแคลน' : 'View Clan Page')}
            >
              <Shield className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>{t.goToClans || (lang === 'th' ? 'ดูหน้าแคลน' : 'View Clan Page')}</span>
            </button>
          )}

          {/* Add Clan button */}
          {isAdminOrOwner && (
            <button
              id="btn-add-clan-open"
              type="button"
              onClick={() => {
                sounds.playClick();
                setShowAddClan(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#aa841c] hover:brightness-110 text-slate-950 text-xs font-bold shadow-lg shadow-amber-900/30 transition-all cursor-pointer shrink-0 active:scale-95"
            >
              <Plus className="w-4 h-4 text-slate-950" />
              <span>{t.addNewClan}</span>
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. COLLAPSIBLE HOW-TO GUIDE BANNER
         ───────────────────────────────────────────────────────────── */}
      {showHelpGuide && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-[#131c31] to-[#0b111f] border border-amber-400/40 shadow-2xl animate-in fade-in duration-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-300 font-cinzel">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>{t.clanHelpGuide}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowHelpGuide(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 text-xs text-slate-300">
            <div className="p-3 rounded-xl bg-[#0a0f1a]/80 border border-slate-800">
              <div className="font-bold text-amber-400 mb-1 flex items-center gap-1.5">
                <span>➕</span>
                <span>{lang === 'th' ? '1. เพิ่มแคลนใหม่' : '1. Add Clan'}</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                {t.clanHelpStep1}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[#0a0f1a]/80 border border-slate-800">
              <div className="font-bold text-indigo-400 mb-1 flex items-center gap-1.5">
                <span>✏️</span>
                <span>{lang === 'th' ? '2. แก้ไขชื่อ / สี' : '2. Rename & Color'}</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                {t.clanHelpStep2}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[#0a0f1a]/80 border border-slate-800">
              <div className="font-bold text-red-400 mb-1 flex items-center gap-1.5">
                <span>🗑️</span>
                <span>{lang === 'th' ? '3. ลบแคลน' : '3. Delete Clan'}</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                {t.clanHelpStep3}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[#0a0f1a]/80 border border-slate-800">
              <div className="font-bold text-emerald-400 mb-1 flex items-center gap-1.5">
                <span>◀ ▶</span>
                <span>{lang === 'th' ? '4. สลับลำดับกล่อง' : '4. Reorder Columns'}</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                {t.clanHelpStep4}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[#0a0f1a]/80 border border-slate-800 md:col-span-2">
              <div className="font-bold text-[#38bdf8] mb-1 flex items-center gap-1.5">
                <span>🔄</span>
                <span>{lang === 'th' ? '5. ย้ายสมาชิก (ทำได้ 3 วิธี)' : '5. Move Members (3 Ways)'}</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                {t.clanHelpStep5}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2.1 HIDDEN CLANS NOTICE BANNER (WHEN ONE OR MORE CLANS ARE HIDDEN)
         ───────────────────────────────────────────────────────────── */}
      {hiddenClans.length > 0 && (
        <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-[#181926] via-[#121420] to-[#0d0f18] border border-amber-500/35 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
              <EyeOff className="w-5 h-5" />
            </div>
            <div className="text-xs">
              <div className="font-bold text-amber-300 flex items-center gap-1.5">
                <span>
                  {lang === 'th'
                    ? `มี ${hiddenClans.length} แคลนที่กำลังถูกซ่อนอยู่`
                    : `${hiddenClans.length} clan(s) currently hidden`}
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30">
                  {hiddenClans.map((c) => c.name).join(', ')}
                </span>
              </div>
              <div className="text-slate-400 text-[11px] mt-0.5">
                {lang === 'th'
                  ? 'ข้อมูลและสมาชิกยังคงอยู่ครบถ้วน ไม่สูญหาย สามารถคลิก "เปิดดูบนบอร์ด" หรือกดตั้งค่าเพื่อเปิดแสดงผลได้ตลอดเวลา'
                  : 'Member data remains safe and unaffected. You can preview on the board or adjust visibility anytime.'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              id="btn-toggle-show-hidden-on-board"
              onClick={() => {
                sounds.playClick();
                setShowHiddenOnBoard(!showHiddenOnBoard);
              }}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                showHiddenOnBoard
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              {showHiddenOnBoard
                ? (lang === 'th' ? 'ซ่อนจากบอร์ด' : 'Hide from Board')
                : (lang === 'th' ? 'เปิดดูบนบอร์ดชั่วคราว' : 'Show on Board')}
            </button>
            <button
              type="button"
              id="btn-open-vis-modal-banner"
              onClick={() => {
                sounds.playClick();
                setShowVisibilityModal(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 hover:text-white text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{lang === 'th' ? 'ตั้งค่าการแสดงผล' : 'Configure'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. FLOATING BATCH ACTION BAR (WHEN MEMBERS ARE SELECTED)
         ───────────────────────────────────────────────────────────── */}
      {isAdminOrOwner && selectedUserIds.length > 0 && (
        <div className="sticky top-4 z-40 p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-[#18263d] via-[#121c2e] to-[#0d1522] border-2 border-[#38bdf8] shadow-[0_10px_30px_rgba(0,0,0,0.8),0_0_20px_rgba(56,189,248,0.25)] flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#38bdf8] text-slate-950 font-bold font-mono text-xs">
              {selectedUserIds.length}
            </span>
            <div>
              <div className="text-xs font-bold text-white">
                {lang === 'th' ? `เลือกสมาชิกแล้ว ${selectedUserIds.length} คน` : `${selectedUserIds.length} members selected`}
              </div>
              <div className="text-[10px] text-slate-400">
                {lang === 'th' ? 'เลือกย้ายเข้าแคลนเป้าหมายพร้อมกัน หรือลบสมาชิก' : 'Move batch to clan or delete'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Batch Move Dropdown */}
            <div className="relative batch-move-dropdown-container">
              <button
                type="button"
                id="btn-batch-move-open"
                onClick={() => {
                  sounds.playClick();
                  setShowBatchMoveDropdown(!showBatchMoveDropdown);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white font-bold text-xs shadow cursor-pointer transition-all active:scale-95"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>{t.batchMoveToClan}</span>
                <ChevronDown className="w-3 h-3 ml-0.5" />
              </button>

              {showBatchMoveDropdown && (
                <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl bg-[#0e1626] border border-slate-700 shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1">
                  <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {lang === 'th' ? 'เลือกแคลนปลายทาง:' : 'Select Target Clan:'}
                  </div>

                  {displayClans.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleBatchMove(c.name)}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800 transition-colors text-left cursor-pointer"
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: c.color || '#d4af37' }}
                      />
                      <span className="truncate">{c.name}</span>
                    </button>
                  ))}

                  <div className="border-t border-slate-800 my-1" />

                  {/* Move to No-Clan / Unassigned option */}
                  <button
                    type="button"
                    onClick={() => handleBatchMove('no-clan')}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-amber-300 hover:text-amber-200 hover:bg-amber-950/40 transition-colors text-left cursor-pointer"
                  >
                    <UserX className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate">{t.unassignMemberAction}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Batch Delete Button */}
            <button
              id="btn-batch-delete-top"
              type="button"
              onClick={handleBatchDelete}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-700 text-red-200 text-xs font-bold transition-all shadow cursor-pointer"
              title={t.batchDeleteSelected}
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              <span>{lang === 'th' ? 'ลบที่เลือก' : 'Delete'}</span>
            </button>

            {/* Cancel Selection */}
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setSelectedUserIds([]);
              }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs border border-slate-700 cursor-pointer"
              title={t.unselectAll}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. CLAN COLUMNS GRID (OFFICIAL CLANS + NO-CLAN BOX)
         ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
        {clansToRender.map((clan, idx) => {
          const cleanName = cleanClanName(clan.name);
          const clanMembers = activeMembers
            .filter((m) => (cleanClanName(m.clan) || '').toLowerCase() === cleanName.toLowerCase())
            .sort((a, b) => (b.powerLevel || 0) - (a.powerLevel || 0));

          const filteredClanMembers = clanMembers.filter(filterMember);

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
              id={`card-clan-${cleanName}`}
              onDragOver={(e) => {
                e.preventDefault();
                if (draggedClanId && draggedClanId !== clan.id) {
                  setDragOverClanId(clan.id);
                } else if (draggedUserId) {
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
                  handleMemberDropOnTarget(cleanName);
                }
              }}
              className={`rounded-2xl bg-gradient-to-b from-[#111726] to-[#0a0f19] border transition-all duration-200 shadow-xl flex flex-col justify-between overflow-hidden ${
                isTargetClanDrag
                  ? 'border-[#d4af37] ring-2 ring-[#d4af37]/40 bg-[#162138]'
                  : isTargetMemberDrag
                  ? 'border-[#38bdf8]/80 hover:bg-[#142036]'
                  : clan.enabled === false
                  ? 'border-amber-500/40 opacity-85 border-dashed'
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
                        disabled={displayClans.findIndex((c) => c.id === clan.id) <= 0}
                        onClick={() => handleMoveClan(clan.id, 'left')}
                        className={`p-1 rounded-lg border transition-all cursor-pointer ${
                          displayClans.findIndex((c) => c.id === clan.id) <= 0
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
                        disabled={displayClans.findIndex((c) => c.id === clan.id) >= displayClans.length - 1}
                        onClick={() => handleMoveClan(clan.id, 'right')}
                        className={`p-1 rounded-lg border transition-all cursor-pointer ${
                          displayClans.findIndex((c) => c.id === clan.id) >= displayClans.length - 1
                            ? 'opacity-30 border-transparent text-slate-600 cursor-not-allowed'
                            : 'border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white hover:border-[#d4af37]/50 active:scale-90'
                        }`}
                        title={t.moveClanRight}
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Right: Select All, Visibility Toggle, Edit, Delete buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isAdminOrOwner && clanMembers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleSelectAllInClan(clanMembers)}
                        className="text-[10px] text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800/60 hover:bg-slate-800 cursor-pointer border border-slate-700/50"
                      >
                        <span>{t.selectAll}</span>
                      </button>
                    )}

                    {/* Toggle Clan Visibility (Eye / EyeOff) */}
                    {isAdminOrOwner && onToggleClanVisibility && (
                      <button
                        type="button"
                        id={`btn-toggle-vis-${cleanName}`}
                        disabled={togglingClanId === clan.id}
                        onClick={async () => {
                          sounds.playClick();
                          setTogglingClanId(clan.id);
                          try {
                            await onToggleClanVisibility(clan.id);
                          } finally {
                            setTogglingClanId(null);
                          }
                        }}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95 ${
                          clan.enabled === false
                            ? 'bg-amber-950/70 hover:bg-amber-900/90 text-amber-400 border border-amber-700/60'
                            : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60'
                        }`}
                        title={
                          clan.enabled === false
                            ? (lang === 'th' ? 'แคลนนี้ถูกซ่อนอยู่ - คลิกเพื่อเปิดแสดงผล' : 'Hidden - Click to show clan')
                            : (lang === 'th' ? 'คลิกเพื่อซ่อนแคลนนี้' : 'Click to hide clan')
                        }
                      >
                        {clan.enabled === false ? (
                          <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <Eye className="w-3.5 h-3.5 text-sky-400" />
                        )}
                      </button>
                    )}

                    {/* Edit Clan Name & Color */}
                    {isAdminOrOwner && (
                      <button
                        type="button"
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
                        type="button"
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
                      {clan.enabled === false && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium shrink-0">
                          {t.clanStatusHidden}
                        </span>
                      )}
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
                      {lang === 'th' ? 'ไม่มีสมาชิกในแคลนนี้' : 'No members in this clan'}
                    </p>
                    {isAdminOrOwner && (
                      <p className="text-[10px] text-slate-600 mt-1">
                        {lang === 'th' ? 'ลากการ์ดสมาชิกมาวางที่นี่' : 'Drag member cards here'}
                      </p>
                    )}
                  </div>
                ) : filteredClanMembers.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">
                    {lang === 'th' ? 'ไม่พบสมาชิกที่ตรงกับการค้นหา' : 'No members match search query'}
                  </div>
                ) : (
                  filteredClanMembers.map((member, mIdx) => {
                    const isSelected = selectedUserIds.includes(member.id);
                    const primaryClass =
                      member.classes && member.classes.length > 0
                        ? member.classes[0]
                        : member.characterClass || '';
                    const isQuickMoveOpen = quickMoveUserId === member.id;

                    return (
                      <div
                        key={member.id}
                        draggable={isAdminOrOwner}
                        onDragStart={() => handleMemberDragStart(member.id)}
                        className={`relative p-2.5 rounded-xl border flex flex-col gap-1.5 transition-all ${
                          isSelected
                            ? 'bg-[#18263d] border-[#38bdf8] text-white shadow'
                            : 'bg-[#0a0f19] border-slate-800 hover:border-slate-700 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
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
                                {member.role === 'owner' && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold shrink-0 flex items-center gap-0.5">
                                    <Crown className="w-2.5 h-2.5" />
                                    <span>Owner</span>
                                  </span>
                                )}
                                {member.role === 'admin' && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold shrink-0 flex items-center gap-0.5">
                                    <ShieldCheck className="w-2.5 h-2.5" />
                                    <span>Admin</span>
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
                              type="button"
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

                        {/* Quick Move Button for Individual Member */}
                        {isAdminOrOwner && (
                          <div className="relative quick-move-popover-container pt-0.5">
                            <button
                              type="button"
                              id={`btn-quick-move-${member.id}`}
                              onClick={() => {
                                sounds.playClick();
                                setQuickMoveUserId(isQuickMoveOpen ? null : member.id);
                              }}
                              className="w-full flex items-center justify-between px-2 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-[10px] text-slate-300 hover:text-white transition-all cursor-pointer"
                            >
                              <div className="flex items-center gap-1">
                                <ArrowRight className="w-3 h-3 text-slate-400" />
                                <span>{t.quickMoveToClan}</span>
                              </div>
                              <ChevronDown className="w-2.5 h-2.5 text-slate-400" />
                            </button>

                            {/* Floating Clan Transfer Popover */}
                            {isQuickMoveOpen && (
                              <div className="absolute left-0 right-0 top-full mt-1 rounded-xl bg-[#0e1626] border border-slate-700 shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-0.5">
                                <div className="px-2 py-1 text-[9px] font-bold text-slate-400 uppercase">
                                  {t.quickMoveTitle}
                                </div>
                                {displayClans
                                  .filter((c) => cleanClanName(c.name).toLowerCase() !== cleanName.toLowerCase())
                                  .map((c) => (
                                    <button
                                      key={c.id}
                                      type="button"
                                      onClick={() => handleQuickMove(member.id, c.name)}
                                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[11px] text-slate-200 hover:text-white hover:bg-slate-800 transition-colors text-left cursor-pointer"
                                    >
                                      <span
                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                        style={{ backgroundColor: c.color || '#d4af37' }}
                                      />
                                      <span className="truncate font-medium">{c.name}</span>
                                    </button>
                                  ))}

                                <div className="border-t border-slate-800 my-0.5" />

                                {/* Unassign option */}
                                <button
                                  type="button"
                                  onClick={() => handleQuickMove(member.id, 'no-clan')}
                                  className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] text-amber-300 hover:text-amber-200 hover:bg-amber-950/40 transition-colors text-left cursor-pointer"
                                >
                                  <UserX className="w-3 h-3 text-amber-400 shrink-0" />
                                  <span className="truncate">{t.unassignMemberAction}</span>
                                </button>
                              </div>
                            )}
                          </div>
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

        {/* ─────────────────────────────────────────────────────────────
            กล่องโนแคลน (NO-CLAN COLUMN CARD) - ออกแบบและทำงานเหมือนกล่องแคลนทุกประการ
           ───────────────────────────────────────────────────────────── */}
        <div
          id="card-clan-unassigned"
          onDragOver={(e) => {
            e.preventDefault();
            if (draggedUserId) setDragOverClanId('unassigned');
          }}
          onDragLeave={() => {
            if (dragOverClanId === 'unassigned') setDragOverClanId(null);
          }}
          onDrop={() => {
            if (draggedUserId) handleMemberDropOnTarget('no-clan');
          }}
          className={`rounded-2xl bg-gradient-to-b from-[#111726] to-[#0a0f19] border transition-all duration-200 shadow-xl flex flex-col justify-between overflow-hidden ${
            dragOverClanId === 'unassigned'
              ? 'border-amber-400 ring-2 ring-amber-400/40 bg-[#1f1912]'
              : draggedUserId !== null
              ? 'border-amber-400/70 border-dashed hover:bg-[#142036]'
              : 'border-slate-800'
          }`}
        >
          {/* Clan Header (เหมือนหัวกล่องแคลนทุกประการ) */}
          <div className="p-3 bg-[#0d1422] border-b border-slate-800 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              {/* Left: Tag / Badge */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800/90 text-slate-400 border border-slate-700/60 font-semibold flex items-center gap-1">
                  <UserX className="w-3 h-3 text-slate-400" />
                  <span>{lang === 'th' ? 'รอจัดสรร' : 'Unassigned'}</span>
                </span>
                {draggedUserId && (
                  <span className="text-[10px] text-amber-300 font-semibold animate-pulse">
                    {lang === 'th' ? 'วางเพื่อปลดแคลน' : 'Drop to unassign'}
                  </span>
                )}
              </div>

              {/* Right: Select All button */}
              <div className="flex items-center gap-1.5 shrink-0">
                {isAdminOrOwner && unassignedMembers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleSelectAllInClan(unassignedMembers)}
                    className="text-[10px] text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800/60 hover:bg-slate-800 cursor-pointer border border-slate-700/50 transition-colors"
                  >
                    <span>{t.selectAll}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Clan Info & Avatar */}
            <div className="flex items-center gap-2.5 min-w-0 pt-1">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white font-mono text-xs shrink-0 shadow-md border border-white/10"
                style={{ backgroundColor: '#64748b' }}
              >
                NC
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold font-cinzel text-slate-100 truncate">
                    {lang === 'th' ? 'ไม่มีแคลน' : 'No Clan'}
                  </h3>
                  <span className="text-[10px] font-mono text-slate-500">
                    #{clansToRender.length + 1}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1.5 truncate">
                  <span className="text-slate-300 font-medium">
                    {unassignedMembers.length} {lang === 'th' ? 'คน' : 'members'}
                  </span>
                  <span>•</span>
                  <span className="text-amber-400 font-mono font-bold">
                    ⚡ {unassignedTotalPower.toLocaleString()} PL
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Clan Members Drop Zone & List */}
          <div className="p-3 flex-1 space-y-2 min-h-[160px] max-h-[620px] overflow-y-auto">
            {unassignedMembers.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                <p>
                  {lang === 'th' ? 'ไม่มีสมาชิกตกค้าง (ทุกคนมีแคลนแล้ว)' : 'No unassigned members'}
                </p>
                {isAdminOrOwner && (
                  <p className="text-[10px] text-slate-600 mt-1">
                    {lang === 'th' ? 'ลากการ์ดมาวางที่นี่เพื่อปลดแคลน' : 'Drag member cards here to unassign'}
                  </p>
                )}
              </div>
            ) : filteredUnassignedMembers.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                {lang === 'th' ? 'ไม่พบสมาชิกที่ตรงกับการค้นหา' : 'No members match search query'}
              </div>
            ) : (
              filteredUnassignedMembers.map((member, mIdx) => {
                const isSelected = selectedUserIds.includes(member.id);
                const primaryClass =
                  member.classes && member.classes.length > 0
                    ? member.classes[0]
                    : member.characterClass || '';
                const isQuickMoveOpen = quickMoveUserId === member.id;
                const isOwner = member.role === 'owner';
                const isAdmin = member.role === 'admin';

                return (
                  <div
                    key={member.id}
                    draggable={isAdminOrOwner}
                    onDragStart={() => handleMemberDragStart(member.id)}
                    className={`relative p-2.5 rounded-xl border flex flex-col gap-1.5 transition-all ${
                      isSelected
                        ? 'bg-[#18263d] border-[#38bdf8] text-white shadow'
                        : 'bg-[#0a0f19] border-slate-800 hover:border-slate-700 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
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
                            {isOwner && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold shrink-0 flex items-center gap-0.5">
                                <Crown className="w-2.5 h-2.5" />
                                <span>Owner</span>
                              </span>
                            )}
                            {isAdmin && !isOwner && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold shrink-0 flex items-center gap-0.5">
                                <ShieldCheck className="w-2.5 h-2.5" />
                                <span>Admin</span>
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
                          id={`btn-delete-unassigned-member-${member.id}`}
                          type="button"
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

                    {/* Quick Move Button for Individual Member */}
                    {isAdminOrOwner && (
                      <div className="relative quick-move-popover-container pt-0.5">
                        <button
                          type="button"
                          id={`btn-quick-move-unassigned-${member.id}`}
                          onClick={() => {
                            sounds.playClick();
                            setQuickMoveUserId(isQuickMoveOpen ? null : member.id);
                          }}
                          className="w-full flex items-center justify-between px-2 py-1 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-700/50 text-[10px] text-emerald-300 hover:text-white transition-all cursor-pointer shadow-sm"
                        >
                          <div className="flex items-center gap-1">
                            <ArrowRight className="w-3 h-3 text-emerald-400" />
                            <span>{lang === 'th' ? 'ย้ายเข้าแคลน' : 'Assign to Clan'}</span>
                          </div>
                          <ChevronDown className="w-2.5 h-2.5 text-emerald-400" />
                        </button>

                        {/* Floating Clan Transfer Popover */}
                        {isQuickMoveOpen && (
                          <div className="absolute left-0 right-0 top-full mt-1 rounded-xl bg-[#0e1626] border border-slate-700 shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-0.5">
                            <div className="px-2 py-1 text-[9px] font-bold text-slate-400 uppercase">
                              {t.quickMoveTitle}
                            </div>
                            {displayClans.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => handleQuickMove(member.id, c.name)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[11px] text-slate-200 hover:text-white hover:bg-slate-800 transition-colors text-left cursor-pointer"
                              >
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: c.color || '#d4af37' }}
                                />
                                <span className="truncate font-medium">{c.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Clan Footer Info */}
          <div className="p-3 bg-[#090d16] border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
            <span>
              {t.avgPower}: ⚡ {avgUnassignedPower.toLocaleString()} PL
            </span>
            {isAdminOrOwner && (
              <span className="text-[10px] text-slate-500 italic">
                {lang === 'th' ? 'ลากการ์ดมาเพื่อปลดแคลน' : 'Drag to unassign'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          6. ADD CLAN MODAL
         ───────────────────────────────────────────────────────────── */}
      {showAddClan && isAdminOrOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-gradient-to-b from-[#141d33] via-[#0e1626] to-[#080d18] border border-[#d4af37]/60 shadow-[0_20px_60px_rgba(0,0,0,0.95),0_0_30px_rgba(212,175,55,0.25)] p-6 text-slate-200">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white font-mono text-sm shadow-md border border-white/20"
                  style={{ backgroundColor: newClanColor }}
                >
                  {cleanClanName(newClanName).substring(0, 2).toUpperCase() || '??'}
                </div>
                <div>
                  <h3 className="text-base font-bold font-cinzel text-slate-100">
                    {t.addNewClan}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {lang === 'th' ? 'ระบุชื่อแคลนและเลือกสีประจำแคลน' : 'Enter clan name and choose clan color'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddClan(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddClanSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {lang === 'th' ? 'ชื่อแคลน' : 'Clan Name'}
                </label>
                <input
                  type="text"
                  required
                  id="input-new-clan-name"
                  value={newClanName}
                  onChange={(e) => setNewClanName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#090f1a] border border-slate-700 text-xs text-slate-100 focus:border-[#d4af37] focus:outline-none"
                  placeholder={t.clanNamePlaceholder}
                  autoFocus
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
                      onClick={() => setNewClanColor(color.hex)}
                      className={`h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-transform cursor-pointer ${
                        newClanColor === color.hex
                          ? 'scale-105 ring-2 ring-white ring-offset-2 ring-offset-slate-900 shadow-lg'
                          : 'hover:scale-105 opacity-85 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: color.hex }}
                      title={color.label}
                    >
                      {newClanColor === color.hex && (
                        <Check className="w-4 h-4 text-white drop-shadow" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddClan(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-600 transition-all cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  id="btn-confirm-add-clan"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#aa841c] hover:brightness-110 text-slate-950 font-bold text-xs shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4 text-slate-950" />
                  <span>{t.addNewClan}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          7. EDIT CLAN MODAL (RENAME & COLOR)
         ───────────────────────────────────────────────────────────── */}
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
                  {lang === 'th' ? 'ชื่อแคลน' : 'Clan Name'}
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
                      className={`h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-transform cursor-pointer ${
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
                  <span>{isSavingEdit ? t.loading : t.save}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          8. CONFIRM DELETE CLAN MODAL
         ───────────────────────────────────────────────────────────── */}
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
                <span className="text-slate-400">{lang === 'th' ? 'ชื่อแคลน:' : 'Clan:'}</span>
                <span className="font-bold text-amber-300">
                  {cleanClanName(clanToDelete.name)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'th' ? 'จำนวนสมาชิก:' : 'Members:'}</span>
                <span className="font-mono text-slate-200 font-bold">
                  {activeMembers.filter((m) => cleanClanName(m.clan).toLowerCase() === cleanClanName(clanToDelete.name).toLowerCase()).length} {lang === 'th' ? 'คน' : 'members'}
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-800/40 text-[11px] text-amber-300 mb-5">
              🛡️ {lang === 'th' ? 'สมาชิกในแคลนนี้จะไม่ถูกลบออกจากระบบ แต่จะถูกย้ายไปยังกล่อง "ไม่มีแคลน / รอจัดสรร" อย่างปลอดภัย' : 'Members will not be deleted, but will be safely moved to "No Clan / Unassigned" pool.'}
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

      {/* ─────────────────────────────────────────────────────────────
          9. CONFIRM DELETE INDIVIDUAL MEMBER MODAL
         ───────────────────────────────────────────────────────────── */}
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
                  {lang === 'th' ? 'การกระทำนี้จะลบข้อมูลสมาชิกออกจากระบบ' : 'Permanently removes this member'}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300 mb-5 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">{t.inGameName}:</span>
                <span className="font-bold text-slate-100">{memberToDelete.inGameName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'th' ? 'สังกัดแคลน:' : 'Clan:'}</span>
                <span className="text-amber-300">
                  {isNoClan(memberToDelete.clan) ? (lang === 'th' ? 'ไม่มีแคลน' : 'No Clan') : cleanClanName(memberToDelete.clan)}
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

      {/* ─────────────────────────────────────────────────────────────
          10. CONFIRM BATCH DELETE MODAL
         ───────────────────────────────────────────────────────────── */}
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

      {/* ─────────────────────────────────────────────────────────────
          11. CLAN VISIBILITY SETTINGS MODAL
         ───────────────────────────────────────────────────────────── */}
      {showVisibilityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-gradient-to-b from-[#151c2e] via-[#0f1422] to-[#090d16] border border-sky-500/40 shadow-[0_20px_60px_rgba(0,0,0,0.95),0_0_30px_rgba(56,189,248,0.2)] p-5 sm:p-6 text-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 shrink-0">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100 font-cinzel">
                    {t.clanVisibility}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {t.clanVisibilityDesc}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowVisibilityModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Clan List with Toggle Switches */}
            <div className="py-4 space-y-2.5 max-h-[55vh] overflow-y-auto">
              {displayClans.map((c) => {
                const cleanName = cleanClanName(c.name);
                const clanColor = c.color || CLAN_COLOR_FALLBACK[cleanName.toLowerCase()] || '#d4af37';
                const clanInitial = cleanName.length >= 2 ? cleanName.substring(0, 2).toUpperCase() : cleanName.toUpperCase();
                const membersInThisClan = activeMembers.filter(
                  (m) => (cleanClanName(m.clan) || '').toLowerCase() === cleanName.toLowerCase()
                );
                const isEnabled = c.enabled !== false;
                const isToggling = togglingClanId === c.id;

                return (
                  <div
                    key={c.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isEnabled
                        ? 'bg-[#0f172a]/90 border-slate-700/80 hover:border-slate-600'
                        : 'bg-[#0a0f1d]/50 border-slate-800/60 opacity-70'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white font-mono text-xs shrink-0 shadow border border-white/10"
                        style={{ backgroundColor: clanColor }}
                      >
                        {clanInitial}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-100 truncate font-cinzel">
                            {cleanName}
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded-full font-semibold border ${
                              isEnabled
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            }`}
                          >
                            {isEnabled ? t.clanStatusVisible : t.clanStatusHidden}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {membersInThisClan.length} {lang === 'th' ? 'สมาชิก' : 'members'}
                        </div>
                      </div>
                    </div>

                    {/* Toggle Switch */}
                    {isAdminOrOwner && onToggleClanVisibility && (
                      <button
                        type="button"
                        id={`btn-modal-toggle-${cleanName.toLowerCase()}`}
                        disabled={isToggling}
                        onClick={async () => {
                          sounds.playClick();
                          setTogglingClanId(c.id);
                          try {
                            await onToggleClanVisibility(c.id);
                          } finally {
                            setTogglingClanId(null);
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          isEnabled ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]' : 'bg-slate-700'
                        }`}
                        title={isEnabled ? t.hideClan : t.showClan}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            isEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Reassurance Callout */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 mb-4 flex items-start gap-2.5">
              <span className="text-amber-400 text-sm leading-none shrink-0">🛡️</span>
              <span>
                {lang === 'th'
                  ? 'การซ่อนแคลนจะไม่ลบหรือเปลี่ยนแปลงข้อมูลสมาชิก สมาชิกยังคงสังกัดแคลนนี้ตามเดิมทุกประการ และสามารถเปิดแสดงผลกลับมาเมื่อใดก็ได้'
                  : 'Hiding a clan does not delete or modify member affiliations. Members remain safely assigned and you can unhide anytime.'}
              </span>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                id="btn-close-clan-visibility-modal"
                onClick={() => setShowVisibilityModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all cursor-pointer"
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
