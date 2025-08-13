import { ColorScale } from '@/Functions/ColorScale';
import { MarkedEvent } from '@/Hooks/Handles/useSlotSelection'; // Import your singular event type
import { useEditItem } from '@/Hooks/Query/useEditItem';
import { Box, Button, Circle, Flex, Grid, GridItem, Modal, ModalBody, ModalCloseButton, ModalContent, ModalHeader, ModalOverlay, Popover, PopoverArrow, PopoverBody, PopoverContent, PopoverTrigger, Portal, Stack, Text, Tooltip, useDisclosure, useToast } from '@chakra-ui/react';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import { DateRange, EventProps } from 'react-big-calendar'; // Import EventProps
import { CustomDatesMatched, CustomOrder, CustomPriority, CustomScore } from '../CustomIcons/customCircle';
import AvailabilityDates from '../CustomTemplates/AvailabilityDates';
import { RiCalendarScheduleFill } from "react-icons/ri";
import { formatDateWS } from '@/Functions/FormatDateWS';
import { LiaSmsSolid } from "react-icons/lia";
import { CiCalendarDate } from "react-icons/ci";



interface EventDataItem {
  _id: string;
  nameInput: string;
  lastNameInput: string;
  selectedDates?: DateRange[];
  selectedAppDates?: DateRange[];
  // otras propiedades que uses
}

