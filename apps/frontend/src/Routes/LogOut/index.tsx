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
import { useAuth0 } from "@auth0/auth0-react";

const LogOutRedirect = () => {
  const { logout } = useAuth0();
  const { isOpen, onOpen } = useDisclosure();
  const [hasStartedLogout, setHasStartedLogout] = useState(false);

  useEffect(() => {
    onOpen(); // open the modal
    setHasStartedLogout(true);

    const timer = setTimeout(() => {
      logout({ logoutParams: { returnTo: window.location.origin } });
    }, 2000); // wait 2 seconds before logging out

    return () => clearTimeout(timer);
  }, [logout, onOpen]);

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
