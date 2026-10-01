/**
 * 🛡️ Central API & Unified Cloud Synchronization Engine (v2.10.73)
 * Provides authenticated communication with serverless backend endpoints,
 * concurrency-safe reference counting, cross-tab atomic token-election mutex locks,
 * persistent client operation IDs, origin session-bound outbox queueing,
 * and robust error classification (Business Rejections vs 503/Transient/Timeouts).
 */

export type SyncStatusState = 'synced' | 'syncing' | 'local' | 'retry';

export interface SyncStatusInfo {
  state: SyncStatusState;
  lastSyncedAt: number;
  pendingCount: number;
  error?: string;
}

export interface CentralApiError extends Error {
  isBusinessError?: boolean;
  isNetworkError?: boolean;
  isQueued?: boolean;
  code?: string;
}

export interface OutboxItem {
  id: string; // Persistent Client Operation ID (never changes across retries!)
  path: string;
  method: string;
  body?: string;
  userId?: string;
  inGameName?: string;
  createdAt: number;
  retries: number;
  lastError?: string;
}

let currentSyncStatus: SyncStatusInfo = {
  state: 'synced',
  lastSyncedAt: Date.now(),
  pendingCount: 0
};

let activeRequestsCount = 0;

const listeners = new Set<(status: SyncStatusInfo) => void>();

export function getSyncStatus(): SyncStatusInfo {
  return currentSyncStatus;
}

export function setSyncStatus(state: SyncStatusState, error?: string): void {
  // Guard 1: Never report 'synced' if browser is offline
  if (state === 'synced' && typeof navigator !== 'undefined' && !navigator.onLine) {
    state = 'local';
    error = 'Offline - changes saved locally';
  }
  // Guard 2: Never report 'synced' if there are active in-flight requests
  else if (state === 'synced' && activeRequestsCount > 0) {
    state = 'syncing';
  }
  // Guard 3: If outbox has pending items, show 'local' (or 'retry' if error)
  else if (state === 'synced' && getOutboxCount() > 0) {
    state = typeof navigator !== 'undefined' && !navigator.onLine ? 'local' : 'retry';
  }

  currentSyncStatus = {
    state,
    lastSyncedAt: state === 'synced' ? Date.now() : currentSyncStatus.lastSyncedAt,
    pendingCount: state === 'syncing' ? Math.max(1, activeRequestsCount) : (state === 'local' ? getOutboxCount() : 0),
    error
  };

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('k7-sync-status', { detail: currentSyncStatus }));
    window.dispatchEvent(new CustomEvent('k7-central-sync', { detail: { success: state === 'synced' } }));
  }

  listeners.forEach((fn) => {
    try { fn(currentSyncStatus); } catch {}
  });
}

export function subscribeSyncStatus(callback: (status: SyncStatusInfo) => void): () => void {
  listeners.add(callback);
  callback(currentSyncStatus);
  return () => {
    listeners.delete(callback);
  };
}

export function reportCentralSync(success: boolean) {
  if (success) {
    if (activeRequestsCount === 0 && getOutboxCount() === 0) {
      setSyncStatus('synced');
    }
  } else {
    setSyncStatus('retry');
  }
}

// Token provider to decouple firebase.ts circular imports
let tokenProvider: (() => Promise<string | null>) | null = null;
export function setTokenProvider(provider: () => Promise<string | null>): void {
  tokenProvider = provider;
}

// Session provider to share identical session user as firebase.ts
let sessionProvider: (() => { id?: string; inGameName?: string; username?: string } | null) | null = null;
export function setSessionProvider(
  provider: () => { id?: string; inGameName?: string; username?: string } | null
): void {
  sessionProvider = provider;
}

// -------------------------------------------------------------
// User-Scoped Offline Outbox & Persistent Mutation Queue
// -------------------------------------------------------------
const OUTBOX_STORAGE_KEY = 'k7_api_outbox_queue_v1';
const SESSION_STORAGE_KEY = 'clanhub_session_user_v21028';
const LEGACY_SESSION_STORAGE_KEY = 'clanhub_logged_user_v21028';

