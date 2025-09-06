// frontend/src/Components/Topics/DeleteTopicButton.tsx
import React from 'react';
import { IconButton, Tooltip, useDisclosure, useToast } from '@chakra-ui/react';
import { DeleteIcon } from '@chakra-ui/icons';
import ConfirmDeleteDialog from '@/Components/Common/ConfirmDeleteDialog';
import { useDeletion } from '@/Hooks/useDeletion.ts';

type Props = {
  topicId: string;
  topicTitle?: string;
  onDeleted?: () => void;
  size?: 'xs' | 'sm' | 'md';
};

const DeleteTopicButton: React.FC<Props> = ({ topicId, topicTitle, onDeleted, size = 'sm' }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { deleteTopic } = useDeletion(topicId);
  const toast = useToast();

  const open = (e?: React.SyntheticEvent) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    onOpen();
  };

  const close = (e?: React.SyntheticEvent) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    onClose();
  };

  const confirm = async (e?: React.SyntheticEvent) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    try {
      // 👇 FIX: pasar objeto, no string
      await deleteTopic.mutateAsync({ topicId });
      toast({ status: 'success', title: 'Topic deleted' });
      onClose();
      onDeleted?.();
    } catch (err: any) {
      toast({
        status: 'error',
        title: 'Could not delete topic',
        description: err?.response?.data?.error || err.message,
      });
    }
  };

  return (
    <>
      <Tooltip label="Delete topic" hasArrow>
        <IconButton
          aria-label="Delete topic"
          icon={<DeleteIcon />}
          size={size}
          variant="ghost"
          colorScheme="red"
          data-card-action="delete"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={open}
        />
      </Tooltip>

      <ConfirmDeleteDialog
        isOpen={isOpen}
        onClose={close}
        onConfirm={confirm}
        title="Delete topic"
        message={`Remove topic${topicTitle ? ` “${topicTitle}”` : ''}? This will also delete its columns and cards.`}
      />
    </>
  );
};

export default DeleteTopicButton;
