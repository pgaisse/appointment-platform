// hooks/useUpdateCategories.ts
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
  updates: { _id: string; id: number }[];
  token: string;
}) => {
  const res = await axios.put(
    `${env.BASE_URL}/categoriesid`,
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

export const useUpdateCategories = ({ refetch }: Props) => {
  const queryClient = useQueryClient();
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  const { mutate, isPending, error } = useMutation({
    mutationFn: async (
      updates: { _id: string; id: number }[]
    ): Promise<unknown> => {
      if (!isAuthenticated) throw new Error("Usuario no autenticado");

      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: env.AUTH0_AUDIENCE,
        },
      });

      return await editItems({ updates, token });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      if (refetch) refetch();
    },
  });

  return { mutate, isPending, error };
};
