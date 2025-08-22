import {
  Flex,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  IconButton,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { AiOutlineUserAdd } from "react-icons/ai";
import CustomEntryForm from "../CustomTemplates/CustomEntryForm";
import { Priority } from "@/types";

const MotionIconButton = motion(IconButton);

type Props = {
  priority?: Priority;
};

export default function AddPatientButton({ priority }: Props) {
  const { isOpen, onOpen, onClose } = useDisclosure();

  const toastInfo = {
    title: "Patient added",
    description: "The patient was added successfully",
  };

  return (
    <>
      <Flex justify="right" width="fit-content" alignContent="end" mx={2}>
        <MotionIconButton
          aria-label="Add patient"
          icon={<AiOutlineUserAdd style={{ boxSizing: "content-box" }} />}
          size="sm"
          isRound
          fontSize="12px"      // 👈 controla el ícono
          bgGradient="linear(to-r, teal.400, blue.500)"
          color="white"
          shadow="xl"
          _hover={{ shadow: "2xl", transform: "scale(1.05)" }}
          _active={{ transform: "scale(0.95)" }}
          onClick={onOpen}
        />
      </Flex>

      <Modal isOpen={isOpen} onClose={onClose} isCentered size="2xl">
        <ModalOverlay />
        <ModalContent>
          <ModalCloseButton />
          <ModalBody>
            <CustomEntryForm
              mode="CREATION"
              toastInfo={toastInfo}
              onlyPatient={true}
              priorityVal={priority}
              onClose_1={onClose}
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
