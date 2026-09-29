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
    const text = await response.text();
    let result: any = null;
    if (text && text.trim()) {
      try {
        result = JSON.parse(text);
      } catch (parseErr) {
        console.warn(`Non-JSON response from ${path}:`, text.slice(0, 100));
      }
    }
    if (!response.ok || (result && result.success === false)) {
      throw new Error(result?.error || result?.message || `HTTP_${response.status}`);
    }
    reportCentralSync(true);
    return new Response(text && text.trim() ? text : JSON.stringify({ success: true }), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  } catch (error) {
    reportCentralSync(false);
    throw error;
  }
}
