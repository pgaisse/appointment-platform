import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalCloseButton,
    ModalBody,
    ModalFooter,
    Button,
    VStack,
    Input,
    useToast,
    FormControl,
    FormLabel,
    Flex,
    Spinner,
    Box,
} from "@chakra-ui/react";
import { Controller, FieldErrors, useForm } from "react-hook-form";
import CustomInputN from "../Form/CustomInputN";
import { ManualContactFormValues, manualContactSchema } from "@/schemas/ContactsSchema";
import { zodResolver } from "@hookform/resolvers/zod";
import he from "he";
import { useInsertToCollection } from "@/Hooks/Query/useInsertToCollection";
import { LuUserPen } from "react-icons/lu";
import PhoneInput from "../Form/PhoneInput";
import { FiPhone } from "react-icons/fi";
import DOMPurify from 'dompurify';
import { useQueryClient } from "@tanstack/react-query";
import { useValidatedManualContactSchema } from "@/Hooks/Handles/ hooks/useValidatedManualContactSchema";
type ManualContactFormModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onOpen: () => void;
    nameVal?: string;
    lastNameVal?: string;
    phoneVal?: string;
    mode: "CREATION" | "EDITION"
};

export const ManualContactFormModal: React.FC<ManualContactFormModalProps> = ({
    nameVal,
    lastNameVal,
    isOpen,
    phoneVal,
    onOpen,
    onClose,
    mode
}) => {
    const validatedSchema = useValidatedManualContactSchema(); // 🔥 validación con superRefine

    const queryClient = useQueryClient();
    const { mutate, isPending } = mode == "CREATION"
        ? useInsertToCollection<{ message: string; document: any }>("ManualContact")
        : useInsertToCollection<{ message: string; document: any }>("ManualContact");

    const toast = useToast();
    const {
        register,
        reset,
        handleSubmit,
        control,
        setValue,
        trigger,
        formState: { errors },
    } = useForm<ManualContactFormValues>({
        resolver: zodResolver(validatedSchema),
        defaultValues: {
            nameInput: he.decode(nameVal || ""),
            lastNameInput: he.decode(lastNameVal || ""),
            phoneInput: he.decode(phoneVal || ""),
        },
    });
    interface SanitizeOutput extends ManualContactFormValues { }
    const sanitize = (data: ManualContactFormValues): SanitizeOutput => ({
        ...data,
        nameInput: DOMPurify.sanitize(data.nameInput, { ALLOWED_TAGS: [] }),
        lastNameInput: DOMPurify.sanitize(data.lastNameInput, { ALLOWED_TAGS: [] }),
        phoneInput: DOMPurify.sanitize(data.phoneInput, { ALLOWED_TAGS: [] }),

    });


    const onSubmit = (data: ManualContactFormValues) => {
        console.log("EStomos en onsubmit")
        const cleanedData = sanitize(data)
        if (mode == "CREATION") {
            mutate(cleanedData, {
                onSuccess: () => {
                    toast({
                        title: "Contact Submitted.",
                        description: "Your new contact has been submitted successfully",
                        status: "success",
                        duration: 3000,
                        isClosable: true,
                    });
                    reset();
                    //resetear consultas
                    queryClient.invalidateQueries({ queryKey: ["Appointment"] });
                    queryClient.invalidateQueries({ queryKey: ["ManualContact"] });

                    onClose()
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
        }

    }

    const editIsPending = false
    console.log("errors:", errors)

    return (

        <Modal isOpen={isOpen} onClose={onClose} isCentered size="md">
            <ModalOverlay />
            <ModalContent borderRadius="xl" p={2}
                as="form"
                onSubmit={handleSubmit(onSubmit)}>

                <ModalHeader fontWeight="bold">Add new contact</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                    <VStack spacing={4}>
                        <CustomInputN
                            isPending={isPending || editIsPending}
                            type="text"
                            name="nameInput"
                            placeholder="Name"
                            register={register}
                            error={errors.nameInput}
                            ico={<LuUserPen color='gray.300' />}

                        />
                        <CustomInputN
                            isPending={isPending || editIsPending}
                            type="text"
                            name="lastNameInput"
                            placeholder="Last Name"
                            register={register}
                            error={errors.lastNameInput}
                            ico={<LuUserPen color='gray.300' />}
                        />



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
                                    error={errors.phoneInput}
                                    ico={<FiPhone color='gray.300' />}
                                    placeholder="0411 710 260"
                                    anotherName="Phone Number"
                                />
                            )}
                        />

                    </VStack>
                </ModalBody>

                <ModalFooter>
                    <Button variant="ghost" mr={3} onClick={onClose}>
                        Cancel
                    </Button>
                    <Button fontSize="xs" type="submit" colorScheme="red" isDisabled={isPending || editIsPending ? true : false} width="150px">
                        {isPending || editIsPending ? <Spinner size="sm" /> : "Save Contact"}
                    </Button>
                </ModalFooter>

            </ModalContent>
        </Modal>

    );
};
