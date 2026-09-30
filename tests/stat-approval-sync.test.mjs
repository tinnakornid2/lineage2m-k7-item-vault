import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isUserStatsPending } from '../src/types.ts';
import { submissionError, statMessage } from '../src/utils/statRound.ts';

test('isUserStatsPending: properly evaluates pending, approved, and rejected states', () => {
  const baseUser = {
    id: 'user_1',
    username: 'warrior1',
    inGameName: 'Warrior1',
    role: 'member',
    status: 'active',
    powerLevel: 5000,
    stats: { damage: 100, defense: 80 }
  };

  // 1. Initial state with no pending request
  assert.equal(isUserStatsPending(baseUser), false);

  // 2. User submits stat update request at T=1000
  const pendingUser = {
    ...baseUser,
    pendingPowerLevel: 6000,
    pendingPowerLevelRequestedAt: 1000,
    pendingStats: { damage: 120, defense: 95 }
  };
  assert.equal(isUserStatsPending(pendingUser), true);

  // 3. Admin approves at T=1001 with approvedStatRequestAt=1000
  const approvedUser = {
    ...baseUser,
    powerLevel: 6000,
    stats: { damage: 120, defense: 95 },
    pendingPowerLevel: null,
    pendingPowerLevelRequestedAt: null,
    pendingStats: null,
    statApprovalAt: 1001,
    approvedStatRequestAt: 1000
  };
  assert.equal(isUserStatsPending(approvedUser), false);

  // 4. Stale cache edge case: pendingPowerLevel was left behind or resurrected, but approvedStatRequestAt covers it
  const staleCacheUser = {
    ...approvedUser,
    pendingPowerLevel: 6000,
    pendingPowerLevelRequestedAt: 1000
  };
  assert.equal(isUserStatsPending(staleCacheUser), false, 'Must not be pending if approvedStatRequestAt >= pendingPowerLevelRequestedAt');

  // 5. Clock drift edge case: client clock requested at T=1005, server approved at T=1002, but approvedStatRequestAt=1005
  const clockDriftUser = {
    ...approvedUser,
    statApprovalAt: 1002,
    approvedStatRequestAt: 1005,
    pendingPowerLevel: 6000,
    pendingPowerLevelRequestedAt: 1005
  };
  assert.equal(isUserStatsPending(clockDriftUser), false, 'Must not be pending if approvedStatRequestAt >= pendingPowerLevelRequestedAt');

  // 6. User submits a GENUINELY NEW request at T=2000 (after approval at T=1001)
  const newRequestUser = {
    ...approvedUser,
    pendingPowerLevel: 7000,
    pendingPowerLevelRequestedAt: 2000,
    pendingStats: { damage: 150, defense: 110 }
  };
  assert.equal(isUserStatsPending(newRequestUser), true, 'Must be pending when new request is after previous resolution');

  // 7. Rejection resolution at T=2005
  const rejectedUser = {
    ...newRequestUser,
    statRejectionAt: 2005,
    statRejectionReason: 'Screenshot blurry'
  };
  assert.equal(isUserStatsPending(rejectedUser), false, 'Must not be pending after rejection');
});