export function getActiveUserSession(): { id?: string; inGameName?: string } {
  if (sessionProvider) {
    try {
      const s = sessionProvider();
      if (s && s.id) {
        return { id: s.id, inGameName: s.inGameName || s.username };
      }
    } catch {}
  }
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY) || localStorage.getItem(LEGACY_SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.id) {
        return { id: parsed.id, inGameName: parsed.inGameName || parsed.username };
      }
    }
  } catch {}
  return {};
}

export function loadOutbox(): OutboxItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OUTBOX_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOutbox(items: OutboxItem[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(items.slice(-300)));
    return true;
  } catch (err) {
    console.error('Failed to save outbox to localStorage (quota exceeded?):', err);
    return false;
  }
}

export function getOutboxCount(): number {
  return loadOutbox().length;
}

function notifyOutboxPermanentFailure(item: OutboxItem, reason: string): void {
  console.error(`Outbox operation ${item.id} (${item.path}) permanently failed:`, reason);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('k7-outbox-failed', {
        detail: { item, reason }
      })
    );
  }
}

/**
 * Helper to extract or generate a persistent Client Operation ID
 * Stored in headers so retries keep the EXACT same ID across the entire lifecycle.
 */
export function getOrGenerateClientOpId(init: RequestInit): string {
  const headers = (init.headers || {}) as Record<string, string>;
  const existing = headers['X-Client-Op-Id'] || headers['x-client-op-id'];
  if (existing) return existing;
  const generated = `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  init.headers = {
    ...headers,
    'X-Client-Op-Id': generated
  };
  return generated;
}

/**
 * Cross-tab atomic mutex lock for ALL outbox queue mutations (both enqueue and drain)
 * Prevents tab collisions, stale overwrites, and race conditions.
 */
export async function runAtomicOutboxMutation<T>(
  mutationFn: (currentItems: OutboxItem[]) => { nextItems: OutboxItem[]; result: T }
): Promise<T> {
  const LOCK_NAME = 'k7_outbox_queue_lock';

  // 1. Modern Web Locks API (Queues multiple tabs in FIFO order)
  if (typeof navigator !== 'undefined' && 'locks' in navigator && (navigator as any).locks?.request) {
    return await (navigator as any).locks.request(LOCK_NAME, async () => {
      const current = loadOutbox();
      const { nextItems, result } = mutationFn(current);
      const saved = saveOutbox(nextItems);
      if (!saved) {
        throw new Error('STORAGE_WRITE_FAILED');
      }
      return result;
    });
  }

  // 2. Fallback: Token-election LocalStorage mutex lock with auto-expiration and read-back verification
  if (typeof window === 'undefined') {
    const { result } = mutationFn([]);
    return result;
  }

  const LOCK_TOKEN_KEY = 'k7_outbox_queue_lock_tok';
  const LOCK_EXP_KEY = 'k7_outbox_queue_lock_exp';
  const candidateToken = `tok_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const TTL_MS = 8000;
  const maxWaitAt = Date.now() + 6000;
  let lockAcquired = false;

  while (Date.now() < maxWaitAt) {
    const now = Date.now();
    const currentExp = Number(localStorage.getItem(LOCK_EXP_KEY) || 0);

    if (!currentExp || now > currentExp) {
      localStorage.setItem(LOCK_TOKEN_KEY, candidateToken);
      localStorage.setItem(LOCK_EXP_KEY, String(now + TTL_MS));

      // Jitter spin check (20-40ms) to detect simultaneous tab writes
      await new Promise((r) => setTimeout(r, 20 + Math.random() * 20));

      // Read-back verification: only the tab whose token won the write holds the lock!
      if (localStorage.getItem(LOCK_TOKEN_KEY) === candidateToken) {
        lockAcquired = true;
        break;
      }
    }

    await new Promise((r) => setTimeout(r, 35 + Math.random() * 25));
  }

  if (!lockAcquired) {
    throw new Error('MUTEX_LOCK_TIMEOUT_FAILED');
  }

  try {
    const current = loadOutbox();
    const { nextItems, result } = mutationFn(current);
    const saved = saveOutbox(nextItems);
    if (!saved) {
      throw new Error('STORAGE_WRITE_FAILED');
    }
    return result;
  } finally {
    try {
      if (lockAcquired && localStorage.getItem(LOCK_TOKEN_KEY) === candidateToken) {
        localStorage.removeItem(LOCK_TOKEN_KEY);
        localStorage.removeItem(LOCK_EXP_KEY);
      }
    } catch {}
  }
}

