import { useState } from "react";
import {
    IconButton,
    useDisclosure,
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Text,
} from "@chakra-ui/react";
import { ImBin } from "react-icons/im";
import { useQueryClient } from "@tanstack/react-query";
import { useDeleteItem } from "@/Hooks/Query/useDeleteItem";

type DeleteButtonProps = {
    id: string;
    modelName: string; // "Appointment" | "treatments" | "prioritylist" etc.
    refetch?: () => void;
    searchRef?: React.RefObject<{ clearInput: () => void }>;
    trigger?: { mutate: () => void };
    setFilteredItems?: (items: any[] | null) => void;
};

export default function DeleteItemButton({
    id,
    modelName,
    searchRef,
    trigger,
    setFilteredItems,
}: DeleteButtonProps) {
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const { deleteById } = useDeleteItem({
        modelName,
    });

    const confirmDelete = (itemId: string) => {
        console.log("ESTE ES EL ID:", itemId);
        setItemToDelete(itemId);
        onOpen();
    };

    const handleDelete = () => {
        if (deleteById && itemToDelete) {
            deleteById(itemToDelete);

            // 🔄 limpieza y refresco
            searchRef?.current?.clearInput();
            queryClient.invalidateQueries({ queryKey: [modelName] });
            queryClient.refetchQueries({ queryKey: ["DraggableCards"] });
            queryClient.invalidateQueries({ queryKey: ["Appointment"] });
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
            setFilteredItems?.(null);
            trigger?.mutate();
        }
        onClose();
    };

    return (
        <>
            <IconButton
                aria-label="Delete"
                icon={<ImBin />}
                size="sm"
                variant="ghost"
                colorScheme="red"
                onClick={(e) => {
                    e.preventDefault();   // ⛔ previene arrastres
                    e.stopPropagation();  // ⛔ no deja que se dispare el drag del padre
                    confirmDelete(id);
                }}
            />

            {/* Modal de confirmación */}
            <Modal isOpen={isOpen} onClose={onClose} isCentered>
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>Confirm deletion</ModalHeader>
                    <ModalBody>
                        <Text>Are you sure you want to delete this item?</Text>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="ghost" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button colorScheme="red" ml={3} onClick={handleDelete}>
                            Delete
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
}
