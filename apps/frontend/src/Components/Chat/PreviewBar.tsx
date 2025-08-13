// Components/Chat/PreviewBar.tsx
import { Box, HStack, IconButton, Image, Tooltip, Text } from "@chakra-ui/react";
import { CloseIcon } from "@chakra-ui/icons";
import { useEffect } from "react";

type PreviewItem = { id: string; url: string; name: string; size: number };

type Props = {
  previews: PreviewItem[];                     // [{id,url,name,size}]
  onRemove: (id: string) => void;             // elimina 1
  onClear: () => void;                        // vacía todos
};

export default function PreviewBar({ previews, onRemove, onClear }: Props) {
  // Limpieza de URLs al desmontar
  useEffect(() => {
    return () => {
      previews.forEach(p => URL.revokeObjectURL(p.url));
    };
  }, [previews]);

  if (!previews.length) return null;

  return (
    <Box
      w="100%"
      px={2}
      py={2}
      bg="blackAlpha.50"
      _dark={{ bg: "whiteAlpha.100" }}
      border="1px solid"
      borderColor="blackAlpha.200"
      borderRadius="xl"
    >
      <HStack spacing={2} align="center" wrap="wrap">
        {previews.map((p) => (
          <Box key={p.id} position="relative" borderRadius="lg" overflow="hidden">
            <Image
              src={p.url}
              alt={p.name}
              boxSize="64px"
              objectFit="cover"
              borderRadius="lg"
            />
            <IconButton
              aria-label="Remove"
              icon={<CloseIcon boxSize={2} />}
              size="xs"
              variant="solid"
              colorScheme="red"
              position="absolute"
              top={1}
              right={1}
              onClick={() => onRemove(p.id)}
              borderRadius="full"
            />
          </Box>
        ))}

        <Tooltip label="Clear all">
          <IconButton
            aria-label="Clear previews"
            icon={<CloseIcon boxSize={2} />}
            size="sm"
            variant="ghost"
            onClick={onClear}
          />
        </Tooltip>

        <Text fontSize="xs" color="blackAlpha.600" _dark={{ color: "whiteAlpha.700" }}>
          {previews.length} selected
        </Text>
      </HStack>
    </Box>
  );
}
