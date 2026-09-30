export interface RelayActor { uid: string; role: string }
const ADMIN = ['owner', 'admin'];
const PENDING_FIELDS = ['pendingPowerLevel', 'pendingPowerLevelRequestedAt', 'pendingStats',
  'pendingSpiritEnhancements', 'pendingStatScreenshotUrl', 'pendingClasses', 'pendingLevel',
  'pendingLegendClasses', 'pendingLegendAgathions'];

// Clients send full snapshots. Only take the fields this authenticated actor may change.
export function scopeRelayInput(base: any, incoming: any, actor: RelayActor): any {
  if (incoming.isReset && actor.role !== 'owner') throw new Error('FORBIDDEN_RESET');
  if (ADMIN.includes(actor.role)) {
    const data = structuredClone(incoming);
    data.users = (data.users || []).map((user: any) => {
      const existing = (base.users || []).find((u: any) => u.id === user.id);
      const owner = existing?.role === 'owner' || user.id === 'user_owner_eloni';
      if (owner) return existing ? { ...existing, ...(actor.role === 'owner' ? user : {}), role: 'owner', status: 'active' } : undefined;
      if (actor.role === 'admin' && (existing?.role === 'admin' || user.role === 'owner' || user.role === 'admin')) return existing;
      return user;
    }).filter(Boolean);
    const deleted = { ...(data.syncMeta?.deletedUsers || {}) };
    for (const user of base.users || []) {
      if (user.role === 'owner' || user.id === 'user_owner_eloni' || (actor.role === 'admin' && user.role === 'admin')) delete deleted[user.id];
    }
    data.syncMeta = { ...data.syncMeta, deletedUsers: deleted };
    return data;
  }
  const existing = (base.users || []).find((u: any) => u.id === actor.uid);
  const submitted = (incoming.users || []).find((u: any) => u.id === actor.uid);
  if (!existing) {
    if (!submitted || typeof submitted.username !== 'string' || typeof submitted.inGameName !== 'string') throw new Error('PROFILE_REQUIRED');
    const username = submitted.username.trim();
    const name = submitted.inGameName.trim();
    if (username.length < 3 || username.length > 40 || !name || name.length > 60 || ['eloni', 'owner'].includes(username.toLowerCase()) || name.toLowerCase() === 'eloni') throw new Error('INVALID_PROFILE');
    if ((base.users || []).some((u: any) => u.username?.toLowerCase() === username.toLowerCase() || u.inGameName?.toLowerCase() === name.toLowerCase())) throw new Error('USERNAME_IN_USE');
    return { users: [{ id: actor.uid, username, inGameName: name, clan: 'no-clan', characterClass: '',
      role: 'member', status: 'pending_approval', powerLevel: 0, createdAt: Date.now(), updatedAt: Date.now() }] };
  }
  if (existing.status !== 'active') return { users: [existing] };
  const data: any = { users: [existing] };
  if (submitted) {
    const pending: any = {};
    for (const key of PENDING_FIELDS) if (submitted[key] !== undefined) pending[key] = submitted[key];
    data.users = [{ ...existing, ...pending, updatedAt: submitted.updatedAt || existing.updatedAt }];
  }
  data.vaultItems = (incoming.vaultItems || []).flatMap((item: any) => {
    const old = (base.vaultItems || []).find((v: any) => v.id === item.id);
    if (!old || old.status === 'distributed' || old.distributedTo || Number(old.minPowerLevel || 0) > Number(existing.powerLevel || 0)) return [];
    const own = (item.claimants || []).filter((c: any) => c.userId === actor.uid).map((c: any) => ({
      userId: actor.uid, inGameName: existing.inGameName, clan: existing.clan,
      powerLevel: existing.powerLevel || 0, claimedAt: c.claimedAt || Date.now()
    }));
    return [{ ...old, claimants: [...(old.claimants || []).filter((c: any) => c.userId !== actor.uid), ...own], updatedAt: item.updatedAt || old.updatedAt }];
  });
  for (const key of ['generalItems', 'queueItems']) {
    data[key] = (incoming[key] || []).flatMap((item: any) => {
      const old = (base[key] || []).find((v: any) => v.id === item.id);
      if (!old || old.allowMemberQueue === false || Number(old.minPowerLevel || 0) > Number(existing.powerLevel || 0)) return [];
      const own = (item.queueList || []).filter((m: any) => m.userId === actor.uid).map((m: any) => {
        const previous = (old.queueList || []).find((q: any) => q.userId === actor.uid);
        return previous || { ...m, name: existing.inGameName, clan: existing.clan, powerLevel: existing.powerLevel || 0,
          status: 'pending', receivedQuantity: 0 };
      });
      return [{ ...old, queueList: [...(old.queueList || []).filter((m: any) => m.userId !== actor.uid), ...own], updatedAt: item.updatedAt || old.updatedAt }];
    });
  }
  data.syncMeta = {};
  for (const field of ['cancelledClaims', 'removedQueueMembers']) {
    data.syncMeta[field] = Object.fromEntries(Object.entries(incoming.syncMeta?.[field] || {}).filter(([key]) =>
      key.endsWith(':::' + actor.uid.toLowerCase()) || key.endsWith(':::' + existing.inGameName.toLowerCase())));
  }
  return data;
}
