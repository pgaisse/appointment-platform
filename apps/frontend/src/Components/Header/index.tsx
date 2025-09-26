'use client'
import React from 'react';
import {
  Avatar,
  Box,
  Button,
  Flex,
  HStack,
  Text,
  useColorModeValue,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Icon,
  chakra,
} from '@chakra-ui/react';
import { ChevronDownIcon } from '@chakra-ui/icons';
import { FiLogOut, FiUser } from 'react-icons/fi';
import { IconType } from 'react-icons';
import { Link } from "react-router-dom";
import { useAuth0 } from '@auth0/auth0-react';
import paths from '@/Routes/path';

interface LinkItemProps {
  name: string;
  path: string;
  icon: IconType;
}

type Props = {
  children?: React.ReactNode
  linkItems?: LinkItemProps[];
  linkSession?: LinkItemProps[]; // kept for backwards compatibility
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

function PremiumUserChip({
  name,
  picture,
}: {
  name: string;
  picture?: string | null;
}) {
  const innerBg = useColorModeValue("white", "gray.900");
  const textColor = useColorModeValue("gray.800", "gray.100");

  return (
    <Menu placement="bottom-end" gutter={8} autoSelect={false}>
      <MenuButton
        as={Button}
        variant="unstyled"
        p={0}
        _focusVisible={{ boxShadow: "outline" }}
        aria-label="Account menu"
      >
        {/* Gradient border pill */}
        <Box
          bgGradient="linear(to-r, purple.500, pink.400)"
          borderRadius="full"
          p="1px"
          transition="transform 0.15s ease"
          _hover={{ transform: "translateY(-1px)" }}
          boxShadow="0 8px 24px rgba(168,85,247,0.22)"
        >
          <HStack
            bg={innerBg}
            borderRadius="full"
            pl={1}
            pr={2}
            py={1}
            spacing={2}
          >
            <Avatar
              size="sm"
              name={name}
              src={picture || undefined}
              bg="purple.500"
              color="white"
            />
            <Text
              maxW={{ base: 28, sm: 40 }}
              noOfLines={1}
              fontWeight="semibold"
              color={textColor}
            >
              {name}
            </Text>
            <ChevronDownIcon color="purple.500" />
          </HStack>
        </Box>
      </MenuButton>

      <MenuList
        py={2}
        border="1px solid"
        borderColor={useColorModeValue("gray.200", "gray.700")}
        boxShadow="lg"
      >
        <MenuItem icon={<Icon as={FiUser} />} as={Link} to="/profile">
          Profile
        </MenuItem>
        <MenuItem
          icon={<Icon as={FiLogOut} />}
          onClick={() =>
            // Adjust returnTo if you want to control the post-logout redirect
            window.location.assign(paths.logout)
          }
        >
          Sign out
        </MenuItem>
      </MenuList>
    </Menu>
  );
}

export default function Header({ linkItems, linkSession }: Props) {
  const bg = useColorModeValue("white", "gray.900");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const logoGradient = useColorModeValue(
    "linear(to-r, purple.600, pink.500)",
    "linear(to-r, purple.300, pink.300)"
  );

  // Auth0
  const { isAuthenticated, user, loginWithRedirect } = useAuth0();

  // Resolve a premium-looking display name (fallbacks included)
  const displayName =
    (user?.name as string) ||
    ((user as any)?.["https://letsmarter.com/name"] as string) ||
    user?.email ||
    "Account";

  return (
    <Box
      bg={bg}
      borderBottom="1px solid"
      borderColor={borderColor}
      px={6}
      py={3}
      shadow="sm"
      as="header"
      position="sticky"
      top={0}
      insetInlineStart={0}
      insetInlineEnd={0}
      w="100vw"
      maxW="100vw"
      zIndex="docked"
      overflowX="clip"
    >
      <Flex align="center" justify="space-between" gap={4}>
        <HStack spacing={4} minW={0}>
          {/* Logo / App Name with subtle gradient branding */}
          <chakra.span
            fontWeight="extrabold"
            fontSize={{ base: "lg", md: "xl" }}
            bgGradient={logoGradient}
            bgClip="text"
            letterSpacing="tight"
            whiteSpace="nowrap"
          >
            App Sys
          </chakra.span>

          {/* Navigation Links */}
          <HStack spacing={2} overflow="hidden" flexWrap="wrap">
            {linkItems?.map((link, index) => (
              <Link to={link.path} key={`${link.name}-${index}`}>
                <NavLink>{link.name}</NavLink>
              </Link>
            ))}
          </HStack>
        </HStack>

        {/* Session / User Area */}
        <HStack spacing={3}>
          {!isAuthenticated ? (
            <>
              {/* Keep legacy session buttons if provided */}
              {linkSession?.map((link, i) =>
                link.path ? (
                  <Button
                    as={Link}
                    to={link.path}
                    key={`${link.name}-${i}`}
                    fontWeight="medium"
                    fontSize="sm"
                    color="white"
                    bg="pink.400"
                    _hover={{ bg: 'pink.300' }}
                  >
                    {link.name}
                  </Button>
                ) : null
              )}
             
            </>
          ) : (
            <PremiumUserChip
              name={displayName}
              picture={user?.picture || (user as any)?.["https://letsmarter.com/picture"]}
            />
          )}
        </HStack>
      </Flex>
    </Box>
  );
}
