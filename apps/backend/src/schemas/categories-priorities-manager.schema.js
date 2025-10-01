// src/schemas/categories-priorities-manager.schema.js
const { z } = require("zod");

// ——— Color: acepta HEX, rgb/rgba, hsl/hsla, tokens Chakra (teal.500, blackAlpha.300) y nombres CSS ———
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGB_RE = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(1|0|0?\.\d+))?\s*\)$/i;
const HSL_RE = /^hsla?\(\s*(\d{1,3})(?:\.\d+)?\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%(?:\s*,\s*(1|0|0?\.\d+))?\s*\)$/i;
const CHAKRA_TOKEN_RE = /^[a-zA-Z]+(?:Alpha)?\.(?:50|[1-9]00)$/;
const CSS_NAME_RE = /^[a-zA-Z]+$/;

function isValidCssNamedColor(value) {
  if (typeof window !== "undefined" && typeof window.Option === "function") {
    const s = new window.Option().style;
    s.color = "";
    s.color = value;
    return s.color !== "";
  }
  return CSS_NAME_RE.test(value);
}

const ColorSchema = z.string().trim().refine((v) => {
  if (HEX_COLOR_RE.test(v)) return true;
  if (RGB_RE.test(v) || HSL_RE.test(v)) return true;
  if (CHAKRA_TOKEN_RE.test(v)) return true;
  if (isValidCssNamedColor(v)) return true;
  return false;
}, {
  message:
    "Color inválido. Usa HEX (#RGB/#RGBA/#RRGGBB/#RRGGBBAA), rgb()/rgba(), hsl()/hsla(), nombre CSS (teal) o token Chakra (teal.500).",
});

const ICON_KEY_RE = /^(fi|fa|md|ri|gi):[A-Za-z][A-Za-z0-9]*$/;

const str = z.string().trim();
const strMinMax = (min, max) => z.string().trim().min(min).max(max);
const strMax = (n) => z.string().trim().max(n);

// ——— PRIORITY ———
const PriorityCreateBase = z.object({
  name: strMinMax(1, 80),
  description: strMinMax(1, 400),
  notes: strMax(1000).optional().default(""),
  id: z.coerce.number().int().nonnegative(),
  durationHours: z.coerce.number().min(0).max(24),
  color: ColorSchema,
}).strip();

const PriorityCreateSchema = PriorityCreateBase;

// OJO: strip ANTES de refine para no crear ZodEffects sin .strip()
const PriorityUpdateSchema = PriorityCreateBase
  .partial()
  .strip()
  .refine((v) => Object.keys(v).length > 0, { message: "No hay campos para actualizar" });

// ——— TREATMENT ———
const TreatmentCreateBase = z.object({
  name: strMinMax(1, 100),
  duration: z.coerce.number().int().positive().max(600),
  category: strMax(100).optional().default("General"),
  icon: str.regex(ICON_KEY_RE, "Formato pack:Name, ej. fi:FiScissors"),
  minIcon: str.regex(ICON_KEY_RE, "Formato pack:Name, ej. fi:FiScissors"),
  color: ColorSchema,
}).strip();

const TreatmentCreateSchema = TreatmentCreateBase;

const TreatmentUpdateSchema = TreatmentCreateBase
  .partial()
  .strip()
  .refine((v) => Object.keys(v).length > 0, { message: "No hay campos para actualizar" });

module.exports = {
  PriorityCreateSchema,
  PriorityUpdateSchema,
  TreatmentCreateSchema,
  TreatmentUpdateSchema,
};
