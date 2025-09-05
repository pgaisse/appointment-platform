import React, { useEffect, useMemo, useState } from 'react';
import {
  Button, useDisclosure, Modal, ModalOverlay, ModalContent, ModalHeader,
  ModalCloseButton, ModalBody, ModalFooter, FormControl, FormLabel,
  Input, FormErrorMessage, HStack, Text, useToast, Icon
} from '@chakra-ui/react';
import { AddIcon } from '@chakra-ui/icons';
import { useTopics } from '@/Hooks/useTopics';
import type { Topic } from '@/types/kanban';

type Props = {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'solid' | 'outline' | 'ghost';
  colorScheme?: string;
  onCreated?: (topic: Topic) => void; // e.g. select the newly created topic
  buttonText?: string;
};

const suggestKey = (title: string) => {
  const t = title.trim();
  if (!t) return '';
  const words = t.split(/\s+/).slice(0, 3);
  const initials = words.map(w => w[0]).join('').toUpperCase();
  return (initials || t.slice(0, 3)).toUpperCase();
};

const NewTopicButton: React.FC<Props> = ({
  size = 'sm',
  variant = 'solid',
  colorScheme = 'teal',
  onCreated,
  buttonText = 'New topic'
}) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const { createTopic, token } = useTopics();

  const [title, setTitle] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // auto-suggest a key while the user hasn't edited the key field
  useEffect(() => {
    if (!keyTouched) setKey(suggestKey(title));
  }, [title, keyTouched]);

  const isTitleInvalid = useMemo(() => title.trim().length === 0, [title]);

  const reset = () => {
    setTitle('');
    setKey('');
    setKeyTouched(false);
    setSubmitting(false);
  };

  const handleSubmit = async () => {
    if (isTitleInvalid) return;
    try {
      setSubmitting(true);
      const created = await createTopic.mutateAsync({
        title: title.trim(),
        key: key.trim() || undefined,
      });
      toast({ status: 'success', title: 'Topic created' });
      onClose();
      reset();
      onCreated?.(created);
    } catch (e: any) {
      toast({
        status: 'error',
        title: 'Could not create topic',
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
        isDisabled={!token}
      >
        {buttonText}
      </Button>

      <Modal isOpen={isOpen} onClose={() => { onClose(); reset(); }}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create a new topic</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl isInvalid={isTitleInvalid} mb={4} isRequired>
              <FormLabel>Title</FormLabel>
              <Input
                placeholder="e.g. Website revamp"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
              <FormErrorMessage>Title is required.</FormErrorMessage>
            </FormControl>

            <FormControl>
              <FormLabel>Key (optional)</FormLabel>
              <HStack>
                <Input
                  placeholder="ABC"
                  value={key}
                  onChange={(e) => { setKey(e.target.value.toUpperCase()); setKeyTouched(true); }}
                  maxLength={8}
                />
                <Text fontSize="sm" color="gray.500">Auto-suggested from title</Text>
              </HStack>
            </FormControl>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => { onClose(); reset(); }}>
              Cancel
            </Button>
            <Button
              colorScheme="teal"
              onClick={handleSubmit}
              isDisabled={isTitleInvalid}
              isLoading={submitting || createTopic.isPending}
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

export default NewTopicButton;
