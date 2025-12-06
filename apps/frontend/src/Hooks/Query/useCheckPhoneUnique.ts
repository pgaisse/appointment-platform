// src/Hooks/useCheckPhoneUnique.ts
import { useCallback, useRef } from "react";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";

export type CheckPhoneUniqueOpts = { excludeId?: string };

export type PhoneCheckResult = {
  exists: boolean;
  isUnknown?: boolean;
  existingId?: string;
  existingRecord?: {
    _id: string;
    nameInput?: string;
    lastNameInput?: string;
    phoneInput?: string;
    phoneE164?: string;
    emailInput?: string;
  };
};

/**
 * Devuelve una función `checkPhoneUnique(e164, { excludeId }) => Promise<PhoneCheckResult>`
 * exists: true => YA existe en la organización (duplicado)
 * exists: false => NO existe o hubo error de red (no bloquea)
 * isUnknown: true => El registro existente tiene unknown: true (se puede actualizar)
 * existingId: ID del registro existente si isUnknown es true
 */
export function useCheckPhoneUnique() {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  // Cache simple en memoria para evitar pegarle al endpoint repetidamente por el mismo valor
  const cacheRef = useRef<Map<string, PhoneCheckResult>>(new Map());

  const checkPhoneUnique = useCallback(
    async (e164: string, opts?: CheckPhoneUniqueOpts): Promise<PhoneCheckResult> => {
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

        console.log('📞 [useCheckPhoneUnique] Response:', data);

        const result: PhoneCheckResult = {
          exists: Boolean(data?.exists),
          isUnknown: data?.isUnknown,
          existingId: data?.existingId,
          existingRecord: data?.existingRecord,
        };
        
        cacheRef.current.set(key, result);
        return result;
      } catch (error) {
        console.error('❌ [useCheckPhoneUnique] Error:', error);
        // en error de red/servidor, NO bloqueamos
        return { exists: false };
      }
    },
    [getAccessTokenSilently, isAuthenticated]
  );

  return checkPhoneUnique;
}

export type CheckPhoneUniqueFn = ReturnType<typeof useCheckPhoneUnique>;
