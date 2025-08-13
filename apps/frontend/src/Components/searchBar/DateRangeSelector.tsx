import { RangeOption } from "@/Functions/filterAppointmentsByRage";
import {
  Button,
  ButtonGroup,
  Flex,
  Box,
  useDisclosure,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@chakra-ui/react";
import { useState } from "react";

import { DateRange } from "react-date-range";
const options: RangeOption[] = ["week", "2weeks", "month", "custom"];

const labelMap: Record<RangeOption, string> = {
  week: "This Week",
  "2weeks": "Next 2 Weeks",
  month: "This Month",
  custom: "Custom",
};
type Range=
  {startDate:Date, endDate:Date, key:string}

type Props = {
  onFilterRange: (range: RangeOption, customStart?: Date, customEnd?: Date) => void;
};

const DateRangeSelector = ({ onFilterRange }: Props) => {

  const [selected, setSelected] = useState<RangeOption>("2weeks");
  const [dateRange, setDateRange] = useState<Range[]>([
    { startDate: new Date(), endDate: new Date(), key: "selection" },
  ]);

  const { isOpen, onOpen, onClose } = useDisclosure();

  const handleSelect = (range: RangeOption) => {
    setSelected(range);

    if (range === "custom") {
      onOpen();
    } else {
      onFilterRange(range);
    }
  };

  const handleApply = () => {
    onFilterRange("custom", dateRange[0].startDate, dateRange[0].endDate);
    onClose();
  };

  return (
    <Flex justify="center" mt={6} mb={8}>
      <ButtonGroup gap={2} size="sm">
        {options.map((opt) =>
          opt === "custom" ? (
            <Popover key={opt} isOpen={isOpen} onClose={onClose} placement="bottom">
              <PopoverTrigger>
                <Button
                  onClick={() => handleSelect(opt)}
                  bg={selected === opt ? "white" : "transparent"}
                  border={selected === opt ? "2px solid" : "1px solid"}
                  borderColor={selected === opt ? "teal.400" : "gray.300"}
                  boxShadow={selected === opt ? "md" : "none"}
                  fontWeight={selected === opt ? "semibold" : "normal"}
                  borderRadius="full"
                  px={6}
                  transition="all 0.2s"
                >
                  {labelMap[opt]}
                </Button>
              </PopoverTrigger>
              <PopoverContent w="auto" p={4} zIndex={9999}>
                <Box>
                  <DateRange
                    editableDateInputs
                    onChange={(item: { selection: Range; }) => setDateRange([item.selection])}
                    moveRangeOnFirstSelection={false}
                    ranges={dateRange}
                  />
                  <Flex justify="flex-end" mt={2}>
                    <Button
                      size="sm"
                      bg="teal.500"
                      color="white"
                      fontWeight="semibold"
                      borderRadius="full"
                      px={5}
                      _hover={{ bg: "teal.600" }}
                      onClick={handleApply}
                    >
                      Apply
                    </Button>

                  </Flex>
                </Box>
              </PopoverContent>
            </Popover>
          ) : (
            <Button
              key={opt}
              onClick={() => handleSelect(opt)}
              bg={selected === opt ? "white" : "transparent"}
              border={selected === opt ? "2px solid" : "1px solid"}
              borderColor={selected === opt ? "teal.400" : "gray.300"}
              boxShadow={selected === opt ? "md" : "none"}
              fontWeight={selected === opt ? "semibold" : "normal"}
              borderRadius="full"
              px={6}
              transition="all 0.2s"
            >
              {labelMap[opt]}
            </Button>
          )
        )}
      </ButtonGroup>
    </Flex>
  );
};
export default DateRangeSelector;