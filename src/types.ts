export interface ClassMeta {
  id: string;
  nameEn: string;
  nameTh: string;
  icon: string;
}

export const OFFICIAL_CLASSES: ClassMeta[] = [
  { id: 'dualblades', nameEn: 'Dual Blades', nameTh: 'ดาบคู่ (Dual Blades)', icon: '/assets/classes/dualblades.png' },
  { id: 'orb', nameEn: 'Priest', nameTh: 'พระ / ลูกแก้ว (Priest)', icon: '/assets/classes/orb.png' },
  { id: 'spear', nameEn: 'Spear', nameTh: 'หอก (Spear)', icon: '/assets/classes/spear.png' },
  { id: 'greatsword', nameEn: 'Greatsword', nameTh: 'ดาบใหญ่ (Greatsword)', icon: '/assets/classes/greatsword.png' },
  { id: 'staff', nameEn: 'Mage', nameTh: 'เวทย์ / คทา (Mage)', icon: '/assets/classes/staff.png' },
  { id: 'bow', nameEn: 'Archer', nameTh: 'ธนู (Archer)', icon: '/assets/classes/bow.png' },
  { id: 'dagger', nameEn: 'Assassin', nameTh: 'มีดสั้น (Assassin)', icon: '/assets/classes/dagger.png' },
  { id: 'sword', nameEn: 'One-Handed Sword', nameTh: 'ดาบโล่ (One-Handed Sword)', icon: '/assets/classes/sword.png' },
  { id: 'xbow', nameEn: 'Crossbow', nameTh: 'หน้าไม้ (Crossbow)', icon: '/assets/classes/xbow.png' }
];

export const DEFAULT_CHARACTER_CLASSES = OFFICIAL_CLASSES.map((c) => c.nameEn);

export const CHARACTER_CLASSES = DEFAULT_CHARACTER_CLASSES;

export type CharacterClass = string;

export type ItemRarity = 'RARE' | 'EPIC' | 'LAGEND' | 'MYTHIC';

export const getRarityBadge = (r: ItemRarity) => {
  switch (r) {
    case 'MYTHIC':
      return 'bg-amber-500/25 text-amber-200 border-[#ffb800] glow-mythic';
    case 'LAGEND':
      return 'bg-[#8500fd]/25 text-[#e0b0ff] border-[#8500fd] glow-legend';
    case 'EPIC':
      return 'bg-red-500/25 text-red-200 border-[#ff1744] glow-epic';
    case 'RARE':
    default:
      return 'bg-cyan-500/25 text-cyan-200 border-[#00e5ff] glow-rare';
  }
};

export const getRarityBorder = (r: ItemRarity) => {
  switch (r) {
    case 'MYTHIC':
      return 'border-[#ffb800]/80 hover:border-[#ffb800] shadow-[0_0_15px_rgba(255,184,0,0.4)] hover:shadow-[0_0_28px_rgba(255,184,0,0.8)]';
    case 'LAGEND':
      return 'border-[#8500fd]/85 hover:border-[#8500fd] shadow-[0_0_16px_rgba(133,0,253,0.5)] hover:shadow-[0_0_30px_rgba(133,0,253,0.9)]';
    case 'EPIC':
      return 'border-[#ff1744]/80 hover:border-[#ff1744] shadow-[0_0_15px_rgba(255,23,68,0.4)] hover:shadow-[0_0_28px_rgba(255,23,68,0.8)]';
    case 'RARE':
    default:
      return 'border-[#00e5ff]/80 hover:border-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.4)] hover:shadow-[0_0_28px_rgba(0,229,255,0.8)]';
  }
};

export const getRarityTextGlow = (r: ItemRarity) => {
  switch (r) {
    case 'MYTHIC':
      return 'font-glow-mythic';
    case 'LAGEND':
      return 'font-glow-legend';
    case 'EPIC':
      return 'font-glow-epic';
    case 'RARE':
    default:
      return 'font-glow-rare';
  }
};

export type UserRole = 'owner' | 'admin' | 'manager' | 'party_leader' | 'member';

export type UserStatus = 'active' | 'pending_approval';

export interface User {
  id: string;
  username: string;
  password?: string;
  inGameName: string;
  powerLevel: number;
  clan: string;
  characterClass?: CharacterClass;
  classes?: string[];
  level?: number;
  legendClasses?: number;
  legendAgathions?: number;
  role: UserRole;
  status: UserStatus;
  createdAt: number;
  lastLoginAt?: number;
  pendingPowerLevel?: number | null;
  pendingPowerLevelRequestedAt?: number | null;
  // Dynamic Stats & Verification
  stats?: Record<string, number>;
  spiritEnhancements?: Record<string, number>;
  pendingStats?: Record<string, number>;
  pendingSpiritEnhancements?: Record<string, number>;
  pendingClasses?: string[];
  pendingLevel?: number;
  pendingLegendClasses?: number;
  pendingLegendAgathions?: number;
  pendingStatScreenshotUrl?: string;
  statScreenshotUrl?: string;
  statRejectionReason?: string;
  statRejectionAt?: number;
  lastStatUpdatedAt?: number;
  verified?: boolean;
  statHistory?: StatHistoryPoint[];
  screenshots?: string[];
  screenshotUrl?: string;
  spirits?: Record<string, any>;
  kain7Id?: string;
  updatedAt?: number;
}

