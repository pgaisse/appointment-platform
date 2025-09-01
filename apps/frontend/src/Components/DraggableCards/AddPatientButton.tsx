// AddPatientButton.tsx
import React from "react";
import {
  Box,
  Flex,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  IconButton,
  Tooltip,
} from "@chakra-ui/react";
import { AiOutlineUserAdd } from "react-icons/ai";
import CustomEntryForm from "../CustomTemplates/CustomEntryForm";
import type { Priority } from "@/types";

type Props = {
  /** Props “clásicos” */
  priority?: Priority;
  onlyPatient?: boolean;
  label?: string;

  /** Control del modal desde el padre (opcional). Si no se provee, usa modo no controlado */
  isOpen?: boolean;
  onOpen?: () => void;
  onClose?: () => void;

  /** Props extra para pasar a CustomEntryForm (se mezclan/overridean) */
  formProps?: Record<string, any>;

  /** Presentación */
  inline?: boolean;                 // renderiza el botón dentro de un <span> (seguro dentro de <Text>)
  size?: "xs" | "sm" | "md" | "lg"; // tamaño IconButton
  variant?: string;                 // variant de Chakra para IconButton
  modalSize?: string;               // tamaño del Modal (por defecto 2xl)
};

export default function AddPatientButton({
  priority,
  onlyPatient = false,
  label = "Add Patient",

  isOpen,
  onOpen,
  onClose,

  formProps,

  inline = false,
  size = "sm",
  variant,
  modalSize = "2xl",
}: Props) {
  // Si no nos pasan isOpen, usamos el disclosure interno (modo no controlado)
  const internal = useDisclosure();
  const isControlled = typeof isOpen === "boolean";

  const open = isControlled ? (isOpen as boolean) : internal.isOpen;

  const handleOpen = (e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    if (isControlled) onOpen?.();
    else internal.onOpen();
  };

  const handleClose = () => {
    if (isControlled) onClose?.();
    else internal.onClose();
  };

  const Trigger = (
    <Tooltip label={label} placement="top" fontSize="sm" hasArrow>
      <IconButton
        aria-label={label}
        icon={<AiOutlineUserAdd style={{ boxSizing: "content-box" }} />}
        size={size}
        variant={variant}
        fontSize="12px"
        onClick={handleOpen}
        onPointerDown={(e) => e.stopPropagation()} // evita interferir con drag (dnd-kit)
      />
    </Tooltip>
  );

  return (
    <>
      {inline ? (
        // ✅ seguro dentro de <Text>: no introduce <div> dentro de <p>
        <Box as="span" display="inline-flex" ml={2}>
          {Trigger}
        </Box>
      ) : (
        <Flex justify="right" width="fit-content" alignContent="end" mx={2}>
          {Trigger}
        </Flex>
      )}

      <Modal isOpen={open} onClose={handleClose} isCentered size={modalSize}>
        <ModalOverlay />
        <ModalContent>
          <ModalCloseButton />
          <ModalBody>
            <CustomEntryForm
              // valores por defecto del botón
              onlyPatient={onlyPatient}
              mode="CREATION"
              priorityVal={priority}
              onClose_1={handleClose}
              toastInfo={{
                title: "Patient added",
                description: "The patient was added successfully",
              }}
              // 👉 props dinámicas desde el padre (pueden overridear lo de arriba)
              {...formProps}
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
