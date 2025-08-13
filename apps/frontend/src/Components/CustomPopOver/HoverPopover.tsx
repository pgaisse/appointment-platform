import {
  Box,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverCloseButton,
  PopoverBody,
  Icon,
  useDisclosure,
  Portal,
} from '@chakra-ui/react';
import { HiOutlineChatBubbleLeftRight } from 'react-icons/hi2';
import { useRef } from 'react';

export const HoverPopover = () => {
  const { onOpen, onClose, isOpen } = useDisclosure();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    onOpen();
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      onClose();
    }, 100);
  };

  return (
    <Portal>
      <Popover
        isOpen={isOpen}
        onOpen={onOpen}
        onClose={onClose}
        trigger="hover"
        placement="right"
        openDelay={100}
        closeDelay={100}
      >
        <PopoverTrigger>
          <Box
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            cursor="pointer"
            p={2}
            borderRadius="full"
            bg="white"
            boxShadow="md"
            _hover={{ bg: "gray.100", transform: "scale(1.1)", transition: "0.2s ease" }}
          >
            <Icon as={HiOutlineChatBubbleLeftRight} boxSize={6} color="blue.500" />
          </Box>
        </PopoverTrigger>

        <PopoverContent
          zIndex={99999}
          position="absolute"
          borderRadius="xl"
          boxShadow="xl"
          bg="white"
          minW="320px"
          _focus={{ outline: "none" }}
        >
          <PopoverArrow />
          <PopoverCloseButton />
          <PopoverBody>
            <Box>
              <strong>Contenido interactivo:</strong>
              <Box
                as="iframe"
                width="100%"
                height="200px"
                border="none"
                borderRadius="md"
              />
              HOLAA
            </Box>
          </PopoverBody>
        </PopoverContent>
      </Popover>
    </Portal>
  );
};