const CustomEventContent: React.FC<EventProps<MarkedEvent>> = ({ event }) => {

  const { mutate } = useEditItem({ model: "Appointments" });

  const toast = useToast();

  const handleClick = (id: string, start: Date, end: Date) => {

    mutate(
      {
        id,
        data: {
          reschedule: true, selectedAppDates: [
            {
              startDate: start,
              endDate: end,
            }
          ]
        }, // solo este campo se actualizará
      },
      {
        onSuccess: () => {
          toast({
            title: "Form submitted.",
            description: "Your information was sent successfully.",
            status: "success",
            duration: 3000,
            isClosable: true,
          });
        },
      }
    );
  };

  const { isOpen, onOpen, onClose } = useDisclosure();
  useEffect(() => {
    if (Array.isArray(event.data) && event.data.length > 0) {
      onOpen();
    } else {
      onClose();
    }
  }, [event.data, onOpen, onClose]);
  const [isOpenModal, setIsOpenModal] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedItem, setSelectedItem] = useState<any>(null);



  const onOpenModal = (item: EventDataItem) => {
    onClose(); // cerrar Popover antes
    setSelectedItem(item);
    setIsOpenModal(true);
  };

  const onCloseModal = () => {
    onOpen(); // reabrir Popover
    setIsOpenModal(false);
    setSelectedItem(null);
  };
  const appointmentDate =
    selectedItem?.selectedAppDates?.[0]?.startDate
      ? formatDateWS({
        startDate: selectedItem.selectedAppDates[0].startDate,
        endDate: selectedItem.selectedAppDates[0].endDate,
      })
      : "No date available";

  return (
    <><Box
      p={10}
      w="500px"
      h="200px"
      position="relative"
      overflow="visible"
    >



      <Popover
        isOpen={isOpen}
        onOpen={onOpen}
        onClose={onClose}
        placement="right"
        closeOnBlur={false}
      >
        <PopoverTrigger>
          <Box
            w="60px"
            h="60px"
            display="flex"
            cursor="pointer"
            tabIndex={0}

          >
          </Box>
        </PopoverTrigger>

        <Portal>
          <AnimatePresence>
            {isOpen && (
              <PopoverContent w="-moz-fit-content" bg="rgba(255,255,255,0.9)">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 1 }}
                >
                  <PopoverArrow bg="rgba(255,255,255,0.8)" />
                  <PopoverBody onClick={(e) => e.stopPropagation()}>
                    <Stack direction="column" spacing={3}>

                      {  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        Array.isArray(event.data) ? event.data.map((field: Record<string, any>, index: number) => {

                          const item = field._doc;
                          const fitScoreArray = Array.isArray(field.fitScore)
                            ? field.fitScore.filter((score: { score: number }) => score.score >= 0.85)
                            : [];


                          const fScore = fitScoreArray.length > 0
                            ? parseFloat(fitScoreArray[0].score.toFixed(2))
                            : 0;
                          const initials = `${item.nameInput} ${item.lastNameInput}`
                            .split(" ")
                            .filter(Boolean)
                            .slice(0, 2)
                            .map(p => p[0])
                            .join("")
                            .toUpperCase();

                          const p = typeof field.priorityScore === 'number' ? parseFloat(field.priorityScore.toFixed(2)) : 0;
                          const q = typeof field.queueScore === 'number' ? parseFloat(field.queueScore.toFixed(2)) : 0;
                          const s = typeof field.maxScore === 'number' ? parseFloat(field.maxScore.toFixed(2)) : 0;


                          return (
                            <Grid
                              key={`row-${index}`}
                              templateColumns="40px 150px  auto auto"
                              alignItems="center"
                              gap={2}
                              paddingY={1}
                            >
                              <GridItem>
                                <Box
                                  fontSize="x-small"
                                  display="flex"
                                  justifyContent="center"
                                  alignItems="center"
                                >
                                  <Tooltip
                                    label={`${item.nameInput} ${item.lastNameInput}`}
                                    bg="gray.300"
                                    color="black"
                                    hasArrow
                                  >
                                    <Circle
                                      size="40px"
                                      bg={field.priorityColor ? `${field.priorityColor}.500` : "#0078D4"}
                                      _hover={{
                                        bg: field.priorityColor ? `${field.priorityColor}.400` : "#005A9E"
                                      }}
                                      color="white"
                                      fontWeight="bold"
                                      my="5px"
                                    >
                                      {initials}
                                    </Circle>
                                  </Tooltip>
                                </Box>
                              </GridItem>

                              <GridItem>
                                {`${item.nameInput} ${item.lastNameInput}`}
                              </GridItem>

                              <GridItem>


                                <Box
                                  as="a"
                                  color="blue.500"
                                  cursor="pointer"
                                  onClick={() => onOpenModal(item)}
                                >
                                  <Tooltip label={"Availability"} bg="gray.300" color="black" hasArrow>
                                    <CiCalendarDate />
                                  </Tooltip>
                                </Box>




                              </GridItem>

                              <GridItem>

                                <Flex align="center" gap={2}>
                                  <Tooltip label={"Re-Schedule"} bg="gray.300" color="black" hasArrow>
                                    <Button variant="ghost"
                                      colorScheme="gray"
                                      onClick={() => handleClick(item._id, event.start, event.end)}
                                    > <RiCalendarScheduleFill /> </Button></Tooltip>

                                  <Tooltip label={"SMS"} bg="gray.300" color="black" hasArrow>
                                    <LiaSmsSolid />
                                  </Tooltip>

                                  <Tooltip label={`Priority Score ${p.toFixed(2)}`} bg="gray.300" color="black" hasArrow>
                                    <CustomPriority boxSize={4} color={ColorScale(p)} />
                                  </Tooltip>

                                  <Tooltip label={`Order of arrival score ${q.toFixed(2)}`} bg="gray.300" color="black" hasArrow>
                                    <CustomOrder boxSize={4} color={ColorScale(q)} />
                                  </Tooltip>

                                  <Tooltip label={`Total Score ${s.toFixed(2)}`} bg="gray.300" color="black" hasArrow>
                                    <CustomScore boxSize={4} color={ColorScale(s)} />
                                  </Tooltip>
                                </Flex>
                              </GridItem>
                            </Grid>

                          );
                        }) : <span />}
                    </Stack>

                  </PopoverBody>
                </motion.div>
              </PopoverContent>
            )}
          </AnimatePresence>
        </Portal>


      </Popover>


    </Box >

      <Modal isOpen={isOpenModal} onClose={onCloseModal} size={"lg"}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader> {selectedItem && `Dates selected by ${selectedItem.nameInput} ${selectedItem.lastNameInput}`}</ModalHeader>
          <ModalCloseButton />
          <ModalBody >

            {selectedItem && (<>
              <Box>
                <Text> Current Appointment Date <span>{`${appointmentDate}`}</span></Text>

              </Box>
              <AvailabilityDates
                key={selectedItem._id}
                modeInput={false}
                selectedDates={selectedItem.selectedDates}
              /></>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

    </>
  );

};

export default CustomEventContent;