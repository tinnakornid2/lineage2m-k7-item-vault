import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { claimBlocked, submissionError, statMessage } from '../src/utils/statRound.ts';
import { scopeRelayInput } from '../api/_relayAccess.ts';
import { validateStatPolicy } from '../api/_statPolicy.ts';
import { createApp } from '../api/_server.ts';

const settings = { allowMemberUpdates: true, round: { id: 'r1', active: true, openedAt: 100, enforceAt: 200 } };
const member = { id: 'member-1', username: 'member', inGameName: 'Member', role: 'member', status: 'active',
  clan: 'K7', powerLevel: 10, statApprovalAt: 50, stats: { damage: 10 }, level: 80, classes: ['Orb'], statScreenshotUrl: 'old-image' };
const submission = { ...member, pendingStats: { damage: 10 }, pendingLevel: 80, pendingClasses: ['Orb'], pendingStatScreenshotUrl: 'new-image' };

test('deadline, current-round approval, old pending approval, and closed round', () => {
  assert.equal(claimBlocked(member, settings, 199), false);
  assert.equal(claimBlocked(member, settings, 200), true);
  assert.equal(claimBlocked({ ...member, statApprovalAt: 300, approvedStatRequestAt: 99 }, settings, 300), true);
  assert.equal(claimBlocked({ ...member, statApprovalAt: 300, approvedStatRequestAt: 100 }, settings, 300), false);
  assert.equal(claimBlocked(member, { ...settings, round: { ...settings.round, active: false } }, 300), false);
});

test('duplicates ignore map ordering and zero entries, new round requires fresh proof', () => {
  assert.equal(submissionError(member, submission), 'UNCHANGED_STATS');
  assert.equal(submissionError(member, { ...submission, pendingStats: { defense: 0, damage: 10 } }), 'UNCHANGED_STATS');
  assert.equal(submissionError(member, { ...submission, pendingStats: { damage: 11 } }), null);
  assert.equal(submissionError(member, submission, settings), null);
  assert.equal(submissionError(member, { ...submission, pendingStatScreenshotUrl: 'old-image' }, settings), 'ROUND_SCREENSHOT_REQUIRED');
  const pending = { ...submission, pendingPowerLevel: 10, pendingPowerLevelRequestedAt: 110 };
  assert.equal(submissionError(pending, submission, settings), 'DUPLICATE_PENDING');
  assert.equal(submissionError({ ...pending, statRejectionAt: 120 }, submission, settings), null);
  for (const code of ['UNCHANGED_STATS', 'DUPLICATE_PENDING', 'ROUND_SCREENSHOT_REQUIRED', 'STAT_ROUND_REQUIRED']) {
    assert.match(statMessage(code, 'th'), /[ก-๙]/);
    assert.doesNotMatch(statMessage(code, 'en'), /[ก-๙]/);
  }
});

test('all item channels enforce round; old queues retained; approved recipient allowed', () => {
  const base = { users: [member], statUpdateSettings: settings };
  const q = { id: 'q1', userId: member.id, name: member.inGameName, receivedQuantity: 0, requestedQuantity: 1, status: 'pending' };
  for (const key of ['generalItems', 'queueItems']) {
    assert.throws(() => validateStatPolicy(base, { [key]: [{ id: 'item', queueList: [q] }] }), /STAT_ROUND_REQUIRED/);
    const existing = { ...base, [key]: [{ id: 'item', queueList: [q] }] };
    assert.doesNotThrow(() => validateStatPolicy(existing, { [key]: existing[key] }));
    for (const changes of [{ receivedQuantity: 1 }, { status: 'received' }, { requestedQuantity: 2 }]) {
      assert.throws(() => validateStatPolicy(existing, { [key]: [{ id: 'item', queueList: [{ ...q, ...changes }] }] }), /STAT_ROUND_REQUIRED/);
    }
  }
  for (const item of [{ claimants: [{ userId: member.id }] }, { distributedTo: { userId: member.id } }, { receiptHistory: [{ id: 'receipt', userId: member.id }] }]) {
    assert.throws(() => validateStatPolicy(base, { vaultItems: [{ id: 'item', ...item }] }), /STAT_ROUND_REQUIRED/);
  }
  const approved = { ...base, users: [{ ...member, statApprovalAt: 300, approvedStatRequestAt: 110 }] };
  assert.doesNotThrow(() => validateStatPolicy(approved, { generalItems: [{ id: 'item', queueList: [q] }] }));
});

