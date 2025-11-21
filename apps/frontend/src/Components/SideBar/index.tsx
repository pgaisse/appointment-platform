// apps/frontend/src/Components/SideBar/index.tsx
import {
  Box,
  VStack,
  HStack,
  Icon,
  Text,
  Divider,
  Tooltip,
  useColorModeValue,
  Link as ChakraLink,
} from "@chakra-ui/react";
import { NavLink as RouterLink, useLocation } from "react-router-dom";
import type { LinkItem as LinkItemType } from "@/types";

/**
 * Props esperadas (coinciden con tu Layout actual)
 * - linkItems: zona superior (links de la app)
 * - linkConfig: zona inferior (admin, settings, etc.)
 */
type Props = {
  linkItems: LinkItemType[];
  linkConfig?: LinkItemType[];
};

function SideBarLink({ item, isActive }: { item: LinkItemType; isActive: boolean }) {
  const activeBg = useColorModeValue("gray.100", "gray.700");
  const hoverBg = useColorModeValue("gray.50", "gray.800");
  const textColor = useColorModeValue("gray.800", "gray.100");
  const inactiveColor = useColorModeValue("gray.600", "gray.300");

  return (
    <Tooltip label={item.name} hasArrow placement="right" openDelay={400}>
      <ChakraLink

        as={RouterLink}
        to={item.path}
        _hover={{ textDecoration: "none" }}
        w="full"
        borderRadius="lg"
      >
        <HStack
          spacing={3}
          pl={3}
          pr={1}
          py={2.5}
          borderRadius="lg"
          transition="background 0.2s ease"
          bg={isActive ? activeBg : "transparent"}
          _hover={{ bg: isActive ? activeBg : hoverBg }}
        >
          {item.icon && (
            <Icon
              mx="auto"
              as={item.icon as any}
              boxSize={5}
              color={item.color || (isActive ? textColor : inactiveColor)}
            />
          )}
          <Text
            fontSize="sm"
            fontWeight={isActive ? "semibold" : "medium"}
            color={isActive ? textColor : inactiveColor}
            noOfLines={1}
          >
            {/*item.name*/}
          </Text>
        </HStack>
      </ChakraLink>
    </Tooltip>
  );
}

export default function SideBar({ linkItems, linkConfig = [] }: Props) {
  const location = useLocation();

  // Normaliza paths para comparar (quita trailing slash excepto "/")
  const normalizePath = (p?: string) => {
    if (!p) return "";
    if (p.length > 1 && p.endsWith("/")) return p.slice(0, -1);
    return p;
  };

  // Determina un único link activo (mejor coincidencia por prefijo más largo)
  const currentPath = normalizePath(location.pathname);
  const allLinks: LinkItemType[] = [...linkItems, ...linkConfig].filter((i) => !!i.path);
  const bestActive = allLinks.reduce<LinkItemType | null>((best, item) => {
    const p = normalizePath(item.path);
    if (!p) return best;
    const matches = currentPath === p || currentPath.startsWith(p + "/");
    if (!matches) return best;
    if (!best) return item;
    const bestPath = normalizePath(best.path);
    // Prefiere el path más específico (más largo)
    return p.length > bestPath.length ? item : best;
  }, null);
  const activePath = bestActive?.path || "";

  const sectionTitleColor = useColorModeValue("gray.500", "gray.400");
  const sidebarBg = useColorModeValue("white", "gray.100");

  return (
    <Box h="100%" display="flex" flexDir="column" overflow="hidden" p={2} bg={sidebarBg} zIndex={999}
      minW="fit-content"
    >
      {/* ─────────────────────────────────────────────────────────
          ZONA SUPERIOR (scrollable): links principales de la app
          ───────────────────────────────────────────────────────── */}
      <Box flex="1">
        {/* Título sección (opcional) */}
        {linkItems.length > 0 && (
          <Text fontSize="xs" fontWeight="semibold" color={sectionTitleColor} px={2} mb={2}>

          </Text>
        )}

        <VStack align="stretch" spacing={1}>
          {linkItems.map((item) => (
            <SideBarLink key={`${item.name}-${item.path}`} item={item} isActive={item.path === activePath} />
          ))}
        </VStack>
      </Box>

      {/* ─────────────────────────────────────────────────────────
          ZONA INFERIOR (fija): admin, settings, etc.
          ───────────────────────────────────────────────────────── */}
      {linkConfig.length > 0 && (
        <Box borderTopWidth="1px" pt={2} mt={2} bg={sidebarBg}>
          <Text fontSize="xs" fontWeight="semibold" color={sectionTitleColor} px={2} mb={2}>

          </Text>

          <VStack align="stretch" spacing={1}>
            {linkConfig.map((item) => (
              <SideBarLink key={`${item.name}-${item.path}`} item={item} isActive={item.path === activePath} />
            ))}
          </VStack>

          {/* Separador/espacio final para que no se pegue al borde */}
          <Divider mt={3} opacity={0} />
        </Box>
      )}
    </Box>
  );
}
