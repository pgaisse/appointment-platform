import { useEffect, useMemo, useState } from "react";
import {
  Box, Heading, Input, Button, HStack, VStack, Text, Table, Thead, Tbody, Tr, Th, Td,
  Avatar, Tag, TagLabel, IconButton, Drawer, DrawerBody, DrawerContent, DrawerHeader,
  DrawerOverlay, DrawerFooter, useDisclosure, CheckboxGroup, Checkbox, SimpleGrid,
  useToast, Select, Tooltip, Divider, Flex, Spinner,
} from "@chakra-ui/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings } from "lucide-react";
import { useAdminAuth0Api } from "@/Hooks/useAdminAuth0Api";
import { useAuth0 } from "@auth0/auth0-react";

type A0User = { user_id: string; email?: string; name?: string; picture?: string };
type A0Role = { id: string; name: string; description?: string };

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

  // filters / pagination
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(20);

  // org: default value from the token, editable in UI
  const orgIdFromToken = useOrgId();
  const [orgId, setOrgId] = useState<string>(""); // keep string for <Input/>
  useEffect(() => {
    if (orgId === "" && orgIdFromToken) setOrgId(orgIdFromToken);
  }, [orgIdFromToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // selection
  const [selectedUser, setSelectedUser] = useState<A0User | null>(null);

  // drawer
  const drawer = useDisclosure();

  // --- base queries ---
  const usersQ = useQuery({
    queryKey: ["a0-users", q, page, perPage, orgId],
    queryFn: () => api.searchUsers(q, page, perPage, orgId || undefined),
  });

  const rolesQ = useQuery({
    queryKey: ["a0-roles"],
    queryFn: () => api.listRoles(),
  });

  const userRolesQ = useQuery({
    queryKey: ["a0-user-roles", selectedUser?.user_id, orgId],
    queryFn: () => api.getUserRoles(selectedUser!.user_id, orgId || undefined),
    enabled: !!selectedUser, // if you want to require org, use: && !!orgId
  });

  // permissions catalog of YOUR API (AUTH0_AUDIENCE)
  const permsCatalogQ = useQuery({
    queryKey: ["a0-api-permissions"],
    queryFn: () => api.listApiPermissions(), // GET /api/admin/auth0/permissions
  });

  // user's direct permissions (only from YOUR API)
  const userDirectPermsQ = useQuery({
    queryKey: ["a0-user-direct-perms", selectedUser?.user_id],
    queryFn: () => api.getUserPermissions(selectedUser!.user_id), // ← use the correct hook name
    enabled: !!selectedUser,
  });

  // permissions provided by EACH user role (all are added)
  const rolePermsQ = useQuery({
    queryKey: [
      "a0-user-role-perms",
      selectedUser?.user_id,
      (userRolesQ.data?.roles || []).map((r: A0Role) => r.id).sort().join(","),
    ],
    enabled: !!selectedUser && !!userRolesQ.data,
    queryFn: async () => {
      const roles: A0Role[] = userRolesQ.data?.roles ?? [];
      const arr = await Promise.all(
        roles.map(async (r) => {
          // Make sure you have api.getRolePermissions in your hook
          const data = await api.getRolePermissions(r.id); // GET /roles/:id/permissions
          const list: string[] = (data?.permissions || data || [])
            .map((p: any) => p?.permission_name || p?.name)
            .filter(Boolean);
          return list;
        })
      );
      return Array.from(new Set(arr.flat()));
    },
  });

  // normalize users and meta
  const users: A0User[] = Array.isArray(usersQ.data?.users) ? usersQ.data.users : [];
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
    const list: string[] = rolePermsQ.data ?? [];
    return new Set(list);
  }, [rolePermsQ.data]);


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
      rolePermsQ.refetch();
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

                <Divider />

                {/* PERMISSIONS selection */}
                <Box>
                  <Flex justify="space-between" align="center" mb={2}>
                    <Text fontWeight="bold">Permissions (your API)</Text>
                    {(permsCatalogQ.isFetching || userDirectPermsQ.isFetching || rolePermsQ.isFetching) && <Spinner size="sm" />}
                  </Flex>

                  {permsCatalogQ.isLoading ? (
                    <Text color="gray.500">loading catalog…</Text>
                  ) : (
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={2}>
                      {catalogPerms.map((perm) => {
                        const isDirect = selectedDirect.has(perm);   // ← estado editable actual
                        const fromRole = rolePerms.has(perm);        // ← viene por rol
                        const lockedByRoleOnly = fromRole && !isDirect; // ← bloqueado solo si viene por rol y NO está directo
                        const isChecked = fromRole || isDirect;      // ← check si viene por rol o está seleccionado directo

                        return (
                          <Tooltip
                            key={perm}
                            label={lockedByRoleOnly ? "Provided by role (not editable here)" : ""}
                            hasArrow
                            isDisabled={!lockedByRoleOnly}
                          >
                            <Checkbox
                              isChecked={isChecked}
                              isDisabled={lockedByRoleOnly}
                              onChange={(e) => {
                                if (lockedByRoleOnly) return; // no permitir toggle si es solo por rol
                                setSelectedDirect((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(perm);
                                  else next.delete(perm);
                                  return next;
                                });
                              }}
                            >
                              {perm}{" "}
                              {lockedByRoleOnly && (
                                <Tag size="sm" ml={2} colorScheme="purple" variant="subtle">
                                  <TagLabel>by role</TagLabel>
                                </Tag>
                              )}
                            </Checkbox>
                          </Tooltip>
                        );
                      })}
                    </SimpleGrid>
                  )}

                  <Text fontSize="sm" color="gray.600" mt={3}>
                    Direct permission changes: <b>+{toGrant.length}</b> / <b>-{toRevoke.length}</b>
                  </Text>
                </Box>
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
                      rolePermsQ.refetch(),
                    ]);

                    toast({ title: "Roles and permissions updated", status: "success" });
                  } catch (e: any) {
                    toast({ title: "Error saving changes", description: e?.message, status: "error" });
                  }
                }}
              >
                Save changes
              </Button>
            </HStack>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
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
