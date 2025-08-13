import { useCallback, useState } from "react";
import { SlotInfo } from "react-big-calendar";
import { MarkedEvents } from "./useSlotSelection";
import type React from "react";

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export default function useEventSelection(
  setSelectedDates: React.Dispatch<React.SetStateAction<DateRange[]>>,
  setMarkedEvents: React.Dispatch<React.SetStateAction<MarkedEvents>>,
  markedEvents: MarkedEvents,
  setCustomEvent?: React.Dispatch<React.SetStateAction<MarkedEvents>>,
  
) {
  const [selectedEvent, setSelectedEvent] = useState<MarkedEvents[number] | null>(null);

  const handleSelectEvent = useCallback(
    (slotInfo: SlotInfo) => {
      const eventStart = new Date(slotInfo.start).getTime();
      const eventEnd = new Date(slotInfo.end).getTime();

      // Se usa una copia local actualizada de markedEvents
      const matchedEvent = markedEvents?.find(
        (event) =>
          new Date(event.start).getTime() === eventStart &&
          new Date(event.end).getTime() === eventEnd
      );

      if (matchedEvent) {
        setSelectedEvent(matchedEvent);
        if (setCustomEvent) {
        setCustomEvent([]);}

        // Eliminar de fechas seleccionadas
        setSelectedDates(prev =>
          prev.filter(
            dateRange =>
              !(
                dateRange.startDate.getTime() === eventStart &&
                dateRange.endDate.getTime() === eventEnd
              )
          )
        );

        // Eliminar del arreglo de eventos usando el id único (num)
        setMarkedEvents(prev =>
          prev.filter(event => event.num !== matchedEvent.num)
        );
      }
    },
    [markedEvents, setSelectedDates, setMarkedEvents]
  );

  return {
    selectedEvent,
    handleSelectEvent,
    markedEvents
  };
}
