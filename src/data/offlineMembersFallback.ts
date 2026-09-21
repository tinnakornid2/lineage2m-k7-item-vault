import { User } from '../types';

/**
 * Tier 1 Static Fallback - Deprecated and Cleared (v2.8.14)
 * The app now operates in a 100% Cloud-First architecture (Google Sheets & Live Relay).
 * No hardcoded static member snapshots are kept in the client bundle.
 */
export const LEAN_OFFLINE_MEMBERS: User[] = [];
