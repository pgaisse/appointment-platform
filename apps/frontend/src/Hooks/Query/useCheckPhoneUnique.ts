// src/Hooks/useCheckPhoneUnique.ts
import { useCallback, useRef } from "react";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";

export type CheckPhoneUniqueOpts = { excludeId?: string };

/**
 * Devuelve una función `checkPhoneUnique(e164, { excludeId }) => Promise<boolean>`
 * true => YA existe en la organización (duplicado)
 * false => NO existe o hubo error de red (no bloquea)
 */
export function useCheckPhoneUnique() {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  // Cache simple en memoria para evitar pegarle al endpoint repetidamente por el mismo valor
  const cacheRef = useRef<Map<string, boolean>>(new Map());

  const checkPhoneUnique = useCallback(
    async (e164: string, opts?: CheckPhoneUniqueOpts): Promise<boolean> => {
      const key = `${e164}|${opts?.excludeId ?? ""}`;
      if (cacheRef.current.has(key)) {
        return cacheRef.current.get(key)!;
      }

      try {
        const url = `${import.meta.env.VITE_BASE_URL}/validate/check-unique`;

        const token = isAuthenticated
          ? await getAccessTokenSilently({
              authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
            })
          : undefined;

        // Sólo mandamos excludeId si parece un ObjectId válido de 24 hex
        const params: Record<string, string> = { e164 };
        const ex = opts?.excludeId;
        if (ex && /^[a-f0-9]{24}$/i.test(ex)) {
          params.excludeId = ex;
        }

        const { data } = await axios.get(url, {
          params,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        const exists = Boolean(data?.exists); // true => duplicado
        cacheRef.current.set(key, exists);
        return exists;
      } catch {
        // en error de red/servidor, NO bloqueamos
        return false;
      }
    },
    [getAccessTokenSilently, isAuthenticated]
  );

  return checkPhoneUnique;
}

export type CheckPhoneUniqueFn = ReturnType<typeof useCheckPhoneUnique>;
