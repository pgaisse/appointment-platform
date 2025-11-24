import { useEffect, useState } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  Spinner,
  Text,
  useDisclosure,
} from "@chakra-ui/react";

const LogOutRedirect = () => {
  const { isOpen, onOpen } = useDisclosure();
  const [hasStartedLogout, setHasStartedLogout] = useState(false);

  useEffect(() => {
    onOpen(); // open the modal
    setHasStartedLogout(true);

    // Limpiar todo el storage local
    localStorage.clear();
    sessionStorage.clear();

    const timer = setTimeout(() => {
      // Redirigir directamente a nuestro login sin pasar por Auth0
      window.location.href = '/login';
    }, 2000); // wait 2 seconds before redirecting

    return () => clearTimeout(timer);
  }, [onOpen]);

  if (!hasStartedLogout) return null;

  return (
    <Modal isOpen={isOpen} onClose={() => {}} isCentered closeOnOverlayClick={false}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Signing out</ModalHeader>
        <ModalBody textAlign="center" pb={6}>
          <Spinner size="xl" mb={4} />
          <Text>Please wait while we sign you out...</Text>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default LogOutRedirect;
