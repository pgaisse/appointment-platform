// components/ShowTemplateButton.tsx
import {
  IconButton,
  Tooltip,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  VStack,
  Box,
  Text,
  Spinner,
  useDisclosure,
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  Button,
} from '@chakra-ui/react';
import { CloseIcon } from '@chakra-ui/icons';
import { useMemo, useRef, useState } from 'react';
import { useGetCollection } from '@/Hooks/Query/useGetCollection';
import { Appointment, MessageTemplate, TemplateToken } from '@/types';
import { applyTemplateTokens } from '@/Functions/applyTemplateTokens';
import { useDeleteItem } from '@/Hooks/Query/useDeleteItem';
import { useQueryClient } from '@tanstack/react-query';
import { GoProjectTemplate } from "react-icons/go";
import { AiFillLayout } from 'react-icons/ai';

interface ShowTemplateButtonProps {
  onSelectTemplate: (text: string) => void;
  selectedPatient?: string;
  tooltipText?:string
  colorIcon?:string
}

export type MinimalAppointment = Pick<Appointment, 'nameInput' | 'lastNameInput' | 'phoneInput' | 'selectedAppDates'>;

export default function ShowTemplateButton({ onSelectTemplate, selectedPatient,tooltipText="Custom messages",colorIcon="gray" }: ShowTemplateButtonProps) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const btnRef = useRef(null);
  const queryClient = useQueryClient();
  const deleteDisclosure = useDisclosure();
  const [itemToDelete, setItemToDelete] = useState<string>("");
  const { data: tokens, isLoading: isLoadingTokens } = useGetCollection<TemplateToken>('TemplateToken', { mongoQuery: {} });
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [tokensWithField] = useMemo(() => {
    if (!tokens) return [{}];

    const withField: Record<string, string> = {};
    tokens.forEach((token) => {
      if (token.field) {
        withField[token.key] = token.field;
      }
    });

    return [withField];
  }, [tokens]);

  const patientProjection = useMemo(() => {
    const projection: Record<string, any> = {};

    Object.values(tokensWithField).forEach((field) => {
      const parts = field.split('+').map(f => f.trim());

      parts.forEach((part) => {
        const match = part.match(/^(\w+)\.0(\..+)?$/);
        if (match) {
          projection[match[1]] = { $slice: 1 };
        } else {
          projection[part] = 1;
        }
      });
    });

    return projection;
  }, [tokensWithField]);

  const { data: patientInfo, isLoading: isLoadingPatient } = useGetCollection<Appointment>('Appointment', {
    mongoQuery: { _id: selectedPatient },
    projection: patientProjection,
  });

  const { data: templates, isLoading: isLoadingTemplates } = useGetCollection<MessageTemplate>('MessageTemplate', {
    mongoQuery: {},
    projection: { title: 1, content: 1 },
  });

  const handleSelectTemplate = (template: MessageTemplate) => {
    if (!patientInfo || patientInfo.length === 0) return;
    const filledMessage = applyTemplateTokens(template.content, patientInfo[0], tokens ?? []);
    onSelectTemplate(filledMessage);
    onClose();
  };
  const confirmDelete = (id: string) => {
    console.log("ESTE ES EL ID:", id)
    setItemToDelete(id);
    deleteDisclosure.onOpen();
  };

  const { deleteById } = useDeleteItem({
    modelName: "MessageTemplate", // o "treatments", "prioritylist", etc.
  });

  const handleDelete = () => {
    if (deleteById && itemToDelete)
      deleteById(itemToDelete);

    queryClient.invalidateQueries({ queryKey: ["MessageTemplate"] });
    deleteDisclosure.onClose();
  };

  return (
    <>
      <Tooltip label={tooltipText} hasArrow>
        <IconButton
          ref={btnRef}
          aria-label="Show custom messages"
          icon={<AiFillLayout  color={colorIcon} size={20} />}
          onClick={onOpen}
          variant="ghost"
          size="sm"
        />
      </Tooltip>

      <Drawer isOpen={isOpen} placement="right" onClose={onClose} finalFocusRef={btnRef}>
        <DrawerOverlay />
        <DrawerContent maxW="360px">
          <DrawerHeader borderBottomWidth="1px">Personalized Messages</DrawerHeader>
          <DrawerBody>
            {isLoadingTemplates || isLoadingPatient || isLoadingTokens ? (
              <Spinner mt={4} />
            ) : (
              <VStack spacing={4} align="stretch">
                {templates?.map((template) => (
                  <Box
                    cursor={"pointer"}
                    key={template._id}
                    position="relative"
                    p={3}
                    borderWidth="1px"
                    borderRadius="md"
                    _hover={{ bg: 'gray.50' }}
                    onClick={() => handleSelectTemplate(template)}
                  >

                    <IconButton
                      icon={<CloseIcon />}
                      size="sm"
                      aria-label="Close"
                      position="absolute"
                      top={2}
                      right={2}
                      variant="ghost"
                      colorScheme="red"
                      onClick={(e) => {
                        e.stopPropagation(); // 👈 Esto evita que dispare el onClick del Box
                        confirmDelete(template._id)
                      }} />
                    <Text fontWeight="semibold">{template.title}</Text>
                    <Text fontSize="sm" color="gray.600" noOfLines={2}>
                      {template.content}
                    </Text>
                  </Box>
                ))}
              </VStack>
            )}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
      <AlertDialog isOpen={deleteDisclosure.isOpen} leastDestructiveRef={cancelRef} onClose={deleteDisclosure.onClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">Confirm Deletion</AlertDialogHeader>
            <AlertDialogBody>Are you sure? This action cannot be undone.</AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={deleteDisclosure.onClose}>Cancel</Button>
              <Button colorScheme="red" onClick={handleDelete} ml={3}>Delete</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
}
