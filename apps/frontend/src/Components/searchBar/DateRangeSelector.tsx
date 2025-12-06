import { RangeOption } from "@/Functions/filterAppointmentsByRage";
import {
  Button,
  ButtonGroup,
  Box,
  useDisclosure,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Text,
  HStack,
  VStack,
  Badge,
  Icon,
  Divider,
  useColorModeValue,
  Input,
  FormControl,
  FormLabel,
  IconButton,
  Collapse,
  Tooltip,
} from "@chakra-ui/react";
import { useState } from "react";
import { CalendarIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon, RepeatIcon } from "@chakra-ui/icons";
import { FiClock, FiCalendar } from "react-icons/fi";

const options: RangeOption[] = ["week", "2weeks", "month", "custom"];

const labelMap: Record<RangeOption, string> = {
  week: "This Week",
  "2weeks": "Next 2 Weeks",
  month: "Next 2 Months",
  custom: "Custom Range",
};

const iconMap: Record<RangeOption, any> = {
  week: FiClock,
  "2weeks": FiCalendar,
  month: FiCalendar,
  custom: CalendarIcon,
};

const descriptionMap: Record<RangeOption, string> = {
  week: "View appointments for the current week (Monday to Sunday)",
  "2weeks": "View appointments for the next 14 days from today",
  month: "View appointments for the next 2 months",
  custom: "Select your own date range",
};

type Props = {
  onFilterRange: (range: RangeOption, customStart?: Date, customEnd?: Date) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
};

