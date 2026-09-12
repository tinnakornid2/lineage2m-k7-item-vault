import { StatDefinition, FormulaSettings, FormulaPreset } from '../types';
import { saveFormulaSettingsDoc } from './firebase';

export const DEFAULT_STAT_DEFINITIONS: StatDefinition[] = [
  // Combat Stats
  {
    id: 'damage',
    labelTh: 'พลังโจมตี (Damage)',
    labelEn: 'Damage',
    category: 'combat',
    inputType: 'number',
    multiplier: 1,
    calcMethod: 'linear',
    isActive: true,
    includeInTransfer: true,
    isRequired: true,
    order: 1
  },
  {
    id: 'accuracy',
    labelTh: 'ความแม่นยำ (Accuracy)',
    labelEn: 'Accuracy',
    category: 'combat',
    inputType: 'number',
    multiplier: 1,
    calcMethod: 'linear',
    isActive: true,
    includeInTransfer: true,
    isRequired: true,
    order: 2
  },

  // Defense & Resistance Stats
  {
    id: 'defense',
    labelTh: 'พลังป้องกัน (Defense)',
    labelEn: 'Defense',
    category: 'defense',
    inputType: 'number',
    multiplier: 2,
    calcMethod: 'linear',
    isActive: true,
    includeInTransfer: true,
    isRequired: true,
    order: 3
  },
  {
    id: 'damage_reduction',
    labelTh: 'ลดทอนความเสียหาย (Damage Reduction)',
    labelEn: 'Damage Reduction',
    category: 'defense',
    inputType: 'number',
    multiplier: 3,
    calcMethod: 'linear',
    isActive: true,
    includeInTransfer: true,
    isRequired: true,
    order: 4
  },
  {
    id: 'skill_resistance',
    labelTh: 'ต้านทานสกิล (Skill Resistance)',
    labelEn: 'Skill Resistance',
    category: 'defense',
    inputType: 'number',
    multiplier: 1,
    calcMethod: 'linear',
    isActive: true,
    includeInTransfer: true,
    isRequired: true,
    order: 5
  },
  {
    id: 'skill_defense_percent',
    labelTh: 'ป้องกันสกิล % (Skill Def %)',
    labelEn: 'Skill Defense %',
    category: 'defense',
    inputType: 'percentage',
    multiplier: 2,
    calcMethod: 'linear',
    isActive: true,
    includeInTransfer: true,
    isRequired: true,
    order: 6
  },
  {
    id: 'weapon_defense_percent',
    labelTh: 'ป้องกันอาวุธ % (Weapon Def %)',
    labelEn: 'Weapon Defense %',
    category: 'defense',
    inputType: 'percentage',
    multiplier: 1,
    calcMethod: 'linear',
    isActive: true,
    includeInTransfer: true,
    isRequired: true,
    order: 7
  },
  {
    id: 'skill_damage_boost_percent',
    labelTh: 'บูสต์ดาเมจสกิล % (Skill Dmg Boost %)',
    labelEn: 'Skill Damage Boost %',
    category: 'combat',
    inputType: 'percentage',
    multiplier: 2,
    calcMethod: 'linear',
    isActive: true,
    includeInTransfer: true,
    isRequired: true,
    order: 8
  },
  {
    id: 'weapon_damage_boost_percent',
    labelTh: 'บูสต์ดาเมจอาวุธ % (Weapon Dmg Boost %)',
    labelEn: 'Weapon Damage Boost %',
    category: 'combat',
    inputType: 'percentage',
    multiplier: 1,
    calcMethod: 'linear',
    isActive: true,
    includeInTransfer: true,
    isRequired: true,
    order: 9
  },

  // Spirits Progression Cards (Interactive Cards with Level & Enhancement 0, +1, +2, +3)
  {
    id: 'soulshot_level',
    labelTh: 'ผลึกวิญญาณ: กระสุนวิญญาณ (Soulshot)',
    labelEn: 'Spirit: Soulshot',
    category: 'spirit',
    inputType: 'spirit_card',
    multiplier: 10,
    calcMethod: 'linear',
    spiritConfig: {
      icon: 'Sparkles',
      accentColor: '#3b82f6', // Electric Blue
      enhancementOptions: [0, 1, 2, 3],
      enhancementBonus: { 0: 0, 1: 5, 2: 10, 3: 20 }
    },
    isActive: true,
    includeInTransfer: true,
    isRequired: true,
    order: 10
  },
  {
    id: 'valor_level',
    labelTh: 'ผลึกวิญญาณ: ความกล้าหาญ (Valor)',
    labelEn: 'Spirit: Valor',
    category: 'spirit',
    inputType: 'spirit_card',
    multiplier: 10,
    calcMethod: 'linear',
    spiritConfig: {
      icon: 'Swords',
      accentColor: '#10b981', // Emerald Green
      enhancementOptions: [0, 1, 2, 3],
      enhancementBonus: { 0: 0, 1: 5, 2: 10, 3: 20 }
    },
    isActive: true,
    includeInTransfer: true,
    isRequired: true,
    order: 11
  },
  {
    id: 'guardian_level',
    labelTh: 'ผลึกวิญญาณ: ผู้พิทักษ์ (Guardian)',
    labelEn: 'Spirit: Guardian',
    category: 'spirit',
    inputType: 'spirit_card',
    multiplier: 10,
    calcMethod: 'linear',
    spiritConfig: {
      icon: 'Shield',
      accentColor: '#f59e0b', // Amber Gold
      enhancementOptions: [0, 1, 2, 3],
      enhancementBonus: { 0: 0, 1: 5, 2: 10, 3: 20 }
    },
    isActive: true,
    includeInTransfer: true,
    isRequired: true,
    order: 12
  },
  {
    id: 'conquer_level',
    labelTh: 'ผลึกวิญญาณ: พิชิต (Conquer)',
    labelEn: 'Spirit: Conquer',
    category: 'spirit',
    inputType: 'spirit_card',
    multiplier: 10,
    calcMethod: 'linear',
    spiritConfig: {
      icon: 'Crown',
      accentColor: '#a855f7', // Royal Purple
      enhancementOptions: [0, 1, 2, 3],
      enhancementBonus: { 0: 0, 1: 5, 2: 10, 3: 20 }
    },
    isActive: true,
    includeInTransfer: false, // Not included in Server Transfer PL
    isRequired: true,
    order: 13
  },
  {
    id: 'duel_level',
    labelTh: 'ผลึกวิญญาณ: ประลอง (Duel)',
    labelEn: 'Spirit: Duel',
    category: 'spirit',
    inputType: 'spirit_card',
    multiplier: 10,
    calcMethod: 'linear',
    spiritConfig: {
      icon: 'Zap',
      accentColor: '#f43f5e', // Crimson Rose
      enhancementOptions: [0, 1, 2, 3],
      enhancementBonus: { 0: 0, 1: 5, 2: 10, 3: 20 }
    },
    isActive: true,
    includeInTransfer: true,
    isRequired: true,
    order: 14
  },

  // Special / PvP Stats
  {
    id: 'stun_resistance',
    labelTh: 'ต้านทานสตัน (Stun Resistance)',
    labelEn: 'Stun Resistance',
    category: 'special',
    inputType: 'number',
    multiplier: 1,
    calcMethod: 'linear',
    isActive: true,
    includeInTransfer: false,
    isRequired: false,
    order: 15
  },
  {
    id: 'stun_accuracy',
    labelTh: 'แม่นยำสตัน (Stun Accuracy)',
    labelEn: 'Stun Accuracy',
    category: 'special',
    inputType: 'number',
    multiplier: 1,
    calcMethod: 'linear',
    isActive: true,
    includeInTransfer: false,
    isRequired: false,
    order: 16
  },
  {
    id: 'triple_chance',
    labelTh: 'โอกาสทริปเปิ้ล % (Triple Chance %)',
    labelEn: 'Triple Chance %',
    category: 'special',
    inputType: 'percentage',
    multiplier: 2,
    calcMethod: 'linear',
    isActive: true,
    includeInTransfer: false,
    isRequired: false,
    order: 17
  },
  {
    id: 'aster',
    labelTh: 'ดวงดาว (Aster)',
    labelEn: 'Aster',
    category: 'special',
    inputType: 'number',
    multiplier: 1,
    calcMethod: 'linear',
    isActive: true,
    includeInTransfer: false,
    isRequired: false,
    order: 18
  }
];

