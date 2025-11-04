// utils/iconMap.ts
import * as FaIcons from "react-icons/fa";
import * as Fa6Icons from "react-icons/fa6";
import * as MdIcons from "react-icons/md";
import * as FiIcons from "react-icons/fi";
import * as RiIcons from "react-icons/ri";
import * as GiIcons from "react-icons/gi";
import * as CiIcons from "react-icons/ci";
import * as HiIcons from "react-icons/hi";
import type { IconType } from "react-icons";

export const ICON_SETS: Record<string, Record<string, IconType>> = {
  fi: FiIcons as Record<string, IconType>,
  fa: FaIcons as Record<string, IconType>,
  fa6: Fa6Icons as Record<string, IconType>,
  md: MdIcons as Record<string, IconType>,
  ri: RiIcons as Record<string, IconType>,
  gi: GiIcons as Record<string, IconType>,
  ci: CiIcons as Record<string, IconType>,
  hi: HiIcons as Record<string, IconType>,
};

// Normaliza claves como en MetaTreatments: agrega prefijo pack si falta
export function normalizeIconKey(key: string): string {
  if (!key) return "";
  if (key.includes(":")) return key; // ya viene pack:name
  if (key.startsWith("Fi")) return `fi:${key}`;
  if (key.startsWith("Fa")) return `fa:${key}`;
  if (key.startsWith("Md")) return `md:${key}`;
  if (key.startsWith("Ri")) return `ri:${key}`;
  if (key.startsWith("Gi")) return `gi:${key}`;
  if (key.startsWith("Ci")) return `ci:${key}`;
  if (key.startsWith("Hi")) return `hi:${key}`;
  return key;
}

// Alias semántico para guardar en BD en formato canónico pack:Name
export const canonicalizeIconKey = normalizeIconKey;

// Función para obtener el componente de ícono dinámicamente
export function getIconComponent(rawKey?: string): IconType | undefined {
  if (!rawKey) return undefined;
  const normKey = normalizeIconKey(String(rawKey).trim());
  const [pack, name] = normKey.split(":", 2);
  const set = ICON_SETS[pack?.toLowerCase?.() as keyof typeof ICON_SETS];
  if (set && name && set[name]) return set[name];

  // Intentos adicionales para Material Design: MdOutlineX <-> MdX
  if (set && pack?.toLowerCase() === "md" && name) {
    if (name.startsWith("MdOutline") && set["Md" + name.slice(9)]) {
      return set["Md" + name.slice(9)];
    }
    if (name.startsWith("Md") && set["MdOutline" + name.slice(2)]) {
      return set["MdOutline" + name.slice(2)];
    }
  }

  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn(`[icons] Not found: ${rawKey} -> ${normKey}`);
  }
  return undefined;
}

// Legacy iconMap para compatibilidad con código existente
export const iconMap = new Proxy({} as Record<string, IconType>, {
  get(_target, prop: string) {
    // Intentar resolver el ícono dinámicamente
    const icon = getIconComponent(prop);
    if (icon) return icon;
    
    // Fallback al ícono de salud por defecto
    return MdIcons.MdHealthAndSafety;
  }
});
