import { z } from "zod";

export const messageTemplateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  variablesUsed: z.array(z.string()).optional()
});

export type ScheaMessageTemplate = z.infer<typeof messageTemplateSchema>;
