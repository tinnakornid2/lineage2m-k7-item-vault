import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Move,
  Layers,
  ChevronLeft,
  ChevronRight,
  Search,
  Swords,
  Shield,
  Clock
} from 'lucide-react';
import { User, OFFICIAL_CLASSES, StatCategory } from '../types';
import { sounds } from '../utils/sound';
import { getFormulaSettings } from '../services/powerFormulaService';

interface StatComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  lang: 'th' | 'en';
  onApprove?: (user: User) => Promise<void>;
  onOpenReject?: (userId: string) => void;
  isProcessing?: boolean;
}

export const StatComparisonModal: React.FC<StatComparisonModalProps> = ({
  isOpen,
  onClose,
  user,
  lang,
  onApprove,
  onOpenReject,
  isProcessing = false
}) => {
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [filterChangedOnly, setFilterChangedOnly] = useState<boolean>(false);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const positionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const formulaConfig = getFormulaSettings();
  const classMap = new Map(OFFICIAL_CLASSES.map((c) => [c.nameEn.toLowerCase(), c]));

  // Reset zoom, pan & index on open or when user changes
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      positionRef.current = { x: 0, y: 0 };
      setFilterChangedOnly(false);
      setCurrentImageIndex(0);
      setSearchTerm('');
      setSelectedCategory('all');
    }
  }, [isOpen, user?.id]);

  // Gather unique screenshots
  const candidateScreenshots: (string | undefined | null)[] = user
    ? [
        user.pendingStatScreenshotUrl,
        user.statScreenshotUrl,
        ...(user.screenshots || []),
        user.screenshotUrl
      ]
    : [];

  const uniqueScreenshots = Array.from(
    new Set(candidateScreenshots.filter((s): s is string => typeof s === 'string' && s.trim().length > 0))
  );

  const activeScreenshot = uniqueScreenshots[currentImageIndex] || uniqueScreenshots[0] || null;

  const handleZoomIn = useCallback(() => {
    sounds.playClick();
    setScale((prev) => Math.min(Math.round((prev + 0.25) * 100) / 100, 4));
  }, []);

  const handleZoomOut = useCallback(() => {
    sounds.playClick();
    setScale((prev) => {
      const next = Math.max(Math.round((prev - 0.25) * 100) / 100, 0.4);
      if (next <= 1) {
        setPosition({ x: 0, y: 0 });
        positionRef.current = { x: 0, y: 0 };
      }
      return next;
    });
  }, []);

  const handleSetScale = useCallback((targetScale: number) => {
    sounds.playClick();
    setScale(targetScale);
    if (targetScale <= 1) {
      setPosition({ x: 0, y: 0 });
      positionRef.current = { x: 0, y: 0 };
    }
  }, []);

  const handleReset = useCallback(() => {
    sounds.playClick();
    setScale(1);
    setPosition({ x: 0, y: 0 });
    positionRef.current = { x: 0, y: 0 };
  }, []);

  // Keyboard shortcut listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleReset();
      } else if (e.key === 'ArrowLeft' && uniqueScreenshots.length > 1) {
        setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : uniqueScreenshots.length - 1));
      } else if (e.key === 'ArrowRight' && uniqueScreenshots.length > 1) {
        setCurrentImageIndex((prev) => (prev < uniqueScreenshots.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handleZoomIn, handleZoomOut, handleReset, uniqueScreenshots.length]);

  // Mouse drag & pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // only left click
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - positionRef.current.x,
      y: e.clientY - positionRef.current.y
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStartRef.current.x;
    const newY = e.clientY - dragStartRef.current.y;
    positionRef.current = { x: newX, y: newY };
    setPosition({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      // Zoom in
      setScale((prev) => Math.min(Math.round((prev + 0.15) * 100) / 100, 4));
    } else {
      // Zoom out
      setScale((prev) => {
        const next = Math.max(Math.round((prev - 0.15) * 100) / 100, 0.4);
        if (next <= 1) {
          setPosition({ x: 0, y: 0 });
          positionRef.current = { x: 0, y: 0 };
        }
        return next;
      });
    }
  };

  if (!isOpen || !user) return null;

  const isPendingNew = !!(
    user.pendingPowerLevel ||
    user.pendingStatScreenshotUrl ||
    (user.pendingStats && Object.keys(user.pendingStats).length > 0)
  );

  const prevPL = user.powerLevel || 0;
  const nextPL = isPendingNew ? (user.pendingPowerLevel || prevPL) : prevPL;
  const diffPL = isPendingNew ? nextPL - prevPL : 0;

  const effectiveStats = (isPendingNew && user.pendingStats && Object.keys(user.pendingStats).length > 0)
    ? user.pendingStats
    : (user.stats || {});
  const effectiveSpirits = (isPendingNew && user.pendingSpiritEnhancements && Object.keys(user.pendingSpiritEnhancements).length > 0)
    ? user.pendingSpiritEnhancements
    : (user.spiritEnhancements || user.spirits || {});

  const displayClasses = (isPendingNew && user.pendingClasses !== undefined && user.pendingClasses !== null)
    ? user.pendingClasses
    : (user.classes || (user.characterClass ? [user.characterClass] : []));
  const displayLevel = (isPendingNew && user.pendingLevel !== undefined && user.pendingLevel !== null)
    ? user.pendingLevel
    : (user.level || 0);
  const displayLegendClasses = (isPendingNew && user.pendingLegendClasses !== undefined && user.pendingLegendClasses !== null)
    ? user.pendingLegendClasses
    : (user.legendClasses || 0);
  const displayLegendAgathions = (isPendingNew && user.pendingLegendAgathions !== undefined && user.pendingLegendAgathions !== null)
    ? user.pendingLegendAgathions
    : (user.legendAgathions || 0);

  // All active stats from formula configuration
  const statList = formulaConfig.stats.filter((s) => s.isActive);

  // Changed count when pending
  const totalChangedCount = isPendingNew
    ? statList.filter((s) => (user.pendingStats?.[s.id] ?? 0) !== (user.stats?.[s.id] ?? 0)).length
    : 0;

  // Filtered stats by category, search term, and changed toggle
  const displayedStats = statList.filter((s) => {
    if (filterChangedOnly && isPendingNew) {
      if ((user.pendingStats?.[s.id] ?? 0) === (user.stats?.[s.id] ?? 0)) return false;
    }
    if (selectedCategory !== 'all' && s.category !== selectedCategory) {
      return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      const matchLabelTh = s.labelTh.toLowerCase().includes(q);
      const matchLabelEn = s.labelEn.toLowerCase().includes(q);
      const matchId = s.id.toLowerCase().includes(q);
      if (!matchLabelTh && !matchLabelEn && !matchId) return false;
    }
    return true;
  });

  const canShowApprovalActions = isPendingNew && !!onApprove && !!onOpenReject;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-xl animate-fade-in text-slate-100 overflow-hidden select-none">
      {/* ── TOP NAV / HEADER BAR ────────────────────────────────────── */}
      <div className="h-16 px-4 sm:px-6 border-b border-slate-800 bg-slate-900/95 flex items-center justify-between gap-4 shrink-0 shadow-lg z-20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold flex items-center justify-center shrink-0 shadow-inner">
            {user.inGameName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white text-base truncate">
                {user.inGameName}
              </span>
              <span className="text-xs text-slate-400">
                ({user.clan || 'VoltZ'})
              </span>
              {displayLevel > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-mono">
                  Lv. {displayLevel}
                </span>
              )}
              {displayClasses.map((clsName) => {
                const meta = classMap.get(clsName.toLowerCase());
                return (
                  <span
                    key={clsName}
                    className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-purple-500/20 text-purple-200 border border-purple-500/40"
                  >
                    {meta?.icon && (
                      <img
                        src={meta.icon}
                        alt={clsName}
                        className="size-3.5 object-contain shrink-0"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    )}
                    <span>{clsName}</span>
                  </span>
                );
              })}
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-2">
              <span className="text-amber-300 font-semibold">
                {lang === 'th' ? '🔍 ตรวจสอบรูปภาพเปรียบเทียบกับค่าพลังที่กรอก' : '🔍 Proof Screenshot vs Submitted Stats'}
              </span>
              <span>•</span>
              <span className="text-slate-400">
                {isPendingNew ? (
                  <span className="text-amber-400">⚡ {lang === 'th' ? 'คำขออัปเดตใหม่ (Pending Update)' : 'Pending Update Request'}</span>
                ) : (
                  <span className="text-emerald-400">✓ {lang === 'th' ? 'สเตตัสที่ยืนยันแล้ว (Verified Stats)' : 'Verified Member Profile'}</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Power Level Comparison Badge & Close Button */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-slate-950 border border-slate-750">
            {isPendingNew ? (
              <>
                <span className="text-xs text-slate-400 font-mono">{prevPL.toLocaleString()} PL</span>
                <ArrowRight className="size-3.5 text-slate-500" />
                <span className="text-sm font-black text-amber-400 font-mono">⚡ {nextPL.toLocaleString()} PL</span>
                {diffPL > 0 && (
                  <span className="text-xs font-bold text-emerald-400 font-mono bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/30">
                    (+{diffPL.toLocaleString()})
                  </span>
                )}
              </>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400">{lang === 'th' ? 'ค่าพลังปัจจุบัน:' : 'Power Level:'}</span>
                <span className="text-sm font-black text-amber-400 font-mono">⚡ {prevPL.toLocaleString()} PL</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  VERIFIED
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer border border-slate-700"
            title={lang === 'th' ? 'ปิดหน้าต่าง (Esc)' : 'Close (Esc)'}
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      {/* ── MAIN SPLIT-VIEW BODY ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* ═══ LEFT PANEL: FULL SCREENSHOT INSPECTOR (65% - 70%) ═══════ */}
        <div className="flex-1 flex flex-col relative bg-[#06090e] overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-800">
          {/* Floating Zoom & Pan Controls Bar */}
          <div className="absolute top-4 left-4 z-30 flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-slate-900/90 border border-slate-700 shadow-2xl backdrop-blur-md">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
              title={lang === 'th' ? 'ซูมออก (-)' : 'Zoom Out (-)'}
            >
              <ZoomOut className="size-4" />
            </button>

            <span className="px-2 text-xs font-mono font-bold text-amber-300 min-w-[50px] text-center">
              {Math.round(scale * 100)}%
            </span>

            <button
              type="button"
              onClick={handleZoomIn}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
              title={lang === 'th' ? 'ซูมเข้า (+)' : 'Zoom In (+)'}
            >
              <ZoomIn className="size-4" />
            </button>

            <div className="w-px h-5 bg-slate-700 mx-1" />

            <button
              type="button"
              onClick={handleReset}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                scale === 1
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
              title={lang === 'th' ? 'พอดีหน้าต่าง' : 'Fit to Window'}
            >
              <Maximize2 className="size-3.5 inline mr-1" />
              <span>{lang === 'th' ? 'พอดีจอ' : 'Fit'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSetScale(1.5)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                scale === 1.5
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              150%
            </button>

            <button
              type="button"
              onClick={() => handleSetScale(2)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                scale === 2
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              200%
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title={lang === 'th' ? 'รีเซ็ตตำแหน่ง' : 'Reset View'}
            >
              <RotateCcw className="size-4" />
            </button>
          </div>

          {/* Floating Multi-Screenshot Navigation Bar (Top Right) */}
          {uniqueScreenshots.length > 1 && (
            <div className="absolute top-4 right-4 z-30 flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-900/90 border border-slate-700 shadow-2xl backdrop-blur-md">
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : uniqueScreenshots.length - 1));
                }}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                title={lang === 'th' ? 'รูปก่อนหน้า (←)' : 'Previous image (←)'}
              >
                <ChevronLeft className="size-4" />
              </button>

              <span className="text-xs font-mono font-bold text-amber-300 px-2">
                📷 {currentImageIndex + 1} / {uniqueScreenshots.length}
              </span>

              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setCurrentImageIndex((prev) => (prev < uniqueScreenshots.length - 1 ? prev + 1 : 0));
                }}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                title={lang === 'th' ? 'รูปถัดไป (→)' : 'Next image (→)'}
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}

          {/* Bottom Hint Indicator */}
          <div className="absolute bottom-4 left-4 z-30 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2 backdrop-blur-sm pointer-events-none">
            <Move className="size-3.5 text-amber-400" />
            <span>
              {lang === 'th'
                ? '✓ เลื่อนล้อเมาส์เพื่อซูม หรือคลิกลากเพื่อเลื่อนดูทุกจุดของภาพ'
                : '✓ Scroll mouse wheel to zoom, drag to pan anywhere'}
            </span>
          </div>

          {/* Canvas Container */}
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            className={`flex-1 w-full h-full flex items-center justify-center overflow-hidden relative select-none ${
              scale > 1
                ? isDragging
                  ? 'cursor-grabbing'
                  : 'cursor-grab'
                : 'cursor-default'
            }`}
          >
            {activeScreenshot ? (
              <div
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                  transformOrigin: 'center center',
                  transition: isDragging ? 'none' : 'transform 0.12s ease-out'
                }}
                className="max-w-full max-h-full flex items-center justify-center p-4 pointer-events-none"
              >
                <img
                  src={activeScreenshot}
                  alt="Proof Screenshot"
                  className="max-w-[95vw] max-h-[85vh] object-contain rounded-xl shadow-2xl pointer-events-none border border-slate-800"
                  draggable={false}
                />
              </div>
            ) : (
              <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3 max-w-sm">
                <AlertCircle className="size-10 text-amber-400 mx-auto" />
                <div className="text-sm font-bold text-white">
                  {lang === 'th' ? 'ไม่มีรูปสกรีนช็อตแนบมา' : 'No screenshot attached'}
                </div>
                <p className="text-xs text-slate-400">
                  {lang === 'th'
                    ? 'สมาชิกรายนี้ยังไม่มีการอัปโหลดภาพสเตตัสในระบบ'
                    : 'This member has not attached any proof screenshot.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ═══ RIGHT PANEL: SUBMITTED STATS COMPARISON (30% - 35%) ════ */}
        <div className="w-full lg:w-[440px] xl:w-[480px] bg-slate-900 flex flex-col shrink-0 h-full overflow-hidden shadow-2xl">
          {/* Panel Header & Filter Controls */}
          <div className="p-4 border-b border-slate-800 space-y-3 bg-slate-900/95">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="size-4 text-amber-400" />
                <span>
                  {isPendingNew
                    ? (lang === 'th' ? 'สเตตัสที่ขออัปเดต' : 'Submitted Stats')
                    : (lang === 'th' ? 'สเตตัสตัวละครที่กรอก' : 'Character Stats')}
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {displayedStats.length} / {statList.length} {lang === 'th' ? 'รายการ' : 'fields'}
              </span>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="size-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={lang === 'th' ? 'ค้นหาสเตตัส (เช่น โจมตี, ป้องกัน, แม่นยำ)...' : 'Search stats (e.g. atk, def)...'}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* Filter Toggle: All vs Changed Only (When pending) or Category Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs custom-scrollbar">
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setSelectedCategory('all');
                  setFilterChangedOnly(false);
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer shrink-0 ${
                  selectedCategory === 'all' && !filterChangedOnly
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {lang === 'th' ? 'ทั้งหมด' : 'All'}
              </button>

              {isPendingNew && (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setFilterChangedOnly(!filterChangedOnly);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer shrink-0 flex items-center gap-1 ${
                    filterChangedOnly
                      ? 'bg-amber-500 text-slate-950 font-bold shadow'
                      : 'bg-slate-950 border border-slate-800 text-amber-400 hover:text-amber-300'
                  }`}
                >
                  <Sparkles className="size-3" />
                  <span>{lang === 'th' ? 'เฉพาะที่เปลี่ยน' : 'Changed'}</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-mono font-bold">
                    {totalChangedCount}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setSelectedCategory('attack');
                  setFilterChangedOnly(false);
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer shrink-0 ${
                  selectedCategory === 'attack'
                    ? 'bg-rose-500 text-white font-bold shadow'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {lang === 'th' ? 'โจมตี' : 'Attack'}
              </button>

              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setSelectedCategory('defense');
                  setFilterChangedOnly(false);
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer shrink-0 ${
                  selectedCategory === 'defense'
                    ? 'bg-blue-500 text-white font-bold shadow'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {lang === 'th' ? 'ป้องกัน' : 'Defense'}
              </button>

              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setSelectedCategory('spirits');
                  setFilterChangedOnly(false);
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer shrink-0 ${
                  selectedCategory === 'spirits'
                    ? 'bg-purple-500 text-white font-bold shadow'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {lang === 'th' ? 'วิญญาณ' : 'Spirits'}
              </button>
            </div>
          </div>

          {/* Stats List (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
            {/* Character Info Card */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {lang === 'th' ? 'ข้อมูลตัวละคร' : 'Character Profile'}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-[10px] text-slate-500">{lang === 'th' ? 'เลเวล' : 'Level'}</div>
                  <div className="font-bold text-amber-300 font-mono mt-0.5">Lv. {displayLevel || '-'}</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-[10px] text-slate-500">{lang === 'th' ? 'แคลน' : 'Clan'}</div>
                  <div className="font-bold text-white truncate mt-0.5">{user.clan || 'VoltZ'}</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-[10px] text-slate-500">{lang === 'th' ? 'การ์ดระดับตำนาน' : 'Legend Class'}</div>
                  <div className="font-bold text-purple-300 font-mono mt-0.5">{displayLegendClasses}</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-[10px] text-slate-500">{lang === 'th' ? 'อกาธีออนตำนาน' : 'Legend Agathion'}</div>
                  <div className="font-bold text-purple-300 font-mono mt-0.5">{displayLegendAgathions}</div>
                </div>
              </div>
            </div>

            {/* List of Stat Inputs */}
            {displayedStats.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                {lang === 'th' ? 'ไม่พบสเตตัสที่ตรงกับคำค้นหา' : 'No stats match the filter criteria'}
              </div>
            ) : (
              displayedStats.map((s) => {
                const val = effectiveStats[s.id] ?? 0;
                const prevVal = user.stats?.[s.id] ?? 0;
                const isChanged = isPendingNew && val !== prevVal;
                const enh = effectiveSpirits[s.id];

                return (
                  <div
                    key={s.id}
                    className={`p-3 rounded-xl border transition ${
                      isChanged
                        ? 'bg-amber-500/10 border-amber-500/50 shadow-md ring-1 ring-amber-500/30'
                        : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate" title={s.labelTh}>
                          {lang === 'th' ? s.labelTh : s.labelEn}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {lang === 'th' ? s.labelEn : s.labelTh}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-2 justify-end">
                          {isChanged && prevVal > 0 && (
                            <span className="text-[11px] text-slate-500 line-through font-mono">
                              {prevVal}
                            </span>
                          )}
                          <span className={`font-mono font-bold text-sm ${isChanged ? 'text-amber-300' : 'text-slate-100'}`}>
                            {val}
                            {s.inputType === 'percentage' && '%'}
                          </span>
                        </div>

                        {s.inputType === 'spirit_card' && enh !== undefined && (
                          <div
                            className="mt-0.5 inline-block px-1.5 py-0.2 rounded text-[10px] font-bold"
                            style={{
                              color: s.spiritConfig?.accentColor || '#3b82f6',
                              backgroundColor: `${s.spiritConfig?.accentColor || '#3b82f6'}22`
                            }}
                          >
                            {enh === 0 ? 'Tier 0' : `+${enh}`}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Sticky Action Footer */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/95 flex items-center justify-between gap-3 shrink-0">
            {canShowApprovalActions ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenReject(user.id);
                  }}
                  disabled={isProcessing}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition cursor-pointer"
                >
                  <XCircle className="size-4" />
                  <span>{lang === 'th' ? 'ปฏิเสธ (Reject)' : 'Reject'}</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await onApprove(user);
                    onClose();
                  }}
                  disabled={isProcessing}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:brightness-110 text-white text-xs font-bold shadow-xl shadow-emerald-600/30 transition cursor-pointer"
                >
                  <CheckCircle2 className="size-4" />
                  <span>{lang === 'th' ? 'อนุมัติสเตตัส' : 'Approve'}</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition cursor-pointer border border-slate-700 flex items-center justify-center gap-2"
              >
                <X className="size-4" />
                <span>{lang === 'th' ? 'ปิดหน้าต่างตรวจสอบ (Esc)' : 'Close Inspector (Esc)'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
