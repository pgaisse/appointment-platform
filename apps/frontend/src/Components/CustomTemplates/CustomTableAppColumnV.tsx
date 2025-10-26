import {
  Box,
  SimpleGrid,
  useDisclosure
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { WeekDay } from "./AvailabilityDates";
import { Appointment, GroupedAppointment, TimeBlock } from "@/types";
import DraggableCards from "./DraggableCards";
import DateRangeSelector from "../searchBar/DateRangeSelector";
import { useDraggableCards } from "@/Hooks/Query/useDraggableCards";
import { filterAppointmentsByRange, RangeOption } from "@/Functions/filterAppointmentsByRage";
import { useGetCollection } from "@/Hooks/Query/useGetCollection";
import AppointmentModal from "../Modal/AppointmentModal";
import { ModalStackProvider } from "@/Components/ModalStack/ModalStackContext"; // 👈 Provider para modal index

const CustomTableAppColumnV = () => {

  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedItem, setSelectedItem] = useState<Appointment>();
  const [] = useState<Partial<Record<WeekDay, TimeBlock[]>>>({});

  const { data: dataAP2, isPlaceholderData } = useDraggableCards();
  console.log("dataAP2",dataAP2)
  //const { data: dataCategories } = useTreatments();
  const [filteredData, setFilteredData] = useState<GroupedAppointment[]>(dataAP2 ? dataAP2 : []);
  const query = {
    $and: [
      { unknown: false },           // ← obligatorio
      {
        $or: [
          { selectedAppDates: { $exists: false } },
          { selectedAppDates: null },
          { selectedAppDates: { $size: 0 } },
          { selectedDates: { $exists: false } },
          // (opcional) si también quieres selectedDates vacío:
          // { selectedDates: { $size: 0 } },
        ],
      },
    ],
  };

  const query2 = {
    $and: [{ unknown: false },      {"selectedAppDates.status": "Pending" }    ],
  };

  const limit = 100;
  const { data: dataContacts } = useGetCollection<Appointment>("Appointment", {
    mongoQuery: query,
    limit,
  });

  const { data: dataPending } = useGetCollection<Appointment>("Appointment", {
    mongoQuery: query2,
    limit,
  });
  console.log("dataPending",dataPending)
  const handleRangeChange = (
    range: RangeOption,
    customStart?: Date,
    customEnd?: Date
  ) => {
    const result = filterAppointmentsByRange(
      dataAP2 ?? [],
      range,
      customStart,
      customEnd
    );
    setFilteredData(result);

  };

  const templateCoumns = {
    base: "repeat(1, minmax(150px, 1fr))",
    sm: "repeat(1, minmax(150px, 2fr))",
    lg: "repeat(2, minmax(150px, 2fr))",
    xl: "repeat(4, minmax(150px, 1fr))",
    "2xl": "repeat(4, minmax(150px, 1fr))",
    "5xl": "repeat(4, minmax(150px, 1fr))",
  };
  // ✅ Al montar, aplicar automáticamente el rango "2weeks"
  useEffect(() => {
    handleRangeChange("2weeks");
  }, [dataAP2]); // <-- importante: asegúrate de que 'data' esté cargada

  const handleCardClick = (item: Appointment) => {
    setSelectedItem(item);
    onOpen();
  };

  return (
    <ModalStackProvider>
      <>
        <Box
          px={4}
          fontWeight="normal"
          display="flex"
          width="100%"           // Ocupa todo el ancho del padre para que funcione el alineado
          justifyContent="flex-end"  // Empuja contenido a la derecha
          color="gray.300"
        >
          {dataAP2 && <DateRangeSelector onFilterRange={handleRangeChange} />}
        </Box>
        <Box px={4} >
          {isOpen && selectedItem && (
            <AppointmentModal id={selectedItem._id?? ""} isOpen={isOpen} onClose={onClose} />
          )}
        </Box>

        <SimpleGrid spacing={6} templateColumns={templateCoumns}>
          <DraggableCards
            isPlaceholderData={isPlaceholderData}
            dataAP2={filteredData ? filteredData : []}
            dataContacts={dataContacts ? dataContacts : []}
            dataPending={dataPending ? dataPending : []}
            onCardClick={handleCardClick}
          />
        </SimpleGrid>
      </>
    </ModalStackProvider>
  );
};

export default CustomTableAppColumnV;