export interface StatHistoryPoint {
  id: string;
  date: number; // timestamp in ms
  powerLevel: number;
  level?: number;
  classes?: string[];
  damage?: number;
  accuracy?: number;
  defense?: number;
  damageReduction?: number;
  skillDamageBoost?: number;
  weaponDamageBoost?: number;
  note?: string;
  type?: 'approval' | 'self_record' | 'milestone' | 'initial';
  verifiedBy?: string;
  statsSnapshot?: Record<string, number>;
}

export interface QuickItem {
  id: string;
  name: string;
  rarity: ItemRarity;
  imageUrl: string;
  quantity?: number;
  createdAt: number;
}

export interface GeneralItem {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
  quantity: number;
  minPowerLevel: number;
  rarity: ItemRarity;
  queueList: QueueMember[];
  receiptHistory: GeneralItemReceipt[];
  createdAt: number;
}

export interface GeneralItemReceipt {
  id: string;
  userId?: string;
  name: string;
  clan: string;
  quantity: number;
  diamondPrice?: number;
  totalDiamonds?: number;
  receiptImages: string[];
  note?: string;
  deliveredAt: number;
  deliveredBy: string;
  updatedAt?: number;
}

export interface HunterRecord {
  name: string;
  clan: string;
}

export interface Claimant {
  userId: string;
  inGameName: string;
  clan: string;
  powerLevel: number;
  claimedAt: number;
}

export interface DistributedInfo {
  userId?: string;
  name: string;
  clan?: string;
  distributedAt: number;
  distributedBy: string;
  receiptImages?: string[];
  paymentStatus?: 'pending' | 'paid';
  paidAt?: number;
  paidBy?: string;
}

export interface VaultItem {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
  minPowerLevel: number;
  rarity: ItemRarity;
  quantity?: number;
  hunters: HunterRecord[];
  hunterScreenshots: string[];
  status: 'available' | 'distributed';
  claimants: Claimant[];
  distributedTo?: DistributedInfo;
  receiptImages?: string[];
  paymentStatus?: 'pending' | 'paid';
  paidAt?: number;
  paidBy?: string;
  createdAt: number;
}

export interface QueueMember {
  id: string;
  userId?: string;
  name: string;
  clan: string;
  powerLevel?: number;
  status: 'pending' | 'received';
  receivedAt?: number;
  joinedAt?: number;
}

export interface QueueItem {
  id: string;
  name: string;
  imageUrl?: string;
  rarity: ItemRarity;
  queueList: QueueMember[];
  createdAt: number;
}

export type ClanFundTxType = 'credit' | 'deduction' | 'adjust' | 'expenditure' | 'deposit' | 'withdraw';

export interface DiamondVaultRecord {
  id: string;
  type: ClanFundTxType;
  amount: number;
  grossAmount?: number;
  taxPct?: number;
  taxAmount?: number;
  netAmount?: number;
  clanScope?: string;
  recipientUserId?: string;
  recipientName?: string;
  recipientClan?: string;
  proofImageUrl?: string;
  balanceAfter?: number;
  note?: string;
  performedBy: {
    userId: string;
    name: string;
    role: UserRole;
  };
  timestamp: number;
}

export interface DiamondVault {
  balance: number;
  transactions: DiamondVaultRecord[];
  updatedAt: number;
}


export interface ClanGroup {
  id: string;
  name: string;
  color?: string;
  order?: number;
  enabled?: boolean;
}

export const OFFICIAL_CLANS: ClanGroup[] = [
  { id: 'clan_voltz', name: 'VoltZ', color: '#22c55e', order: 0, enabled: true },
  { id: 'clan_levels', name: 'LevelS', color: '#ef4444', order: 1, enabled: true },
  { id: 'clan_stronk', name: 'STRONK', color: '#eab308', order: 2, enabled: true }
];

/**
 * Strips the 'Clan:' or 'clan:' prefix to save space across the UI (e.g. 'Clan:VoltZ' -> 'VoltZ')
 */
export function cleanClanName(clan?: string | null): string {
  if (!clan || typeof clan !== 'string') return '';
  const cleaned = clan.replace(/^clan:\s*/i, '').trim();
  if (cleaned.toLowerCase() === 'voltz') return 'VoltZ';
  return cleaned;
}

/**
 * Checks if a clan string represents no clan / unassigned
 */
