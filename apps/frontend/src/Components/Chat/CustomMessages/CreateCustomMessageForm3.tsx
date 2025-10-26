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
import { useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import CustomInputN from '@/Components/Form/CustomInputN';
import { messageTemplateSchema, ScheaMessageTemplate } from '@/schemas/MessageTemplateSchema';
import { FormMode, TemplateToken } from '@/types';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MdOutlineTitle } from 'react-icons/md';
import { useGetCollection } from '@/Hooks/Query/useGetCollection';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateMessageTemplate } from '@/Hooks/Query/useCreateMessageTemplate';

type Props = {
  onClose?: () => void;
  mode?: FormMode;                // default: 'CREATION'
  defaultCategory?: 'message' | 'confirmation'; // default: 'message'
};

export default function CreateCustomMessageForm3({
  mode = 'CREATION',
  onClose,
  defaultCategory = 'message',
}: Props) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Trae TODOS los tokens disponibles (sin depender de un paciente/cita)
  const { data: tokens = [], isFetching: tokensLoading } =
    useGetCollection<TemplateToken>('TemplateToken', {
      mongoQuery: {}, // sin filtros
      projection: { key: 1, description: 1, field: 1 },
      limit: 500,
      sort: { key: 1 } as any,
    });

  const { mutate, isPending } = useCreateMessageTemplate();
  const [, setHasSubmitted] = useState(false);
  const [tokensUsed, setTokensUsed] = useState<string[]>([]);

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
      category: defaultCategory,
      title: '',
      content: '',
      variablesUsed: [],
    } as ScheaMessageTemplate,
    mode: 'onChange',
  });

  const disabled = isPending || isSubmitting;

  const sanitize = (data: ScheaMessageTemplate): ScheaMessageTemplate => ({
    ...data,
    title: DOMPurify.sanitize(data.title ?? '', { ALLOWED_TAGS: [] }),
    content: DOMPurify.sanitize(data.content ?? '', { ALLOWED_TAGS: [] }),
    category: data.category
      ? (DOMPurify.sanitize(data.category, { ALLOWED_TAGS: [] }) as any)
      : 'message',
    variablesUsed: Array.from(
      new Set((data.variablesUsed || []).map(t => DOMPurify.sanitize(t, { ALLOWED_TAGS: [] })))
    ),
  });

  const insertToken = (token: string) => {
    const current = getValues('content') || '';
    const newContent = (current.trimEnd() + ' ' + token + ' ').trimStart();

    setValue('content', newContent, { shouldValidate: true });

    if (!tokensUsed.includes(token)) {
      const next = [...tokensUsed, token];
      setTokensUsed(next);
      setValue('variablesUsed', next, { shouldValidate: false });
    }

    // Llevar el cursor al final
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
    const cleaned = sanitize(raw);

    if (mode === 'CREATION') {
      mutate(cleaned, {
        onSuccess: () => {
          toast({
            title: 'Template successfully created.',
            status: 'success',
            duration: 3000,
            isClosable: true,
          });
          reset({
            title: '',
            content: '',
            category: cleaned.category ?? 'message',
            variablesUsed: [],
          } as any);
          setTokensUsed([]);
          queryClient.invalidateQueries({ queryKey: ['MessageTemplate'] });
          onClose?.();
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
    } else {
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
        {/* Category */}
        <FormControl isInvalid={!!errors.category}>
          <FormLabel>Category</FormLabel>
          <Controller
            name="category"
            control={control}
            defaultValue={defaultCategory}
            render={({ field }) => (
              <Select {...field} isDisabled={disabled}>
                <option value="message">message</option>
                <option value="confirmation">confirmation</option>
              </Select>
            )}
          />
          {errors.category && (
            <FormErrorMessage>{(errors as any).category?.message}</FormErrorMessage>
          )}
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

        {/* Tokens (sin depender de paciente) */}
        <FormControl>
          <FormLabel>All available tokens</FormLabel>
          <HStack wrap="wrap" spacing={2}>
            {tokensLoading && <Text color="gray.500">Loading tokens…</Text>}
            {!tokensLoading && tokens.length === 0 && (
              <Text color="gray.500" fontSize="sm">No tokens available.</Text>
            )}
            {tokens.map((token) => (
              <Tooltip key={String(token._id)} label={token.description}>
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
          </HStack>
        </FormControl>

        {/* Tokens usados (solo visual) */}
        {tokensUsed.length > 0 && (
          <FormControl>
            <FormLabel>Tokens used</FormLabel>
            <HStack wrap="wrap" spacing={2}>
              {tokensUsed.map((t) => (
                <Badge key={t} colorScheme="blue">{t}</Badge>
              ))}
            </HStack>
          </FormControl>
        )}

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
