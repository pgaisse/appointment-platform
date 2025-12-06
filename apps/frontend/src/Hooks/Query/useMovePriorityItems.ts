// apps/frontend/src/Hooks/Query/useMovePriorityItems.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth0 } from '@auth0/auth0-react';

export type PriorityMove = {
  id: string;            // _id del Appointment
  position?: number;     // nueva posición (0-based)
  priority?: string;     // nuevo ObjectId de Priority (si cambia de columna)
  slotId?: string;       // _id del slot específico dentro de selectedAppDates
};

type MoveBody = { moves: PriorityMove[] };

const movePriorityItems = async ({ body, token }: { body: MoveBody; token: string }) => {
  const res = await axios.patch(
    `${import.meta.env.VITE_BASE_URL}/priority-list/move`,
    body,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return res.data;
};

export const useMovePriorityItems = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (moves: PriorityMove[]) => {
      if (!isAuthenticated) throw new Error('Usuario no autenticado');
      if (!Array.isArray(moves) || moves.length === 0) throw new Error('No hay movimientos');

      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });

      // El componente ya hace el update optimista -> aquí solo golpeamos el backend
      return await movePriorityItems({ body: { moves }, token });
    },

    // No hacemos onMutate aquí para no duplicar el update optimista del componente
    onError: () => {
      // El componente se encargará del rollback con su snapshot
    },

    onSettled: () => {
      // Opcional: refetch para asegurar consistencia final
      queryClient.invalidateQueries({ queryKey: ['DraggableCards'] });
    },
  });
};
