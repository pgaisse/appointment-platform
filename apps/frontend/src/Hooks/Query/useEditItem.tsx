import {
  QueryObserverResult,
  RefetchOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { env } from "@/types";

const editItem = async ({
  id,
  data,
  token,
  model,
}: {
  id: string;
  data: unknown;
  token: string;
  model: string;
}) => {
  const res = await axios.put(
    `${env.VITE_APP_SERVER}/edit/${id}`,
    data,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Model": model,  // Enviar model como header
      },
    }
  );
  return res.data;
};

type Props = {
  model: string;
  refetch?: (
    options?: RefetchOptions
  ) => Promise<QueryObserverResult<unknown, Error>>;
};

export const useEditItem = ({ model, refetch }: Props) => {
  const queryClient = useQueryClient();
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  const { mutate, isPending, error } = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: unknown;
    }) => {
      if (!isAuthenticated) throw new Error("Usuario no autenticado");

      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: env.AUTH0_AUDIENCE,
        },
      });

      return await editItem({ id, data, token, model });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      if (refetch) refetch();
    },
  });

  return { mutate, isPending, error };
};