export const FORMULA_PRESETS: Record<FormulaPreset, { nameTh: string; nameEn: string; descTh: string; descEn: string }> = {
  standard: {
    nameTh: '🛡️ สูตรสมดุลมาตรฐาน (Kain7 Standard)',
    nameEn: '🛡️ Standard Kain7 Balance',
    descTh: 'สูตรมาตรฐานของ Kain7 เน้นค่าพลังป้องกัน x2, ลดทอนดาเมจ x3, และระดับผลึก x10',
    descEn: 'Official Kain7 standard formula focusing on Def x2, Reduction x3, Spirits x10'
  },
  pvp_war: {
    nameTh: '⚔️ สูตรทำสงคราม / ชิงปราสาท (PvP War)',
    nameEn: '⚔️ Castle Siege & PvP War',
    descTh: 'เพิ่มน้ำหนักความแม่นสตัน x2, ต้านทานสตัน x2, ลดทอนดาเมจ x4, และโอกาสทริปเปิ้ล x3',
    descEn: 'Boosts weight for Stun Res/Acc x2, Damage Reduction x4, Triple Chance x3'
  },
  pve_boss: {
    nameTh: '🐉 สูตรเน้นล่าบอส (PvE Boss Hunting)',
    nameEn: '🐉 PvE Boss Hunting',
    descTh: 'เพิ่มน้ำหนักดาเมจ x2, ความแม่นยำ x2, บูสต์ดาเมจสกิล/อาวุธ x3',
    descEn: 'Focuses on Damage x2, Accuracy x2, and Damage Boost % x3'
  },
  custom: {
    nameTh: '⚙️ สูตรกำหนดเอง (Custom Formula)',
    nameEn: '⚙️ Custom Clan Formula',
    descTh: 'แอดมินปรับแต่งตัวคูณและสเตตัสเองทั้งหมด',
    descEn: 'Fully customized multipliers and attributes by admin'
  }
};

