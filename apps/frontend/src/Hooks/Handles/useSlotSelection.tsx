import { useState, useCallback, useEffect } from "react";
import { usePriorityTreatments } from "../Query/usePriorityTreatments";
import formateTextWithDate from "./formateTextWithDate";
import React from "react";
export interface DateRange {
  startDate: Date;
  endDate: Date;
}
export type MarkedEvent = {
  title: string;
  start: Date;
  end: Date;
  desc: string;
  num: number;
  name: string;
  lastName: string;
  color: string;
  data?: Record<string, unknown>[];
  selectedStart?: Date
  selectedEnd?: Date
  otherData?: unknown
  priorityColor?: string
  id?: string
  // Add any other custom properties your events have
};

export type MarkedEvents = MarkedEvent[];

export default function useSlotSelection(

  autoFind: boolean,
  selectedDates?: DateRange[] | undefined,
  setSelectedDates?: React.Dispatch<React.SetStateAction<DateRange[]>>,
  markedEvents?: MarkedEvents,
  setMarkedEvents?: React.Dispatch<React.SetStateAction<MarkedEvents>>,
  offset?: number) {
  const [offsetState, setOffsetState] = useState<number>(offset ?? 0.25);

  useEffect(() => {
    if (offset !== 0) {
      setOffsetState(offset ?? 0.25);
    }
  }, [offset]);
console.log("offset desde slotSelection",offset)
  const [range, setRange] = useState<DateRange | null>(null);
  const { data, isLoading, refetch, isSuccess, isFetching, isPlaceholderData }
    = usePriorityTreatments(range?.startDate, range?.endDate)

  //console.log("data",data)

  const handleSelectSlot = useCallback((slotInfo: { start: Date; end: Date }) => {
    const min = new Date(2025, 0, 1, 9, 30);
    if (slotInfo.start.getHours() < min.getHours()) return;

    const newRange: DateRange = !offset ? {
      startDate: slotInfo.start,
      endDate: slotInfo.end,
    } : {
      startDate: slotInfo.start,
      endDate: new Date(
        slotInfo.start.getTime() + offsetState * 60 * 60 * 1000
      )
    }

    console.log("newRange",newRange, offsetState)
    if (autoFind) {
      setRange(newRange); // esto actualiza el hook de React Query
      refetch();
    }

    if (setSelectedDates) setSelectedDates((prevSelectedDates) => [...prevSelectedDates, newRange]);

  }, [autoFind, offset]);


  // useEffect para el modo manual (autoFind = false)
  useEffect(() => {
    if (!autoFind) {
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
    }
  }, [selectedDates, autoFind]);

  // useEffect separado para el modo autoFind (después de que llegan los datos)
  useEffect(() => {
    if (!autoFind || !isSuccess || isFetching || !data?.[0] || isPlaceholderData) return;

    const patient = data[0];
    const latest = selectedDates?.[selectedDates.length - 1];
    if (!latest) return;

    const existsInSelected = selectedDates.some(
      d => d.startDate.getTime() === latest.startDate.getTime() && d.endDate.getTime() === latest.endDate.getTime()
    );

    if (!existsInSelected) return; // prevenir reinserción de eventos eliminados

    const { formattedText } = formateTextWithDate({ text: patient.R });
    const newEvent = {
      num: latest.startDate.getTime() + latest.endDate.getTime(),
      name: patient.nameInput,
      lastName: patient.lastNameInput,
      title: `${patient.nameInput} 1`,
      start: latest.startDate,
      end: latest.endDate,
      desc: formattedText,
      color: patient.color ?? "blue.400"
    };

    const alreadyExists = markedEvents?.some(
      e => e.start.getTime() === newEvent.start.getTime() && e.end.getTime() === newEvent.end.getTime()
    );

    if (!alreadyExists && setMarkedEvents) {
      setMarkedEvents(prev => [...prev, newEvent]);
    }
  }, [data, isSuccess, isFetching, selectedDates, autoFind, isPlaceholderData]);


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