test('submissionError: prevents repeated submissions after approval and duplicate pending requests', () => {
  const approvedUser = {
    id: 'user_2',
    username: 'mage1',
    inGameName: 'Mage1',
    role: 'member',
    status: 'active',
    powerLevel: 8000,
    stats: { damage: 200 },
    classes: ['Orb'],
    level: 75,
    statApprovalAt: 1500,
    approvedStatRequestAt: 1400
  };

  // Submitting identical stats that are already approved should be blocked as UNCHANGED_STATS
  const identicalSubmission = {
    ...approvedUser,
    pendingStats: { damage: 200 },
    pendingClasses: ['Orb'],
    pendingLevel: 75
  };
  assert.equal(submissionError(approvedUser, identicalSubmission), 'UNCHANGED_STATS');

  // When request is currently pending, submitting the exact same stats again is blocked as DUPLICATE_PENDING
  const pendingUser = {
    ...approvedUser,
    pendingPowerLevel: 8500,
    pendingPowerLevelRequestedAt: 2000,
    pendingStats: { damage: 220 },
    pendingClasses: ['Orb'],
    pendingLevel: 76
  };
  assert.equal(submissionError(pendingUser, pendingUser), 'DUPLICATE_PENDING');

  // Submitting genuinely modified stats when approved is allowed (null error)
  const validModifiedSubmission = {
    ...approvedUser,
    pendingStats: { damage: 230 },
    pendingClasses: ['Orb'],
    pendingLevel: 76
  };
  assert.equal(submissionError(approvedUser, validModifiedSubmission), null);

  // Both Thai and English stat messages exist
  assert.equal(typeof statMessage('UNCHANGED_STATS', 'th'), 'string');
  assert.equal(typeof statMessage('UNCHANGED_STATS', 'en'), 'string');
  assert.match(statMessage('UNCHANGED_STATS', 'th'), /[ก-๙]/);
  assert.doesNotMatch(statMessage('UNCHANGED_STATS', 'en'), /[ก-๙]/);
});

test('App.tsx refresh sync: approved user profile preserves approved power and clears pending stats', () => {
  // Scenario: Member submitted update with powerLevel 6000 at T=1000.
  // In localStorage (cached), user still has old verified powerLevel 4000 and pendingStats.
  const cachedSessionUser = {
    id: 'user_warrior_1',
    username: 'warrior1',
    inGameName: 'Warrior1',
    role: 'member',
    status: 'active',
    powerLevel: 4000,
    stats: { damage: 80 },
    pendingPowerLevel: 6000,
    pendingPowerLevelRequestedAt: 1000,
    pendingStats: { damage: 120 },
    statApprovalAt: null,
    approvedStatRequestAt: null
  };

  // Admin approves: safeUser incoming from Firestore has approved power 6000, statApprovalAt=1001, approvedStatRequestAt=1000
  const safeUser = {
    id: 'user_warrior_1',
    username: 'warrior1',
    inGameName: 'Warrior1',
    role: 'member',
    status: 'active',
    powerLevel: 6000,
    stats: { damage: 120 },
    pendingPowerLevel: null,
    pendingPowerLevelRequestedAt: null,
    pendingStats: null,
    statApprovalAt: 1001,
    approvedStatRequestAt: 1000
  };

  // Evaluate the sync logic from App.tsx line 1155
  const curPendingAt = Number(cachedSessionUser.pendingPowerLevelRequestedAt || 0);
  const foundPendingAt = Number(safeUser.pendingPowerLevelRequestedAt || 0);
  const foundApprovedReq = Number(safeUser.approvedStatRequestAt || 0);
  const foundResAt = Math.max(Number(safeUser.statApprovalAt || 0), Number(safeUser.statRejectionAt || 0));
  const isApproved = (curPendingAt > 0 && curPendingAt <= foundApprovedReq) || (foundResAt > 0 && curPendingAt <= foundResAt);

  const shouldPreservePending = !isApproved && Boolean(cachedSessionUser.pendingStats && curPendingAt > 0 && curPendingAt > foundResAt && curPendingAt >= foundPendingAt);

  assert.equal(isApproved, true, 'Request should be marked as approved');
  assert.equal(shouldPreservePending, false, 'Pending stats must NOT be preserved after admin approval');

  const targetUser = shouldPreservePending
    ? {
        ...safeUser,
        pendingPowerLevel: cachedSessionUser.pendingPowerLevel,
        pendingPowerLevelRequestedAt: cachedSessionUser.pendingPowerLevelRequestedAt,
        pendingStats: cachedSessionUser.pendingStats
      }
    : safeUser;

  assert.equal(targetUser.powerLevel, 6000, 'Profile power level must update to approved 6000 PL');
  assert.equal(targetUser.pendingPowerLevel, null, 'Pending power level must be null');
  assert.equal(targetUser.pendingStats, null, 'Pending stats must be null');
  assert.equal(isUserStatsPending(targetUser), false, 'targetUser must not be in pending state');
});