const STORAGE_KEY = 'l2m_power_formula_settings_v1';

let inMemorySettings: FormulaSettings | null = null;

export function setInMemoryFormulaSettings(settings: FormulaSettings): void {
  inMemorySettings = settings;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
  window.dispatchEvent(new CustomEvent('l2m_formula_settings_updated', { detail: settings }));
}

export function getFormulaSettings(): FormulaSettings {
  if (inMemorySettings && Array.isArray(inMemorySettings.stats) && inMemorySettings.stats.length > 0) {
    return inMemorySettings;
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.stats) && parsed.stats.length > 0) {
        inMemorySettings = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error loading formula settings from localStorage:', err);
  }

  // Default initial configuration
  const defaultSettings: FormulaSettings = {
    activePreset: 'standard',
    stats: DEFAULT_STAT_DEFINITIONS,
    freezeStatsUntil: null,
    updatedAt: Date.now()
  };

  saveFormulaSettings(defaultSettings);
  return defaultSettings;
}

export function saveFormulaSettings(settings: FormulaSettings): void {
  try {
    settings.updatedAt = Date.now();
    inMemorySettings = settings;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('l2m_formula_settings_updated', { detail: settings }));
    saveFormulaSettingsDoc(settings).catch((err) => {
      console.warn('Firestore formula sync notice:', err);
    });
  } catch (err) {
    console.error('Error saving formula settings:', err);
  }
}

/**
 * Calculate Power Level (PL) based on provided stat values and spirit enhancements.
 */
export function calculatePowerLevel(
  stats: Record<string, number | undefined> = {},
  spiritEnhancements: Record<string, number | undefined> = {},
  config: FormulaSettings = getFormulaSettings(),
  isTransfer = false
): number {
  let totalPL = 0;

  for (const stat of config.stats) {
    if (!stat.isActive) continue;
    if (isTransfer && !stat.includeInTransfer) continue;

    const rawVal = stats[stat.id] || 0;

    if (stat.inputType === 'spirit_card') {
      // Calculate Spirit: (Level * multiplier) + enhancement bonus
      const levelScore = rawVal * (stat.multiplier || 10);
      const enhLevel = spiritEnhancements[stat.id] || 0;
      const enhBonus = stat.spiritConfig?.enhancementBonus?.[enhLevel] || 0;
      totalPL += levelScore + enhBonus;
    } else if (stat.calcMethod === 'divisor' && stat.divisorValue && stat.divisorValue > 0) {
      totalPL += Math.floor(rawVal / stat.divisorValue);
    } else {
      totalPL += rawVal * (stat.multiplier || 1);
    }
  }

  return Math.max(0, Math.round(totalPL));
}

/**
 * Calculate Transfer PL (excluding regional/non-transferable stats)
 */
export function calculateTransferPowerLevel(
  stats: Record<string, number | undefined> = {},
  spiritEnhancements: Record<string, number | undefined> = {},
  config: FormulaSettings = getFormulaSettings()
): number {
  return calculatePowerLevel(stats, spiritEnhancements, config, true);
}

/**
 * Apply Preset to stat definitions
 */
export function applyPresetToStats(preset: FormulaPreset, currentStats: StatDefinition[]): StatDefinition[] {
  return currentStats.map((stat) => {
    const updated = { ...stat };

    if (preset === 'standard') {
      const def = DEFAULT_STAT_DEFINITIONS.find((d) => d.id === stat.id);
      if (def) {
        updated.multiplier = def.multiplier;
        updated.isActive = def.isActive;
        updated.includeInTransfer = def.includeInTransfer;
      }
    } else if (preset === 'pvp_war') {
      if (stat.id === 'damage_reduction') updated.multiplier = 4;
      if (stat.id === 'skill_defense_percent') updated.multiplier = 3;
      if (stat.id === 'stun_resistance') updated.multiplier = 2;
      if (stat.id === 'stun_accuracy') updated.multiplier = 2;
      if (stat.id === 'triple_chance') updated.multiplier = 3;
      if (stat.id === 'defense') updated.multiplier = 2;
    } else if (preset === 'pve_boss') {
      if (stat.id === 'damage') updated.multiplier = 2;
      if (stat.id === 'accuracy') updated.multiplier = 2;
      if (stat.id === 'skill_damage_boost_percent') updated.multiplier = 3;
      if (stat.id === 'weapon_damage_boost_percent') updated.multiplier = 2;
      if (stat.id === 'damage_reduction') updated.multiplier = 2;
    }

    return updated;
  });
}
