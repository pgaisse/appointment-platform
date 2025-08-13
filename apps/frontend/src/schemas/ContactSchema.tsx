import { z } from "zod";

export const contactsSchema = z.object({
  nameInput: z.string()
    .min(1, "Name is required")
    .max(50, "Name must be at most 50 characters")
    .transform((val) => val.trim().replace(/\s+/g, " ")),

  lastNameInput: z.string()
    .min(1, "Last Name is required")
    .max(50, "Last Name must be at most 50 characters")
    .transform((val) => val.trim().replace(/\s+/g, " ")),

  emailInput: z
    .string()
    .optional()
    .refine(val => !val || /\S+@\S+\.\S+/.test(val), {
      message: "Invalid email",
    }),
  phoneInput: z
    .string()
    .transform((val) => val.replace(/\s+/g, ""))
    .refine((val) => /^04\d{8}$/.test(val), {
      message: "Must start with 04 and contain exactly 10 digits.",
    }),

  
});


export type ContactForm = z.infer<typeof contactsSchema>;
