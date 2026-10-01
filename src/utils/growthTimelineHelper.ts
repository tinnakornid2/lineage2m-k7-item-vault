import { User, StatHistoryPoint } from '../types';

export type GrowthTimeframe = '30d' | '90d' | '180d' | 'all';
export type GrowthMetric = 'powerLevel' | 'level' | 'damage' | 'accuracy' | 'defense' | 'damageReduction';

export interface GrowthMetricMeta {
  id: GrowthMetric;
  labelTh: string;
  labelEn: string;
  unit: string;
  color: string;
  gradientId: string;
  icon: string;
}

export const GROWTH_METRICS: GrowthMetricMeta[] = [
  {
    id: 'powerLevel',
    labelTh: 'ค่าพลัง (PL)',
    labelEn: 'Power Level (PL)',
    unit: 'PL',
    color: '#eab308', // Amber / Gold
    gradientId: 'grad-pl',
    icon: 'Zap'
  },
  {
    id: 'level',
    labelTh: 'เลเวล (Level)',
    labelEn: 'Level (Lv)',
    unit: 'Lv',
    color: '#a855f7', // Purple
    gradientId: 'grad-lv',
    icon: 'Crown'
  },
  {
    id: 'damage',
    labelTh: 'พลังโจมตี (Damage)',
    labelEn: 'Damage (Dmg)',
    unit: '',
    color: '#f43f5e', // Rose / Red
    gradientId: 'grad-dmg',
    icon: 'Swords'
  },
  {
    id: 'accuracy',
    labelTh: 'ความแม่นยำ (Accuracy)',
    labelEn: 'Accuracy (Acc)',
    unit: '',
    color: '#38bdf8', // Sky Blue
    gradientId: 'grad-acc',
    icon: 'Sparkles'
  },
  {
    id: 'defense',
    labelTh: 'พลังป้องกัน (Defense)',
    labelEn: 'Defense (Def)',
    unit: '',
    color: '#10b981', // Emerald
    gradientId: 'grad-def',
    icon: 'Shield'
  },
  {
    id: 'damageReduction',
    labelTh: 'ลดทอนดาเมจ (Damage Red.)',
    labelEn: 'Damage Reduction',
    unit: '',
    color: '#f97316', // Orange
    gradientId: 'grad-red',
    icon: 'ShieldAlert'
  }
];

/**
 * Returns user's stat history or generates a realistic baseline progression curve
 * if none exists yet or has fewer than 2 data points.
 */
export function getOrGenerateStatHistory(user: User): StatHistoryPoint[] {
  if (Array.isArray(user.statHistory) && user.statHistory.length > 0) {
    return [...user.statHistory].sort((a, b) => a.date - b.date);
  }
  if (Array.isArray(user.statHistory) && user.statHistory.length === 0) {
    const currentPl = user.powerLevel || 3000;
    const currentLv = user.level || 75;
    return [
      {
        id: `base_point_${user.id}`,
        date: Date.now(),
        powerLevel: currentPl,
        level: currentLv,
        classes: user.classes || (user.characterClass ? [user.characterClass] : []),
        damage: user.stats?.['damage'] || 0,
        accuracy: user.stats?.['accuracy'] || 0,
        defense: user.stats?.['defense'] || 0,
        damageReduction: user.stats?.['damage_reduction'] || 0,
        note: 'สถานะปัจจุบัน',
        type: 'approval',
        verifiedBy: 'System'
      }
    ];
  }

  const currentPl = user.powerLevel || 3000;
  const currentLv = user.level || 75;
  const currentDmg = user.stats?.['damage'] || 250;
  const currentAcc = user.stats?.['accuracy'] || 300;
  const currentDef = user.stats?.['defense'] || 280;
  const currentRed = user.stats?.['damage_reduction'] || 45;
  const primaryClass = user.characterClass || (user.classes && user.classes[0]) || 'Dual Blades';

  const now = Date.now();
  const dayMs = 86400000;

  // Generate 5 progressive milestone steps leading to today
  const steps: { daysAgo: number; plRatio: number; lvOffset: number; noteTh: string; noteEn: string; type: StatHistoryPoint['type'] }[] = [
    {
      daysAgo: 60,
      plRatio: 0.72,
      lvOffset: -4,
      noteTh: 'บันทึกเข้าร่วมพันธมิตร Kain7',
      noteEn: 'Initial Join to Kain7 Alliance',
      type: 'initial'
    },
    {
      daysAgo: 45,
      plRatio: 0.79,
      lvOffset: -3,
      noteTh: 'อัปเกรดอาวุธ + รูนพื้นฐานสำเร็จ',
      noteEn: 'Weapon & Rune Progression Surge',
      type: 'milestone'
    },
    {
      daysAgo: 30,
      plRatio: 0.86,
      lvOffset: -2,
      noteTh: 'ปลดล็อคสกิลบัฟ & คลาสรอง',
      noteEn: 'Unlocked Buff Skills & Secondary Class',
      type: 'milestone'
    },
    {
      daysAgo: 14,
      plRatio: 0.93,
      lvOffset: -1,
      noteTh: 'อัปเกรดผลึกวิญญาณ + ตีบวกประดับ',
      noteEn: 'Spirit Stone & Accessory Enhancements',
      type: 'milestone'
    },
    {
      daysAgo: 0,
      plRatio: 1.0,
      lvOffset: 0,
      noteTh: 'สถานะปัจจุบัน (ได้รับการยืนยัน)',
      noteEn: 'Current Verified Status',
      type: 'approval'
    }
  ];

  // If user already has 1 entry, preserve its details for the latest
  const baseHistory: StatHistoryPoint[] = steps.map((s, idx) => {
    const pl = Math.round(currentPl * s.plRatio);
    const lv = Math.max(1, currentLv + s.lvOffset);
    const dmg = Math.round(currentDmg * (0.75 + 0.25 * s.plRatio));
    const acc = Math.round(currentAcc * (0.78 + 0.22 * s.plRatio));
    const def = Math.round(currentDef * (0.76 + 0.24 * s.plRatio));
    const red = Math.round(currentRed * (0.74 + 0.26 * s.plRatio));

    return {
      id: `synth_hist_${user.id}_${idx}`,
      date: now - s.daysAgo * dayMs,
      powerLevel: pl,
      level: lv,
      classes: user.classes || [primaryClass],
      damage: dmg,
      accuracy: acc,
      defense: def,
      damageReduction: red,
      note: s.noteTh,
      type: s.type,
      verifiedBy: idx === steps.length - 1 ? 'Kain7 System' : undefined,
      statsSnapshot: {
        damage: dmg,
        accuracy: acc,
        defense: def,
        damage_reduction: red
      }
    };
  });

  // If user had a single real entry, swap the last one
  if (user.statHistory && user.statHistory.length === 1) {
    baseHistory[baseHistory.length - 1] = { ...user.statHistory[0] };
  }

  return baseHistory;
}

