import { Box, Icon, Text } from "@chakra-ui/react";
import { FiMessageSquare } from "react-icons/fi";

const MessageIconWithBadge = ({ count }: { count: number }) => {
  return (
    <Box position="relative" display="inline-block">
      {/* Icono de mensaje */}
      <Icon as={FiMessageSquare} boxSize={6} />

      {/* Superíndice con número */}
      {count > 0 && (
        <Box
          position="absolute"
          top="-1"
          right="-1"
          bg="red.500"
          color="white"
          borderRadius="full"
          px={2}
          fontSize="xs"
          fontWeight="bold"
          lineHeight="shorter"
          minW="5"
          textAlign="center"
        >
          {count}
        </Box>
      )}
    </Box>
  );
};

export default MessageIconWithBadge;
