// Components/Chat/ContactDetailsPanel.tsx
import {
  Box,
  VStack,
  HStack,
  Text,
  Icon,
  Badge,
  Spinner,
  useColorModeValue,
} from "@chakra-ui/react";
import { FaPhone, FaEnvelope, FaCalendarAlt, FaNotesMedical, FaUserShield, FaUser } from "react-icons/fa";
import { useGetCollection } from "@/Hooks/Query/useGetCollection";
import type { Appointment, ConversationChat } from "@/types";
import { useMemo } from "react";
import { formatAusPhoneNumber } from "@/Functions/formatAusPhoneNumber";

interface ContactDetailsPanelProps {
  conversation: ConversationChat | null;
}

const populateFields = [
  { path: "priority", select: "id description notes durationHours name color" },
  { path: "treatment", select: "_id name notes duration icon color minIcon" },
  { path: "providers" },
  {
    path: "representative.appointment",
    select: "phoneInput phoneE164 emailLower nameInput lastNameInput sid proxyAddress",
  },
  { path: "selectedDates.days.timeBlocks" },
] as const;

export default function ContactDetailsPanel({ conversation }: ContactDetailsPanelProps) {

  const bg = useColorModeValue("rgba(255,255,255,0.76)", "rgba(26,32,44,0.6)");
  const borderColor = useColorModeValue("blackAlpha.200", "whiteAlpha.200");
  const textMuted = useColorModeValue("gray.600", "gray.400");
  const sectionBg = useColorModeValue("whiteAlpha.800", "whiteAlpha.50");
  const scrollbarThumb = useColorModeValue("gray.400", "gray.600");
  const scrollbarTrack = useColorModeValue("gray.100", "gray.800");

  // Extract phone/sid for appointment query
  const { ownerPhone, ownerSid } = useMemo(() => {
    if (!conversation?.owner) return { ownerPhone: undefined, ownerSid: undefined };
    
    // Try owner.phone first (most reliable)
    if (conversation.owner.phone) {
      return { ownerPhone: conversation.owner.phone, ownerSid: undefined };
    }
    
    // Try to extract phone from lastMessage.author
    const author = conversation.lastMessage?.author;
    if (author && /^[\+\d]/.test(author)) {
      return { ownerPhone: author, ownerSid: undefined };
    }
    
    // Fallback: try to use conversation SID pattern (CHxxxx maps to patient)
    return { ownerPhone: undefined, ownerSid: conversation.conversationId };
  }, [conversation]);

  // Query appointment by phone or conversationId
  const mongoQuery = useMemo(() => {
    if (ownerPhone) {
      return {
        $or: [
          { phoneInput: ownerPhone },
          { phoneE164: ownerPhone },
        ],
      };
    }
    if (ownerSid) {
      return { sid: ownerSid };
    }
    return { _id: { $exists: false } };
  }, [ownerPhone, ownerSid]);

  const { data: appointments, isLoading } = useGetCollection<Appointment>(
    "Appointment",
    { mongoQuery, limit: 1, populate: populateFields }
  );

  const appointment = appointments?.[0];

  // Helper: Title Case (capitalize initials) with basic locale awareness
  const toTitleCase = (value?: string | null) => {
    if (!value) return "";
    const lower = value.toLocaleLowerCase("es-ES");
    return lower
      .split(/\s+/)
      .filter(Boolean)
      .map((token) =>
        token
          .split("-")
          .map((part) => (part ? part[0].toLocaleUpperCase("es-ES") + part.slice(1) : part))
          .join("-")
      )
      .join(" ");
  };

    // Calculate display info - prioritize appointment data
  const displayName = useMemo(() => {
    if (appointment) {
      const fullNameRaw = `${appointment.nameInput || ""} ${appointment.lastNameInput || ""}`.trim();
      if (fullNameRaw) return toTitleCase(fullNameRaw);
    }
    if (conversation?.owner) {
      if (conversation.owner.unknown) return "Unknown Contact";
      const n = conversation.owner.name || "";
      return n ? toTitleCase(n) : "Unknown Contact";
    }
    return "Unknown Contact";
  }, [appointment, conversation]);

  const avatarColor = useMemo(() => {
    if (appointment?.color) return appointment.color;
    if (conversation?.owner?.color) return conversation.owner.color;
    return undefined;
  }, [appointment?.color, conversation?.owner?.color]);

  const displayPhone = useMemo(() => {
    const phone = appointment?.phoneInput || ownerPhone || null;
    return phone && String(phone).trim().length > 0 ? phone : null;
  }, [appointment?.phoneInput, ownerPhone]);

  const displayEmail = useMemo(() => {
    return appointment?.emailInput || conversation?.owner?.email || null;
  }, [appointment?.emailInput, conversation?.owner?.email]);

  // Determine if the person is a patient (requires treatment, priority, and at least one appointment date)
  const isPatient = useMemo(() => {
    if (!appointment) return false;
    const hasTreatment = Boolean(appointment.treatment);
    const hasPriority = Boolean(appointment.priority);
    const hasDate = Array.isArray(appointment.selectedAppDates) && appointment.selectedAppDates.length > 0;
    return hasTreatment && hasPriority && hasDate;
  }, [appointment]);

  if (!conversation) {
    return (
      <VStack h="100%" justify="center" align="center" spacing={3} color={textMuted}>
        <Icon as={FaUserShield} boxSize={12} opacity={0.4} />
        <Text fontSize="sm">Select a conversation to view contact details</Text>
      </VStack>
    );
  }

  if (isLoading) {
    return (
      <VStack h="100%" justify="center" align="center" spacing={3}>
        <Spinner size="lg" />
        <Text fontSize="sm" color={textMuted}>
          Loading contact details...
        </Text>
      </VStack>
    );
  }

  return (
    <VStack
      h="100%"
      align="stretch"
      spacing={0}
      overflowY="auto"
      sx={{
        "::-webkit-scrollbar": { width: "8px" },
        "::-webkit-scrollbar-thumb": { background: scrollbarThumb, borderRadius: "10px" },
        "::-webkit-scrollbar-track": { background: scrollbarTrack },
      }}
    >
      {/* Header with avatar */}
      <Box
        position="sticky"
        top={0}
        zIndex={2}
        p={6}
        bg={bg}
        borderBottomWidth="1px"
        borderColor={borderColor}
        backdropFilter="saturate(140%) blur(6px)"
      >
        <VStack spacing={3}>
          <Box 
            w="96px"
            h="96px"
            bg={useColorModeValue("gray.200", "gray.600")}
            borderRadius="lg"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Icon 
              as={FaUser} 
              boxSize="48px" 
              color={avatarColor ? `${avatarColor}.500` : useColorModeValue("gray.400", "gray.500")}
            />
          </Box>
          <VStack spacing={1}>
            <Text fontSize="xl" fontWeight="bold" textAlign="center">
              {displayName}
            </Text>
            <Badge colorScheme={isPatient ? "green" : "blue"} fontSize="xs">
              {isPatient ? "Patient" : "Contact"}
            </Badge>
          </VStack>
        </VStack>
      </Box>

      {/* Contact Information */}
      <Box p={5}>
        <VStack align="stretch" spacing={4}>
          {/* Contact Details Section */}
          <Box bg={sectionBg} p={4} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
            <Text fontSize="sm" fontWeight="bold" mb={3} textTransform="uppercase" letterSpacing="wide">
              Contact Information
            </Text>
            <VStack align="stretch" spacing={3}>
              {displayPhone && (
                <HStack spacing={3}>
                  <Icon as={FaPhone} color={textMuted} boxSize={4} />
                  <Text fontSize="sm" flex="1">
                    {formatAusPhoneNumber(displayPhone)}
                  </Text>
                </HStack>
              )}
              {displayEmail && (
                <HStack spacing={3}>
                  <Icon as={FaEnvelope} color={textMuted} boxSize={4} />
                  <Text fontSize="sm" flex="1" noOfLines={1} title={displayEmail}>
                    {displayEmail}
                  </Text>
                </HStack>
              )}
            </VStack>
          </Box>

          {/* Appointment Details (if patient exists) */}
          {appointment && (
            <>
              {/* Treatment & Priority */}
              {appointment?.treatment&&<Box bg={sectionBg} p={4} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
                <Text fontSize="sm" fontWeight="bold" mb={3} textTransform="uppercase" letterSpacing="wide">
                  Treatment Plan
                </Text>
                <VStack align="stretch" spacing={3}>
                  {appointment.treatment && (
                    <HStack spacing={3} align="start">
                      <Icon as={FaNotesMedical} color={textMuted} boxSize={4} mt={0.5} />
                      <VStack align="start" spacing={0} flex="1">
                        <Text fontSize="sm" fontWeight="medium">
                          {appointment.treatment.name}
                        </Text>
                        {appointment.treatment.duration && (
                          <Text fontSize="xs" color={textMuted}>
                            Duration: {appointment.treatment.duration} mins
                          </Text>
                        )}
                      </VStack>
                    </HStack>
                  )}
                  {appointment.priority && (
                    <HStack spacing={3} align="start">
                      <Icon as={FaCalendarAlt} color={textMuted} boxSize={4} mt={0.5} />
                      <VStack align="start" spacing={0} flex="1">
                        <Text fontSize="sm" fontWeight="medium">
                          {appointment.priority.name}
                        </Text>
                        {appointment.priority.durationHours && (
                          <Text fontSize="xs" color={textMuted}>
                            {appointment.priority.durationHours} hours priority window
                          </Text>
                        )}
                      </VStack>
                      {appointment.priority.color && (
                        <Box w={3} h={3} borderRadius="full" bg={appointment.priority.color} />
                      )}
                    </HStack>
                  )}
                </VStack>
              </Box>}

              {/* Representative Information */}
                  {appointment.representative?.appointment && (
                <Box bg={sectionBg} p={4} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
                  <Text fontSize="sm" fontWeight="bold" mb={3} textTransform="uppercase" letterSpacing="wide">
                    Representative
                  </Text>
                  <VStack align="stretch" spacing={2}>
                    <HStack spacing={3}>
                      <Box 
                        w="32px"
                        h="32px"
                        bg={useColorModeValue("gray.200", "gray.600")}
                        borderRadius="md"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        flexShrink={0}
                      >
                        <Icon 
                          as={FaUser} 
                          boxSize="16px" 
                          color={useColorModeValue("gray.400", "gray.500")}
                        />
                      </Box>
                      <VStack align="start" spacing={0} flex="1">
                            {(
                              (appointment.representative.appointment.nameInput && String(appointment.representative.appointment.nameInput).trim()) ||
                              (appointment.representative.appointment.lastNameInput && String(appointment.representative.appointment.lastNameInput).trim())
                            ) && (
                              <Text fontSize="sm" fontWeight="medium">
                                {toTitleCase(appointment.representative.appointment.nameInput)} {toTitleCase(appointment.representative.appointment.lastNameInput)}
                              </Text>
                            )}
                        <Text fontSize="xs" color={textMuted} textTransform="capitalize">
                          {appointment.representative.relationship || "Representative"}
                        </Text>
                      </VStack>
                    </HStack>
                    {appointment.representative.appointment.phoneInput && (
                      <HStack spacing={3} pl={10}>
                        <Icon as={FaPhone} color={textMuted} boxSize={3} />
                        <Text fontSize="xs" color={textMuted}>
                          {appointment.representative.appointment.phoneInput}
                        </Text>
                      </HStack>
                    )}
                  </VStack>
                </Box>
              )}

              {/* Contact Preference */}
              {appointment.contactPreference && (
                <Box bg={sectionBg} p={4} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
                  <Text fontSize="sm" fontWeight="bold" mb={2} textTransform="uppercase" letterSpacing="wide">
                    Preferences
                  </Text>
                  <HStack spacing={2}>
                    <Badge colorScheme={appointment.contactPreference === "sms" ? "blue" : "green"}>
                      {appointment.contactPreference === "sms" ? "SMS" : "Call"}
                    </Badge>
                    <Text fontSize="xs" color={textMuted}>
                      Preferred contact method
                    </Text>
                  </HStack>
                </Box>
              )}

              {/* Notes */}
              {appointment.note && (
                <Box bg={sectionBg} p={4} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
                  <Text fontSize="sm" fontWeight="bold" mb={2} textTransform="uppercase" letterSpacing="wide">
                    Notes
                  </Text>
                  <Text fontSize="sm" color={textMuted}>
                    {appointment.note}
                  </Text>
                </Box>
              )}

              {/* Appointment Dates */}
              {appointment.selectedAppDates && appointment.selectedAppDates.length > 0 && (
                <Box bg={sectionBg} p={4} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
                  <Text fontSize="sm" fontWeight="bold" mb={3} textTransform="uppercase" letterSpacing="wide">
                    Scheduled Appointments
                  </Text>
                  <VStack align="stretch" spacing={2}>
                    {appointment.selectedAppDates.slice(0, 3).map((appDate, idx) => (
                      <HStack key={idx} spacing={3} align="start">
                        <Icon as={FaCalendarAlt} color={textMuted} boxSize={3} mt={0.5} />
                        <VStack align="start" spacing={0} flex="1">
                          <Text fontSize="sm" fontWeight="medium">
                            {new Date(appDate.startDate).toLocaleDateString("en-AU", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </Text>
                          <Text fontSize="xs" color={textMuted}>
                            {new Date(appDate.startDate).toLocaleTimeString("en-AU", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                        </VStack>
                        <Badge
                          colorScheme={
                            appDate.status === "Contacted"
                              ? "green"
                              : appDate.status === "Pending"
                              ? "yellow"
                              : "gray"
                          }
                          fontSize="xs"
                        >
                          {appDate.status}
                        </Badge>
                      </HStack>
                    ))}
                    {appointment.selectedAppDates.length > 3 && (
                      <Text fontSize="xs" color={textMuted} fontStyle="italic">
                        +{appointment.selectedAppDates.length - 3} more appointment{appointment.selectedAppDates.length - 3 !== 1 ? 's' : ''}
                      </Text>
                    )}
                  </VStack>
                </Box>
              )}

              {/* Providers */}
              {appointment.providers && appointment.providers.length > 0 && (
                <Box bg={sectionBg} p={4} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
                  <Text fontSize="sm" fontWeight="bold" mb={2} textTransform="uppercase" letterSpacing="wide">
                    Assigned Providers
                  </Text>
                  <VStack align="stretch" spacing={2}>
                    {appointment.providers.map((provider: any, idx: number) => {
                      const fullProviderNameRaw = `${provider.firstName || ""} ${provider.lastName || ""}`.trim();
                      if (!fullProviderNameRaw) return null; // hide empty provider rows
                      const fullProviderName = toTitleCase(fullProviderNameRaw);
                      return (
                      <HStack key={idx} spacing={2}>
                        <Box 
                          w="24px"
                          h="24px"
                          bg={useColorModeValue("gray.200", "gray.600")}
                          borderRadius="md"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          flexShrink={0}
                        >
                          <Icon 
                            as={FaUser} 
                            boxSize="12px" 
                            color={provider.color ? `${provider.color}.500` : useColorModeValue("gray.400", "gray.500")}
                          />
                        </Box>
                        <Text fontSize="sm">
                          {fullProviderName}
                        </Text>
                      </HStack>
                      );
                    })}
                  </VStack>
                </Box>
              )}

              {/* Patient Notes */}
              {appointment.note && (
                <Box bg={sectionBg} p={4} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
                  <Text fontSize="sm" fontWeight="bold" mb={2} textTransform="uppercase" letterSpacing="wide">
                    Patient Notes
                  </Text>
                  <Text fontSize="sm" color={textMuted} whiteSpace="pre-wrap">
                    {appointment.note}
                  </Text>
                </Box>
              )}

              {/* Additional Info / Reason */}
              {appointment.textAreaInput && (
                <Box bg={sectionBg} p={4} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
                  <Text fontSize="sm" fontWeight="bold" mb={2} textTransform="uppercase" letterSpacing="wide">
                    Reason for Visit
                  </Text>
                  <Text fontSize="sm" color={textMuted} whiteSpace="pre-wrap">
                    {appointment.textAreaInput}
                  </Text>
                </Box>
              )}

              {/* Reschedule Flag */}
              {appointment.reschedule && (
                <Box bg="orange.50" p={3} borderRadius="lg" borderWidth="1px" borderColor="orange.200">
                  <HStack spacing={2}>
                    <Badge colorScheme="orange">Reschedule Requested</Badge>
                    <Text fontSize="xs" color="orange.700">
                      Patient has requested to reschedule
                    </Text>
                  </HStack>
                </Box>
              )}
            </>
          )}

          {/* Conversation Info */}
          <Box bg={sectionBg} p={4} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
            <Text fontSize="sm" fontWeight="bold" mb={3} textTransform="uppercase" letterSpacing="wide">
              Conversation Status
            </Text>
            <VStack align="stretch" spacing={2}>
              <HStack justify="space-between">
                <Text fontSize="sm" color={textMuted}>
                  Unread Messages
                </Text>
                <Badge colorScheme={conversation.unreadCount ? "red" : "gray"}>
                  {conversation.unreadCount || 0}
                </Badge>
              </HStack>
              <HStack justify="space-between">
                <Text fontSize="sm" color={textMuted}>
                  Archived
                </Text>
                <Badge colorScheme={conversation.archived ? "yellow" : "gray"}>
                  {conversation.archived ? "Yes" : "No"}
                </Badge>
              </HStack>
            </VStack>
          </Box>
        </VStack>
      </Box>
    </VStack>
  );
}