/**
 * Enqueue a mutation into local outbox storage with strict user scoping
 * Preserves the exact Client Operation ID and binds to the origin user who started the request.
 * Returns boolean indicating whether mutation was successfully persisted.
 */
export async function enqueueOutbox(
  path: string,
  init: RequestInit,
  clientOpId?: string,
  boundUserId?: string,
  boundInGameName?: string
): Promise<boolean> {
  const method = (init.method || 'POST').toUpperCase();
  if (method === 'GET' || method === 'HEAD') return false;

  const currentSession = getActiveUserSession();
  const effectiveUserId = boundUserId || currentSession.id;
  const effectiveInGameName = boundInGameName || currentSession.inGameName;

  if (!effectiveUserId) {
    console.warn('Cannot enqueue outbox mutation: no active authenticated user session');
    return false;
  }

  const opId = clientOpId || getOrGenerateClientOpId(init);

  try {
    return await runAtomicOutboxMutation((current) => {
      // If already enqueued with identical opId, don't duplicate
      if (current.some((i) => i.id === opId)) {
        return { nextItems: current, result: true };
      }

      // If at capacity (300 items), reject new mutation and alert rather than silently dropping old user data!
      if (current.length >= 300) {
        notifyOutboxPermanentFailure(
          {
            id: opId,
            path,
            method,
            userId: effectiveUserId,
            inGameName: effectiveInGameName,
            createdAt: Date.now(),
            retries: 0
          },
          'Outbox queue storage is full (300 items limit). Please connect to internet to sync before adding more actions.'
        );
        return { nextItems: current, result: false };
      }

      const newItem: OutboxItem = {
        id: opId, // Keep exact same opId!
        path,
        method,
        body: typeof init.body === 'string' ? init.body : undefined,
        userId: effectiveUserId, // Strictly bound to origin user!
        inGameName: effectiveInGameName,
        createdAt: Date.now(),
        retries: 0
      };

      const nextItems = [...current, newItem];
      return { nextItems, result: true };
    });
  } catch (err: any) {
    console.error('enqueueOutbox error:', err);
    return false;
  }
}

/**
 * Cross-tab mutex lock for drainage execution
 */
async function withCrossTabDrainLock(fn: () => Promise<void>): Promise<void> {
  const LOCK_KEY = 'k7_outbox_drain_lock';
  const LOCK_TIMEOUT_MS = 25000;

  // 1. Try modern Web Locks API if available
  if (typeof navigator !== 'undefined' && 'locks' in navigator && (navigator as any).locks?.request) {
    try {
      let executed = false;
      await (navigator as any).locks.request(
        LOCK_KEY,
        { ifAvailable: true },
        async (lock: any) => {
          if (!lock) {
            // Another tab is actively draining the queue right now
            return;
          }
          executed = true;
          await fn();
        }
      );
      if (executed) return;
      return;
    } catch {
      // Fallback if Web Locks API fails
    }
  }

  // 2. Fallback: LocalStorage mutex lock with timestamp
  if (typeof window === 'undefined') return;
  const now = Date.now();
  const existingLockTime = Number(localStorage.getItem(LOCK_KEY) || 0);
  if (existingLockTime && now - existingLockTime < LOCK_TIMEOUT_MS) {
    // Another tab holds an active lock
    return;
  }

  localStorage.setItem(LOCK_KEY, String(now));
  try {
    await fn();
  } finally {
    try {
      localStorage.removeItem(LOCK_KEY);
    } catch {}
  }
}

