"use client";

import CustomEntryForm from "@/Components/CustomTemplates/CustomEntryForm";
import useEventSelection from "@/Hooks/Handles/useEventSelection";
import useSlotSelection, { DateRange, MarkedEvents } from "@/Hooks/Handles/useSlotSelection";
import { TimeBlock, WeekDay } from "@/types";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useState } from "react";
dayjs.extend(utc);


export default function Multistep() {


  const [] = useState<Partial<Record<WeekDay, TimeBlock[]>>>({});
  const [selectedDates, setSelectedDates] = useState<DateRange[]>([]);
  const [markedEvents, setMarkedEvents] = useState<MarkedEvents>([]);

  useSlotSelection(false, selectedDates, setSelectedDates, markedEvents, setMarkedEvents);
  useEventSelection(setSelectedDates, setMarkedEvents, markedEvents);

  //Manejadores de fecha para appointment
  const [selectedAppDates, setSelectedAppDates] = useState<DateRange[]>([]);
  const [markedAppEvents, setMarkedAppEvents] = useState<MarkedEvents>([]);


  const { handleSelectSlot: handleAppSelectSlot } = useSlotSelection(false, selectedAppDates, setSelectedAppDates, markedAppEvents, setMarkedAppEvents);
  const { handleSelectEvent: handleAppSelectEvent } = useEventSelection(setSelectedAppDates, setMarkedAppEvents, markedAppEvents);



  const toastInfo = { title: "Patient added", description: "The patient was added successfully" }


  // console.log("CustomCalendar rendered 1", markedEvents);
  return (
    <>
      <CustomEntryForm
        handleAppSelectEvent={handleAppSelectEvent}
        handleAppSelectSlot={handleAppSelectSlot}
        markedAppEvents={markedAppEvents}
        toastInfo={toastInfo}
        mode={"CREATION"}
        datesApp={selectedAppDates}
        setDatesApp={setSelectedAppDates}
        onlyPatient={false} 

      >
      </CustomEntryForm>



    </>
  );
}
