import {
  QueryObserverResult,
  RefetchOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";

/**
 * Función que elimina un documento genérico en base al ID y modelo
 */
const deleteItem = async (
  id: string,
  modelName: string,
  token: string
): Promise<{ message: string; deletedId: string }> => {
  const response = await axios.delete(
    `${import.meta.env.VITE_APP_SERVER}/${id}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        modelName, // 👈 Enviado en el body como lo espera el backend
      },
    }
  );
  return response.data;
};

type Props = {
  modelName: string;
  refetch?: (
    options?: RefetchOptions
  ) => Promise<QueryObserverResult<unknown, Error>>;
};

/**
 * Hook reutilizable para eliminar documentos por ID
 */
export const useDeleteItem = ({ modelName, refetch }: Props) => {
  const queryClient = useQueryClient();
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  const {
    mutate: deleteById,
    isPending,
    error,
  } = useMutation({
    mutationFn: async (id: string) => {
      if (!isAuthenticated) throw new Error("Usuario no autenticado");
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        },
      });
      return await deleteItem(id, modelName, token);
    },
    onSuccess: (_, id) => {
      // 👇 Invalida cualquier caché asociada
      queryClient.invalidateQueries({ queryKey: [modelName] });
      if (refetch) refetch();
      console.info(`✅ Documento ${id} eliminado correctamente de ${modelName}`);
    },
    onError: (err) => {
      console.error("❌ Error al eliminar documento:", err);
    },
  });

  return {
    deleteById,
    isPending,
    error,
  };
};