let isDraining = false;
export async function drainOutbox(): Promise<void> {
  if (isDraining || typeof window === 'undefined') return;
  if (!navigator.onLine) return;

  await withCrossTabDrainLock(async () => {
    isDraining = true;
    setSyncStatus('syncing');

    try {
      const itemsToDrain = loadOutbox();
      if (itemsToDrain.length === 0) {
        if (activeRequestsCount === 0) setSyncStatus('synced');
        return;
      }

      const completedIds = new Set<string>();
      const failedRetryUpdates = new Map<string, { retries: number; error?: string }>();

      for (const item of itemsToDrain) {
        // SECURITY: Verify session before EACH item to prevent cross-account token misuse!
        const currentSession = getActiveUserSession();
        if (!currentSession.id) {
          // No user logged in right now - halt drain
          break;
        }

        if (!item.userId || item.userId !== currentSession.id) {
          // Item does not belong to currently logged in user; skip it
          continue;
        }

        try {
          await centralApi(
            item.path,
            {
              method: item.method,
              body: item.body,
              headers: {
                'X-Client-Op-Id': item.id // Preserve exact same operation ID!
              }
            },
            undefined, // tokenOverride
            false,     // allowEnqueue = false
            item.userId // expectedUserId to prevent session-switch race!
          );
          completedIds.add(item.id);
        } catch (err: any) {
          if (err?.isBusinessError) {
            // Authoritative business rejection permanently rejects this item
            completedIds.add(item.id);
            notifyOutboxPermanentFailure(item, err.message || 'Business logic rejection');
          } else {
            // Transient network, 503, or timeout error: increment retry count
            failedRetryUpdates.set(item.id, {
              retries: item.retries + 1,
              error: err?.message
            });
          }
        }
      }

      // ATOMIC REMOVAL with runAtomicOutboxMutation:
      let queueCount = 0;
      let saveFailed = false;
      try {
        queueCount = await runAtomicOutboxMutation((liveQueue) => {
          const nextQueue = liveQueue
            .filter((item) => !completedIds.has(item.id))
            .map((item) => {
              const update = failedRetryUpdates.get(item.id);
              return update !== undefined
                ? { ...item, retries: update.retries, lastError: update.error }
                : item;
            })
            .filter((item) => {
              if (item.retries >= 5) {
                notifyOutboxPermanentFailure(item, item.lastError || 'Max retries (5) exceeded');
                return false;
              }
              return true;
            });
          return { nextItems: nextQueue, result: nextQueue.length };
        });
      } catch (e: any) {
        saveFailed = true;
        console.error('Failed to atomically update outbox queue in storage:', e);
      }

      if (saveFailed) {
        setSyncStatus('retry', 'Failed to update local storage queue');
      } else if (queueCount === 0 && activeRequestsCount === 0) {
        setSyncStatus('synced');
      } else if (queueCount > 0) {
        setSyncStatus('retry', 'Some pending changes need retry');
      }
    } finally {
      isDraining = false;
    }
  });
}

/**
 * Record an optimistic / local-first state change
 */
export function recordLocalMutation(): void {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setSyncStatus('local');
  } else if (currentSyncStatus.state === 'synced' && activeRequestsCount === 0) {
    setSyncStatus('local');
  }
}

// Register browser connectivity listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    drainOutbox().catch(() => {});
  });
  window.addEventListener('offline', () => {
    setSyncStatus('local', 'Offline mode - changes saved locally');
  });
  setInterval(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine && getOutboxCount() > 0) {
      drainOutbox().catch(() => {});
    }
  }, 30000);
}

/**
 * Robust transient network or timeout error detection
 * Supports modern AbortSignal.timeout() TimeoutError, DOMException, TypeError, and connection drops
 */
export function isTransientNetworkOrTimeoutError(error: any): boolean {
  if (!error) return false;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const name = error?.name || '';
  const msg = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();

  return (
    name === 'TimeoutError' ||
    name === 'AbortError' ||
    name === 'TypeError' ||
    (name === 'DOMException' && (error.code === 23 || msg.includes('timeout') || name === 'TimeoutError')) ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ENOTFOUND' ||
    code === 'ECONNREFUSED' ||
    msg.includes('timeout') ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('load failed') ||
    msg.includes('networkerror')
  );
}

