import React, { useMemo, useState } from 'react';
import {
  Button, useDisclosure, Modal, ModalOverlay, ModalContent, ModalHeader,
  ModalCloseButton, ModalBody, ModalFooter, FormControl, FormLabel,
  Input, FormErrorMessage, useToast, Icon
} from '@chakra-ui/react';
import { AddIcon } from '@chakra-ui/icons';

type Props = {
  onCreate: (title: string) => Promise<unknown> | unknown; // e.g. createColumn.mutateAsync(title)
  size?: 'sm' | 'md' | 'lg';
  variant?: 'solid' | 'outline' | 'ghost';
  colorScheme?: string;
  buttonText?: string; // default: "New Card"
};

const NewColumnButton: React.FC<Props> = ({
  onCreate,
  size = 'sm',
  variant = 'solid',
  colorScheme = 'blue',
  buttonText = 'New Card',
}) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isInvalid = useMemo(() => title.trim().length === 0, [title]);

  const reset = () => {
    setTitle('');
    setSubmitting(false);
  };

  const handleSubmit = async () => {
    if (isInvalid) return;
    try {
      setSubmitting(true);
      await onCreate(title.trim());
      toast({ status: 'success', title: 'Card created' }); // NOTE: creates a column, label says "Card" per request
      onClose();
      reset();
    } catch (e: any) {
      toast({
        status: 'error',
        title: 'Could not create',
        description: e?.message || 'Unexpected error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        size={size}
        variant={variant}
        colorScheme={colorScheme}
        leftIcon={<Icon as={AddIcon} />}
        onClick={onOpen}
      >
        {buttonText}
      </Button>

      <Modal isOpen={isOpen} onClose={() => { onClose(); reset(); }}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{buttonText}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl isInvalid={isInvalid} isRequired>
              <FormLabel>Title</FormLabel>
              <Input
                placeholder="e.g. To do"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
              <FormErrorMessage>Title is required.</FormErrorMessage>
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => { onClose(); reset(); }}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleSubmit}
              isDisabled={isInvalid}
              isLoading={submitting}
              loadingText="Creating..."
            >
              Create
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default NewColumnButton;
