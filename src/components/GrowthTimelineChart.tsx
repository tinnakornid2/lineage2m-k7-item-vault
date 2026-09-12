import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Zap,
  Crown,
  Swords,
  Shield,
  ShieldAlert,
  Sparkles,
  Calendar,
  Plus,
  Trash2,
  CheckCircle2,
  Award,
  Flame,
  Settings,
  X,
  RotateCcw
} from 'lucide-react';
import { User, StatHistoryPoint } from '../types';
import {
  GROWTH_METRICS,
  GrowthMetric,
  GrowthTimeframe,
  getOrGenerateStatHistory,
  filterHistoryByTimeframe,
  calculateGrowthSummary,
  generateSmoothSvgPath
} from '../utils/growthTimelineHelper';
import { sounds } from '../utils/sound';

interface GrowthTimelineChartProps {
  user: User;
  lang: 'th' | 'en';
  onSaveHistory?: (newHistory: StatHistoryPoint[]) => Promise<void>;
  showToast?: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export const GrowthTimelineChart: React.FC<GrowthTimelineChartProps> = ({
  user,
  lang,
  onSaveHistory,
  showToast
}) => {
  const [selectedMetric, setSelectedMetric] = useState<GrowthMetric>('powerLevel');
  const [timeframe, setTimeframe] = useState<GrowthTimeframe>('all');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form State for Add Milestone Modal
  const [newDate, setNewDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [newPl, setNewPl] = useState<number>(user.powerLevel || 3000);
  const [newLevel, setNewLevel] = useState<number>(user.level || 75);
  const [newNote, setNewNote] = useState<string>('');

  // 1. Get raw history
  const fullHistory = useMemo(() => {
    return getOrGenerateStatHistory(user);
  }, [user]);

  // 2. Filter by timeframe
  const displayHistory = useMemo(() => {
    return filterHistoryByTimeframe(fullHistory, timeframe);
  }, [fullHistory, timeframe]);

  // 3. Current active metric metadata
  const metricMeta = useMemo(() => {
    return GROWTH_METRICS.find((m) => m.id === selectedMetric) || GROWTH_METRICS[0];
  }, [selectedMetric]);

  // 4. Calculate Summary KPIs
  const summary = useMemo(() => {
    return calculateGrowthSummary(displayHistory, selectedMetric);
  }, [displayHistory, selectedMetric]);

  // Helper to extract value from point
  const getMetricValue = (p: StatHistoryPoint): number => {
    switch (selectedMetric) {
      case 'powerLevel':
        return p.powerLevel || 0;
      case 'level':
        return p.level || 0;
      case 'damage':
        return p.damage || p.statsSnapshot?.['damage'] || 0;
      case 'accuracy':
        return p.accuracy || p.statsSnapshot?.['accuracy'] || 0;
      case 'defense':
        return p.defense || p.statsSnapshot?.['defense'] || 0;
      case 'damageReduction':
        return p.damageReduction || p.statsSnapshot?.['damage_reduction'] || 0;
      default:
        return p.powerLevel || 0;
    }
  };

  // 5. Mini Sparkline SVG Coordinate Calculations (Very Compact ~75px height)
  const chartWidth = 650;
  const chartHeight = 85;
  const padding = { top: 12, right: 20, bottom: 20, left: 40 };
  const graphWidth = chartWidth - padding.left - padding.right;
  const graphHeight = chartHeight - padding.top - padding.bottom;

  const { points, minVal, maxVal, yTicks } = useMemo(() => {
    if (displayHistory.length === 0) {
      return { points: [], minVal: 0, maxVal: 100, yTicks: [0, 100] };
    }

    const vals = displayHistory.map(getMetricValue);
    let rawMin = Math.min(...vals);
    let rawMax = Math.max(...vals);

    if (rawMin === rawMax) {
      rawMin = Math.max(0, rawMin - 50);
      rawMax = rawMax + 50;
    }

    const range = rawMax - rawMin;
    const computedMin = Math.max(0, Math.floor(rawMin - range * 0.08));
    const computedMax = Math.ceil(rawMax + range * 0.1);

    const pts = displayHistory.map((p, idx) => {
      const x = displayHistory.length === 1
        ? padding.left + graphWidth / 2
        : padding.left + (idx / (displayHistory.length - 1)) * graphWidth;
      const normY = (getMetricValue(p) - computedMin) / (computedMax - computedMin || 1);
      const y = padding.top + graphHeight - normY * graphHeight;
      return { x, y, point: p, val: getMetricValue(p), idx };
    });

    const ticks = [Math.round(computedMin), Math.round(computedMax)];

    return { points: pts, minVal: computedMin, maxVal: computedMax, yTicks: ticks };
  }, [displayHistory, selectedMetric]);

  // Smooth Bezier Curve Path
  const linePath = useMemo(() => {
    return generateSmoothSvgPath(points.map((p) => ({ x: p.x, y: p.y })));
  }, [points]);

  // Closed Area Path
  const areaPath = useMemo(() => {
    if (points.length < 2) return '';
    const first = points[0];
    const last = points[points.length - 1];
    const bottomY = padding.top + graphHeight;
    return `${linePath} L ${last.x},${bottomY} L ${first.x},${bottomY} Z`;
  }, [linePath, points]);

  // Handle Add Milestone
  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPl || newPl <= 0) return;

    setIsSubmitting(true);
    try {
      sounds.playClaim();
      const milestoneDate = new Date(newDate).getTime() || Date.now();
      const newPoint: StatHistoryPoint = {
        id: `milestone_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        date: milestoneDate,
        powerLevel: Number(newPl),
        level: Number(newLevel),
        classes: user.classes || (user.characterClass ? [user.characterClass] : []),
        damage: user.stats?.['damage'] || 0,
        accuracy: user.stats?.['accuracy'] || 0,
        defense: user.stats?.['defense'] || 0,
        damageReduction: user.stats?.['damage_reduction'] || 0,
        note: newNote.trim() || (lang === 'th' ? 'บันทึกพัฒนาการ' : 'Milestone Record'),
        type: 'milestone',
        verifiedBy: user.inGameName
      };

      const updatedHistory = [...fullHistory, newPoint].sort((a, b) => a.date - b.date);

      if (onSaveHistory) {
        await onSaveHistory(updatedHistory);
      }

      setIsAddModalOpen(false);
      setNewNote('');
      if (showToast) {
        showToast(
          lang === 'th' ? '✓ บันทึกหมุดการเติบโตสำเร็จแล้ว' : '✓ Milestone logged successfully',
          'success'
        );
      }
    } catch (err: any) {
      console.error(err);
      if (showToast) {
        showToast(lang === 'th' ? 'เกิดข้อผิดพลาดในการบันทึก' : 'Failed to save milestone', 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Any Milestone (User has full control to delete any entry)
  const handleDeleteMilestone = async (pointId: string) => {
    sounds.playClick();
    try {
      const updated = fullHistory.filter((p) => p.id !== pointId);
      if (onSaveHistory) {
        await onSaveHistory(updated);
      }
      if (showToast) {
        showToast(lang === 'th' ? 'ลบหมุดประวัติเรียบร้อย' : 'Milestone deleted', 'info');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Reset / Clear All History (Keep only the latest active point)
  const handleClearHistory = async () => {
    sounds.playClick();
    if (!window.confirm(lang === 'th' ? 'คุณต้องการล้างประวัติย้อนหลังทั้งหมดใช่หรือไม่?' : 'Clear all progression history?')) {
      return;
    }

    try {
      const latestPoint = fullHistory[fullHistory.length - 1] || {
        id: `current_${Date.now()}`,
        date: Date.now(),
        powerLevel: user.powerLevel || 3000,
        level: user.level || 75,
        note: lang === 'th' ? 'สถานะปัจจุบัน (รีเซ็ตประวัติ)' : 'Current Status (Reset History)',
        type: 'approval'
      };
      
      const resetHistory = [{
        ...latestPoint,
        id: `current_${Date.now()}`,
        date: Date.now(),
        note: lang === 'th' ? 'สถานะปัจจุบัน' : 'Current Status'
      }];

      if (onSaveHistory) {
        await onSaveHistory(resetHistory);
      }

      if (showToast) {
        showToast(lang === 'th' ? 'ล้างประวัติย้อนหลังเรียบร้อยแล้ว' : 'History cleared', 'info');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : points[points.length - 1];

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-900/90 via-[#0c1220]/90 to-slate-950/90 border border-amber-500/25 p-3.5 sm:p-4 shadow-lg backdrop-blur-sm space-y-2.5 relative overflow-hidden">
      {/* 1. TOP SLIM CONTROLS ROW */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className="size-7 rounded-lg flex items-center justify-center shadow-sm shrink-0"
            style={{
              backgroundColor: `${metricMeta.color}20`,
              border: `1px solid ${metricMeta.color}50`,
              color: metricMeta.color
            }}
          >
            <TrendingUp className="size-3.5" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold font-cinzel text-white">
              {lang === 'th' ? 'ไทม์ไลน์การเติบโต' : 'Growth Timeline'}
            </span>
            <span
              className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded"
              style={{
                backgroundColor: `${metricMeta.color}15`,
                color: metricMeta.color
              }}
            >
              {summary.totalDelta >= 0 ? '+' : ''}
              {summary.totalDelta.toLocaleString()} {metricMeta.unit} ({summary.totalDelta >= 0 ? '▲' : '▼'}{Math.abs(summary.totalPercent).toFixed(1)}%)
            </span>
          </div>
        </div>

        {/* Action Buttons: Add Milestone + Manage Log */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* Timeframe pill */}
          <div className="flex items-center p-0.5 rounded-md bg-slate-950 border border-slate-800 text-[10px] font-semibold">
            {(['30d', 'all'] as GrowthTimeframe[]).map((tf) => {
              const label = tf === '30d' ? '30D' : 'ALL';
              const isActive = timeframe === tf;
              return (
                <button
                  key={tf}
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setTimeframe(tf);
                  }}
                  className={`px-1.5 py-0.5 rounded transition font-bold ${
                    isActive ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] transition shrink-0"
            title={lang === 'th' ? 'เพิ่มหมุดการเติบโต' : 'Add Milestone'}
          >
            <Plus className="size-3 stroke-[3]" />
            <span>{lang === 'th' ? 'เพิ่มหมุด' : 'Log'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              setIsManageModalOpen(true);
            }}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-[10px] border border-slate-700 transition shrink-0"
            title={lang === 'th' ? 'จัดการและลบประวัติหมุด' : 'Manage & Delete Log'}
          >
            <Settings className="size-3" />
            <span>{lang === 'th' ? `จัดการ (${fullHistory.length})` : `Log (${fullHistory.length})`}</span>
          </button>
        </div>
      </div>

      {/* 2. MINI METRIC CHIPS ROW */}
      <div className="flex items-center justify-between gap-1 overflow-x-auto pb-0.5 custom-scrollbar">
        <div className="flex items-center gap-1">
          {GROWTH_METRICS.slice(0, 4).map((metric) => {
            const isActive = selectedMetric === metric.id;
            return (
              <button
                key={metric.id}
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setSelectedMetric(metric.id);
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition shrink-0 border ${
                  isActive
                    ? 'border-transparent text-slate-950'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                style={{
                  backgroundColor: isActive ? metric.color : undefined
                }}
              >
                {metric.labelTh.split(' ')[0]}
              </button>
            );
          })}
        </div>

        {/* Hover / Current Point Info Strip */}
        {activePoint && (
          <div className="text-[10px] font-mono text-slate-300 flex items-center gap-2 truncate shrink-0">
            <span className="text-slate-500">
              {new Date(activePoint.point.date).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', {
                day: 'numeric',
                month: 'short'
              })}
            </span>
            <span className="font-bold text-amber-400">⚡ {activePoint.point.powerLevel.toLocaleString()} PL</span>
          </div>
        )}
      </div>

      {/* 3. MINI SPARKLINE SVG GRAPH (~70px Height) */}
      <div className="relative rounded-xl bg-zinc-900/90 dark:bg-zinc-950/90 border border-zinc-800 p-2 overflow-hidden">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-16 sm:h-20 select-none overflow-visible"
        >
          <defs>
            <linearGradient id={`mini-${metricMeta.gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={metricMeta.color} stopOpacity="0.30" />
              <stop offset="90%" stopColor={metricMeta.color} stopOpacity="0.02" />
              <stop offset="100%" stopColor={metricMeta.color} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid Line */}
          {yTicks.map((val, idx) => {
            const normY = (val - minVal) / (maxVal - minVal || 1);
            const y = padding.top + graphHeight - normY * graphHeight;
            return (
              <line
                key={`yt-${idx}`}
                x1={padding.left}
                y1={y}
                x2={padding.left + graphWidth}
                y2={y}
                stroke="#27272a"
                strokeWidth="0.8"
                strokeDasharray="2 2"
              />
            );
          })}

          {/* Area & Line */}
          {areaPath && <path d={areaPath} fill={`url(#mini-${metricMeta.gradientId})`} />}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={metricMeta.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Vertical Guide */}
          {hoveredIdx !== null && points[hoveredIdx] && (
            <line
              x1={points[hoveredIdx].x}
              y1={padding.top}
              x2={points[hoveredIdx].x}
              y2={padding.top + graphHeight}
              stroke="#cbd5e1"
              strokeWidth="0.8"
              strokeDasharray="2 2"
              opacity="0.5"
            />
          )}

          {/* Dots */}
          {points.map((pt, idx) => {
            const isHovered = hoveredIdx === idx;
            const isLast = idx === points.length - 1;
            return (
              <g
                key={`dot-m-${idx}`}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <circle cx={pt.x} cy={pt.y} r="14" fill="transparent" />
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? '4.5' : isLast ? '3.5' : '2.5'}
                  fill="#18181b"
                  stroke={metricMeta.color}
                  strokeWidth={isHovered ? '2' : '1.5'}
                />
                <text
                  x={pt.x}
                  y={padding.top + graphHeight + 12}
                  textAnchor="middle"
                  fill={isHovered ? '#f4f4f5' : '#71717a'}
                  fontSize="7.5"
                  fontWeight={isHovered ? 'bold' : 'normal'}
                >
                  {new Date(pt.point.date).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', {
                    day: 'numeric',
                    month: 'short'
                  })}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* 4. INLINE UPDATES LOG TABLE (Kain7 Style with direct delete buttons) */}
      <div className="rounded-xl border border-zinc-700/80 dark:border-zinc-800 overflow-hidden">
        <div className="max-h-44 overflow-y-auto custom-scrollbar">
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-zinc-800 text-zinc-300 font-semibold border-b border-zinc-700 z-10">
              <tr>
                <th className="px-2.5 py-1.5">{lang === 'th' ? 'วันที่' : 'Date'}</th>
                <th className="px-2.5 py-1.5 text-right">{lang === 'th' ? 'พลังรบ' : 'Power'}</th>
                <th className="px-2 py-1.5 text-center">{lang === 'th' ? 'สถานะ' : 'Status'}</th>
                <th className="px-2 py-1.5 text-center w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 bg-zinc-900/60">
              {fullHistory.slice().reverse().map((point, index) => {
                const isLatest = index === 0;
                return (
                  <tr key={point.id} className="hover:bg-zinc-800/50 transition">
                    <td className="px-2.5 py-1.5 text-zinc-200">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">
                          {new Date(point.date).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', {
                            day: 'numeric',
                            month: 'short',
                            year: '2-digit'
                          })}
                        </span>
                        {isLatest && (
                          <span className="px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-400 font-bold text-[9px] border border-blue-500/30">
                            Latest
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2.5 py-1.5 text-right font-mono font-bold text-zinc-100">
                      ⚡ {point.powerLevel.toLocaleString()}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                        point.type === 'approval'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      }`}>
                        {point.type === 'approval' ? (lang === 'th' ? 'ยืนยัน' : 'Verified') : (lang === 'th' ? 'หมุด' : 'Log')}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteMilestone(point.id)}
                        className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                        title={lang === 'th' ? 'ลบหมุดนี้' : 'Delete'}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          MODAL 1: MANAGE & DELETE LOG MODAL (แก้ปัญหา log เพิ่มได้แต่ลบไม่ได้)
         ══════════════════════════════════════════════════════════ */}
      {isManageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-750 shadow-2xl p-5 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Settings className="size-3.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white font-cinzel">
                    {lang === 'th' ? 'จัดการและลบหมุดประวัติ' : 'Manage & Delete Log'}
                  </h3>
                  <div className="text-[10px] text-slate-400">
                    {lang === 'th' ? `มีประวัติทั้งหมด ${fullHistory.length} รายการ (ลบรายการที่ไม่ต้องการได้)` : `Total ${fullHistory.length} entries`}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsManageModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* List of points with individual delete buttons */}
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
              {fullHistory
                .slice()
                .reverse()
                .map((point) => (
                  <div
                    key={point.id}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2.5 text-xs hover:border-slate-700 transition"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate text-xs flex items-center gap-1.5">
                        <span>{point.note || 'Milestone Point'}</span>
                        {point.type === 'approval' && (
                          <span className="text-[8px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                            VERIFIED
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {new Date(point.date).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US', {
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })} • Lv.{point.level || 75}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-bold text-amber-400 text-xs">
                        ⚡ {point.powerLevel.toLocaleString()} PL
                      </span>
                      {/* Delete button (Always available for every point!) */}
                      <button
                        type="button"
                        onClick={() => handleDeleteMilestone(point.id)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition active:scale-95"
                        title={lang === 'th' ? 'ลบหมุดนี้' : 'Delete'}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            {/* Bottom Actions: Clear All History */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleClearHistory}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 text-[11px] font-semibold transition"
              >
                <RotateCcw className="size-3" />
                <span>{lang === 'th' ? 'ล้างประวัติย้อนหลังทั้งหมด' : 'Clear All History'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsManageModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700 transition"
              >
                {lang === 'th' ? 'เสร็จสิ้น' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          MODAL 2: ADD MILESTONE MODAL
         ══════════════════════════════════════════════════════════ */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-amber-500/40 shadow-2xl p-5 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Plus className="size-3.5 stroke-[3]" />
                </div>
                <h3 className="text-sm font-bold text-white font-cinzel">
                  {lang === 'th' ? 'เพิ่มหมุดการเติบโต' : 'Log Milestone'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleAddMilestone} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  {lang === 'th' ? 'วันที่' : 'Date'}
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    {lang === 'th' ? 'ค่าพลัง (PL)' : 'Power Level'}
                  </label>
                  <input
                    type="number"
                    value={newPl}
                    onChange={(e) => setNewPl(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-amber-400 font-mono font-bold outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    {lang === 'th' ? 'เลเวล (Lv)' : 'Level'}
                  </label>
                  <input
                    type="number"
                    value={newLevel}
                    onChange={(e) => setNewLevel(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  {lang === 'th' ? 'บันทึกเหตุการณ์' : 'Note'}
                </label>
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white outline-none focus:border-amber-500"
                  placeholder={lang === 'th' ? 'เช่น ตีบวกดาบ +9, อัปผลึก 5' : 'e.g. +9 Enchant'}
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
                >
                  {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? (lang === 'th' ? 'กำลังบันทึก...' : 'Saving...') : (lang === 'th' ? 'บันทึก' : 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