/**
 * Authoritative API error classifier
 * Clearly distinguishes permanent business rejections from transient infrastructure/503/timeout errors
 */
export function classifyApiError(
  status: number,
  result: any,
  rawError?: any
): { isBusinessError: boolean; isTransient: boolean; code: string; message: string } {
  // 1. Transient HTTP status codes (Server busy, Firestore quota, Gateway Timeout)
  if (status === 429 || status === 502 || status === 503 || status === 504) {
    return {
      isBusinessError: false,
      isTransient: true,
      code: result?.error || `HTTP_${status}`,
      message: result?.message || result?.error || `Server temporarily unavailable (${status})`
    };
  }

  // 2. Explicit Domain Business Rejections from Backend Endpoints
  const businessErrorCodes = new Set([
    'ITEM_DISTRIBUTED',
    'POWER_REQUIRED',
    'NOT_ACTIVE',
    'FORBIDDEN',
    'CLAIMANT_NOT_FOUND',
    'ITEM_NOT_FOUND',
    'ALREADY_CLAIMED',
    'INVALID_CLAIM_PAYLOAD',
    'INVALID_UNCLAIM_PAYLOAD',
    'INVALID_PAYLOAD',
    'INVALID_DATA',
    'UNAUTHORIZED',
    'AUTH_REQUIRED',
    'REGISTRATION_PENDING',
    'REGISTRATION_REJECTED'
  ]);

  const errorCode = result?.error || '';
  if (businessErrorCodes.has(errorCode)) {
    return {
      isBusinessError: true,
      isTransient: false,
      code: errorCode,
      message: result?.message || errorCode
    };
  }

  // 3. HTTP 4xx Client/Business Rejections (except 429 which is rate limit)
  if (status >= 400 && status < 500) {
    return {
      isBusinessError: true,
      isTransient: false,
      code: errorCode || `HTTP_${status}`,
      message: result?.message || errorCode || `Request rejected (${status})`
    };
  }

  // 4. HTTP 500 Generic Server Failures (transient / retryable)
  if (status >= 500) {
    return {
      isBusinessError: false,
      isTransient: true,
      code: errorCode || `HTTP_${status}`,
      message: result?.message || errorCode || `Server error (${status})`
    };
  }

  // 5. Raw JavaScript Error (fetch exceptions, timeouts, network disconnects)
  if (rawError && isTransientNetworkOrTimeoutError(rawError)) {
    return {
      isBusinessError: false,
      isTransient: true,
      code: rawError?.name === 'TimeoutError' ? 'TIMEOUT_ERROR' : (rawError?.code || 'NETWORK_ERROR'),
      message: rawError?.message || 'Network transport failure'
    };
  }

  return {
    isBusinessError: false,
    isTransient: true,
    code: errorCode || 'UNKNOWN_ERROR',
    message: result?.message || errorCode || 'Unknown error'
  };
}

/**
 * Execute an authenticated request to backend API with classified error handling
 * and origin session identity binding
 */
