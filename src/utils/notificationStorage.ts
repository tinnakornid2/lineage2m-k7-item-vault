// Read/dismiss state is private to each signed-in account on this device.
export function notificationStorageKey(kind: 'read' | 'dismissed', userId?: string): string {
  return `l2m_${kind}_notifications:${userId || 'guest'}`;
}

export function loadNotificationIds(kind: 'read' | 'dismissed', userId?: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(notificationStorageKey(kind, userId)) || '[]');
    return Array.isArray(value) ? value.filter(id => typeof id === 'string') : [];
  } catch { return []; }
}

export function saveNotificationIds(kind: 'read' | 'dismissed', ids: string[], userId?: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(notificationStorageKey(kind, userId), JSON.stringify(ids));
    }
  } catch {}
}
