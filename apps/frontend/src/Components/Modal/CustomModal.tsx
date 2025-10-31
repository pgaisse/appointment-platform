import { TimeBlock, WeekDay } from "@/types";
import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ResponsiveValue,
  useDisclosure,
  useColorModeValue,
} from "@chakra-ui/react";
import React, { createContext, ReactNode, useCallback, useContext } from "react";

type OnCloseContextType = (() => void) | undefined;
const ModalCloseContext = createContext<OnCloseContextType>(undefined);
export const useModalClose = () => useContext(ModalCloseContext);

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

type Props = {
  children: ReactNode;
  size?: ResponsiveValue<
    | (string & {})
    | "sm"
    | "md"
    | "lg"
    | "xl"
    | "2xl"
    | "xs"
    | "full"
    | "3xl"
    | "4xl"
    | "5xl"
    | "6xl"
  >;
  title?: string;
  nameButton?: string;
  closeButton?: boolean;
  colorScheme?: string;
  variant?: string;
  onCloseModal?: () => void;
  selectedDays?: Partial<Record<WeekDay, TimeBlock[]>>
  setDates?: React.Dispatch<React.SetStateAction<Partial<Record<WeekDay, TimeBlock[]>>>>
  datesApp?: DateRange[];
  setDatesApp?: React.Dispatch<React.SetStateAction<DateRange[]>>;
  isOpen_?: boolean;
  onOpen_?: () => void;
  onClose_?: () => void;
  isPending?: boolean;
  // Optional sizing overrides for ModalContent
  contentW?: ResponsiveValue<string | number>;
  contentMaxW?: ResponsiveValue<string | number>;
  contentH?: ResponsiveValue<string | number>;
  contentMaxH?: ResponsiveValue<string | number>;
};

function CustomModal({
  isPending = false,
  children,
  isOpen_,
  onOpen_,
  onClose_,
  size = "full",
  title,
  nameButton="Open Modal",
  colorScheme = "teal",
  variant = "solid",
  closeButton = true,
  onCloseModal,
  setDates,
  setDatesApp,
  contentW,
  contentMaxW,
  contentH,
  contentMaxH,
}: Props) {
  const fallback = useDisclosure();
  const contentBg = useColorModeValue("rgba(255,255,255,0.65)", "rgba(26,32,44,0.55)");
  const overlayBg = useColorModeValue("rgba(255,255,255,0.25)", "rgba(0,0,0,0.25)");
  const borderCol = useColorModeValue("rgba(0,0,0,0.12)", "rgba(255,255,255,0.16)");

  // Uso de props externas o fallback interno
  const isOpen = isOpen_ !== undefined ? isOpen_ : fallback.isOpen;
  const onOpen = onOpen_ || fallback.onOpen;
  const onClose = onClose_ || fallback.onClose;

  const handleClose = useCallback(() => {
    onClose();
    if (onCloseModal) onCloseModal();

    if (setDates) setDates({});
    if (setDatesApp) setDatesApp([]);
  }, [onClose, onCloseModal, setDates, setDatesApp]);

  return (
    <>
      {nameButton != "Open Modal" && <Button w={"100px"} isDisabled={isPending ? true : false}
        onClick={onOpen}
        colorScheme={colorScheme}
        variant={variant}
      >
        {nameButton}
      </Button>}
      <Modal isOpen={isOpen} onClose={handleClose} size={size} >
        <ModalOverlay
          bg={overlayBg}
          backdropFilter="saturate(140%) blur(12px)"
        />
        <ModalContent
          bg={contentBg}
          backdropFilter="saturate(140%) blur(12px)"
          borderWidth="1px"
          borderColor={borderCol}
          borderRadius="2xl"
          boxShadow="0 12px 36px rgba(0,0,0,0.20)"
          display="flex"
          flexDirection="column"
          w={contentW}
          maxW={contentMaxW}
          h={contentH}
          maxH={contentMaxH}
        >
          <ModalHeader>{title}</ModalHeader>
          <ModalCloseButton onClick={handleClose} />
          <ModalBody flex="1 1 auto" overflowY="auto">
            <ModalCloseContext.Provider value={handleClose}>
              {children}
            </ModalCloseContext.Provider>
          </ModalBody>
          <ModalFooter



          >
            {closeButton && (
              <Button colorScheme="blue" mr={3} onClick={handleClose}>
                Close
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

export default CustomModal;
