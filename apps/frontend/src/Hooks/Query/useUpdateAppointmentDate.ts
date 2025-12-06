import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth0 } from '@auth0/auth0-react';
import axios from 'axios';

interface UpdateDatePayload {
  appointmentId: string;
  slotId: string;
  newStartDate: string;
  newEndDate: string;
  status?: string;
}

export const useUpdateAppointmentDate = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateDatePayload) => {
      if (!isAuthenticated) throw new Error('Usuario no autenticado');

      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        },
      });

      const res = await axios.patch(
        `${import.meta.env.VITE_BASE_URL}/calendar/update-date`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return res.data;
    },
    
    onMutate: async (payload) => {
      const { appointmentId, slotId, newStartDate, newEndDate, status } = payload;

      console.log('🔄 [useUpdateAppointmentDate] Starting optimistic update for slot', slotId);

      // 1. Cancel all calendar-appointments queries to avoid race conditions
      await queryClient.cancelQueries({ 
        predicate: (query) => {
          const key = query.queryKey as any[];
          return Array.isArray(key) && key[0] === 'calendar-appointments';
        }
      });

      // 2. Snapshot ALL calendar-appointments queries
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

        // Apply optimistic update
        const updated = data.map((apt: any) => {
          if (String(apt._id) !== String(appointmentId)) return apt;
          
          const slots = Array.isArray(apt.selectedAppDates) ? [...apt.selectedAppDates] : [];
          const idx = slots.findIndex((s: any) => String(s._id) === String(slotId));
          
          if (idx === -1) return apt;
          
          const updatedSlot = { 
            ...slots[idx],
            startDate: newStartDate,
            endDate: newEndDate,
          };
          
          if (status) updatedSlot.status = status;
          
          slots[idx] = updatedSlot;
          
          return { ...apt, selectedAppDates: slots };
        });

        queryClient.setQueryData(queryKey, updated);
      });

      console.log('✅ [useUpdateAppointmentDate] Optimistic update applied to', allRangeQueries.length, 'queries');

      return { previousData };
    },
    
    onError: (_err, _payload, context) => {
      console.error('❌ [useUpdateAppointmentDate] Error occurred, rolling back optimistic updates');
      
      // Rollback all queries
      const previousData = (context as any)?.previousData as Map<string, any> | undefined;
      if (previousData) {
        previousData.forEach((data, keyString) => {
          const queryKey = JSON.parse(keyString);
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    
    onSuccess: async (_data, variables) => {
      console.log('✅ [useUpdateAppointmentDate] Server confirmed update, updating cache with server data');
      
      // Update cache with the server response instead of refetching
      const { appointmentId, slotId, newStartDate, newEndDate, status } = variables;
      
      const allQueries = queryClient.getQueriesData({ 
        predicate: (query) => {
          const key = query.queryKey as any[];
          return Array.isArray(key) && key[0] === 'calendar-appointments';
        }
      });

      allQueries.forEach(([queryKey, cachedData]) => {
        if (!Array.isArray(cachedData)) return;

        const updated = cachedData.map((apt: any) => {
          if (String(apt._id) !== String(appointmentId)) return apt;
          
          const slots = Array.isArray(apt.selectedAppDates) ? [...apt.selectedAppDates] : [];
          const idx = slots.findIndex((s: any) => String(s._id) === String(slotId));
          
          if (idx === -1) return apt;
          
          // Update with confirmed data
          const updatedSlot = { 
            ...slots[idx],
            startDate: newStartDate,
            endDate: newEndDate,
          };
          
          if (status) updatedSlot.status = status;
          
          slots[idx] = updatedSlot;
          
          return { ...apt, selectedAppDates: slots };
        });

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

      console.log('✅ [useUpdateAppointmentDate] Cache updated with server confirmation');
    },
    
    onSettled: () => {
      console.log('✅ [useUpdateAppointmentDate] Mutation settled');
    },
  });
};
