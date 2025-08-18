import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";
import { DateRange } from "../Handles/useSlotSelection";
import { DataEvents } from "@/Components/CustomTemplates/CustomCardPatient";
import { env } from "@/types";



export type AppointmentsData  = {
  appointmentsList: DataEvents[];
  start: Date;
  end: Date;
};

const fetchAppointments = async (
  token: string,
  reschedule: boolean = false,
  currentDate?: DateRange
) => {
  const res = await axios.get(
    `${env.VITE_APP_SERVER}/appointments`,
    {
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
    }
  );

  return res.data;
};

export const useAppointments = (
  reschedule: boolean = false,
  currentDate?: DateRange
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
        setToken(token);
      }
    };
    getToken();
  }, [getAccessTokenSilently, isAuthenticated]);

  return useQuery<AppointmentsData[]>({
    queryKey: ["appointments", reschedule, currentDate],
    queryFn: () => fetchAppointments(token!, reschedule, currentDate),
    enabled: !!token,
    refetchOnWindowFocus: false,
  });
};
