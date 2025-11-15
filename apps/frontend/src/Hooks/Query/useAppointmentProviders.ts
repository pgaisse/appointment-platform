import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthFetch } from "@/api/authFetch";

export interface AppointmentProvider {
  _id: string;
  appointment: string;
  provider: string | {
    _id: string;
    firstName: string;
    lastName: string;
    color?: string;
  };
  slotId: string;
  startDate: Date | string;
  endDate: Date | string;
  context?: string;
  org_id: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateAppointmentProviderData {
  appointment: string;
  provider: string;
  slotId?: string; // Make optional to handle cases where we don't have a valid ObjectId
  startDate: Date | string;
  endDate: Date | string;
  context?: string;
}

export interface UpdateAppointmentProviderData {
  provider?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  context?: string;
}

// Get appointment providers by appointment ID
export function useAppointmentProviders(appointmentId?: string) {
  const { authFetch } = useAuthFetch();
  
  return useQuery({
    queryKey: ["appointment-providers", appointmentId],
    queryFn: async (): Promise<AppointmentProvider[]> => {
      if (!appointmentId) return [];
      const result = await authFetch(`/api/appointment-providers?appointment=${appointmentId}`);
      console.log('Fetched appointment providers:', result);
      return result;
    },
    enabled: !!appointmentId,
    staleTime: 0, // Always refetch when invalidated
    refetchOnWindowFocus: true,
  });
}

// Get provider appointments by provider ID
export function useProviderAppointments(providerId?: string) {
  const { authFetch } = useAuthFetch();
  
  return useQuery({
    queryKey: ["provider-appointments", providerId],
    queryFn: async (): Promise<AppointmentProvider[]> => {
      if (!providerId) return [];
      return await authFetch(`/api/appointment-providers?provider=${providerId}`);
    },
    enabled: !!providerId,
  });
}

// Get single appointment provider
export function useAppointmentProvider(id?: string) {
  const { authFetch } = useAuthFetch();
  
  return useQuery({
    queryKey: ["appointment-provider", id],
    queryFn: async (): Promise<AppointmentProvider> => {
      if (!id) throw new Error('ID is required');
      return await authFetch(`/api/appointment-providers/${id}`);
    },
    enabled: !!id,
  });
}

// Create appointment provider
export function useCreateAppointmentProvider() {
  const queryClient = useQueryClient();
  const { authFetch } = useAuthFetch();
  
  return useMutation({
    mutationFn: async (data: CreateAppointmentProviderData): Promise<AppointmentProvider> => {
      return await authFetch('/api/appointment-providers', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: async (data) => {
      // Invalidate and refetch related queries
      await queryClient.invalidateQueries({ queryKey: ["appointment-providers", data.appointment] });
      await queryClient.invalidateQueries({ queryKey: ["provider-appointments", String(data.provider)] });
      await queryClient.invalidateQueries({ queryKey: ["DraggableCards"] });
      await queryClient.invalidateQueries({ queryKey: ["Appointment"] });
    },
  });
}

// Update appointment provider
export function useUpdateAppointmentProvider() {
  const queryClient = useQueryClient();
  const { authFetch } = useAuthFetch();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      data 
    }: { 
      id: string; 
      data: UpdateAppointmentProviderData; 
    }): Promise<AppointmentProvider> => {
      return await authFetch(`/api/appointment-providers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: async (data, variables) => {
      // Invalidate related queries
      await queryClient.invalidateQueries({ queryKey: ["appointment-provider", variables.id] });
      await queryClient.invalidateQueries({ queryKey: ["appointment-providers", data.appointment] });
      await queryClient.invalidateQueries({ queryKey: ["provider-appointments", String(data.provider)] });
      await queryClient.invalidateQueries({ queryKey: ["DraggableCards"] });
      await queryClient.invalidateQueries({ queryKey: ["Appointment"] });
    },
  });
}

// Delete appointment provider
export function useDeleteAppointmentProvider() {
  const queryClient = useQueryClient();
  const { authFetch } = useAuthFetch();
  
  return useMutation({
    mutationFn: async (id: string): Promise<{ success: boolean; message: string }> => {
      return await authFetch(`/api/appointment-providers/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: async (_, id) => {
      // Invalidate all related queries since we don't have the deleted data
      await queryClient.invalidateQueries({ queryKey: ["appointment-provider", id] });
      await queryClient.invalidateQueries({ queryKey: ["appointment-providers"] });
      await queryClient.invalidateQueries({ queryKey: ["provider-appointments"] });
      await queryClient.invalidateQueries({ queryKey: ["DraggableCards"] });
      await queryClient.invalidateQueries({ queryKey: ["Appointment"] });
    },
  });
}