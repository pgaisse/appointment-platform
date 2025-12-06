import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { GroupedAppointment } from "@/types";

export const useDraggableCards = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  return useQuery<GroupedAppointment[]>({
    queryKey: ["DraggableCards"],
    queryFn: async () => {
      if (!isAuthenticated) throw new Error("Usuario no autenticado");

      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        },
      });

      const res = await axios.get(
        `${import.meta.env.VITE_BASE_URL}/DraggableCards`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log("🔄 useDraggableCards response:", {
        totalGroups: res.data?.length,
        totalPatients: res.data?.reduce((sum: number, g: any) => sum + (g.patients?.length || 0), 0),
        completeSlots: res.data?.flatMap((g: any) => 
          g.patients?.flatMap((p: any) => 
            p.selectedAppDates?.filter((s: any) => s.status === 'Complete')
          ) || []
        ).length
      });

      return res.data;
    },
    enabled: isAuthenticated, // ya no depende de un estado externo
    refetchOnWindowFocus: false,
    staleTime: 0, // ✅ 0 para refrescar inmediatamente después de Complete
  });
};
