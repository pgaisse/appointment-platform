// src/schemas/AppointmentsSchema.ts
import { z } from "zod";

export const appointmentsSchema = z.object({
  nameInput: z.string()
    .min(1, "Name is required")
    .max(50, "Name must be at most 50 characters")
    .transform((val) => val.trim().replace(/\s+/g, " ")),

  id: z.string().min(1, "id is required"),

  lastNameInput: z.string()
    .min(1, "Last Name is required")
    .max(50, "Last Name must be at most 50 characters")
    .transform((val) => val.trim().replace(/\s+/g, " ")),

  note: z.string()
    .min(5, "Must be at least 5 characters")
    .max(300, "Must be at most 300 characters")
    .transform((val) => val.trim().replace(/\s+/g, " ")),

  emailInput: z.string().optional().refine(val => !val || /\S+@\S+\.\S+/.test(val), {
    message: "Invalid email",
  }),

  phoneInput: z.string()
    .transform((val) => val.replace(/\s+/g, ""))
    .refine((val) => /^04\d{8}$/.test(val), {
      message: "Must start with 04 and contain exactly 10 digits.",
    }),

  // 🆕 contactPreference
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
   providers: z.array(z.string()).min(1, "At least one provider is required"),


});

export type AppointmentForm = z.infer<typeof appointmentsSchema>;
export type SelectedDatesSchema = AppointmentForm["selectedDates"];
