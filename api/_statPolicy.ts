import { claimBlocked, submissionError } from '../src/utils/statRound.ts';

// Evaluate against committed users/settings, never against approvals in an incoming snapshot.
export function validateStatPolicy(base: any, incoming: any): void {
  const settings = base.statUpdateSettings;
  const check = (record: any) => {
    const user = (base.users || []).find((u: any) => record.userId ? u.id === record.userId : u.inGameName === (record.name || record.inGameName));
    if (claimBlocked(user, settings)) throw new Error('STAT_ROUND_REQUIRED');
  };
  for (const key of ['vaultItems', 'generalItems', 'queueItems']) {
    for (const item of incoming[key] || []) {
      const old = (base[key] || []).find((v: any) => v.id === item.id);
      for (const c of item.claimants || []) if (!(old?.claimants || []).some((v: any) => v.userId === c.userId)) check(c);
      if (item.distributedTo && (!old?.distributedTo || item.distributedTo.userId !== old.distributedTo.userId || item.distributedTo.name !== old.distributedTo.name || item.distributedTo.distributedAt !== old.distributedTo.distributedAt)) check(typeof item.distributedTo === 'string' ? { name: item.distributedTo } : item.distributedTo);
      if (item.status === 'distributed' && old?.status !== 'distributed' && !item.distributedTo) check({});
      for (const q of item.queueList || []) {
        const previous = (old?.queueList || []).find((v: any) => v.id === q.id);
        if (!previous || q.userId !== previous.userId || q.name !== previous.name || Number(q.requestedQuantity || 0) > Number(previous.requestedQuantity || 0) || Number(q.receivedQuantity || 0) > Number(previous.receivedQuantity || 0) || (['received', 'completed'].includes(q.status) && previous.status !== q.status)) check(q);
      }
      for (const receipt of item.receiptHistory || []) {
        const previous = (old?.receiptHistory || []).find((v: any) => v.id === receipt.id);
        if (!previous || receipt.userId !== previous.userId || receipt.name !== previous.name || Number(receipt.quantity || 0) > Number(previous.quantity || 0) || receipt.deliveredAt !== previous.deliveredAt) check(receipt);
      }
    }
  }
  for (const user of incoming.users || []) {
    const old = (base.users || []).find((u: any) => u.id === user.id);
    if (!old || !user.pendingPowerLevelRequestedAt || user.pendingPowerLevelRequestedAt <= Number(old.pendingPowerLevelRequestedAt || 0)) continue;
    if (user.pendingPowerLevelRequestedAt <= Math.max(old.statApprovalAt || 0, old.statRejectionAt || 0)) continue;
    const error = submissionError(old, user, settings);
    if (error) throw new Error(error);
  }
}
