import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { env, GroupedAppointment } from "@/types";

export const useDraggableCards = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  return useQuery<GroupedAppointment[]>({
    queryKey: ["DraggableCards"],
    queryFn: async () => {
      if (!isAuthenticated) throw new Error("Usuario no autenticado");

      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: env.AUTH0_AUDIENCE,
        },
      });

      const res = await axios.get(
        `${env.VITE_APP_SERVER}/DraggableCards`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return res.data;
    },
    enabled: isAuthenticated, // ya no depende de un estado externo
    refetchOnWindowFocus: false,
    staleTime:0, // 5 minutos
  });
};
