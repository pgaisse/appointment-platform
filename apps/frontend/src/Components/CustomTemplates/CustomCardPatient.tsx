
import { Box, Button, Avatar, Drawer, DrawerBody, DrawerCloseButton, DrawerContent, DrawerFooter, DrawerHeader, DrawerOverlay, Flex, ResponsiveValue, Stack, Tooltip, useDisclosure } from "@chakra-ui/react";


import { createEvents, getStringDates } from "@/Functions/CreateEvents";
import formatDate from "@/Hooks/Handles/formatDate";
import { DateRange, MarkedEvents } from "@/Hooks/Handles/useSlotSelection";
import { CalendarIcon, EmailIcon, InfoIcon, PhoneIcon } from "@chakra-ui/icons";
import {
  QueryObserverResult,
  RefetchOptions,
  UseMutateFunction
} from "@tanstack/react-query";
import React, { useRef, useState } from "react";
import CustomModal from "../Modal/CustomModal";
import Pagination from "../Pagination/";
import CustomCalendar from "../Scheduler/CustomCalendar";
import CustomMinCalendar from "../Scheduler/CustomMinCalendar";
import CustomText from "../Text/CustomText";

export type DataEvents = {
  nameInput: string;
  lastNameInput: string;
  emailInput: string;
  phoneInput: string;
  textAreaInput: string;
  datetimeInput: string;
  selectedDates: { startDate: Date; endDate: Date }[];
  selectedAppDates?: { startDate: Date; endDate: Date }[];
  color: string;
  _id: string;
  R?: string;
  note?:string;
  reschedule?:boolean;
  // Campos compatibles con Appointment para createEvents
  sid?: string;
  priority?: any;
  treatment?: any;
  matchedBlocks?: any;
  totalOverlapMinutes?: number;
  matchLevel?: string;
  user_id?: string;
  org_id?: string;
};


