// useUploadMedia.ts
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { env } from "@/types";

type UploadedItem = {
  field: string; originalname: string; size: number;
  content_type: string; key: string; filename: string;
  category: string; sid?: string;
};
type UploadResponse = { success: boolean; count: number; items: UploadedItem[] };

type UploadParams =
  | { file: File; files?: undefined; sid?: string; folderName?: string; category?: string; onProgress?: (p: number) => void }
  | { files: File[]; file?: undefined; sid?: string; folderName?: string; category?: string; onProgress?: (p: number) => void };

export const useUploadMedia = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  return useMutation<UploadResponse, Error, UploadParams>({
    mutationFn: async (params) => {
      if (!isAuthenticated) throw new Error("No authenticated user");

      const token = await getAccessTokenSilently({
        authorizationParams: { audience: env.AUTH0_AUDIENCE },
      });

      const form = new FormData();
      if ('file' in params && params.file) {
        form.append('file', params.file);                 // 👈 un archivo
      } else if ('files' in params && params.files?.length) {
        params.files.forEach(f => form.append('files', f)); // 👈 varios
      } else {
        throw new Error("Debe proveerse 'file' o 'files[]'");
      }

      if (params.folderName) form.append('folderName', params.folderName);
      if (params.sid)        form.append('sid', params.sid);
      if (params.category)   form.append('category', params.category);

      const { data } = await axios.post<UploadResponse>(
        `${env.VITE_APP_SERVER}/upload-file`,
        form,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: (e) => {
            params.onProgress?.(Math.round((e.loaded * 100) / (e.total || 1)));
          },
        }
      );
      return data;
    },
  });
};
