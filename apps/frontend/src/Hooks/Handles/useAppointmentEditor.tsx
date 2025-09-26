// Hooks/useAppointmentEditor.tsx
import {
  useDisclosure, Drawer, DrawerOverlay, DrawerContent, DrawerHeader,
  DrawerBody, DrawerCloseButton
} from "@chakra-ui/react";
import { useState } from "react";
import type { RefetchOptions, QueryObserverResult } from "@tanstack/react-query";
import useEventSelection from "@/Hooks/Handles/useEventSelection";
import useSlotSelection, { DateRange, MarkedEvents } from "@/Hooks/Handles/useSlotSelection";
import { Appointment } from "@/types";
import CustomEntryForm from "@/Components/CustomTemplates/CustomEntryForm";
import { PageResp } from "../Query/useAppointmentsPaginated";

type Refetcher = (options?: RefetchOptions) => Promise<QueryObserverResult<any, Error>>;

type UseAppointmentEditorOpts = {
  titlePrefix?: string;
  // 👉 Pasa aquí el refetch real de React Query
  refetcher?: Refetcher;
  // Opcional: se ejecuta después del refetch
  onSaved?: () => void;
  refetchPage: (options?: RefetchOptions | undefined) => Promise<QueryObserverResult<PageResp<Appointment>, Error>>
};

export function useAppointmentEditor(opts: UseAppointmentEditorOpts = {
  refetchPage: function (options?: RefetchOptions | undefined): Promise<QueryObserverResult<PageResp<Appointment>, Error>> {
    throw new Error("Function not implemented.");
  }
}) {
  const { titlePrefix = "Edit Patient", refetcher, onSaved, refetchPage } = opts;

  const disclosure = useDisclosure();
  const [current, setCurrent] = useState<Appointment | null>(null);

  const [selectedAppDates, setSelectedAppDates] = useState<DateRange[]>([]);
  const [markedAppEvents, setMarkedAppEvents] = useState<MarkedEvents>([]);
  const { handleSelectSlot: handleAppSelectSlot } = useSlotSelection(
    false, selectedAppDates, setSelectedAppDates, markedAppEvents, setMarkedAppEvents
  );
  const { handleSelectEvent: handleAppSelectEvent } = useEventSelection(
    setSelectedAppDates, setMarkedAppEvents, markedAppEvents
  );

  const openEditor = (appt: Appointment) => {
    setCurrent(appt);
    setSelectedAppDates(appt.selectedAppDates ?? []);
    setMarkedAppEvents([]);
    disclosure.onOpen();
  };

  const closeEditor = () => disclosure.onClose();

  // Envolvemos el refetch para disparar onSaved() después
  const wrappedRefetch: Refetcher | undefined = refetcher
    ? async (opts?: RefetchOptions) => {
      const r = await refetcher(opts);
      onSaved?.();
      return r;
    }
    : undefined;

  const AppointmentEditor = () => (
    <Drawer isOpen={disclosure.isOpen} onClose={closeEditor} placement="right" size="xl">
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader>
          {titlePrefix} {current?.nameInput ?? ""}
        </DrawerHeader>
        <DrawerBody px={2} pb={6}>
          {current && (
            <CustomEntryForm
              // ✅ ahora pasamos el tipo correcto
              rfetchPl={wrappedRefetch}
              refetch_list={wrappedRefetch}
              onClose_1={closeEditor}
              toastInfo={{ title: "Patient edited", description: "The patient was edited successfully" }}

              title={`${titlePrefix} ${current.nameInput ?? ""}`}
              btnName="Update"
              mode="EDITION"
              refetchPage={refetchPage}
              markedEvents={[]}
              handleAppSelectEvent={handleAppSelectEvent}
              handleAppSelectSlot={handleAppSelectSlot}
              markedAppEvents={markedAppEvents}
              nameVal={current.nameInput}
              lastNameVal={current.lastNameInput}
              phoneVal={current.phoneInput}
              emailVal={current.emailInput}
              reschedule={current.reschedule}
              priorityVal={current.priority}
              note={current.note}
              datesSelected={current.selectedDates}
              idVal={current._id}
              dates={current.selectedDates}
              datesApp={selectedAppDates}
              setDatesApp={setSelectedAppDates}
              datesAppSelected={current.selectedAppDates}
              treatmentBack={current.treatment}
            />
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );

  return { openEditor, closeEditor, AppointmentEditor, isOpen: disclosure.isOpen };
}
