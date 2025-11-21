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
import { keyframes } from "@emotion/react";
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
  variant?: 'default' | 'premium';
  accentColor?: string; // optional override for premium glow
  valueFontSize?: string; // allow overriding the size for non-numeric phrases
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
  variant = 'default',
  accentColor,
  valueFontSize,
}) => {
  const bgColor = variant === 'premium'
    ? useColorModeValue(
        'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(245,248,255,0.92) 45%, rgba(235,240,255,0.9) 100%)',
        'linear-gradient(135deg, rgba(30,35,45,0.88) 0%, rgba(45,55,72,0.85) 50%, rgba(55,65,85,0.82) 100%)'
      )
    : useColorModeValue("white", "gray.800");

  const borderColor = useColorModeValue("gray.200", "gray.700");
  const iconBgColor = variant === 'premium'
    ? useColorModeValue('linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(220,230,255,0.6) 100%)', 'linear-gradient(135deg, rgba(60,70,90,0.65) 0%, rgba(80,90,110,0.65) 100%)')
    : useColorModeValue(`${color}.50`, `${color}.900`);
  const iconColor = useColorModeValue(`${color}.500`, `${color}.300`);
  const glowColor = accentColor || useColorModeValue(`${color}.200`, `${color}.600`);

  const shimmer = keyframes`
    0% { background-position: 0% 50%; }
    100% { background-position: 200% 50%; }
  `;

  const premiumRing = variant === 'premium' ? (
    <Box
      position="absolute"
      inset={0}
      borderRadius="xl"
      pointerEvents="none"
      _before={{
        content: '""',
        position: 'absolute',
        inset: '0',
        borderRadius: 'inherit',
        padding: '1px',
        background: `linear-gradient(135deg, ${glowColor}, transparent 60%)`,
        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude'
      }}
    />
  ) : null;

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
      position="relative"
      p={variant === 'premium' ? 7 : 6}
      bg={bgColor}
      borderRadius="xl"
      border="1px"
      borderColor={borderColor}
      shadow={variant === 'premium' ? 'md' : 'sm'}
      _hover={{
        shadow: variant === 'premium' ? 'xl' : 'md',
        transform: isClickable ? 'translateY(-3px)' : undefined,
        cursor: isClickable ? 'pointer' : undefined,
        borderColor: isClickable ? iconColor : borderColor,
      }}
      transition="all 0.35s"
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      backdropFilter={variant === 'premium' ? 'blur(10px) saturate(160%)' : undefined}
    >
      {premiumRing}
      <Flex justify="space-between" align="start" gap={4}>
        <Stat>
          <StatLabel
            fontSize="xs"
            fontWeight="semibold"
            letterSpacing="wide"
            textTransform="uppercase"
            color={variant === 'premium' ? useColorModeValue('gray.600','gray.400') : 'gray.600'}
          >
            {title}
          </StatLabel>
          <StatNumber
            fontSize={valueFontSize ? valueFontSize : (variant === 'premium' ? '3xl' : '3xl')}
            fontWeight="extrabold"
            mt={2}
            lineHeight="1"
            bg={variant === 'premium' ? 'linear-gradient(90deg, '+iconColor+', '+glowColor+', '+iconColor+')' : undefined}
            bgClip={variant === 'premium' ? 'text' : undefined}
            animation={variant === 'premium' ? `${shimmer} 6s linear infinite` : undefined}
            backgroundSize={variant === 'premium' ? '200% 100%' : undefined}
          >
            {value}
          </StatNumber>
          {trend && (
            <StatHelpText mb={0}>
              <StatArrow type={trend.isPositive ? 'increase' : 'decrease'} />
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
          position="relative"
          w={variant === 'premium' ? '56px' : '50px'}
          h={variant === 'premium' ? '56px' : '50px'}
          align="center"
          justify="center"
          borderRadius="xl"
          bg={iconBgColor}
          _before={variant === 'premium' ? {
            content: '""',
            position: 'absolute',
            inset: '-2px',
            borderRadius: 'inherit',
            background: `linear-gradient(135deg, ${iconColor}, ${glowColor})`,
            opacity: 0.35,
            filter: 'blur(6px)'
          } : undefined}
        >
          <Icon as={icon} w={7} h={7} color={iconColor} />
        </Flex>
      </Flex>
    </Box>
  );
};
