import { useAuth0 } from "@auth0/auth0-react";
import { useMemo } from "react";

export const NS = "https://letsmarter.com/";

const toLowerArr = (a: unknown) =>
  (Array.isArray(a) ? a : [])
    .map((x) => (x == null ? "" : String(x)))
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

const pick = (claims: any, key: string) => claims?.[NS + key] ?? claims?.[key];

export function useAuthZ() {
  const { isAuthenticated, isLoading, user, loginWithRedirect } = useAuth0();

  const roles = useMemo(
    () => toLowerArr(pick(user, "roles") || []),
    [user]
  );
  const permissions = useMemo(
    () => toLowerArr(pick(user, "permissions") || []),
    [user]
  );

  const hasRole = (...rs: string[]) => {
    const req = rs.map((r) => r.toLowerCase());
    return req.some((r) => roles.includes(r));
  };
  const hasAllPermissions = (...ps: string[]) => {
    const req = ps.map((p) => p.toLowerCase());
    return req.every((p) => permissions.includes(p));
  };
  const hasAnyPermission = (...ps: string[]) => {
    const req = ps.map((p) => p.toLowerCase());
    return req.some((p) => permissions.includes(p));
  };

  return {
    isAuthenticated,
    isLoading,
    user,
    roles,
    permissions,
    hasRole,
    hasAllPermissions,
    hasAnyPermission,
    loginWithRedirect,
  };
}
