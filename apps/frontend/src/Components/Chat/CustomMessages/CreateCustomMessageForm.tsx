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
  
  Tooltip,
  Divider
} from '@chakra-ui/react';
import { useState } from 'react';
 

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
      toast({ title: "All fields are required", status: "warning", duration: 3000 });
      return;
    }

    // Here you'd save the message in the DB
    toast({ title: "Template saved successfully", status: "success", duration: 3000 });
    setTitle("");
    setContent("");
    setTokensUsed([]);
    if (onClose) onClose();
  };

  return (
    <Box p={6} rounded="2xl" bg={cardBg} shadow="xl" w="full" maxW="lg" mx="auto">
      <Heading size="lg" mb={6} textAlign="center">
        Create custom message
      </Heading>
      <VStack spacing={5} align="stretch">
        <FormControl>
          <FormLabel>Title</FormLabel>
          <Input placeholder="Ex: Appointment confirmation" value={title} onChange={(e) => setTitle(e.target.value)} />
        </FormControl>

        <FormControl>
          <FormLabel>Content</FormLabel>
          <Textarea
            placeholder="Write the message using tokens..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
          />
        </FormControl>

        <Divider my={2} />

        <FormControl>
          <FormLabel>All available tokens</FormLabel>
          <HStack wrap="wrap">
            {availableTokens.map((token) => (
              <Tooltip key={token} label="Insert token">
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
            <FormLabel>Tokens used</FormLabel>
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
          Save message
        </Button>
      </VStack>
    </Box>
  );
}
