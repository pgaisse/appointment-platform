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
  FormControl,
  FormHelperText,
  FormLabel,
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
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tag,
  Text,
  Textarea,
  Tooltip,
  useClipboard,
  useColorModeValue,
  useDisclosure,
  useToast,
  VStack,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import { FiCheckCircle, FiAlertCircle, FiMail, FiShield, FiCopy, FiEdit2, FiRefreshCw, FiUser, FiCalendar, FiUsers, FiCamera } from "react-icons/fi";
import { useProfile, useRefreshSession } from "@/Hooks/Query/useProfile";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth0 } from "@auth0/auth0-react";

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
  const { getAccessTokenSilently } = useAuth0();
  const queryClient = useQueryClient();
  const toast = useToast();

  const { isOpen, onOpen, onClose } = useDisclosure();

  const [activeTab, setActiveTab] = useState(0);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    firstName: "",
    lastName: "",
    phone: "",
    mobile: "",
    position: "",
    department: "",
    location: "",
    timezone: "Australia/Sydney",
    language: "en",
    bio: "",
    website: "",
    linkedin: "",
    emailNotifications: true,
    smsNotifications: false,
  });

  const badgeColor = useColorModeValue("green.500", "green.300");
  const warnColor = useColorModeValue("orange.500", "orange.300");
  const ringGradient = "linear(to-r, purple.500, pink.400)";

  const bgHero = useColorModeValue("linear-gradient(90deg, #7c3aed 0%, #ec4899 100%)", "linear-gradient(90deg, #a78bfa 0%, #f472b6 100%)");
  const cardBg = useColorModeValue("white", "gray.900");

  const tokenUser = data?.tokenUser;
  const dbUser = data?.dbUser || {};
  const stats = data?.stats || { rolesCount: 0, permissionsCount: 0, orgsCount: 0 };

  const name = dbUser?.name || tokenUser?.name || "Your Name";
  // Prioritize dbUser.picture (has signed URL from S3) over tokenUser.picture (Auth0 cached)
  const picture = avatarPreview || dbUser?.picture || tokenUser?.picture || undefined;
  const email = tokenUser?.email;
  const emailVerified = tokenUser?.emailVerified;
  const orgName = tokenUser?.org_name || dbUser?.org_name || undefined;

  const createdAt = dbUser?.createdAt ? new Date(dbUser.createdAt) : null;
  const lastLoginAt = dbUser?.lastLoginAt ? new Date(dbUser.lastLoginAt) : null;

  const roles = tokenUser?.roles || dbUser?.roles || [];
  const permissions = tokenUser?.permissions || dbUser?.permissions || [];

  // Avatar upload mutation
  const uploadAvatarMutation = useMutation({
    mutationFn: async () => {
      if (!avatarFile) throw new Error("No file selected");
      
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });

      const formData = new FormData();
      formData.append("avatar", avatarFile);

      const res = await fetch(`${import.meta.env.VITE_BASE_URL}/users/${dbUser?.id}/avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to upload avatar");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-me"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["db-users"] });
      toast({
        title: "Avatar updated",
        description: "Your profile picture has been updated successfully.",
        status: "success",
        duration: 3000,
      });
      setAvatarPreview(null);
      setAvatarFile(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        status: "error",
        duration: 5000,
      });
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (updates: any) => {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });

      const res = await fetch(`${import.meta.env.VITE_BASE_URL}/users/${dbUser?.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update profile");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-me"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["db-users"] });
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
        status: "success",
        duration: 3000,
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        status: "error",
        duration: 5000,
      });
    },
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.match(/^image\/(jpe?g|png|webp|gif)$/i)) {
      toast({
        title: "Invalid file type",
        description: "Please select a JPG, PNG, WEBP, or GIF image.",
        status: "error",
        duration: 5000,
      });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB.",
        status: "error",
        duration: 5000,
      });
      return;
    }

    setAvatarFile(file);

    // Preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

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
    setFormData({
      name: dbUser?.name || "",
      firstName: dbUser?.firstName || "",
      lastName: dbUser?.lastName || "",
      phone: dbUser?.phone || "",
      mobile: dbUser?.mobile || "",
      position: dbUser?.position || "",
      department: dbUser?.department || "",
      location: dbUser?.location || "",
      timezone: dbUser?.timezone || "Australia/Sydney",
      language: dbUser?.language || "en",
      bio: dbUser?.bio || "",
      website: dbUser?.website || "",
      linkedin: dbUser?.linkedin || "",
      emailNotifications: dbUser?.emailNotifications ?? true,
      smsNotifications: dbUser?.smsNotifications ?? false,
    });
    setAvatarPreview(null);
    setAvatarFile(null);
    onOpen();
  };

  const handleSubmit = async () => {
    // Upload avatar first if there's a new one
    if (avatarFile) {
      try {
        await uploadAvatarMutation.mutateAsync();
      } catch (error) {
        return; // Error already handled by mutation
      }
    }

    // Check for changes in other fields
    const updates: any = {};
    Object.keys(formData).forEach((key) => {
      const typedKey = key as keyof typeof formData;
      if (formData[typedKey] !== (dbUser as any)?.[key]) {
        updates[key] = formData[typedKey];
      }
    });

    if (Object.keys(updates).length > 0) {
      await updateProfileMutation.mutateAsync(updates);
    } else if (!avatarFile) {
      onClose();
    }
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
              <Tooltip label="Edit profile">
                <IconButton
                  aria-label="Edit"
                  icon={<FiEdit2 />}
                  onClick={openEdit}
                  colorScheme="purple"
                  variant="ghost"
                />
              </Tooltip>
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
        {/* Columna Izquierda */}
        <GridItem>
          <VStack spacing={6} align="stretch">
            {/* Contact & Work Information */}
            {(dbUser?.phone || dbUser?.mobile || dbUser?.website || dbUser?.linkedin || 
              dbUser?.position || dbUser?.department || dbUser?.location) && (
              <Card variant="outline">
                <CardHeader>
                  <Text fontWeight="bold">Contact & Work Information</Text>
                </CardHeader>
                <CardBody>
                  <VStack spacing={4} align="stretch">
                    {(dbUser?.phone || dbUser?.mobile || dbUser?.website || dbUser?.linkedin) && (
                      <>
                        <Box>
                          <Text fontSize="sm" fontWeight="semibold" color="gray.600" mb={2}>
                            Contact
                          </Text>
                          <Stack spacing={2}>
                            {dbUser?.phone && (
                              <HStack>
                                <Text fontSize="sm" opacity={0.7} minW="80px">Phone:</Text>
                                <Text fontSize="sm" fontWeight="medium">{dbUser.phone}</Text>
                              </HStack>
                            )}
                            {dbUser?.mobile && (
                              <HStack>
                                <Text fontSize="sm" opacity={0.7} minW="80px">Mobile:</Text>
                                <Text fontSize="sm" fontWeight="medium">{dbUser.mobile}</Text>
                              </HStack>
                            )}
                            {dbUser?.website && (
                              <HStack>
                                <Text fontSize="sm" opacity={0.7} minW="80px">Website:</Text>
                                <Text 
                                  fontSize="sm" 
                                  fontWeight="medium" 
                                  color="purple.600"
                                  as="a"
                                  href={dbUser.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  _hover={{ textDecoration: "underline" }}
                                >
                                  {dbUser.website}
                                </Text>
                              </HStack>
                            )}
                            {dbUser?.linkedin && (
                              <HStack>
                                <Text fontSize="sm" opacity={0.7} minW="80px">LinkedIn:</Text>
                                <Text 
                                  fontSize="sm" 
                                  fontWeight="medium" 
                                  color="purple.600"
                                  as="a"
                                  href={dbUser.linkedin}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  _hover={{ textDecoration: "underline" }}
                                >
                                  View Profile
                                </Text>
                              </HStack>
                            )}
                          </Stack>
                        </Box>
                        {(dbUser?.position || dbUser?.department || dbUser?.location) && <Divider />}
                      </>
                    )}

                    {(dbUser?.position || dbUser?.department || dbUser?.location) && (
                      <Box>
                        <Text fontSize="sm" fontWeight="semibold" color="gray.600" mb={2}>
                          Work
                        </Text>
                        <Stack spacing={2}>
                          {dbUser?.position && (
                            <HStack>
                              <Text fontSize="sm" opacity={0.7} minW="80px">Position:</Text>
                              <Text fontSize="sm" fontWeight="medium">{dbUser.position}</Text>
                            </HStack>
                          )}
                          {dbUser?.department && (
                            <HStack>
                              <Text fontSize="sm" opacity={0.7} minW="80px">Department:</Text>
                              <Text fontSize="sm" fontWeight="medium">{dbUser.department}</Text>
                            </HStack>
                          )}
                          {dbUser?.location && (
                            <HStack>
                              <Text fontSize="sm" opacity={0.7} minW="80px">Location:</Text>
                              <Text fontSize="sm" fontWeight="medium">{dbUser.location}</Text>
                            </HStack>
                          )}
                        </Stack>
                      </Box>
                    )}
                  </VStack>
                </CardBody>
              </Card>
            )}

            {/* Bio */}
            {dbUser?.bio && (
              <Card variant="outline">
                <CardHeader>
                  <Text fontWeight="bold">About</Text>
                </CardHeader>
                <CardBody>
                  <Text fontSize="sm" color="gray.700">{dbUser.bio}</Text>
                </CardBody>
              </Card>
            )}

            {/* Permisos */}
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
          </VStack>
        </GridItem>

        {/* Columna Derecha */}
        <GridItem>
          <VStack spacing={6} align="stretch">
            {/* Preferences */}
            <Card variant="outline">
              <CardHeader>
                <Text fontWeight="bold">Preferences</Text>
              </CardHeader>
              <CardBody>
                <Stack spacing={3}>
                  <HStack justify="space-between">
                    <Text opacity={0.7}>Timezone</Text>
                    <Text fontWeight="medium" fontSize="sm">
                      {dbUser?.timezone || "Australia/Sydney"}
                    </Text>
                  </HStack>

                  <HStack justify="space-between">
                    <Text opacity={0.7}>Language</Text>
                    <Text fontWeight="medium" fontSize="sm" textTransform="uppercase">
                      {dbUser?.language || "EN"}
                    </Text>
                  </HStack>

                  <Divider />

                  <HStack justify="space-between">
                    <Text opacity={0.7}>Email Notifications</Text>
                    <Badge colorScheme={dbUser?.emailNotifications !== false ? "green" : "gray"}>
                      {dbUser?.emailNotifications !== false ? "Enabled" : "Disabled"}
                    </Badge>
                  </HStack>

                  <HStack justify="space-between">
                    <Text opacity={0.7}>SMS Notifications</Text>
                    <Badge colorScheme={dbUser?.smsNotifications ? "green" : "gray"}>
                      {dbUser?.smsNotifications ? "Enabled" : "Disabled"}
                    </Badge>
                  </HStack>
                </Stack>
              </CardBody>
            </Card>

            {/* Detalle de cuenta */}
            <Card variant="outline">
              <CardHeader>
                <Text fontWeight="bold">Account details</Text>
              </CardHeader>
              <CardBody>
                <Stack spacing={3}>
                  <HStack justify="space-between">
                    <Text opacity={0.7}>Email</Text>
                    <HStack>
                      <Text fontWeight="medium" fontSize="sm">{email || "-"}</Text>
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
                      <Text fontWeight="medium" fontSize="sm">
                        {createdAt ? createdAt.toLocaleDateString() : "-"}
                      </Text>
                    </HStack>
                  </HStack>

                  <HStack justify="space-between">
                    <Text opacity={0.7}>Last login</Text>
                    <HStack>
                      <Icon as={FiCalendar} opacity={0.6} />
                      <Text fontWeight="medium" fontSize="sm">
                        {lastLoginAt ? lastLoginAt.toLocaleString() : "-"}
                      </Text>
                    </HStack>
                  </HStack>

                  <Divider />

                  <HStack justify="space-between" align="start">
                    <Text opacity={0.7}>Roles</Text>
                    <Stack direction="row" flexWrap="wrap" justify="end" gap={2}>
                      {roles.length === 0 ? <Tag size="sm">None</Tag> : roles.map(r => <Tag key={r} size="sm" variant="subtle">{r}</Tag>)}
                    </Stack>
                  </HStack>
                </Stack>
              </CardBody>
            </Card>
          </VStack>
        </GridItem>
      </Grid>

      {/* MODAL EDITAR */}
      <Modal isOpen={isOpen} onClose={onClose} size="3xl" isCentered scrollBehavior="inside">
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent maxH="90vh">
          <ModalHeader>
            <HStack spacing={3}>
              <Icon as={FiEdit2} color="purple.500" />
              <Box>
                <Text>Edit Profile</Text>
                <Text fontSize="sm" fontWeight="normal" color="gray.600">
                  {email}
                </Text>
              </Box>
            </HStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Tabs index={activeTab} onChange={setActiveTab} colorScheme="purple" variant="enclosed">
              <TabList>
                <Tab>Basic Info</Tab>
                <Tab>Contact & Work</Tab>
                <Tab>Preferences</Tab>
              </TabList>

              <TabPanels>
                {/* Basic Info Tab */}
                <TabPanel>
                  <VStack spacing={6} align="stretch">
                    {/* Avatar Upload */}
                    <FormControl>
                      <FormLabel>Profile Picture</FormLabel>
                      <HStack spacing={4} align="start">
                        <Box position="relative">
                          <Avatar size="2xl" name={formData.name} src={picture} />
                          {avatarPreview && (
                            <Box
                              position="absolute"
                              top={0}
                              left={0}
                              right={0}
                              bottom={0}
                              bg="blackAlpha.700"
                              borderRadius="full"
                              display="flex"
                              alignItems="center"
                              justifyContent="center"
                            >
                              <Text color="white" fontSize="xs">Preview</Text>
                            </Box>
                          )}
                        </Box>
                        <VStack align="stretch" flex="1">
                          <Input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            onChange={handleAvatarChange}
                            display="none"
                            id="avatar-upload"
                          />
                          <Button
                            as="label"
                            htmlFor="avatar-upload"
                            leftIcon={<FiCamera />}
                            size="sm"
                            cursor="pointer"
                          >
                            Choose Photo
                          </Button>
                          {avatarFile && (
                            <HStack>
                              <Text fontSize="sm" color="gray.600">{avatarFile.name}</Text>
                              <Button size="xs" variant="ghost" onClick={() => { setAvatarFile(null); setAvatarPreview(null); }}>
                                Remove
                              </Button>
                            </HStack>
                          )}
                          <FormHelperText>
                            JPG, PNG, WEBP or GIF. Max 5MB.
                          </FormHelperText>
                        </VStack>
                      </HStack>
                    </FormControl>

                    <HStack spacing={4}>
                      <FormControl flex="1">
                        <FormLabel>Display Name</FormLabel>
                        <Input
                          value={formData.name}
                          onChange={(e) => handleChange("name", e.target.value)}
                          placeholder="Your full name"
                        />
                      </FormControl>
                    </HStack>

                    <HStack spacing={4}>
                      <FormControl flex="1">
                        <FormLabel>First Name</FormLabel>
                        <Input
                          value={formData.firstName}
                          onChange={(e) => handleChange("firstName", e.target.value)}
                          placeholder="First name"
                        />
                      </FormControl>

                      <FormControl flex="1">
                        <FormLabel>Last Name</FormLabel>
                        <Input
                          value={formData.lastName}
                          onChange={(e) => handleChange("lastName", e.target.value)}
                          placeholder="Last name"
                        />
                      </FormControl>
                    </HStack>

                    <FormControl>
                      <FormLabel>Bio</FormLabel>
                      <Textarea
                        value={formData.bio}
                        onChange={(e) => handleChange("bio", e.target.value)}
                        placeholder="Short bio or description"
                        maxLength={500}
                        rows={4}
                      />
                      <FormHelperText>{formData.bio.length}/500 characters</FormHelperText>
                    </FormControl>
                  </VStack>
                </TabPanel>

                {/* Contact & Work Tab */}
                <TabPanel>
                  <VStack spacing={6} align="stretch">
                    <Box>
                      <Text fontSize="lg" fontWeight="semibold" mb={4}>Contact Information</Text>
                      <VStack spacing={4}>
                        <FormControl>
                          <FormLabel>Phone</FormLabel>
                          <Input
                            value={formData.phone}
                            onChange={(e) => handleChange("phone", e.target.value)}
                            placeholder="+61 2 1234 5678"
                            type="tel"
                          />
                        </FormControl>

                        <FormControl>
                          <FormLabel>Mobile</FormLabel>
                          <Input
                            value={formData.mobile}
                            onChange={(e) => handleChange("mobile", e.target.value)}
                            placeholder="+61 4XX XXX XXX"
                            type="tel"
                          />
                        </FormControl>

                        <FormControl>
                          <FormLabel>Website</FormLabel>
                          <Input
                            value={formData.website}
                            onChange={(e) => handleChange("website", e.target.value)}
                            placeholder="https://example.com"
                            type="url"
                          />
                        </FormControl>

                        <FormControl>
                          <FormLabel>LinkedIn</FormLabel>
                          <Input
                            value={formData.linkedin}
                            onChange={(e) => handleChange("linkedin", e.target.value)}
                            placeholder="https://linkedin.com/in/username"
                            type="url"
                          />
                        </FormControl>
                      </VStack>
                    </Box>

                    <Divider />

                    <Box>
                      <Text fontSize="lg" fontWeight="semibold" mb={4}>Work Information</Text>
                      <VStack spacing={4}>
                        <FormControl>
                          <FormLabel>Position / Job Title</FormLabel>
                          <Input
                            value={formData.position}
                            onChange={(e) => handleChange("position", e.target.value)}
                            placeholder="e.g., Senior Developer"
                          />
                        </FormControl>

                        <FormControl>
                          <FormLabel>Department</FormLabel>
                          <Input
                            value={formData.department}
                            onChange={(e) => handleChange("department", e.target.value)}
                            placeholder="e.g., Engineering, Sales"
                          />
                        </FormControl>

                        <FormControl>
                          <FormLabel>Location</FormLabel>
                          <Input
                            value={formData.location}
                            onChange={(e) => handleChange("location", e.target.value)}
                            placeholder="e.g., Sydney, NSW"
                          />
                        </FormControl>
                      </VStack>
                    </Box>
                  </VStack>
                </TabPanel>

                {/* Preferences Tab */}
                <TabPanel>
                  <VStack spacing={6} align="stretch">
                    <FormControl>
                      <FormLabel>Timezone</FormLabel>
                      <Select value={formData.timezone} onChange={(e) => handleChange("timezone", e.target.value)}>
                        <option value="Australia/Sydney">Australia/Sydney (AEDT)</option>
                        <option value="Australia/Melbourne">Australia/Melbourne (AEDT)</option>
                        <option value="Australia/Brisbane">Australia/Brisbane (AEST)</option>
                        <option value="Australia/Adelaide">Australia/Adelaide (ACDT)</option>
                        <option value="Australia/Perth">Australia/Perth (AWST)</option>
                        <option value="Pacific/Auckland">Pacific/Auckland (NZDT)</option>
                        <option value="UTC">UTC</option>
                      </Select>
                    </FormControl>

                    <FormControl>
                      <FormLabel>Language</FormLabel>
                      <Select value={formData.language} onChange={(e) => handleChange("language", e.target.value)}>
                        <option value="en">English</option>
                        <option value="es">Español</option>
                        <option value="fr">Français</option>
                        <option value="de">Deutsch</option>
                        <option value="pt">Português</option>
                      </Select>
                    </FormControl>

                    <Divider />

                    <Box>
                      <Text fontSize="lg" fontWeight="semibold" mb={4}>Notification Preferences</Text>
                      <VStack spacing={4} align="stretch">
                        <FormControl display="flex" alignItems="center">
                          <FormLabel mb={0} flex="1">Email Notifications</FormLabel>
                          <Select
                            value={formData.emailNotifications ? "enabled" : "disabled"}
                            onChange={(e) => handleChange("emailNotifications", e.target.value === "enabled")}
                            maxW="150px"
                          >
                            <option value="enabled">Enabled</option>
                            <option value="disabled">Disabled</option>
                          </Select>
                        </FormControl>

                        <FormControl display="flex" alignItems="center">
                          <FormLabel mb={0} flex="1">SMS Notifications</FormLabel>
                          <Select
                            value={formData.smsNotifications ? "enabled" : "disabled"}
                            onChange={(e) => handleChange("smsNotifications", e.target.value === "enabled")}
                            maxW="150px"
                          >
                            <option value="enabled">Enabled</option>
                            <option value="disabled">Disabled</option>
                          </Select>
                        </FormControl>
                      </VStack>
                    </Box>
                  </VStack>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </ModalBody>

          <ModalFooter>
            <HStack>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button
                colorScheme="purple"
                isLoading={uploadAvatarMutation.isPending || updateProfileMutation.isPending}
                onClick={handleSubmit}
              >
                Save Changes
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
