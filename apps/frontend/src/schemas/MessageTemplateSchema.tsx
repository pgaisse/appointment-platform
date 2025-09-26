import { z } from "zod";

export const messageTemplateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  // evita undefined y vacíos; RHF ya puede tener defaultValues: { category: "message" }
  category: z
    .enum(["message", "confirmation"])
    .default("message"),
  variablesUsed: z.array(z.string()).default([]),
});


export type ScheaMessageTemplate = z.infer<typeof messageTemplateSchema>;
