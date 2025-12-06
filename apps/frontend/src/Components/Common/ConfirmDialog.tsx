import React from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Text,
  Icon,
  VStack,
} from '@chakra-ui/react';
import { FiAlertTriangle } from 'react-icons/fi';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColorScheme?: string;
  isLoading?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmColorScheme = 'red',
  isLoading = false,
}) => {
  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <VStack spacing={2} align="center">
            <Icon as={FiAlertTriangle} boxSize={12} color={`${confirmColorScheme}.500`} />
            <Text>{title}</Text>
          </VStack>
        </ModalHeader>
        <ModalBody textAlign="center">
          <Text>{message}</Text>
        </ModalBody>
        <ModalFooter justifyContent="center" gap={3}>
          <Button variant="ghost" onClick={onClose} isDisabled={isLoading}>
            {cancelText}
          </Button>
          <Button
            colorScheme={confirmColorScheme}
            onClick={handleConfirm}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ConfirmDialog;
export { ConfirmDialog };
export type { ConfirmDialogProps };
