import React from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Button,
  useDisclosure,
  IconButton,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerCloseButton,
  DrawerBody,
} from '@chakra-ui/react';
import { ChatIcon } from '@chakra-ui/icons';
import MessageComposer from './MessageComposer';
import type { MessageComposerProps } from './types';

export type ComposerPopupProps = Omit<MessageComposerProps, 'autoFocus'> & {
  triggerLabel?: string;
  triggerIconOnly?: boolean;
  title?: string;
  mode?: 'modal' | 'drawer';
  placement?: 'bottom' | 'right' | 'left';
  openRef?: React.MutableRefObject<{ open: () => void; close: () => void } | null>;
};

export function ComposerPopup({
  triggerLabel = 'New message',
  triggerIconOnly,
  title = 'Send message',
  mode = 'modal',
  placement = 'bottom',
  openRef,
  ...composerProps
}: ComposerPopupProps) {
  const { isOpen, onOpen, onClose } = useDisclosure();

  React.useEffect(() => {
    if (!openRef) return;
    openRef.current = { open: onOpen, close: onClose };
    return () => { if (openRef) openRef.current = null; };
  }, [openRef, onOpen, onClose]);

  const trigger = triggerIconOnly ? (
    <IconButton onClick={onOpen} aria-label={triggerLabel} icon={<ChatIcon />} colorScheme="blue" variant="solid" />
  ) : (
    <Button onClick={onOpen} leftIcon={<ChatIcon />} colorScheme="blue">{triggerLabel}</Button>
  );

  if (mode === 'drawer') {
    return (
      <>
        {trigger}
        <Drawer isOpen={isOpen} placement={placement} onClose={onClose} size="md">
          <DrawerOverlay />
          <DrawerContent>
            <DrawerHeader>{title}</DrawerHeader>
            <DrawerCloseButton />
            <DrawerBody>
              <MessageComposer {...composerProps} autoFocus />
            </DrawerBody>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <>
      {trigger}
      <Modal isOpen={isOpen} onClose={onClose} isCentered size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{title}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <MessageComposer {...composerProps} autoFocus />
          </ModalBody>
          <ModalFooter>
            <Button onClick={onClose} variant="ghost">Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
