import { useAuth0 } from "@auth0/auth0-react";
import { useCallback } from "react";
import { useForceReauth } from "./useForceReauth";

const AUDIENCE = "https://api.dev.iconicsmiles";
const SCOPE = "openid profile email offline_access";

export function useTokenOrLogout(audience: string = AUDIENCE) {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const forceReauth = useForceReauth();

  const getToken = useCallback(async () => {
    if (!isAuthenticated) {
      forceReauth({ reason: "not_authenticated" });
      return null;
    }
    try {
      return await getAccessTokenSilently({
        authorizationParams: { audience, scope: SCOPE },
      });
    } catch (e: any) {
      const code = (e?.error || e?.code || "").toLowerCase();
      const msg = (e?.error_description || e?.message || "").toLowerCase();

      const shouldReauth =
        code.includes("missing_refresh_token") ||
        code.includes("login_required") ||
        code.includes("consent_required") ||
        code.includes("not_authenticated") ||
        code.includes("invalid_grant") ||
        /missing refresh token|expired|invalid.*token/.test(msg);

      if (shouldReauth) {
        forceReauth({ reason: code || "token_error" });
        return null;
      }
      throw e;
    }
  }, [isAuthenticated, getAccessTokenSilently, forceReauth, audience]);

  return { getToken };
}
