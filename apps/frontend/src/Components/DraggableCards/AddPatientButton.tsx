import {
  Button,
  Flex,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
} from "@chakra-ui/react";
import { AddIcon } from "@chakra-ui/icons";
import { motion } from "framer-motion";
import CustomEntryForm from "../CustomTemplates/CustomEntryForm";
import { Priority } from "@/types";
import { IoMdPersonAdd } from "react-icons/io";

const MotionButton = motion(Button);

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
      <Flex justify="right"
        alignContent={"end"} >
        <MotionButton

          size="xs"
          leftIcon={<IoMdPersonAdd />}
          bgGradient="linear(to-r, teal.400, blue.500)"
          color="white"
          fontSize="xs"
          fontWeight="semibold"
          rounded="full"
          shadow="xl"
          _hover={{ shadow: "2xl", transform: "scale(1.05)" }}
          _active={{ transform: "scale(0.95)" }}
          onClick={onOpen}
        >
        </MotionButton>
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
              onClose_1={onClose} // 👈 importante: ahora pasa el correcto
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