interface Query {
  markedEvents?:MarkedEvents;
  setMarkedEvents?:React.Dispatch<React.SetStateAction<MarkedEvents>>;
  selectedDates?: DateRange[] | undefined;
  setSelectedDates?:React.Dispatch<React.SetStateAction<DateRange[]>>
  pageSize: number;
  btnName: string;
  data?: DataEvents[];
  isLoading?: boolean;
  error?: Error | null;
  refetch?: (
    options?: RefetchOptions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Promise<QueryObserverResult<any, Error>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deleteItem?: UseMutateFunction<any, Error, string, unknown>;
  title?: string
  maxW?: ResponsiveValue<number | "1" | "2" | "px" | (string & {}) | "none" | "inherit" | "5" | "-moz-initial" | "initial" | "revert" | "revert-layer" | "unset" | "fit-content" | "max-content" | "min-content" | "intrinsic"> | undefined
}


function CustomCardPatients({
  data,
  pageSize,
  title = "title",
  isLoading,
  maxW,
  btnName
}: Query) {

  const { isOpen, onOpen, onClose } = useDisclosure();
  

  const btnRef = useRef(null); // This creates the button reference


  //PAgination

  const [currentPage, setCurrentPage] = useState(1)
  

  const totalPages = data ? Math.ceil(data.length / pageSize) : 0
  const start = (currentPage - 1) * pageSize
  const end = start + pageSize
  const currentItems = data ? data.slice(start, end) : []

  const [currentDate, setCurrentDate] = useState(new Date());
  const handleNavigate = (date: Date) => {
    setCurrentDate(date);
  };


  return (
    <Box my={1}>
      <Button ref={btnRef} colorScheme='teal' onClick={onOpen} top="10px" width={"200px"} >
        {btnName}
      </Button>
      <Drawer
        isOpen={isOpen}
        placement='right'
        onClose={onClose}
        finalFocusRef={btnRef}
        size={'xs'}
      >
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader>{title}</DrawerHeader>

          <DrawerBody>
            {/* Insert your Box with CustomHeading and content here */}
            <Box fontSize="xs" p={1} m="1px auto" height={'auto'}>

              {
                isLoading || data === undefined || data === null ? (
                  null
                ) : (
                  currentItems.map((item: DataEvents, index: number) => (
                    <Box
                      p={4}
                      flex={maxW}
                      bg="white"
                      key={`First- ${index}`}
                    >
                      <Flex align="center" key={index}>
                        <Tooltip label={`${item.nameInput} ${item.lastNameInput}`} bg='gray.300' color='black' hasArrow>
                          <Avatar 
                            size="sm"
                            name={item.nameInput?.[0] || ""}
                            {...(() => {
                              const color = item.color;
                              if (!color) return { bg: "gray.500", color: "white" };
                              if (!color.startsWith('#') && !color.includes('.')) {
                                return { bg: `${color}.500`, color: "white" };
                              }
                              if (color.includes(".")) {
                                const [base] = color.split(".");
                                return { bg: `${base}.500`, color: "white" };
                              }
                              const hex = color.replace("#", "");
                              const int = parseInt(hex.length === 3 ? hex.split("").map(c => c+c).join("") : hex, 16);
                              const r = (int >> 16) & 255, g = (int >> 8) & 255, b = int & 255;
                              const yiq = (r * 299 + g * 587 + b * 114) / 1000;
                              const text = yiq >= 128 ? "black" : "white";
                              return { bg: color, color: text };
                            })()}
                            marginRight={'5px'}
                            boxShadow="0 1px 4px rgba(0,0,0,0.1)"
                          />
                        </Tooltip>
                        <Box textAlign="left" >
                          {item.selectedDates.length > 0 && (() => {
                            const { dDay: firstStartDate, dHours: firstStartHours } = formatDate(item.selectedDates[0].startDate);
                            const { dHours: firstEndHours } = formatDate(item.selectedDates[0].endDate);

                            return (
                              <CustomModal size="6xl" nameButton={`${firstStartDate} ${firstStartHours} - ${firstEndHours}`}>
                                <Box alignContent={'center'}>


                                  <Stack direction="row" align="center" mt={3} key={`idx-${index}`}>
                                    <InfoIcon color="teal.400" />
                                    <CustomText fontSize="md" color="gray.800" fontWeight="medium">
                                      {`${item.nameInput} ${item.lastNameInput}`}
                                    </CustomText>
                                    <PhoneIcon color="teal.400" />
                                    <CustomText fontSize="md" color="gray.800" fontWeight="medium">
                                      {`${item.phoneInput}`}
                                    </CustomText>
                                    {item.emailInput !== "email@example.com" && (
                                      <>
                                        <EmailIcon color="teal.400" />
                                        <CustomText fontSize="md" color="gray.800" fontWeight="medium">
                                          {item.emailInput}
                                        </CustomText>

                                        <InfoIcon color="teal.400" />
                                        <CustomText fontSize="md" color="gray.800" fontWeight="medium">
                                          {item.textAreaInput}
                                        </CustomText>
                                      </>
                                    )}


                                  </Stack>
                                </Box>
                                <Flex >
                                  <Box flex="4" overflow="auto" marginBottom={'10px'} mx={2}>
                                    <CustomCalendar height="50vh"
                                      events={createEvents([item as any])} 
                                      date={currentDate}//Cambi´esto item.selectedDates[0].startDate

                                    />
                                  </Box>
                                  <Box flex="1" overflow="auto" marginBottom={'10px'} mx={2}>
                                    <CustomMinCalendar
                                      height="250px"
                                      width="200px"
                                      monthDate={currentDate}
                                      onNavigate={handleNavigate}
                                      eventDates={getStringDates(createEvents([item as any]))}
                                    />

                                    {

                                      item.selectedDates.map((dateItem, index) => {
                                        const { dDay: startDate, dHours: startHours } = formatDate(dateItem.startDate);
                                        const { dHours: endHours } = formatDate(dateItem.endDate);


                                        return (

                                          <Stack direction="row" align="center" mt={3} key={`idx-${index}`}>
                                            <CalendarIcon color="teal.400" />
                                            <CustomText fontSize="md" color="gray.800" fontWeight="medium">
                                              {`${startDate} ${startHours} - ${endHours}`}
                                            </CustomText>

                                          </Stack>

                                        );
                                      })}
                                  </Box>

                                </Flex>
                              </CustomModal>

                            );
                          })()}
                          <Box ml={4} flex={4}>

                            <CustomText fontSize="sm" color="gray.500" isTruncated={false}>
                              {item.textAreaInput}
                            </CustomText>
                          </Box>
                        </Box>

                      </Flex>
                    </Box>
                  ))
                )
              }
            </Box>
          </DrawerBody>

          <DrawerFooter>
            {
              data && (
                <>
                  <Pagination
                    totalPages={totalPages}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage} />
                </>
              )
            }

          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </Box>
  );

}

export default CustomCardPatients;
