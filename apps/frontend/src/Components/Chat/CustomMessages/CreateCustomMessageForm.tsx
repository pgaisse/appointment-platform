// components/CreateCustomMessageForm.tsx
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  VStack,
  Heading,
  useToast,
  useColorModeValue,
  HStack,
  Tag,
  TagLabel,
  TagCloseButton,
  IconButton,
  Tooltip,
  Divider,
  Text
} from '@chakra-ui/react';
import { useState } from 'react';
import { FaPlus } from 'react-icons/fa';

const availableTokens = [
  "#Name",
  "#Lastname",
  "#Contact",
  "#Phone",
  "#Today",
  "#time"
];

export default function CreateCustomMessageForm({ onClose }: { onClose?: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tokensUsed, setTokensUsed] = useState<string[]>([]);
  const toast = useToast();
  const cardBg = useColorModeValue('white', 'gray.800');

  const insertToken = (token: string) => {
    setContent((prev) => prev + " " + token);
    if (!tokensUsed.includes(token)) {
      setTokensUsed((prev) => [...prev, token]);
    }
  };

  const handleSave = async () => {
    if (!title || !content) {
      toast({ title: "Todos los campos son obligatorios", status: "warning", duration: 3000 });
      return;
    }

    // Aquí iría la lógica para guardar el mensaje en la DB
    toast({ title: "Plantilla guardada exitosamente", status: "success", duration: 3000 });
    setTitle("");
    setContent("");
    setTokensUsed([]);
    if (onClose) onClose();
  };

  return (
    <Box p={6} rounded="2xl" bg={cardBg} shadow="xl" w="full" maxW="lg" mx="auto">
      <Heading size="lg" mb={6} textAlign="center">
        Crear mensaje personalizado
      </Heading>
      <VStack spacing={5} align="stretch">
        <FormControl>
          <FormLabel>Título</FormLabel>
          <Input placeholder="Ej: Confirmación de cita" value={title} onChange={(e) => setTitle(e.target.value)} />
        </FormControl>

        <FormControl>
          <FormLabel>Contenido</FormLabel>
          <Textarea
            placeholder="Escribe el mensaje con tokens..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
          />
        </FormControl>

        <Divider my={2} />

        <FormControl>
          <FormLabel>Todos los tokens disponibles</FormLabel>
          <HStack wrap="wrap">
            {availableTokens.map((token) => (
              <Tooltip key={token} label="Insertar token">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => insertToken(token)}
                >
                  {token}
                </Button>
              </Tooltip>
            ))}
          </HStack>
        </FormControl>

        {tokensUsed.length > 0 && (
          <Box>
            <FormLabel>Tokens usados</FormLabel>
            <HStack wrap="wrap">
              {tokensUsed.map((token) => (
                <Tag key={token} colorScheme="blue">
                  <TagLabel>{token}</TagLabel>
                  <TagCloseButton onClick={() => setTokensUsed(tokensUsed.filter((t) => t !== token))} />
                </Tag>
              ))}
            </HStack>
          </Box>
        )}

        <Button colorScheme="blue" size="lg" onClick={handleSave} mt={4}>
          Guardar mensaje
        </Button>
      </VStack>
    </Box>
  );
}
