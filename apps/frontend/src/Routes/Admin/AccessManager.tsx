// src/pages/Admin/UsersManager.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Box, Heading, Input, Button, HStack, VStack, Text, Table, Thead, Tbody, Tr, Th, Td,
  Avatar, Tag, TagLabel, IconButton, Drawer, DrawerBody, DrawerContent, DrawerHeader,
  DrawerOverlay, DrawerFooter, useDisclosure, CheckboxGroup, Checkbox, SimpleGrid,
  useToast, Select, Spinner, Alert, AlertIcon, Divider
} from "@chakra-ui/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings } from "lucide-react";
import { useAdminAuth0Api } from "@/Hooks/useAdminAuth0Api";

type A0User = { user_id: string; email?: string; name?: string; picture?: string };
type A0Role = { id: string; name: string; description?: string };

export default function UsersManager() {
  const api = useAdminAuth0Api();
  const qc = useQueryClient();
  const toast = useToast();

  // filtros / paginación
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(20);

  // selección
  const [selectedUser, setSelectedUser] = useState<A0User | null>(null);
  const [orgId, setOrgId] = useState<string>(""); // opcional si usas Organizations

  // drawer
  const drawer = useDisclosure();
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]); // permisos directos del usuario

  // queries: usuarios
  const usersQ = useQuery({
    queryKey: ["a0-users", q, page, perPage],
    queryFn: () => api.searchUsers(q, page, perPage),
  });

  // catálogo de roles
  const rolesQ = useQuery({
    queryKey: ["a0-roles"],
    queryFn: () => api.listRoles(),
  });

  // catálogo de permisos de tu API
  const permsCatQ = useQuery({
    queryKey: ["a0-permissions"],
    queryFn: () => api.listApiPermissions(), // backend: GET /api/admin/auth0/permissions
  });

  // roles y permisos del usuario seleccionado
  const userRolesQ = useQuery({
    queryKey: ["a0-user-roles", selectedUser?.user_id],
    queryFn: () => api.getUserRoles(selectedUser!.user_id),
    enabled: !!selectedUser,
  });
  const userPermsQ = useQuery({
    queryKey: ["a0-user-perms", selectedUser?.user_id],
    queryFn: () => api.getUserPermissions(selectedUser!.user_id), // GET /users/:id/permissions
    enabled: !!selectedUser,
  });

  // normalización de respuesta de usuarios (puede venir con include_totals)
  const usersData: any = usersQ.data || {};
  const users: A0User[] = Array.isArray(usersData.users)
    ? usersData.users
    : Array.isArray(usersData.users?.users)
    ? usersData.users.users
    : Array.isArray(usersData.users?.data)
    ? usersData.users.data
    : [];

  const total: number =
    typeof usersData.total === "number"
      ? usersData.total
      : Array.isArray(users) ? users.length : 0;

  const roles: A0Role[] = rolesQ.data?.roles ?? [];
  const userRoles: A0Role[] = userRolesQ.data?.roles ?? [];
  const permsCatalog: string[] = permsCatQ.data?.permissions ?? [];

  // mutaciones (roles)
  const assignMu = useMutation({
    mutationFn: (vars: { userId: string; roleIds: string[]; orgId?: string }) =>
      api.assignRolesToUser(vars.userId, vars.roleIds, vars.orgId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["a0-user-roles", selectedUser?.user_id] });
    },
  });

  const removeMu = useMutation({
    mutationFn: (vars: { userId: string; roleIds: string[]; orgId?: string }) =>
      api.removeRolesFromUser(vars.userId, vars.roleIds, vars.orgId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["a0-user-roles", selectedUser?.user_id] });
    },
  });

  // mutaciones (permisos directos)
  const grantPermsMu = useMutation({
    mutationFn: (vars: { userId: string; permissions: string[] }) =>
      api.grantUserPermissions(vars.userId, vars.permissions),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["a0-user-perms", v.userId] });
    },
  });

  const revokePermsMu = useMutation({
    mutationFn: (vars: { userId: string; permissions: string[] }) =>
      api.revokeUserPermissions(vars.userId, vars.permissions),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["a0-user-perms", v.userId] });
    },
  });

  // precargar selección cuando hay usuario + datos
  useEffect(() => {
    if (!selectedUser) return;
    if (userRoles) setSelectedRoleIds(userRoles.map((r) => r.id));
    if (userPermsQ.data?.permissions) setSelectedPerms(userPermsQ.data.permissions);
  }, [selectedUser, userRolesQ.data, userPermsQ.data]); // eslint-disable-line

  // diffs para guardar
  const roleDiff = useMemo(() => {
    const curr = new Set((userRoles || []).map((r) => r.id));
    const next = new Set(selectedRoleIds);
    return {
      toAdd: [...next].filter((id) => !curr.has(id)),
      toRemove: [...curr].filter((id) => !next.has(id)),
    };
  }, [selectedRoleIds, userRoles]);

  const permDiff = useMemo(() => {
    const curr = new Set(userPermsQ.data?.permissions || []);
    const next = new Set(selectedPerms);
    return {
      toAdd: [...next].filter((p) => !curr.has(p)),
      toRemove: [...curr].filter((p) => !next.has(p)),
    };
  }, [selectedPerms, userPermsQ.data]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <Box p={6}>
      <Heading size="lg" mb={2}>Gestión de usuarios (Auth0)</Heading>
      <Text color="gray.500" mb={6}>
        Asigna o quita <b>roles</b> y <b>permisos directos</b>. (Requiere permiso: <code>dev-admin</code>)
      </Text>

      {/* errores top-level */}
      {(usersQ.isError || rolesQ.isError || permsCatQ.isError) && (
        <Alert status="error" mb={4}>
          <AlertIcon />
          Error cargando datos (usuarios/roles/permisos).
        </Alert>
      )}

      {/* filtros / paginación */}
      <HStack spacing={3} mb={4} align="center">
        <Input
          placeholder="Buscar por email, nombre… (vacío = todos)"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(0); }}
          maxW="lg"
        />
        <Button onClick={() => usersQ.refetch()} isLoading={usersQ.isFetching}>Buscar</Button>
        <Select value={perPage} onChange={(e)=>{ setPerPage(Number(e.target.value)); setPage(0); }} maxW="28">
          {[10,20,50,100].map(n => <option key={n} value={n}>{n} / pág</option>)}
        </Select>
        <HStack>
          <Button onClick={()=> setPage(p => Math.max(0, p-1))} isDisabled={page<=0}>Prev</Button>
          <Text>pág. {page+1} / {totalPages}</Text>
          <Button onClick={()=> setPage(p => Math.min(totalPages-1, p+1))} isDisabled={page>=totalPages-1}>Next</Button>
        </HStack>
      </HStack>

      {/* tabla */}
      <Box border="1px solid" borderColor="gray.100" rounded="md" overflow="hidden">
        <Table size="sm" variant="simple">
          <Thead bg="gray.50">
            <Tr>
              <Th>Usuario</Th>
              <Th>Email</Th>
              <Th>Auth0 ID</Th>
              <Th>Roles</Th>
              <Th isNumeric>Acciones</Th>
            </Tr>
          </Thead>
          <Tbody>
            {usersQ.isLoading ? (
              <Tr><Td colSpan={5}><HStack py={4}><Spinner /><Text>Cargando…</Text></HStack></Td></Tr>
            ) : users.length === 0 ? (
              <Tr><Td colSpan={5}><Text color="gray.500" py={4}>Sin resultados</Text></Td></Tr>
            ) : (
              users.map((u) => (
                <Tr key={u.user_id}>
                  <Td>
                    <HStack>
                      <Avatar size="sm" name={u.name || u.email} src={u.picture} />
                      <Text>{u.name || "—"}</Text>
                    </HStack>
                  </Td>
                  <Td>{u.email || "—"}</Td>
                  <Td><Text fontSize="xs" color="gray.600">{u.user_id}</Text></Td>
                  <Td>
                    <UserRolesTags userId={u.user_id} />
                  </Td>
                  <Td isNumeric>
                    <IconButton
                      aria-label="Gestionar"
                      icon={<Settings size={16} />}
                      size="sm"
                      onClick={() => { setSelectedUser(u); drawer.onOpen(); }}
                    />
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </Box>

      {/* Drawer de gestión */}
      <Drawer isOpen={drawer.isOpen} onClose={drawer.onClose} size="lg">
        <DrawerOverlay />
        <DrawerContent>
          <DrawerHeader>Gestionar roles y permisos</DrawerHeader>
          <DrawerBody>
            {!selectedUser ? (
              <Text>Selecciona un usuario…</Text>
            ) : (
              <VStack align="stretch" spacing={6}>
                <Box>
                  <Text fontWeight="bold">{selectedUser.name || selectedUser.email}</Text>
                  <Text fontSize="sm" color="gray.500">{selectedUser.user_id}</Text>
                </Box>

                <Box>
                  <Text fontWeight="bold" mb={2}>Organization (opcional)</Text>
                  <Input placeholder="org_id (si aplican Organizations)" value={orgId} onChange={(e)=>setOrgId(e.target.value)} />
                  <Text fontSize="xs" color="gray.500" mt={1}>Déjalo vacío si tus roles son tenant-wide.</Text>
                </Box>

                <Box>
                  <Text fontWeight="bold" mb={2}>Roles</Text>
                  {rolesQ.isLoading ? (
                    <HStack><Spinner /><Text>Cargando roles…</Text></HStack>
                  ) : (
                    <CheckboxGroup value={selectedRoleIds} onChange={(v)=> setSelectedRoleIds(v as string[])}>
                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={2}>
                        {roles.map(r => (
                          <Checkbox key={r.id} value={r.id}>{r.name}</Checkbox>
                        ))}
                      </SimpleGrid>
                    </CheckboxGroup>
                  )}
                  <Text fontSize="sm" color="gray.600" mt={2}>
                    Cambios roles: <b>+{roleDiff.toAdd.length}</b> / <b>-{roleDiff.toRemove.length}</b>
                  </Text>
                </Box>

                <Divider />

                <Box>
                  <Text fontWeight="bold" mb={2}>Permisos directos (usuario)</Text>
                  {permsCatQ.isLoading ? (
                    <HStack><Spinner /><Text>Cargando permisos…</Text></HStack>
                  ) : (
                    <VStack
                      align="stretch"
                      spacing={1}
                      maxH="40vh"
                      overflow="auto"
                      border="1px solid #eee"
                      p={2}
                      rounded="md"
                    >
                      {permsCatalog.map((perm: string) => (
                        <Checkbox
                          key={perm}
                          isChecked={selectedPerms.includes(perm)}
                          onChange={(e) => {
                            setSelectedPerms(prev =>
                              e.target.checked ? [...prev, perm] : prev.filter(p => p !== perm)
                            );
                          }}
                        >
                          {perm}
                        </Checkbox>
                      ))}
                    </VStack>
                  )}
                  <Text fontSize="sm" color="gray.600" mt={2}>
                    Cambios permisos: <b>+{permDiff.toAdd.length}</b> / <b>-{permDiff.toRemove.length}</b>
                  </Text>
                </Box>
              </VStack>
            )}
          </DrawerBody>
          <DrawerFooter>
            <HStack>
              <Button variant="outline" onClick={drawer.onClose}>Cerrar</Button>
              <Button
                colorScheme="blue"
                isLoading={
                  assignMu.isPending ||
                  removeMu.isPending ||
                  grantPermsMu.isPending ||
                  revokePermsMu.isPending
                }
                onClick={async () => {
                  if (!selectedUser) return;
                  try {
                    // 1) Roles: quita y luego agrega
                    if (roleDiff.toRemove.length) {
                      await removeMu.mutateAsync({ userId: selectedUser.user_id, roleIds: roleDiff.toRemove, orgId: orgId || undefined });
                    }
                    if (roleDiff.toAdd.length) {
                      await assignMu.mutateAsync({ userId: selectedUser.user_id, roleIds: roleDiff.toAdd, orgId: orgId || undefined });
                    }
                    await userRolesQ.refetch();

                    // 2) Permisos directos: revoca y luego otorga
                    if (permDiff.toRemove.length) {
                      await revokePermsMu.mutateAsync({ userId: selectedUser.user_id, permissions: permDiff.toRemove });
                    }
                    if (permDiff.toAdd.length) {
                      await grantPermsMu.mutateAsync({ userId: selectedUser.user_id, permissions: permDiff.toAdd });
                    }
                    await userPermsQ.refetch();

                    toast({ title: "Cambios guardados", status: "success" });
                  } catch (e: any) {
                    toast({ title: "Error guardando", description: e?.message, status: "error" });
                  }
                }}
              >
                Guardar cambios
              </Button>
            </HStack>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </Box>
  );
}

function UserRolesTags({ userId }: { userId: string }) {
  const api = useAdminAuth0Api();
  const q = useQuery({
    queryKey: ["a0-user-roles", userId],
    queryFn: () => api.getUserRoles(userId),
  });
  const roles: A0Role[] = q.data?.roles ?? [];
  if (q.isLoading) return <Text color="gray.500">cargando…</Text>;
  if ((roles || []).length === 0) return <Text color="gray.400">—</Text>;
  return (
    <HStack wrap="wrap" spacing={1}>
      {roles.map(r => (
        <Tag key={r.id} size="sm" colorScheme="blue"><TagLabel>{r.name}</TagLabel></Tag>
      ))}
    </HStack>
  );
}
