// components/CreateCustomMessageForm.tsx
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Textarea,
  VStack,
  Heading,
  useToast,
  HStack,
  Tooltip,
  Divider,
  Text
} from '@chakra-ui/react';
import { useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { useInsertToCollection } from '@/Hooks/Query/useInsertToCollection';
import CustomInputN from '@/Components/Form/CustomInputN';
import { useUpdateItems } from '@/Hooks/Query/useUpdateItems';
import { messageTemplateSchema, ScheaMessageTemplate } from '@/schemas/MessageTemplateSchema';
import { FormMode, TemplateToken } from '@/types';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { MdOutlineTitle } from 'react-icons/md';
import { useGetCollection } from '@/Hooks/Query/useGetCollection';




type Props = {
  onClose?: () => void
  mode: FormMode
}


export default function CreateCustomMessageForm({ mode }: Props) {

  const navigate = useNavigate();

  const sanitize = (data: ScheaMessageTemplate): ScheaMessageTemplate => ({
    ...data,
    title: DOMPurify.sanitize(data.title, { ALLOWED_TAGS: [] }),
    content: DOMPurify.sanitize(data.content, { ALLOWED_TAGS: [] }),
    variablesUsed: (data.variablesUsed || []).map(token =>
      DOMPurify.sanitize(token, { ALLOWED_TAGS: [] })
    ),
  });

  //console.log( "datesAppSelected FORM", datesAppSelected)

  //const { mutate, isPending } = useEntryForm("Appointment");
  const { data: tokens } = useGetCollection<TemplateToken>('TemplateToken', {
    mongoQuery: {},
  });
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const { mutate, isPending } = useInsertToCollection<{ message: string; document: any }>("MessageTemplate");
  const { isPending: editIsPending } = useUpdateItems();
  const [, setHasSubmitted] = useState(false);
  const [] = useState("");
  const [tokensUsed, setTokensUsed] = useState<string[]>([]);
  const toast = useToast();

  //const { mutate: editItem, isPending: editIsPending } = useEditItem({ model: "Appointment" });



  const {
    register,
    reset,
    handleSubmit,
    control,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<ScheaMessageTemplate>({
    resolver: zodResolver(messageTemplateSchema),
    defaultValues: {}

  });
  const insertToken = (token: string) => {
    const current = getValues("content") || "";
    const newContent = (current.trimEnd() + " " + token + " ").trimStart();

    setValue("content", newContent, { shouldValidate: true });

    if (!tokensUsed.includes(token)) {
      setTokensUsed((prev) => [...prev, token]);
    }

    setTimeout(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        const len = newContent.length;
        el.setSelectionRange(len, len); // pone el cursor al final
      }
    }, 0);
  };

  const onSubmit = (data: ScheaMessageTemplate) => {

    const cleanedData = sanitize(data)
    if (mode == 'CREATION') {
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


    }

  };

  const onError = () => {
    setHasSubmitted(true); // Marcamos que intentaron enviar, pero había errores
    // Opcional: console.log(errors)
  };
  console.log("Errors:", errors)
  return (
    <>


      <Box fontSize="xs"
        borderWidth="1px"
        rounded="lg"
        shadow="1px 1px 3px rgba(0,0,0,0.3)"
        maxWidth={1000}
        p={6}
        m="10px auto"
        as="form"
        onSubmit={handleSubmit(onSubmit, onError)}
      >





        <Heading size="lg" mb={6} textAlign="center">

        </Heading>
        <VStack spacing={5} align="stretch">
          <FormControl>

            <CustomInputN
              isPending={isPending || editIsPending}
              type="text"
              name="title"

              placeholder="Title"
              register={register}
              error={errors.title}
              ico={<MdOutlineTitle color='gray.300' />}

            />
          </FormControl>

          <FormControl isInvalid={!!errors.content}>
            <FormLabel>Content for this Template</FormLabel>
            <Controller
              name="content"
              control={control}
              defaultValue=""
              render={({ field }) => (
                <Textarea
                  {...field}
                  ref={(el) => {
                    inputRef.current = el; // <- asignás tu ref para manejar foco y cursor
                    field.ref(el);         // <- también mantenés el ref de RHF
                  }}
                  resize="none"
                  placeholder="Content for this Template"
                  isDisabled={isPending || editIsPending}
                  pb={5}
                  px={5}
                />
              )}
            />
            {errors.content && (
              <Text fontSize="sm" color="red.500">
                {errors.content.message}
              </Text>
            )}
          </FormControl>

          <Divider my={2} />

          <FormControl>
            <FormLabel>All available tokens</FormLabel>
            <HStack wrap="wrap">
              {tokens && tokens.map((token: TemplateToken) => (
                <Tooltip key={token._id} label={token.description}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => insertToken(token.key)}
                  >
                    {token.key}
                  </Button>
                </Tooltip>
              ))}
            </HStack>
          </FormControl>

          {/*tokens && tokens.length > 0 && (
            <Box>
              <FormLabel>Tokens used</FormLabel>
              <HStack wrap="wrap">
                {tokens.map((token) => (
                  <Tag key={token._id} colorScheme="blue">
                    <TagLabel>{token.key}</TagLabel>
                    <TagCloseButton onClick={() => setTokensUsed(tokensUsed.filter((t) => t !== token.key))} />
                  </Tag>
                ))}
              </HStack>
            </Box>
          )*/}

          <Button
            colorScheme="blue"
            size="lg"
            type="submit" // ← clave: submit
            isLoading={isPending || editIsPending}
            mt={4}
          >
            Save
          </Button>
        </VStack>










      </Box >

    </>
  );
}