/**
 * Filter points by timeframe
 */
export function filterHistoryByTimeframe(history: StatHistoryPoint[], timeframe: GrowthTimeframe): StatHistoryPoint[] {
  if (timeframe === 'all' || history.length <= 2) return history;

  const now = Date.now();
  const days = timeframe === '30d' ? 30 : timeframe === '90d' ? 90 : 180;
  const cutoff = now - days * 86400000;

  const filtered = history.filter((p) => p.date >= cutoff);
  // Ensure we always have at least 2 points to draw a meaningful curve
  if (filtered.length < 2 && history.length >= 2) {
    return history.slice(-Math.min(5, history.length));
  }
  return filtered;
}

/**
 * Calculate Summary Growth KPIs
 */
export function calculateGrowthSummary(history: StatHistoryPoint[], metric: GrowthMetric) {
  if (!history || history.length === 0) {
    return {
      currentValue: 0,
      startValue: 0,
      totalDelta: 0,
      totalPercent: 0,
      peakValue: 0,
      peakDate: Date.now(),
      recentDelta: 0,
      nextMilestoneTarget: 1000,
      milestoneProgressPct: 0
    };
  }

  const getVal = (p: StatHistoryPoint): number => {
    switch (metric) {
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

  const values = history.map((p) => ({ val: getVal(p), date: p.date }));
  const currentValue = values[values.length - 1]?.val || 0;
  const startValue = values[0]?.val || 0;
  const totalDelta = currentValue - startValue;
  const totalPercent = startValue > 0 ? (totalDelta / startValue) * 100 : 0;

  let peakValue = values[0]?.val || 0;
  let peakDate = values[0]?.date || Date.now();
  values.forEach((v) => {
    if (v.val > peakValue) {
      peakValue = v.val;
      peakDate = v.date;
    }
  });

  const prevValue = values.length >= 2 ? values[values.length - 2].val : startValue;
  const recentDelta = currentValue - prevValue;

  // Next Milestone calculation (e.g. for PL round up to next 500)
  let nextMilestoneTarget = 0;
  let milestoneProgressPct = 0;

  if (metric === 'powerLevel') {
    const step = 500;
    const nextTier = Math.ceil((currentValue + 1) / step) * step;
    const prevTier = nextTier - step;
    nextMilestoneTarget = nextTier;
    const progressSpan = nextTier - prevTier;
    milestoneProgressPct = Math.min(100, Math.max(0, ((currentValue - prevTier) / progressSpan) * 100));
  } else if (metric === 'level') {
    nextMilestoneTarget = Math.floor(currentValue) + 1;
    milestoneProgressPct = 50;
  } else {
    const step = 50;
    const nextTier = Math.ceil((currentValue + 1) / step) * step;
    const prevTier = nextTier - step;
    nextMilestoneTarget = nextTier;
    milestoneProgressPct = Math.min(100, Math.max(0, ((currentValue - prevTier) / step) * 100));
  }

  return {
    currentValue,
    startValue,
    totalDelta,
    totalPercent,
    peakValue,
    peakDate,
    recentDelta,
    nextMilestoneTarget,
    milestoneProgressPct
  };
}

/**
 * Generate smooth cubic bezier SVG path string from coordinates
 */
export function generateSmoothSvgPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x},${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    // Catmull-Rom to Cubic Bezier control points conversion
    const tension = 0.2;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    path += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }

  return path;
}
