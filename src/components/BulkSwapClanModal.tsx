import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Users,
  Shield,
  Zap,
  Save,
  RotateCcw,
  GripVertical,
  ArrowRightLeft,
  Crown,
  Search,
  CheckCircle2,
  AlertCircle,
  Plus,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Sliders,
  Columns,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { User, cleanClanName, DEFAULT_CLAN } from '../types';
import { sounds } from '../utils/sound';

interface BulkSwapClanModalProps {
  isOpen: boolean;
  onClose: () => void;
  allMembers: User[];
  clans: string[];
  lang: 'th' | 'en';
  onBulkUpdateClans: (swaps: { memberId: string; toClan: string }[]) => Promise<void>;
  onAddClan?: (clanName: string) => Promise<void> | void;
  showToast?: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export const BulkSwapClanModal: React.FC<BulkSwapClanModalProps> = ({
  isOpen,
  onClose,
  allMembers,
  clans,
  lang,
  onBulkUpdateClans,
  onAddClan,
  showToast
}) => {
  // Current assignment state: memberId -> currentClan
  const [memberClans, setMemberClans] = useState<Record<string, string>>({});
  const [draggedMemberId, setDraggedMemberId] = useState<string | null>(null);
  const [dragOverClan, setDragOverClan] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customClans, setCustomClans] = useState<string[]>([]);
  const [newClanInput, setNewClanInput] = useState('');
  const [isAddingClan, setIsAddingClan] = useState(false);

  // Viewport & Auto-fit states
  const [viewMode, setViewMode] = useState<'fit' | 'normal' | 'compact'>('fit');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Horizontal scroll tracking
  const boardRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Initialize clan columns
  const clanColumns = useMemo(() => {
    const list = new Set<string>();
    clans.forEach((c) => {
      const clean = cleanClanName(c);
      if (clean) list.add(clean);
    });
    customClans.forEach((c) => {
      const clean = cleanClanName(c);
      if (clean) list.add(clean);
    });
    list.add(DEFAULT_CLAN);
    list.add('VoltZ 2');
    list.add('VoltZ 3');
    list.add('Unassigned');
    return Array.from(list);
  }, [clans, customClans]);

