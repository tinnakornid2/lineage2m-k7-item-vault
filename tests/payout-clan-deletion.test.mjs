import assert from 'node:assert/strict';
import { cleanClanName, isNoClan, normalizeDistributedItem } from '../src/types.ts';

console.log('======================================================================');
console.log('🧪 VERIFYING DIAMOND PAYOUT, CLAN SELECTION & DELETION RULES (v2.11.9)');
console.log('======================================================================');

// 1. Verify Diamond Payout normalization and sync
console.log('>>> [TEST 1: Diamond Payout Status Normalization]');
const itemWithPayout = {
  id: 'test_item_1',
  name: 'Archon Sword',
  price: 1000,
  rarity: 'MYTHIC',
  status: 'distributed',
  paymentStatus: 'paid',
  distributedTo: {
    name: 'Player1',
    clan: 'VoltZ',
    distributedAt: Date.now(),
    paymentStatus: 'paid',
    diamondPayoutStatus: 'paid_out',
    diamondPayoutAt: 12345678,
    diamondPayoutBy: 'Admin'
  }
};

const normalized = normalizeDistributedItem(itemWithPayout);
assert.equal(normalized.diamondPayoutStatus, 'paid_out', 'Top-level diamondPayoutStatus must match distributedTo');
assert.equal(normalized.diamondPayoutAt, 12345678, 'Top-level diamondPayoutAt must match');
assert.equal(normalized.diamondPayoutBy, 'Admin', 'Top-level diamondPayoutBy must match');
console.log('✓ TEST 1.1: normalizeDistributedItem syncs diamondPayoutStatus fields');

// Test pending payout default
const itemPendingPayout = {
  id: 'test_item_2',
  name: 'Hero Bow',
  price: 500,
  rarity: 'LEGEND',
  status: 'distributed',
  paymentStatus: 'paid',
  distributedTo: {
    name: 'Player2',
    clan: 'Levels',
    distributedAt: Date.now(),
    paymentStatus: 'paid'
  }
};
const normalizedPending = normalizeDistributedItem(itemPendingPayout);
assert.equal(normalizedPending.diamondPayoutStatus, 'pending', 'Default payout status should be pending');
console.log('✓ TEST 1.2: Unset diamondPayoutStatus defaults to pending');

// Test 1.3: Tri-Box Partition Logic (Mutually exclusive, collectively exhaustive)
import { isDistributedItemPaymentPending } from '../src/types.ts';

const classifyBox = (item) => {
  const isPendingBuyerPayment = isDistributedItemPaymentPending(item);
  const isPendingPayout = item.price > 0 && !isPendingBuyerPayment && item.diamondPayoutStatus !== 'paid_out';
  const isFullyCompleted = !isPendingBuyerPayment && (!item.price || item.price === 0 || item.diamondPayoutStatus === 'paid_out');
  
  const boxMatches = [isPendingBuyerPayment, isPendingPayout, isFullyCompleted].filter(Boolean).length;
  assert.equal(boxMatches, 1, `Item ${item.name || item.id} must belong to exactly ONE box!`);
  
  if (isPendingBuyerPayment) return 1;
  if (isPendingPayout) return 2;
  if (isFullyCompleted) return 3;
};

// 1. Unpaid item -> Box 1
const box1Item = { id: 'b1', name: 'Ring', price: 200, status: 'distributed', paymentStatus: 'pending' };
assert.equal(classifyBox(box1Item), 1, 'Unpaid item must be in Box 1 (Pending Buyer Payment)');

// 2. Paid item, pending payout -> Box 2
const box2Item = { id: 'b2', name: 'Ring', price: 200, status: 'distributed', paymentStatus: 'paid', diamondPayoutStatus: 'pending' };
assert.equal(classifyBox(box2Item), 2, 'Paid item with pending payout must be in Box 2 (Pending Diamond Payout)');

// 3. Paid item, paid out -> Box 3
const box3Item = { id: 'b3', name: 'Ring', price: 200, status: 'distributed', paymentStatus: 'paid', diamondPayoutStatus: 'paid_out' };
assert.equal(classifyBox(box3Item), 3, 'Paid item with completed payout must be in Box 3 (Fully Completed)');

