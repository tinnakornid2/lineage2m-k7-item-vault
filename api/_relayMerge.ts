// Shared merge used inside the central store transaction and local relay.
export const sanitizeAndDeduplicateUsers = (users: any[], deletedUsers?: Record<string, number>): any[] => {
    const seen = new Set<string>();
    const cleanUsers: any[] = [];
    let canonicalEloni: any = null;

    for (const rawU of users || []) {
      if (!rawU || !rawU.id) continue;
      let u = { ...rawU };
      if (u.id === 'APsCZzEI4tYdx5UfHuY5Sw10L8B3' || u.isAuthShadow) continue;
      if (u.status === 'shadow' || u.status === 'deleted') continue;

      const isEloni =
        u.id === 'user_owner_eloni' ||
        u.username?.trim().toLowerCase() === 'eloni' ||
        u.inGameName?.trim().toLowerCase() === 'eloni';

      // Sever and drop any ghost accounts from old legacy database (e.g. PlakZ with user_1789...)
      if (!isEloni) {
        if (!u.username || u.username === 'undefined' || u.id === 'user_1789510684345_w0x45' || u.id.startsWith('user_1789')) {
          continue;
        }
      }

      if (deletedUsers && deletedUsers[u.id]) {
        const uRev = Number(u.updatedAt || u.createdAt || 0);
        if (uRev <= deletedUsers[u.id]) continue;
      }

      if (isEloni) {
        if (!canonicalEloni) {
          canonicalEloni = {
            ...u,
            id: 'user_owner_eloni',
            username: 'Eloni',
            inGameName: 'Eloni',
            role: 'owner',
            status: 'active'
          };
        } else {
          const curRev = Number(canonicalEloni.updatedAt || canonicalEloni.createdAt || 0);
          const uRev = Number(u.updatedAt || u.createdAt || 0);
          if (uRev > curRev) {
            canonicalEloni = {
              ...canonicalEloni,
              ...u,
              id: 'user_owner_eloni',
              username: 'Eloni',
              inGameName: 'Eloni',
              role: 'owner',
              status: 'active'
            };
          }
        }
      } else {
        if (!seen.has(u.id)) {
          seen.add(u.id);
          // If member has no verified statApprovalAt timestamp in the new CLAN-HUB system, ensure stats are fresh/zeroed
          if (!u.statApprovalAt && u.powerLevel && u.powerLevel > 0) {
            u = {
              ...u,
              powerLevel: 0,
              stats: {},
              statHistory: [],
              statApprovalAt: null,
              statRejectionAt: null,
              pendingPowerLevel: null,
              pendingPowerLevelRequestedAt: null,
              pendingStats: null
            };
          }
          cleanUsers.push(u);
        }
      }
    }

    if (canonicalEloni) {
      cleanUsers.unshift(canonicalEloni);
    }
    return cleanUsers;
  };


function normalizeRelayVaultItem(item: any): any {
  if (!item || (!item.distributedTo && item.status !== 'distributed')) return item;
  let dist = item.distributedTo;
  if (typeof dist === 'string') {
    const trimmed = dist.trim();
    if (trimmed.startsWith('{')) {
      try { dist = JSON.parse(trimmed); } catch {}
    }
  }
  const isFree = (Number(item.price) || 0) === 0;
  let effectivePaymentStatus: 'pending' | 'paid' = 'pending';
  if (isFree) {
    effectivePaymentStatus = 'paid';
  } else if (item.paymentStatus === 'paid' || item.paymentStatus === 'pending') {
    effectivePaymentStatus = item.paymentStatus;
  } else if (dist && typeof dist === 'object' && (dist.paymentStatus === 'paid' || dist.paymentStatus === 'pending')) {
    effectivePaymentStatus = dist.paymentStatus;
  }

  const paidAt = item.paidAt ?? (dist && typeof dist === 'object' ? dist.paidAt : undefined);
  const paidBy = item.paidBy ?? (dist && typeof dist === 'object' ? dist.paidBy : undefined);

  if (dist && typeof dist === 'object') {
    dist = {
      ...dist,
      paymentStatus: effectivePaymentStatus,
      ...(effectivePaymentStatus === 'paid' ? {
        ...(paidAt ? { paidAt } : {}),
        ...(paidBy ? { paidBy } : {})
      } : {})
    };
    if (effectivePaymentStatus === 'pending') {
      delete dist.paidAt;
      delete dist.paidBy;
    }
  }

  return {
    ...item,
    status: 'distributed',
    paymentStatus: effectivePaymentStatus,
    ...(effectivePaymentStatus === 'paid' ? {
      ...(paidAt ? { paidAt } : {}),
      ...(paidBy ? { paidBy } : {})
    } : {
      paidAt: undefined,
      paidBy: undefined
    }),
    distributedTo: dist
  };
}