  // Sync state on open
  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, string> = {};
      allMembers.forEach((m) => {
        const clean = cleanClanName(m.clan) || 'Unassigned';
        initial[m.id] = clean;
      });
      setMemberClans(initial);
      setSearchQuery('');
      setIsSaving(false);
      setDragOverClan(null);
    }
  }, [isOpen, allMembers]);

  // Check horizontal scrollability
  const checkScroll = () => {
    if (!boardRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = boardRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
  };

  useEffect(() => {
    if (isOpen) {
      checkScroll();
      const timer = setTimeout(checkScroll, 100);
      window.addEventListener('resize', checkScroll);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [isOpen, clanColumns, allMembers, viewMode, zoomLevel]);

  const scrollBy = (offset: number) => {
    if (boardRef.current) {
      boardRef.current.scrollBy({ left: offset, behavior: 'smooth' });
      setTimeout(checkScroll, 250);
    }
  };

  // Calculate pending swaps (changed clans)
  const pendingSwaps = useMemo(() => {
    const swaps: { memberId: string; fromClan: string; toClan: string }[] = [];
    allMembers.forEach((m) => {
      const originalClan = cleanClanName(m.clan) || 'Unassigned';
      const currentClan = memberClans[m.id] || originalClan;
      if (originalClan !== currentClan) {
        swaps.push({
          memberId: m.id,
          fromClan: originalClan,
          toClan: currentClan
        });
      }
    });
    return swaps;
  }, [allMembers, memberClans]);

  // Search match count
  const matchedMembersCount = useMemo(() => {
    if (!searchQuery.trim()) return allMembers.length;
    const q = searchQuery.toLowerCase();
    return allMembers.filter(
      (m) =>
        m.inGameName.toLowerCase().includes(q) ||
        (m.characterClass && m.characterClass.toLowerCase().includes(q))
    ).length;
  }, [allMembers, searchQuery]);

  if (!isOpen) return null;

  // Handle Drag & Drop
  const handleDragStart = (e: React.DragEvent, memberId: string) => {
    setDraggedMemberId(memberId);
    e.dataTransfer.setData('text/plain', memberId);
    sounds.playClick();
  };

  const handleDragOver = (e: React.DragEvent, targetClan: string) => {
    e.preventDefault();
    if (dragOverClan !== targetClan) {
      setDragOverClan(targetClan);
    }
  };

  const handleDragLeave = (targetClan: string) => {
    if (dragOverClan === targetClan) {
      setDragOverClan(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetClan: string) => {
    e.preventDefault();
    setDragOverClan(null);
    const memberId = draggedMemberId || e.dataTransfer.getData('text/plain');
    if (!memberId) return;

    if (memberClans[memberId] !== targetClan) {
      sounds.playClaim();
      setMemberClans((prev) => ({
        ...prev,
        [memberId]: targetClan
      }));
    }
    setDraggedMemberId(null);
  };

  // Click-to-move quick handler
  const handleQuickMove = (memberId: string, targetClan: string) => {
    sounds.playClick();
    setMemberClans((prev) => ({
      ...prev,
      [memberId]: targetClan
    }));
  };

  // Reset to original clans
  const handleReset = () => {
    sounds.playClick();
    const initial: Record<string, string> = {};
    allMembers.forEach((m) => {
      initial[m.id] = cleanClanName(m.clan) || 'Unassigned';
    });
    setMemberClans(initial);
  };

  // Save all changes in one batch
  const handleSaveAll = async () => {
    if (pendingSwaps.length === 0) return;
    setIsSaving(true);
    try {
      sounds.playSuccess();
      await onBulkUpdateClans(
        pendingSwaps.map((s) => ({
          memberId: s.memberId,
          toClan: s.toClan === 'Unassigned' ? '' : s.toClan
        }))
      );
      if (showToast) {
        showToast(
          lang === 'th'
            ? `ย้ายสังกัดสมาชิกสำเร็จ ${pendingSwaps.length} คนเรียบร้อยแล้ว! 🏰`
            : `Reassigned ${pendingSwaps.length} members successfully! 🏰`,
          'success'
        );
      }
      onClose();
    } catch (err: any) {
      if (showToast) {
        showToast(
          err?.message || (lang === 'th' ? 'ไม่สามารถบันทึกการเปลี่ยนแปลงได้' : 'Failed to save changes'),
          'error'
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Add new clan column handler
  const handleCreateClan = async () => {
    const trimmed = newClanInput.trim();
    if (!trimmed) return;
    if (clanColumns.includes(trimmed)) {
      if (showToast) {
        showToast(lang === 'th' ? 'มีชื่อแคลนนี้อยู่แล้ว' : 'Clan already exists', 'warning');
      }
      return;
    }
    setCustomClans((prev) => [...prev, trimmed]);
    if (onAddClan) {
      try {
        await onAddClan(trimmed);
      } catch (err: any) {
        console.error('Failed to create clan:', err);
      }
    }
    setNewClanInput('');
    setIsAddingClan(false);
    sounds.playSuccess();
    if (showToast) {
      showToast(
        lang === 'th' ? `เพิ่มแคลน ${trimmed} สำเร็จ` : `Added clan ${trimmed}`,
        'success'
      );
    }
  };

  // Column width configuration based on viewMode
  const getColumnWidthClass = () => {
    switch (viewMode) {
      case 'fit':
        // Dynamically divides available width and fits side-by-side without overflow
        return 'flex-1 min-w-[170px] max-w-none';
      case 'compact':
        return 'flex-1 min-w-[190px] max-w-[270px]';
      case 'normal':
      default:
        return 'flex-1 min-w-[275px] max-w-[340px]';
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md animate-fade-in ${
        isFullscreen ? 'p-0' : 'p-2 sm:p-4'
      }`}
    >
      <div
        className={`relative flex flex-col bg-slate-900 border border-slate-700/80 shadow-2xl shadow-cyan-950/40 text-slate-100 overflow-hidden transition-all duration-200 ${
          isFullscreen
            ? 'w-screen h-screen rounded-none max-w-none max-h-none border-none'
            : 'w-[98vw] max-w-[1920px] h-[94vh] max-h-[96vh] rounded-2xl'
        }`}
      >
        {/* Top Header */}
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-purple-500/20 border border-purple-500/50 flex items-center justify-center text-purple-400 shadow-lg shadow-purple-500/20 shrink-0">
              <ArrowRightLeft className="size-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>
                  {lang === 'th'
                    ? 'จัดสรรผังแคลนแบบกลุ่ม (Bulk Swap Clan Organizer)'
                    : 'Bulk Swap Clan Organizer'}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono">
                  {allMembers.length} {lang === 'th' ? 'คน' : 'Members'}
                </span>
                {pendingSwaps.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono animate-pulse">
                    {lang === 'th' ? `ปรับเปลี่ยน ${pendingSwaps.length}` : `${pendingSwaps.length} pending`}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400 hidden sm:block">
                {lang === 'th'
                  ? 'ลากวางสมาชิกสลับแคลนหลัก/แคลนรอง ดูค่าพลังรวมของแต่ละแคลน และกดบันทึกรวดเดียวจบ'
                  : 'Drag and drop members between clan columns to reassign them. Apply all at once when ready.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Search Box */}
            <div className="relative w-36 sm:w-56">
              <Search className="size-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === 'th' ? 'ค้นหาชื่อ/อาชีพ...' : 'Search name/class...'}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-750 text-xs text-white focus:outline-none focus:border-amber-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Fullscreen Toggle */}
            <button
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title={
                isFullscreen
                  ? lang === 'th'
                    ? 'ย่อหน้าต่างกลับสู่ขนาดปกติ'
                    : 'Exit Fullscreen'
                  : lang === 'th'
                  ? 'ขยายเต็มหน้าจอ'
                  : 'Fullscreen'
              }
            >
              {isFullscreen ? (
                <Minimize2 className="size-4.5 text-amber-400" />
              ) : (
                <Maximize2 className="size-4.5" />
              )}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              aria-label="Close"
              title={lang === 'th' ? 'ปิดหน้าต่าง' : 'Close'}
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* View Mode & Fit Toolbar */}
        <div className="shrink-0 flex flex-wrap items-center justify-between px-4 sm:px-6 py-2 bg-slate-925 border-b border-slate-800/80 gap-2">
          {/* Left: View Mode Presets */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-400 mr-1 hidden md:inline">
              {lang === 'th' ? 'โหมดแสดงผล:' : 'View Mode:'}
            </span>

            {/* Auto-Fit Mode Button */}
            <button
              type="button"
              onClick={() => setViewMode('fit')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                viewMode === 'fit'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'bg-slate-800/70 text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title={
                lang === 'th'
                  ? 'ย่อขยายกล่องอัตโนมัติให้ทุกแคลนพอดีกับหน้าต่างจอเสมอโดยไม่ต้องเลื่อน'
                  : 'Auto-adjust column and box widths to fit viewport'
              }
            >
              <Sparkles className="size-3.5 text-amber-300" />
              <span>{lang === 'th' ? '🎯 ย่อพอดีจอ (Auto-Fit)' : '🎯 Fit Screen'}</span>
            </button>

            {/* Compact Mode Button */}
            <button
              type="button"
              onClick={() => setViewMode('compact')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                viewMode === 'compact'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'bg-slate-800/70 text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title={
                lang === 'th'
                  ? 'ย่อกล่องขนาดกะทัดรัดพิเศษ แสดงสมาชิกได้มากที่สุด'
                  : 'Compact dense view to see maximum members'
              }
            >
              <Sliders className="size-3.5 text-cyan-300" />
              <span>{lang === 'th' ? '⚡ กะทัดรัด (Compact)' : '⚡ Compact'}</span>
            </button>

            {/* Standard Scroll Mode Button */}
            <button
              type="button"
              onClick={() => setViewMode('normal')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                viewMode === 'normal'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'bg-slate-800/70 text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title={
                lang === 'th'
                  ? 'ขยายกล่องขนาดใหญ่ปกติ พร้อมแถบเลื่อนซ้าย-ขวา'
                  : 'Standard wide columns with horizontal scrolling'
              }
            >
              <Columns className="size-3.5 text-slate-300" />
              <span>{lang === 'th' ? '↔️ เลื่อนข้าง (Scroll)' : '↔️ Scroll'}</span>
            </button>
          </div>

          {/* Right: Zoom Scale & Clan Count */}
          <div className="flex items-center gap-3">
            {/* Search Match Indicator */}
            {searchQuery && (
              <span className="text-xs text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 rounded-lg">
                {lang === 'th'
                  ? `พบตรงค้นหา ${matchedMembersCount} คน`
                  : `${matchedMembersCount} matches`}
              </span>
            )}

            {/* Zoom / Scale Controller */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 px-2 py-1 rounded-xl">
              <span className="text-[11px] text-slate-400 font-medium mr-0.5">
                {lang === 'th' ? 'ย่อ/ขยาย:' : 'Scale:'}
              </span>
              <button
                type="button"
                disabled={zoomLevel <= 70}
                onClick={() => setZoomLevel((z) => Math.max(70, z - 10))}
                className="p-1 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-slate-800 transition cursor-pointer"
                title={lang === 'th' ? 'ย่อขนาดลง' : 'Zoom Out'}
              >
                <ZoomOut className="size-3.5" />
              </button>
              <span className="text-[11px] font-mono text-cyan-300 min-w-[36px] text-center font-bold">
                {zoomLevel}%
              </span>
              <button
                type="button"
                disabled={zoomLevel >= 120}
                onClick={() => setZoomLevel((z) => Math.min(120, z + 10))}
                className="p-1 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-slate-800 transition cursor-pointer"
                title={lang === 'th' ? 'ขยายขนาดขึ้น' : 'Zoom In'}
              >
                <ZoomIn className="size-3.5" />
              </button>
            </div>

            {/* Clan Count Badge */}
            <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-800/80 text-slate-300 border border-slate-700/80">
              {clanColumns.length} {lang === 'th' ? 'แคลน' : 'Clans'}
            </span>
          </div>
        </div>

        {/* Columns Board Body Area */}
        <div className="relative flex-1 min-h-0 overflow-hidden bg-slate-950/40">
          {/* Smooth Left Scroll Button (When overflowing) */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scrollBy(-340)}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-30 size-11 rounded-full bg-slate-900/95 border-2 border-purple-500 text-white shadow-2xl shadow-black flex items-center justify-center hover:bg-purple-600 hover:scale-110 active:scale-95 transition cursor-pointer backdrop-blur-sm"
              title={lang === 'th' ? 'เลื่อนดูแคลนด้านซ้าย' : 'Scroll Left'}
            >
              <ChevronLeft className="size-6 text-purple-200" />
            </button>
          )}

          {/* Smooth Right Scroll Button (When overflowing) */}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => scrollBy(340)}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-30 size-11 rounded-full bg-slate-900/95 border-2 border-purple-500 text-white shadow-2xl shadow-black flex items-center justify-center hover:bg-purple-600 hover:scale-110 active:scale-95 transition cursor-pointer backdrop-blur-sm"
              title={lang === 'th' ? 'เลื่อนดูแคลนด้านขวา' : 'Scroll Right'}
            >
              <ChevronRight className="size-6 text-purple-200" />
            </button>
          )}

          {/* Scrollable Columns Container */}
          <div
            ref={boardRef}
            onScroll={checkScroll}
            style={{
              zoom: zoomLevel !== 100 ? `${zoomLevel}%` : undefined
            }}
            className="w-full h-full p-3 sm:p-4 overflow-x-auto overflow-y-hidden"
          >
            <div
              className={`h-full flex gap-3 ${
                viewMode === 'fit' ? 'w-full min-w-0' : 'min-w-max'
              }`}
            >
              {clanColumns.map((clanName) => {
                // Filter and sort members in this clan by PL descending
                const membersInClan = allMembers
                  .filter((m) => {
                    const assignedClan = memberClans[m.id] || cleanClanName(m.clan) || 'Unassigned';
                    const matchesClan = assignedClan === clanName;
                    const matchesSearch =
                      !searchQuery ||
                      m.inGameName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (m.characterClass &&
                        m.characterClass.toLowerCase().includes(searchQuery.toLowerCase()));
                    return matchesClan && matchesSearch;
                  })
                  .sort((a, b) => (b.powerLevel || 0) - (a.powerLevel || 0));

                const totalClanPL = membersInClan.reduce(
                  (sum, m) => sum + (m.powerLevel || 0),
                  0
                );
                const avgClanPL =
                  membersInClan.length > 0 ? Math.round(totalClanPL / membersInClan.length) : 0;
                const isMainClan = clanName === DEFAULT_CLAN;
                const isDragTarget = dragOverClan === clanName;
                const isOverCapacity = membersInClan.length > 50;
                const isFullCapacity = membersInClan.length === 50;

                return (
                  <div
                    key={clanName}
                    onDragOver={(e) => handleDragOver(e, clanName)}
                    onDragLeave={() => handleDragLeave(clanName)}
                    onDrop={(e) => handleDrop(e, clanName)}
                    className={`${getColumnWidthClass()} flex flex-col h-full rounded-2xl border transition-all duration-200 overflow-hidden ${
                      isDragTarget
                        ? 'ring-2 ring-purple-400 bg-purple-950/40 border-purple-400 shadow-xl shadow-purple-950/40 scale-[1.01]'
                        : isMainClan
                        ? 'bg-slate-850/95 border-amber-500/40 shadow-lg shadow-amber-950/20'
                        : clanName === 'Unassigned'
                        ? 'bg-slate-900/70 border-dashed border-slate-750'
                        : 'bg-slate-850/70 border-slate-750'
                    }`}
                  >
                    {/* Column Header */}
                    <div
                      className={`shrink-0 border-b border-slate-750/80 ${
                        viewMode === 'compact' ? 'p-2 space-y-1' : 'p-3 space-y-2'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {isMainClan ? (
                            <Crown className="size-4 text-amber-400 shrink-0" />
                          ) : clanName === 'Unassigned' ? (
                            <Users className="size-4 text-slate-400 shrink-0" />
                          ) : (
                            <Shield className="size-4 text-purple-400 shrink-0" />
                          )}
                          <span
                            className="font-bold text-xs sm:text-sm text-white truncate"
                            title={clanName}
                          >
                            {clanName === 'Unassigned'
                              ? lang === 'th'
                                ? 'ยังไม่มีแคลน'
                                : 'Unassigned'
                              : clanName}
                          </span>
                        </div>

                        {/* Capacity Tag */}
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-bold border shrink-0 ${
                            isOverCapacity
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse'
                              : isFullCapacity
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                              : 'bg-slate-900 text-slate-300 border-slate-750'
                          }`}
                          title={
                            isOverCapacity
                              ? lang === 'th'
                                ? 'เกินโควต้าสูงสุด 50 คน'
                                : 'Over capacity (50 max)'
                              : undefined
                          }
                        >
                          {membersInClan.length}/50
                        </span>
                      </div>

                      {/* Stats Summary Bar */}
                      <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400 pt-1 border-t border-slate-800/80 font-mono">
                        <span className="truncate">
                          {lang === 'th' ? 'รวม:' : 'Total:'}{' '}
                          <strong className="text-amber-400">
                            ⚡ {totalClanPL.toLocaleString()}
                          </strong>
                        </span>
                        <span className="truncate">
                          {lang === 'th' ? 'เฉลี่ย:' : 'Avg:'}{' '}
                          <strong className="text-cyan-400">
                            {avgClanPL.toLocaleString()}
                          </strong>
                        </span>
                      </div>
                    </div>

                    {/* Drop Zone & Members List */}
                    <div
                      className={`flex-1 min-h-0 overflow-y-auto space-y-1.5 ${
                        viewMode === 'compact' ? 'p-1.5' : 'p-2'
                      }`}
                    >
                      {membersInClan.length === 0 ? (
                        <div className="py-10 text-center text-xs text-slate-500">
                          <div>
                            {lang === 'th' ? 'ไม่มีสมาชิกในแคลนนี้' : 'No members in this clan'}
                          </div>
                          <div className="text-[10px] text-slate-600 mt-1">
                            {lang === 'th'
                              ? 'ลากสมาชิกมาปล่อยที่นี่'
                              : 'Drag members here to reassign'}
                          </div>
                        </div>
                      ) : (
                        membersInClan.map((member, index) => {
                          const originalClan = cleanClanName(member.clan) || 'Unassigned';
                          const isMoved = originalClan !== clanName;

                          return (
                            <div
                              key={member.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, member.id)}
                              className={`rounded-xl flex items-center justify-between gap-1.5 cursor-grab active:cursor-grabbing select-none border transition-all duration-150 ${
                                viewMode === 'compact' ? 'p-1.5' : 'p-2'
                              } ${
                                isMoved
                                  ? 'bg-amber-500/15 border-amber-400 text-amber-200 ring-1 ring-amber-400/40 shadow-sm'
                                  : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 text-slate-200 hover:bg-slate-850'
                              }`}
                            >
                              {/* Left Info */}
                              <div className="flex items-center gap-1.5 overflow-hidden min-w-0">
                                <GripVertical className="size-3 text-slate-500 shrink-0" />
                                <span className="w-4 text-center font-bold text-[10px] text-slate-500 shrink-0">
                                  #{index + 1}
                                </span>

                                <div className="min-w-0">
                                  <div className="font-semibold text-xs text-white truncate flex items-center gap-1">
                                    <span className="truncate" title={member.inGameName}>
                                      {member.inGameName}
                                    </span>
                                    {isMoved && (
                                      <span className="text-[8px] px-1 rounded bg-amber-500 text-slate-950 font-bold uppercase shrink-0">
                                        {lang === 'th' ? 'ย้าย' : 'MOVED'}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
                                    <span className="truncate">{member.characterClass || 'Class'}</span>
                                    {isMoved && (
                                      <span className="text-slate-500 line-through text-[9px] truncate">
                                        ({originalClan})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right Power & Quick Move */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[11px] font-bold text-amber-400 font-mono">
                                  ⚡ {(member.powerLevel || 0).toLocaleString()}
                                </span>

                                {/* Quick Move Select Dropdown */}
                                <select
                                  value={clanName}
                                  onChange={(e) => handleQuickMove(member.id, e.target.value)}
                                  className="text-[10px] py-0.5 px-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 focus:outline-none focus:border-purple-400 cursor-pointer"
                                  title={lang === 'th' ? 'ย้ายไปแคลนอื่น...' : 'Move to clan...'}
                                >
                                  <option value={clanName} disabled>
                                    {lang === 'th' ? 'ย้าย...' : 'Move...'}
                                  </option>
                                  {clanColumns.map((c) => (
                                    <option key={c} value={c}>
                                      → {c === 'Unassigned' ? (lang === 'th' ? 'ไม่ระบุ' : 'Unassigned') : c}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Add New Clan Column */}
              <div
                className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-750/70 p-4 bg-slate-900/30 hover:border-purple-500/50 hover:bg-slate-900/50 transition ${
                  viewMode === 'fit'
                    ? 'min-w-[140px] max-w-[180px] shrink-0'
                    : 'min-w-[220px] max-w-[260px] shrink-0'
                }`}
              >
                {isAddingClan ? (
                  <div className="w-full space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-white">
                      <Shield className="size-3.5 text-purple-400" />
                      <span>{lang === 'th' ? 'ชื่อแคลนใหม่' : 'New Clan Name'}</span>
                    </div>
                    <input
                      type="text"
                      value={newClanInput}
                      onChange={(e) => setNewClanInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateClan();
                        if (e.key === 'Escape') {
                          setIsAddingClan(false);
                          setNewClanInput('');
                        }
                      }}
                      placeholder={lang === 'th' ? 'เช่น VoltZ 4...' : 'e.g. VoltZ 4...'}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500"
                      autoFocus
                    />
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleCreateClan}
                        className="flex-1 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition cursor-pointer"
                      >
                        {lang === 'th' ? 'สร้าง' : 'Create'}
                      </button>
                      <button
                        onClick={() => {
                          setIsAddingClan(false);
                          setNewClanInput('');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
                      >
                        {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAddingClan(true)}
                    className="flex flex-col items-center gap-2 text-slate-400 hover:text-purple-300 group transition cursor-pointer text-center"
                  >
                    <div className="size-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-110 group-hover:bg-purple-500/20 transition">
                      <Plus className="size-5" />
                    </div>
                    <span className="text-xs font-bold">
                      {lang === 'th' ? '+ เพิ่มแคลน' : '+ Add Clan'}
                    </span>
                    <span className="text-[10px] text-slate-500 hidden sm:block">
                      {lang === 'th' ? 'สร้างคอลัมน์ใหม่' : 'New column'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Pinned Bottom Action Bar (Never overlaps columns) */}
        <div className="shrink-0 p-3 sm:p-4 bg-slate-950/95 border-t border-slate-800 backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            {pendingSwaps.length > 0 ? (
              <div className="flex items-center gap-2 text-xs text-amber-300 font-semibold bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl">
                <AlertCircle className="size-4 text-amber-400 animate-pulse shrink-0" />
                <span>
                  {lang === 'th'
                    ? `มีการสลับตำแหน่งสมาชิก ${pendingSwaps.length} คน (ยังไม่ได้บันทึก)`
                    : `${pendingSwaps.length} member reassignments pending save`}
                </span>
              </div>
            ) : (
              <span className="text-xs text-slate-500">
                {lang === 'th'
                  ? '💡 ลากวางสมาชิกหรือเลือกย้ายแคลนเพื่อจัดทัพตามพลังรบ'
                  : '💡 Drag and drop members to balance clan strength'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {pendingSwaps.length > 0 && (
              <button
                type="button"
                onClick={handleReset}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                <RotateCcw className="size-3.5" />
                <span>{lang === 'th' ? 'คืนค่าเดิม' : 'Reset'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              {lang === 'th' ? 'ปิด' : 'Cancel'}
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving || pendingSwaps.length === 0}
              className="flex items-center gap-1.5 px-5 sm:px-6 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition cursor-pointer"
            >
              <Save className="size-4" />
              <span>
                {isSaving
                  ? lang === 'th'
                    ? 'กำลังบันทึก...'
                    : 'Saving...'
                  : lang === 'th'
                  ? `บันทึกการจัดทัพ (${pendingSwaps.length})`
                  : `Save Assignments (${pendingSwaps.length})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
