import CustomCalendar from "@/Components/Scheduler/CustomCalendar";
import useEventSelection from "@/Hooks/Handles/useEventSelection";
import { DateRange, MarkedEvents } from "@/Hooks/Handles/useSlotSelection";
import { Box, Grid, Text, useDisclosure } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { SlotInfo } from "react-big-calendar";

import CustomButtonGroup from "@/Components/Form/CustomButtonGroup";
import { usePriorityTreatments } from "@/Hooks/Query/usePriorityTreatments";
import { useTreatments } from "@/Hooks/Query/useTreatments";
import CustomEventContent from "@/Components/Scheduler/CustomEventContent";
import CustomEventContentFlex from "@/Components/Scheduler/CustomEventContentFlex";
import { AppointmentGroup, BackendEvent, Patients } from "@/types";
import CustomModal from "@/Components/Modal/CustomModal";
import AvailabilityDates2 from "@/Components/CustomTemplates/AvailabilityDates2";
import CustomCalendarv2 from "@/Components/Scheduler/CustomCalendarv2";
import { useGetCollection } from "@/Hooks/Query/useGetCollection";




function PriorityList() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_selectedDates, setSelectedDates] = useState<DateRange[]>([]);
  const [markedEvents, setMarkedEvents] = useState<MarkedEvents>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [customEvents, setCustomEvents] = useState<MarkedEvents>([])
  const [customEventsFlex, setCustomEventsFlex] = useState<Patients>()
  const { handleSelectEvent } = useEventSelection(setSelectedDates, setMarkedEvents, markedEvents, setCustomEvents);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [range, setRange] = useState<DateRange | null>(null);
  const handleSelectSlot = (slotInfo: SlotInfo) => {
    //const { start, end } = slotInfo;
    const newRange: DateRange = {
      startDate: slotInfo.start,
      endDate: slotInfo.end,
    };
    setRange(newRange)


  };
  const [catSelected, setCatSelected] = useState<string>("")
  //console.log(catSelected)
  const start = range?.startDate
  const end = range?.endDate
  const { data: data2, isFetching: isF, refetch: rfch } = usePriorityTreatments(range?.startDate, range?.endDate, catSelected, false)
  const query = {};
  const limit = 20;
  const params = { start, end } // solo frontend
  const { data: options, isSuccess, isFetching } = useGetCollection<AppointmentGroup[]>("PriorityList", { query, limit, params });
  console.log("option", options)
  console.log("data2", data2)

  useEffect(() => {
    onOpen()
    if (data2 == "null" && range?.startDate && range?.endDate && !isF) {

    }
    else if (range?.startDate && range?.endDate && !isF) {
      if (Array.isArray(data2)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any



        const newEvent: MarkedEvents = [{
          num: 0,
          name: "null",
          lastName: "null",
          title: "",
          start: new Date(range.startDate),
          end: new Date(range.endDate),
          desc: "",
          color: "rgba(0, 123, 255, 0.9)",
          data: data2[0],
        }];
        setMarkedEvents(newEvent);

      }
    }
  }, [data2, range, isF, catSelected]);

  //console.log("CustomEvent", customEvents)


  const handleClose = () => {
    onClose()
    setMarkedEvents([])
  }

  useEffect(() => {
  }, [markedEvents]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [currentDate, _setCurrentDate] = useState(new Date());

  return (
    <>

      <Grid
        templateColumns={{ base: "90%", md: "100%" }}
        templateRows="auto auto"
        gap={4}
        width="100%">
        <Box p={4}>
          {/* Contenedor 1 */}
          <Box p={4}>
            <CustomCalendarv2 height="80vh"
              date={currentDate}
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              events={markedEvents}
            />

          </Box>
          <Box>

          </Box>
        </Box>
        <Box p={4} display={{ base: "none", md: "block" }}>
          {/* Contenedor 2 */}




          <Box p={3}>

          </Box>
        </Box>


        <Box p={4}>


        </Box>

        <Box p={4}>
          {data2 && <CustomModal isOpen_={isOpen} onClose_={handleClose} size={"6xl"}>
            <CustomEventContentFlex event={data2} />
          </CustomModal>}
        </Box>
      </Grid>
    </>
  );
}

export default PriorityList;
