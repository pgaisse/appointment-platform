import React, { lazy, Suspense, useCallback, useMemo, useRef, useState } from "react";
import { Box, Tooltip, Spinner, Icon, useColorModeValue } from "@chakra-ui/react";

import type { ConversationChat } from "@/types";
import { FaUser } from "react-icons/fa";


// Lazy (load the chunk only when opened)
const ChatWindowModalLazy = lazy(() => import("@/Components/Modal/ChatWindowModal"));

// Prefetch on hover/focus to improve TTI
let __prefetchOnce__: Promise<any> | null = null;
const prefetchChatModal = () => {
  if (!__prefetchOnce__) __prefetchOnce__ = import("@/Components/Modal/ChatWindowModal");
  return __prefetchOnce__;
};

type Props = {
  /** You can pass a prebuilt contact */
  contact?: ConversationChat;
  /** Or pass a raw item and a builder to transform into ConversationChat */
  item?: any;
  buildContact?: (item: any) => ConversationChat;

  /** Custom trigger element; default is an IconButton */
  trigger?: React.ReactElement;

  /** Tooltip text for the trigger */
  tooltip?: string;

  /** If true, stop event propagation (useful in draggable lists/cards) */
  stopPropagation?: boolean;

  /** Initial props for the modal; e.g. { appId: contact.owner._id } */
  modalInitial?: any;

  /** Optional callbacks */
  onOpen?(): void;
  onClose?(): void;
};

const ChatLauncher: React.FC<Props> = ({
  contact,
  item,
  buildContact,
  trigger,
  tooltip = "Open chat",
  stopPropagation = true,
  modalInitial,
  onOpen,
  onClose,
}) => {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const contactRef = useRef<ConversationChat | null>(null);


  const computedContact = useMemo<ConversationChat | null>(() => {
    if (contact) return contact;
    if (item && buildContact) return buildContact(item);
    return null;
  }, [contact, item, buildContact]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (stopPropagation) {
        e.stopPropagation();
        (e as any).nativeEvent?.stopImmediatePropagation?.();
      }
      if (!computedContact) {
        console.warn("[ChatLauncher] No contact provided/built.");
        return;
      }
      contactRef.current = computedContact;
      setMounted(true);
      setOpen(true);
      onOpen?.();
    },
    [computedContact, onOpen, stopPropagation]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (stopPropagation) {
        e.stopPropagation();
        (e as any).nativeEvent?.stopImmediatePropagation?.();
      }
    },
    [stopPropagation]
  );

  const handleMouseEnter = useCallback(() => {
    prefetchChatModal();
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setMounted(false);
    onClose?.();
  }, [onClose]);



  const iconColor = useMemo(() => {
    const c = computedContact?.owner?.color;
    if (!c) return "gray.500";
    if (c.startsWith("#")) return c; // use provided hex color as-is
    if (c.includes(".")) return c; // already like 'blue.500'
    return `${c}.500`;
  }, [computedContact?.owner?.color]);

  const defaultTrigger = (
    <Box
      w={{ base: "36px", md: "40px" }}
      h={{ base: "36px", md: "40px" }}
      borderRadius="md"
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      bg={useColorModeValue("gray.100", "gray.700")}
      borderWidth="1px"
      borderColor={useColorModeValue("blackAlpha.200", "whiteAlpha.300")}
      boxShadow="0 6px 18px rgba(0,0,0,0.12)"
    >
      <Icon as={FaUser} boxSize={{ base: 4, md: 5 }} color={iconColor} />
    </Box>
  );

  return (
    <Box
      as="span"
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onMouseEnter={handleMouseEnter}
      onFocus={handleMouseEnter}
      display="inline-flex"
    >
      {tooltip ? (
        <Tooltip hasArrow label={tooltip}>
          <span>{trigger ?? defaultTrigger}</span>
        </Tooltip>
      ) : (
        trigger ?? defaultTrigger
      )}

      {mounted && open && (
        <Suspense
          fallback={
            <Box
              position="fixed"
              inset={0}
              bg="blackAlpha.600"
              display="flex"
              alignItems="center"
              justifyContent="center"
              zIndex={2000}
            >
              <Spinner size="xl" thickness="4px" />
            </Box>
          }
        >
          <ChatWindowModalLazy
            onOpen={() => {}}
            isOpen={open}
            onClose={handleClose}
            trigger={trigger ?? defaultTrigger}
            initial={
              modalInitial ??
              (contactRef.current?.owner?._id ? { appId: contactRef.current?.owner?._id } : undefined)
            }
            contact={contactRef.current!}
          />
        </Suspense>
      )}
    </Box>
  );
};

export default React.memo(ChatLauncher);
