import { Flex, Box, IconButton, Tooltip } from "@chakra-ui/react";
import { FaArrowLeft, FaArrowRight, FaCalendarDay } from "react-icons/fa";


type CustomToolBar = {
  label: string;
  onNavigate: (action: "PREV" | "NEXT" | "TODAY" | "DATE") => void;
};

const CustomToolbar = ({ label, onNavigate }: CustomToolBar) => {
  return (
    <Box >

      <Flex justify="space-between" align="center" mb={4}>
      <Box
        fontSize={"sm"}
        fontWeight="semibold"
        textAlign="center"
        flex="1"
      >
        {label}
      </Box>


        <Flex gap={2}>
        <Tooltip hasArrow label='Previous' >
        <IconButton
          onClick={() => onNavigate("PREV")}
          colorScheme="blue"
          size="sm"
          icon={<FaArrowLeft />}
          aria-label="Previous"
        />
        </Tooltip>
          <Tooltip hasArrow label='Today' >
          <IconButton
            onClick={() => onNavigate("TODAY")}
            size="sm"
            icon={<FaCalendarDay />}
            aria-label="Today"
          />
          </Tooltip>
          <Tooltip hasArrow label='Next' >
          <IconButton
            onClick={() => onNavigate("NEXT")}
            colorScheme="blue"
            size="sm"
            icon={<FaArrowRight />}
            aria-label="Next"
          />
          </Tooltip>
        </Flex>
      </Flex>
    </Box>
  );
};

export default CustomToolbar;
