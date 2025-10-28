// apps/frontend/src/Components/Dashboard/QuickAction.tsx
import React from "react";
import {
  Box,
  Flex,
  Text,
  Icon,
  useColorModeValue,
} from "@chakra-ui/react";
import type { IconType } from "react-icons";
import { useNavigate } from "react-router-dom";

interface QuickActionProps {
  title: string;
  description: string;
  icon: IconType;
  color?: string;
  to: string;
}

export const QuickAction: React.FC<QuickActionProps> = ({
  title,
  description,
  icon,
  color = "blue",
  to,
}) => {
  const navigate = useNavigate();
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const iconBgColor = useColorModeValue(`${color}.50`, `${color}.900`);
  const iconColor = useColorModeValue(`${color}.500`, `${color}.300`);
  const hoverBgColor = useColorModeValue("gray.50", "gray.700");

  return (
    <Box
      p={5}
      bg={bgColor}
      borderRadius="lg"
      border="1px"
      borderColor={borderColor}
      cursor="pointer"
      onClick={() => navigate(to)}
      _hover={{ shadow: "md", bg: hoverBgColor }}
      transition="all 0.2s"
    >
      <Flex align="start" gap={4}>
        <Flex
          w="40px"
          h="40px"
          align="center"
          justify="center"
          borderRadius="lg"
          bg={iconBgColor}
          flexShrink={0}
        >
          <Icon as={icon} w={5} h={5} color={iconColor} />
        </Flex>
        <Box>
          <Text fontWeight="semibold" fontSize="md" mb={1}>
            {title}
          </Text>
          <Text fontSize="sm" color="gray.600">
            {description}
          </Text>
        </Box>
      </Flex>
    </Box>
  );
};
