// src/components/ChatCategorizationPanel.tsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  Box, Flex, Stack, Heading, Text, Input, InputGroup, InputLeftElement,
  IconButton, Button, HStack, Divider, Spinner, useToast, Tooltip,
  useColorModeValue, Switch, Skeleton, Alert, AlertIcon, Avatar,
  AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter,
  AlertDialogHeader, AlertDialogOverlay, Collapse, Portal,
} from "@chakra-ui/react";
import {
  SearchIcon, AddIcon, CloseIcon, ChevronDownIcon, ChevronRightIcon,
} from "@chakra-ui/icons";
import { FiTrash2 } from "react-icons/fi";
import { FaUserAlt } from "react-icons/fa";
import { useAuth0 } from "@auth0/auth0-react";
import { useQueryClient, useQueries } from "@tanstack/react-query";
import axios from "axios";
import { useDroppable } from "@dnd-kit/core";

import {
  useChatCategories,
  useCreateChatCategory,
  useAssignCategoryToConversation,
  useUnassignCategoryFromConversation,
  useUpdateChatCategory,
  type ChatCategory,
  type ConversationChatCategoryItem,
} from "@/Hooks/Query/useChatCategorization";
import type { ConversationChat, Message } from "@/types";

/* =========================
 * Utils
 * ========================= */
const API_BASE = `${import.meta.env.VITE_BASE_URL}`;
const OVERLAY_Z = 2000; // z-index alto para escapar de contenedores con overflow/transform

function lastPreviewOf(msg?: Message) {
  if (!msg) return "";
  if (msg.body) return msg.body;
  if (msg.media?.length) return "📷 Photo";
  return "";
}

type CreateModalState = {
  key: string;
  name: string;
  color?: string;
  icon?: string;
  createAndAssign: boolean;
};

type Props = {
  conversationSid: string;
  allowCreate?: boolean;
  conversations?: ConversationChat[];
  onOpenChat?: (c: ConversationChat) => void;
  density?: "compact" | "cozy";
};

/* ========== Drop wrapper per category (id = cat-<categoryId>) ========== */
const CategoryDrop: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => {
  const { isOver, setNodeRef } = useDroppable({ id, data: { type: "category" } });
  const ring = useColorModeValue("blue.300", "blue.200");
  return (
    <Box
      ref={setNodeRef}
      rounded="lg"
      outline={isOver ? "2px solid" : "0px"}
      outlineColor={isOver ? ring : "transparent"}
      transition="outline-color 0.1s ease"
    >
      {children}
    </Box>
  );
};

/* ========== Chat row (MessageList styling) ========== */
const CategorizedChatRow: React.FC<{
  conv: ConversationChat;
  onOpen?: (c: ConversationChat) => void;
  onUnassign?: () => void;
  density: "compact" | "cozy";
}> = ({ conv, onOpen, onUnassign, density }) => {
  const isCompact = density === "compact";
  const name = conv.owner?.name || conv.lastMessage?.author || "No name";
  const preview = lastPreviewOf(conv.lastMessage);

  return (
    <HStack
      p={isCompact ? 2.5 : 3}
      borderRadius="xl"
      transition="all 0.2s ease"
      _hover={{ bg: "blackAlpha.50", _dark: { bg: "whiteAlpha.100" } }}
      cursor={onOpen ? "pointer" : "default"}
      onClick={onOpen ? () => onOpen(conv) : undefined}
      align="center"
    >
      <Avatar
        size="sm"
        src={conv.owner?.avatar}
        name={conv.owner?.unknown ? undefined : name}
        icon={conv.owner?.unknown ? <FaUserAlt fontSize="1.2rem" /> : undefined}
      />
      <Box flex="1" minW={0}>
        <Text fontWeight="semibold" noOfLines={1} fontSize="sm">
          {name}
        </Text>
        <Text fontSize="xs" color="gray.500" noOfLines={1}>
          {preview}
        </Text>
      </Box>
      {onUnassign && (
        <IconButton
          aria-label="Remove from category"
          icon={<CloseIcon />}
          size={isCompact ? "xs" : "sm"}
          variant="ghost"
          onClick={(e) => { e.stopPropagation(); onUnassign(); }}
        />
      )}
    </HStack>
  );
};