test('member cannot self approve; generic snapshots cannot inject or replace pending values', () => {
  const base = { users: [member], statUpdateSettings: settings };
  const result = scopeRelayInput(base, { users: [{ ...submission, statApprovalAt: 300, approvedStatRequestAt: 110, pendingPowerLevelRequestedAt: 110 }] }, { uid: member.id, role: 'member' });
  assert.equal(result.users[0].statApprovalAt, 50);
  assert.equal(result.users[0].approvedStatRequestAt, undefined);
  assert.equal(result.users[0].pendingPowerLevelRequestedAt, undefined);
});

test('local API: open round, block claim, submit once, approve, claim, reopen, close', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'k7-stat-round-'));
  const actor = { uid: 'test-owner', role: 'owner' };
  const app = await createApp({ serveFrontend: false, isolatedTest: true, dataDir, testActor: actor });
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const post = async (route, data) => {
    const response = await fetch(url + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    return { status: response.status, ...await response.json() };
  };
  try {
    assert.equal((await post('/api/live-state', { data: { users: [member], vaultItems: [{ id: 'item', name: 'Sword', status: 'available', claimants: [], updatedAt: Date.now() }] } })).success, true);
    const opened = await post('/api/stat-round', { enforceAt: Date.now() - 1 });
    assert.equal(opened.success, true);
    const claim = () => post('/api/claim-vault-item', { itemId: 'item', claimant: { userId: member.id } });
    assert.equal((await claim()).error, 'STAT_ROUND_REQUIRED');
    actor.uid = member.id; actor.role = 'member';
    assert.equal((await post('/api/stat-round', { enforceAt: Date.now() })).status, 403);
    assert.equal((await post('/api/stat-update-settings', { allowMemberUpdates: false })).status, 403);
    const updates = { pendingStats: { damage: 10 }, pendingPowerLevel: 10, pendingLevel: 80, pendingClasses: ['Orb'], pendingStatScreenshotUrl: 'new-image' };
    const saved = await post('/api/request-stat-update', { userId: member.id, updates });
    assert.equal(saved.success, true, JSON.stringify(saved));
    assert.ok(saved.requestedAt >= opened.settings.round.openedAt);
    assert.equal((await post('/api/request-stat-update', { userId: member.id, updates })).error, 'DUPLICATE_PENDING');
    assert.equal((await claim()).error, 'STAT_ROUND_REQUIRED');
    actor.uid = 'test-owner'; actor.role = 'owner';
    assert.equal((await post('/api/update-user-stats', { userId: member.id, updates: {
      stats: { damage: 10 }, powerLevel: 10, statScreenshotUrl: 'new-image', statApprovalAt: Date.now(), approvedStatRequestAt: saved.requestedAt,
      pendingPowerLevel: null, pendingPowerLevelRequestedAt: null, pendingStats: null, pendingStatScreenshotUrl: null
    } })).success, true);
    assert.equal((await claim()).success, true);
    assert.equal((await post('/api/request-stat-update', { userId: member.id, updates })).error, 'UNCHANGED_STATS');
    assert.equal((await post('/api/stat-round', { enforceAt: Date.now() - 1 })).success, true);
    assert.equal((await claim()).error, 'STAT_ROUND_REQUIRED');
    assert.equal((await post('/api/stat-round', { close: true })).success, true);
    assert.equal((await claim()).success, true);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(dataDir, { recursive: true, force: true });
  }
});
