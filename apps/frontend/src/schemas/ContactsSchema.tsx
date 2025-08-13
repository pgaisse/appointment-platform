import { z } from "zod";

/**
 * 📌 Zod schema for validating manual contact input
 * Used in manual contact modal form
 */
export const manualContactSchema = z.object({
    nameInput: z
        .string()
        .min(1, "Name is required")
        .max(100, "Name is too long"),

    lastNameInput: z
        .string()
        .min(1, "Lastname is required")
        .max(100, "Lastname is too long"),
    phoneInput: z
        .string()
        .transform((val) => val.replace(/\s+/g, ""))
        .refine((val) => /^04\d{8}$/.test(val), {
            message: "Must start with 04 and contain exactly 10 digits.",
        }),
});

/**
 * ✅ Exported TypeScript type inferred from the schema
 */
export type ManualContactFormValues = z.infer<typeof manualContactSchema>;