export function mergeRelayData(previousData: any, incoming: any): any {
  const data = structuredClone(incoming);

        const mergeTimestampMaps = (left: any, right: any) => {
          const merged: Record<string, number> = { ...(left || {}) };
          const now = Date.now();
          const maxAge = 14 * 24 * 60 * 60 * 1000;
          for (const [key, value] of Object.entries(right || {})) {
            if (typeof value === 'number' && value > (merged[key] || 0) && (now - value < maxAge)) {
              merged[key] = value;
            }
          }
          for (const [k, v] of Object.entries(merged)) {
            if (typeof v !== 'number' || now - v >= maxAge) delete merged[k];
          }
          return merged;
        };
        const syncMeta = {
          deletedVaultItems: mergeTimestampMaps(previousData.syncMeta?.deletedVaultItems, data.syncMeta?.deletedVaultItems),
          deletedQueueItems: mergeTimestampMaps(previousData.syncMeta?.deletedQueueItems, data.syncMeta?.deletedQueueItems),
          deletedGeneralItems: mergeTimestampMaps(previousData.syncMeta?.deletedGeneralItems, data.syncMeta?.deletedGeneralItems),
          deletedUsers: mergeTimestampMaps(previousData.syncMeta?.deletedUsers, data.syncMeta?.deletedUsers),
          cancelledClaims: mergeTimestampMaps(previousData.syncMeta?.cancelledClaims, data.syncMeta?.cancelledClaims),
          removedQueueMembers: mergeTimestampMaps(previousData.syncMeta?.removedQueueMembers, data.syncMeta?.removedQueueMembers)
        };

        const mergeVersionedRecords = (previous: any[], incoming: any[], deleted: Record<string, number>, mergeClaims = false, mergeQueue = false) => {
          const records = new Map<string, any>();
          for (const record of [...(previous || []), ...(incoming || [])]) {
            if (!record?.id) continue;
            const recordRevision = Number(record.updatedAt || record.createdAt || 0);
            const deletedAt = deleted ? (deleted[record.id] || 0) : 0;
            if (deletedAt && recordRevision <= deletedAt) {
              continue;
            }
            const existing = records.get(record.id);
            const existingRevision = Number(existing?.updatedAt || existing?.createdAt || 0);
            if (!existing) {
              records.set(record.id, mergeClaims ? normalizeRelayVaultItem(record) : record);
              continue;
            }
            let newest = recordRevision >= existingRevision ? { ...existing, ...record } : { ...record, ...existing };
            const older = recordRevision >= existingRevision ? existing : record;

            // Smart user pending stat preservation
            if (newest.pendingPowerLevel !== undefined || older.pendingPowerLevel !== undefined) {
              const newestPendingTime = Number(newest.pendingPowerLevelRequestedAt || newest.updatedAt || 0);
              const olderPendingTime = Number(older.pendingPowerLevelRequestedAt || older.updatedAt || 0);
              const newestResTime = Math.max(Number(newest.statApprovalAt || 0), Number(newest.statRejectionAt || 0));
              const olderResTime = Math.max(Number(older.statApprovalAt || 0), Number(older.statRejectionAt || 0));
              const latestRes = Math.max(newestResTime, olderResTime);

              const olderHasPending = Boolean((typeof older.pendingPowerLevel === 'number' || older.pendingPowerLevelRequestedAt || older.pendingStatScreenshotUrl) && olderPendingTime > latestRes);
              const newestHasPending = Boolean((typeof newest.pendingPowerLevel === 'number' || newest.pendingPowerLevelRequestedAt || newest.pendingStatScreenshotUrl) && newestPendingTime > latestRes);

              if (olderHasPending && (!newestHasPending || olderPendingTime > newestPendingTime)) {
                newest = {
                  ...newest,
                  pendingPowerLevel: older.pendingPowerLevel,
                  pendingPowerLevelRequestedAt: older.pendingPowerLevelRequestedAt,
                  pendingStats: older.pendingStats || newest.pendingStats,
                  pendingSpiritEnhancements: older.pendingSpiritEnhancements || newest.pendingSpiritEnhancements,
                  pendingStatScreenshotUrl: older.pendingStatScreenshotUrl || newest.pendingStatScreenshotUrl,
                  pendingClasses: older.pendingClasses ?? newest.pendingClasses,
                  pendingLevel: older.pendingLevel ?? newest.pendingLevel,
                  pendingLegendClasses: older.pendingLegendClasses ?? newest.pendingLegendClasses,
                  pendingLegendAgathions: older.pendingLegendAgathions ?? newest.pendingLegendAgathions,
                  statRejectionReason: null,
                  statRejectionAt: null
                };
              }
            }

            if (mergeClaims) {
              const claimantMap = new Map<string, any>();
              for (const claimant of [...(older.claimants || []), ...(newest.claimants || [])]) {
                const key = claimant.userId || String(claimant.inGameName || '').trim().toLowerCase();
                if (key) claimantMap.set(key, claimant);
              }
              newest = normalizeRelayVaultItem({ ...newest, claimants: Array.from(claimantMap.values()) });
            }

            if (mergeQueue) {
              const queueMap = new Map<string, any>();
              const removedMap = syncMeta.removedQueueMembers || {};
              const isMemberRemoved = (m: any) => {
                if (!m) return true;
                const joinedAt = Number(m.joinedAt || 0);
                const directId = m.id ? `${record.id}:::${m.id}` : null;
                const legacyDirectId = m.id ? `${record.id}_${m.id}` : null;
                const userKey = m.userId ? `${record.id}:::${String(m.userId).trim().toLowerCase()}` : null;
                const legacyUserKey = m.userId ? `${record.id}_user_${m.userId}` : null;
                const nameKey = m.name ? `${record.id}:::${String(m.name).trim().toLowerCase()}` : null;
                const legacyNameKey = m.name ? `${record.id}_name_${String(m.name).trim().toLowerCase()}` : null;

                const removedAt = Math.max(
                  directId ? (removedMap[directId] || 0) : 0,
                  legacyDirectId ? (removedMap[legacyDirectId] || 0) : 0,
                  userKey ? (removedMap[userKey] || 0) : 0,
                  legacyUserKey ? (removedMap[legacyUserKey] || 0) : 0,
                  nameKey ? (removedMap[nameKey] || 0) : 0,
                  legacyNameKey ? (removedMap[legacyNameKey] || 0) : 0
                );

                if (!removedAt) return false;
                if (joinedAt && joinedAt > removedAt) return false;
                return true;
              };

              const newestMembers = Array.isArray(newest.queueList) ? newest.queueList : [];
              const olderMembers = Array.isArray(older.queueList) ? older.queueList : [];

              for (const m of newestMembers) {
                if (!m || isMemberRemoved(m)) continue;
                const key = m.id || m.userId || String(m.name || '').trim().toLowerCase();
                if (key) queueMap.set(key, m);
              }

              // Only include members from older if they were concurrently added very recently (within 10s) and not removed
              const timeWindow = 10000;
              for (const m of olderMembers) {
                if (!m || isMemberRemoved(m)) continue;
                const key = m.id || m.userId || String(m.name || '').trim().toLowerCase();
                if (!key || queueMap.has(key)) continue;
                const joinedAt = Number(m.joinedAt || 0);
                if (joinedAt && (Date.now() - joinedAt) <= timeWindow) {
                  queueMap.set(key, m);
                }
              }

              const receiptMap = new Map<string, any>();
              for (const r of [...(older.receiptHistory || []), ...(newest.receiptHistory || [])]) {
                if (r && r.id) receiptMap.set(r.id, r);
              }
              newest = {
                ...newest,
                queueList: Array.from(queueMap.values()),
                receiptHistory: Array.from(receiptMap.values())
              };
            }

            records.set(record.id, newest);
          }
          return Array.from(records.values());
        };

        data.syncMeta = syncMeta;

        if (data.isReset) {
          data.vaultItems = Array.isArray(data.vaultItems) ? data.vaultItems : [];
          data.queueItems = Array.isArray(data.queueItems) ? data.queueItems : [];
          data.generalItems = Array.isArray(data.generalItems) ? data.generalItems : [];
          data.quickItems = Array.isArray(data.quickItems) ? data.quickItems : [];
          data.diamondLogs = Array.isArray(data.diamondLogs) ? data.diamondLogs : [];
          data.vaultBalance = 0;
          data.users = sanitizeAndDeduplicateUsers(Array.isArray(data.users) && data.users.length > 0 ? data.users : []);
        } else {
          if (Array.isArray(data.vaultItems) && data.vaultItems.length > 0) {
            data.vaultItems = mergeVersionedRecords(previousData.vaultItems, data.vaultItems, syncMeta.deletedVaultItems, true);
          } else {
            data.vaultItems = previousData.vaultItems || [];
          }

          if (Array.isArray(data.queueItems) && data.queueItems.length > 0) {
            data.queueItems = mergeVersionedRecords(previousData.queueItems, data.queueItems, syncMeta.deletedQueueItems, false, true);
          } else {
            data.queueItems = previousData.queueItems || [];
          }

          if (Array.isArray(data.generalItems) && data.generalItems.length > 0) {
            data.generalItems = mergeVersionedRecords(previousData.generalItems, data.generalItems, syncMeta.deletedGeneralItems || {}, false, true);
          } else {
            data.generalItems = previousData.generalItems || [];
          }

          if (Array.isArray(data.users) && data.users.length > 0) {
            data.users = mergeVersionedRecords(previousData.users, data.users, syncMeta.deletedUsers);
          } else {
            data.users = previousData.users || [];
          }
        }

        if (Array.isArray(data.diamondLogs)) {
          if (data.diamondLogs.length === 0 && (data.isReset)) {
            data.diamondLogs = [];
            data.vaultBalance = 0;
          } else if (data.diamondLogs.length > 0) {
            const dlogMap = new Map<string, any>();
            for (const log of data.diamondLogs) {
              if (log && log.id) dlogMap.set(log.id, log);
            }
            data.diamondLogs = Array.from(dlogMap.values());
          } else {
            data.diamondLogs = previousData.diamondLogs || [];
          }
        } else if (previousData.diamondLogs) {
          data.diamondLogs = previousData.diamondLogs;
          if (data.vaultBalance === undefined) {
            data.vaultBalance = previousData.vaultBalance || 0;
          }
        }

        // Strict tombstone filtering after merge (only drop if record revision <= tombstone timestamp)
        if (Array.isArray(data.vaultItems)) {
          data.vaultItems = data.vaultItems.filter((it: any) => {
            if (!it || !it.id) return false;
            const delAt = syncMeta.deletedVaultItems?.[it.id];
            if (!delAt) return true;
            const rev = Number(it.updatedAt || it.createdAt || 0);
            return rev > delAt;
          });
        }
        if (Array.isArray(data.queueItems)) {
          data.queueItems = data.queueItems.filter((it: any) => {
            if (!it || !it.id) return false;
            const delAt = syncMeta.deletedQueueItems?.[it.id];
            if (!delAt) return true;
            const rev = Number(it.updatedAt || it.createdAt || 0);
            return rev > delAt;
          });
        }
        if (Array.isArray(data.generalItems)) {
          data.generalItems = data.generalItems.filter((it: any) => {
            if (!it || !it.id) return false;
            const delAt = syncMeta.deletedGeneralItems?.[it.id];
            if (!delAt) return true;
            const rev = Number(it.updatedAt || it.createdAt || 0);
            return rev > delAt;
          });
        }
        if (Array.isArray(data.users)) {
          data.users = sanitizeAndDeduplicateUsers(data.users, syncMeta.deletedUsers);
        }

        // Scrub removed members from all queueLists
        const filterQueueList = (item: any) => {
          if (!item || !Array.isArray(item.queueList)) return item;
          const removedMap = syncMeta.removedQueueMembers || {};
          const filteredQueue = item.queueList.filter((m: any) => {
            if (!m) return false;
            const joinedAt = Number(m.joinedAt || 0);
            const directId = m.id ? `${item.id}:::${m.id}` : null;
            const legacyDirectId = m.id ? `${item.id}_${m.id}` : null;
            const userKey = m.userId ? `${item.id}:::${String(m.userId).trim().toLowerCase()}` : null;
            const legacyUserKey = m.userId ? `${item.id}_user_${m.userId}` : null;
            const nameKey = m.name ? `${item.id}:::${String(m.name).trim().toLowerCase()}` : null;
            const legacyNameKey = m.name ? `${item.id}_name_${String(m.name).trim().toLowerCase()}` : null;

            const removedAt = Math.max(
              directId ? (removedMap[directId] || 0) : 0,
              legacyDirectId ? (removedMap[legacyDirectId] || 0) : 0,
              userKey ? (removedMap[userKey] || 0) : 0,
              legacyUserKey ? (removedMap[legacyUserKey] || 0) : 0,
              nameKey ? (removedMap[nameKey] || 0) : 0,
              legacyNameKey ? (removedMap[legacyNameKey] || 0) : 0
            );

            if (!removedAt) return true;
            return joinedAt > removedAt;
          });
          return { ...item, queueList: filteredQueue };
        };
        if (Array.isArray(data.queueItems)) {
          data.queueItems = data.queueItems.map(filterQueueList);
        }
        if (Array.isArray(data.generalItems)) {
          data.generalItems = data.generalItems.map(filterQueueList);
        }

        if (Array.isArray(data.users)) {
          data.users = data.users.map((u: any) => {
            if (!u || typeof u !== 'object') return u;
            return u;
          });
        }
        if (Array.isArray(data.vaultItems)) {
          data.vaultItems = data.vaultItems.map((item: any) => {
            const claimants = (item.claimants || []).filter((claimant: any) => {
              const claimedAt = Number(claimant.claimedAt || 0);
              const userKey = claimant.userId ? `${item.id}:::${String(claimant.userId).trim().toLowerCase()}` : '';
              const nameKey = claimant.inGameName ? `${item.id}:::${String(claimant.inGameName).trim().toLowerCase()}` : '';
              return !(
                (userKey && claimedAt <= (syncMeta.cancelledClaims[userKey] || 0)) ||
                (nameKey && claimedAt <= (syncMeta.cancelledClaims[nameKey] || 0))
              );
            });
            if (item && item.distributedTo && (item.distributedTo.name || item.distributedTo.userId)) {
              return { ...item, claimants, status: 'distributed' };
            }
            return { ...item, claimants };
          });
        }

  return { ...previousData, ...data };
}

