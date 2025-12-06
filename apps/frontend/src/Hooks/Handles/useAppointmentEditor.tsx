// Hooks/useAppointmentEditor.tsx
import React, { useCallback, useMemo, useState } from "react";
import {
  useDisclosure,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerCloseButton,
} from "@chakra-ui/react";
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
  refetchPage: (
    options?: RefetchOptions | undefined
  ) => Promise<QueryObserverResult<PageResp<Appointment>, Error>>;
};

/* ----------------------------- Editor de UI ------------------------------ */

type EditorViewProps = {
  isOpen: boolean;
  titlePrefix: string;
  current: Appointment | null;

  closeEditor: () => void;

  wrappedRefetch?: Refetcher;
  refetchPage: (
    options?: RefetchOptions | undefined
  ) => Promise<QueryObserverResult<PageResp<Appointment>, Error>>;

  // selección y marcas
  selectedAppDates: DateRange[];
  setSelectedAppDates: React.Dispatch<React.SetStateAction<DateRange[]>>;
  markedAppEvents: MarkedEvents;
  handleAppSelectEvent: ReturnType<typeof useEventSelection>["handleSelectEvent"];
  handleAppSelectSlot: ReturnType<typeof useSlotSelection>["handleSelectSlot"];

  // arreglo vacío estable para props opcionales
  emptyMarked: MarkedEvents;
};

