import React, { useMemo } from "react";
import {
  Link as ChakraLink,
  type LinkProps,
  useDisclosure,
} from "@chakra-ui/react";
import { ModalStackProvider } from "../ModalStack/ModalStackContext";
import { useAuth0 } from "@auth0/auth0-react";

const AppointmentModal = React.lazy(() => import("../Modal/AppointmentModal"));

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

const isMongoId = (id: string) => /^[a-f0-9]{24}$/i.test(id);

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

const TokenLinkText: React.FC<TokenLinkTextProps> = React.memo(
  function TokenLinkText({ text, prefix = "#", linkProps, buildHref }) {
    const value = text ?? "";
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [appid, setAppId] = React.useState<string | null>(null);
    const parts = useMemo(() => parseParts(value), [value]);
    const { getAccessTokenSilently, isAuthenticated } = useAuth0();
    const [existenceMap, setExistenceMap] = React.useState<Record<string, "exists" | "missing" | "unknown">>({});

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

    const checkExistence = React.useCallback(
      async (id: string) => {
        if (!id || existenceMap[id]) return; // already known
        try {
          const headers: HeadersInit = { Accept: "application/json" };
          if (isAuthenticated) {
            try {
              const token = await getAccessTokenSilently();
              if (token) (headers as any).Authorization = `Bearer ${token}`;
            } catch {
              // continue without token
            }
          }
          const res = await fetch(`/api/appointments/${id}`, {
            method: "GET",
            headers,
            credentials: "include",
          });
          const state = res.ok ? "exists" : res.status === 404 ? "missing" : "unknown";
          setExistenceMap((m) => (m[id] ? m : { ...m, [id]: state }));
        } catch {
          setExistenceMap((m) => (m[id] ? m : { ...m, [id]: "unknown" }));
        }
      },
      [existenceMap, getAccessTokenSilently, isAuthenticated]
    );

    return (
      <>
        <span style={{ whiteSpace: "pre-wrap" }}>
          {parts.map((p, idx) => {
            if (p.kind === "text") return <React.Fragment key={idx}>{p.value}</React.Fragment>;

            const label = `${prefix}${p.display}`;
            const href =
              buildHref?.(p.display, p.tokType, p.id) ?? `#${p.tokType}:${p.id}`;
            const isAppointment = p.tokType?.toLowerCase() === "appointment";
            const validId = isMongoId(p.id);

            if (isAppointment && validId) {
              const state = existenceMap[p.id];
              const shouldLink = state !== "missing";

              if (shouldLink) {
                return (
                  <ChakraLink
                    key={idx}
                    href={href}
                    data-type={p.tokType}
                    data-id={p.id}
                    color="teal.300"
                    _hover={{ textDecoration: "underline" }}
                    {...linkProps}
                    onClick={handleTokenClick(p.id)}
                    onMouseEnter={() => {
                      checkExistence(p.id);
                      import("../Modal/AppointmentModal");
                    }}
                  >
                    {label}
                  </ChakraLink>
                );
              }
              return <React.Fragment key={idx}>{label}</React.Fragment>;
            }

            return (
              <ChakraLink
                key={idx}
                href={href}
                data-type={p.tokType}
                data-id={p.id}
                color="teal.300"
                _hover={{ textDecoration: "underline" }}
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
            <ModalStackProvider>
              <AppointmentModal id={appid} isOpen={isOpen} onClose={handleClose} />
            </ModalStackProvider>
          </React.Suspense>
        )}
      </>
    );
  }
);

export default TokenLinkText;
