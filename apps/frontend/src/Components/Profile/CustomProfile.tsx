// apps/frontend/src/Components/Profile/PremiumProfile.tsx
import { useMemo, useState } from "react";
import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Flex,
  Grid,
  GridItem,
  HStack,
  Icon,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Spinner,
  Stack,
  Tag,
  Text,
  Tooltip,
  useClipboard,
  useColorModeValue,
  useDisclosure,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import { FiCheckCircle, FiAlertCircle, FiMail, FiShield, FiCopy, FiEdit2, FiRefreshCw, FiUser, FiCalendar, FiUsers } from "react-icons/fi";
import { useProfile, useUpdateProfile, useRefreshSession } from "@/Hooks/Query/useProfile";

function Stat({ label, value, icon }: { label: string; value: string | number; icon?: any }) {
  const iconColor = useColorModeValue("purple.600", "purple.300");
  return (
    <Card variant="outline">
      <CardBody>
        <HStack spacing={3}>
          {icon ? <Icon as={icon} color={iconColor} boxSize={5} /> : null}
          <Stack spacing={0}>
            <Text fontSize="sm" opacity={0.7}>{label}</Text>
            <Text fontWeight="bold" fontSize="lg">{value}</Text>
          </Stack>
        </HStack>
      </CardBody>
    </Card>
  );
}

