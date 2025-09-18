// frontend/src/Components/Mentions/TokenLinkText.tsx
import React, { useMemo } from "react";
import {
  Link as ChakraLink,
  type LinkProps,
  useDisclosure,
} from "@chakra-ui/react";

// ⬇️ Lazy import: solo descarga y ejecuta el modal cuando realmente se abre
const AppointmentModal = React.lazy(
  () => import("../Modal/AppointmentModal")
);

// #[Display|type:id]
const TOKEN_REGEX = /#\[([^\]|]+)\|([^:|\]]+):([^\]]+)\]/g;

export type TokenLinkTextProps = {
  text?: string | null;
  prefix?: string; // por defecto "#"
  linkProps?: LinkProps;
  buildHref?: (display: string, type: string, id: string) => string;
};

type Part =
  | { kind: "text"; value: string }
  | { kind: "token"; display: string; tokType: string; id: string };

function parseParts(value: string): Part[] {
  const out: Part[] = [];
  let last = 0;
  // clonamos para evitar efectos de lastIndex
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

  const renderTextWithBreaks = (t: string, keyPrefix: string) => {
    const lines = t.split("\n");
    return lines.flatMap((ln, idx) => {
      const nodes: React.ReactNode[] = [
        <React.Fragment key={`${keyPrefix}-ln-${idx}`}>{ln}</React.Fragment>,
      ];
      if (idx < lines.length - 1) nodes.push(<br key={`${keyPrefix}-br-${idx}`} />);
      return nodes;
    });
  };

  const handleTokenClick = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAppId(id);
    onOpen(); // <-- aquí es cuando realmente se “ejecuta” el modal
  };

  const handleClose = () => {
    onClose();
    setAppId(null);
  };

  return (
    <>
      <span>
        {parts.map((p, idx) => {
          if (p.kind === "text") {
            return (
              <React.Fragment key={`txt-${idx}`}>
                {renderTextWithBreaks(p.value, `t${idx}`)}
              </React.Fragment>
            );
          }

          // token
          const label = `${prefix}${p.display}`;
          const href =
            buildHref?.(p.display, p.tokType, p.id) ?? `#${p.tokType}:${p.id}`;

          // no abrimos nada automáticamente: solo con click
          return p.id ? (
            <ChakraLink
              key={`tok-${idx}`}
              href={href}
              data-type={p.tokType}
              data-id={p.id}
              color="teal.300"
              _hover={{ textDecoration: "underline" }}
              {...linkProps}
              onClick={handleTokenClick(p.id)}
            >
              {label}
            </ChakraLink>
          ) : (
            <React.Fragment key={`tok-${idx}`}>{label}</React.Fragment>
          );
        })}
      </span>

      {/* ⬇️ El modal solo se monta si realmente se va a mostrar */}
      {isOpen && appid && (
        <React.Suspense fallback={null}>
          <AppointmentModal id={appid} isOpen={isOpen} onClose={handleClose} />
        </React.Suspense>
      )}
    </>
  );
});

export default TokenLinkText;
