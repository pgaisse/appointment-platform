// src/schemas/AppointmentsSchema.ts
import { z } from "zod";
import { toE164AU } from "@/utils/phoneAU";

export type CheckUniqueFn = (
  e164: string,
  opts?: { excludeId?: string }
) => Promise<boolean>; // true => YA existe

/** Objeto base (solo validaciones síncronas por campo) */
function buildBaseSchema() {
  return z.object({
    nameInput: z.string()
      .min(1, "Name is required")
      .max(50, "Name must be at most 50 characters")
      .transform((val) => val.trim().replace(/\s+/g, " ")),

    id: z.string().optional().default(""),

    lastNameInput: z.string()
      .min(1, "Last Name is required")
      .max(50, "Last Name must be at most 50 characters")
      .transform((val) => val.trim().replace(/\s+/g, " ")),

    note: z.string()
      .min(5, "Must be at least 5 characters")
      .max(300, "Must be at most 300 characters")
      .transform((val) => val.trim().replace(/\s+/g, " ")),

    emailInput: z.string().optional().refine(v => !v || /\S+@\S+\.\S+/.test(v), {
      message: "Invalid email",
    }),

    phoneInput: z.string()
      .transform((val) => val.replace(/\s+/g, ""))
      .refine(
        (val) =>
          /^04\d{8}$/.test(val) ||
          /^\+61\d{9}$/.test(val) ||
          /^61\d{9}$/.test(val),
        { message: "Must be AU format (04XXXXXXXX or +61XXXXXXXXX)" }
      ),

    contactPreference: z.enum(["call", "sms"], {
      errorMap: () => ({ message: "Select call or sms" }),
    }),

    priority: z.string()
      .min(1, "Priority is required")
      .max(100, "Priority must be at most 100 characters")
      .transform((val) => val.trim().replace(/\s+/g, " ")),

    treatment: z.string()
      .min(1, "Treatment is required")
      .max(100, "Treatment must be at most 100 characters")
      .transform((val) => val.trim().replace(/\s+/g, " ")),

    selectedDates: z.object({
      startDate: z.coerce.date({ required_error: "Start date is required" }),
      endDate: z.coerce.date({ required_error: "End date is required" }),
      days: z.array(
        z.object({
          weekDay: z.string().min(1, "Week day is required"),
          timeBlocks: z.array(
            z.object({ _id: z.string().min(1, "Time block ID is required") })
          ).min(1, "At least one time block must be selected"),
        })
      ).min(1, "At least one day must be selected"),
    }),

    selectedAppDates: z.array(
      z.object({
        startDate: z.coerce.date({ required_error: "Start date is required" }),
        endDate: z.coerce.date({ required_error: "End date is required" }),
      })
    )
      .min(1, "At least one date must be selected")
      .max(1, "Only a single date is allowed.")
      .refine(dates => dates.every(date => date.startDate < date.endDate), {
        message: "Start date must be before end date",
      }),

    reschedule: z.boolean().optional(),

    // Base: providers requeridos
    providers: z.array(z.string()).min(1, "At least one provider is required"),
  });
}

/** Aplica la validación asíncrona de unicidad sobre un ZodObject */
function withAsyncUniqueness<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  checkUnique: CheckUniqueFn
) {
  return schema.superRefine(async (data, ctx) => {
    const val = (data as any).phoneInput as string;
    const isValidFmt =
      /^04\d{8}$/.test(val) || /^\+61\d{9}$/.test(val) || /^61\d{9}$/.test(val);
    if (!isValidFmt) return; // ya lo valida la regla previa

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
        message: "Phone number already exists for this organization",
      });
    }
  });
}

/** Factory base (providers requeridos) */
export const appointmentsSchema = (checkUnique: CheckUniqueFn) =>
  withAsyncUniqueness(buildBaseSchema(), checkUnique);

/** Variante: providers opcional (útil para tu form) */
export const makeAppointmentsSchemaOptionalProviders = (checkUnique: CheckUniqueFn) =>
  withAsyncUniqueness(
    buildBaseSchema().extend({
      providers: z.array(z.string()).optional().default([]),
    }),
    checkUnique
  );

// Tipos
export type AppointmentFormBase = z.infer<ReturnType<typeof appointmentsSchema>>;
export type AppointmentFormOptionalProviders = z.infer<
  ReturnType<typeof makeAppointmentsSchemaOptionalProviders>
>;

// Alias para usar en el form (providers opcional)
export type AppointmentForm = AppointmentFormOptionalProviders;

export type SelectedDatesSchema = AppointmentFormBase["selectedDates"];
