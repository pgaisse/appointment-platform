import { z } from "zod";
import { toE164AU } from "@/utils/phoneAU";

export type CheckUniqueFn = (
  e164: string,
  opts?: { excludeId?: string }
) => Promise<boolean>; // true => YA existe

const AU_PHONE_RE = /^(04\d{8}|(?:\+61|61)\d{9})$/;

/** Objeto base (ZodObject puro, sin efectos) */
function buildBaseSchema() {
  return z.object({
    // --- Representative (opcional). Si se usa, el paciente es "niño/dependiente" ---
    representative: z
      .object({
        appointment: z.string().optional().default(""), // _id del Appointment adulto
        relationship: z
          .enum([
            "parent",
            "legal_guardian",
            "grandparent",
            "sibling",
            "carer",
            "other",
          ])
          .optional()
          .default("parent"),
        verified: z.boolean().optional().default(false),
        verifiedAt: z.coerce.date().optional().nullable(),
        verifiedBy: z.string().optional().default(""),
        consentAt: z.coerce.date().optional().nullable(),
        notes: z.string().optional().default(""),
      })
      .optional()
      .default({}),

    nameInput: z
      .string()
      .min(1, "Name is required")
      .max(50, "Name must be at most 50 characters")
      .transform((val) => val.trim().replace(/\s+/g, " ")),

    id: z.string().optional().default(""),

    lastNameInput: z
      .string()
      .min(1, "Last Name is required")
      .max(50, "Last Name must be at most 50 characters")
      .transform((val) => val.trim().replace(/\s+/g, " ")),

    note: z
      .string()
      .min(5, "Must be at least 5 characters")
      .max(300, "Must be at most 300 characters")
      .transform((val) => val.trim().replace(/\s+/g, " ")),

    emailInput: z
      .string()
      .optional()
      .refine((v) => !v || /\S+@\S+\.\S+/.test(v), {
        message: "Invalid email",
      }),

    // AHORA opcional (se exige SOLO si NO hay representative.appointment)
    phoneInput: z
      .string()
      .transform((val) => (val ?? "").replace(/\s+/g, ""))
      .optional()
      .default(""),

    contactPreference: z.enum(["call", "sms"], {
      errorMap: () => ({ message: "Select call or sms" }),
    }),

    // DEPRECATED: Ahora priority y treatment viven en cada slot (selectedAppDates)
    // Mantener opcional para compatibilidad durante migración
    priority: z
      .string()
      .optional()
      .transform((val) => val ? val.trim().replace(/\s+/g, " ") : undefined),

    treatment: z
      .string()
      .optional()
      .transform((val) => val ? val.trim().replace(/\s+/g, " ") : undefined),

    selectedDates: z.object({
      startDate: z.coerce.date({ required_error: "Start date is required" }),
      endDate: z.coerce.date({ required_error: "End date is required" }),
      days: z
        .array(
          z.object({
            weekDay: z.string().min(1, "Week day is required"),
            timeBlocks: z
              .array(
                z.object({
                  _id: z.string().min(1, "Time block ID is required"),
                })
              )
              .min(1, "At least one time block must be selected"),
          })
        )
        .min(1, "At least one day must be selected"),
    }),

    selectedAppDates: z
      .array(
        z.object({
          startDate: z.coerce.date({ required_error: "Start date is required" }),
          endDate: z.coerce.date({ required_error: "End date is required" }),
          // Nuevos campos por slot (opcional durante migración)
          treatment: z.string().optional(),
          priority: z.string().optional(),
          providers: z.array(z.string()).optional().default([]),
          duration: z.number().optional(),
          providerNotes: z.string().optional(),
          status: z.string().optional(),
          _id: z.string().optional(),
          slotId: z.string().optional(),
        })
      )
      .min(1, "At least one date must be selected")
      .refine((dates) => dates.every((d) => d.startDate < d.endDate), {
        message: "Start date must be before end date",
      }),

    reschedule: z.boolean().optional(),

    // REMOVED: providersAssignments - now handled by AppointmentProvider collection

    // Base: providers requeridos (tu variante opcional en factory)
    providers: z.array(z.string()).min(1, "At least one provider is required"),
  });
}

/** Regla XOR sincrónica: o representative.appointment o phone AU válido */
function applySyncXor<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.superRefine((data, ctx) => {
    const repId = (data as any)?.representative?.appointment?.trim?.();
    const phone = String((data as any)?.phoneInput ?? "").replace(/\s+/g, "");
    const hasRepresentative = !!repId;

    if (!hasRepresentative) {
      if (!AU_PHONE_RE.test(phone)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["phoneInput"],
          message:
            "Phone is required (AU format 04XXXXXXXX or +61XXXXXXXXX) when no representative is set",
        });
      }
    }
  });
}

/** Validación asíncrona de unicidad (salta si hay representative) */
function withAsyncUniqueness<T extends z.ZodTypeAny>(
  schema: T,
  checkUnique: CheckUniqueFn
) {
  return schema.superRefine(async (data, ctx) => {
    const repId = (data as any)?.representative?.appointment?.trim?.();
    const hasRepresentative = !!repId;
    if (hasRepresentative) return; // child sin teléfono propio → no chequear unicidad

    const val = (data as any).phoneInput as string;
    if (!AU_PHONE_RE.test(val)) return;

    let e164: string;
    try {
      e164 = toE164AU(val);
    } catch {
      return;
    }

    const excludeId = (data as any).id || undefined;
    const exists = await checkUnique(e164, { excludeId });
    if (exists) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phoneInput"],
        message: "Phone number already exists",
      });
    }
  });
}

/** Factory base (providers requeridos) */
export const appointmentsSchema = (checkUnique: CheckUniqueFn) =>
  withAsyncUniqueness(applySyncXor(buildBaseSchema()), checkUnique);

/** Variante: providers opcional (útil para tu form) */
export const makeAppointmentsSchemaOptionalProviders = (
  checkUnique: CheckUniqueFn
) =>
  withAsyncUniqueness(
    applySyncXor(
      buildBaseSchema().extend({
        providers: z.array(z.string()).optional().default([]),
      })
    ),
    checkUnique
  );

// Tipos
export type AppointmentFormBase = z.infer<
  ReturnType<typeof appointmentsSchema>
>;
export type AppointmentFormOptionalProviders = z.infer<
  ReturnType<typeof makeAppointmentsSchemaOptionalProviders>
>;

// Alias para usar en el form (providers opcional)
export type AppointmentForm = AppointmentFormOptionalProviders;

export type SelectedDatesSchema = AppointmentFormBase["selectedDates"];
