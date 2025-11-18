import { ReactNode } from 'react';
import CreateLiquidTemplateForm from './CreateLiquidTemplateForm';
import ModalShell from './ModalShell';

type Props = {
  trigger: ReactNode;
  defaultCategory?: 'message' | 'confirmation';
  onCreated?: () => void;
  defaultAppointmentId?: string;
  selectedSlot?: { _id?: string; startDate?: string | Date; endDate?: string | Date };
  calendarSlot?: { startDate?: string | Date; endDate?: string | Date };
};

export default function CreateLiquidTemplateModal({ trigger, defaultCategory = 'message', onCreated, defaultAppointmentId, selectedSlot, calendarSlot }: Props) {
  return (
    <ModalShell trigger={trigger} title="New Template" size="5xl">
      <CreateLiquidTemplateForm onClose={() => {}} onCreated={onCreated} defaultCategory={defaultCategory} defaultAppointmentId={defaultAppointmentId} selectedSlot={selectedSlot} calendarSlot={calendarSlot} />
    </ModalShell>
  );
}
