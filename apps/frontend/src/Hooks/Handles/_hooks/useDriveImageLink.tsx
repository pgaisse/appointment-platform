import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";
import { env } from "@/types";

const fetchDriveImageLink = async (
  fileId: string,
  token: string
): Promise<string> => {
  const res = await axios.get(
    `${import.meta.env.VITE_APP_SERVER}/image-link/${fileId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return res.data.url; // ⬅️ el backend debe devolver { url: "..." }
};

export const useDriveImageLink = (fileId: string) => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const getToken = async () => {
      if (isAuthenticated) {
        const newToken = await getAccessTokenSilently({
          authorizationParams: {
            audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          },
        });
        setToken(newToken);
      }
    };
    getToken();
  }, [getAccessTokenSilently, isAuthenticated]);

  return useQuery<string>({
    queryKey: ["drive-image-link", fileId],
    queryFn: async () => fetchDriveImageLink(fileId, token!),
    enabled: !!fileId && !!token,
    refetchOnWindowFocus: false,
  });
};
