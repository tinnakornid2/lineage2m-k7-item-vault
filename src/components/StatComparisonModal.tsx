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
  Clock
} from 'lucide-react';
import { User, OFFICIAL_CLASSES } from '../types';
import { sounds } from '../utils/sound';
import { getFormulaSettings } from '../services/powerFormulaService';

interface StatComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  lang: 'th' | 'en';
  onApprove: (user: User) => Promise<void>;
  onOpenReject: (userId: string) => void;
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
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const positionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const formulaConfig = getFormulaSettings();
  const classMap = new Map(OFFICIAL_CLASSES.map((c) => [c.nameEn.toLowerCase(), c]));

  // Reset zoom & pan on open or when user changes
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      positionRef.current = { x: 0, y: 0 };
      setFilterChangedOnly(false);
    }
  }, [isOpen, user?.id]);

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
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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

  const displayScreenshot = user.pendingStatScreenshotUrl || user.statScreenshotUrl;
  const isPendingNew = !!user.pendingStatScreenshotUrl;
  const prevPL = user.powerLevel || 0;
  const nextPL = user.pendingPowerLevel || 0;
  const diffPL = nextPL - prevPL;
  const pendingStats = user.pendingStats || {};
  const pendingSpirits = user.pendingSpiritEnhancements || {};

  const displayClasses = user.pendingClasses !== undefined && user.pendingClasses !== null
    ? user.pendingClasses
    : (user.classes || (user.characterClass ? [user.characterClass] : []));
  const displayLevel = user.pendingLevel !== undefined && user.pendingLevel !== null
    ? user.pendingLevel
    : (user.level || 0);
  const displayLegendClasses = user.pendingLegendClasses !== undefined && user.pendingLegendClasses !== null
    ? user.pendingLegendClasses
    : (user.legendClasses || 0);
  const displayLegendAgathions = user.pendingLegendAgathions !== undefined && user.pendingLegendAgathions !== null
    ? user.pendingLegendAgathions
    : (user.legendAgathions || 0);

  // Filter stats
  const statList = formulaConfig.stats.filter(
    (s) => s.isActive && (pendingStats[s.id] !== undefined || s.inputType === 'spirit_card')
  );

  const displayedStats = filterChangedOnly
    ? statList.filter((s) => (pendingStats[s.id] ?? 0) !== (user.stats?.[s.id] ?? 0))
    : statList;

  const totalChangedCount = statList.filter(
    (s) => (pendingStats[s.id] ?? 0) !== (user.stats?.[s.id] ?? 0)
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-xl animate-fade-in text-slate-100 overflow-hidden select-none">
      {/* ── TOP NAV / HEADER BAR ────────────────────────────────────── */}
      <div className="h-16 px-4 sm:px-6 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-4 shrink-0 shadow-lg z-20">
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
                {lang === 'th' ? '🔍 โหมดตรวจสอบเปรียบเทียบรูปภาพกับสเตตัส' : '🔍 Side-by-Side Proof Comparison'}
              </span>
              <span>•</span>
              <span className="text-slate-400">
                {isPendingNew ? (
                  <span className="text-amber-400">✨ {lang === 'th' ? 'รูปใหม่ที่แนบมา' : 'New Proof Attached'}</span>
                ) : (
                  <span className="text-emerald-400">📸 {lang === 'th' ? 'รูปหลักฐานเดิม' : 'Previous Proof'}</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Power Level Comparison Badge & Close Button */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2.5 px-3 py-1 rounded-xl bg-slate-950 border border-slate-750">
            <span className="text-xs text-slate-400 font-mono">{prevPL.toLocaleString()} PL</span>
            <ArrowRight className="size-3.5 text-slate-500" />
            <span className="text-sm font-black text-amber-400 font-mono">⚡ {nextPL.toLocaleString()} PL</span>
            {diffPL > 0 && (
              <span className="text-xs font-bold text-emerald-400 font-mono bg-emerald-500/15 px-1.5 py-0.2 rounded border border-emerald-500/30">
                (+{diffPL.toLocaleString()})
              </span>
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
            {displayScreenshot ? (
              <div
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                  transformOrigin: 'center center',
                  transition: isDragging ? 'none' : 'transform 0.12s ease-out'
                }}
                className="max-w-full max-h-full flex items-center justify-center p-4 pointer-events-none"
              >
                <img
                  src={displayScreenshot}
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
                    ? 'สมาชิกส่งคำขออัปเดตสเตตัสมาโดยไม่ได้แนบภาพหน้าจอ'
                    : 'This update request was submitted without screenshot proof.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ═══ RIGHT PANEL: SUBMITTED STATS COMPARISON (30% - 35%) ════ */}
        <div className="w-full lg:w-[420px] xl:w-[460px] bg-slate-900 flex flex-col shrink-0 h-full overflow-hidden shadow-2xl">
          {/* Panel Header & Filter Controls */}
          <div className="p-4 border-b border-slate-800 space-y-3 bg-slate-900/90">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="size-4 text-amber-400" />
                <span>{lang === 'th' ? 'สเตตัสที่ขออัปเดต' : 'Submitted Stats'}</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {statList.length} {lang === 'th' ? 'รายการ' : 'fields'}
              </span>
            </div>

            {/* Filter Toggle: All vs Changed Only */}
            <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setFilterChangedOnly(false);
                }}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition cursor-pointer text-center ${
                  !filterChangedOnly
                    ? 'bg-slate-800 text-amber-300 font-bold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {lang === 'th' ? 'ทั้งหมด' : 'All'} ({statList.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setFilterChangedOnly(true);
                }}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                  filterChangedOnly
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'text-amber-400 hover:text-amber-300'
                }`}
              >
                <Sparkles className="size-3" />
                <span>{lang === 'th' ? 'เฉพาะที่เปลี่ยน' : 'Changed'}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-mono font-bold">
                  {totalChangedCount}
                </span>
              </button>
            </div>
          </div>

          {/* Stats List (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
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
            {displayedStats.map((s) => {
              const val = pendingStats[s.id] ?? 0;
              const prevVal = user.stats?.[s.id] ?? 0;
              const isChanged = val !== prevVal;
              const enh = pendingSpirits[s.id];

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
            })}
          </div>

          {/* Bottom Sticky Action Footer */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between gap-3 shrink-0">
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
          </div>
        </div>
      </div>
    </div>
  );
};
