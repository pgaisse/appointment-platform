// Components/admin/UserManager.tsx
import {
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  Spinner,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
  useDisclosure,
  useToast,
  Badge,
  Avatar,
  Tooltip,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  FormControl,
  FormLabel,
  FormHelperText,
  VStack,
  Divider,
  Tag,
  TagLabel,
  Wrap,
  WrapItem,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Center,
  Image,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  FiSearch,
  FiEdit2,
  FiMoreVertical,
  FiShield,
  FiUser,
  FiMail,
  FiClock,
  FiAlertCircle,
  FiCheckCircle,
  FiLock,
  FiUnlock,
  FiCamera,
  FiUpload,
} from "react-icons/fi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth0 } from "@auth0/auth0-react";
import { validateEmail, validatePhone, debounce } from "@/utils/validation";

const MotionBox = motion(Box);

interface User {
  _id: string;
  auth0_id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
  org_id?: string;
  orgs?: string[];
  roles?: string[];
  permissions?: string[];
  status: "active" | "blocked";
  
  // Additional information
  firstName?: string;
  lastName?: string;
  phone?: string;
  mobile?: string;
  position?: string;
  department?: string;
  location?: string;
  timezone?: string;
  language?: string;
  bio?: string;
  website?: string;
  linkedin?: string;
  emailNotifications?: boolean;
  smsNotifications?: boolean;
  
  lastLoginAt?: string;
  lastAccessAt?: string;
  loginCount?: number;
  createdAt: string;
  updatedAt: string;
}

const AUDIENCE = (window as any).__ENV__?.AUTH0_AUDIENCE ?? import.meta.env.VITE_AUTH0_AUDIENCE;

