// apps/frontend/src/Components/Chat/ChatLauncher.tsx
import React, { lazy, Suspense, useCallback, useMemo, useRef, useState } from "react";
import { Box, IconButton, Tooltip, Spinner } from "@chakra-ui/react";
import type { ConversationChat } from "@/types";
import { FaCommentSms } from "react-icons/fa6";

// Lazy (carga el chunk solo cuando se abre)
const ChatWindowModalLazy = lazy(() => import("@/Components/Modal/ChatWindowModal"));

// Prefetch en hover/focus para mejorar la respuesta percibida
let __prefetchOnce__: Promise<any> | null = null;
const prefetchChatModal = () => {
  if (!__prefetchOnce__) __prefetchOnce__ = import("@/Components/Modal/ChatWindowModal");
  return __prefetchOnce__;
};

type Props = {
  /** Puedes pasar directamente un contacto ya armado */
  contact?: ConversationChat;
  /** O pasar un item genérico y un builder para transformarlo en ConversationChat */
  item?: any;
  buildContact?: (item: any) => ConversationChat;

  /** Botón disparador personalizado; si no lo pasas, se usa un IconButton por defecto */
  trigger?: React.ReactElement;

  /** Texto del tooltip del botón */
  tooltip?: string;

  /** Si quieres evitar que haga bubbling en listas arrastrables o cards */
  stopPropagation?: boolean;

  /** Props para inicializar el modal; por ejemplo { appId: contact.owner._id } */
  modalInitial?: any;

  /** Callbacks opcionales */
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

  // Guarda el contacto al abrir para que no cambie mientras el modal está visible
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (stopPropagation) {
        e.stopPropagation();
        // Evita conflictos con dnd-kit
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

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (stopPropagation) {
      e.stopPropagation();
      (e as any).nativeEvent?.stopImmediatePropagation?.();
    }
  }, [stopPropagation]);

  const handleMouseEnter = useCallback(() => {
    prefetchChatModal(); // pre-carga el bundle en segundo plano al pasar el mouse
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setMounted(false);
    onClose?.();
  }, [onClose]);

  // Botón por defecto si no pasas uno
  const defaultTrigger = (
    <IconButton
      aria-label="Open chat"
      icon={<FaCommentSms size={18} />}
      size="sm"
      variant="ghost"
    />
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
        <Tooltip hasArrow label={tooltip} >
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
              (contactRef.current?.owner?._id
                ? { appId: contactRef.current?.owner?._id }
                : undefined)
            }
            contact={contactRef.current!}
          />
        </Suspense>
      )}
    </Box>
  );
};

export default React.memo(ChatLauncher);
/*

<ChatLauncher
  item={item}
  tooltip="Open chat"
  stopPropagation
  buildContact={(i) => ({
    conversationId: i.sid,
    lastMessage: {
      author: i.nameInput || "",
      body: "",
      conversationId: i.sid || "",
      createdAt: new Date().toISOString(),
      direction: "outbound",
      media: [],
      sid: "temp-lastmessage",
      status: "delivered",
      updatedAt: new Date().toISOString(),
    },
    owner: {
      email: i.emailInput,
      lastName: i.lastNameInput,
      name: i.nameInput,
      org_id: i.org_id,
      phone: i.phoneInput,
      unknown: false,
      _id: i._id,
    },
  })}
  trigger={
    <IconButton
      aria-label="Open chat"
      icon={<FaCommentSms size={20} color="green" />}
      size="sm"
      variant="ghost"
    />
  }
/>

*/