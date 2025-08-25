import {
  Box, IconButton, Tooltip, useColorModeValue, useToast,
  CircularProgress, CircularProgressLabel, Image, Badge, Button,
  Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader,
  DrawerOverlay, Grid, GridItem, HStack, Progress, Text,
  useDisclosure, VStack,
} from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { HiOutlineCloudArrowUp } from "react-icons/hi2";
import { CloseIcon } from "@chakra-ui/icons";

// ---------------- Motion (sin deprecations) ----------------
const MotionBox = motion.create(Box);
const MotionImage = motion.create(Image);

// ---------------- Utils puros (sin hooks) ----------------
const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"] as const;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};
const isImageFile = (file: File) => file.type.startsWith("image/");

// ---------------- Tipos ----------------
type PreviewItem = { id: string; url: string; file: File; };

type Props = {
  /** Te entrega los archivos seleccionados cuando el usuario confirma “Enviar” */
  onFilesReady: (files: File[]) => void;
  /** Deshabilita UI mientras `CustomChat` está enviando (opcional) */
  isSending?: boolean;
  /** Regla XOR: si hay texto en el input del chat, bloquea seleccionar media (opcional) */
  hasText?: boolean;
};

export function FileUploadButton({ onFilesReady, isSending = false, hasText = false }: Props) {
  // ---------------- Refs / estado / hooks base ----------------
  const inputRef = useRef<HTMLInputElement | null>(null);
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [queue, setQueue] = useState<PreviewItem[]>([]);
  const [progress, setProgress] = useState(0); // solo visual (pre-envío)

  // ---------------- HOIST de useColorModeValue (nunca dentro de JSX) ----------------
  const trackColor   = useColorModeValue("whiteAlpha.300", "whiteAlpha.300");
  const hoverBg      = useColorModeValue("whiteAlpha.500", "whiteAlpha.300");
  const activeBg     = useColorModeValue("whiteAlpha.700", "whiteAlpha.500");

  const drawerBg     = useColorModeValue("rgba(255,255,255,0.7)", "rgba(17, 25, 40, 0.55)");
  const drawerBorder = useColorModeValue("rgba(255,255,255,0.6)", "rgba(255,255,255,0.15)");

  const cardBorder   = useColorModeValue("blackAlpha.200","whiteAlpha.300");
  const titleGrad    = useColorModeValue("linear(to-r, blue.600, cyan.500)", "linear(to-r, blue.300, cyan.300)");
  const subTextColor = useColorModeValue("blackAlpha.600","whiteAlpha.700");
  const badgeBg      = useColorModeValue("whiteAlpha.800","blackAlpha.700");
  const badgeColor   = useColorModeValue("gray.700","whiteAlpha.900");

  // Limpieza de URLs al desmontar o cuando cambia la cola
  useEffect(() => {
    return () => {
      queue.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [queue]);

  // ---------------- Handlers ----------------
  const handleFileSelection = (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;


    const files = Array.from(filesList).filter(isImageFile);
    if (files.length === 0) {
      toast({
        title: "Solo imágenes",
        description: "Selecciona archivos de tipo imagen (jpg, png, etc.)",
        status: "warning",
        duration: 3500,
        isClosable: true,
      });
      return;
    }

    const newItems: PreviewItem[] = files.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
      url: URL.createObjectURL(file),
      file,
    }));

    setQueue((prev) => [...prev, ...newItems]);
    onOpen();
  };

  const removeFromQueue = (id: string) => {
    setQueue((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((p) => p.id !== id);
    });
  };

  const clearQueue = () => {
    setQueue((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.url));
      return [];
    });
  };

  const totalSize = useMemo(
    () => queue.reduce((acc, cur) => acc + cur.file.size, 0),
    [queue]
  );

  const sendNow = () => {
    if (queue.length === 0) return;

    // Visual: simular pequeña barra antes de entregar al parent
    setProgress(30);
    setTimeout(() => {
      setProgress(70);
      const files = queue.map((q) => q.file);
      onFilesReady(files); // ← ENTREGAMOS AL CUSTOMCHAT
      setProgress(100);

      // limpiar UI local
      setTimeout(() => {
        setProgress(0);
        clearQueue();
        onClose();
        toast({
          title: "Images ready",
          description: "Attached to chat. You can now send them.",
          status: "success",
          duration: 2000,
          position: "bottom-right",
        });
      }, 250);
    }, 150);
  };

  // ---------------- Render ----------------
  return (
    <>
      <input
        ref={inputRef}
        name="images"
        type="file"
        multiple
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => handleFileSelection(e.target.files)}
      />

      <Tooltip label="Upload images" hasArrow placement="top">
        <Box
          position="relative"
          onClick={() => !isSending && inputRef.current?.click()}
          cursor={isSending ? "not-allowed" : "pointer"}
        >
          <CircularProgress
            value={progress}
            size="48px"
            thickness="10px"
            color="blue.300"
            trackColor={trackColor}
            capIsRound
            transition="all 0.2s ease"
          >
            <CircularProgressLabel>
              <IconButton
                aria-label="Upload images"
                icon={<HiOutlineCloudArrowUp size={22} />}
                variant="ghost"
                rounded="full"
                bg="whiteAlpha.200"
                backdropFilter="blur(8px)"
                _hover={{ bg: hoverBg, transform: "scale(1.05)" }}
                _active={{ bg: activeBg }}
                isDisabled={isSending}
              />
            </CircularProgressLabel>
          </CircularProgress>
        </Box>
      </Tooltip>

      <Drawer
        isOpen={isOpen}
        placement="bottom"
        onClose={() => { if (!isSending) onClose(); }}
        size="xl"
      >
        <DrawerOverlay
          backdropFilter="blur(14px) saturate(120%)"
          background="radial-gradient(100% 100% at 0% 0%, rgba(255,255,255,0.25) 0%, rgba(0,0,0,0.25) 100%)"
        />
        <DrawerContent
          borderTopRadius="2xl"
          p={{ base: 2, md: 4 }}
          bg={drawerBg}
          backdropFilter="blur(18px) saturate(120%)"
          borderWidth="1px"
          borderColor={drawerBorder}
          boxShadow="0 10px 30px rgba(0,0,0,0.12)"
        >
          <DrawerHeader pb={2}>
            <HStack justify="space-between" align="center">
              <VStack spacing={0} align="start">
                <Text fontSize="lg" fontWeight="semibold" bgGradient={titleGrad} bgClip="text">
                  Previsualizar imágenes
                </Text>
                <Text fontSize="sm" color={subTextColor}>
                  {queue.length} archivo{queue.length !== 1 ? "s" : ""} · {formatBytes(totalSize)}
                </Text>
              </VStack>
              <IconButton
                aria-label="Cerrar"
                icon={<CloseIcon />}
                variant="ghost"
                onClick={() => !isSending && onClose()}
                rounded="full"
              />
            </HStack>
          </DrawerHeader>

          <DrawerBody pt={2}>
            {progress > 0 && (
              <Box mb={3}>
                <Progress value={progress} borderRadius="full" colorScheme="blue" />
                <Text mt={1} fontSize="xs" color="whiteAlpha.700">
                  Preparando… {Math.round(progress)}%
                </Text>
              </Box>
            )}

            {queue.length === 0 ? (
              <Box py={10} textAlign="center" color="whiteAlpha.600">
                No hay imágenes seleccionadas.
              </Box>
            ) : (
              <Grid templateColumns={{ base: "repeat(3, 1fr)", md: "repeat(6, 1fr)" }} gap={3}>
                {queue.map((item) => (
                  <GridItem key={item.id} position="relative">
                    <MotionBox
                      overflow="hidden"
                      borderRadius="2xl"
                      borderWidth="1px"
                      borderColor={cardBorder}
                      boxShadow="0 6px 20px rgba(0,0,0,0.12)"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.995 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20 }}
                    >
                      <MotionImage
                        src={item.url}
                        alt={item.file.name}
                        objectFit="cover"
                        w="100%"
                        h={{ base: 24, md: 28 }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      />
                    </MotionBox>

                    <Badge
                      position="absolute"
                      top={2}
                      left={2}
                      bg={badgeBg}
                      color={badgeColor}
                      backdropFilter="blur(6px)"
                      borderRadius="full"
                      px={2}
                    >
                      {formatBytes(item.file.size)}
                    </Badge>
                    <IconButton
                      aria-label="Eliminar"
                      icon={<CloseIcon boxSize={2.5} />}
                      size="xs"
                      variant="solid"
                      colorScheme="red"
                      position="absolute"
                      top={2}
                      right={2}
                      onClick={() => removeFromQueue(item.id)}
                      rounded="full"
                    />
                  </GridItem>
                ))}
              </Grid>
            )}
          </DrawerBody>

          <DrawerFooter gap={2}>
            <Button variant="ghost" onClick={clearQueue} isDisabled={queue.length === 0 || isSending} rounded="full">
              Vaciar
            </Button>
            <Button onClick={() => inputRef.current?.click()} variant="outline" isDisabled={isSending} rounded="full">
              Agregar más
            </Button>
            <Button
              colorScheme="blue"
              onClick={sendNow}
              isDisabled={queue.length === 0 || isSending}
              rounded="full"
              boxShadow="0 10px 24px rgba(59,130,246,0.35)"
            >
              Enviar {queue.length > 0 ? `(${queue.length})` : ""}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
