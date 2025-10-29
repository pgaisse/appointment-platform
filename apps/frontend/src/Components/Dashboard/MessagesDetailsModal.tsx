// apps/frontend/src/Components/Dashboard/MessagesDetailsModal.tsx
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Icon,
  Skeleton,
  SkeletonText,
  useColorModeValue,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Divider,
} from "@chakra-ui/react";
import { FiMessageSquare, FiSend, FiClock, FiCheckCircle } from "react-icons/fi";
import { formatAusPhoneNumber } from "@/Functions/formatAusPhoneNumber";

interface Message {
  _id: string;
  conversationId?: string;
  to: string;
  body: string;
  time: Date;
  status: string;
  direction: string;
  author?: string;
  recipientName?: string | null;
  proxyAddress?: string;
  recipientPhone?: string;
  appointment?: {
    nameInput?: string;
    lastNameInput?: string;
    phoneInput?: string;
    phoneE164?: string;
    sid?: string;
  };
}

interface MessagesDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  todayMessages: Message[];
  monthMessages: Message[];
  isLoadingToday?: boolean;
  isLoadingMonth?: boolean;
  onMessageClick?: (conversationId: string) => void;
}

export const MessagesDetailsModal: React.FC<MessagesDetailsModalProps> = ({
  isOpen,
  onClose,
  todayMessages,
  monthMessages,
  isLoadingToday,
  isLoadingMonth,
  onMessageClick,
}) => {
  const bgCard = useColorModeValue("white", "gray.700");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const hoverBg = useColorModeValue("green.50", "gray.600");

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "sent":
      case "delivered":
        return "green";
      case "queued":
      case "sending":
        return "blue";
      case "failed":
        return "red";
      default:
        return "gray";
    }
  };

  const formatTime = (date: Date | string) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid date';
    
    return d.toLocaleString("en-AU", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const MessageCard = ({ msg }: { msg: Message }) => {
    const rawPhone = msg.recipientPhone || msg.proxyAddress || msg.to;
    const phoneNumber = rawPhone ? formatAusPhoneNumber(rawPhone) : '';
    const displayName = msg.recipientName 
      ? `${msg.recipientName} (${phoneNumber})`
      : phoneNumber;

    return (
      <Box
        p={4}
        bg={bgCard}
        borderRadius="xl"
        border="1px"
        borderColor={borderColor}
        transition="all 0.2s"
        cursor={onMessageClick && msg.conversationId ? "pointer" : "default"}
        _hover={{
          transform: "translateY(-2px)",
          boxShadow: "lg",
          bg: hoverBg,
          borderColor: onMessageClick && msg.conversationId ? "green.500" : borderColor,
        }}
        onClick={() => msg.conversationId && onMessageClick?.(msg.conversationId)}
      >
        <VStack align="stretch" spacing={3}>
          <HStack justify="space-between">
            <HStack spacing={2} flex={1}>
              <Icon as={FiSend} color="green.500" />
              <Text fontWeight="bold" fontSize="md" textTransform="capitalize">
                {displayName}
              </Text>
            </HStack>
            <Badge
              colorScheme={getStatusColor(msg.status)}
              px={2}
              py={1}
              borderRadius="full"
              fontSize="xs"
            >
              {msg.status}
            </Badge>
          </HStack>

        <Text fontSize="sm" color="gray.600" noOfLines={3}>
          {msg.body}
        </Text>

        <Divider />

        <HStack justify="space-between" fontSize="xs" color="gray.500">
          <HStack spacing={1}>
            <Icon as={FiClock} />
            <Text>{formatTime(msg.time)}</Text>
          </HStack>
          {msg.direction && (
            <Badge size="sm" variant="subtle" colorScheme="blue">
              {msg.direction}
            </Badge>
          )}
        </HStack>
      </VStack>
    </Box>
  );
};

  const MessageList = ({ messages, isLoading }: { messages: Message[]; isLoading?: boolean }) => {
    if (isLoading) {
      return (
        <VStack spacing={4} align="stretch">
          {[1, 2, 3].map((i) => (
            <Box
              key={i}
              p={4}
              bg={bgCard}
              borderRadius="xl"
              border="1px"
              borderColor={borderColor}
            >
              <VStack align="stretch" spacing={2}>
                <Skeleton height="20px" width="40%" />
                <SkeletonText noOfLines={2} />
                <Skeleton height="16px" width="30%" />
              </VStack>
            </Box>
          ))}
        </VStack>
      );
    }

    if (messages.length === 0) {
      return (
        <Box textAlign="center" py={10}>
          <Icon as={FiMessageSquare} boxSize={16} color="gray.300" mb={4} />
          <Text color="gray.500" fontSize="lg">
            No messages found
          </Text>
        </Box>
      );
    }

    return (
      <VStack spacing={4} align="stretch" maxH="500px" overflowY="auto">
        {messages.map((msg) => (
          <MessageCard key={msg._id} msg={msg} />
        ))}
      </VStack>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent borderRadius="2xl" boxShadow="2xl" maxH="85vh">
        <ModalHeader
          bgGradient="linear(to-r, green.500, teal.500)"
          color="white"
          borderTopRadius="2xl"
          py={6}
        >
          <HStack>
            <Icon as={FiMessageSquare} boxSize={6} />
            <Box>
              <Text fontSize="xl" fontWeight="bold">
                Messages Overview
              </Text>
              <Text fontSize="sm" fontWeight="normal" opacity={0.9}>
                View sent messages
              </Text>
            </Box>
          </HStack>
        </ModalHeader>
        <ModalCloseButton color="white" top={6} />

        <ModalBody py={6}>
          <Tabs variant="soft-rounded" colorScheme="green">
            <TabList mb={6}>
              <Tab
                _selected={{
                  bg: "green.500",
                  color: "white",
                  boxShadow: "md",
                }}
              >
                <HStack>
                  <Icon as={FiSend} />
                  <Text>Today</Text>
                  <Badge colorScheme="green" ml={2}>
                    {todayMessages.length}
                  </Badge>
                </HStack>
              </Tab>
              <Tab
                _selected={{
                  bg: "teal.500",
                  color: "white",
                  boxShadow: "md",
                }}
              >
                <HStack>
                  <Icon as={FiCheckCircle} />
                  <Text>This Month</Text>
                  <Badge colorScheme="teal" ml={2}>
                    {monthMessages.length}
                  </Badge>
                </HStack>
              </Tab>
            </TabList>

            <TabPanels>
              <TabPanel p={0}>
                <MessageList messages={todayMessages} isLoading={isLoadingToday} />
              </TabPanel>
              <TabPanel p={0}>
                <MessageList messages={monthMessages} isLoading={isLoadingMonth} />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
