import React, { ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import DOMPurify from "dompurify";
import CustomHeading from "../Form/CustomHeading";
import CustomInputN from "../Form/CustomInputN";

import { MarkedEvents } from "@/Hooks/Handles/useSlotSelection";
import { AppointmentForm, appointmentsSchema } from "@/schemas/AppointmentsSchema";
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Collapse,
  Divider,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  IconButton,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Radio,
  RadioGroup,
  SimpleGrid,
  Spinner,
  Tooltip,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { QueryObserverResult, RefetchOptions, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import he from "he";
import { SlotInfo } from "react-big-calendar";
import { Controller, FieldErrors, useForm } from "react-hook-form";
import { FiPhone } from "react-icons/fi";
import { LuUserPen } from "react-icons/lu";
import { MdAlternateEmail, MdEventBusy, MdEventNote } from "react-icons/md";
import CustomButtonGroup from "../Form/CustomButtonGroup";
import CustomCheckbox from "../Form/CustomCheckbox";
import CustomTextArea from "../Form/CustomTextArea";
import { DateRange } from "./CustomBestApp";
import { useNavigate } from "react-router-dom";
import CustomCalendarEntryForm from "../Scheduler/CustomCalendarEntryForm";
import { Appointment, ContactPreference, Priority, SelectedDates, TimeBlock, Treatment, WeekDay } from "@/types";
import { useUpdateItems } from "@/Hooks/Query/useUpdateItems";
import AvailabilityDates2 from "./AvailabilityDates2";
import { useInsertToCollection } from "@/Hooks/Query/useInsertToCollection";
import { TreatmentSelector } from "../Treatments/TreatmentSelector";
import PhoneInput from "../Form/PhoneInput";
import { ContactForm, contactsSchema } from "@/schemas/ContactSchema";
import { appointmentsKey, appointmentsSearchKey } from "@/lib/queryKeys";
import { PageResp } from "@/Hooks/Query/useAppointmentsPaginated";

dayjs.extend(utc);
dayjs.extend(timezone);

type Props = {
  typeButonVisible?: boolean;
  onlyPatient?: boolean;
  onClose_1?: () => void;
  rfetchPl?: (options?: RefetchOptions) => Promise<QueryObserverResult<any, Error>>;
  handleAppSelectEvent?: (slotInfo: SlotInfo) => void;
  handleAppSelectSlot?: (slotInfo: { start: Date; end: Date }) => void;
  markedAppEvents?: MarkedEvents;
  handleSelectEvent?: (slotInfo: SlotInfo) => void;
  handleSelectSlot?: (slotInfo: { start: Date; end: Date }) => void;
  markedEvents?: MarkedEvents;
  refetch_list?: ((options?: RefetchOptions) => Promise<QueryObserverResult<unknown, Error>>) | undefined;
  children?: ReactNode;
  title?: string;
  btnName?: string;
  dates?: SelectedDates;
  datesApp?: { startDate: Date; endDate: Date }[];
  onDatesChange?: React.Dispatch<React.SetStateAction<DateRange[]>>;
  nameVal?: string;
  idVal?: string;
  lastNameVal?: string;
  phoneVal?: string;
  phoneFieldReadOnly?: boolean;
  reschedule?: boolean;
  emailVal?: string;
  priorityVal?: Priority;
  note?: string;
  datesSelected?: SelectedDates;
  datesAppSelected?: DateRange[];
  mode: "CREATION" | "EDITION";
  toastInfo: { description: string; title: string };
  setDates?: React.Dispatch<React.SetStateAction<DateRange[]>>;
  setDatesApp?: React.Dispatch<React.SetStateAction<DateRange[]>>;
  treatmentBack?: Treatment;
  conversationId?: string;
  refetchPage?: (options?: RefetchOptions | undefined) => Promise<QueryObserverResult<PageResp<Appointment>, Error>>;
  contactPreference?:ContactPreference
};

function CustomEntryForm({
  contactPreference,
  children,
  dates,
  btnName = "Save",
  onClose_1,
  nameVal,
  lastNameVal,
  phoneVal,
  emailVal,
  priorityVal,
  datesSelected,
  datesAppSelected,
  note,
  reschedule = false,
  rfetchPl,
  treatmentBack,
  idVal,
  mode = "CREATION",
  refetch_list,
  refetchPage,
  toastInfo,
  onlyPatient = false,
  setDatesApp,
  typeButonVisible = true,
  phoneFieldReadOnly = false,
  conversationId,
}: Props) {
  const { onOpen: onOpenApp, onClose: onCloseApp, isOpen: isOpenApp } = useDisclosure();
  const [isAnAppointment, setIsAnAppointment] = useState(!onlyPatient);
  const onToggle = useCallback(() => setIsAnAppointment((s) => !s), []);
  const navigate = useNavigate();

  interface SanitizeAppointmensInput {
    nameInput: string;
    lastNameInput: string;
    phoneInput: string;
    emailInput?: string;
    priority?: string;
    note?: string;
    _id?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }
  interface SanitizeContactsInput {
    nameInput: string;
    lastNameInput: string;
    phoneInput: string;
    emailInput?: string;
  }
  interface SanitizeAppointmensOutput extends SanitizeAppointmensInput { }
  interface SanitizeContactsOutput extends SanitizeContactsInput { }

  const sanitize = (
    data: SanitizeAppointmensInput | SanitizeContactsInput
  ): SanitizeAppointmensOutput | SanitizeContactsOutput => {
    const base = {
      ...data,
      nameInput: DOMPurify.sanitize(data.nameInput, { ALLOWED_TAGS: [] }),
      lastNameInput: DOMPurify.sanitize(data.lastNameInput, { ALLOWED_TAGS: [] }),
      phoneInput: DOMPurify.sanitize(data.phoneInput, { ALLOWED_TAGS: [] }),
      emailInput: DOMPurify.sanitize(data.emailInput || "", { ALLOWED_TAGS: [] }),
    };
    if ("priority" in data || "note" in data || "_id" in data) {
      return {
        ...base,
        priority: DOMPurify.sanitize(data.priority || "", { ALLOWED_TAGS: [] }),
        note: DOMPurify.sanitize(data.note || "", { ALLOWED_TAGS: [] }),
        _id: data._id ? DOMPurify.sanitize(data._id, { ALLOWED_TAGS: [] }) : undefined,
      } as SanitizeAppointmensOutput;
    }
    return base as SanitizeContactsOutput;
  };

  const { mutate, isPending } = useInsertToCollection<{ message: string; document: any }>("Appointment");
  const { mutate: editItem, isPending: editIsPending } = useUpdateItems(
    isAnAppointment ? "update-items" : "update-items-contacts"
  );
  const formBusy = isPending || editIsPending;

  const queryClient = useQueryClient();
  const toast = useToast();

  // RHF — clave: mantener montados los Controllers (no usar `&&` para desmontar)
  const {
    register,
    reset,
    handleSubmit,
    control,
    setValue,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<AppointmentForm | ContactForm>({
    resolver: zodResolver(isAnAppointment ? appointmentsSchema : contactsSchema),
    shouldUnregister: true, // OK, mientras no desmontemos el Controller
    defaultValues: {
      treatment: he.decode(treatmentBack?._id?.toString?.() || ""),
      selectedAppDates: datesAppSelected || [],
      selectedDates: datesSelected,
      contactPreference: contactPreference || "sms",
      nameInput: he.decode(nameVal || ""),
      lastNameInput: he.decode(lastNameVal || ""),
      note: he.decode(note || ""),
      phoneInput: he.decode(phoneVal || ""),
      emailInput: he.decode(emailVal || ""),
      // CONSISTENCIA: usar siempre _id (string) como valor del formulario
      priority: priorityVal?._id ?? undefined,
      id: idVal || "default",
      reschedule: !!reschedule,
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const appointmentErrors = errors as FieldErrors<AppointmentForm>;

  const [duration, setDuration] = useState<number>(priorityVal?.durationHours || 0);
  const [, setIdpriority] = useState<string>("");
  const [color, setColor] = useState<string>("");
  const [, setTreatment] = useState<Treatment | undefined>(treatmentBack);
  // `selected` controla el highlight visual por id numérico
  const [selected, setSelected] = useState<number>(priorityVal?.id ?? -1);
  const [selectedTreatment] = useState<number>(priorityVal?.id ?? -1);

  // Sincroniza el valor del formulario cuando llega priorityVal (edición)
  useEffect(() => {
    if (!priorityVal) return;
    const current = getValues("priority") as unknown as string | undefined;
    const next = priorityVal._id ?? "";
    if (!current && next) {
      setValue("priority", next, { shouldDirty: false, shouldTouch: false });
      // opcional: valida el campo al asignar
      trigger("priority");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priorityVal]);

  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [selectedAppDates, setSelectedAppDates] = useState<DateRange[]>(datesAppSelected || []);
  const [selectedDays, setSelectedDays] = useState<Partial<Record<WeekDay, TimeBlock[]>>>(() => {
    if (Array.isArray(dates?.days)) {
      return dates.days.reduce((acc, curr) => {
        acc[curr.weekDay] = curr.timeBlocks;
        return acc;
      }, {} as Partial<Record<WeekDay, TimeBlock[]>>);
    }
    return {};
  });

  const onSubmit = (data: AppointmentForm | ContactForm) => {
    const cleanedData = sanitize(data);
    console.log("cleanedData",cleanedData)
    if (mode === "CREATION") {
      mutate(cleanedData, {
        onSuccess: () => {
          toast({
            title: "PatientPatient successfully submitted.",
            description: "Your new contact has been submitted successfully",
            status: "success",
            duration: 3000,
            isClosable: true,
          });
          reset();
          queryClient.refetchQueries({ queryKey: ["DraggableCards"] });
          queryClient.invalidateQueries({ queryKey: ["DraggableCards"] });
          queryClient.invalidateQueries({ queryKey: ["Appointment"] });
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
          if (conversationId) queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
          if (onClose_1) onClose_1();
        },
        onError: (error: any) => {
          toast({
            title: "Error submitting the form.",
            description: error?.response?.data?.message || "An unexpected error occurred.",
            status: "error",
            duration: 4000,
            isClosable: true,
          });
        },
      });
    } else if (mode === "EDITION") {
      const { description: toastDesc, title: toastTitle } = toastInfo;
      const payload = [
        {
          table: "Appointment",
          id_field: "_id",
          id_value: idVal ?? "",
          data: cleanedData,
        },
      ];
      editItem(payload, {
        onSuccess: async () => {
          if (refetch_list) refetch_list();
          toast({ title: toastTitle, description: toastDesc, status: "success", duration: 3000, isClosable: true });
          if (rfetchPl) rfetchPl();
          if (onClose_1) onClose_1();
          await queryClient.cancelQueries({ queryKey: appointmentsKey.base });
          await queryClient.cancelQueries({ queryKey: appointmentsSearchKey.base });
          if (refetchPage) refetchPage();
          queryClient.refetchQueries({ queryKey: ["DraggableCards"] });
          queryClient.invalidateQueries({ queryKey: ["DraggableCards"] });
          queryClient.invalidateQueries({ queryKey: ["Appointment"] });
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
          if (conversationId) {
            await queryClient.refetchQueries({
              predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "messages" && q.queryKey[1] === conversationId,
              type: "active",
            });
          }
        },
      });
    }
  };

  const onError = () => {
    setHasSubmitted(true);
  };

  return (
    <>
      <Box
        as="form"
        noValidate
        autoComplete="on"
        aria-busy={formBusy}
        fontSize="xs"
        borderWidth="1px"
        rounded="lg"
        shadow="1px 1px 3px rgba(0,0,0,0.3)"
        maxWidth={1000}
        px={6}
        pb={6}
        m="10px auto"
        onSubmit={handleSubmit(onSubmit, onError)}
      >
        {/* Toggle */}
        <Box position="relative" p={4}>
          <Tooltip label={"Change Entry"} hasArrow placement="top">
            {typeButonVisible && (
              <IconButton
                type="button"
                position="absolute"
                top="1"
                right="1"
                zIndex="10"
                onClick={onToggle}
                aria-label="Toggle appointment section"
                aria-pressed={isAnAppointment}
                icon={isAnAppointment ? <MdEventBusy size={20} /> : <MdEventNote size={20} />}
                bgGradient="linear(to-r, teal.400, blue.500)"
                color="white"
                rounded="full"
                boxSize="42px"
                shadow="md"
                mt={4}
                transition="all 0.25s ease"
                _hover={{ bgGradient: "linear(to-r, teal.500, blue.600)", transform: "scale(1.08)", shadow: "lg" }}
                _active={{ transform: "scale(0.95)", shadow: "sm" }}
                isDisabled={formBusy}
              />
            )}
          </Tooltip>
        </Box>

        <CustomHeading fontSize="md">{isAnAppointment ? "New Appointment" : "New Contact"}</CustomHeading>

        {/* Identity */}
        <Flex gap={3}>
          <CustomInputN
            isPending={formBusy}
            type="text"
            name="nameInput"
            placeholder="Name"
            register={register}
            error={errors?.nameInput}
            ico={<LuUserPen color="gray.300" />}
            autoComplete="given-name"
            spellCheck={false}
          />
          <CustomInputN
            isPending={formBusy}
            type="text"
            name="lastNameInput"
            placeholder="Last Name"
            register={register}
            error={errors?.lastNameInput}
            ico={<LuUserPen color="gray.300" />}
            autoComplete="family-name"
            spellCheck={false}
          />
        </Flex>

        {/* Contact */}
        <Flex gap={3} mt={2}>
          <Controller
            name="phoneInput"
            control={control}
            render={({ field }) => (
              <PhoneInput
                {...field}
                isReadOnly={phoneFieldReadOnly}
                onChange={(val) => field.onChange(val)}
                type="tel"
                isPending={formBusy}
                name="phoneInput"
                error={errors?.phoneInput}
                ico={<FiPhone color="gray.300" />}
                placeholder="04XX XXX XXX"
                anotherName="Phone Number"
                autoComplete="tel-national"
                inputMode="tel"
              />
            )}
          />
          <FormControl mt={3} isInvalid={!!(errors as FieldErrors<AppointmentForm>).contactPreference}>
            <FormLabel textAlign={"center"}>Contact preference</FormLabel>
            <Controller
              name="contactPreference"
              control={control}
              render={({ field }) => (
                <RadioGroup value={field.value} onChange={field.onChange}   >
                  <HStack spacing={6} w={"-webkit-fit-content"} mx="auto">
                    <Radio value="call">Call</Radio>
                    <Radio value="sms">SMS</Radio>
                  </HStack>
                </RadioGroup>
              )}
            />
            <FormErrorMessage>
              {(errors as FieldErrors<AppointmentForm>).contactPreference?.message}
            </FormErrorMessage>
          </FormControl>
          <CustomInputN
            isPending={formBusy}
            name="emailInput"
            type="email"
            placeholder="Email"
            register={register}
            error={errors?.emailInput}
            ico={<MdAlternateEmail color="gray.300" />}
            autoComplete="email"
            spellCheck={false}
          />
        </Flex>

        {/* Mantener montado el bloque de Appointment: no usar `&&` que desmonte */}
        <Collapse in={isAnAppointment} animateOpacity>
          <Divider my={5} />

          {/* Treatment Type */}
          <FormControl mt="2%" isInvalid={!!(appointmentErrors && appointmentErrors.treatment)}>
            <FormLabel>Treatment Type</FormLabel>
            <Controller
              name="treatment"
              control={control}
              render={({ field }) => (
                <Box role="group" aria-label="Treatment selector">
                  <TreatmentSelector
                    onSelect={(t) => setTreatment(t)}
                    selectedId={field.value}
                    selected={selectedTreatment}
                    {...field}
                    onChange={(id, _value, _color, _durationTreatment) => {
                      setIdpriority(id);
                      field.onChange(id);
                      trigger("treatment");
                    }}
                  />
                </Box>
              )}
            />
            <FormErrorMessage>{appointmentErrors?.treatment?.message}</FormErrorMessage>
          </FormControl>

          <Divider my={5} />

          {/* Priority Level — valor de RHF es SIEMPRE _id (string) */}
          <FormControl mt="2%" isInvalid={!!(appointmentErrors && appointmentErrors.priority)}>
            <FormLabel>Priority Level</FormLabel>
            <Controller
              name="priority"
              control={control}
              render={({ field }) => (
                <Box role="group" aria-label="Priority level selector">
                  <CustomButtonGroup
                    selected={selected}
                    setSelected={setSelected}
                    isPending={formBusy}
                    error={appointmentErrors?.priority}
                    value={(field.value as string) || ""} // _id actual en RHF
                    onChange={(id, _name, color, duration) => {
                      // id = _id canonizado
                      setIdpriority(id);
                      field.onChange(id);
                      setDuration(duration ? duration : 0);
                      setColor(color ? color : "gray");
                      // valida inmediatamente para limpiar “required”
                      trigger("priority");
                    }}
                  />
                </Box>
              )}
            />
            <FormErrorMessage>{appointmentErrors?.priority?.message}</FormErrorMessage>
          </FormControl>

          <Divider my={5} />

          <SimpleGrid columns={2} spacing={4} my={2}>
            <Box pt={1}>
              <CustomTextArea
                isPending={formBusy}
                resize="none"
                name={"note"}
                pb={5}
                px={5}
                placeholder="Note for this appointment"
                register={register}
                error={appointmentErrors?.note}
                spellCheck
                autoComplete="off"
              />
            </Box>

            <Box p={1}>
              <Controller
                name="selectedAppDates"
                control={control}
                render={({ field }) => (
                  <FormControl isInvalid={!!appointmentErrors?.selectedAppDates}>
                    <FormLabel>Appointment Date</FormLabel>
                    <Flex wrap="wrap" gap={3}>
                      {field.value?.map((item: DateRange, index: number) => {
                        const start = dayjs.utc(item.startDate).tz("Australia/Sydney");
                        const end = dayjs.utc(item.endDate).tz("Australia/Sydney");
                        return (
                          <Button key={`${start.toISOString()}-${index}`} fontSize="xs" isDisabled={formBusy} colorScheme="blue" type="button">
                            {start.format("YYYY/MM/DD HH:mm")} - {end.format("HH:mm")}
                          </Button>
                        );
                      })}
                    </Flex>
                    <FormErrorMessage>{appointmentErrors?.selectedAppDates?.message}</FormErrorMessage>
                  </FormControl>
                )}
              />

              <FormControl pt={4}>
                {selected > 0 ? (
                  <>
                    <Button type="button" onClick={onOpenApp} isDisabled={formBusy}>
                      Add Appointment
                    </Button>
                    <Modal isOpen={isOpenApp} onClose={onCloseApp} size={"6xl"} isCentered motionPreset="scale">
                      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(8px)" />
                      <ModalContent borderRadius="2xl" p={4} boxShadow="2xl">
                        <ModalHeader fontSize="2xl" fontWeight="bold">
                          Add Appointment
                        </ModalHeader>
                        <ModalCloseButton />
                        <ModalBody p={0}>
                          <CustomCalendarEntryForm
                            colorEvent={color}
                            height="50vh"
                            offset={duration}
                            selectedAppDates={selectedAppDates}
                            setSelectedAppDates={setSelectedAppDates}
                            trigger={trigger as any}
                            setValue={setValue}
                            onClose={onCloseApp}
                          />
                        </ModalBody>
                        <ModalFooter>
                          <Button onClick={onCloseApp} variant="ghost" colorScheme="gray" isDisabled={formBusy} type="button">
                            Cancel
                          </Button>
                        </ModalFooter>
                      </ModalContent>
                    </Modal>
                  </>
                ) : (
                  <Alert status="warning" rounded={"10px"}>
                    <AlertIcon />
                    You must select a category
                  </Alert>
                )}
              </FormControl>
            </Box>
          </SimpleGrid>

          <Divider my={5} />

          <SimpleGrid columns={1} spacing={4}>
            <Box p={1}>
              <FormControl isInvalid={hasSubmitted && !!appointmentErrors?.selectedDates}>
                <FormLabel>Availability</FormLabel>
                <Box display="flex" justifyContent="center" width="100%">
                  <AvailabilityDates2
                    modeInput={true}
                    selectedDaysResp={selectedDays}
                    setSelectedDaysResp={setSelectedDays}
                    hasSubmitted={hasSubmitted}
                    trigger={trigger}
                    setValue={setValue}
                    isPending={formBusy}
                  />
                </Box>
                <FormErrorMessage>{appointmentErrors?.selectedDates?.message}</FormErrorMessage>
              </FormControl>
              <FormControl pt={4}></FormControl>
            </Box>
          </SimpleGrid>
        </Collapse>

        {mode === "EDITION" && reschedule && (
          <SimpleGrid columns={1} spacing={4} my={2}>
            <Box borderWidth="1px" rounded="lg" shadow="1px 1px 3px rgba(0,0,0,0.1)" py={2}>
              <CustomCheckbox
                name="reschedule"
                isPending={formBusy}
                anotherName="Re-Schedule"
                register={register}
                error={(appointmentErrors as any)?.reschedule}
              />
            </Box>
          </SimpleGrid>
        )}

        {/* Hidden id */}
        <CustomInputN type="hidden" name="id" register={register} error={(appointmentErrors as any)?.id} />

        <FormControl pt={4}>{children}</FormControl>

        <Flex justifyContent="flex-end" mt={6} gap={3}>
          <Button fontSize="xs" type="submit" colorScheme="red" isDisabled={formBusy} width="150px" aria-live="polite">
            {formBusy ? <Spinner size="sm" /> : btnName}
          </Button>
        </Flex>
      </Box>
    </>
  );
}

export default CustomEntryForm;
