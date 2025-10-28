// apps/frontend/src/Components/Dashboard/StatCard.tsx
import React from "react";
import {
  Box,
  Flex,
  Text,
  Icon,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  useColorModeValue,
  Skeleton,
} from "@chakra-ui/react";
import type { IconType } from "react-icons";

interface StatCardProps {
  title: string;
  value: number | string | React.ReactNode;
  icon: IconType;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  subtitle?: string;
  color?: string;
  isLoading?: boolean;
  onClick?: () => void;
  isClickable?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  trend,
  subtitle,
  color = "blue",
  isLoading = false,
  onClick,
  isClickable = false,
}) => {
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const iconBgColor = useColorModeValue(`${color}.50`, `${color}.900`);
  const iconColor = useColorModeValue(`${color}.500`, `${color}.300`);

  if (isLoading) {
    return (
      <Box
        p={6}
        bg={bgColor}
        borderRadius="xl"
        border="1px"
        borderColor={borderColor}
        shadow="sm"
        _hover={{ shadow: "md" }}
        transition="all 0.3s"
      >
        <Skeleton height="80px" />
      </Box>
    );
  }

  return (
    <Box
      p={6}
      bg={bgColor}
      borderRadius="xl"
      border="1px"
      borderColor={borderColor}
      shadow="sm"
      _hover={{ 
        shadow: "md",
        transform: isClickable ? "translateY(-2px)" : undefined,
        cursor: isClickable ? "pointer" : undefined,
        borderColor: isClickable ? iconColor : borderColor,
      }}
      transition="all 0.3s"
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      <Flex justify="space-between" align="start">
        <Stat>
          <StatLabel fontSize="sm" fontWeight="medium" color="gray.600">
            {title}
          </StatLabel>
          <StatNumber fontSize="3xl" fontWeight="bold" mt={2}>
            {value}
          </StatNumber>
          {trend && (
            <StatHelpText mb={0}>
              <StatArrow type={trend.isPositive ? "increase" : "decrease"} />
              {trend.value}%
            </StatHelpText>
          )}
          {subtitle && (
            <Text fontSize="xs" color="gray.500" mt={1}>
              {subtitle}
            </Text>
          )}
        </Stat>
        <Flex
          w="50px"
          h="50px"
          align="center"
          justify="center"
          borderRadius="lg"
          bg={iconBgColor}
        >
          <Icon as={icon} w={6} h={6} color={iconColor} />
        </Flex>
      </Flex>
    </Box>
  );
};
