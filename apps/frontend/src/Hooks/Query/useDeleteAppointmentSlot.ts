import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth0 } from '@auth0/auth0-react';
import axios from 'axios';

interface DeleteSlotPayload {
  appointmentId: string;
  slotId: string;
}

export const useDeleteAppointmentSlot = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: DeleteSlotPayload) => {
      if (!isAuthenticated) throw new Error('Usuario no autenticado');

      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        },
      });

      const res = await axios.delete(
        `${import.meta.env.VITE_BASE_URL}/calendar/slot`,
        {
          data: payload,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return res.data;
    },

    onMutate: async (payload) => {
      const { appointmentId, slotId } = payload;

      console.log('🔄 [useDeleteAppointmentSlot] Starting optimistic delete for slot', slotId);

      // Cancel all calendar-appointments queries
      await queryClient.cancelQueries({
        predicate: (query) => {
          const key = query.queryKey as any[];
          return Array.isArray(key) && key[0] === 'calendar-appointments';
        }
      });

      // Snapshot all calendar queries
      const previousData = new Map<string, any>();
      
      const allRangeQueries = queryClient.getQueriesData({
        predicate: (query) => {
          const key = query.queryKey as any[];
          return Array.isArray(key) && key[0] === 'calendar-appointments';
        }
      });

      allRangeQueries.forEach(([queryKey, data]) => {
        const keyString = JSON.stringify(queryKey);
        previousData.set(keyString, data);
        
        if (!Array.isArray(data)) return;

        // Optimistically remove the slot
        const updated = data
          .map((apt: any) => {
            if (String(apt._id) !== String(appointmentId)) return apt;
            
            const slots = Array.isArray(apt.selectedAppDates) ? [...apt.selectedAppDates] : [];
            const filtered = slots.filter((s: any) => String(s._id) !== String(slotId));
            
            // If no slots left, remove the appointment from this range query
            if (filtered.length === 0) return null;
            
            return { ...apt, selectedAppDates: filtered };
          })
          .filter(Boolean); // Remove nulls

        queryClient.setQueryData(queryKey, updated);
      });

      console.log('✅ [useDeleteAppointmentSlot] Optimistic delete applied to', allRangeQueries.length, 'queries');

      return { previousData };
    },

    onError: (_err, _payload, context) => {
      console.error('❌ [useDeleteAppointmentSlot] Error occurred, rolling back optimistic deletes');
      
      // Rollback
      const previousData = (context as any)?.previousData as Map<string, any> | undefined;
      if (previousData) {
        previousData.forEach((data, keyString) => {
          const queryKey = JSON.parse(keyString);
          queryClient.setQueryData(queryKey, data);
        });
      }
    },

    onSuccess: async (_data, variables) => {
      console.log('✅ [useDeleteAppointmentSlot] Server confirmed deletion, updating cache');
      
      const { appointmentId, slotId } = variables;
      
      // Confirm the deletion in cache
      const allQueries = queryClient.getQueriesData({
        predicate: (query) => {
          const key = query.queryKey as any[];
          return Array.isArray(key) && key[0] === 'calendar-appointments';
        }
      });

      allQueries.forEach(([queryKey, cachedData]) => {
        if (!Array.isArray(cachedData)) return;

        const updated = cachedData
          .map((apt: any) => {
            if (String(apt._id) !== String(appointmentId)) return apt;
            
            const slots = Array.isArray(apt.selectedAppDates) ? [...apt.selectedAppDates] : [];
            const filtered = slots.filter((s: any) => String(s._id) !== String(slotId));
            
            if (filtered.length === 0) return null;
            
            return { ...apt, selectedAppDates: filtered };
          })
          .filter(Boolean);

        queryClient.setQueryData(queryKey, updated);
      });

      // Invalidate related queries but don't refetch calendar-appointments
      await queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey as any[];
          if (!Array.isArray(key)) return false;
          const head = String(key[0]);
          return (
            head === 'appointments-month-days' ||
            head === 'Appointment' ||
            head === 'DraggableCards'
          );
        },
      });

      console.log('✅ [useDeleteAppointmentSlot] Cache updated with server confirmation');
    },

    onSettled: () => {
      console.log('✅ [useDeleteAppointmentSlot] Mutation settled');
    },
  });
};
