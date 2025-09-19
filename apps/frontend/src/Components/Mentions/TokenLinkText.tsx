// frontend/src/Components/Mentions/TokenLinkText.tsx
import React, { useMemo, useEffect, useRef } from "react";
import {
  Link as ChakraLink,
  type LinkProps,
  useDisclosure,
} from "@chakra-ui/react";
import { useAuth0 } from "@auth0/auth0-react";

// ⬇️ Lazy import: el modal solo se carga cuando se abre
const AppointmentModal = React.lazy(() => import("../Modal/AppointmentModal"));

// #[Display|type:id]
const TOKEN_REGEX = /#\[([^\]|]+)\|([^:|\]]+):([^\]]+)\]/g;

export type TokenLinkTextProps = {
  text?: string | null;
  prefix?: string;
  linkProps?: LinkProps;
  buildHref?: (display: string, type: string, id: string) => string;
};

type Part =
  | { kind: "text"; value: string }
  | { kind: "token"; display: string; tokType: string; id: string };

function parseParts(value: string): Part[] {
  const out: Part[] = [];
  let last = 0;
  const re = new RegExp(TOKEN_REGEX);
  for (const m of value.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ kind: "text", value: value.slice(last, i) });
    out.push({ kind: "token", display: m[1], tokType: m[2], id: m[3] });
    last = i + m[0].length;
  }
  if (last < value.length) out.push({ kind: "text", value: value.slice(last) });
  return out;
}

// ===== Utilidades =====
const isMongoId = (id: string) => /^[a-f0-9]{24}$/i.test(id);

// Estado de existencia
type Existence = "exists" | "missing" | "unknown";

// Cache en memoria (evita repetir fetch)
const existsCache = new Map<string, Existence>();

async function probeExists(
  id: string,
  getToken?: (() => Promise<string>) | null,
  signal?: AbortSignal
): Promise<Existence> {
  try {
    const headers: HeadersInit = { Accept: "application/json" };
    if (getToken) {
      try {
        const token = await getToken();
        if (token) (headers as any).Authorization = `Bearer ${token}`;
      } catch {
        // si falla el token, seguimos sin auth (puede haber cookie)
      }
    }

    // HEAD primero
    const res = await fetch(`/api/appointments/${id}`, {
      method: "HEAD",
      headers,
      credentials: "include",
      signal,
    });

    if (res.ok) return "exists";
    if (res.status === 404) return "missing";
    if (res.status === 405 || res.status === 501) {
      // fallback GET si HEAD no está implementado
      const getRes = await fetch(`/api/appointments/${id}`, {
        method: "GET",
        headers,
        credentials: "include",
        signal,
      });
      if (getRes.ok) return "exists";
      if (getRes.status === 404) return "missing";
      return "unknown"; // no asumir missing en otros códigos
    }
    if (res.status === 401 || res.status === 403) return "unknown";
    return "unknown";
  } catch {
    return "unknown"; // red/abort → no degradar a missing
  }
}

const TokenLinkText: React.FC<TokenLinkTextProps> = React.memo(function TokenLinkText({
  text,
  prefix = "#",
  linkProps,
  buildHref,
}) {
  const value = text ?? "";
  const { isOpen, onOpen, onClose } = useDisclosure({ defaultIsOpen: false });
  const [appid, setAppId] = React.useState<string | null>(null);

  const parts = useMemo<Part[]>(() => parseParts(value), [value]);

  // Estado local de existencia por id
  const [existsById, setExistsById] = React.useState<Record<string, Existence>>(
    {}
  );

  // Auth0 para token (si está configurado)
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  // Evitar carreras entre probes
  const lastProbeRef = useRef(0);

  useEffect(() => {
    // ids únicos de tipo appointment y ObjectId válido
    const ids = Array.from(
      new Set(
        parts
          .filter(
            (p): p is Extract<Part, { kind: "token" }> =>
              p.kind === "token" &&
              p.tokType?.toLowerCase() === "appointment" &&
              isMongoId(p.id)
          )
          .map((p) => p.id)
      )
    );

    if (ids.length === 0) {
      setExistsById({});
      return;
    }

    // Inicializar desde cache
    const initial: Record<string, Existence> = {};
    const toProbe: string[] = [];
    for (const id of ids) {
      const cached = existsCache.get(id);
      if (cached) {
        initial[id] = cached;
      } else {
        toProbe.push(id);
      }
    }
    if (Object.keys(initial).length > 0) {
      setExistsById((prev) => ({ ...prev, ...initial }));
    }
    if (toProbe.length === 0) return;

    const probeId = Date.now();
    lastProbeRef.current = probeId;
    const controller = new AbortController();

    (async () => {
      const results: Record<string, Existence> = {};
      await Promise.all(
        toProbe.map(async (id) => {
          const existence = await probeExists(
            id,
            isAuthenticated ? () => getAccessTokenSilently() : null,
            controller.signal
          );
          existsCache.set(id, existence);
          results[id] = existence;
        })
      );
      if (lastProbeRef.current === probeId) {
        setExistsById((prev) => ({ ...prev, ...results }));
      }
    })();

    return () => controller.abort();
  }, [parts, isAuthenticated, getAccessTokenSilently]);

  const handleTokenClick = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAppId(id);
    onOpen();
  };

  const handleClose = () => {
    onClose();
    setAppId(null);
  };

  return (
    <>
      {/* Respetar saltos de línea sin split */}
      <span style={{ whiteSpace: "pre-wrap" }}>
        {parts.map((p, idx) => {
          if (p.kind === "text") {
            return <React.Fragment key={`txt-${idx}`}>{p.value}</React.Fragment>;
          }

          const label = `${prefix}${p.display}`;
          const href =
            buildHref?.(p.display, p.tokType, p.id) ?? `#${p.tokType}:${p.id}`;

          const isAppointment = p.tokType?.toLowerCase() === "appointment";
          const validId = isMongoId(p.id);

          if (isAppointment && validId) {
            const state =
              existsById[p.id] ?? existsCache.get(p.id) ?? ("unknown" as Existence);

            // Lógica optimista:
            // - "exists" o "unknown" → mostrar link
            // - "missing" → mostrar texto plano (no link)
            const shouldLink = state !== "missing";

            if (shouldLink) {
              return (
                <ChakraLink
                  key={`tok-${idx}`}
                  href={href}
                  data-type={p.tokType}
                  data-id={p.id}
                  color="teal.300"
                  _hover={{ textDecoration: "underline" }}
                  aria-label={`Open appointment ${p.display}`}
                  {...linkProps}
                  onClick={handleTokenClick(p.id)}
                  onMouseEnter={() => {
                    // prefetch sutil del modal para UX
                    import("../Modal/AppointmentModal");
                  }}
                >
                  {label}
                </ChakraLink>
              );
            }
            return <React.Fragment key={`tok-${idx}`}>{label}</React.Fragment>;
          }

          // Otros tipos: dejar como link sin validar
          return (
            <ChakraLink
              key={`tok-${idx}`}
              href={href}
              data-type={p.tokType}
              data-id={p.id}
              color="teal.300"
              _hover={{ textDecoration: "underline" }}
              aria-label={`Open ${p.tokType} ${p.display}`}
              {...linkProps}
              onClick={handleTokenClick(p.id)}
              onMouseEnter={() => import("../Modal/AppointmentModal")}
            >
              {label}
            </ChakraLink>
          );
        })}
      </span>

      {isOpen && appid && (
        <React.Suspense fallback={null}>
          <AppointmentModal id={appid} isOpen={isOpen} onClose={handleClose} />
        </React.Suspense>
      )}
    </>
  );
});

export default TokenLinkText;
