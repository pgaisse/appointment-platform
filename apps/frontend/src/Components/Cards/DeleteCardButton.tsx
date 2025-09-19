import React from 'react';
import { IconButton, Tooltip, useDisclosure, useToast } from '@chakra-ui/react';
import { DeleteIcon } from '@chakra-ui/icons';
import ConfirmDeleteDialog from '@/Components/Common/ConfirmDeleteDialog';
import { useDeletion } from '@/Hooks/useDeletion.ts';
import { IoCloseSharp } from 'react-icons/io5';

type Props = {
  topicId?: string;         // 👈 pásalo para invalidar el tablero correcto
  cardId: string;
  cardTitle?: string;
  onDeleted?: () => void;
  size?: 'xs' | 'sm' | 'md';
  variant?: 'ghost' | 'outline' | 'solid';
};

const DeleteCardButton: React.FC<Props> = ({
  topicId,
  cardId,
  cardTitle,
  onDeleted,
  size = 'sm',
  variant = 'ghost',
}) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { deleteCard } = useDeletion(topicId);
  const toast = useToast();

  const stop = (e?: React.SyntheticEvent) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
  };

  const open = (e?: React.SyntheticEvent) => { stop(e); onOpen(); };
  const close = (e?: React.SyntheticEvent) => { stop(e); onClose(); };

  const confirm = async (e?: React.SyntheticEvent) => {
    stop(e);
    try {
      await deleteCard.mutateAsync({ cardId });
      // Ya hicimos optimistic update; aquí solo feedback
      toast({ status: 'success', title: 'Card deleted' });
      onClose();
      onDeleted?.();
    } catch (err: any) {
      const status = err?.response?.status;
      toast({
        status: 'error',
        title: 'Could not delete card',
        description:
          status === 401
            ? 'You are not authorized. Please sign in again.'
            : err?.response?.data?.error || err?.message || 'Unknown error',
      });
    }
  };

  return (
    <>
      <Tooltip label="Delete card" hasArrow>
        <IconButton
          aria-label="Delete card"
          icon={<IoCloseSharp />}
          size={size}
          variant={variant}
          colorScheme="gray.500"
          isDisabled={deleteCard.isPending}
          data-card-action="delete"
          onMouseDown={stop}
          onPointerDown={stop as any}
          onClick={open}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              stop(e);
              onOpen();
            }
          }}
        />
      </Tooltip>

      <ConfirmDeleteDialog
        isOpen={isOpen}
        onClose={close}
        onConfirm={confirm}
        title="Delete card"
        message={`Remove this card${cardTitle ? ` “${cardTitle}”` : ''}? This action cannot be undone.`}
      />
    </>
  );
};

export default DeleteCardButton;
