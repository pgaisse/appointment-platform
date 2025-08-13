import he from "he";
import type React from "react";

export function decodeChildren(children: React.ReactNode): React.ReactNode {
  if (typeof children === "string") {
    return he.decode(children);
  }

  if (Array.isArray(children)) {
    return children.map(child => decodeChildren(child));
  }

  // Si es ReactElement u otro tipo, devolver tal cual
  return children;
}