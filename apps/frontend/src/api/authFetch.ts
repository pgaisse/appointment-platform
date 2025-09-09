import { useAuth0 } from "@auth0/auth0-react";

export function useAuthFetch() {
  const { getAccessTokenSilently } = useAuth0();

  const authFetch = async (input: RequestInfo, init: RequestInit = {}) => {
    const token = await getAccessTokenSilently();
    const res = await fetch(input, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      let body: any = null;
      try { body = await res.json(); } catch {}
      throw new Error(body?.error || body?.message || `HTTP ${res.status}`);
    }
    // intenta json, si no hay, retorna null
    try { return await res.json(); } catch { return null; }
  };

  return { authFetch };
}
