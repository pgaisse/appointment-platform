import { Spinner, Image, ModalBody, ModalContent, Modal, ModalOverlay, Box, IconButton, useDisclosure, ModalCloseButton } from "@chakra-ui/react";
import { useState } from "react";
import { FiZoomIn } from "react-icons/fi";

export const ImageFromDrive = ({ fileId }: { fileId: string }) => {
  if (!fileId) return null;

  // ✅ Usa el dominio correcto para mostrar imagen pública de Drive
  const [, setImgError] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  // También puedes agregar loading si necesitas lógica async más adelante
   return (
    <>
      <Box
        position="relative"
        cursor="pointer"
        maxW="200px"
        overflow="hidden"
        _hover={{ transform: "scale(1.02)", transition: "0.3s ease-in-out" }}
        onClick={onOpen}
      >
        <Image
          src={fileId}
          alt="Imagen multimedia"
          fallback={<Spinner size="sm" />}
          objectFit="cover"
          width="100%"
          height="auto"
          borderRadius="md"
          onError={() => setImgError(true)}
        />
        <IconButton
          icon={<FiZoomIn />}
          aria-label="Zoom"
          position="absolute"
          top="2"
          right="2"
          size="sm"
          colorScheme="blackAlpha"
          variant="ghost"
          pointerEvents="none"
        />
      </Box>

      <Modal isOpen={isOpen} onClose={onClose} size="4xl" isCentered motionPreset="scale">
        <ModalOverlay bg="transparent" backdropFilter="blur(16px)" />
        <ModalContent
          bg="transparent"
          boxShadow="none"
          borderRadius="xl"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <ModalCloseButton
            color="black"
            top="4"
            right="4"
            zIndex="10"
            _hover={{ bg: "whiteAlpha.200" }}
          />
          <ModalBody p={0}>
            <Image
              src={fileId}
              alt="Imagen ampliada"
              maxH="80vh"
              maxW="90vw"
              objectFit="contain"
              borderRadius="xl"
              boxShadow="2xl"
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
};
