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
  Text,
  Select,
  FormErrorMessage,
  Badge,
  Flex,
} from '@chakra-ui/react';
import { useRef, useState, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { useInsertToCollection } from '@/Hooks/Query/useInsertToCollection';
import CustomInputN from '@/Components/Form/CustomInputN';
import { useUpdateItems } from '@/Hooks/Query/useUpdateItems';
import { messageTemplateSchema, ScheaMessageTemplate } from '@/schemas/MessageTemplateSchema';
import { Appointment, FormMode, TemplateToken } from '@/types';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MdOutlineTitle } from 'react-icons/md';
import { useGetCollection } from '@/Hooks/Query/useGetCollection';
import { compactObject } from '@/Helpers/compactObject';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateMessageTemplate } from '@/Hooks/Query/useCreateMessageTemplate';

type Props = {
  onClose?: () => void;
  mode: FormMode;
  patientId: string;
};

// Extiende el formulario para incluir category sin romper el schema actual

export default function CreateCustomMessageForm({ mode, onClose, patientId }: Props) {
  const sanitize = (data: ScheaMessageTemplate): ScheaMessageTemplate => ({
    ...data,
    title: DOMPurify.sanitize(data.title ?? '', { ALLOWED_TAGS: [] }),
    content: DOMPurify.sanitize(data.content ?? '', { ALLOWED_TAGS: [] }),
    category: data.category
      ? (DOMPurify.sanitize(data.category, { ALLOWED_TAGS: [] }) as any)
      : 'message',
    variablesUsed: (data.variablesUsed || []).map(token =>
      DOMPurify.sanitize(token, { ALLOWED_TAGS: [] })
    ),
  });

  // --- Patient fields -> tokens por "field" presentes (igual que antes)
  const project = { firstName: 1, lastName: 1, phone: 1, selectedAppDates: 1, nameInput: 1, lastNameInput: 1, org_name: 1 };
  const { data: fields } = useGetCollection<Appointment>('Appointment', {
    mongoQuery: { _id: patientId },
    projection: project,
  });
  const doc = fields?.[0];
  const presentKeys = doc ? Object.keys(compactObject(doc)) : [];
  const presentKeysNoId = presentKeys.filter(k => k !== '_id');
  const inList = useMemo<(string | null)[]>(() => [...new Set([...presentKeysNoId, null])], [presentKeysNoId]);

  // --- Trae tokens SOLO por "field" presentes (sin categoría)
  const { data: tokens } = useGetCollection<TemplateToken>('TemplateToken', {
    mongoQuery: { field: { $in: inList } },
  });

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const { mutate, isPending } = useCreateMessageTemplate();
  const { isPending: editIsPending } = useUpdateItems();
  const [, setHasSubmitted] = useState(false);
  const [tokensUsed, setTokensUsed] = useState<string[]>([]);
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    reset,
    handleSubmit,
    control,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ScheaMessageTemplate>({
    resolver: zodResolver(messageTemplateSchema as any),
    defaultValues: {
      category: 'message',
      title: '',
      content: '',
    } as ScheaMessageTemplate,
    mode: 'onChange',
  });

  const disabled = isPending || editIsPending || isSubmitting;

  const insertToken = (token: string) => {
    const current = getValues('content') || '';
    const newContent = (current.trimEnd() + ' ' + token + ' ').trimStart();
    setValue('content', newContent, { shouldValidate: true });

    if (!tokensUsed.includes(token)) {
      setTokensUsed(prev => [...prev, token]);
      setValue('variablesUsed', [...(getValues('variablesUsed') ?? []), token], { shouldValidate: false });
    }

    setTimeout(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        const len = newContent.length;
        el.setSelectionRange(len, len);
      }
    }, 0);
  };

  const onSubmit = (raw: ScheaMessageTemplate) => {
    const cleanedData = sanitize(raw);
    if (mode === 'CREATION') {
      mutate(cleanedData, {
        onSuccess: () => {
          toast({
            title: 'Template successfully created.',
            status: 'success',
            duration: 3000,
            isClosable: true,
          });
          reset({ title: '', content: '', category: cleanedData.category ?? 'message', variablesUsed: [] } as any);
          queryClient.invalidateQueries({ queryKey: ["MessageTemplate"] }),
            setTokensUsed([]);
          if (onClose) onClose();
        },
        onError: (error: any) => {
          toast({
            title: 'Error submitting the form.',
            description: error?.response?.data?.message || 'An unexpected error occurred.',
            status: 'error',
            duration: 4000,
            isClosable: true,
          });
        },
      });
    } else if (mode === 'EDITION') {
      // Mantengo tu lógica (no implementada aquí)
      toast({
        title: 'Edit mode not implemented here.',
        status: 'info',
        duration: 2500,
      });
    }
  };

  const onError = () => setHasSubmitted(true);

  const contentValue = getValues('content') ?? '';
  const contentLen = contentValue.length;

  return (
    <Box
      fontSize="xs"
      borderWidth="1px"
      rounded="lg"
      shadow="1px 1px 3px rgba(0,0,0,0.3)"
      maxWidth={1000}
      p={6}
      m="10px auto"
      as="form"
      onSubmit={handleSubmit(onSubmit, onError)}
    >
      <Heading size="md" mb={6} textAlign="center">
        New Message Template
      </Heading>

      <VStack spacing={5} align="stretch">
        {/* Category: nuevo campo en el template */}
        <FormControl isInvalid={!!errors.category}>
          <FormLabel>Category</FormLabel>
          <Controller
            name="category"
            control={control}
            defaultValue="message"
            render={({ field }) => (
              <Select {...field} isDisabled={disabled}>
                <option value="message">message</option>
                <option value="confirmation">confirmation</option>
              </Select>
            )}
          />
          {errors.category && <FormErrorMessage>{(errors as any).category?.message}</FormErrorMessage>}
        </FormControl>

        {/* Title */}
        <FormControl isInvalid={!!errors.title}>
          <CustomInputN
            isPending={disabled}
            type="text"
            name="title"
            placeholder="Title"
            register={register}
            error={errors.title}
            ico={<MdOutlineTitle color="gray.300" />}
          />
          {errors.title && <FormErrorMessage>{errors.title.message}</FormErrorMessage>}
        </FormControl>

        {/* Content */}
        <FormControl isInvalid={!!errors.content}>
          <Flex justify="space-between" align="center">
            <FormLabel m={0}>Content for this Template</FormLabel>
            <Badge>{contentLen} chars</Badge>
          </Flex>
          <Controller
            name="content"
            control={control}
            defaultValue=""
            render={({ field }) => (
              <Textarea
                {...field}
                ref={(el) => {
                  inputRef.current = el;
                  field.ref(el);
                }}
                resize="none"
                placeholder="Content for this Template"
                isDisabled={disabled}
                minH="140px"
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

        {/* Tokens: EXACTO como los tenías (sin categoría) */}
        <FormControl>
          <FormLabel>All available tokens</FormLabel>
          <HStack wrap="wrap">
            {tokens && tokens.map((token: TemplateToken) => (
              <Tooltip key={token._id} label={token.description}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => insertToken(token.key)}
                  isDisabled={disabled}
                >
                  {token.key}
                </Button>
              </Tooltip>
            ))}
            {!tokens?.length && (
              <Text color="gray.500" fontSize="sm">No tokens available.</Text>
            )}
          </HStack>
        </FormControl>

        {/* Visual de tokens usados (opcional, no persiste extra) */}
        

        <Button
          colorScheme="blue"
          size="lg"
          type="submit"
          isLoading={disabled}
          mt={2}
        >
          Save
        </Button>
      </VStack>
    </Box>
  );
}