/* ========== Category header ========== */
const CategoryHeaderRow: React.FC<{
  cat: ChatCategory;
  assignedCount: number;
  onQuickAssign?: () => void;
  onDelete?: () => void;
  onToggleCollapse?: () => void;
  collapsed?: boolean;
  deleteDisabled?: boolean;
  density: "compact" | "cozy";
}> = ({
  cat, assignedCount, onQuickAssign, onDelete, onToggleCollapse, collapsed, deleteDisabled, density,
}) => {
    const border = useColorModeValue("blackAlpha.200", "whiteAlpha.200");
    const hover = useColorModeValue("blackAlpha.50", "whiteAlpha.100");
    const pad = density === "compact" ? 2 : 3;

    return (
      <Flex
        align="center"
        justify="space-between"
        p={pad}
        borderWidth="1px"
        borderColor={border}
        borderRadius="lg"
        _hover={{ bg: hover }}
        transition="background 0.15s ease"
      >
        <HStack spacing={3} minW={0}>
          {/* Collapse/expand button */}
          <IconButton
            aria-label={collapsed ? "Expand" : "Collapse"}
            icon={collapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
            size={density === "compact" ? "xs" : "sm"}
            variant="ghost"
            onClick={onToggleCollapse}
          />
          <Box
            w="18px" h="18px" flex="0 0 18px" borderRadius="sm"
            bg={cat.color || "#4C6EF5"} border="1px solid rgba(0,0,0,0.08)"
          />
          <Box minW={0}>
            <Text fontWeight="medium" fontSize="sm" noOfLines={1}>{cat.name}</Text>
            <Text fontSize="xs" color="gray.500" noOfLines={1}>
              {cat.key} • {assignedCount} chat{assignedCount === 1 ? "" : "s"}
            </Text>
          </Box>
        </HStack>

        <HStack spacing={1}>
          {onQuickAssign && (
            <Tooltip label="Assign this category to the active chat">
              <IconButton
                aria-label="Assign"
                icon={<AddIcon />}
                size={density === "compact" ? "xs" : "sm"}
                onClick={onQuickAssign}
                variant="ghost"
              />
            </Tooltip>
          )}
          {onDelete && (
            <Tooltip label={deleteDisabled ? "Has assigned chats" : "Delete category"}>
              <IconButton
                aria-label="Delete category"
                icon={<FiTrash2 />}
                size={density === "compact" ? "xs" : "sm"}
                onClick={onDelete}
                variant="ghost"
                isDisabled={deleteDisabled}
                colorScheme="red"
              />
            </Tooltip>
          )}
        </HStack>
      </Flex>
    );
  };

export const ChatCategorizationPanel: React.FC<Props> = ({
  conversationSid,
  allowCreate = true,
  conversations = [],
  onOpenChat,
  density = "compact",
}) => {
  const toast = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  // Colors
  const borderCol = useColorModeValue("blackAlpha.200", "whiteAlpha.200");
  const subtleBg = useColorModeValue("gray.50", "whiteAlpha.50");
  const cardBg = useColorModeValue("white", "gray.800");
  const modalBg = useColorModeValue("white", "gray.800");

  // Auth token
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      if (!isAuthenticated) return;
      const t = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });
      setToken(t);
    })();
  }, [getAccessTokenSilently, isAuthenticated]);

  // Categories
  const { data: cats, isLoading: loadingCats, refetch: refetchCats } = useChatCategories(search);
  const visibleCats = useMemo(() => (cats || []).filter((c) => c.isActive !== false), [cats]);

  // Mutations
  const createCat = useCreateChatCategory();
  const assign = useAssignCategoryToConversation();
  const unassign = useUnassignCategoryFromConversation();
  const updateCat = useUpdateChatCategory();

  // ---- Stable per-SID tracking to avoid index churn in useQueries
  const [trackedSids, setTrackedSids] = useState<string[]>([]);
  useEffect(() => {
    setTrackedSids((prev) => {
      if (!conversations.length) return prev;
      const known = new Set(prev);
      const next = [...prev];
      for (const c of conversations) {
        const sid = c.conversationId;
        if (sid && !known.has(sid)) next.push(sid);
      }
      return next; // we don't remove old SIDs to keep query indexes stable
    });
  }, [conversations]);

  // Bulk queries (silent background refetches, keep previous data)
  const bulkResults = useQueries({
    queries: trackedSids.map((sid) => ({
      queryKey: ["conversation-categories", sid],
      enabled: !!token && !!sid,
      queryFn: async (): Promise<ConversationChatCategoryItem[]> => {
        const { data } = await axios.get(`${API_BASE}/conversations/${sid}/categories`, {
          headers: { Authorization: `Bearer ${token!}` },
        });
        return data;
      },
      staleTime: 5 * 60 * 1000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      placeholderData: (prev: ConversationChatCategoryItem[] | undefined) => prev,
      notifyOnChangeProps: ["data"],
    })),
  });

  const queriesBySid = useMemo(() => {
    const m = new Map<
      string,
      { data?: ConversationChatCategoryItem[]; isFetching: boolean; isLoading: boolean }
    >();
    bulkResults.forEach((q, i) => {
      m.set(trackedSids[i], { data: q.data, isFetching: q.isFetching, isLoading: q.isLoading });
    });
    return m;
  }, [bulkResults, trackedSids]);

  const byId = useMemo(() => {
    const m = new Map<string, ConversationChat>();
    conversations.forEach((c) => m.set(c.conversationId, c));
    return m;
  }, [conversations]);

  const categoryToConvs = useMemo(() => {
    const map = new Map<string, ConversationChat[]>();
    trackedSids.forEach((sid) => {
      const q = queriesBySid.get(sid);
      const conv = byId.get(sid);
      if (!conv || !q?.data) return;
      q.data.forEach((it) => {
        const arr = map.get(it.chatCategory._id) || [];
        arr.push(conv);
        map.set(it.chatCategory._id, arr);
      });
    });
    return map;
  }, [trackedSids, queriesBySid, byId]);

  // (Optional) tiny spinner in panel header when background fetching occurs
  const isBackgroundFetching = useMemo(
    () => bulkResults.some((q) => q.isFetching && !!q.data),
    [bulkResults]
  );

  // Create category
  const [form, setForm] = useState<CreateModalState>({
    key: "", name: "", color: "#4C6EF5", icon: "", createAndAssign: true,
  });
  const [isOpen, setIsOpen] = useState(false);
  const [touched, setTouched] = useState<{ key?: boolean; name?: boolean }>({});
  const keyError = touched.key && !form.key?.trim();
  const nameError = touched.name && !form.name?.trim();

  const resetForm = () => {
    setForm({ key: "", name: "", color: "#4C6EF5", icon: "", createAndAssign: true });
    setTouched({});
  };
  const handleCreate = async () => {
    if (!form.key.trim() || !form.name.trim()) {
      setTouched({ key: true, name: true });
      return;
    }
    try {
      const created = await createCat.mutateAsync({
        key: form.key.trim(),
        name: form.name.trim(),
        color: form.color,
        icon: form.icon || undefined,
      });

      if (form.createAndAssign && created?._id && conversationSid) {
        await assign.mutateAsync({ conversationSid, chatCategoryId: created._id });
        qc.invalidateQueries({ queryKey: ["conversation-categories", conversationSid] });
      }

      toast({ title: "Category created", status: "success", duration: 2000, isClosable: true });
      resetForm();
      setIsOpen(false);
      refetchCats();
    } catch (e: any) {
      toast({
        title: "Error creating category",
        description: e?.response?.data?.error || e?.message || "Please try again",
        status: "error",
      });
    }
  };

  // Delete category (soft delete)
  const [deleteTarget, setDeleteTarget] = useState<{ cat: ChatCategory; assignedCount: number } | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  const handleDeleteCategory = async () => {
    if (!deleteTarget) return;
    const { cat, assignedCount } = deleteTarget;

    if (assignedCount > 0) {
      toast({
        title: "Cannot delete",
        description: "This category has assigned chats. Remove them first.",
        status: "warning",
        duration: 2500,
        isClosable: true,
      });
      setDeleteTarget(null);
      return;
    }

    try {
      await updateCat.mutateAsync({
        id: cat._id,
        patch: { isActive: false },
      });
      toast({ title: "Category deleted", status: "success", duration: 1500, isClosable: true });
      refetchCats();
    } catch (e: any) {
      toast({
        title: "Error deleting category",
        description: e?.response?.data?.error || e?.message || "Please try again",
        status: "error",
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  // Collapse/expand categories
  const [collapsedById, setCollapsedById] = useState<Record<string, boolean>>({});
  const allCollapsed = useMemo(
    () => visibleCats.length > 0 && visibleCats.every((c) => collapsedById[c._id]),
    [visibleCats, collapsedById]
  );
  const toggleOne = (id: string) =>
    setCollapsedById((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleAll = () =>
    setCollapsedById(() => {
      const next: Record<string, boolean> = {};
      visibleCats.forEach((c) => (next[c._id] = !allCollapsed));
      return next;
    });

  return (
    <Flex direction="column" gap={4}>
      {/* Top actions */}
      <Flex gap={2} align="center" wrap="wrap">
        <InputGroup size={density === "compact" ? "sm" : "md"} flex="1">
          <InputLeftElement pointerEvents="none">
            <SearchIcon color="gray.400" />
          </InputLeftElement>
          <Input
            placeholder="Search categories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            variant="filled"
          />
        </InputGroup>

        {allowCreate && (
          <Button
            leftIcon={<AddIcon />}
            onClick={() => setIsOpen(true)}
            colorScheme="blue"
            size={density === "compact" ? "sm" : "md"}
            flexShrink={0}
          >
            New
          </Button>
        )}

        {isBackgroundFetching && <Spinner size="xs" thickness="2px" />}
      </Flex>

      <Divider />
      <Button
        leftIcon={allCollapsed ? <ChevronDownIcon /> : <ChevronRightIcon />}
        onClick={toggleAll}
        size={density === "compact" ? "sm" : "md"}
        variant="ghost"
      >
        {allCollapsed ? "Expand all" : "Collapse all"}
      </Button>
      {/* Category list */}
      {loadingCats ? (
        <Stack spacing={3}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} h="92px" borderRadius="lg" />
          ))}
        </Stack>
      ) : visibleCats && visibleCats.length > 0 ? (
        <Stack spacing={3}>
          {visibleCats.map((cat) => {
            const assignedConvs = categoryToConvs.get(cat._id) || [];
            const hasAssigned = assignedConvs.length > 0;
            const collapsed = !!collapsedById[cat._id];

            return (
              <CategoryDrop key={cat._id} id={`cat-${cat._id}`}>
                <Box
                  p={density === "compact" ? 2 : 3}
                  borderWidth="1px"
                  borderColor={borderCol}
                  borderRadius="lg"
                  bg={cardBg}
                >
                  {/* Header */}
                  <CategoryHeaderRow
                    cat={cat}
                    assignedCount={assignedConvs.length}
                    density={density}
                    onQuickAssign={
                      conversationSid
                        ? async () => {
                          try {
                            await assign.mutateAsync({ conversationSid, chatCategoryId: cat._id });
                            qc.invalidateQueries({ queryKey: ["conversation-categories", conversationSid] });
                            toast({ title: "Assigned", status: "success", duration: 1200, isClosable: true });
                          } catch (e: any) {
                            toast({
                              title: "Error assigning category",
                              description: e?.response?.data?.error || e?.message || "Please try again",
                              status: "error",
                            });
                          }
                        }
                        : undefined
                    }
                    onDelete={() => setDeleteTarget({ cat, assignedCount: assignedConvs.length })}
                    deleteDisabled={hasAssigned}
                    onToggleCollapse={() => toggleOne(cat._id)}
                    collapsed={collapsed}
                  />

                  {/* Chats (collapsible) */}
                  <Collapse in={!collapsed} animateOpacity>
                    <Box mt={2} p={2} borderRadius="md" bg={subtleBg}>
                      {hasAssigned ? (
                        <Stack spacing={2}>
                          {assignedConvs.map((conv) => (
                            <CategorizedChatRow
                              key={conv.conversationId}
                              conv={conv}
                              onOpen={onOpenChat}
                              onUnassign={async () => {
                                try {
                                  await unassign.mutateAsync({
                                    conversationSid: conv.conversationId,
                                    chatCategoryId: cat._id,
                                  });
                                  qc.invalidateQueries({ queryKey: ["conversation-categories", conv.conversationId] });
                                  toast({ title: "Removed", status: "info", duration: 1000, isClosable: true });
                                } catch (e: any) {
                                  toast({
                                    title: "Error removing category",
                                    description: e?.response?.data?.error || e?.message || "Please try again",
                                    status: "error",
                                  });
                                }
                              }}
                              density={density}
                            />
                          ))}
                        </Stack>
                      ) : (
                        <Text fontSize="sm" color="gray.500">No assigned chats.</Text>
                      )}
                    </Box>
                  </Collapse>
                </Box>
              </CategoryDrop>
            );
          })}
        </Stack>
      ) : (
        <Alert status="info" borderRadius="md" variant="subtle" py={2}>
          <AlertIcon />
          <Text fontSize="sm">No categories created.</Text>
        </Alert>
      )}

      {/* Embedded modal (create category) */}
      {isOpen && (
        <Portal appendToParentPortal={false}>
          <Box
            position="fixed"
            inset={0}
            bg="blackAlpha.600"
            display="flex"
            alignItems="center"
            justifyContent="center"
            zIndex={OVERLAY_Z}
            onClick={() => { resetForm(); setIsOpen(false); }}
          >
            <Box
              bg={modalBg}
              borderRadius="xl"
              p={4}
              minW={{ base: "90%", sm: "420px" }}
              maxW="96vw"
              maxH="90vh"
              overflowY="auto"
              borderWidth="1px"
              borderColor={borderCol}
              zIndex={OVERLAY_Z + 1}
              onClick={(e) => e.stopPropagation()}
            >
              <Flex align="center" justify="space-between" mb={3}>
                <Heading size="sm">New category</Heading>
                <IconButton aria-label="Close" size="sm" icon={<CloseIcon />} variant="ghost"
                  onClick={() => { resetForm(); setIsOpen(false); }} />
              </Flex>

              <Stack spacing={3}>
                <Box>
                  <Text fontSize="sm" mb={1}>Key</Text>
                  <Input
                    placeholder="e.g. billing"
                    value={form.key}
                    onChange={(e) => setForm((s) => ({ ...s, key: e.target.value }))}
                    onBlur={() => setTouched((t) => ({ ...t, key: true }))}
                    isInvalid={!!(touched.key && !form.key.trim())}
                  />
                  {touched.key && !form.key.trim() && (
                    <Text fontSize="xs" color="red.400" mt={1}>Key is required.</Text>
                  )}
                </Box>

                <Box>
                  <Text fontSize="sm" mb={1}>Name</Text>
                  <Input
                    placeholder="e.g. Billing"
                    value={form.name}
                    onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                    onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                    isInvalid={!!(touched.name && !form.name.trim())}
                  />
                  {touched.name && !form.name.trim() && (
                    <Text fontSize="xs" color="red.400" mt={1}>Name is required.</Text>
                  )}
                </Box>

                <Box>
                  <Text fontSize="sm" mb={1}>Color</Text>
                  <HStack>
                    <Input
                      type="color"
                      value={form.color || "#4C6EF5"}
                      onChange={(e) => setForm((s) => ({ ...s, color: e.target.value }))}
                      w="60px"
                      p={1}
                    />
                    <Box flex="1" h="10" borderRadius="md" borderWidth="1px" bg={form.color || "#4C6EF5"} />
                  </HStack>
                </Box>

                <Box>
                  <HStack justify="space-between">
                    <Text fontSize="sm" color="gray.600">Create and assign to active chat</Text>
                    <Switch
                      isChecked={form.createAndAssign}
                      onChange={() => setForm((s) => ({ ...s, createAndAssign: !s.createAndAssign }))}
                    />
                  </HStack>
                </Box>
              </Stack>

              <Flex justify="flex-end" gap={2} mt={4}>
                <Button variant="ghost" leftIcon={<CloseIcon />} onClick={() => { resetForm(); setIsOpen(false); }}>
                  Cancel
                </Button>
                <Button colorScheme="blue" isLoading={createCat.isPending || assign.isPending} onClick={handleCreate}>
                  Create
                </Button>
              </Flex>
            </Box>
          </Box>
        </Portal>
      )}

      {/* Delete confirmation */}
      <AlertDialog
        isOpen={!!deleteTarget}
        leastDestructiveRef={cancelRef}
        onClose={() => setDeleteTarget(null)}
      >
        <AlertDialogOverlay zIndex={OVERLAY_Z}>
          <AlertDialogContent zIndex={OVERLAY_Z + 1}>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete category
            </AlertDialogHeader>

            <AlertDialogBody>
              {deleteTarget?.assignedCount
                ? `You can't delete "${deleteTarget.cat.name}" because it has ${deleteTarget.assignedCount} assigned chat(s).`
                : `Are you sure you want to delete "${deleteTarget?.cat.name}"? You can recreate it later if needed.`}
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={handleDeleteCategory}
                ml={3}
                isDisabled={!!deleteTarget?.assignedCount}
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Flex>
  );
};

export default ChatCategorizationPanel;
