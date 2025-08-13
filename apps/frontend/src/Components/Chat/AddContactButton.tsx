import { Button, Icon, useColorModeValue } from "@chakra-ui/react";
import { FiUserPlus } from "react-icons/fi";
import { ManualContactFormModal } from "./ManualContactFormModal";

type Props = {
    isOpen: boolean
    onClose: () => void
    onOpen: () => void
};



export const AddContactButton: React.FC<Props> = ({onClose, isOpen, onOpen }) => {
    const bg = useColorModeValue("white", "gray.700");
    const hoverBg = useColorModeValue("gray.100", "gray.600");
    const border = useColorModeValue("1px solid #E2E8F0", "1px solid #2D3748");


    return (
        <>

            <Button
                leftIcon={<Icon as={FiUserPlus} boxSize={5} />}
                onClick={onOpen}
                variant="ghost"
                width="100%"
                justifyContent="start"
                bg={"bg"}
                border={border}
                borderRadius="xl"
                boxShadow="sm"
                _hover={{ bg: hoverBg, boxShadow: "md" }}
                transition="all 0.2s ease-in-out"
                fontWeight="normal"
            >
                Add contact Manually
            </Button>

            <ManualContactFormModal
                mode="CREATION"
                isOpen={isOpen}
                onClose={onClose}
                onOpen={onOpen}
            />

        </>
    );
};
