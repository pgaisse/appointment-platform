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

    // --- queries base ---
    const usersQ = useQuery({
        queryKey: ["a0-users", q, page, perPage],
        queryFn: () => api.searchUsers(q, page, perPage),
    });

    const rolesQ = useQuery({
        queryKey: ["a0-roles"],
        queryFn: () => api.listRoles({ all: true }),
    });


    const userRolesQ = useQuery({
        queryKey: ["a0-user-roles", selectedUser?.user_id],
        queryFn: () => api.getUserRoles(selectedUser!.user_id),
        enabled: !!selectedUser,
    });

    // catálogo de permisos de TU API (AUTH0_AUDIENCE)
    const permsCatalogQ = useQuery({
        queryKey: ["a0-api-permissions"],
        queryFn: () => api.listApiPermissions(), // GET /api/admin/auth0/permissions
    });

    // permisos directos del usuario (solo de TU API)
    const userDirectPermsQ = useQuery({
        queryKey: ["a0-user-direct-perms", selectedUser?.user_id],
        queryFn: () => api.getUserDirectPermissions(selectedUser!.user_id), // GET /users/:id/permissions
        enabled: !!selectedUser,
    });

    // permisos que llegan por CADA rol del usuario (se agregan todos)
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
                    const data = await api.getRolePermissions(r.id); // GET /roles/:id/permissions
                    // normaliza a string[]
                    const list: string[] = (data?.permissions || data || [])
                        .map((p: any) => p?.permission_name || p?.name)
                        .filter(Boolean);
                    return list;
                })
            );
            // flatten + unique
            return Array.from(new Set(arr.flat()));
        },
    });

    // normaliza usuarios y meta
    const users: A0User[] =
        usersQ.data?.users?.users ??
        usersQ.data?.users ??
        usersQ.data?.usersList ??
        usersQ.data?.users ??
        usersQ.data?.users;

    const meta =
        usersQ.data && "total" in usersQ.data
            ? usersQ.data
            : { total: Array.isArray(users) ? users.length : 0, start: 0, limit: perPage };

    const total = Number((meta as any).total || (Array.isArray(users) ? users.length : 0));
    const totalPages = Math.max(1, Math.ceil(total / perPage));

    const roles: A0Role[] = rolesQ.data?.roles ?? [];
    const userRoles: A0Role[] = userRolesQ.data?.roles ?? [];

    // ---------- ROLES: selección en UI ----------
    const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
    useEffect(() => {
        if (selectedUser && userRoles) {
            setSelectedRoleIds(userRoles.map((r) => r.id));
        }
    }, [selectedUser?.user_id, userRolesQ.data]);

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

    // ---------- PERMISOS: catálogo / directos / por rol / efectivos ----------
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

    const effectivePerms = useMemo(
        () => new Set<string>([...directOriginal, ...rolePerms]),
        [directOriginal, rolePerms]
    );

    // estado editable SOLO para permisos directos
    const [selectedDirect, setSelectedDirect] = useState<Set<string>>(new Set());
    useEffect(() => {
        // resetea cuando cambia el usuario o recargan directos
        setSelectedDirect(new Set(directOriginal));
    }, [selectedUser?.user_id, directOriginal]);

    // difs de permisos directos (lo que vas a crear/quitar)
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

    // Cuando abres el drawer, dispara cargas iniciales (roles/perms)
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
            <Heading size="lg" mb={2}>Gestión de usuarios (Auth0)</Heading>
            <Text color="gray.500" mb={6}>
                Asigna o quita <b>roles</b> y <b>permisos directos</b>. Los permisos que vengan por rol
                se muestran marcados y bloqueados.
            </Text>

            {/* filtros / paginación */}
            <HStack spacing={3} mb={4} align="center">
                <Input
                    placeholder="Buscar por email, nombre... (vacío = todos)"
                    value={q}
                    onChange={(e) => {
                        setQ(e.target.value);
                        setPage(0);
                    }}
                    maxW="lg"
                />
                <Button onClick={() => usersQ.refetch()} isLoading={usersQ.isFetching}>
                    Buscar
                </Button>
                <Select
                    value={perPage}
                    onChange={(e) => {
                        setPerPage(Number(e.target.value));
                        setPage(0);
                    }}
                    maxW="24"
                >
                    {[10, 20, 50, 100].map((n) => (
                        <option key={n} value={n}>
                            {n} / pág
                        </option>
                    ))}
                </Select>
                <HStack>
                    <Button onClick={() => setPage((p) => Math.max(0, p - 1))} isDisabled={page <= 0}>
                        Prev
                    </Button>
                    <Text>
                        pág. {page + 1} / {totalPages}
                    </Text>
                    <Button
                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                        isDisabled={page >= totalPages - 1}
                    >
                        Next
                    </Button>
                </HStack>
            </HStack>

            {/* tabla */}
            <Table size="sm" variant="simple">
                <Thead>
                    <Tr>
                        <Th>Usuario</Th>
                        <Th>Email</Th>
                        <Th>Auth0 ID</Th>
                        <Th>Roles</Th>
                        <Th isNumeric>Acciones</Th>
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
                                <Text fontSize="xs" color="gray.600">
                                    {u.user_id}
                                </Text>
                            </Td>
                            <Td>
                                <UserRolesTags userId={u.user_id} />
                            </Td>
                            <Td isNumeric>
                                <IconButton
                                    aria-label="Gestionar"
                                    icon={<Settings size={16} />}
                                    size="sm"
                                    onClick={() => {
                                        setSelectedUser(u);
                                        drawer.onOpen();
                                    }}
                                />
                            </Td>
                        </Tr>
                    ))}
                </Tbody>
            </Table>

            {/* Drawer gestión */}
            <Drawer isOpen={drawer.isOpen} onClose={drawer.onClose} size="lg">
                <DrawerOverlay />
                <DrawerContent>
                    <DrawerHeader>Gestionar usuario</DrawerHeader>
                    <DrawerBody>
                        {!selectedUser ? (
                            <Text>Selecciona un usuario…</Text>
                        ) : (
                            <VStack align="stretch" spacing={6}>
                                <Box>
                                    <Text fontWeight="bold">{selectedUser.name || selectedUser.email}</Text>
                                    <Text fontSize="sm" color="gray.500">
                                        {selectedUser.user_id}
                                    </Text>
                                </Box>

                                <Box>
                                    <Text fontWeight="bold" mb={2}>
                                        Organization (opcional)
                                    </Text>
                                    <Input
                                        placeholder="org_id (si aplican Organizations)"
                                        value={orgId}
                                        onChange={(e) => setOrgId(e.target.value)}
                                    />
                                    <Text fontSize="xs" color="gray.500" mt={1}>
                                        Déjalo vacío si tus roles son tenant-wide.
                                    </Text>
                                </Box>

                                {/* Selección de ROLES */}
                                <Box>
                                    <Flex justify="space-between" align="center" mb={2}>
                                        <Text fontWeight="bold">Roles</Text>
                                        {(rolesQ.isFetching || userRolesQ.isFetching) && <Spinner size="sm" />}
                                    </Flex>
                                    <CheckboxGroup
                                        value={selectedRoleIds}
                                        onChange={(v) => setSelectedRoleIds(v as string[])}
                                    >
                                        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={2}>
                                            {roles.map((r) => (
                                                <Checkbox key={r.id} value={r.id}>
                                                    {r.name}
                                                </Checkbox>
                                            ))}
                                        </SimpleGrid>
                                    </CheckboxGroup>
                                    <Text fontSize="sm" color="gray.600" mt={2}>
                                        Cambios en roles: <b>+{rolesDiff.toAdd.length}</b> /{" "}
                                        <b>-{rolesDiff.toRemove.length}</b>
                                    </Text>
                                </Box>

                                <Divider />

                                {/* Selección de PERMISOS */}
                                <Box>
                                    <Flex justify="space-between" align="center" mb={2}>
                                        <Text fontWeight="bold">Permisos (tu API)</Text>
                                        {(permsCatalogQ.isFetching ||
                                            userDirectPermsQ.isFetching ||
                                            rolePermsQ.isFetching) && <Spinner size="sm" />}
                                    </Flex>

                                    {permsCatalogQ.isLoading ? (
                                        <Text color="gray.500">cargando catálogo…</Text>
                                    ) : (
                                        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={2}>
                                            {catalogPerms.map((perm) => {
                                                const providedByRole = rolePerms.has(perm) && !directOriginal.has(perm);
                                                const isChecked = effectivePerms.has(perm);

                                                return (
                                                    <Tooltip
                                                        key={perm}
                                                        label={providedByRole ? "Viene por rol (no editable aquí)" : ""}
                                                        hasArrow
                                                        isDisabled={!providedByRole}
                                                    >
                                                        <Checkbox
                                                            isChecked={isChecked}
                                                            isDisabled={providedByRole}
                                                            onChange={(e) => {
                                                                if (providedByRole) return;
                                                                setSelectedDirect((prev) => {
                                                                    const next = new Set(prev);
                                                                    if (e.target.checked) next.add(perm);
                                                                    else next.delete(perm);
                                                                    return next;
                                                                });
                                                            }}
                                                        >
                                                            {perm}{" "}
                                                            {providedByRole && (
                                                                <Tag size="sm" ml={2} colorScheme="purple" variant="subtle">
                                                                    <TagLabel>por rol</TagLabel>
                                                                </Tag>
                                                            )}
                                                        </Checkbox>
                                                    </Tooltip>
                                                );
                                            })}
                                        </SimpleGrid>
                                    )}

                                    <Text fontSize="sm" color="gray.600" mt={3}>
                                        Cambios en permisos directos: <b>+{toGrant.length}</b> /{" "}
                                        <b>-{toRevoke.length}</b>
                                    </Text>
                                </Box>
                            </VStack>
                        )}
                    </DrawerBody>

                    <DrawerFooter>
                        <HStack>
                            <Button variant="outline" onClick={drawer.onClose}>
                                Cerrar
                            </Button>
                            <Button
                                colorScheme="blue"
                                isLoading={saving}
                                onClick={async () => {
                                    if (!selectedUser) return;
                                    try {
                                        // 1) Roles: quita primero, luego agrega
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

                                        // 2) Permisos directos: otorga/revoca contra los directos originales
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

                                        toast({ title: "Roles y permisos actualizados", status: "success" });
                                    } catch (e: any) {
                                        toast({
                                            title: "Error guardando cambios",
                                            description: e?.message,
                                            status: "error",
                                        });
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
            {roles.map((r) => (
                <Tag key={r.id} size="sm" colorScheme="blue">
                    <TagLabel>{r.name}</TagLabel>
                </Tag>
            ))}
        </HStack>
    );
}
