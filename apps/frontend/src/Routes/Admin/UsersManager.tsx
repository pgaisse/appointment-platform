// apps/frontend/src/Routes/Admin/UsersManager.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Box, Heading, Input, Button, HStack, VStack, Text, Table, Thead, Tbody, Tr, Th, Td,
  Avatar, Tag, TagLabel, IconButton, Drawer, DrawerBody, DrawerContent, DrawerHeader,
  DrawerOverlay, DrawerFooter, useDisclosure, CheckboxGroup, Checkbox, SimpleGrid,
  useToast, Select, Tooltip, Divider, Flex, Spinner, Wrap, WrapItem,
} from "@chakra-ui/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings } from "lucide-react";
import { useAdminAuth0Api } from "@/Hooks/useAdminAuth0Api";
import { useAuth0 } from "@auth0/auth0-react";
import axios from "axios";
import ConfirmDialog from "@/Components/Common/ConfirmDialog";

type A0User = { user_id: string; email?: string; name?: string; picture?: string };
type A0Role = { id: string; name: string; description?: string };
type DbUser = { _id: string; auth0_id: string; picture?: string; name?: string; email?: string };

// Read org_id from the ID Token (namespace)
function useOrgId(ns = "https://letsmarter.com/") {
  const { getIdTokenClaims } = useAuth0();
  const [orgId, setOrgId] = useState<string | undefined>();
  useEffect(() => {
    (async () => {
      const c: any = await getIdTokenClaims();
      setOrgId(c?.[ns + "org_id"] ?? c?.org_id ?? undefined);
    })();
  }, [getIdTokenClaims]);
  return orgId;
}

