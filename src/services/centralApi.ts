export function reportCentralSync(success: boolean) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('k7-central-sync', { detail: { success } }));
}

export async function centralApi(path: string, init: RequestInit = {}, tokenOverride?: string): Promise<Response> {
  const { getCurrentUserIdToken } = await import('./firebase');
  const token = tokenOverride || await getCurrentUserIdToken();
  if (!token) {
    reportCentralSync(false);
    throw new Error('AUTH_REQUIRED');
  }
  try {
    const response = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers, Authorization: `Bearer ${token}` },
      signal: init.signal || AbortSignal.timeout(10000)
    });
    const result = await response.clone().json();
    if (!response.ok || result.success !== true) throw new Error(result.error || 'CENTRAL_WRITE_FAILED');
    reportCentralSync(true);
    return response;
  } catch (error) {
    reportCentralSync(false);
    throw error;
  }
}