const EditorView = React.memo(function EditorView({
  isOpen,
  titlePrefix,
  current,
  closeEditor,
  wrappedRefetch,
  refetchPage,
  selectedAppDates,
  setSelectedAppDates,
  markedAppEvents,
  handleAppSelectEvent,
  handleAppSelectSlot,
  emptyMarked,
}: EditorViewProps) {
  const header = useMemo(
    () => `${titlePrefix} ${current?.nameInput ?? ""}`,
    [titlePrefix, current?.nameInput]
  );

  return (
    <Drawer isOpen={isOpen} onClose={closeEditor} placement="right" size="xl">
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader>{header}</DrawerHeader>
        <DrawerBody px={2} pb={6}>
          {current && (
            <CustomEntryForm
              // ✅ funciones memoizadas/estables
              rfetchPl={wrappedRefetch}
              refetch_list={wrappedRefetch}
              onClose_1={closeEditor}
              toastInfo={{
                title: "Patient edited",
                description: "The patient was edited successfully",
              }}
              title={header}
              btnName="Update"
              mode="EDITION"
              refetchPage={refetchPage}
              // ✅ ya no pasamos [] nuevo en cada render
              markedEvents={emptyMarked}
              handleAppSelectEvent={handleAppSelectEvent}
              handleAppSelectSlot={handleAppSelectSlot}
              markedAppEvents={markedAppEvents}
              // ✅ Valores del paciente/contacto
              nameVal={current.nameInput}
              lastNameVal={current.lastNameInput}
              phoneVal={current.phoneInput}
              emailVal={current.emailInput}
              idVal={current._id}
              note={current.note}
              reschedule={current.reschedule}
              conversationId={current.sid}
              contactPreference={current.contactPreference}
              phoneFieldReadOnly={false}
              // ✅ Valores del appointment (treatment, priority, dates)
              treatmentBack={current.treatment}
              priorityVal={current.priority}
              datesSelected={current.selectedDates}
              dates={current.selectedDates}
              datesAppSelected={current.selectedAppDates}
              datesApp={selectedAppDates}
              setDatesApp={setSelectedAppDates}
              // ✅ Providers y representative
              providers={current.providers}
              representative={current.representative}
            />
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
});

/* ------------------------------ Custom Hook ------------------------------ */

export function useAppointmentEditor(
  opts: UseAppointmentEditorOpts = {
    refetchPage: function (
      _options?: RefetchOptions | undefined
    ): Promise<QueryObserverResult<PageResp<Appointment>, Error>> {
      throw new Error("Function not implemented.");
    },
  }
) {
  const { titlePrefix = "Edit Patient", refetcher, onSaved, refetchPage } = opts;

  const disclosure = useDisclosure();
  const [current, setCurrent] = useState<Appointment | null>(null);

  const [selectedAppDates, setSelectedAppDates] = useState<DateRange[]>([]);
  const [markedAppEvents, setMarkedAppEvents] = useState<MarkedEvents>([]);

  const { handleSelectSlot } = useSlotSelection(
    false,
    selectedAppDates,
    setSelectedAppDates,
    markedAppEvents,
    setMarkedAppEvents
  );
  const { handleSelectEvent } = useEventSelection(
    setSelectedAppDates,
    setMarkedAppEvents,
    markedAppEvents
  );

  const emptyMarked = useMemo<MarkedEvents>(() => [], []);

  const openEditor = useCallback((appt: Appointment) => {
    // Solo setear estado inicial al ABRIR
    
    // ✅ Extraer treatment y priority del slot más reciente en selectedAppDates
    // Los campos del root están deprecados, ahora cada slot tiene su propio treatment/priority
    const slots = appt.selectedAppDates ?? [];
    let treatmentFromSlot = appt.treatment; // fallback
    let priorityFromSlot = appt.priority; // fallback
    
    if (slots.length > 0) {
      // Buscar el slot más reciente que tenga treatment y priority poblados
      const latestSlot = slots
        .filter((s: any) => s?.treatment || s?.priority)
        .sort((a: any, b: any) => {
          const aTime = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
          const bTime = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
          return bTime - aTime;
        })[0];
      
      if (latestSlot) {
        treatmentFromSlot = (latestSlot as any).treatment || treatmentFromSlot;
        priorityFromSlot = (latestSlot as any).priority || priorityFromSlot;
      }
    }
    
    // Actualizar el appointment con los valores correctos del slot
    const updatedAppt = {
      ...appt,
      treatment: treatmentFromSlot,
      priority: priorityFromSlot,
    };
    
    setCurrent(updatedAppt);
    setSelectedAppDates(slots);
    setMarkedAppEvents([]);
    disclosure.onOpen();
  }, [disclosure]);

  const closeEditor = useCallback(() => {
    disclosure.onClose();
  }, [disclosure]);

  // Envolvemos el refetch para disparar onSaved() después (referencia estable)
  const wrappedRefetch: Refetcher | undefined = useMemo(() => {
    if (!refetcher) return undefined;
    return async (opts?: RefetchOptions) => {
      const r = await refetcher(opts);
      onSaved?.();
      return r;
    };
  }, [refetcher, onSaved]);

  // Handlers con identidad estable (evita renders en hijos memoizados)
  const handleAppSelectSlot = useCallback<typeof handleSelectSlot>(
    (...args) => handleSelectSlot(...args),
    [handleSelectSlot]
  );

  const handleAppSelectEvent = useCallback<typeof handleSelectEvent>(
    (...args) => handleSelectEvent(...args),
    [handleSelectEvent]
  );

  // 🧱 Elemento JSX memoizado: úsalo como {AppointmentEditor}
  const AppointmentEditor = useMemo(
    () => (
      <EditorView
        isOpen={disclosure.isOpen}
        titlePrefix={titlePrefix}
        current={current}
        closeEditor={closeEditor}
        wrappedRefetch={wrappedRefetch}
        refetchPage={refetchPage}
        selectedAppDates={selectedAppDates}
        setSelectedAppDates={setSelectedAppDates}
        markedAppEvents={markedAppEvents}
        handleAppSelectEvent={handleAppSelectEvent}
        handleAppSelectSlot={handleAppSelectSlot}
        emptyMarked={emptyMarked}
      />
    ),
    [
      disclosure.isOpen,
      titlePrefix,
      current,
      closeEditor,
      wrappedRefetch,
      refetchPage,
      selectedAppDates,
      markedAppEvents,
      handleAppSelectEvent,
      handleAppSelectSlot,
      emptyMarked,
    ]
  );

  return {
    openEditor,
    closeEditor,
    // Render: {AppointmentEditor}  ← importante
    AppointmentEditor,
    isOpen: disclosure.isOpen,
  };
}
