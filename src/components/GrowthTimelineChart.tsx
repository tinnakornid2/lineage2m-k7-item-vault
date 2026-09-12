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
  ChevronDown,
  ChevronUp,
  Flame,
  X
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
  isCompact?: boolean;
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
  const [showMilestonesList, setShowMilestonesList] = useState<boolean>(false); // Collapsed by default to save vertical space
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
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

  // 5. Compact SVG Coordinate Calculations (Single-Screen Friendly)
  const chartWidth = 700;
  const chartHeight = 145;
  const padding = { top: 18, right: 25, bottom: 28, left: 45 };
  const graphWidth = chartWidth - padding.left - padding.right;
  const graphHeight = chartHeight - padding.top - padding.bottom;

  const { points, minVal, maxVal, yTicks } = useMemo(() => {
    if (displayHistory.length === 0) {
      return { points: [], minVal: 0, maxVal: 100, yTicks: [0, 50, 100] };
    }

    const vals = displayHistory.map(getMetricValue);
    let rawMin = Math.min(...vals);
    let rawMax = Math.max(...vals);

    if (rawMin === rawMax) {
      rawMin = Math.max(0, rawMin - 50);
      rawMax = rawMax + 50;
    }

    const range = rawMax - rawMin;
    const computedMin = Math.max(0, Math.floor(rawMin - range * 0.1));
    const computedMax = Math.ceil(rawMax + range * 0.12);

    const pts = displayHistory.map((p, idx) => {
      const x = displayHistory.length === 1
        ? padding.left + graphWidth / 2
        : padding.left + (idx / (displayHistory.length - 1)) * graphWidth;
      const normY = (getMetricValue(p) - computedMin) / (computedMax - computedMin || 1);
      const y = padding.top + graphHeight - normY * graphHeight;
      return { x, y, point: p, val: getMetricValue(p), idx };
    });

    const step = (computedMax - computedMin) / 2;
    const ticks = [
      Math.round(computedMin),
      Math.round(computedMin + step),
      Math.round(computedMax)
    ];

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
        id: `manual_milestone_${Date.now()}`,
        date: milestoneDate,
        powerLevel: Number(newPl),
        level: Number(newLevel),
        classes: user.classes || (user.characterClass ? [user.characterClass] : []),
        damage: user.stats?.['damage'] || 0,
        accuracy: user.stats?.['accuracy'] || 0,
        defense: user.stats?.['defense'] || 0,
        damageReduction: user.stats?.['damage_reduction'] || 0,
        note: newNote.trim() || (lang === 'th' ? 'บันทึกพัฒนาการตัวละคร' : 'Progression Milestone'),
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

  // Handle Delete Milestone
  const handleDeleteMilestone = async (pointId: string) => {
    sounds.playClick();
    if (fullHistory.length <= 2) {
      if (showToast) {
        showToast(
          lang === 'th' ? 'ต้องคงไว้อย่างน้อย 2 จุดเพื่อวาดกราฟ' : 'Need at least 2 points for the curve',
          'warning'
        );
      }
      return;
    }

    try {
      const updated = fullHistory.filter((p) => p.id !== pointId);
      if (onSaveHistory) {
        await onSaveHistory(updated);
      }
      if (showToast) {
        showToast(lang === 'th' ? 'ลบหมุดเรียบร้อย' : 'Milestone removed', 'info');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : points[points.length - 1];

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-900/95 via-[#0c1220]/95 to-slate-950/95 border border-amber-500/30 p-4 sm:p-5 shadow-xl backdrop-blur-md space-y-3.5 relative overflow-hidden">
      {/* Subtle Background Glow */}
      <div
        className="absolute -top-16 -right-16 w-60 h-60 rounded-full blur-3xl pointer-events-none opacity-15"
        style={{ backgroundColor: metricMeta.color }}
      />

      {/* 1. COMPACT HEADER WITH TIMEFRAME & LOG MILESTONE ACTION */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2.5">
          <div
            className="size-8 rounded-lg flex items-center justify-center shadow-md shrink-0"
            style={{
              backgroundColor: `${metricMeta.color}20`,
              border: `1px solid ${metricMeta.color}50`,
              color: metricMeta.color
            }}
          >
            <TrendingUp className="size-4 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold font-cinzel text-white tracking-wide flex items-center gap-1.5">
              <span>{lang === 'th' ? 'ไทม์ไลน์การเติบโต' : 'Growth Timeline'}</span>
              <Sparkles className="size-3.5 text-amber-400" />
            </h2>
            <div className="text-[10px] text-slate-400">
              {lang === 'th'
                ? `แนวโน้ม ${metricMeta.labelTh} ย้อนหลัง (${displayHistory.length} จุด)`
                : `${metricMeta.labelEn} trend (${displayHistory.length} points)`}
            </div>
          </div>
        </div>

        {/* Timeframe selector + Add Milestone Trigger */}
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="flex items-center p-0.5 rounded-lg bg-slate-850 border border-slate-750 text-[10px] font-semibold">
            {(['30d', '90d', '180d', 'all'] as GrowthTimeframe[]).map((tf) => {
              const label = tf === '30d' ? '30D' : tf === '90d' ? '90D' : tf === '180d' ? '6M' : 'ALL';
              const isActive = timeframe === tf;
              return (
                <button
                  key={tf}
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setTimeframe(tf);
                  }}
                  className={`px-2 py-0.5 rounded-md transition font-bold ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
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
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold text-[11px] shadow-sm transition active:scale-95 shrink-0"
          >
            <Plus className="size-3 stroke-[3]" />
            <span>{lang === 'th' ? 'เพิ่มหมุด' : 'Log'}</span>
          </button>
        </div>
      </div>

      {/* 2. METRIC CHIPS ROW */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 custom-scrollbar">
        {GROWTH_METRICS.map((metric) => {
          const isActive = selectedMetric === metric.id;
          return (
            <button
              key={metric.id}
              type="button"
              onClick={() => {
                sounds.playClick();
                setSelectedMetric(metric.id);
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition shrink-0 border ${
                isActive
                  ? 'border-transparent text-slate-950 shadow-sm'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              style={{
                backgroundColor: isActive ? metric.color : undefined
              }}
            >
              {metric.id === 'powerLevel' && <Zap className="size-3" />}
              {metric.id === 'level' && <Crown className="size-3" />}
              {metric.id === 'damage' && <Swords className="size-3" />}
              {metric.id === 'accuracy' && <Sparkles className="size-3" />}
              {metric.id === 'defense' && <Shield className="size-3" />}
              {metric.id === 'damageReduction' && <ShieldAlert className="size-3" />}
              <span>{lang === 'th' ? metric.labelTh : metric.labelEn}</span>
            </button>
          );
        })}
      </div>

      {/* 3. COMPACT 4-KPI HORIZONTAL STRIP (SAVES SPACE) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950/60 border border-slate-800/80 p-2.5 rounded-xl text-xs">
        {/* Total Growth */}
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <Flame className="size-3" />
          </div>
          <div className="min-w-0">
            <div className="text-[9px] uppercase font-bold text-slate-400 truncate">
              {lang === 'th' ? 'การเติบโต' : 'Total Growth'}
            </div>
            <div className="font-mono font-bold text-emerald-400 truncate text-[11px] sm:text-xs">
              {summary.totalDelta >= 0 ? '+' : ''}
              {summary.totalDelta.toLocaleString()} {metricMeta.unit} ({summary.totalDelta >= 0 ? '▲' : '▼'}{Math.abs(summary.totalPercent).toFixed(1)}%)
            </div>
          </div>
        </div>

        {/* Peak Record */}
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-md bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
            <Award className="size-3" />
          </div>
          <div className="min-w-0">
            <div className="text-[9px] uppercase font-bold text-slate-400 truncate">
              {lang === 'th' ? 'สถิติสูงสุด' : 'Peak'}
            </div>
            <div className="font-mono font-bold text-amber-400 truncate text-[11px] sm:text-xs">
              {summary.peakValue.toLocaleString()} {metricMeta.unit}
            </div>
          </div>
        </div>

        {/* Recent Delta */}
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-md bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0">
            <TrendingUp className="size-3" />
          </div>
          <div className="min-w-0">
            <div className="text-[9px] uppercase font-bold text-slate-400 truncate">
              {lang === 'th' ? 'ล่าสุด' : 'Recent'}
            </div>
            <div className="font-mono font-bold text-sky-400 truncate text-[11px] sm:text-xs">
              {summary.recentDelta >= 0 ? '+' : ''}
              {summary.recentDelta.toLocaleString()} {metricMeta.unit}
            </div>
          </div>
        </div>

        {/* Next Tier Progress */}
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-md bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
            <Crown className="size-3" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between text-[9px] uppercase font-bold text-slate-400">
              <span className="truncate">{lang === 'th' ? 'เป้าหมาย' : 'Target'}</span>
              <span className="text-amber-400 font-mono">{summary.milestoneProgressPct.toFixed(0)}%</span>
            </div>
            <div className="w-full h-1 rounded-full bg-slate-800 overflow-hidden mt-0.5">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${summary.milestoneProgressPct}%`,
                  backgroundColor: metricMeta.color
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. COMPACT SVG GRAPH (HEIGHT 145px) */}
      <div className="relative rounded-xl bg-slate-950/80 border border-slate-800/80 p-2.5 overflow-hidden">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-32 sm:h-36 select-none overflow-visible"
        >
          <defs>
            <linearGradient id={`compact-${metricMeta.gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={metricMeta.color} stopOpacity="0.30" />
              <stop offset="85%" stopColor={metricMeta.color} stopOpacity="0.03" />
              <stop offset="100%" stopColor={metricMeta.color} stopOpacity="0.0" />
            </linearGradient>

            <filter id="neon-glow-compact" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid Lines */}
          {yTicks.map((val, idx) => {
            const normY = (val - minVal) / (maxVal - minVal || 1);
            const y = padding.top + graphHeight - normY * graphHeight;
            return (
              <g key={`ytick-comp-${idx}`}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={padding.left + graphWidth}
                  y2={y}
                  stroke="#1e293b"
                  strokeWidth="0.75"
                  strokeDasharray="3 3"
                />
                <text
                  x={padding.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="8.5"
                  fontFamily="monospace"
                >
                  {val.toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* Area & Line */}
          {areaPath && <path d={areaPath} fill={`url(#compact-${metricMeta.gradientId})`} />}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={metricMeta.color}
              strokeWidth="2.2"
              filter="url(#neon-glow-compact)"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Vertical Hover Line */}
          {hoveredIdx !== null && points[hoveredIdx] && (
            <line
              x1={points[hoveredIdx].x}
              y1={padding.top}
              x2={points[hoveredIdx].x}
              y2={padding.top + graphHeight}
              stroke="#cbd5e1"
              strokeWidth="1"
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
                key={`dot-comp-${idx}`}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <circle cx={pt.x} cy={pt.y} r="16" fill="transparent" />
                {(isHovered || (hoveredIdx === null && isLast)) && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="7"
                    fill={metricMeta.color}
                    opacity="0.25"
                    className="animate-ping"
                  />
                )}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? '5' : isLast ? '4.5' : '3.5'}
                  fill="#0f172a"
                  stroke={metricMeta.color}
                  strokeWidth={isHovered ? '2.5' : '1.8'}
                />
                <text
                  x={pt.x}
                  y={padding.top + graphHeight + 14}
                  textAnchor="middle"
                  fill={isHovered ? '#f1f5f9' : '#64748b'}
                  fontSize="8"
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

        {/* Mini Active Point Info Strip (Replaces bulky box) */}
        {activePoint && (
          <div className="mt-1 px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2 truncate">
              <span className="font-bold text-white truncate">
                #{activePoint.idx + 1} {activePoint.point.note || 'Milestone'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {new Date(activePoint.point.date).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', {
                  day: 'numeric',
                  month: 'short'
                })}
              </span>
            </div>
            <div className="flex items-center gap-2.5 font-mono font-bold shrink-0">
              <span className="text-amber-400">⚡ {activePoint.point.powerLevel.toLocaleString()} PL</span>
              <span className="text-purple-400">Lv.{activePoint.point.level || 75}</span>
            </div>
          </div>
        )}
      </div>

      {/* 5. COLLAPSIBLE MILESTONES FEED (Closed by default to preserve single-page layout) */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => {
            sounds.playClick();
            setShowMilestonesList(!showMilestonesList);
          }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 transition"
        >
          <span className="flex items-center gap-1.5">
            <Calendar className="size-3.5 text-amber-400" />
            <span>{lang === 'th' ? 'ประวัติหมุดการเติบโตทั้งหมด' : 'Milestones History'}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400">
              {fullHistory.length}
            </span>
          </span>
          {showMilestonesList ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>

        {showMilestonesList && (
          <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
            {fullHistory
              .slice()
              .reverse()
              .map((point) => {
                const isManual = point.type === 'milestone';
                return (
                  <div
                    key={point.id}
                    className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="size-6 rounded bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                        {point.type === 'approval' ? (
                          <CheckCircle2 className="size-3 text-emerald-400" />
                        ) : (
                          <Zap className="size-3" />
                        )}
                      </div>
                      <div className="truncate">
                        <div className="font-semibold text-white truncate text-[11px]">{point.note}</div>
                        <div className="text-[9px] text-slate-400">
                          {new Date(point.date).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', {
                            day: 'numeric',
                            month: 'short'
                          })} • Lv.{point.level || 75}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-bold text-amber-400 text-xs">
                        ⚡ {point.powerLevel.toLocaleString()} PL
                      </span>
                      {isManual && (
                        <button
                          type="button"
                          onClick={() => handleDeleteMilestone(point.id)}
                          className="p-1 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 rounded transition"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* 6. ADD MILESTONE MODAL */}
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
