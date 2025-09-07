import { useOrgAuth, detectOrgSlug, resolveOrgId } from "@/org/authOrg";

export function useApi() {
  const { getTokenForOrg, loginForOrg } = useOrgAuth();

  async function authHeaders() {
    const slug = detectOrgSlug();
    const orgId = slug ? await resolveOrgId(slug) : undefined;
    try {
      const token = await getTokenForOrg(orgId);
      return {
        Authorization: `Bearer ${token}`,
        ...(orgId ? { "X-Org-Id": orgId } : {}),
      };
    } catch {
      if (orgId) await loginForOrg(orgId);
      throw new Error("Redirecting to login for org");
    }
  }

  return {
    async get(url: string) {
      const headers = await authHeaders();
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    async post(url: string, body: any) {
      const headers = await authHeaders();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    async put(url: string, body: any) {
      const headers = await authHeaders();
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  };
}
