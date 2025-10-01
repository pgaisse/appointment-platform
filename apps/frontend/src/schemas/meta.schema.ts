import { z } from "zod";

// ✅ Soporte de múltiples formatos de color
export const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/; // #RGB, #RGBA, #RRGGBB, #RRGGBBAA
const RGB_RE = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(1|0|0?\.\d+))?\s*\)$/i;
const HSL_RE = /^hsla?\(\s*(\d{1,3})(?:\.\d+)?\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%(?:\s*,\s*(1|0|0?\.\d+))?\s*\)$/i;
// Chakra tokens: teal.500, blue.300, blackAlpha.300, etc.
const CHAKRA_TOKEN_RE = /^[a-zA-Z]+(?:Alpha)?\.(?:50|[1-9]00)$/;
// Nombres CSS (fallback en SSR): teal, red, cornflowerblue, etc.
const CSS_NAME_RE = /^[a-zA-Z]+$/;

function isValidCssNamedColor(value: string): boolean {
  // En browser: valida contra el parser de CSS real
  if (typeof window !== "undefined" && typeof (window as any).Option === "function") {
    const s = new Option().style;
    s.color = "";
    s.color = value;
    return s.color !== "";
  }
  // En SSR: acepta nombres alfabéticos como fallback (evita falsos negativos)
  return CSS_NAME_RE.test(value);
}

export const ColorSchema = z.string().trim().refine((v) => {
  if (HEX_COLOR_RE.test(v)) return true;
  if (RGB_RE.test(v) || HSL_RE.test(v)) return true;
  if (CHAKRA_TOKEN_RE.test(v)) return true;
  if (isValidCssNamedColor(v)) return true; // 'teal', 'red', etc.
  return false;
}, {
  message:
    "Color inválido. Usa HEX (#RGB/#RGBA/#RRGGBB/#RRGGBBAA), rgb()/rgba(), hsl()/hsla(), nombre CSS (p. ej., teal) o token Chakra (p. ej., teal.500, blackAlpha.300).",
});

export const ICON_KEY_RE = /^(fi|fa|md|ri|gi):[A-Za-z][A-Za-z0-9]*$/;

const str = z.string().trim();
export const strMinMax = (min: number, max: number) => z.string().trim().min(min).max(max);
export const strMax = (n: number) => z.string().trim().max(n);

// ---------- PRIORITY ----------
const PriorityCreateBase = z.object({
  name: strMinMax(1, 80),
  description: strMinMax(1, 400),
  notes: strMax(1000).optional().default(""),
  id: z.coerce.number().int().nonnegative(),
  durationHours: z.coerce.number().min(0).max(24),
  color: ColorSchema, // ⬅️ ahora acepta múltiples formatos
}).strip();

export const PriorityCreateSchema = PriorityCreateBase;
export const PriorityUpdateSchema = PriorityCreateBase
  .partial()
  .strip()
  .refine((v) => Object.keys(v).length > 0, { message: "No hay campos para actualizar" });

export type PriorityCreateInput = z.infer<typeof PriorityCreateSchema>;
export type PriorityUpdateInput = z.infer<typeof PriorityUpdateSchema>;

// ---------- TREATMENT ----------
const TreatmentCreateBase = z.object({
  name: strMinMax(1, 100),
  duration: z.coerce.number().int().positive().max(600), // minutos
  category: strMax(100).optional().default("General"),
  icon: str.regex(ICON_KEY_RE, "Formato pack:Name, ej. fi:FiScissors"),
  minIcon: str.regex(ICON_KEY_RE, "Formato pack:Name, ej. fi:FiScissors"),
  color: ColorSchema, // ⬅️ soporta HEX, tokens Chakra, rgb/hsl y nombres CSS
}).strip();

const TreatmentUpdateBase = TreatmentCreateBase.partial().strip();

export function makeTreatmentSchemas(validateIcon?: (key: string) => boolean) {
  const addIconCheck = <S extends z.ZodTypeAny>(schema: S): S | z.ZodEffects<S> => {
    if (typeof validateIcon !== "function") return schema;
    return schema.superRefine((val: any, ctx) => {
      if (val.icon && !validateIcon(val.icon)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["icon"], message: "Ícono no encontrado" });
      }
      if (val.minIcon && !validateIcon(val.minIcon)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["minIcon"], message: "Ícono no encontrado" });
      }
    });
  };

  const TreatmentCreateSchema = addIconCheck(TreatmentCreateBase);
  const TreatmentUpdateSchema = addIconCheck(TreatmentUpdateBase);

  return { TreatmentCreateSchema, TreatmentUpdateSchema };
}

export type TreatmentCreateInput = {
  name: string;
  duration: number;
  category?: string;
  icon: string;
  minIcon: string;
  color: string;
};
export type TreatmentUpdateInput = Partial<TreatmentCreateInput>;

// ---------- Helpers ----------
export function getFormSchemaPair(
  kind: "priority" | "treatment",
  isEdit: boolean,
  treatmentSchemas: { TreatmentCreateSchema: z.ZodTypeAny; TreatmentUpdateSchema: z.ZodTypeAny }
) {
  if (kind === "priority") return isEdit ? PriorityUpdateSchema : PriorityCreateSchema;
  return isEdit ? treatmentSchemas.TreatmentUpdateSchema : treatmentSchemas.TreatmentCreateSchema;
}

export function zodToErrors(issues: z.ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path?.[0]?.toString?.() || "form";
    if (!out[key]) out[key] = i.message;
  }
  return out;
}
