import { useState, useCallback, useEffect } from "react";
import { usePriorityTreatments } from "../Query/usePriorityTreatments";
import { DateRange, MarkedEvent } from "./useSlotSelection";

export type MarkedEvents = MarkedEvent[];

export default function useSimpleSlotSelection(
  offset?: number,
  selectedDates?: DateRange[] | undefined,
  setSelectedDates?: React.Dispatch<React.SetStateAction<DateRange[]>>,
  markedEvents?: MarkedEvents,
  setMarkedEvents?: React.Dispatch<React.SetStateAction<MarkedEvents>>
) {
  const [offsetState, setOffsetState] = useState<number>(offset ?? 0.25);

  useEffect(() => {
    if (offset !== undefined) {
      setOffsetState(offset);
    }
  }, [offset]);

  const [range, setRange] = useState<DateRange | null>(null);

  const {
    data,
    isLoading,
    refetch,
    isSuccess,
    isFetching,
    isPlaceholderData,
  } = usePriorityTreatments(range?.startDate, range?.endDate);

  const handleSelectSlot = useCallback(
    (slotInfo: { start: Date; end: Date }) => {
      const min = new Date(2025, 0, 1, 9, 30);
      if (slotInfo.start.getHours() < min.getHours()) return;

      const newRange: DateRange = {
        startDate: slotInfo.start,
        endDate: new Date(
          slotInfo.start.getTime() + offsetState * 60 * 60 * 1000
        ),
      };

      console.log(newRange, offsetState);

      if (setSelectedDates)
        setSelectedDates((prevSelectedDates) => [...prevSelectedDates, newRange]);
    },
    [offsetState, setSelectedDates]
  );

  useEffect(() => {
    const newMarkedEvents = selectedDates?.map((date, index: number) => ({
      title: ``,
      start: date.startDate,
      end: date.endDate,
      desc: "Date Selected",
      num: index + 1,
      name: `Selected`,
      lastName: `null`,
      color: "gray",
    }));
    if (newMarkedEvents && setMarkedEvents) setMarkedEvents(newMarkedEvents);
  }, [selectedDates, setMarkedEvents]);

  return {
    selectedDates,
    setSelectedDates,
    handleSelectSlot,
    markedEvents,
    setMarkedEvents,
    isSuccess,
    isLoading,
    isPlaceholderData,
    isFetching,
    data,
    refetch,
  };
}
