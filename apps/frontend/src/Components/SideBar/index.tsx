"use client";
import { LinkItem } from "@/types";
import {
  Avatar,
  Box,
  BoxProps,
  Drawer,
  DrawerContent,
  Flex,
  FlexProps,
  HStack,
  Icon,
  IconButton,
  Spacer,
  Text,
  useColorModeValue,
  useDisclosure,
  VStack,
} from "@chakra-ui/react";
import { ReactNode } from "react";
import { IconType } from "react-icons";
import { FiMenu } from "react-icons/fi";
import { Link, useLocation } from "react-router-dom";

interface SidebarProps extends BoxProps {
  onClose: () => void;
  linkItems: LinkItem[];
  linkConfig: LinkItem[];
}

const SidebarContent = ({ onClose, linkItems, linkConfig, ...rest }: SidebarProps) => {
  const location = useLocation();
  const activeBg = "blue.50";
  const activeColor = "blue.600";
  const hoverBg = "purple.100";

  const settingsItem = linkItems.find((link) => link.name.toLowerCase() === "settings");
  const otherLinks = linkItems.filter((link) => link.name.toLowerCase() !== "settings");

  return (
    <Flex
      direction="column"
      bg="white"
      borderRight="1px solid"
      borderColor="gray.200"
      w={{ base: "full", md: "220px" }}
      h="100vh"
      p={4}
      {...rest}
    >
      {/* Links principales */}
      <VStack spacing={1} align="start" flex="1">
        {otherLinks.map((link, index) => {
          const isActive = location.pathname === link.path;
          return (
            <Link to={link.path} key={`${link.name}-${index}`} style={{ width: "100%" }}>
              <NavItem
                icon={link.icon}
                iconColor={link.color}
                isActive={isActive}
                activeBg={activeBg}
                activeColor={activeColor}
                hoverBg={hoverBg}
              >
                {link.name}
              </NavItem>
            </Link>
          );
        })}
      </VStack>

      <Spacer />

      {/* Settings */}
      {settingsItem && (
        <>
          <Box w="100%" borderTop="1px solid" borderColor="gray.200" my={2} />
          <Link to={settingsItem.path} style={{ width: "100%" }}>
            <NavItem
              icon={settingsItem.icon}
              iconColor={settingsItem.color}
              isActive={location.pathname === settingsItem.path}
              activeBg={activeBg}
              activeColor={activeColor}
              hoverBg={hoverBg}
            >
              {settingsItem.name}
            </NavItem>
          </Link>
        </>
      )}

      {/* Configuración del usuario */}
      {linkConfig.length > 0 && (
        <>
          <Box w="100%" borderTop="1px solid" borderColor="gray.200" my={2} />
          <VStack spacing={1} align="start">
            {linkConfig.map((link, index) => {
              const isActive = location.pathname === link.path;
              return (
                <Link to={link.path} key={`config-${link.name}-${index}`} style={{ width: "100%" }}>
                  <NavItem
                    icon={link.icon}
                    iconColor={link.color}
                    isActive={isActive}
                    activeBg={activeBg}
                    activeColor={activeColor}
                    hoverBg={hoverBg}
                  >
                    {link.name}
                  </NavItem>
                </Link>
              );
            })}
          </VStack>
        </>
      )}
    </Flex>
  );
};

interface NavItemProps extends FlexProps {
  icon: IconType;
  iconColor: string;
  children: ReactNode;
  isActive: boolean;
  activeBg?: string;
  activeColor?: string;
  hoverBg?: string;
}

const NavItem = ({
  icon,
  iconColor,
  children,
  isActive,
  activeBg = "blue.50",
  activeColor = "blue.600",
  hoverBg = "purple.100",
  ...rest
}: NavItemProps) => {
  return (
    <Box>
      <Flex
        align="center"
        px={4}
        py={3}
        borderRadius="md"
        role="group"
        cursor="pointer"
        bg={isActive ? activeBg : "transparent"}
        color={isActive ? activeColor : "gray.800"}
        _hover={{
          bg: hoverBg,
          color: "purple.800",
        }}
        {...rest}
      >
        <Icon
          as={icon}
          color={iconColor}
          mr="4"
          _groupHover={{ color: "purple.800" }}
        />
        <Text fontSize="sm" fontWeight={isActive ? "bold" : "normal"}>
          {children}
        </Text>
      </Flex>
    </Box>
  );
};

interface MobileProps extends FlexProps {
  onOpen: () => void;
}

const MobileNav = ({ onOpen, ...rest }: MobileProps) => {
  return (
    <Flex
      ml={{ base: 0, md: 60 }}
      px={{ base: 4, md: 6 }}
      height="20"
      alignItems="center"
      bg="white"
      borderBottomWidth="1px"
      borderBottomColor="gray.200"
      justifyContent="flex-start"
      {...rest}
    >
      <IconButton
        variant="outline"
        onClick={onOpen}
        aria-label="open menu"
        icon={<FiMenu />}
      />
      <Text fontSize="lg" ml="4" fontWeight="bold">
        Dental Pro+
      </Text>
    </Flex>
  );
};

interface SimpleSidebarProps {
  linkItems: LinkItem[];
  linkConfig: LinkItem[];
}

export default function SimpleSidebar({ linkItems, linkConfig }: SimpleSidebarProps) {
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <Box minH="100vh">
      <SidebarContent
        onClose={onClose}
        display={{ base: "none", md: "flex" }}
        linkItems={linkItems}
        linkConfig={linkConfig}
      />
      <Drawer
        isOpen={isOpen}
        placement="left"
        onClose={onClose}
        returnFocusOnClose={false}
        onOverlayClick={onClose}
        size="full"
      >
        <DrawerContent>
          <SidebarContent
            onClose={onClose}
            linkItems={linkItems}
            linkConfig={linkConfig}
          />
        </DrawerContent>
      </Drawer>
      <MobileNav display={{ base: "flex", md: "none" }} onOpen={onOpen} />
      <Box ml={{ base: 0, md: 60 }} p="4">
        {/* Aquí va tu contenido principal */}
      </Box>
    </Box>
  );
}
