import { manualContactSchema } from "@/schemas/ContactsSchema";
import { z } from "zod";
import { useAuth0 } from "@auth0/auth0-react";
import { validatePhoneNotInAppointments } from "@/Helpers/validatePhoneNotInAppointments";

export const useValidatedManualContactSchema = () => {
  const { getAccessTokenSilently } = useAuth0(); // ✅ hook correcto

  return manualContactSchema.superRefine(async (values, ctx) => {
    const phone = values.phoneInput.trim();

    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        },
      });

      const isValid = await validatePhoneNotInAppointments(phone, token);

      if (!isValid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "There's already a patient with this number.",
          path: ["phoneInput"],
        });
      }
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Error validando número",
        path: ["phoneInput"],
      });
    }
  });
};
