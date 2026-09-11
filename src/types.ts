export const DEFAULT_CHARACTER_CLASSES = [
  'Orb',
  'Spear',
  'Sword',
  'Greatsword',
  'Chainblade',
  'Dual Blade',
  'Dagger',
  'Bow',
  'Crossbow',
  'Staff',
  'Rapier',
  'Magic Cannon',
  'Soul Breaker'
] as const;

export const CHARACTER_CLASSES = DEFAULT_CHARACTER_CLASSES;

export type CharacterClass = (typeof DEFAULT_CHARACTER_CLASSES)[number] | string;

export type ItemRarity = 'RARE' | 'EPIC' | 'LAGEND' | 'MYTHIC';

export type UserRole = 'owner' | 'admin' | 'manager' | 'member';

export type UserStatus = 'active' | 'pending_approval';

export interface User {
  id: string;
  username: string;
  password?: string;
  inGameName: string;
  powerLevel: number;
  clan: string;
  characterClass: CharacterClass;
  role: UserRole;
  status: UserStatus;
  createdAt: number;
  lastLoginAt?: number;
}

export interface QuickItem {
  id: string;
  name: string;
  rarity: ItemRarity;
  imageUrl: string;
  createdAt: number;
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
}

export interface VaultItem {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
  minPowerLevel: number;
  rarity: ItemRarity;
  hunters: HunterRecord[];
  hunterScreenshots: string[];
  status: 'available' | 'distributed';
  claimants: Claimant[];
  distributedTo?: DistributedInfo;
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
}

export interface QueueItem {
  id: string;
  name: string;
  imageUrl?: string;
  rarity: ItemRarity;
  queueList: QueueMember[];
  createdAt: number;
}

export interface DiamondVaultRecord {
  id: string;
  type: 'deposit' | 'withdraw';
  amount: number;
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
}

export type ActiveTab = 'dashboard' | 'vault' | 'queue' | 'all_members' | 'clan';

export type Language = 'th' | 'en';

export interface AnnouncementSettings {
  text: string;
  enabled: boolean;
  type: 'info' | 'urgent' | 'event';
  speed: 'slow' | 'normal' | 'fast';
  updatedBy?: string;
  updatedAt?: number;
}

export interface DiscordSettings {
  webhookUrl: string;
  enabled: boolean;
  notifyOnNewItem: boolean;
  notifyOnDistribute: boolean;
  botName?: string;
  updatedBy?: string;
  updatedAt?: number;
}
