import React, { useMemo } from "react";
import { Link as ChakraLink, useDisclosure, type LinkProps } from "@chakra-ui/react";
import AppointmentModal from "../Modal/AppointmentModal";

// #[Display|type:id]
const TOKEN_REGEX = /#\[([^\]|]+)\|([^:|\]]+):([^\]]+)\]/g;

export type TokenLinkTextProps = {
  text?: string | null;
  /** Prefijo visible del link. Por defecto "#" => "#Juan Pérez" */
  prefix?: string;
  /** Props para el <Link> de Chakra (e.g., color, isExternal, etc.) */
  linkProps?: LinkProps;
  /**
   * Construye el href del link.
   * Por defecto: "#<type>:<id>"
   * Ej.: (d, t, id) => `/contacts/${id}`
   */
  buildHref?: (display: string, type: string, id: string) => string;
};

type Part =
  | { kind: "text"; value: string }
  | { kind: "token"; display: string; tokType: string; id: string };

export default function TokenLinkText({
  text,
  prefix = "#",
  linkProps,
  buildHref,
}: TokenLinkTextProps) {
  const value = text ?? "";
  const { isOpen, onOpen, onClose } = useDisclosure({ defaultIsOpen: false });
  const [appid, setAppId] = React.useState<string | null>(null);

  const parts = useMemo<Part[]>(() => {
    const out: Part[] = [];
    let last = 0;
    // Clonar el regex para evitar efectos de lastIndex
    const re = new RegExp(TOKEN_REGEX);
    for (const m of value.matchAll(re)) {
      const i = m.index ?? 0;
      if (i > last) out.push({ kind: "text", value: value.slice(last, i) });
      out.push({ kind: "token", display: m[1], tokType: m[2], id: m[3] });
      last = i + m[0].length;
    }
    if (last < value.length) out.push({ kind: "text", value: value.slice(last) });
    return out;
  }, [value]);

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
    onOpen();
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

          const label = `${prefix}${p.display}`;
          const href = buildHref?.(p.display, p.tokType, p.id) ?? `#${p.tokType}:${p.id}`;

          return (
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
          );
        })}
      </span>

      <AppointmentModal id={appid ?? ""} isOpen={isOpen} onClose={handleClose} />
    </>
  );
}