export default function UserManager() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "blocked">("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { getAccessTokenSilently } = useAuth0();

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const hoverBg = useColorModeValue("gray.50", "gray.700");

  // Debounced search
  const debouncedSetSearchTerm = useMemo(() => debounce(setSearchTerm, 300), []);

  // Fetch users
  const { data, isLoading, error } = useQuery({
    queryKey: ["users", searchTerm, statusFilter],
    queryFn: async () => {
      const token = await getAccessTokenSilently({
        authorizationParams: AUDIENCE ? { audience: AUDIENCE } : undefined,
      });

      const params = new URLSearchParams();
      if (searchTerm) params.set("q", searchTerm);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/users?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to fetch users");
      const json = await res.json();
      return json.users as User[];
    },
    staleTime: 30000,
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (payload: { id: string; updates: Partial<User> }) => {
      const token = await getAccessTokenSilently({
        authorizationParams: AUDIENCE ? { audience: AUDIENCE } : undefined,
      });

      const res = await fetch(`/api/users/${payload.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload.updates),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update user");
      }

      return res.json();
    },
    onSuccess: () => {
      // Invalidate all user-related queries to update UI everywhere
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["db-users"] });
      queryClient.invalidateQueries({ queryKey: ["profile-me"] });
      queryClient.invalidateQueries({ queryKey: ["a0-users"] });
      queryClient.invalidateQueries({ queryKey: ["auth0-users"] });
      queryClient.invalidateQueries({ queryKey: ["systemUsers"] });
      
      toast({
        title: "User updated",
        description: "The user has been updated successfully.",
        status: "success",
        duration: 3000,
      });
      onClose();
      setSelectedUser(null);
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

  // Block/Unblock user mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async (user: User) => {
      const token = await getAccessTokenSilently({
        authorizationParams: AUDIENCE ? { audience: AUDIENCE } : undefined,
      });

      const newStatus = user.status === "active" ? "blocked" : "active";

      const res = await fetch(`/api/users/${user._id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error("Failed to update user status");
      return res.json();
    },
    onSuccess: (_, user) => {
      // Invalidate all user-related queries to update UI everywhere
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["db-users"] });
      queryClient.invalidateQueries({ queryKey: ["profile-me"] });
      queryClient.invalidateQueries({ queryKey: ["a0-users"] });
      queryClient.invalidateQueries({ queryKey: ["auth0-users"] });
      queryClient.invalidateQueries({ queryKey: ["systemUsers"] });
      
      toast({
        title: user.status === "active" ? "User blocked" : "User activated",
        status: "success",
        duration: 3000,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Action failed",
        description: error.message,
        status: "error",
        duration: 5000,
      });
    },
  });

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    onOpen();
  };

  const filteredUsers = useMemo(() => {
    if (!data) return [];
    return data;
  }, [data]);

  const getStatusColor = (status: string) => {
    return status === "active" ? "green" : "red";
  };

  const formatDate = (date?: string) => {
    if (!date) return "Never";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Stack spacing={6}>
      {/* Header */}
      <Flex justify="space-between" align="center" wrap="wrap" gap={4}>
        <Box>
          <Text fontSize="2xl" fontWeight="bold">
            User Management
          </Text>
          <Text color="gray.600" fontSize="sm">
            Manage system users and their permissions
          </Text>
        </Box>
      </Flex>

      {/* Filters */}
      <HStack spacing={4} wrap="wrap">
        <InputGroup maxW="400px">
          <InputLeftElement pointerEvents="none">
            <Icon as={FiSearch} color="gray.400" />
          </InputLeftElement>
          <Input
            placeholder="Search by name, email or Auth0 ID..."
            onChange={(e) => debouncedSetSearchTerm(e.target.value)}
            bg={bgColor}
            borderColor={borderColor}
          />
        </InputGroup>

        <Select
          maxW="200px"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          bg={bgColor}
          borderColor={borderColor}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="blocked">Blocked</option>
        </Select>
      </HStack>

      {/* Table */}
      <Box
        bg={bgColor}
        borderRadius="xl"
        borderWidth="1px"
        borderColor={borderColor}
        overflow="hidden"
        shadow="sm"
      >
        {isLoading ? (
          <Flex justify="center" align="center" py={20}>
            <Spinner size="xl" color="blue.500" thickness="4px" />
          </Flex>
        ) : error ? (
          <Flex justify="center" align="center" py={20}>
            <VStack spacing={4}>
              <Icon as={FiAlertCircle} boxSize={12} color="red.500" />
              <Text color="red.500">Failed to load users</Text>
            </VStack>
          </Flex>
        ) : filteredUsers.length === 0 ? (
          <Flex justify="center" align="center" py={20}>
            <VStack spacing={4}>
              <Icon as={FiUser} boxSize={12} color="gray.400" />
              <Text color="gray.500">No users found</Text>
            </VStack>
          </Flex>
        ) : (
          <Box overflowX="auto">
            <Table variant="simple">
              <Thead bg={useColorModeValue("gray.50", "gray.900")}>
                <Tr>
                  <Th>User</Th>
                  <Th>Status</Th>
                  <Th>Organization</Th>
                  <Th>Last Login</Th>
                  <Th>Login Count</Th>
                  <Th>Roles</Th>
                  <Th textAlign="right">Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredUsers.map((user) => (
                  <MotionBox
                    as={Tr}
                    key={user._id}
                    whileHover={{ backgroundColor: hoverBg }}
                    transition={{ duration: 0.2 }}
                    cursor="pointer"
                  >
                    <Td>
                      <HStack spacing={3}>
                        <Avatar
                          size="sm"
                          name={user.name || user.email}
                          src={user.picture}
                        />
                        <Box>
                          <Text fontWeight="medium" noOfLines={1}>
                            {user.name || "No name"}
                          </Text>
                          <HStack spacing={2}>
                            <Icon as={FiMail} boxSize={3} color="gray.500" />
                            <Text fontSize="xs" color="gray.500" noOfLines={1}>
                              {user.email}
                            </Text>
                            {user.emailVerified && (
                              <Icon as={FiCheckCircle} boxSize={3} color="green.500" />
                            )}
                          </HStack>
                        </Box>
                      </HStack>
                    </Td>
                    <Td>
                      <Badge colorScheme={getStatusColor(user.status)} fontSize="xs" px={2} py={1}>
                        {user.status}
                      </Badge>
                    </Td>
                    <Td>
                      <Text fontSize="sm" color="gray.600">
                        {user.org_id || "—"}
                      </Text>
                    </Td>
                    <Td>
                      <HStack spacing={2}>
                        <Icon as={FiClock} boxSize={3} color="gray.500" />
                        <Text fontSize="sm" color="gray.600">
                          {formatDate(user.lastLoginAt)}
                        </Text>
                      </HStack>
                    </Td>
                    <Td>
                      <Text fontSize="sm" fontWeight="medium">
                        {user.loginCount || 0}
                      </Text>
                    </Td>
                    <Td>
                      <Wrap spacing={1}>
                        {user.roles && user.roles.length > 0 ? (
                          user.roles.slice(0, 2).map((role, idx) => (
                            <WrapItem key={idx}>
                              <Tag size="sm" colorScheme="purple" variant="subtle">
                                <TagLabel>{role}</TagLabel>
                              </Tag>
                            </WrapItem>
                          ))
                        ) : (
                          <Text fontSize="xs" color="gray.400">
                            No roles
                          </Text>
                        )}
                        {user.roles && user.roles.length > 2 && (
                          <Tag size="sm" colorScheme="gray" variant="subtle">
                            <TagLabel>+{user.roles.length - 2}</TagLabel>
                          </Tag>
                        )}
                      </Wrap>
                    </Td>
                    <Td textAlign="right">
                      <Menu>
                        <MenuButton
                          as={IconButton}
                          icon={<FiMoreVertical />}
                          variant="ghost"
                          size="sm"
                        />
                        <MenuList>
                          <MenuItem icon={<FiEdit2 />} onClick={() => handleEditUser(user)}>
                            Edit User
                          </MenuItem>
                          <MenuItem
                            icon={user.status === "active" ? <FiLock /> : <FiUnlock />}
                            onClick={() => toggleStatusMutation.mutate(user)}
                            color={user.status === "active" ? "red.500" : "green.500"}
                          >
                            {user.status === "active" ? "Block User" : "Activate User"}
                          </MenuItem>
                        </MenuList>
                      </Menu>
                    </Td>
                  </MotionBox>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
      </Box>

      {/* Edit User Modal */}
      <EditUserModal
        isOpen={isOpen}
        onClose={() => {
          onClose();
          setSelectedUser(null);
        }}
        user={selectedUser}
        onSave={(updates) => {
          if (selectedUser) {
            updateUserMutation.mutate({ id: selectedUser._id, updates });
          }
        }}
        isLoading={updateUserMutation.isPending}
      />
    </Stack>
  );
}

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onSave: (updates: Partial<User>) => void;
  isLoading: boolean;
}

function EditUserModal({ isOpen, onClose, user, onSave, isLoading }: EditUserModalProps) {
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
    status: "active" as "active" | "blocked",
    emailNotifications: true,
    smsNotifications: false,
  });

  const [activeTab, setActiveTab] = useState(0);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const queryClient = useQueryClient();
  const { getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    if (user && isOpen) {
      setFormData({
        name: user.name || "",
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        phone: user.phone || "",
        mobile: user.mobile || "",
        position: user.position || "",
        department: user.department || "",
        location: user.location || "",
        timezone: user.timezone || "Australia/Sydney",
        language: user.language || "en",
        bio: user.bio || "",
        website: user.website || "",
        linkedin: user.linkedin || "",
        status: user.status,
        emailNotifications: user.emailNotifications ?? true,
        smsNotifications: user.smsNotifications ?? false,
      });
      setAvatarPreview(null);
      setAvatarFile(null);
    }
  }, [user, isOpen]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        status: "error",
        duration: 3000,
      });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 5MB",
        status: "error",
        duration: 3000,
      });
      return;
    }

    setAvatarFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadAvatarMutation = useMutation({
    mutationFn: async () => {
      if (!avatarFile || !user) throw new Error("No file selected");

      const token = await getAccessTokenSilently({
        authorizationParams: AUDIENCE ? { audience: AUDIENCE } : undefined,
      });

      const formData = new FormData();
      formData.append("avatar", avatarFile);

      const res = await fetch(`/api/users/${user._id}/avatar`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to upload avatar");
      }

      const data = await res.json();
      return data;
    },
    onSuccess: (data) => {
      // Invalidate all user-related queries to update UI everywhere
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["db-users"] });
      queryClient.invalidateQueries({ queryKey: ["profile-me"] });
      queryClient.invalidateQueries({ queryKey: ["a0-users"] });
      queryClient.invalidateQueries({ queryKey: ["auth0-users"] });
      queryClient.invalidateQueries({ queryKey: ["systemUsers"] });
      
      toast({
        title: "Avatar uploaded",
        description: "The user avatar has been uploaded successfully.",
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

  const handleSubmit = async () => {
    // Validate email if changed
    if (formData.email && formData.email !== user.email) {
      const emailValidation = validateEmail(formData.email);
      if (!emailValidation.isValid) {
        toast({
          title: "Invalid email",
          description: emailValidation.error,
          status: "error",
          duration: 3000,
        });
        return;
      }
    }

    // Validate phone if provided
    if (formData.phone) {
      const phoneValidation = validatePhone(formData.phone);
      if (!phoneValidation.isValid) {
        toast({
          title: "Invalid phone",
          description: phoneValidation.error,
          status: "error",
          duration: 3000,
        });
        return;
      }
    }

    // Validate mobile if provided
    if (formData.mobile) {
      const mobileValidation = validatePhone(formData.mobile);
      if (!mobileValidation.isValid) {
        toast({
          title: "Invalid mobile",
          description: mobileValidation.error,
          status: "error",
          duration: 3000,
        });
        return;
      }
    }

    let avatarUploaded = false;
    
    // Upload avatar first if there's a new one
    if (avatarFile) {
      try {
        await uploadAvatarMutation.mutateAsync();
        avatarUploaded = true;
      } catch (error) {
        // Error already handled by mutation
        return;
      }
    }

    const updates: Partial<User> = {};
    
    // Compare all fields EXCEPT picture (avatar is uploaded separately)
    Object.keys(formData).forEach((key) => {
      // Skip 'picture' field - it's managed by the avatar upload endpoint
      if (key === 'picture') return;
      
      const typedKey = key as keyof typeof formData;
      if (formData[typedKey] !== (user as any)?.[key]) {
        (updates as any)[key] = formData[typedKey];
      }
    });

    if (Object.keys(updates).length > 0) {
      onSave(updates);
    } else if (!avatarUploaded) {
      onClose();
    } else {
      // Avatar was uploaded but no other changes
      onClose();
    }
  };

  // Don't render modal content if no user is selected
  if (!user) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl" isCentered scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent maxH="90vh">
        <ModalHeader>
          <HStack spacing={3}>
            <Icon as={FiEdit2} color="blue.500" />
            <Box>
              <Text>Edit User</Text>
              <Text fontSize="sm" fontWeight="normal" color="gray.600">
                {user.email}
              </Text>
            </Box>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Tabs index={activeTab} onChange={setActiveTab} colorScheme="blue" variant="enclosed">
            <TabList>
              <Tab>Basic Info</Tab>
              <Tab>Contact & Work</Tab>
              <Tab>Preferences</Tab>
              <Tab>System Info</Tab>
            </TabList>

            <TabPanels>
              {/* Basic Info Tab */}
              <TabPanel>
                <VStack spacing={6} align="stretch">
                  {/* Avatar Upload Section */}
                  <Box>
                    <FormLabel>Profile Picture</FormLabel>
                    <Flex align="center" gap={6}>
                      <Box position="relative">
                        <Avatar
                          size="2xl"
                          name={user.name || user.email}
                          src={avatarPreview || user.picture}
                        />
                        <IconButton
                          aria-label="Upload avatar"
                          icon={<FiCamera />}
                          size="sm"
                          colorScheme="blue"
                          rounded="full"
                          position="absolute"
                          bottom={0}
                          right={0}
                          onClick={() => fileInputRef.current?.click()}
                        />
                        <Input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          display="none"
                          onChange={handleAvatarChange}
                        />
                      </Box>
                      <VStack align="stretch" flex="1" spacing={2}>
                        <Text fontSize="sm" color="gray.600">
                          Click the camera icon to upload a new profile picture
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          Recommended: Square image, at least 200x200px
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          Max file size: 5MB (JPG, PNG, WebP, GIF)
                        </Text>
                        {avatarPreview && (
                          <HStack>
                            <Badge colorScheme="green" fontSize="xs">
                              New image selected - click Save to upload
                            </Badge>
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => {
                                setAvatarPreview(null);
                                setAvatarFile(null);
                              }}
                            >
                              Cancel
                            </Button>
                          </HStack>
                        )}
                      </VStack>
                    </Flex>
                  </Box>

                  <Divider />

                  {/* Read-only Auth0 Info */}
                  <Box p={4} bg="gray.50" borderRadius="md">
                    <VStack align="stretch" spacing={2}>
                      <HStack>
                        <Icon as={FiShield} color="gray.600" />
                        <Text fontSize="sm" fontWeight="semibold" color="gray.700">
                          Auth0 Information (Read-only)
                        </Text>
                      </HStack>
                      <Divider />
                      <HStack justify="space-between">
                        <Text fontSize="sm" color="gray.600">Auth0 ID:</Text>
                        <Text fontSize="sm" fontFamily="mono" color="gray.800">{user.auth0_id}</Text>
                      </HStack>
                      <HStack justify="space-between">
                        <Text fontSize="sm" color="gray.600">Email:</Text>
                        <HStack>
                          <Text fontSize="sm" color="gray.800">{user.email}</Text>
                          {user.emailVerified && <Icon as={FiCheckCircle} color="green.500" boxSize={4} />}
                        </HStack>
                      </HStack>
                      <HStack justify="space-between">
                        <Text fontSize="sm" color="gray.600">Organization:</Text>
                        <Text fontSize="sm" color="gray.800">{user.org_id || "—"}</Text>
                      </HStack>
                    </VStack>
                  </Box>

                  <FormControl>
                    <FormLabel>Display Name</FormLabel>
                    <Input
                      value={formData.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      placeholder="Full display name"
                    />
                    <FormHelperText>This name will be displayed across the system.</FormHelperText>
                  </FormControl>

                  <HStack spacing={4}>
                    <FormControl>
                      <FormLabel>First Name</FormLabel>
                      <Input
                        value={formData.firstName}
                        onChange={(e) => handleChange("firstName", e.target.value)}
                        placeholder="First name"
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel>Last Name</FormLabel>
                      <Input
                        value={formData.lastName}
                        onChange={(e) => handleChange("lastName", e.target.value)}
                        placeholder="Last name"
                      />
                    </FormControl>
                  </HStack>

                  <FormControl>
                    <FormLabel>Status</FormLabel>
                    <Select value={formData.status} onChange={(e) => handleChange("status", e.target.value)}>
                      <option value="active">Active</option>
                      <option value="blocked">Blocked</option>
                    </Select>
                    <FormHelperText>Blocked users cannot access the system.</FormHelperText>
                  </FormControl>

                  <FormControl>
                    <FormLabel>Bio</FormLabel>
                    <Input
                      value={formData.bio}
                      onChange={(e) => handleChange("bio", e.target.value)}
                      placeholder="Short bio or description"
                      maxLength={500}
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

              {/* System Info Tab */}
              <TabPanel>
                <VStack spacing={6} align="stretch">
                  {/* User Stats */}
                  <Box p={4} bg="blue.50" borderRadius="md">
                    <VStack align="stretch" spacing={2}>
                      <Text fontSize="sm" fontWeight="semibold" color="blue.700">
                        User Statistics
                      </Text>
                      <Divider borderColor="blue.200" />
                      <HStack justify="space-between">
                        <Text fontSize="sm" color="blue.700">Login Count:</Text>
                        <Badge colorScheme="blue">{user.loginCount || 0}</Badge>
                      </HStack>
                      <HStack justify="space-between">
                        <Text fontSize="sm" color="blue.700">Last Login:</Text>
                        <Text fontSize="sm" color="blue.800">
                          {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}
                        </Text>
                      </HStack>
                      <HStack justify="space-between">
                        <Text fontSize="sm" color="blue.700">Created:</Text>
                        <Text fontSize="sm" color="blue.800">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </Text>
                      </HStack>
                      <HStack justify="space-between">
                        <Text fontSize="sm" color="blue.700">Last Updated:</Text>
                        <Text fontSize="sm" color="blue.800">
                          {new Date(user.updatedAt).toLocaleDateString()}
                        </Text>
                      </HStack>
                    </VStack>
                  </Box>

                  {/* Roles & Permissions */}
                  {(user.roles?.length || user.permissions?.length) && (
                    <Box p={4} bg="purple.50" borderRadius="md">
                      <VStack align="stretch" spacing={3}>
                        <Text fontSize="sm" fontWeight="semibold" color="purple.700">
                          Roles & Permissions (Managed by Auth0)
                        </Text>
                        <Divider borderColor="purple.200" />
                        {user.roles && user.roles.length > 0 && (
                          <Box>
                            <Text fontSize="xs" color="purple.600" mb={2}>Roles:</Text>
                            <Wrap spacing={2}>
                              {user.roles.map((role, idx) => (
                                <Tag key={idx} size="sm" colorScheme="purple">{role}</Tag>
                              ))}
                            </Wrap>
                          </Box>
                        )}
                        {user.permissions && user.permissions.length > 0 && (
                          <Box>
                            <Text fontSize="xs" color="purple.600" mb={2}>
                              Permissions ({user.permissions.length}):
                            </Text>
                            <Wrap spacing={1} maxH="200px" overflowY="auto">
                              {user.permissions.map((perm, idx) => (
                                <Tag key={idx} size="xs" colorScheme="purple" variant="outline">{perm}</Tag>
                              ))}
                            </Wrap>
                          </Box>
                        )}
                      </VStack>
                    </Box>
                  )}
                </VStack>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </ModalBody>
        <ModalFooter>
          <Button 
            variant="ghost" 
            mr={3} 
            onClick={onClose} 
            isDisabled={isLoading || uploadAvatarMutation.isPending}
          >
            Cancel
          </Button>
          <Button 
            colorScheme="blue" 
            onClick={handleSubmit} 
            isLoading={isLoading || uploadAvatarMutation.isPending}
          >
            Save Changes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