export default function UsersManager() {
  const api = useAdminAuth0Api();
  const qc = useQueryClient();
  const toast = useToast();
  const { user: currentUser } = useAuth0();

  // filters / pagination
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(20);

  // org: default value from the token, editable in UI
  const orgIdFromToken = useOrgId();
  const [orgId, setOrgId] = useState<string>("");
  useEffect(() => {
    if (orgId === "" && orgIdFromToken) setOrgId(orgIdFromToken);
  }, [orgIdFromToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // selection
  const [selectedUser, setSelectedUser] = useState<A0User | null>(null);

  // drawer
  const drawer = useDisclosure();

  // confirmation dialog for critical changes
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => Promise<void>) | null>(null);

  // --- base queries ---
  const usersQ = useQuery({
    queryKey: ["a0-users", q, page, perPage, orgId],
    queryFn: () => api.searchUsers(q, page, perPage, orgId || undefined),
  });

  // Fetch DB users to get avatars with signed URLs
  const { getAccessTokenSilently } = useAuth0();
  const dbUsersQ = useQuery({
    queryKey: ["db-users", q, orgId],
    queryFn: async () => {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });
      const response = await axios.get(`${import.meta.env.VITE_BASE_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { q, org_id: orgId || undefined, limit: 200 },
      });
      return response.data;
    },
  });

  const rolesQ = useQuery({
    queryKey: ["a0-roles"],
    queryFn: () => api.listRoles({ all: true }),
  });

  const userRolesQ = useQuery({
    queryKey: ["a0-user-roles", selectedUser?.user_id, orgId],
    queryFn: () => api.getUserRoles(selectedUser!.user_id, orgId || undefined),
    enabled: !!selectedUser,
  });

  // permissions catalog of YOUR API (AUTH0_AUDIENCE)
  const permsCatalogQ = useQuery({
    queryKey: ["a0-api-permissions"],
    queryFn: () => api.listApiPermissions(),
  });

  // user's direct permissions (only from YOUR API)
  const userDirectPermsQ = useQuery({
    queryKey: ["a0-user-direct-perms", selectedUser?.user_id],
    queryFn: () => api.getUserPermissions(selectedUser!.user_id),
    enabled: !!selectedUser,
  });

  // -------- Permisos por cada ROL del usuario (map roleId -> string[]) ----------
  const rolePermsMapQ = useQuery<{ [roleId: string]: string[] }>({
    queryKey: [
      "a0-user-role-perms-map",
      selectedUser?.user_id,
      (userRolesQ.data?.roles || []).map((r: A0Role) => r.id).sort().join(","),
    ],
    enabled: !!selectedUser && !!userRolesQ.data,
    queryFn: async () => {
      const roles: A0Role[] = userRolesQ.data?.roles ?? [];
      const entries = await Promise.all(
        roles.map(async (r) => {
          const resp: any = await api.getRolePermissions(r.id, true);
          const raw = Array.isArray(resp?.permissions) ? resp.permissions : Array.isArray(resp) ? resp : [];
          const list: string[] = raw
            .map((p: any) => {
              // Extract only the permission name, exactly as it is in Auth0
              const name = typeof p === "string" ? p : (p?.permission_name || p?.name);
              return name || undefined;
            })
            .filter(Boolean) as string[];
          list.sort();
          return [r.id, list] as const;
        })
      );
      return Object.fromEntries(entries);
    },
  });

  // normalize users and meta, merge with DB users for avatars
  const auth0Users: A0User[] = Array.isArray(usersQ.data?.users) ? usersQ.data.users : [];
  const dbUsers: DbUser[] = Array.isArray(dbUsersQ.data?.users) ? dbUsersQ.data.users : [];
  
  // Create a map of auth0_id to DB user for quick lookup
  const dbUserMap = useMemo(() => {
    const map = new Map<string, DbUser>();
    dbUsers.forEach(dbUser => {
      if (dbUser.auth0_id) {
        map.set(dbUser.auth0_id, dbUser);
      }
    });
    return map;
  }, [dbUsers]);

  // Merge Auth0 users with DB users to get avatars with signed URLs
  const users: A0User[] = useMemo(() => {
    return auth0Users.map(a0User => {
      const dbUser = dbUserMap.get(a0User.user_id);
      return {
        ...a0User,
        // Prioritize DB picture (has signed URL) over Auth0 picture
        picture: dbUser?.picture || a0User.picture,
        name: dbUser?.name || a0User.name,
      };
    });
  }, [auth0Users, dbUserMap]);

  const meta =
    usersQ.data && "total" in usersQ.data
      ? usersQ.data
      : { total: Array.isArray(users) ? users.length : 0, start: 0, limit: perPage };

  const total = Number((meta as any).total || (Array.isArray(users) ? users.length : 0));
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const roles: A0Role[] = rolesQ.data?.roles ?? [];
  const userRoles: A0Role[] = userRolesQ.data?.roles ?? [];

  // ---------- ROLES: selection in UI ----------
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  useEffect(() => {
    if (selectedUser && userRoles) {
      setSelectedRoleIds(userRoles.map((r) => r.id));
    }
  }, [selectedUser?.user_id, userRolesQ.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const rolesDiff = useMemo(() => {
    const current = new Set((userRoles || []).map((r) => r.id));
    const next = new Set(selectedRoleIds);
    const toAdd: string[] = [];
    const toRemove: string[] = [];
    roles.forEach((r) => {
      const c = current.has(r.id);
      const n = next.has(r.id);
      if (!c && n) toAdd.push(r.id);
      if (c && !n) toRemove.push(r.id);
    });
    return { toAdd, toRemove };
  }, [selectedRoleIds, userRoles, roles]);

  // ---------- PERMISSIONS: catalog / direct / by role / effective ----------
  const catalogPerms: string[] = useMemo(() => {
    const raw = permsCatalogQ.data?.permissions ?? [];
    return raw
      .map((p: any) => (typeof p === "string" ? p : p?.permission_name || p?.name))
      .filter(Boolean)
      .sort();
  }, [permsCatalogQ.data]);

  const directOriginal = useMemo(() => {
    const directList: string[] = userDirectPermsQ.data?.permissions ?? [];
    return new Set(directList);
  }, [userDirectPermsQ.data]);

  const rolePerms = useMemo(() => {
    const map = rolePermsMapQ.data || {};
    const flat = Object.values(map).flat();
    return new Set(flat);
  }, [rolePermsMapQ.data]);

  // editable state ONLY for direct permissions
  const [selectedDirect, setSelectedDirect] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSelectedDirect(new Set(directOriginal));
  }, [selectedUser?.user_id, directOriginal]); // eslint-disable-line react-hooks/exhaustive-deps

  // diffs for direct permissions (what you will grant/revoke)
  const toGrant = useMemo(
    () => [...selectedDirect].filter((p) => !directOriginal.has(p)),
    [selectedDirect, directOriginal]
  );
  const toRevoke = useMemo(
    () => [...directOriginal].filter((p) => !selectedDirect.has(p)),
    [selectedDirect, directOriginal]
  );

  // ---------- Mutations ----------
  const assignMu = useMutation({
    mutationFn: (vars: { userId: string; roleIds: string[]; orgId?: string }) =>
      api.assignRolesToUser(vars.userId, vars.roleIds, vars.orgId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["a0-user-roles", selectedUser?.user_id, orgId] });
    },
  });

  const removeMu = useMutation({
    mutationFn: (vars: { userId: string; roleIds: string[]; orgId?: string }) =>
      api.removeRolesFromUser(vars.userId, vars.roleIds, vars.orgId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["a0-user-roles", selectedUser?.user_id, orgId] });
    },
  });

  const grantPermsMu = useMutation({
    mutationFn: (vars: { userId: string; permissions: string[] }) =>
      api.grantPermissionsToUser(vars.userId, vars.permissions),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["a0-user-direct-perms", selectedUser?.user_id] });
    },
  });

  const revokePermsMu = useMutation({
    mutationFn: (vars: { userId: string; permissions: string[] }) =>
      api.revokePermissionsFromUser(vars.userId, vars.permissions),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["a0-user-direct-perms", selectedUser?.user_id] });
    },
  });

  // When the drawer opens, refresh data
  useEffect(() => {
    if (drawer.isOpen && selectedUser) {
      userRolesQ.refetch();
      userDirectPermsQ.refetch();
      permsCatalogQ.refetch();
      rolePermsMapQ.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawer.isOpen]);

  const saving =
    assignMu.isPending || removeMu.isPending || grantPermsMu.isPending || revokePermsMu.isPending;

  return (
    <Box p={6}>
      <Heading size="lg" mb={2}>User Management (Auth0)</Heading>
      <Text color="gray.500" mb={6}>
        Assign or remove <b>roles</b> and <b>direct permissions</b>. Permissions provided via roles are shown checked and locked.
      </Text>

      {/* filters / pagination */}
      <HStack spacing={3} mb={4} align="center">
        <Input
          placeholder="Search by email, name... (empty = all)"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(0); }}
          maxW="lg"
        />
        <Button onClick={() => usersQ.refetch()} isLoading={usersQ.isFetching}>
          Search
        </Button>
        <Select
          value={perPage}
          onChange={(e) => { setPerPage(Number(e.target.value)); setPage(0); }}
          maxW="24"
        >
          {[10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>{n} / page</option>
          ))}
        </Select>

        {/* Organization filter */}
        <Input
          placeholder="org_id (filter organization members)"
          value={orgId}
          onChange={(e) => { setOrgId(e.target.value); setPage(0); }}
          maxW="xs"
        />

        <HStack>
          <Button onClick={() => setPage((p) => Math.max(0, p - 1))} isDisabled={page <= 0}>Prev</Button>
          <Text>page {page + 1} / {totalPages}</Text>
          <Button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} isDisabled={page >= totalPages - 1}>Next</Button>
        </HStack>
      </HStack>

      {/* table */}
      <Table size="sm" variant="simple">
        <Thead>
          <Tr>
            <Th>User</Th>
            <Th>Email</Th>
            <Th>Auth0 ID</Th>
            <Th>Roles</Th>
            <Th isNumeric>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {(users || []).map((u) => (
            <Tr key={u.user_id}>
              <Td>
                <HStack>
                  <Avatar size="sm" name={u.name || u.email} src={u.picture} />
                  <Text>{u.name || "–"}</Text>
                </HStack>
              </Td>
              <Td>{u.email || "–"}</Td>
              <Td>
                <Text fontSize="xs" color="gray.600">{u.user_id}</Text>
              </Td>
              <Td>
                <UserRolesTags userId={u.user_id} orgId={orgId || undefined} />
              </Td>
              <Td isNumeric>
                <IconButton
                  aria-label="Manage"
                  icon={<Settings size={16} />}
                  size="sm"
                  onClick={() => { setSelectedUser(u); drawer.onOpen(); }}
                />
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      {/* Management drawer */}
      <Drawer isOpen={drawer.isOpen} onClose={drawer.onClose} size="lg">
        <DrawerOverlay />
        <DrawerContent>
          <DrawerHeader>Manage user</DrawerHeader>
          <DrawerBody>
            {!selectedUser ? (
              <Text>Select a user…</Text>
            ) : (
              <VStack align="stretch" spacing={6}>
                <Box>
                  <Text fontWeight="bold">{selectedUser.name || selectedUser.email}</Text>
                  <Text fontSize="sm" color="gray.500">{selectedUser.user_id}</Text>
                </Box>

                {/* ROLES selection */}
                <Box>
                  <Flex justify="space-between" align="center" mb={2}>
                    <Text fontWeight="bold">Roles {orgId ? `(org: ${orgId})` : "(tenant-wide)"}</Text>
                    {(rolesQ.isFetching || userRolesQ.isFetching) && <Spinner size="sm" />}
                  </Flex>
                  <CheckboxGroup value={selectedRoleIds} onChange={(v) => setSelectedRoleIds(v as string[])}>
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={2}>
                      {roles.map((r) => (
                        <Checkbox key={r.id} value={r.id}>{r.name}</Checkbox>
                      ))}
                    </SimpleGrid>
                  </CheckboxGroup>
                  <Text fontSize="sm" color="gray.600" mt={2}>
                    Role changes: <b>+{rolesDiff.toAdd.length}</b> / <b>-{rolesDiff.toRemove.length}</b>
                  </Text>
                </Box>

                {/* Permisos por rol (usuario seleccionado) */}
                <Box>
                  <Flex justify="space-between" align="center" mb={2}>
                    <Text fontWeight="bold">Role permissions (selected user)</Text>
                    {rolePermsMapQ.isFetching && <Spinner size="sm" />}
                  </Flex>

                  {userRoles.length === 0 ? (
                    <Text color="gray.500">This user has no roles.</Text>
                  ) : rolePermsMapQ.isLoading ? (
                    <Text color="gray.500">loading role permissions…</Text>
                  ) : (
                    <VStack align="stretch" spacing={3}>
                      {userRoles.map((r) => {
                        const perms = rolePermsMapQ.data?.[r.id] ?? [];
                        return (
                          <Box key={r.id} borderWidth="1px" borderColor="gray.200" rounded="md" p={3}>
                            <HStack justify="space-between" align="center" mb={2}>
                              <Text fontWeight="semibold">{r.name}</Text>
                              <Tag size="sm" colorScheme="purple"><TagLabel>{perms.length}</TagLabel></Tag>
                            </HStack>
                            {perms.length === 0 ? (
                              <Text color="gray.500">No permissions returned by API for this role.</Text>
                            ) : (
                              <Wrap spacing={2}>
                                {perms.map((p) => (
                                  <WrapItem key={p}>
                                    <Tag size="sm" variant="subtle" colorScheme="purple">
                                      <TagLabel>{p}</TagLabel>
                                    </Tag>
                                  </WrapItem>
                                ))}
                              </Wrap>
                            )}
                          </Box>
                        );
                      })}
                    </VStack>
                  )}
                </Box>

                <Divider />

                {/* PERMISSIONS selection */}
 
              </VStack>
            )}
          </DrawerBody>

          <DrawerFooter>
            <HStack>
              <Button variant="outline" onClick={drawer.onClose}>Close</Button>
              <Button
                colorScheme="blue"
                isLoading={saving}
                onClick={async () => {
                  if (!selectedUser) return;

                  // CRITICAL: Prevent admin from removing their own admin role
                  if (selectedUser.user_id === currentUser?.sub) {
                    const hasAdminRole = selectedRoleIds.some((roleId) => {
                      const role = roles.find((r) => r.id === roleId);
                      return role?.name?.toLowerCase() === "admin";
                    });
                    if (!hasAdminRole) {
                      toast({
                        title: "Cannot Remove Admin Role",
                        description: "You cannot remove your own admin role. Another admin must do this.",
                        status: "error",
                        duration: 5000,
                      });
                      return;
                    }
                  }

                  // Check if there are critical changes (roles or permissions)
                  const hasCriticalChanges = 
                    rolesDiff.toAdd.length > 0 || 
                    rolesDiff.toRemove.length > 0 || 
                    toGrant.length > 0 || 
                    toRevoke.length > 0;

                  if (!hasCriticalChanges) {
                    toast({ title: "No changes to save", status: "info" });
                    return;
                  }

                  // Define the action to execute after confirmation
                  const executeChanges = async () => {
                    try {
                      // 1) Roles: remove first, then add
                      if (rolesDiff.toRemove.length) {
                        await removeMu.mutateAsync({
                          userId: selectedUser.user_id,
                          roleIds: rolesDiff.toRemove,
                          orgId: orgId || undefined,
                        });
                      }
                      if (rolesDiff.toAdd.length) {
                        await assignMu.mutateAsync({
                          userId: selectedUser.user_id,
                          roleIds: rolesDiff.toAdd,
                          orgId: orgId || undefined,
                        });
                      }

                      // 2) Direct permissions
                      if (toGrant.length) {
                        await grantPermsMu.mutateAsync({
                          userId: selectedUser.user_id,
                          permissions: toGrant,
                        });
                      }
                      if (toRevoke.length) {
                        await revokePermsMu.mutateAsync({
                          userId: selectedUser.user_id,
                          permissions: toRevoke,
                        });
                      }

                      await Promise.all([
                        userRolesQ.refetch(),
                        userDirectPermsQ.refetch(),
                        rolePermsMapQ.refetch(),
                      ]);

                      toast({ title: "Roles and permissions updated", status: "success" });
                      setConfirmOpen(false);
                      setConfirmAction(null);
                    } catch (e: any) {
                      toast({ title: "Error saving changes", description: e?.message, status: "error" });
                      setConfirmOpen(false);
                      setConfirmAction(null);
                    }
                  };

                  // Show confirmation dialog for critical changes
                  setConfirmAction(() => executeChanges);
                  setConfirmOpen(true);
                }}
              >
                Save changes
              </Button>
            </HStack>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Confirmation Dialog for Critical Changes */}
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setConfirmAction(null);
        }}
        onConfirm={async () => {
          if (confirmAction) {
            await confirmAction();
          }
        }}
        title="Confirm Role & Permission Changes"
        message={
          selectedUser
            ? `You are about to change roles and permissions for ${selectedUser.name || selectedUser.email}. This will affect what this user can access.\n\n` +
              `Roles to add: ${rolesDiff.toAdd.length}\n` +
              `Roles to remove: ${rolesDiff.toRemove.length}\n` +
              `Permissions to grant: ${toGrant.length}\n` +
              `Permissions to revoke: ${toRevoke.length}\n\n` +
              `Are you sure you want to continue?`
            : "Are you sure you want to continue?"
        }
        confirmText="Yes, Update"
        confirmColorScheme="blue"
        isLoading={saving}
      />
    </Box>
  );
}

function UserRolesTags({ userId, orgId }: { userId: string; orgId?: string }) {
  const api = useAdminAuth0Api();
  const q = useQuery({
    queryKey: ["a0-user-roles", userId, orgId],
    queryFn: () => api.getUserRoles(userId, orgId),
  });
  const roles: A0Role[] = q.data?.roles ?? [];
  if (q.isLoading) return <Text color="gray.500">loading…</Text>;
  if ((roles || []).length === 0) return <Text color="gray.400">—</Text>;
  return (
    <HStack wrap="wrap" spacing={1}>
      {roles.map((r) => (
        <Tag key={r.id} size="sm" colorScheme="blue">
          <TagLabel>{r.name}</TagLabel>
        </Tag>
      ))}
    </HStack>
  );
}
