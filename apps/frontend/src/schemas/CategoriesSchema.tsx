import * as z from "zod";

export const CategoriesSchema = z.object({
    id: z.string()
        .min(1, "id is required")
        .transform(str => str.trim().toLowerCase()),

    name: z.string()
        .min(1, "Name is required")
        .transform(str => str.trim().toLowerCase()),
    description: z.string()
        .min(10, "Description is required")
        .transform(str => str.trim().toLowerCase())
    ,
    notes: z.string()
        .transform(str => str.trim().toLowerCase()),
    durationHours: z.number()
        .min(0.5, "Minimum duration is 0.5 hours")
        .max(8, "Maximum duration is 8 hours"),
    color: z.string()
        .min(1, "Color is required")
        .transform(str => str.trim().toLowerCase())

    ,
});

export type CategoriesSchemaFormData = z.infer<typeof CategoriesSchema>;
