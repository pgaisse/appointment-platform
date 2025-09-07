'use client'
import React from 'react';
import {
  Avatar,
  Box,
  Button,
  Flex,
  HStack,
  Stack,
  Text,
  useColorModeValue,
} from '@chakra-ui/react';
import { IconType } from 'react-icons';
import { Link } from "react-router-dom";

interface LinkItemProps {
  name: string;
  path: string;
  icon: IconType;
  color: string;
}

type Props = {
  children?: React.ReactNode
  linkItems?: LinkItemProps[];
  linkSession?: LinkItemProps[];
}

const NavLink = ({ children }: { children: React.ReactNode }) => (
  <Box
    px={4}
    py={2}
    borderRadius="md"
    fontSize="sm"
    fontWeight="medium"
    _hover={{ bg: "purple.100", color: "purple.800" }}
    transition="all 0.2s"
  >
    {children}
  </Box>
);

export default function Header({ linkItems, linkSession }: Props) {
  const bg = useColorModeValue("white", "gray.900");
  const borderColor = useColorModeValue("gray.200", "gray.700");

  return (
    <Box
      bg={bg}
      borderBottom="1px solid"
      borderColor={borderColor}
      px={6}
      py={3}
      shadow="sm"
    >
      <Flex align="center" justify="space-between">
        <HStack spacing={4}>
          {/* Logo / App Name */}
          <Text fontWeight="bold" fontSize="lg" color="purple.800">
           App Sys
          </Text>

          {/* Navigation Links */}
          <HStack spacing={2}>
            {linkItems?.map((link, index) => (
              <Link to={link.path} key={`${link.name}-${index}`}>
                <NavLink>{link.name}</NavLink>
              </Link>
            ))}
          </HStack>
        </HStack>

        {/* Session Links / User */}
        <HStack spacing={4}>
          {linkSession?.map((link, index) => (
            link.path ? (
              <Button
                as={Link}
                to={link.path}
                key={`${link.name}-${index}`}
                leftIcon={<link.icon />}
                fontWeight="medium"
                fontSize="sm"
                colorScheme={link.color}
                >
                {link.name}
              </Button>
            ) : (
              <HStack key={index} spacing={2}>
                <Avatar size="sm" name={link.name} />
                <Text fontSize="sm" fontWeight="medium">
                  {link.name}
                </Text>
              </HStack>
            )
          ))}
        </HStack>
      </Flex>
    </Box>
  );
}
