// Hooks/Query/useSendChatMessage.ts
import { useMutation, UseMutationResult } from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";

type SendChatMessageInput = {
  to: string;                 // E.164
  appId: string;              // _id de la Appointment
  body?: string;              // texto opcional
  files?: File[];             // 0..N archivos
  onProgress?: (percent: number) => void; // progreso total del upload
};

type SendChatMessageResponse = {
  success: boolean;
  conversationSid: string;
  messageSid: string;
  mediaSids: string[];        // vacía si no hubo archivos
};

export function useSendChatMessage(): UseMutationResult<
  SendChatMessageResponse,
  unknown,
  SendChatMessageInput
> {
  const { getAccessTokenSilently } = useAuth0();

  return useMutation<SendChatMessageResponse, unknown, SendChatMessageInput>({
    mutationFn: async ({ to, appId, body, files, onProgress }) => {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });

      // Armamos siempre FormData. Si no hay archivos, igual funciona (backend trata como texto-only).
      const fd = new FormData();
      fd.set("to", to);
      fd.set("appId", appId);
      if (body && body.trim()) fd.set("body", body.trim());
      if (files && files.length) {
        for (const f of files) fd.append("files", f, f.name);
      }

      const url = `${import.meta.env.VITE_BASE_URL}/sendMessage`;

      const res = await axios.post<SendChatMessageResponse>(url, fd, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (evt) => {
          if (!onProgress || !evt.total) return;
          const percent = Math.round((evt.loaded * 100) / evt.total);
          onProgress(percent);
        },
      });

      return res.data;
    },
  });
}