export function isNoClan(clan?: string | null): boolean {
  if (!clan || typeof clan !== 'string') return true;
  const clean = cleanClanName(clan).toLowerCase().trim();
  return (
    clean === '' ||
    clean === 'no-clan' ||
    clean === 'no clan' ||
    clean === 'noclan' ||
    clean === 'unassigned' ||
    clean === 'none' ||
    clean === 'ไม่มีแคลน' ||
    clean === '-'
  );
}

export const DEFAULT_CLAN = 'VoltZ';

/**
 * Checks if a user has verified/updated stats (powerLevel > 0 or non-zero stats values)
 */
export function hasUserUpdatedStats(user?: User | null): boolean {
  if (!user) return false;
  if (user.role === 'owner') return true;
  if (typeof user.powerLevel === 'number' && user.powerLevel > 0) return true;
  if (user.stats && typeof user.stats === 'object') {
    return Object.values(user.stats).some((v) => typeof v === 'number' && v > 0);
  }
  return false;
}

/**
 * Checks if a user has submitted stats that are currently pending Admin/Owner approval
 */
export function isUserStatsPending(user?: User | null): boolean {
  if (!user) return false;
  if (hasUserUpdatedStats(user)) return false;
  if (typeof user.pendingPowerLevel === 'number' && user.pendingPowerLevel > 0) return true;
  if (user.pendingStats && typeof user.pendingStats === 'object') {
    return Object.values(user.pendingStats).some((v) => typeof v === 'number' && v > 0);
  }
  return false;
}

export type ActiveTab = 'dashboard' | 'vault' | 'queue' | 'all_members' | 'clans' | 'bulk_swap' | 'my_stats' | 'stat_approvals' | 'power_formula';

export type Language = 'th' | 'en';

export interface AnnouncementSettings {
  text: string;
  enabled: boolean;
  type: 'info' | 'urgent' | 'event';
  speed: 'slow' | 'normal' | 'fast';
  updatedBy?: string;
  updatedAt?: number;
}

export interface BackgroundSettingsData {
  imageUrl: string;
  brightness: number;
  blur: number;
  vignetteOpacity: number;
  updatedBy?: string;
  updatedAt?: number;
}

export type DiscordMentionType = 'none' | 'everyone' | 'role';
export type DiscordMessageTemplate = 'neon_glow' | 'war_horn' | 'clan_market' | 'crystal_minimal';

export interface DiscordSettings {
  webhookUrl: string;
  appBaseUrl?: string;
  enabled: boolean;
  notifyOnNewItem: boolean;
  notifyOnDistribute: boolean;
  mentionType?: DiscordMentionType;
  mentionRoleId?: string;
  mentionEveryone?: boolean;
  messageTemplate?: DiscordMessageTemplate;
  botName?: string;
  updatedBy?: string;
  updatedAt?: number;
}

export interface AppNotification {
  id: string;
  type: 'claim' | 'stat_request';
  title: string;
  description: string;
  timestamp: number;
  read: boolean;
  item?: VaultItem;
  generalItem?: GeneralItem;
  claimant?: Claimant;
  user?: User;
}

// ─────────────────────────────────────────────────────────────
// Power Formula & Dynamic Stat Engine Types
// ─────────────────────────────────────────────────────────────

export type StatInputType = 'number' | 'percentage' | 'spirit_card' | 'tier_select' | 'boolean';

export type StatCategory = 'combat' | 'defense' | 'spirit' | 'special' | 'custom';

export interface SpiritConfig {
  icon: string;
  accentColor: string;
  enhancementOptions: number[];
  enhancementBonus?: Record<number, number>;
}

export interface StatDefinition {
  id: string;
  labelTh: string;
  labelEn: string;
  category: StatCategory;
  inputType: StatInputType;
  multiplier: number;
  calcMethod: 'linear' | 'divisor' | 'tier_bonus' | 'flat';
  divisorValue?: number;
  spiritConfig?: SpiritConfig;
  isActive: boolean;
  includeInTransfer: boolean;
  isRequired: boolean;
  order: number;
}

export type FormulaPreset = 'standard' | 'pvp_war' | 'pve_boss' | 'custom';

export interface FormulaSettings {
  name?: string;
  activePreset: FormulaPreset;
  stats: StatDefinition[];
  freezeStatsUntil?: number | null;
  updatedBy?: string;
  updatedAt?: number;
}

export interface PendingStatRequest {
  userId: string;
  inGameName: string;
  clan: string;
  characterClass: string;
  currentPowerLevel: number;
  newPowerLevel: number;
  currentStats?: Record<string, number>;
  newStats: Record<string, number>;
  currentSpiritEnhancements?: Record<string, number>;
  newSpiritEnhancements?: Record<string, number>;
  screenshotUrl?: string;
  requestedAt: number;
}

// ─────────────────────────────────────────────────────────────
// Bulk Swap Types
// ─────────────────────────────────────────────────────────────

export interface PendingSwap {
  memberId: string;
  fromClan: string;
  toClan: string;
}
