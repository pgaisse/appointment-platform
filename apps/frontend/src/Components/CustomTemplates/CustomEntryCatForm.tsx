import { useEditItem } from "@/Hooks/Query/useEditItem";
import useEntryForm from "@/Hooks/Query/useEntryForm";
import { CategoriesSchema, CategoriesSchemaFormData } from "@/schemas/CategoriesSchema";
import {
    Box,
    Button,
    Flex,
    Grid,
    GridItem,
    NumberInputField,
    Popover,
    PopoverBody,
    PopoverContent,
    PopoverTrigger,
    Spinner,
    useDisclosure,
    useToast
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { QueryObserverResult, RefetchOptions } from "@tanstack/react-query";
import DOMPurify from 'dompurify';
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { IoIosColorPalette } from "react-icons/io";
import { LuTimer } from "react-icons/lu";
import { TbCategory2 } from "react-icons/tb";
import CustomInputN from "../Form/CustomInputN";
import CustomNumberInput from "../Form/CustomNumberInput";
import CustomTextArea from "../Form/CustomTextArea";
import { useModalClose } from "../Modal/CustomModal";

const colorAssigned = [
    '#0078D4', '#CA5010', '#107C10', '#D13438', '#5C2D91',
    '#038387', '#986F0B', '#00B7C3', '#C239B3', '#7A7574',
    '#F1C40F', '#2ECC71', '#E74C3C', '#3498DB', '#9B59B6',
    '#1ABC9C', '#E67E22', '#34495E', '#16A085', '#D5DBDB'
];

const getTextColor = (bgColor: string) => {
    const color = bgColor.substring(1);
    const r = parseInt(color.substr(0, 2), 16);
    const g = parseInt(color.substr(2, 2), 16);
    const b = parseInt(color.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#000' : '#fff';
};

type UpdateData = {
    preName?: string,
    preDescription?: string,
    preNotes?: string,
    preDurationHours?: number,
    preColor?: string,
    preId?: string,
    pre_Id?: string,
    refetch?: ((options?: RefetchOptions) => Promise<QueryObserverResult<unknown, Error>>) | undefined

}

type Props = UpdateData & {
    mode: string;
    toastInfo: { description: string, title: string }
    refetch_list?: ((options?: RefetchOptions) => Promise<QueryObserverResult<unknown, Error>>) | undefined
    refetchCategories?: (options?: RefetchOptions) => Promise<QueryObserverResult<unknown, Error>>
}

const CustomEntryCatForm = ({
    refetch,
    refetchCategories,
    mode = "CREATION",
    toastInfo = { description: "", title: "" },
    refetch_list,
    preName,
    preDescription,
    preNotes,
    preDurationHours,
    preColor,
    preId,
    pre_Id,

}: Props) => {
    const [priority, setPriority] = useState({
        name: "",
        description: "",
        notes: "",
        durationHours: 1,
        color: colorAssigned[0],
    });
    const onClose_ = useModalClose();
    const toast = useToast();
    const { isOpen, onOpen, onClose } = useDisclosure();
    const {
        register,
        reset,
        handleSubmit,
        control,
        formState: { errors },
    } = useForm<CategoriesSchemaFormData>({
        resolver: zodResolver(CategoriesSchema),
        defaultValues: {

            name: preName || "",
            description: preDescription || "",
            notes: preNotes || "",
            durationHours: Number(preDurationHours),
            color: preColor || "",
            id: preId?.toString() || "",
        },
    });


    const { mutate, isPending } = useEntryForm("Categories");
    const { mutate: editItem } = useEditItem({ model: "Categories" });

    const sanitize = (data: CategoriesSchemaFormData) => ({
        ...data,
        color: data.color,
        description: DOMPurify.sanitize(data.description ? data.description : "", { ALLOWED_TAGS: [] }),
        durationHours: DOMPurify.sanitize(data.durationHours.toString()),
        name: DOMPurify.sanitize(data.name, { ALLOWED_TAGS: [] }),
        notes: DOMPurify.sanitize(data.notes ? data.notes : "", { ALLOWED_TAGS: [] }),

    });
    //const cleanedData = sanitize(data)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleNumberChange = (valueAsString: string, valueAsNumber: number) => {
        console.log(valueAsString)
        if (!isNaN(valueAsNumber)) {
            setPriority({ ...priority, durationHours: valueAsNumber });
        }
    };

    const onSubmit = (data: CategoriesSchemaFormData) => {
        const cleanedData = sanitize(data)
        if (mode == "CREATION") {



            // If selectedDates is present, it's a new entry, so use the mutate function
            mutate(cleanedData, {
                onSuccess: () => {
                    toast({
                        title: "Form submitted.",
                        description: "Your information was sent successfully.",
                        status: "success",
                        duration: 3000,
                        isClosable: true,
                    });
                    if (refetchCategories) refetchCategories();
                    reset();
                    ;

                },
            });
        }
        else if (mode == "EDITION") {
            const { description: toastDesc, title: toastTitle } = toastInfo;
            console.log("cleanedData", cleanedData)
            // If no selectedDates, it's an edit, so use editItem
            editItem({ id: pre_Id ? pre_Id : "", data: cleanedData },
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
                        if (refetch) refetch();
                        if (onClose_) onClose_()
                    },
                });


        }

    };

    //console.log("ERRORS", errors)

    return (

        <>
            <Box
                fontSize="xs"
                width="100%"
                mx="auto"
                mt={8}
                p={10}
                borderWidth="1px"
                rounded="lg"
                shadow="1px 1px 3px rgba(0,0,0,0.1)"
                as="form"

                onSubmit={handleSubmit(onSubmit)}
            >


                {/* Fila 1: 3 columnas */}
                <Box width={"full"}>
                    <Grid
                        templateAreas={{
                            base: ` "row1"
                                    "row2"`,
                        }}
                        templateColumns={{
                            base: '1fr',
                            "2xl": 'repeat(1, 1fr)'
                        }}
                        gap={4}
                        mb={4}
                    >
                        <GridItem area={"row1"}>
                            <Flex
                                direction={{ base: "column", md: "row" }}
                                align={{ base: "flex-start", md: "center" }}
                                alignContent={"center"}
                                justify={{ base: "flex-start", md: "space-between" }}
                                height="100%"
                                gap={2}
                                py={2}
                            >

                                <CustomInputN
                                    anotherName="Name"
                                    name={"name"}
                                    placeholder="Name Priority"
                                    register={register}
                                    error={errors.name}
                                    ico={<TbCategory2 />}
                                />


                                <CustomNumberInput
                                    min={0.25}
                                    max={10}
                                    step={0.5}
                                    onChange={handleNumberChange}
                                    name="durationHours"
                                    anotherName="Duration (hours)"
                                    register={register}
                                    _placeholder="Duration (hours)"
                                    error={errors.durationHours}
                                    ico={<LuTimer />}
                                >
                                    <NumberInputField />
                                </CustomNumberInput>


                                <Controller
                                    name="color"
                                    control={control}
                                    rules={{ required: "Color es obligatorio" }}
                                    render={({ field }) => (
                                        <Popover isOpen={isOpen} onOpen={onOpen} onClose={onClose} placement="bottom-start">
                                            <PopoverTrigger>
                                                <CustomInputN
                                                    name={field.name}
                                                    value={field.value || ""}
                                                    onChange={field.onChange}
                                                    error={errors.color}
                                                    anotherName="Color"
                                                    placeholder="Set color"
                                                    ico={<IoIosColorPalette />}
                                                    bg={field.value}
                                                    color={getTextColor(field.value || "#FFFFFF")}
                                                    cursor="pointer"
                                                    onClick={onOpen}
                                                />
                                            </PopoverTrigger>
                                            <PopoverContent w="auto">
                                                <PopoverBody>
                                                    <Flex wrap="wrap" gap={2} maxW="250px">
                                                        {colorAssigned.map((color, idx) => (
                                                            <Box
                                                                key={`${idx}-colores`}
                                                                w="24px"
                                                                h="24px"
                                                                borderRadius="full"
                                                                bg={color}
                                                                cursor="pointer"
                                                                border={field.value === color ? "3px solid black" : "2px solid white"}
                                                                onClick={() => {
                                                                    field.onChange(color);
                                                                    onClose();
                                                                }}
                                                            />
                                                        ))}
                                                    </Flex>
                                                </PopoverBody>
                                            </PopoverContent>
                                        </Popover>
                                    )}
                                />
                            </Flex>
                        </GridItem>
                        <GridItem area={"row2"} colSpan={2}>
                            <CustomTextArea
                                anotherName="Description"
                                name={"description"}
                                placeholder="Description of the consult"
                                register={register}
                                error={errors.description}
                            />



                            <CustomTextArea
                                anotherName="Notes"
                                placeholder="Notes"
                                name={"notes"}
                                register={register}
                                error={errors.notes}
                            />

                        </GridItem>
                    </Grid>

                </Box>
                <CustomInputN
                    type="hidden"
                    name={"id"}
                    register={register}
                    error={errors.id}

                />

                {/* Fila 3: botón */}
                <Flex justifyContent="flex-end" px={5}>
                    <Button
                        colorScheme="teal"
                        type="submit"
                        isDisabled={isPending}
                        width="150px"
                    >
                        {isPending ? <Spinner size="sm" /> : "Submit"}
                    </Button>
                </Flex>
            </Box>
        </>





    );



}
export default CustomEntryCatForm;
