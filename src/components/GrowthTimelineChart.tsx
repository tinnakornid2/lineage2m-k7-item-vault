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
  ChevronRight,
  Flame,
  Info,
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
  const [showMilestonesList, setShowMilestonesList] = useState<boolean>(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form State for Add Milestone Modal
  const [newDate, setNewDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [newPl, setNewPl] = useState<number>(user.powerLevel || 3000);
  const [newLevel, setNewLevel] = useState<number>(user.level || 75);
  const [newNote, setNewNote] = useState<string>('');

  // 1. Get raw history (either from Firestore or synthesized progressive baseline)
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

  // Helper to extract value from point for the active metric
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

  // 5. SVG Coordinate Calculations
  const chartWidth = 780;
  const chartHeight = 220;
  const padding = { top: 25, right: 35, bottom: 40, left: 55 };
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
      rawMin = Math.max(0, rawMin - 100);
      rawMax = rawMax + 100;
    }

    // Add 10% breathing room top and bottom
    const range = rawMax - rawMin;
    const computedMin = Math.max(0, Math.floor(rawMin - range * 0.1));
    const computedMax = Math.ceil(rawMax + range * 0.12);

    // Compute coordinate points
    const pts = displayHistory.map((p, idx) => {
      const x = displayHistory.length === 1
        ? padding.left + graphWidth / 2
        : padding.left + (idx / (displayHistory.length - 1)) * graphWidth;
      const normY = (getMetricValue(p) - computedMin) / (computedMax - computedMin || 1);
      const y = padding.top + graphHeight - normY * graphHeight;
      return { x, y, point: p, val: getMetricValue(p), idx };
    });

    // Generate 4 nicely distributed horizontal grid steps
    const step = (computedMax - computedMin) / 3;
    const ticks = [
      Math.round(computedMin),
      Math.round(computedMin + step),
      Math.round(computedMin + step * 2),
      Math.round(computedMax)
    ];

    return { points: pts, minVal: computedMin, maxVal: computedMax, yTicks: ticks };
  }, [displayHistory, selectedMetric]);

  // Smooth Bezier Curve Path
  const linePath = useMemo(() => {
    return generateSmoothSvgPath(points.map((p) => ({ x: p.x, y: p.y })));
  }, [points]);

  // Closed Area Path for Under-curve Gradient
  const areaPath = useMemo(() => {
    if (points.length < 2) return '';
    const first = points[0];
    const last = points[points.length - 1];
    const bottomY = padding.top + graphHeight;
    return `${linePath} L ${last.x},${bottomY} L ${first.x},${bottomY} Z`;
  }, [linePath, points]);

  // Handle Add Custom Milestone
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
    <div className="rounded-2xl bg-gradient-to-br from-slate-900/95 via-[#0c1220]/95 to-slate-950/95 border border-amber-500/30 p-5 sm:p-6 shadow-2xl backdrop-blur-md space-y-6 relative overflow-hidden">
      {/* Background Ambience Glow */}
      <div
        className="absolute -top-24 -right-24 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-20"
        style={{ backgroundColor: metricMeta.color }}
      />

      {/* 1. TOP HEADER & TIMEFRAME CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div
            className="size-11 rounded-xl flex items-center justify-center shadow-lg transition-transform"
            style={{
              backgroundColor: `${metricMeta.color}20`,
              border: `1px solid ${metricMeta.color}50`,
              color: metricMeta.color
            }}
          >
            <TrendingUp className="size-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black font-cinzel text-white tracking-wide flex items-center gap-2">
                <span>{lang === 'th' ? 'ไทม์ไลน์การเติบโตและพัฒนาการ' : 'Growth & Timeline Progression'}</span>
                <Sparkles className="size-4 text-amber-400" />
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                {displayHistory.length} {lang === 'th' ? 'หมุดประวัติ' : 'Milestones'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {lang === 'th'
                ? `ติดตามการเติบโตของ ${metricMeta.labelTh} และระดับพลังของตัวละครตามกาลเวลา`
                : `Track character ${metricMeta.labelEn} progression over time with verified milestones.`}
            </p>
          </div>
        </div>

        {/* Right Actions: Timeframe Pills & Add Milestone Button */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Timeframe selector */}
          <div className="flex items-center p-1 rounded-xl bg-slate-850/90 border border-slate-750 text-xs font-semibold">
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
                  className={`px-2.5 py-1 rounded-lg transition text-[11px] font-bold ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Add Milestone Trigger */}
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all active:scale-95"
          >
            <Plus className="size-3.5 stroke-[3]" />
            <span>{lang === 'th' ? 'บันทึกหมุดเติบโต' : 'Log Milestone'}</span>
          </button>
        </div>
      </div>

      {/* 2. METRIC SELECTOR PILLS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                isActive
                  ? 'border-transparent shadow-lg text-slate-950'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
              style={{
                backgroundColor: isActive ? metric.color : undefined,
                boxShadow: isActive ? `0 4px 14px ${metric.color}40` : undefined
              }}
            >
              {metric.id === 'powerLevel' && <Zap className="size-3.5" />}
              {metric.id === 'level' && <Crown className="size-3.5" />}
              {metric.id === 'damage' && <Swords className="size-3.5" />}
              {metric.id === 'accuracy' && <Sparkles className="size-3.5" />}
              {metric.id === 'defense' && <Shield className="size-3.5" />}
              {metric.id === 'damageReduction' && <ShieldAlert className="size-3.5" />}
              <span>{lang === 'th' ? metric.labelTh : metric.labelEn}</span>
            </button>
          );
        })}
      </div>

      {/* 3. GROWTH STATS & KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Growth */}
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>{lang === 'th' ? 'การเติบโตสะสม' : 'Total Growth'}</span>
            <Flame className="size-3.5 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-base sm:text-lg font-black font-mono ${
                summary.totalDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {summary.totalDelta >= 0 ? '+' : ''}
              {summary.totalDelta.toLocaleString()} {metricMeta.unit}
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                summary.totalDelta >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
              }`}
            >
              {summary.totalDelta >= 0 ? '▲' : '▼'} {Math.abs(summary.totalPercent).toFixed(1)}%
            </span>
          </div>
          <div className="text-[10px] text-slate-500">
            {lang === 'th' ? 'เทียบจากจุดเริ่มต้น' : 'From initial record'}
          </div>
        </div>

        {/* Peak Record */}
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>{lang === 'th' ? 'สถิติสูงสุด' : 'Peak Record'}</span>
            <Award className="size-3.5 text-amber-400" />
          </div>
          <div className="text-base sm:text-lg font-black text-amber-400 font-mono">
            {summary.peakValue.toLocaleString()} {metricMeta.unit}
          </div>
          <div className="text-[10px] text-slate-500">
            {new Date(summary.peakDate).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', {
              month: 'short',
              day: 'numeric'
            })}
          </div>
        </div>

        {/* Recent Growth */}
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>{lang === 'th' ? 'การเติบโตล่าสุด' : 'Recent Growth'}</span>
            <TrendingUp className="size-3.5 text-sky-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-base sm:text-lg font-black font-mono ${
                summary.recentDelta >= 0 ? 'text-sky-400' : 'text-slate-400'
              }`}
            >
              {summary.recentDelta >= 0 ? '+' : ''}
              {summary.recentDelta.toLocaleString()} {metricMeta.unit}
            </span>
          </div>
          <div className="text-[10px] text-slate-500">
            {lang === 'th' ? 'เทียบจากหมุดก่อนหน้า' : 'Vs. previous milestone'}
          </div>
        </div>

        {/* Next Tier Milestone Progress */}
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>{lang === 'th' ? 'เป้าหมายถัดไป' : 'Next Milestone'}</span>
            <Crown className="size-3.5 text-amber-400" />
          </div>
          <div className="flex items-baseline justify-between text-xs font-mono font-bold">
            <span className="text-white">
              {summary.currentValue.toLocaleString()} / {summary.nextMilestoneTarget.toLocaleString()}{' '}
              {metricMeta.unit}
            </span>
            <span className="text-amber-400">{summary.milestoneProgressPct.toFixed(0)}%</span>
          </div>
          {/* Mini Progress Bar */}
          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${summary.milestoneProgressPct}%`,
                backgroundColor: metricMeta.color
              }}
            />
          </div>
        </div>
      </div>

      {/* 4. INTERACTIVE VECTOR SVG CHART CONTAINER */}
      <div className="relative rounded-xl bg-slate-950/80 border border-slate-800/80 p-4 overflow-hidden">
        {/* Metric Label & Active Highlight */}
        <div className="flex items-center justify-between text-xs mb-2">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full animate-pulse"
              style={{ backgroundColor: metricMeta.color }}
            />
            <span className="font-bold text-slate-200">
              {lang === 'th' ? metricMeta.labelTh : metricMeta.labelEn}
            </span>
          </div>

          {/* Active Point Hover Details */}
          {activePoint && (
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-slate-400">
                {new Date(activePoint.point.date).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </span>
              <span
                className="font-bold text-sm px-2 py-0.5 rounded-md"
                style={{
                  backgroundColor: `${metricMeta.color}20`,
                  color: metricMeta.color,
                  border: `1px solid ${metricMeta.color}40`
                }}
              >
                {activePoint.val.toLocaleString()} {metricMeta.unit}
              </span>
            </div>
          )}
        </div>

        {/* SVG Graphic Canvas */}
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-48 sm:h-56 select-none overflow-visible"
          >
            <defs>
              {/* Area Gradient Under Curve */}
              <linearGradient id={metricMeta.gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={metricMeta.color} stopOpacity="0.35" />
                <stop offset="80%" stopColor={metricMeta.color} stopOpacity="0.04" />
                <stop offset="100%" stopColor={metricMeta.color} stopOpacity="0.0" />
              </linearGradient>

              {/* Glow filter */}
              <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Horizontal Grid Lines */}
            {yTicks.map((val, idx) => {
              const normY = (val - minVal) / (maxVal - minVal || 1);
              const y = padding.top + graphHeight - normY * graphHeight;
              return (
                <g key={`ytick-${idx}`}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={padding.left + graphWidth}
                    y2={y}
                    stroke="#1e293b"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={padding.left - 10}
                    y={y + 3.5}
                    textAnchor="end"
                    fill="#64748b"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {val.toLocaleString()}
                  </text>
                </g>
              );
            })}

            {/* Filled Gradient Area Under Curve */}
            {areaPath && <path d={areaPath} fill={`url(#${metricMeta.gradientId})`} />}

            {/* Glowing Main Line Curve */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke={metricMeta.color}
                strokeWidth="2.5"
                filter="url(#neon-glow)"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Vertical Guide Line on Hover */}
            {hoveredIdx !== null && points[hoveredIdx] && (
              <line
                x1={points[hoveredIdx].x}
                y1={padding.top}
                x2={points[hoveredIdx].x}
                y2={padding.top + graphHeight}
                stroke="#cbd5e1"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.6"
              />
            )}

            {/* Data Point Dots */}
            {points.map((pt, idx) => {
              const isHovered = hoveredIdx === idx;
              const isLast = idx === points.length - 1;
              return (
                <g
                  key={`dot-${idx}`}
                  className="cursor-pointer transition-all duration-150"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  {/* Invisible Hit Area for Easy Hover */}
                  <circle cx={pt.x} cy={pt.y} r="18" fill="transparent" />

                  {/* Outer Ripple on Hover or Last point */}
                  {(isHovered || (hoveredIdx === null && isLast)) && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="9"
                      fill={metricMeta.color}
                      opacity="0.25"
                      className="animate-ping"
                    />
                  )}

                  {/* Dot Node */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? '6' : isLast ? '5' : '4'}
                    fill="#0f172a"
                    stroke={metricMeta.color}
                    strokeWidth={isHovered ? '3' : '2'}
                  />

                  {/* Bottom Date Label */}
                  <text
                    x={pt.x}
                    y={padding.top + graphHeight + 18}
                    textAnchor="middle"
                    fill={isHovered ? '#f1f5f9' : '#64748b'}
                    fontSize="9"
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

        {/* Hover Tooltip Overlay Card */}
        {activePoint && (
          <div className="mt-3 p-3 rounded-xl bg-slate-900/90 border border-slate-750 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div
                className="size-8 rounded-lg flex items-center justify-center font-bold font-mono text-xs shrink-0"
                style={{
                  backgroundColor: `${metricMeta.color}20`,
                  color: metricMeta.color,
                  border: `1px solid ${metricMeta.color}40`
                }}
              >
                #{activePoint.idx + 1}
              </div>
              <div>
                <div className="font-bold text-white flex items-center gap-2">
                  <span>{activePoint.point.note || 'Milestone Record'}</span>
                  {activePoint.point.type === 'approval' && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      VERIFIED
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400">
                  {new Date(activePoint.point.date).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                  {activePoint.point.verifiedBy && ` • โดย ${activePoint.point.verifiedBy}`}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono self-end sm:self-auto">
              <div>
                <span className="text-slate-400 text-[10px] block">POWER LEVEL</span>
                <span className="font-black text-amber-400">
                  ⚡ {activePoint.point.powerLevel.toLocaleString()} PL
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">LEVEL</span>
                <span className="font-bold text-purple-400">Lv. {activePoint.point.level || 75}</span>
              </div>
              {activePoint.point.damage ? (
                <div>
                  <span className="text-slate-400 text-[10px] block">DMG</span>
                  <span className="font-bold text-rose-400">{activePoint.point.damage}</span>
                </div>
              ) : null}
              {activePoint.point.accuracy ? (
                <div>
                  <span className="text-slate-400 text-[10px] block">ACC</span>
                  <span className="font-bold text-sky-400">{activePoint.point.accuracy}</span>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* 5. TIMELINE MILESTONES FEED / HISTORY LEDGER */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              setShowMilestonesList(!showMilestonesList);
            }}
            className="flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white transition"
          >
            <ChevronRight
              className={`size-4 text-amber-400 transition-transform ${
                showMilestonesList ? 'rotate-90' : ''
              }`}
            />
            <span>{lang === 'th' ? 'ประวัติหมุดการเติบโตทั้งหมด' : 'Full Milestone Progression History'}</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
              {fullHistory.length}
            </span>
          </button>
        </div>

        {showMilestonesList && (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
            {fullHistory
              .slice()
              .reverse()
              .map((point, idx) => {
                const prevPoint = fullHistory[fullHistory.length - 2 - idx];
                const deltaPl = prevPoint ? point.powerLevel - prevPoint.powerLevel : 0;
                const isManual = point.type === 'milestone';

                return (
                  <div
                    key={point.id}
                    className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/90 hover:border-slate-700 flex items-center justify-between gap-3 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                        {point.type === 'approval' ? (
                          <CheckCircle2 className="size-4 text-emerald-400" />
                        ) : point.type === 'initial' ? (
                          <Award className="size-4 text-sky-400" />
                        ) : (
                          <Zap className="size-4 text-amber-400" />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-white flex items-center gap-2">
                          <span>{point.note || 'Progression Record'}</span>
                          {deltaPl !== 0 && (
                            <span
                              className={`text-[10px] font-mono font-bold ${
                                deltaPl > 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {deltaPl > 0 ? `+${deltaPl.toLocaleString()}` : deltaPl.toLocaleString()} PL
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3" />
                            {new Date(point.date).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                          <span>•</span>
                          <span>Lv. {point.level || 75}</span>
                          {point.damage ? <span>• Dmg {point.damage}</span> : null}
                          {point.accuracy ? <span>• Acc {point.accuracy}</span> : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-xs font-black font-mono text-amber-400">
                          ⚡ {point.powerLevel.toLocaleString()} PL
                        </div>
                        <div className="text-[9px] text-slate-500 uppercase">
                          {point.type === 'approval'
                            ? 'VERIFIED'
                            : point.type === 'initial'
                            ? 'INITIAL'
                            : 'MILESTONE'}
                        </div>
                      </div>

                      {/* Delete button if manual */}
                      {isManual && (
                        <button
                          type="button"
                          onClick={() => handleDeleteMilestone(point.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition"
                          title={lang === 'th' ? 'ลบหมุดนี้' : 'Delete'}
                        >
                          <Trash2 className="size-3.5" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-amber-500/40 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Plus className="size-4 stroke-[3]" />
                </div>
                <h3 className="text-base font-bold text-white font-cinzel">
                  {lang === 'th' ? 'เพิ่มหมุดประวัติการเติบโต' : 'Add Growth Milestone'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleAddMilestone} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  {lang === 'th' ? 'วันที่บันทึกเหตุการณ์' : 'Milestone Date'}
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-amber-500 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    {lang === 'th' ? 'ค่าพลัง (PL)' : 'Power Level (PL)'}
                  </label>
                  <input
                    type="number"
                    value={newPl}
                    onChange={(e) => setNewPl(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-amber-400 font-mono font-bold focus:border-amber-500 outline-none"
                    placeholder="e.g. 3650"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    {lang === 'th' ? 'เลเวลตัวละคร (Lv)' : 'Level'}
                  </label>
                  <input
                    type="number"
                    value={newLevel}
                    onChange={(e) => setNewLevel(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:border-amber-500 outline-none"
                    placeholder="e.g. 79"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  {lang === 'th' ? 'บันทึกเหตุการณ์ / โน้ตความก้าวหน้า' : 'Milestone Description / Note'}
                </label>
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-amber-500 outline-none"
                  placeholder={
                    lang === 'th'
                      ? 'เช่น ตีบวกดาบ +9, อัปผลึกวิญญาณเทียร์ 5, ปลดสกิลตำนาน'
                      : 'e.g. +9 Weapon Enchant, Unlocked Legendary Skill'
                  }
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition font-semibold"
                >
                  {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
                >
                  {isSubmitting
                    ? lang === 'th'
                      ? 'กำลังบันทึก...'
                      : 'Saving...'
                    : lang === 'th'
                    ? 'บันทึกหมุด'
                    : 'Save Milestone'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
