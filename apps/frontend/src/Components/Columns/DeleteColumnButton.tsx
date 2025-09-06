import React from 'react';
import { IconButton, Tooltip, useDisclosure, useToast } from '@chakra-ui/react';
import { DeleteIcon } from '@chakra-ui/icons';
import ConfirmDeleteDialog from '@/Components/Common/ConfirmDeleteDialog';
import { useDeletion } from '@/Hooks/useDeletion.ts';
type Props = {
  columnId: string;
  columnTitle?: string;
  onDeleted?: () => void;
};

const DeleteColumnButton: React.FC<Props> = ({ columnId, columnTitle, onDeleted }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { deleteColumn } = useDeletion();
  const toast = useToast();

  const handleConfirm = async () => {
    try {
      await deleteColumn.mutateAsync({ columnId });
      toast({ status: 'success', title: 'Column deleted' });
      onClose();
      onDeleted?.();
    } catch (e: any) {
      toast({ status: 'error', title: 'Could not delete column', description: e?.message });
    }
  };

  return (
    <>
      <Tooltip label="Delete column" hasArrow>
        <IconButton
          aria-label="Delete column"
          icon={<DeleteIcon />}
          size="xs"
          variant="ghost"
          colorScheme="red"
          onClick={onOpen}
        />
      </Tooltip>

      <ConfirmDeleteDialog
        isOpen={isOpen}
        onClose={onClose}
        onConfirm={handleConfirm}
        isLoading={deleteColumn.isPending}
        title="Delete column"
        message={`Remove column${columnTitle ? ` “${columnTitle}”` : ''}? Cards will be deleted as well.`}
      />
    </>
  );
};

export default DeleteColumnButton;
