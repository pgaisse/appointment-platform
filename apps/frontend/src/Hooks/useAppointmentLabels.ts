/**
 * Hook for managing shared labels between Organizer (Topics) and Appointments
 * Uses the Topic-based label system from Organizer for consistency across the platform
 * 
 * DATA FLOW:
 * 1. Labels are stored as subdocuments in Topic collection: Topic.labels[]
 * 2. Each label has: { id: string, name: string, color: LabelColor }
 * 3. Appointments store only the label.id strings in selectedAppDates[].labels[]
 * 4. Frontend does manual lookup: label.id → Topic.labels[].find(l => l.id === labelId)
 * 
 * BACKEND SCHEMA:
 * - Topic.labels: [{ id: string, name: string, color: string }] (embedded subdocs)
 * - Appointment.selectedAppDates[].labels: [string] (array of label.id references)
 * 
 * WHY NOT POPULATE:
 * Labels are embedded subdocuments, not a separate collection, so we can't use populate.
 * This is intentional for performance (fewer collections, faster queries).
 */
import { useTopics } from './useTopics';
import { useTopicLabels } from './useTopicLabels';
import type { LabelDef, LabelColor } from '@/types/kanban';

/**
 * Get shared labels for appointments and organizer
 * Uses the first available topic or creates a default "global" topic for labels
 */
export function useAppointmentLabels(_orgId?: string) {
  const { topics } = useTopics();
  const topicsList = topics.data ?? [];
  
  // Use first topic or null (labels hook will handle gracefully)
  // In production, you might want a dedicated "global" topic for organization-wide labels
  const defaultTopicId = topicsList[0]?.id ?? '';
  
  const { 
    labels, 
    createLabel, 
    updateLabel, 
    deleteLabel 
  } = useTopicLabels(defaultTopicId);

  // Return in the same format as before for compatibility
  return {
    labels: labels.data ?? [],
    labelsRaw: labels.data ?? [],
    isLoading: labels.isLoading,
    createLabel: {
      mutateAsync: async (data: { name: string; color: LabelColor }) => {
        await createLabel.mutateAsync(data as Omit<LabelDef, 'id'>);
      },
      isPending: createLabel.isPending,
    },
    updateLabel: {
      mutateAsync: async (labelId: string, patch: Partial<{ name: string; color: LabelColor }>) => {
        await updateLabel.mutateAsync({ labelId, patch: patch as Partial<Omit<LabelDef, 'id'>> });
      },
      isPending: updateLabel.isPending,
    },
    deleteLabel: {
      mutateAsync: async (labelId: string) => {
        await deleteLabel.mutateAsync(labelId);
      },
      isPending: deleteLabel.isPending,
    },
    refetch: labels.refetch,
  };
}

/**
 * Alias for consistency - both names point to the same shared label system
 */
export const useOrganizerLabels = useAppointmentLabels;
