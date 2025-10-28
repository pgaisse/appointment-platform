// components/CreateMessageModal.tsx
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Button,
  useDisclosure
} from "@chakra-ui/react";
import { ReactNode } from "react";
import CreateCustomMessageForm2 from "./CreateCustomMessageForm2";

export default function CreateMessageModal({
  patientId,
  triggerButton,
}: {
  patientId?: string;
  triggerButton: ReactNode;
}) {
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <>
      <span onClick={onOpen}>{triggerButton}</span>

      <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered motionPreset="slideInBottom">
        <ModalOverlay />
        <ModalContent borderRadius="xl" p={2}>
          <ModalHeader textAlign="center">New Template</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <CreateCustomMessageForm2 onClose={onClose} mode="CREATION" patientId={patientId || ""} />
          </ModalBody>
          <ModalFooter>
            <Button onClick={onClose} variant="ghost">
              Cancelar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
