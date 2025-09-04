// Hooks/useInfoModal.tsx
import {
  Modal, ModalOverlay, ModalContent, ModalHeader,
  ModalBody, ModalFooter, Button, useDisclosure
} from "@chakra-ui/react";
import { JSX, useState } from "react";

export function useInfoModal(header = "Details") {
  const disclosure = useDisclosure();
  const [content, setContent] = useState<JSX.Element | null>(null);

  const openInfo = (c: JSX.Element) => {
    setContent(c);
    disclosure.onOpen();
  };

  const InfoModal = () => (
    <Modal isOpen={disclosure.isOpen} onClose={disclosure.onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{header}</ModalHeader>
        <ModalBody>{content}</ModalBody>
        <ModalFooter>
          <Button onClick={disclosure.onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );

  return { openInfo, InfoModal, isOpen: disclosure.isOpen, onClose: disclosure.onClose };
}
