import { formatDateWS } from "@/Functions/FormatDateWS";
import {
  Box,
  Grid,
  Heading,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalOverlay,
  SimpleGrid,

  Tag,
  Text,
  useColorModeValue,
  useDisclosure
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { WeekDay } from "./AvailabilityDates";
import { Appointment, GroupedAppointment, TimeBlock } from "@/types";
import DraggableCards from "./DraggableCards";
import AvailabilityDates2 from "./AvailabilityDates2";
import DateRangeSelector from "../searchBar/DateRangeSelector";
import { useDraggableCards } from "@/Hooks/Query/useDraggableCards";
import { filterAppointmentsByRange, RangeOption } from "@/Functions/filterAppointmentsByRage";
import { useGetCollection } from "@/Hooks/Query/useGetCollection";


const CustomTableAppColumnV = () => {



  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedItem, setSelectedItem] = useState<Appointment>();
  const textColor = useColorModeValue("gray.800", "whiteAlpha.900");
  const subTextColor = useColorModeValue("gray.500", "gray.400");
  const bgModal = useColorModeValue("white", "gray.800")
  const bgText = useColorModeValue("gray.100", "gray.700");
  const [, setSelectedDays] = useState<Partial<Record<WeekDay, TimeBlock[]>>>({});

  const { data: dataAP2, isPlaceholderData } = useDraggableCards();
  //const { data: dataCategories } = useTreatments();
  const [filteredData, setFilteredData] = useState<GroupedAppointment[]>(dataAP2 ? dataAP2 : []);
  const query = {
    $or: [
      { "selectedAppDates": { $exists: false } },
      { "selectedAppDates": null },
      { "selectedAppDates": { $size: 0 } }
    ]
  };

  const limit = 100;
  const { data: dataContacts, isLoading: isLoadingContacts, isPlaceholderData: isPlaceholderDataContacts, refetch: refetchContacts } = useGetCollection<Appointment>("Appointment", {
    mongoQuery:query,
    limit,
  });
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
    <>
      <Box
        px={4}
        fontWeight="normal"
        display="flex"
        width="100%"           // Ocupa todo el ancho del padre para que funcione el alineado
        justifyContent="flex-end"  // Empuja contenido a la derecha
        color="gray.300"
      >
        <DateRangeSelector onFilterRange={handleRangeChange} />

      </Box>
      <Box px={4} py={6}>

        {isOpen && selectedItem && (
          <Modal isOpen={isOpen} onClose={onClose} isCentered size="2xl">
            <ModalOverlay />
            <ModalContent borderRadius="2xl" bg={bgModal} boxShadow="xl">
              <ModalCloseButton /> {/* <-- Aquí va el botón de cerrado */}
              <ModalBody p={8}>
                <Box display="flex" flexDirection="column" color={textColor}>
                  <Heading size="lg" mb={4} color="teal.600">
                    {selectedItem.nameInput} {selectedItem.lastNameInput}
                  </Heading>

                  <Grid
                    templateColumns="160px 1fr"
                    rowGap={4}
                    columnGap={6}
                    alignItems="center"
                    mb={6}
                  >
                    <Text fontWeight="bold" color="gray.600">Email:</Text>
                    <Text>{selectedItem.emailInput}</Text>

                    <Text fontWeight="bold" color="gray.600">Category:</Text>
                    <Tag colorScheme="purple" borderRadius="md" px={3} py={1}>
                      {selectedItem.priority.name || "-"}
                    </Tag>

                    <Text fontWeight="bold" color="gray.600">Phone:</Text>
                    <Text>{selectedItem.phoneInput}</Text>

                    <Text fontWeight="bold" color="gray.600">Appointment Date:</Text>
                    <HStack flexWrap="wrap">
                      {selectedItem.selectedAppDates.length > 0 ? (
                        selectedItem.selectedAppDates.map((range, idx) => (
                          <Tag key={idx} colorScheme="green" variant="subtle" mr={2} mb={2}>
                            {formatDateWS(range)}
                          </Tag>
                        ))
                      ) : (
                        <Text color={subTextColor}>-</Text>
                      )}
                    </HStack>
                  </Grid>

                  <Box mb={6}>
                    <Text fontWeight="bold" mb={2} color="gray.600">Availability:</Text>
                    {selectedItem.selectedDates ? (
                      <AvailabilityDates2
                        modeInput={false}
                        selectedDaysResp={
                          Array.isArray(selectedItem.selectedDates?.days)
                            ? selectedItem.selectedDates.days.reduce((acc: Partial<Record<WeekDay, TimeBlock[]>>, curr: { weekDay: WeekDay; timeBlocks: TimeBlock[] }) => {
                              acc[curr.weekDay] = curr.timeBlocks;
                              return acc;
                            }, {})
                            : {}
                        }
                        setSelectedDaysResp={setSelectedDays}
                      />
                    ) : (
                      <Text color={subTextColor}>-</Text>
                    )}
                  </Box>

                  <Box mb={6}>
                    <Text fontWeight="bold" mb={2} color="gray.600">Note:</Text>
                    <Box
                      bg={bgText}
                      p={4}
                      borderRadius="md"
                      fontStyle="italic"
                      color={textColor}
                      whiteSpace="pre-wrap"
                    >
                      {selectedItem.note || "-"}
                    </Box>
                  </Box>

                  <Text fontSize="xs" color="gray.400" textAlign="right" userSelect="all">
                    ID: {selectedItem._id}
                  </Text>
                </Box>
              </ModalBody>
            </ModalContent>
          </Modal>

        )}
      </Box>

      <SimpleGrid spacing={6} templateColumns={templateCoumns}>

        <DraggableCards
          isPlaceholderData={isPlaceholderData}
          dataAP2={filteredData?filteredData:[]}
          dataContacts={dataContacts?dataContacts:[]}
          onCardClick={handleCardClick}
        />
      </SimpleGrid>
    </>
  );

}
  ;

export default CustomTableAppColumnV;
