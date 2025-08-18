import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { env } from "@/types";

export type UpdatePayload = {
  table: string;
  id_field: string;
  id_value: string;
  data: { [key: string]: any };
};

const updateItems = async ({
  payload,
  token,
}: {
  payload: UpdatePayload[];
  token: string;
}) => {
  const res = await axios.patch(
    `${env.VITE_APP_SERVER}/update-items`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return res.data;
};

export const useUpdateItems = () => {
  const queryClient = useQueryClient();
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  return useMutation({
    mutationFn: async (payload: UpdatePayload[]) => {
      if (!isAuthenticated) throw new Error("Usuario no autenticado");

      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: env.AUTH0_AUDIENCE,
        },
      });

      return await updateItems({ payload, token });
    },

    // OPTIMISTIC UPDATE
    onMutate: async (updatedPayload) => {
      // Cancelar queries pendientes para evitar sobreescritura
      await queryClient.cancelQueries({ queryKey: ["items"] });

      // Guardar datos anteriores para rollback
      const previousData = queryClient.getQueryData<any>(["items"]);

      // Actualizar cache optimistamente
      queryClient.setQueryData(["items"], (oldData: any) => {
        if (!oldData) return oldData;

        // Por simplicidad asumo estructura array de columnas con .patients
        // Copia profunda superficial
        const newData = oldData.map((col: any) => {
          let patients = col.patients ? [...col.patients] : [];

          // Primero remover pacientes que van a moverse de esta columna
          updatedPayload.forEach((update) => {
            if (update.data.priority !== col._id) {
              // no es de esta columna, no toca
              return;
            }
            // Remover duplicados
            patients = patients.filter((p) => p._id !== update.id_value);
          });

          // Insertar pacientes actualizados en posición correcta
          updatedPayload
            .filter((u) => u.data.priority === col._id)
            .sort((a, b) => a.data.position - b.data.position)
            .forEach((u) => {
              // Buscar item actualizado en previousData
              const updatedItem = previousData
                .flatMap((c: any) => c.patients)
                .find((p: any) => p._id === u.id_value);

              if (updatedItem) {
                patients.splice(u.data.position, 0, updatedItem);
              }
            });

          return { ...col, patients };
        });

        return newData;
      });

      return { previousData };
    },

    onError: (err, variables, context) => {
      // Rollback si falla
      if (context?.previousData) {
        queryClient.setQueryData(["items"], context.previousData);
      }
    },

    onSettled: () => {
      // Refrescar cache siempre al terminar
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });
};
