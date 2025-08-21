import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";
import { DateRange } from "../Handles/useSlotSelection";
import { env } from "@/types";

const fetchAppointments = async (token: string, reschedule: boolean = false, currentDate?: DateRange) => {
  const res = await axios.get(`${import.meta.env.VITE_BASE_URL}/appointmentsgeneralview`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params: {
      reschedule,
      ...(currentDate && {
        startDate: currentDate.startDate.toISOString(),
        endDate: currentDate.endDate.toISOString(),
      }),
    },
  });

  return res.data;
};

export const useAppointmentsGeneralView = (reschedule: boolean = false) => {
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
        //console.log("Token obtenido:", token);
        setToken(token);
      }
    };
    getToken();
  }, [getAccessTokenSilently, isAuthenticated]);

  return useQuery({
    queryKey: ["appointments"],
    queryFn: () => fetchAppointments(token!),
    enabled: !!token, // <- Solo ejecuta cuando hay token
    refetchOnWindowFocus: false,
  });
};
