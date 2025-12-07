// apps/frontend/src/Hooks/Query/useAddAppointmentSlot.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthFetch } from '@/lib/authFetch';

type AddSlotPayload = {
  appointmentId: string;
  slotData: {
    startDate: string;
    endDate: string;
    priority: string;
    status?: string;
    duration?: number;
    needsScheduling?: boolean;
    position?: number;
  };
};

export const useAddAppointmentSlot = () => {
  const authFetch = useAuthFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ appointmentId, slotData }: AddSlotPayload) => {
      const response = await authFetch(`/api/appointment-manager/${appointmentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slotData
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add slot');
      }
      
      return response.json();
    },
    onSuccess: (_data, variables) => {
      // Invalidar todas las queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['DraggableCards'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['appointments-range'] });
      queryClient.invalidateQueries({ queryKey: ['Appointment', variables.appointmentId] });
    },
  });
};
