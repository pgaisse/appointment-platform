import React, { ReactNode, useState } from "react";

import DOMPurify from 'dompurify';
import { IoMdClose } from "react-icons/io";
import CustomHeading from "../Form/CustomHeading";
import CustomInputN from "../Form/CustomInputN";

import { MarkedEvents } from "@/Hooks/Handles/useSlotSelection";
import { AppointmentForm, appointmentsSchema } from "@/schemas/AppointmentsSchema";
import {
  Box,
  Button,
  Divider,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  SimpleGrid,
  Spinner,
  useToast,
  Alert,
  AlertIcon,
  useDisclosure,
  ModalOverlay,
  Modal,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Collapse,
  IconButton,
  Tooltip
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { QueryObserverResult, RefetchOptions, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import he from 'he';
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
import { Priority, SelectedDates, TimeBlock, Treatment, WeekDay } from "@/types";
import { useUpdateItems } from "@/Hooks/Query/useUpdateItems";
import AvailabilityDates2 from "./AvailabilityDates2";
import { useInsertToCollection } from "@/Hooks/Query/useInsertToCollection";
import { TreatmentSelector } from "../Treatments/TreatmentSelector";
import PhoneInput from "../Form/PhoneInput";
import { ContactForm, contactsSchema } from "@/schemas/ContactSchema";
dayjs.extend(utc);
dayjs.extend(timezone);



type Props = {
  onClose_1?: () => void;
  rfetchPl?: (options?: RefetchOptions) => Promise<QueryObserverResult<any, Error>>
  handleAppSelectEvent?: (slotInfo: SlotInfo) => void;
  handleAppSelectSlot?: (slotInfo: { start: Date; end: Date; }) => void;
  markedAppEvents?: MarkedEvents;
  handleSelectEvent?: (slotInfo: SlotInfo) => void;
  handleSelectSlot?: (slotInfo: { start: Date; end: Date; }) => void;
  markedEvents?: MarkedEvents;
  refetch_list?: ((options?: RefetchOptions) => Promise<QueryObserverResult<unknown, Error>>) | undefined
  children?: ReactNode;
  title?: string
  btnName?: string
  dates?: SelectedDates;
  datesApp?: { startDate: Date; endDate: Date }[];
  onDatesChange?: React.Dispatch<React.SetStateAction<DateRange[]>>
  nameVal?: string
  idVal?: string
  lastNameVal?: string
  phoneVal?: string
  reschedule?: boolean
  emailVal?: string
  priorityVal?: Priority
  note?: string
  datesSelected?: SelectedDates
  datesAppSelected?: DateRange[]
  mode: "CREATION" | "EDITION"
  toastInfo: { description: string, title: string }
  setDates?: React.Dispatch<React.SetStateAction<DateRange[]>>
  setDatesApp?: React.Dispatch<React.SetStateAction<DateRange[]>>
  treatmentBack?: Treatment

};

function CustomEntryForm({ children, dates, 
  btnName = "Save", onClose_1,
  nameVal, lastNameVal, phoneVal, emailVal, priorityVal, datesSelected, datesAppSelected, note, reschedule = false, rfetchPl, treatmentBack,
  idVal, mode = "CREATION", refetch_list, toastInfo,
  
  setDatesApp}: Props) {
  //console.log("reschedule", reschedule)

  //const {hasAppointment, setHasAppointment}=useState(true)


  const { onOpen: onOpenApp, onClose: onCloseApp, isOpen: isOpenApp } = useDisclosure();

  const [isAnAppointment, setIsAnAppointment] = useState(true); // ← abierto por defecto

  const onToggle = () => setIsAnAppointment(!isAnAppointment);
  const navigate = useNavigate();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any

  interface SanitizeAppointmensInput {
    nameInput: string;
    lastNameInput: string;
    phoneInput: string;
    emailInput?: string;
    priority?: string;
    note?: string;
    _id?: string;
    [key: string]: any; // To allow extra fields
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


  //console.log( "datesAppSelected FORM", datesAppSelected)

  //const { mutate, isPending } = useEntryForm("Appointment");
  const { mutate, isPending } = useInsertToCollection<{ message: string; document: any }>("Appointment");
  //const { mutate: editItem, isPending: editIsPending } = useEditItem({ model: "Appointment" });
  const { mutate: editItem, isPending: editIsPending } = useUpdateItems();
  const queryClient = useQueryClient();
  const toast = useToast();
  console.log("TREATMENTBACK: ", treatmentBack)
  const {
    register,
    reset,
    handleSubmit,
    control,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<AppointmentForm | ContactForm>({
    resolver: zodResolver(isAnAppointment ? appointmentsSchema : contactsSchema),
    shouldUnregister: true, // ✅ esta línea es clave
    defaultValues: {
      treatment: he.decode(treatmentBack?._id.toString() || ""),
      selectedAppDates: datesAppSelected || [],
      selectedDates: datesSelected,
      nameInput: he.decode(nameVal || ""),
      lastNameInput: he.decode(lastNameVal || ""),
      note: he.decode(note || ""),
      phoneInput: he.decode(phoneVal || ""),
      emailInput: he.decode(emailVal || ""),
      priority: priorityVal?.id.toString() ?? undefined ,
      id: idVal || "default",
      reschedule: reschedule ? true : false
    },
  });

  const appointmentErrors = errors as FieldErrors<AppointmentForm>;
  const [duration, setDuration] = useState<number>(0)
  const [] = useState<number>(0)
  const [, setIdpriority] = useState<string>("")
  const [color, setColor] = useState<string>("")
  const [, setTreatment] = useState<Treatment | undefined>(treatmentBack);
  const [selected, setSelected] = useState<number>(priorityVal?.id || -1);

  const [selectedTreatment] = useState<number>(priorityVal?.id || -1);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [selectedAppDates, setSelectedAppDates] = useState<DateRange[]>(datesAppSelected || []);

  const [selectedDays, setSelectedDays] = useState<Partial<Record<WeekDay, TimeBlock[]>>>(() => {
    if (Array.isArray(dates?.days)) {
      // Convert array of { weekDay, timeBlocks } to object { [weekDay]: timeBlocks }
      return dates.days.reduce((acc, curr) => {
        acc[curr.weekDay] = curr.timeBlocks;
        return acc;
      }, {} as Partial<Record<WeekDay, TimeBlock[]>>);
    }
    return {};
  });

  const onSubmit = (data: AppointmentForm | ContactForm) => {

    const cleanedData = sanitize(data)
    if (mode == "CREATION") {

      console.log("cleanedData", cleanedData)

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
          navigate("/appointments/priority-list");
        },
        onError: (error: any) => {
          toast({
            title: "Error submitting the form.",
            description:
              error?.response?.data?.message || "An unexpected error occurred.",
            status: "error",
            duration: 4000,
            isClosable: true,
          });
        },
      });

    } else if (mode == "EDITION") {
      const { description: toastDesc, title: toastTitle } = toastInfo;

      // If no selectedDates, it's an edit, so use editItem

      // If selectedDates is present, it's a new entry, so use the mutate function
      const payload = [{
        table: "Appointment",      // tu tabla
        id_field: "_id",      // campo PK
        id_value: idVal ?? "",   // valor PK, fallback to empty string if undefined
        data: cleanedData
      }];
      console.log("payload", payload)

      editItem(payload,
        {

          onSuccess: () => {
            if (refetch_list) { refetch_list(); }
            toast({
              title: toastTitle,
              description: toastDesc,
              status: "success",
              duration: 3000,
              isClosable: true,
            });
            if (rfetchPl) rfetchPl();
            if (onClose_1) onClose_1()
            queryClient.refetchQueries({ queryKey: ["DraggableCards"] });
            queryClient.invalidateQueries({ queryKey: ["Appointment"] });
            //useEffect(()=>{onClose;}),[onClose]
          },
        });


    }

  };

  console.log("Errors:", errors);

  const onError = () => {
    setHasSubmitted(true); // Marcamos que intentaron enviar, pero había errores
    // Opcional: console.log(errors)
  };
  return (
    <>


      <Box fontSize="xs"
        borderWidth="1px"
        rounded="lg"
        shadow="1px 1px 3px rgba(0,0,0,0.3)"
        maxWidth={1000}
        px={6}
        pb={6}

        m="10px auto"
        as="form"
        onSubmit={handleSubmit(onSubmit, onError)}
      >
        <Box position="relative" p={4} >
          <Tooltip
            label={"Change Entry"}
            hasArrow
            placement="top"
          >
            <IconButton
              position="absolute"
              top="1"
              right="1"
              zIndex="10"
              onClick={onToggle}
              aria-label="Toggle appointment section"
              icon={isAnAppointment ? <MdEventBusy size={20} /> : <MdEventNote size={20} />}
              bgGradient="linear(to-r, teal.400, blue.500)"
              color="white"
              rounded="full"
              boxSize="42px"
              shadow="md"
              mt={4}
              transition="all 0.25s ease"
              _hover={{
                bgGradient: "linear(to-r, teal.500, blue.600)",
                transform: "scale(1.08)",
                shadow: "lg",
              }}
              _active={{
                transform: "scale(0.95)",
                shadow: "sm",
              }}
            />
          </Tooltip>
        </Box>
        <CustomHeading fontSize="md">
          {isAnAppointment ? "New Appointment" : "New Contact"}
        </CustomHeading>
        <Flex gap={3}>


          <CustomInputN
            isPending={isPending || editIsPending}
            type="text"
            name="nameInput"
            placeholder="Name"
            register={register}
            error={errors?.nameInput}
            ico={<LuUserPen color='gray.300' />}

          />
          <CustomInputN
            isPending={isPending || editIsPending}
            type="text"
            name="lastNameInput"
            placeholder="Last Name"
            register={register}
            error={errors?.lastNameInput}
            ico={<LuUserPen color='gray.300' />}
          />

        </Flex>
        <Flex gap={3} mt={2}>

          <Controller
            name="phoneInput"
            control={control}
            render={({ field }) => (
              <PhoneInput
                {...field}
                onChange={(val) => field.onChange(val)} // ✅ valor limpio
                type="tel"
                isPending={isPending || editIsPending}
                name="phoneInput"
                error={errors?.phoneInput}
                ico={<FiPhone color='gray.300' />}
                placeholder="04XX XXX XXX"
                anotherName="Phone Number"
              />
            )}
          />




          <CustomInputN
            isPending={isPending || editIsPending}
            name="emailInput"
            type="email"
            placeholder="Email"
            register={register}
            error={errors?.emailInput}
            ico={<MdAlternateEmail color='gray.300' />}
          />

        </Flex>


        {isAnAppointment &&
          <Collapse in={isAnAppointment} animateOpacity>

            <Divider my={5} />
            <FormControl mt="2%" isInvalid={!!appointmentErrors.treatment}>
              <FormLabel >
                Treatment Type
              </FormLabel>
              <Controller
                name="treatment"
                control={control}
                render={({ field }) => (


                  <TreatmentSelector
                    onSelect={(t) => setTreatment(t)}
                    selectedId={field.value} // ← esta es la fuente oficial de verdad para RHF

                    selected={selectedTreatment}
                    {...field}
                    onChange={(id, _value, color, durationTreatment) => {
                      setIdpriority(id)
                      field.onChange(id);
                      setDuration(durationTreatment ? durationTreatment : 0)
                      setColor(color ? color : "gray")
                      trigger("treatment");
                    }}

                  />

                )}
              />
              <FormErrorMessage>{appointmentErrors.treatment?.message}</FormErrorMessage>
            </FormControl>

            <Divider my={5} />

            <FormControl mt="2%" isInvalid={!!appointmentErrors.priority}>
              <FormLabel >
                Priority Level
              </FormLabel>
              <Controller
                name="priority"
                control={control}
                render={({ field }) => (


                  <CustomButtonGroup
                    selected={selected}
                    setSelected={setSelected}
                    isPending={isPending || editIsPending}
                    error={appointmentErrors.priority}
                    {...field}
                    value={field.value}
                    onChange={(id, _value, color, duration) => {
                      setIdpriority(id)
                      field.onChange(id);
                      setDuration(duration ? duration : 0)
                      setColor(color ? color : "gray")
                      trigger("priority");
                    }}
                  />

                )}
              />

              <FormErrorMessage>{appointmentErrors.priority?.message}</FormErrorMessage>



            </FormControl>
            <Divider my={5} />
            <SimpleGrid columns={2} spacing={4} my={2}>
              <Box
                pt={1}

              >
                <CustomTextArea
                  isPending={isPending || editIsPending}
                  resize="none"
                  name={"note"}
                  pb={5}
                  px={5}
                  placeholder="Note for this appointment"
                  register={register}
                  error={appointmentErrors.note}

                />
              </Box>

              <Box p={1}>
                <Controller
                  name="selectedAppDates"
                  control={control}
                  render={({ field }) => (
                    <FormControl isInvalid={!!appointmentErrors.selectedAppDates}>
                      <FormLabel>Appointment Date</FormLabel>
                      <Flex wrap="wrap" gap={3}>
                        {field.value?.map((item: DateRange, index: number) => {
                          const start = dayjs.utc(item.startDate).tz("Australia/Sydney");
                          const end = dayjs.utc(item.endDate).tz("Australia/Sydney");
                          return (
                            <Button
                              fontSize="xs"
                              isDisabled={isPending || editIsPending}
                              colorScheme="blue"
                              key={index}
                              onClick={() => {
                                const updated = field.value.filter((_, i) => i !== index);
                                field.onChange(updated); // actualiza el valor registrado en RHF
                                setSelectedAppDates(updated); // actualiza tu estado local (si aún lo necesitas)
                                if (setDatesApp) setDatesApp(updated);
                                trigger("selectedAppDates"); // opcional
                              }}
                              rightIcon={<IoMdClose />}
                            >
                              {start.format("YYYY/MM/DD HH:mm")} - {end.format("HH:mm")}
                            </Button>
                          );
                        })}
                      </Flex>
                      <FormErrorMessage>{appointmentErrors.selectedAppDates?.message}</FormErrorMessage>
                    </FormControl>
                  )}
                />


                <FormControl pt={4}>

                  {selected > 0 ? (
                    <>
                      <Button onClick={onOpenApp}>

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
                              trigger={trigger}
                              setValue={setValue}
                              onClose={onCloseApp}
                            />
                          </ModalBody>
                          <ModalFooter>
                            <Button
                              onClick={onCloseApp}
                              variant="ghost"
                              colorScheme="gray"
                              isDisabled={isPending || editIsPending}
                            >
                              Cancel
                            </Button>
                          </ModalFooter>
                        </ModalContent>
                      </Modal>
                    </>
                  ) : (
                    <>

                      <Alert status='warning' rounded={"10px"}>
                        <AlertIcon />You must select a category
                      </Alert>



                    </>
                  )}


                </FormControl>
              </Box>
            </SimpleGrid>
            <Divider my={5} />
            <SimpleGrid columns={1} spacing={4}>
              <Box p={1}>
                <FormControl isInvalid={hasSubmitted && !!appointmentErrors.selectedDates}>

                  <FormLabel>
                    Availability
                  </FormLabel>

                  <Box display="flex" justifyContent="center" width="100%">
                    <AvailabilityDates2
                      //isPending={isPending || editIsPending}
                      modeInput={true}
                      selectedDaysResp={selectedDays}
                      setSelectedDaysResp={setSelectedDays}
                      hasSubmitted={hasSubmitted}
                      trigger={trigger}
                      setValue={setValue}
                      isPending={isPending || editIsPending}
                    />
                  </Box>

                  <FormErrorMessage>{appointmentErrors.selectedDates?.message}</FormErrorMessage>
                </FormControl>
                <FormControl pt={4}>


                </FormControl>
              </Box>

            </SimpleGrid>

          </Collapse>}

        {mode === "EDITION" && reschedule && <SimpleGrid columns={1} spacing={4} my={2}>
          <Box borderWidth="1px"
            rounded="lg"
            shadow="1px 1px 3px rgba(0,0,0,0.1)" py={2} >
            <CustomCheckbox name="reschedule"
              isPending={isPending || editIsPending}

              anotherName="Re-Schedule"
              register={register}
              error={appointmentErrors.reschedule}

            />
          </Box>

        </SimpleGrid>}

        <CustomInputN
          type="hidden"
          name="id"
          register={register}
          error={appointmentErrors.id}

        />


        <FormControl pt={4}>{children}</FormControl>

        <Flex justifyContent="flex-end" mt={6}>
          <Button fontSize="xs" type="submit" colorScheme="red" isDisabled={isPending || editIsPending ? true : false} width="150px">
            {isPending || editIsPending ? <Spinner size="sm" /> : btnName}
          </Button>
        </Flex>

      </Box >

    </>
  );
}

export default CustomEntryForm;

