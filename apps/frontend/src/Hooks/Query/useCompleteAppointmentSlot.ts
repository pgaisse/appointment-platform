import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useToast } from '@chakra-ui/react';
import { useAuth0 } from '@auth0/auth0-react';

interface CompleteSlotPayload {
  appointmentId: string;
  slotId: string;
}

export const useCompleteAppointmentSlot = () => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { getAccessTokenSilently } = useAuth0();

  return useMutation({
    mutationFn: async ({ appointmentId, slotId }: CompleteSlotPayload) => {
      console.log('🎯 [useCompleteAppointmentSlot] Marking slot as complete:', {
        appointmentId,
        slotId,
      });

      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        },
      });

      const response = await axios.patch(
        `/api/appointment-manager/${appointmentId}/complete-slot`,
        { slotId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    },

    onMutate: async ({ appointmentId, slotId }) => {
      console.log('🔄 [useCompleteAppointmentSlot] Optimistic update...');

      // Cancel outgoing queries
      await queryClient.cancelQueries({
        predicate: (query) => {
          const key = query.queryKey as any[];
          return (
            Array.isArray(key) &&
            (key[0] === 'DraggableCards' ||
              key[0] === 'calendar-appointments' ||
              key[0] === 'Appointment')
          );
        },
      });

      // Optimistically update DraggableCards
      queryClient.setQueriesData(
        {
          predicate: (query) => {
            const key = query.queryKey as any[];
            return Array.isArray(key) && key[0] === 'DraggableCards';
          },
        },
        (oldData: any) => {
          if (!Array.isArray(oldData)) return oldData;

          return oldData.map((col: any) => ({
            ...col,
            patients: col.patients.map((appt: any) => {
              if (String(appt._id) !== String(appointmentId)) return appt;

              return {
                ...appt,
                selectedAppDates: appt.selectedAppDates?.map((slot: any) => {
                  if (String(slot._id) !== String(slotId)) return slot;
                  return { ...slot, status: 'Complete' };
                }),
              };
            }),
          }));
        }
      );

      console.log('✅ [useCompleteAppointmentSlot] Optimistic update applied');
    },

    onSuccess: (data) => {
      console.log('✅ [useCompleteAppointmentSlot] Slot marked as complete:', data);

      toast({
        title: 'Appointment Completed',
        description: 'The appointment slot has been marked as complete.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    },

    onError: (error: any) => {
      console.error('❌ [useCompleteAppointmentSlot] Error:', error);

      toast({
        title: 'Error',
        description: error?.response?.data?.error || 'Failed to complete appointment slot',
        status: 'error',
        duration: 4000,
        isClosable: true,
      });

      // Invalidate to refetch fresh data
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey as any[];
          return (
            Array.isArray(key) &&
            (key[0] === 'DraggableCards' ||
              key[0] === 'calendar-appointments' ||
              key[0] === 'Appointment')
          );
        },
      });
    },

    onSettled: () => {
      console.log('✅ [useCompleteAppointmentSlot] Mutation settled');
    },
  });
};