const DateRangeSelector = ({ onFilterRange, onRefresh, isRefreshing = false }: Props) => {
  const [selected, setSelected] = useState<RangeOption>("week");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const { isOpen, onOpen, onClose } = useDisclosure();

  const bgBox = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const hoverBg = useColorModeValue("blue.50", "gray.700");

  const handleSelect = (range: RangeOption) => {
    setSelected(range);

    if (range === "custom") {
      onOpen();
    } else {
      onFilterRange(range);
    }
  };

  const handleApplyCustom = () => {
    if (customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      onFilterRange("custom", start, end);
      onClose();
    }
  };

  const formatDateRange = () => {
    if (selected === "custom" && customStartDate && customEndDate) {
      const start = new Date(customStartDate).toLocaleDateString();
      const end = new Date(customEndDate).toLocaleDateString();
      return `${start} - ${end}`;
    }
    return descriptionMap[selected];
  };

  return (
    <Box
      w="full"
      bg={bgBox}
      p={4}
      borderRadius="xl"
      border="2px"
      borderColor={borderColor}
      boxShadow="sm"
      transition="all 0.3s"
    >
      <VStack spacing={3} align="stretch">
        {/* Collapsible Header */}
        <HStack justify="space-between">
          <HStack spacing={2} flex="1" cursor="pointer" onClick={() => setIsExpanded(!isExpanded)}>
            <Icon as={FiCalendar} color="blue.500" boxSize={5} />
            <Text fontWeight="bold" fontSize="lg" color="gray.700">
              Date Range Filter
            </Text>
            <Badge colorScheme="blue" fontSize="sm" px={3} py={1} borderRadius="full">
              {labelMap[selected]}
            </Badge>
          </HStack>
          <HStack spacing={2}>
            {onRefresh && (
              <Tooltip label="Refresh priority list" placement="top" hasArrow>
                <IconButton
                  aria-label="Refresh"
                  icon={<RepeatIcon />}
                  onClick={onRefresh}
                  isLoading={isRefreshing}
                  colorScheme="blue"
                  variant="outline"
                  size="sm"
                />
              </Tooltip>
            )}
            <IconButton
              aria-label={isExpanded ? "Collapse" : "Expand"}
              icon={isExpanded ? <ChevronUpIcon boxSize={6} /> : <ChevronDownIcon boxSize={6} />}
              size="sm"
              variant="ghost"
              colorScheme="blue"
              onClick={() => setIsExpanded(!isExpanded)}
            />
          </HStack>
        </HStack>

        {/* Active Filter Info - Always visible */}
        <Box
          p={3}
          bg="blue.50"
          borderRadius="lg"
          border="1px"
          borderColor="blue.200"
        >
          <HStack spacing={2}>
            <Icon as={FiClock} color="blue.600" />
            <Text fontSize="sm" color="blue.700" fontWeight="medium">
              Active Filter:
            </Text>
            <Text fontSize="sm" color="blue.600">
              {formatDateRange()}
            </Text>
          </HStack>
        </Box>

        {/* Collapsible Content */}
        <Collapse in={isExpanded} animateOpacity>
          <VStack spacing={4} align="stretch" pt={2}>
            <Divider />

            {/* Quick Filter Buttons */}
            <Box>
              <Text fontSize="sm" fontWeight="semibold" mb={3} color="gray.600">
                Quick Filters:
              </Text>
              <ButtonGroup gap={2} size="md" flexWrap="wrap">
                {options.map((opt) =>
                  opt === "custom" ? (
                    <Popover key={opt} isOpen={isOpen} onClose={onClose} placement="bottom-start">
                      <PopoverTrigger>
                        <Button
                          onClick={() => handleSelect(opt)}
                          bg={selected === opt ? "blue.500" : "white"}
                          color={selected === opt ? "white" : "gray.700"}
                          border="2px solid"
                          borderColor={selected === opt ? "blue.500" : borderColor}
                          boxShadow={selected === opt ? "lg" : "sm"}
                          fontWeight="semibold"
                          borderRadius="xl"
                          px={6}
                          py={6}
                          transition="all 0.2s"
                          leftIcon={<Icon as={iconMap[opt]} />}
                          _hover={{
                            transform: "translateY(-2px)",
                            boxShadow: "md",
                            bg: selected === opt ? "blue.600" : hoverBg,
                          }}
                          rightIcon={selected === opt ? <CheckIcon /> : undefined}
                        >
                          <VStack spacing={0} align="start">
                            <Text fontSize="md">{labelMap[opt]}</Text>
                          </VStack>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent w="auto" maxW="400px" p={4} zIndex={9999} boxShadow="2xl" borderRadius="xl">
                        <VStack spacing={4} align="stretch">
                          <HStack justify="space-between">
                            <Text fontWeight="bold" fontSize="md">
                              📅 Select Custom Range
                            </Text>
                            <Badge colorScheme="purple">Custom</Badge>
                          </HStack>
                          
                          <Divider />

                          {/* Native Date Inputs */}
                          <VStack spacing={3} align="stretch">
                            <FormControl>
                              <FormLabel fontSize="sm" fontWeight="semibold" color="gray.600">
                                Start Date
                              </FormLabel>
                              <Input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                size="lg"
                                borderColor="blue.300"
                                _hover={{ borderColor: "blue.400" }}
                                _focus={{
                                  borderColor: "blue.500",
                                  boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)",
                                }}
                              />
                            </FormControl>

                            <FormControl>
                              <FormLabel fontSize="sm" fontWeight="semibold" color="gray.600">
                                End Date
                              </FormLabel>
                              <Input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                size="lg"
                                borderColor="blue.300"
                                min={customStartDate || undefined}
                                _hover={{ borderColor: "blue.400" }}
                                _focus={{
                                  borderColor: "blue.500",
                                  boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)",
                                }}
                              />
                            </FormControl>
                          </VStack>

                          <Divider />

                          <HStack justify="space-between">
                            <Button
                              size="sm"
                              variant="ghost"
                              colorScheme="gray"
                              onClick={onClose}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              colorScheme="blue"
                              fontWeight="semibold"
                              px={6}
                              onClick={handleApplyCustom}
                              leftIcon={<CheckIcon />}
                              isDisabled={!customStartDate || !customEndDate}
                            >
                              Apply Filter
                            </Button>
                          </HStack>
                        </VStack>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <Button
                      key={opt}
                      onClick={() => handleSelect(opt)}
                      bg={selected === opt ? "blue.500" : "white"}
                      color={selected === opt ? "white" : "gray.700"}
                      border="2px solid"
                      borderColor={selected === opt ? "blue.500" : borderColor}
                      boxShadow={selected === opt ? "lg" : "sm"}
                      fontWeight="semibold"
                      borderRadius="xl"
                      px={6}
                      py={6}
                      transition="all 0.2s"
                      leftIcon={<Icon as={iconMap[opt]} />}
                      _hover={{
                        transform: "translateY(-2px)",
                        boxShadow: "md",
                        bg: selected === opt ? "blue.600" : hoverBg,
                      }}
                      rightIcon={selected === opt ? <CheckIcon /> : undefined}
                    >
                      <VStack spacing={0} align="start">
                        <Text fontSize="md">{labelMap[opt]}</Text>
                      </VStack>
                    </Button>
                  )
                )}
              </ButtonGroup>
            </Box>
          </VStack>
        </Collapse>
      </VStack>
    </Box>
  );
};

export default DateRangeSelector;
