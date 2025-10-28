// apps/frontend/src/Components/Dashboard/AppointmentDetailsModal.tsx
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
  Divider,
  Icon,
  Avatar,
  Skeleton,
  SkeletonText,
  SkeletonCircle,
  useColorModeValue,
} from "@chakra-ui/react";
import { FiCalendar, FiUser, FiPhone } from "react-icons/fi";
import { formatAusPhoneNumber } from "@/Functions/formatAusPhoneNumber";
import type { Appointment } from "@/types";

interface AppointmentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointments: Appointment[];
  title: string;
  isLoading?: boolean;
}

export const AppointmentDetailsModal: React.FC<AppointmentDetailsModalProps> = ({
  isOpen,
  onClose,
  appointments,
  title,
  isLoading,
}) => {
  const bgCard = useColorModeValue("white", "gray.700");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const hoverBg = useColorModeValue("blue.50", "gray.600");

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "confirmed":
        return "green";
      case "pending":
        return "yellow";
      case "rejected":
      case "cancelled":
        return "red";
      default:
        return "gray";
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent
        borderRadius="2xl"
        boxShadow="2xl"
        maxH="80vh"
      >
        <ModalHeader
          bgGradient="linear(to-r, blue.500, purple.500)"
          color="white"
          borderTopRadius="2xl"
          py={6}
        >
          <HStack>
            <Icon as={FiCalendar} boxSize={6} />
            <Box>
              <Text fontSize="xl" fontWeight="bold">
                {title}
              </Text>
              <Text fontSize="sm" fontWeight="normal" opacity={0.9}>
                {appointments.length} appointment{appointments.length !== 1 ? "s" : ""}
              </Text>
            </Box>
          </HStack>
        </ModalHeader>
        <ModalCloseButton color="white" top={6} />

        <ModalBody py={6}>
          {isLoading ? (
            <VStack spacing={4} align="stretch">
              {[1, 2, 3].map((i) => (
                <Box
                  key={i}
                  p={5}
                  bg={bgCard}
                  borderRadius="xl"
                  border="1px"
                  borderColor={borderColor}
                >
                  <HStack spacing={4}>
                    <SkeletonCircle size="12" />
                    <VStack align="start" flex={1} spacing={2}>
                      <Skeleton height="20px" width="60%" />
                      <SkeletonText noOfLines={2} width="80%" />
                    </VStack>
                  </HStack>
                </Box>
              ))}
            </VStack>
          ) : appointments.length === 0 ? (
            <Box textAlign="center" py={10}>
              <Icon as={FiCalendar} boxSize={16} color="gray.300" mb={4} />
              <Text color="gray.500" fontSize="lg">
                No appointments found
              </Text>
            </Box>
          ) : (
            <VStack spacing={4} align="stretch">
              {appointments.map((apt) => {
                const nextDate = apt.selectedAppDates?.[0];
                const status = nextDate?.status || "Uncontacted";

                return (
                  <Box
                    key={apt._id}
                    p={5}
                    bg={bgCard}
                    borderRadius="xl"
                    border="1px"
                    borderColor={borderColor}
                    transition="all 0.2s"
                    _hover={{
                      transform: "translateY(-2px)",
                      boxShadow: "lg",
                      bg: hoverBg,
                    }}
                  >
                    <VStack align="stretch" spacing={3}>
                      {/* Header: Name & Status */}
                      <HStack justify="space-between">
                        <HStack spacing={3}>
                          <Avatar
                            size="md"
                            name={`${apt.nameInput} ${apt.lastNameInput}`}
                            bg="blue.500"
                          />
                          <Box>
                            <Text fontWeight="bold" fontSize="lg" textTransform="capitalize">
                              {apt.nameInput} {apt.lastNameInput}
                            </Text>
                            {apt.representative && (
                              <HStack spacing={1} fontSize="sm" color="gray.500">
                                <Icon as={FiUser} />
                                <Text textTransform="capitalize">
                                  Rep: {apt.representative.nameInput}
                                </Text>
                              </HStack>
                            )}
                          </Box>
                        </HStack>
                        <Badge
                          colorScheme={getStatusColor(status)}
                          px={3}
                          py={1}
                          borderRadius="full"
                          fontSize="sm"
                          textTransform="capitalize"
                        >
                          {status}
                        </Badge>
                      </HStack>

                      <Divider />

                      {/* Details */}
                      <VStack align="stretch" spacing={2}>
                        {nextDate?.startDate && (
                          <HStack spacing={2} color="gray.600">
                            <Icon as={FiCalendar} color="blue.500" />
                            <Text fontSize="sm" fontWeight="medium">
                              {new Date(nextDate.startDate).toLocaleDateString('en-AU', {
                                weekday: 'short',
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </Text>
                          </HStack>
                        )}

                        {apt.phoneInput && (
                          <HStack spacing={2} color="gray.600">
                            <Icon as={FiPhone} color="green.500" />
                            <Text fontSize="sm">
                              {formatAusPhoneNumber(apt.phoneInput)}
                            </Text>
                          </HStack>
                        )}
                      </VStack>

                      {/* Notes */}
                      {(apt as any).noteInput && (
                        <>
                          <Divider />
                          <Box
                            bg={useColorModeValue("gray.50", "gray.600")}
                            p={3}
                            borderRadius="md"
                          >
                            <Text fontSize="xs" color="gray.500" mb={1}>
                              Note:
                            </Text>
                            <Text fontSize="sm" color="gray.700">
                              {(apt as any).noteInput}
                            </Text>
                          </Box>
                        </>
                      )}
                    </VStack>
                  </Box>
                );
              })}
            </VStack>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
