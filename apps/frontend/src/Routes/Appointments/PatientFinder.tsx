import useEventSelection from "@/Hooks/Handles/useEventSelection";
import { DateRange, MarkedEvents } from "@/Hooks/Handles/useSlotSelection";
import { Box, Grid, useDisclosure } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { SlotInfo } from "react-big-calendar";
import LiquidTokenEditor from '@/Components/LiquidTokenEditor';

import { usePriorityTreatments } from "@/Hooks/Query/usePriorityTreatments";
import CustomEventContentFlex from "@/Components/Scheduler/CustomEventContentFlex";
// import { AppointmentGroup } from "@/types";
import CustomModal from "@/Components/Modal/CustomModal";
import CustomCalendarv2 from "@/Components/Scheduler/CustomCalendarv2";
// import { useGetCollection } from "@/Hooks/Query/useGetCollection";




function PriorityList() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_selectedDates, setSelectedDates] = useState<DateRange[]>([]);
  const [markedEvents, setMarkedEvents] = useState<MarkedEvents>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [, setCustomEvents] = useState<MarkedEvents>([])
  const { handleSelectEvent } = useEventSelection(setSelectedDates, setMarkedEvents, markedEvents, setCustomEvents);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [range, setRange] = useState<DateRange | null>(null);
  const handleSelectSlot = (slotInfo: SlotInfo) => {
    //const { start, end } = slotInfo;
    const newRange: DateRange = {
      startDate: slotInfo.start,
      endDate: slotInfo.end,
    };
    console.log('🎯 [PatientFinder] handleSelectSlot called:', {
      start: slotInfo.start,
      end: slotInfo.end,
      startISO: slotInfo.start.toISOString(),
      endISO: slotInfo.end.toISOString(),
    });
    setRange(newRange)


  };
  const [catSelected, _setCatSelected] = useState<string>("")
  //console.log(catSelected)
  // const start = range?.startDate
  // const end = range?.endDate
  console.log('🔍 [PatientFinder] Calling usePriorityTreatments:', {
    startDate: range?.startDate,
    endDate: range?.endDate,
    catSelected,
    hasRange: !!range,
  });
  const { data: data2, isFetching: isF } = usePriorityTreatments(range?.startDate, range?.endDate, catSelected, false)
  console.log('📊 [PatientFinder] usePriorityTreatments response:', {
    data: data2,
    isFetching: isF,
    dataType: typeof data2,
    isArray: Array.isArray(data2),
    dataLength: Array.isArray(data2) ? data2.length : 'N/A',
  });
  // Removed unused PriorityList fetch to avoid an extra heavy request on every selection
  // const query = {};
  // const limit = 20;
  // const params = { start, end } // solo frontend
  // const { data: _options } = useGetCollection<AppointmentGroup[]>("PriorityList", { query, limit, params });


  useEffect(() => {
    console.log('⚡ [PatientFinder] useEffect triggered:', {
      hasData: !!data2,
      data2Value: data2,
      hasRange: !!range,
      isFetching: isF,
      catSelected,
    });

    onOpen()
    if (data2 == "null" && range?.startDate && range?.endDate && !isF) {
      console.log('⚠️ [PatientFinder] Data is null string');
    }
    else if (range?.startDate && range?.endDate && !isF) {
      console.log('✅ [PatientFinder] Conditions met for processing data');
      if (Array.isArray(data2)) {
        console.log('📦 [PatientFinder] Data is array, creating newEvent:', {
          dataLength: data2.length,
          firstItem: data2[0],
        });
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
        console.log('🎨 [PatientFinder] Setting markedEvents:', newEvent);
        setMarkedEvents(newEvent);

      } else {
        console.log('❌ [PatientFinder] Data is not an array:', typeof data2);
      }
    } else {
      console.log('⏳ [PatientFinder] Conditions not met:', {
        hasRange: !!(range?.startDate && range?.endDate),
        notFetching: !isF,
      });
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
          {data2 && <CustomModal isOpen_={isOpen} onClose_={handleClose} size={"full"} contentW="90vw" contentMaxW="90vw" contentH="80vh" contentMaxH="80vh">
            <CustomEventContentFlex event={data2} />
          </CustomModal>}
        </Box>
      </Grid>
  <LiquidTokenEditor calendarSlot={range ? { startDate: range.startDate, endDate: range.endDate } : undefined} />
    </>
  );
}

export default PriorityList;