export async function centralApi(
  path: string,
  init: RequestInit = {},
  tokenOverride?: string,
  allowEnqueue = true,
  expectedUserId?: string
): Promise<Response> {
  const clientOpId = getOrGenerateClientOpId(init);

  // Capture initiating session identity at the start of the request
  const originSession = getActiveUserSession();
  const originUserId = expectedUserId || originSession.id;
  const originInGameName = originSession.inGameName;

  // If browser is currently offline, enqueue mutation and throw classified offline error
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    let queued = false;
    if (allowEnqueue) {
      queued = await enqueueOutbox(path, init, clientOpId, originUserId, originInGameName);
    }
    setSyncStatus(queued ? 'local' : 'retry', queued ? 'Saved locally, offline' : 'Storage full, offline');
    const offlineErr: CentralApiError = new Error(queued ? 'NETWORK_OFFLINE_QUEUED' : 'OFFLINE_STORAGE_FAILED');
    offlineErr.isNetworkError = true;
    offlineErr.isQueued = queued;
    offlineErr.code = queued ? 'OFFLINE_QUEUED' : 'OFFLINE_STORAGE_FAILED';
    throw offlineErr;
  }

  let token = tokenOverride;
  if (!token && tokenProvider) {
    token = await tokenProvider();
  }
  if (!token) {
    const { getCurrentUserIdToken } = await import('./firebase');
    token = await getCurrentUserIdToken();
  }

  if (!token) {
    setSyncStatus('retry', 'AUTH_REQUIRED');
    const authErr: CentralApiError = new Error('AUTH_REQUIRED');
    authErr.isBusinessError = true;
    authErr.code = 'AUTH_REQUIRED';
    throw authErr;
  }

  // SESSION-SWITCH RACE GUARD:
  // Verify that the active session user did NOT switch while awaiting token!
  const activeSessionNow = getActiveUserSession();
  if (originUserId && activeSessionNow.id !== originUserId) {
    console.warn(
      `Session switch race detected: Expected user ${originUserId}, but active session is now ${activeSessionNow.id}. Aborting request.`
    );
    const switchErr: CentralApiError = new Error('SESSION_SWITCHED_ABORT');
    switchErr.isBusinessError = true;
    switchErr.code = 'SESSION_SWITCHED';
    throw switchErr;
  }

  activeRequestsCount++;
  setSyncStatus('syncing');

  try {
    const response = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Op-Id': clientOpId,
        ...init.headers,
        Authorization: `Bearer ${token}`
      },
      signal: init.signal || AbortSignal.timeout(18000)
    });

    const result = await response.clone().json().catch(() => ({}));

    // Server-side status or response checks
    if (!response.ok || (result && result.success === false)) {
      const classified = classifyApiError(response.status, result);

      if (classified.isBusinessError) {
        // Authoritative business rejection: NEVER put in outbox, throw for immediate rollback
        const businessErr: CentralApiError = new Error(classified.message);
        businessErr.isBusinessError = true;
        businessErr.code = classified.code;
        throw businessErr;
      } else {
        // Transient error (503 / 429 / 500 / timeout): enqueue in outbox bound to origin user
        let queued = false;
        if (allowEnqueue) {
          queued = await enqueueOutbox(path, init, clientOpId, originUserId, originInGameName);
        }
        setSyncStatus(queued ? 'local' : 'retry', classified.message);
        const transientErr: CentralApiError = new Error(classified.message);
        transientErr.isNetworkError = true;
        transientErr.isQueued = queued;
        transientErr.code = classified.code;
        throw transientErr;
      }
    }

    activeRequestsCount = Math.max(0, activeRequestsCount - 1);
    if (activeRequestsCount === 0) {
      if (getOutboxCount() > 0) {
        setSyncStatus('retry', 'Pending items in outbox');
      } else {
        setSyncStatus('synced');
      }
    } else {
      setSyncStatus('syncing');
    }

    return response;
  } catch (error: any) {
    activeRequestsCount = Math.max(0, activeRequestsCount - 1);

    // Business rejection from server: rethrow directly (already marked)
    if (error?.isBusinessError) {
      setSyncStatus('retry', error.code || error.message);
      throw error;
    }

    // Already classified transient error with isQueued
    if (error?.isQueued !== undefined) {
      throw error;
    }

    // Transport / Timeout / Network error thrown by fetch
    const classified = classifyApiError(0, null, error);
    if (allowEnqueue && classified.isTransient) {
      const queued = await enqueueOutbox(path, init, clientOpId, originUserId, originInGameName);
      setSyncStatus(
        queued ? 'local' : 'retry',
        queued ? 'Saved locally, will retry' : 'Failed to save to local queue'
      );
      const netErr: CentralApiError = new Error(queued ? 'NETWORK_ERROR_QUEUED' : 'QUEUE_STORAGE_FAILED');
      netErr.isNetworkError = true;
      netErr.isQueued = queued;
      netErr.code = classified.code;
      throw netErr;
    } else {
      setSyncStatus('retry', error?.message || 'CENTRAL_WRITE_FAILED');
      throw error;
    }
  }
}