export default function CustomProfile() {
  const { data, isLoading, isError } = useProfile();
  const refreshSession = useRefreshSession();

  const { isOpen, onOpen, onClose } = useDisclosure();
  const updater = useUpdateProfile();

  const [formName, setFormName] = useState("");
  const [formPic, setFormPic] = useState("");

  const badgeColor = useColorModeValue("green.500", "green.300");
  const warnColor = useColorModeValue("orange.500", "orange.300");
  const ringGradient = "linear(to-r, purple.500, pink.400)";

  const bgHero = useColorModeValue("linear-gradient(90deg, #7c3aed 0%, #ec4899 100%)", "linear-gradient(90deg, #a78bfa 0%, #f472b6 100%)");
  const cardBg = useColorModeValue("white", "gray.900");

  const tokenUser = data?.tokenUser;
  const dbUser = data?.dbUser || {};
  const stats = data?.stats || { rolesCount: 0, permissionsCount: 0, orgsCount: 0 };

  const name = tokenUser?.name || dbUser?.name || "Your Name";
  const picture = (dbUser?.picture || tokenUser?.picture) ?? undefined;
  const email = tokenUser?.email;
  const emailVerified = tokenUser?.emailVerified;
  const orgName = tokenUser?.org_name || dbUser?.org_name || undefined;

  const createdAt = dbUser?.createdAt ? new Date(dbUser.createdAt) : null;
  const lastLoginAt = dbUser?.lastLoginAt ? new Date(dbUser.lastLoginAt) : null;

  const roles = tokenUser?.roles || dbUser?.roles || [];
  const permissions = tokenUser?.permissions || dbUser?.permissions || [];

  const [showAllPerms, setShowAllPerms] = useState(false);
  const visiblePerms = useMemo(() => {
    if (!permissions) return [];
    return showAllPerms ? permissions : permissions.slice(0, 12);
  }, [permissions, showAllPerms]);

  const { onCopy: copyUserId, hasCopied: copiedUserId } = useClipboard(tokenUser?.id || "");
  const { onCopy: copyAuth0Id, hasCopied: copiedAuth0Id } = useClipboard(dbUser?.auth0_id || "");
  const { onCopy: copyEmail, hasCopied: copiedEmail } = useClipboard(email || "");
  const { onCopy: copyOrgId, hasCopied: copiedOrgId } = useClipboard(tokenUser?.org_id || "");

  if (isLoading) return <Spinner />;
  if (isError || !data?.ok) return <Text>Failed to load profile.</Text>;

  const openEdit = () => {
    setFormName(name || "");
    setFormPic(picture || "");
    onOpen();
  };

  const saveEdit = async () => {
    await updater.mutateAsync({ name: formName, picture: formPic });
    onClose();
  };

  return (
    <Box>
      {/* HERO */}
      <Box
        borderRadius="2xl"
        h={{ base: 140, md: 160 }}
        bgImage={bgHero}
        boxShadow="0 30px 60px rgba(124,58,237,0.35)"
      />

      {/* HEADER CARD */}
      <Card
        mt={-12}
        bg={cardBg}
        borderRadius="2xl"
        shadow="xl"
        overflow="hidden"
      >
        <CardBody>
          <Flex direction={{ base: "column", md: "row" }} align={{ base: "flex-start", md: "center" }} gap={6}>
            {/* Avatar con anillo degradado */}
            <Box bgGradient={ringGradient} p="2px" borderRadius="full" lineHeight={0}>
              <Box bg={cardBg} p="3px" borderRadius="full">
                <Avatar size="xl" name={name || undefined} src={picture} />
              </Box>
            </Box>

            {/* Datos principales */}
            <Box flex="1" minW={0}>
              <HStack spacing={3} align="center" flexWrap="wrap">
                <Text fontSize="2xl" fontWeight="extrabold" lineHeight="short">
                  {name}
                </Text>
                {emailVerified ? (
                  <Badge colorScheme="green" variant="subtle" display="inline-flex" alignItems="center" gap={1}>
                    <Icon as={FiCheckCircle} color={badgeColor} /> Verified
                  </Badge>
                ) : (
                  <Badge colorScheme="orange" variant="subtle" display="inline-flex" alignItems="center" gap={1}>
                    <Icon as={FiAlertCircle} color={warnColor} /> Unverified
                  </Badge>
                )}
                {orgName ? <Badge variant="outline">{orgName}</Badge> : null}
                {dbUser?.status ? <Badge variant="solid" colorScheme={dbUser.status === 'active' ? 'green' : 'gray'}>{dbUser.status}</Badge> : null}
              </HStack>

              <HStack mt={2} spacing={4} flexWrap="wrap">
                {email && (
                  <Tooltip label="Copy email">
                    <Button size="xs" variant="ghost" leftIcon={<FiMail />} onClick={() => { copyEmail(); }}>
                      {copiedEmail ? "Copied!" : email}
                    </Button>
                  </Tooltip>
                )}
                {tokenUser?.id && (
                  <Tooltip label="Copy User ID">
                    <Button size="xs" variant="ghost" leftIcon={<FiCopy />} onClick={copyUserId}>
                      {copiedUserId ? "Copied ID!" : "User ID"}
                    </Button>
                  </Tooltip>
                )}
                {dbUser?.auth0_id && (
                  <Tooltip label="Copy Auth0 ID">
                    <Button size="xs" variant="ghost" leftIcon={<FiCopy />} onClick={copyAuth0Id}>
                      {copiedAuth0Id ? "Copied!" : "Auth0 ID"}
                    </Button>
                  </Tooltip>
                )}
                {tokenUser?.org_id && (
                  <Tooltip label="Copy Org ID">
                    <Button size="xs" variant="ghost" leftIcon={<FiCopy />} onClick={copyOrgId}>
                      {copiedOrgId ? "Copied!" : "Org ID"}
                    </Button>
                  </Tooltip>
                )}
              </HStack>
            </Box>

            {/* Acciones rápidas */}
            <HStack>
              
              <Tooltip label="Refresh session">
                <IconButton
                  aria-label="Refresh"
                  icon={<FiRefreshCw />}
                  onClick={() => refreshSession()}
                />
              </Tooltip>
            </HStack>
          </Flex>
        </CardBody>
      </Card>

      {/* MÉTRICAS */}
      <SimpleGrid columns={{ base: 1, md: 3 }} gap={4} mt={6}>
        <Stat label="Roles" value={stats.rolesCount} icon={FiShield} />
        <Stat label="Permissions" value={stats.permissionsCount} icon={FiUser} />
        <Stat label="Organizations" value={stats.orgsCount} icon={FiUsers} />
      </SimpleGrid>

      {/* CONTENIDO */}
      <Grid templateColumns={{ base: "1fr", lg: "2fr 1fr" }} gap={6} mt={6}>
        {/* Permisos */}
        <GridItem>
          <Card variant="outline">
            <CardHeader>
              <HStack justify="space-between">
                <Text fontWeight="bold">Effective permissions</Text>
                <Badge>{permissions.length}</Badge>
              </HStack>
            </CardHeader>
            <CardBody>
              {permissions.length === 0 ? (
                <Text opacity={0.7}>No permissions.</Text>
              ) : (
                <>
                  <Wrap>
                    {visiblePerms.map((p) => (
                      <WrapItem key={p}>
                        <Tag>{p}</Tag>
                      </WrapItem>
                    ))}
                  </Wrap>
                  {permissions.length > 12 && (
                    <Button size="sm" variant="ghost" mt={3} onClick={() => setShowAllPerms((v) => !v)}>
                      {showAllPerms ? "Show less" : `Show all (${permissions.length})`}
                    </Button>
                  )}
                </>
              )}
            </CardBody>
          </Card>
        </GridItem>

        {/* Detalle de cuenta */}
        <GridItem>
          <Card variant="outline">
            <CardHeader>
              <Text fontWeight="bold">Account details</Text>
            </CardHeader>
            <CardBody>
              <Stack spacing={3}>
                <HStack justify="space-between">
                  <Text opacity={0.7}>Email</Text>
                  <HStack>
                    <Text fontWeight="medium">{email || "-"}</Text>
                    {email && (
                      <IconButton aria-label="Copy email" size="xs" icon={<FiCopy />} onClick={copyEmail} />
                    )}
                  </HStack>
                </HStack>

                <Divider />

                <HStack justify="space-between">
                  <Text opacity={0.7}>Created at</Text>
                  <HStack>
                    <Icon as={FiCalendar} opacity={0.6} />
                    <Text fontWeight="medium">
                      {createdAt ? createdAt.toLocaleString() : "-"}
                    </Text>
                  </HStack>
                </HStack>

                <HStack justify="space-between">
                  <Text opacity={0.7}>Last login</Text>
                  <HStack>
                    <Icon as={FiCalendar} opacity={0.6} />
                    <Text fontWeight="medium">
                      {lastLoginAt ? lastLoginAt.toLocaleString() : "-"}
                    </Text>
                  </HStack>
                </HStack>

                <Divider />

                <HStack justify="space-between" align="start">
                  <Text opacity={0.7}>Roles</Text>
                  <Stack direction="row" flexWrap="wrap" justify="end" gap={2}>
                    {roles.length === 0 ? <Tag>None</Tag> : roles.map(r => <Tag key={r} variant="subtle">{r}</Tag>)}
                  </Stack>
                </HStack>
              </Stack>
            </CardBody>
          </Card>
        </GridItem>
      </Grid>

      {/* MODAL EDITAR */}
      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit profile</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={3}>
              <Box>
                <Text fontSize="sm" mb={1} opacity={0.7}>Full name</Text>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Your name" />
              </Box>
              <Box>
                <Text fontSize="sm" mb={1} opacity={0.7}>Avatar URL</Text>
                <Input value={formPic} onChange={(e) => setFormPic(e.target.value)} placeholder="https://..." />
              </Box>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>Cancel</Button>
            <Button
              colorScheme="purple"
              isLoading={updater.isPending}
              onClick={saveEdit}
            >
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
