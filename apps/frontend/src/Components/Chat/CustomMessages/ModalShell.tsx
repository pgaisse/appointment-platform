import { ReactNode } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from '@chakra-ui/react';

type Props = {
  trigger: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: string;
  isCentered?: boolean;
};

export default function ModalShell({ trigger, title, children, footer, size = 'xl', isCentered = true }: Props) {
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <>
      <span onClick={onOpen}>{trigger}</span>
      <Modal isOpen={isOpen} onClose={onClose} size={size as any} isCentered={isCentered}>
        <ModalOverlay />
        <ModalContent borderRadius="xl" p={2} maxW="980px">
          <ModalHeader textAlign="center">{title}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>{children}</ModalBody>
          {footer !== undefined ? <ModalFooter>{footer}</ModalFooter> : null}
        </ModalContent>
      </Modal>
    </>
  );
}
