import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";
// no types needed here

const fetchTreatments = async (
  token: string,
  startDate: Date,
  endDate: Date,
  category: string,
  reschedule: boolean = false,
  signal?: AbortSignal
) => {
  const res = await axios.get(`${import.meta.env.VITE_BASE_URL}/sorting`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params: {
      startDate,
      endDate,
      category,
      reschedule,
    },
    // Allow React Query to cancel in-flight requests when params change
    signal,
    // Prevent hanging requests from blocking UI
    timeout: 15000,
  });
  const filtered = res.data.filter((item: any) => {
    return item.nameInput !== null && item.nameInput !== "null" && item.nameInput !== "";
  });


  return filtered;
};

export const usePriorityTreatments = (
  startDate?: Date,
  endDate?: Date,
  category?: string,
  reschedule?: boolean
) => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const getToken = async () => {
      if (isAuthenticated) {
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          },
        });
        //console.log("Token obtenido (priority):", token);
        setToken(token);
      }
    };
    getToken();
  }, [getAccessTokenSilently, isAuthenticated]);

  const enabled = !!startDate && !!endDate && !!token;

  const { data, isLoading, error, refetch, isSuccess, isPlaceholderData, isFetching } = useQuery({
    queryKey: ["priority", startDate?.toISOString(), endDate?.toISOString(), category, !!reschedule],
    queryFn: ({ signal }) => fetchTreatments(token!, startDate!, endDate!, category!, !!reschedule, signal),
    enabled,
    refetchOnWindowFocus: false,
    staleTime: 30_000, // keep for 30s to avoid immediate refetches on small changes
    placeholderData: (prev: any) => prev,
    retry: 1,
  });

  return { data, isLoading, error, refetch, isSuccess, isPlaceholderData, isFetching };
};
