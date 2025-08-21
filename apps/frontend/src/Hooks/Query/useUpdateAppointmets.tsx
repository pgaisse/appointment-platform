// hooks/useUpdateAppointments.ts
import {
  QueryObserverResult,
  RefetchOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { env } from "@/types";


// Función para enviar todo el array en una sola solicitud PUT
const editItems = async ({
  updates,
  token,
}: {
  updates: UpdateData[];
  token: string;
}) => {
  const res = await axios.put(
    `${import.meta.env.VITE_BASE_URL}/appointmentsid`,
    updates,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return res.data;
};

type Props = {
  refetch?: (
    options?: RefetchOptions
  ) => Promise<QueryObserverResult<unknown, Error>>;
};

export const useUpdateAppointments = ({ refetch }: Props) => {
  const queryClient = useQueryClient();
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  const { mutate, isPending, error } = useMutation({
    mutationFn: async (updates: UpdateData[]): Promise<unknown> => {
      if (!isAuthenticated) throw new Error("Usuario no autenticado");

      const isOnlyEmptyObject =
        updates.length === 1 &&
        updates[0]._id === "" &&
        updates[0].position === "" &&
        updates[0].textAreaInput === "";

      if (isOnlyEmptyObject) return;

      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        },
      });

      return await editItems({ updates, token });
    },

    // ✅ Actualización optimista
    onMutate: async (newData: UpdateData[]) => {
      await queryClient.cancelQueries({ queryKey: ["items"] });

      const previousData = queryClient.getQueryData(["items"]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      queryClient.setQueryData(["items"], (old: any) => {
        if (!old) return old;
        const newState = structuredClone(old);
        for (const update of newData) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const index = newState.findIndex((i: any) => i._id === update._id);
          if (index !== -1) {
            newState[index] = {
              ...newState[index],
              position: update.position,
              textAreaInput: update.textAreaInput,
            };
          }
        }
        return newState;
      });

      return { previousData };
    },

    onError: (_error, _newData, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["items"], context.previousData);
      }
    },

    onSettled: async () => {
      queryClient.invalidateQueries({ queryKey: ["items"] }); // 👈 Ahora sí se reconoce
    },
  });

  return { mutate, isPending, error, refetch };
};
