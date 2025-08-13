import {
  Box,
  Heading,
  Circle,
  Divider,
  Flex,
  SkeletonText,
  Tooltip,
} from "@chakra-ui/react";
import React, { useState } from "react";
import formatDate from "@/Hooks/Handles/formatDate";
import Pagination from "../Pagination";
import { CustomPriority, CustomOrder, CustomScore, CustomDatesMatched } from "../CustomIcons/customCircle";
import CustomModal from "../Modal/CustomModal";
import CustomShowInfo from "./CustomShowInfo";
import { ColorScale } from "@/Functions/ColorScale";

export type Data = {
  title: string;
  start: Date;
  end: Date;
  desc: string;
  name: string;
  num: number;
  lastName: string;
  color: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any 
  data?: any[];
  selectedStart?: Date;
  selectedEnd?: Date;
  id?: string;
  cat?: string,
  note?: string,
  phoneInput?: string,
  priorityColor?: string;
};

type MarkedEvents = Data[];

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

type Props = {
  isPlaceholderData?: boolean;
  pageSize?: number;
  btnName?: string;
  title?: string;
  markedEvents?: Data[];
  setMarkedEvents?: React.Dispatch<React.SetStateAction<MarkedEvents>>;
  setSelectedDates?: React.Dispatch<React.SetStateAction<DateRange[]>>;
};

function CustomBestApp({
  isPlaceholderData = true,
  pageSize = 5,
  title = "Title",
  markedEvents,


}: Props) {


  const [currentPage, setCurrentPage] = useState(1);

  const reversedEvents = markedEvents ? [...markedEvents] : [];
  const totalPages = reversedEvents ? Math.ceil(reversedEvents.length / pageSize) : 0;
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const currentItems = reversedEvents.slice(start, end);

  return (
    <Box fontSize="xs" p={1} m="1px auto" height="auto">
      <Heading size="md" mb="5">
        {isPlaceholderData ? "Cargando ..." : title}
      </Heading>

      {isPlaceholderData ? (
        <Box padding="6" bg="white" mb={2}>
          <SkeletonText width="20" />
          <SkeletonText mt="4" noOfLines={4} spacing="4" skeletonHeight="4" />
        </Box>
      ) : (
        currentItems.map((item: Data, index: number) => {
          const startDateData = item.selectedStart ? formatDate(item.selectedStart) : {} as { dDay: string; dHours: string };
          const { dDay: startDate, dHours: startHours } = startDateData;
          const endDateData = item.selectedEnd ? formatDate(item.selectedEnd) : {} as { dDay: string; dHours: string };
          const { dHours: endHours } = endDateData;

          const p = item.data?.[0] ?? "";
          const q = item.data?.[1] ?? "";
          const f = item.data?.[2] ?? "";
          const s = item.data?.[3] ?? "";
          return (
            <Box
              key={`item-${index}`}
              px={10}
              bg="white"
              position="relative"
            >
              <Flex align="center" justify="space-between" width="100%" pt={5}>

                <Flex align="center">
                  <Tooltip
                    label={`${item.name} ${item.lastName}`}
                    bg="gray.300"
                    color="black"
                    hasArrow
                  >
                    <Circle
                      size="40px"
                      bg={`${item.priorityColor}.500`}
                      _hover={{
                        bg: `${item.priorityColor}.400`,
                        transform: "scale(1.2)"
                      }}
                      color="white"
                      fontWeight="bold"
                      mr="5px"
                    >
                      {`${item.name} ${item.lastName}`
                        .split(" ")
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((p) => p[0])
                        .join("")
                        .toUpperCase()}
                    </Circle>
                  </Tooltip>
                  <Box textAlign="left">
                    {`${startDate} ${startHours} - ${endHours}`}
                  </Box>
                </Flex>

                <Flex align="center" gap={2}>
                  <CustomModal nameButton="Assign" size={"lg"} >
                    <CustomShowInfo data={item} />
                  </CustomModal>
                  <Tooltip key={`${index}-ft-${f}`} label={`Fit Score ${f}`} bg="gray.300" color="black" hasArrow>
                    <CustomDatesMatched
                      key={`${index}-fi`}
                      boxSize={4}
                      color={ColorScale(f)}
                    />
                  </Tooltip>
                  <Tooltip key={`${index}-pt-${p}`} label={`Priority Score ${p}`} bg="gray.300" color="black" hasArrow>
                    <CustomPriority
                      key={`${index}-pi`}
                      boxSize={4}
                      color={ColorScale(p)}
                    />
                  </Tooltip>
                  <Tooltip key={`${index}-qt-${q}`} label={`Order of arrival score ${q}`} bg="gray.300" color="black" hasArrow>
                    <CustomOrder
                      key={`${index}-qi`}
                      boxSize={4}
                      color={ColorScale(q)}
                    />
                  </Tooltip>
                  <Tooltip key={`${index}-qt-${s}`} label={`Total Score ${s}`} bg="gray.300" color="black" hasArrow>
                    <CustomScore
                      key={`${index}-qi`}
                      boxSize={4}
                      color={ColorScale(s)}
                    />
                  </Tooltip>


                </Flex>
              </Flex>

              <Divider mt={5} />
            </Box>

          );
        })
      )}

      {!isPlaceholderData && currentItems.length >= pageSize && (
        <Pagination
          totalPages={totalPages}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      )}
    </Box>
  );
}

export default CustomBestApp;