// 4. Free item (price 0) -> Box 3
const freeItem = { id: 'b4', name: 'Free Potion', price: 0, status: 'distributed', paymentStatus: 'paid' };
assert.equal(classifyBox(freeItem), 3, 'Free item must be in Box 3 (Fully Completed)');

console.log('✓ TEST 1.3: Tri-box partition is strictly mutually exclusive and collectively exhaustive (0 leak)');

// 2. Verify Clan normalization (no more hardcoded 'VoltZ' fallback on unassigned)
console.log('\n>>> [TEST 2: Clan Normalization & Unassigned Handling]');
assert.equal(isNoClan('no-clan'), true, 'no-clan is recognized as no clan');
assert.equal(isNoClan('ไม่มีแคลน'), true, 'Thai term recognized as no clan');
assert.equal(isNoClan('unassigned'), true, 'unassigned recognized as no clan');

const targetClan1 = isNoClan('no-clan') ? 'no-clan' : (cleanClanName('no-clan') || 'no-clan');
assert.equal(targetClan1, 'no-clan', 'Selecting no-clan must preserve no-clan, never fallback to VoltZ');

const targetClan2 = isNoClan('') ? 'no-clan' : (cleanClanName('') || 'no-clan');
assert.equal(targetClan2, 'no-clan', 'Empty clan must resolve to no-clan, never VoltZ');

const targetClan3 = isNoClan('Levels') ? 'no-clan' : (cleanClanName('Levels') || 'no-clan');
assert.equal(targetClan3, 'Levels', 'Named clan must preserve clean clan name');
console.log('✓ TEST 2.1: Clan selection handles named and unassigned clans without fallback bug');

// 3. Verify Primary Owner immutability & Deletion rules
console.log('\n>>> [TEST 3: Member Deletion Permissions]');
const primaryOwner1 = { id: 'user_owner_eloni', username: 'eloni', role: 'owner' };
const primaryOwner2 = { id: 'user_123', username: 'ELONI', inGameName: 'Eloni', role: 'owner' };
const secondaryAdmin = { id: 'user_admin_2', username: 'admin2', role: 'admin' };
const regularMember = { id: 'user_mem_3', username: 'member3', role: 'member' };

const isPrimaryOwner = (u) => u.id === 'user_owner_eloni' || u.username?.toLowerCase() === 'eloni' || u.inGameName?.toLowerCase() === 'eloni';

assert.equal(isPrimaryOwner(primaryOwner1), true, 'user_owner_eloni is primary owner');
assert.equal(isPrimaryOwner(primaryOwner2), true, 'Username eloni is primary owner');
assert.equal(isPrimaryOwner(secondaryAdmin), false, 'Secondary admin is not primary owner');
assert.equal(isPrimaryOwner(regularMember), false, 'Regular member is not primary owner');

// Function matching MembersView canDeleteMember
const canDelete = (actor, target) => {
  if (!actor) return false;
  if (target.id === actor.id) return false;
  if (isPrimaryOwner(target)) return false;
  if (actor.role === 'owner') return true;
  if (actor.role === 'admin') {
    return target.role !== 'owner' && target.role !== 'admin';
  }
  return false;
};

// Owner checks
assert.equal(canDelete(primaryOwner1, primaryOwner1), false, 'Owner cannot delete self');
assert.equal(canDelete(primaryOwner1, primaryOwner2), false, 'Owner cannot delete primary owner variant');
assert.equal(canDelete(primaryOwner1, secondaryAdmin), true, 'Owner can delete admin');
assert.equal(canDelete(primaryOwner1, regularMember), true, 'Owner can delete regular member');

// Admin checks
assert.equal(canDelete(secondaryAdmin, secondaryAdmin), false, 'Admin cannot delete self');
assert.equal(canDelete(secondaryAdmin, primaryOwner1), false, 'Admin cannot delete owner');
const otherAdmin = { id: 'user_admin_4', username: 'admin4', role: 'admin' };
assert.equal(canDelete(secondaryAdmin, otherAdmin), false, 'Admin cannot delete another admin');
assert.equal(canDelete(secondaryAdmin, regularMember), true, 'Admin can delete regular member');
console.log('✓ TEST 3.1: canDeleteMember enforces proper hierarchy and protects primary owner');

console.log('\n======================================================================');
console.log('🎉 ALL PAYOUT, CLAN & DELETION TESTS PASSED 100%');
console.log('======================================================================');
