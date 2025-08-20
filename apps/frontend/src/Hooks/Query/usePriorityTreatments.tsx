import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";
import { AppointmentGroup, env } from "@/types";

const fetchTreatments = async (token: string, startDate: Date, endDate: Date, category: string, reschedule: boolean = false) => {
  const res = await axios.get(`${env.BASE_URL}/sorting`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params: {
      startDate,
      endDate,
      category,
      reschedule,
    },
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
            audience: env.AUTH0_AUDIENCE,
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
    queryKey: ["priority", startDate?.toISOString(), endDate?.toISOString(), category],
    queryFn: () => fetchTreatments(token!, startDate!, endDate!, category!, reschedule!),
    enabled,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });

  return { data, isLoading, error, refetch, isSuccess, isPlaceholderData, isFetching };
};
