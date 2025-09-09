import React, { useRef } from 'react';
import {
  AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter,
  AlertDialogHeader, AlertDialogOverlay, Button, Text,
} from '@chakra-ui/react';

type Props = {
  isOpen: boolean;
  title?: string;
  message?: string;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
};

const ConfirmDeleteDialog: React.FC<Props> = ({
  isOpen,
  title = 'Delete item',
  message = 'This action cannot be undone.',
  isLoading,
  onClose,
  onConfirm,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <AlertDialog
      isOpen={isOpen}
      onClose={isLoading ? () => {} : onClose}
      leastDestructiveRef={cancelRef}
      isCentered
      motionPreset="scale"
    >
      <AlertDialogOverlay />
      <AlertDialogContent bg="gray.800" borderColor="whiteAlpha.200" borderWidth="1px">
        <AlertDialogHeader fontWeight="bold" color={"whiteAlpha.800"}>{title}</AlertDialogHeader>
        <AlertDialogBody>
          <Text color={"whiteAlpha.800"}>{message}</Text>
        </AlertDialogBody>
        <AlertDialogFooter>
          <Button ref={cancelRef} onClick={onClose} variant="ghost" color="whiteAlpha.400" mr={3} isDisabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button colorScheme="red" onClick={onConfirm} isLoading={isLoading}>
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ConfirmDeleteDialog;
