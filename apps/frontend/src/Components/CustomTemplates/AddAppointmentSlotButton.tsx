import React, { useCallback, useMemo, useState } from "react";
import {
  IconButton,
  Tooltip,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Box,
  FormControl,
  FormLabel,
  HStack,
  Button,
  useToast,
  Tag,
  Text,
  Divider,
  Flex,
  chakra,
} from "@chakra-ui/react";
import { MdAdd } from "react-icons/md";
import { FiClock, FiCheckCircle } from "react-icons/fi";
import { Views } from "react-big-calendar";
import dayjs from "dayjs";
import { Appointment, ContactStatus } from "@/types";
import { useUpdateItems } from "@/Hooks/Query/useUpdateItems";
import CustomCalendarEntryForm from "../Scheduler/CustomCalendarEntryForm";
import { useQueryClient } from "@tanstack/react-query";

// Quitamos plugins de timezone: no se requiere TZ explícita

type Props = {
  appointment: Appointment;
  onSaved?: () => Promise<any> | void;
};

// Pequeño helper para formatear rango
const fmtRange = (s?: Date, e?: Date) => {
  if (!s || !e) return "—";
  return `${dayjs(s).format("DD/MM/YYYY HH:mm")} – ${dayjs(e).format("HH:mm")}`;
};

export default function AddAppointmentSlotButton({ appointment, onSaved }: Props) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const { mutateAsync, isPending } = useUpdateItems();
  const queryClient = useQueryClient();

  // Estado del calendario embebido
  const [selectedAppDates, setSelectedAppDates] = useState<{ startDate: Date; endDate: Date }[]>([]);
  const hasSelection = selectedAppDates.length > 0;
  const currentRange = selectedAppDates[0];
  const offsetHours = 1; // duración base inicial; usuario puede redimensionar en el calendar

  const resetLocal = useCallback(() => {
    setSelectedAppDates([]);
  }, []);

  const handleSave = async () => {
    try {
      const sel = currentRange;
      if (!sel) {
        toast({ status: "warning", title: "No slot selected" });
        return;
      }

      const start = dayjs(sel.startDate);
      const end = dayjs(sel.endDate);
      const now = dayjs();

      if (!start.isValid() || !end.isValid()) {
        toast({ status: "warning", title: "Invalid slot" });
        return;
      }
      if (!end.isAfter(start)) {
        toast({ status: "warning", title: "End must be after start" });
        return;
      }
      if (start.isBefore(now)) {
        toast({ status: "warning", title: "Start is in the past" });
        return;
      }

      const durationMin = end.diff(start, "minute");
      if (durationMin < 5 || durationMin > 8 * 60) {
        toast({ status: "warning", title: "Unusual duration", description: "Use between 5 minutes and 8 hours." });
        return;
      }
      const noContacted: ContactStatus = "NoContacted";
      const newSlot = {
        startDate: start.toDate(),
        endDate: end.toDate(),
        status: noContacted,
        rescheduleRequested: false,
        proposed: { createdAt: new Date(), proposedBy: "system" },
      } as any;

      const current = Array.isArray(appointment.selectedAppDates) ? appointment.selectedAppDates : [];
      const nextArray = [...current, newSlot];

      const payload = [
        {
          table: "Appointment",
          id_field: "_id",
          id_value: appointment._id,
          data: { selectedAppDates: nextArray },
        },
      ];

      await mutateAsync(payload as any);
      // Solo si el mutate fue exitoso, sincronizamos todas las queries relacionadas
      await queryClient.cancelQueries({
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "appointments-range",
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["appointments-range"] }),
        queryClient.invalidateQueries({ queryKey: ["appointments-month-days"] }),
        queryClient.invalidateQueries({ queryKey: ["Appointment"] }),
      ]);

      toast({ status: "success", title: "Appointment date added" });
      resetLocal();
      onClose();
      if (onSaved) await onSaved();
    } catch (err: any) {
      console.error(err);
      toast({ status: "error", title: "Failed to add date", description: err?.message || "Unexpected error" });
    }
  };

  return (
    <>
      <Tooltip label="Add appointment date" placement="top">
        <IconButton
          aria-label="Add appointment date"
          icon={<MdAdd />}
          size="sm"
          variant="ghost"
          colorScheme="gray"
          onClick={onOpen}
          _hover={{ bg: 'gray.100', color: 'teal.600' }}
          _active={{ bg: 'gray.200' }}
          borderRadius="full"
        />
      </Tooltip>

      <Modal isOpen={isOpen} onClose={isPending ? () => { } : () => { resetLocal(); onClose(); }} size="6xl" isCentered>
        <ModalOverlay />
        <ModalContent borderRadius="2xl" shadow="2xl" bg="white" maxW="1200px">
          <ModalHeader fontWeight="bold">Add appointment date</ModalHeader>
          <ModalCloseButton disabled={isPending} />
          <ModalBody>
            <Flex direction={{ base: "column", xl: "row" }} gap={8} align="stretch">
              <Box flex={3} minH="50vh" borderWidth="1px" borderRadius="lg" overflow="hidden" bg="white" shadow="sm" _hover={{ shadow: "md" }} transition="all .25s">
                <CustomCalendarEntryForm
                  height="50vh"
                  offset={offsetHours}
                  colorEvent="teal"
                  selectedAppDates={selectedAppDates}
                  setSelectedAppDates={setSelectedAppDates as any}
                  toolbar={true}
                  calView={Views.WEEK}
                />
              </Box>
              <Box flex={2} display="flex" flexDirection="column" gap={5}>
                <FormControl>
                  <FormLabel fontSize="sm" fontWeight="semibold">Selected range</FormLabel>
                  <Tag size="lg" colorScheme={hasSelection ? 'teal' : 'gray'} variant="subtle" rounded="full" py={2} px={5} fontWeight="semibold">
                    {fmtRange(currentRange?.startDate, currentRange?.endDate)}
                  </Tag>
                </FormControl>
                <Box fontSize="xs" color="gray.600" lineHeight={1.6} bg="gray.50" p={4} borderRadius="md" borderWidth="1px" shadow="inner">
                  <HStack align="start" spacing={2} mb={2}>
                    <chakra.span color="teal.500"><FiClock /></chakra.span>
                    <Text>Select a block then drag or resize to adjust duration.</Text>
                  </HStack>
                  <HStack align="start" spacing={2} mb={2}>
                    <chakra.span color="green.500"><FiCheckCircle /></chakra.span>
                    <Text>It will be added as <b>Confirmed</b> at the end of the list.</Text>
                  </HStack>
                  <Text>Allowed duration: 5 minutes to 8 hours. Must start in the future.</Text>
                </Box>
                <Flex mt="auto" gap={4}>
                  <Button onClick={() => { resetLocal(); onClose(); }} variant="ghost" flex={1}>Cancel</Button>
                  <Button colorScheme="teal" flex={1} onClick={handleSave} isDisabled={!hasSelection || isPending} isLoading={isPending}>Save</Button>
                </Flex>
              </Box>
            </Flex>
          </ModalBody>
          <ModalFooter>
            <Text fontSize="xs" color="gray.400" mx="auto">One range per action • Repeat to add more</Text>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
