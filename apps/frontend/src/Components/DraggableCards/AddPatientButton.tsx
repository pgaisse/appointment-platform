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
  Button,
} from "@chakra-ui/react";
import { AiOutlineUserAdd } from "react-icons/ai";
import CustomEntryForm from "../CustomTemplates/CustomEntryForm";
import type { Priority } from "@/types";

type Props = {
  /** Props “clásicos” */
  priority?: Priority;
  onlyPatient?: boolean;
  label?: string;
  px?: number,
  py?: number,
  mb?: number,
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
  text?: string
  color?:string
  tooltip?:boolean
  iconOnly?: boolean
  iconSize?: "xs" | "sm" | "md" | "lg"
};

export default function AddPatientButton({
  priority,
  onlyPatient = false,
  label = "Add Patient",
  text = "",
  tooltip=true,
  iconOnly = false,
  iconSize = "sm",
  isOpen,
  color,
  onOpen,
  onClose,
  px = 4,
  py = 2,
  mb = 3,
  formProps,

  inline = false,
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

  const Trigger = iconOnly ? (
    <Tooltip label={tooltip ? label : ""} placement="top" fontSize="sm" hasArrow>
      <IconButton
        aria-label={label}
        icon={<AiOutlineUserAdd />}
        size={iconSize}
        variant="ghost"
        colorScheme="gray"
        onClick={handleOpen}
        onPointerDown={(e) => e.stopPropagation()}
      />
    </Tooltip>
  ) : (
    <Tooltip label={tooltip?label:""} placement="top" fontSize="sm" hasArrow>
      <Button
        aria-label={label}
        variant="ghost"
        colorScheme="gray"
        leftIcon={<AiOutlineUserAdd style={{ boxSizing: "content-box" }} color={color?color:undefined} />}
        px={px}
        py={py}
        mb={mb}
        borderRadius="lg"
        fontWeight="medium"
        fontSize="md"
        _hover={{ bg: "gray.100" }}
        onClick={handleOpen}
        onPointerDown={(e) => e.stopPropagation()} // evita interferir con drag (dnd-kit)
      >{text}</Button>

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
