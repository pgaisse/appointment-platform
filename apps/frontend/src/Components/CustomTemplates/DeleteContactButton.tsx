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
    Tooltip,
} from "@chakra-ui/react";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateItems, UpdatePayload } from "@/Hooks/Query/useUpdateItems";
import { DeleteIcon } from "lucide-react";
import { Appointment } from "@/types";
import { unknown } from "zod";
import { ImBin } from "react-icons/im";
import { formatToE164 } from "@/Functions/formatToE164";

type ArchiveButtonProps = {
    item: Appointment;
    modelName: string; // p.ej. "Appointment"
    searchRef?: React.RefObject<{ clearInput: () => void }>;
    trigger?: { mutate: () => void };

    setFilteredItems?: (items: any[] | null) => void;
};

export default function DeleteContactButton({
    item,
    modelName,
    searchRef,
    trigger,
    setFilteredItems,
}: ArchiveButtonProps) {
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [targetId, setTargetId] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const { mutate, isPending } = useUpdateItems();

    const confirmArchive = (itemId: string) => {
        setTargetId(itemId);
        onOpen();
    };

    const handleArchive = () => {
        if (!targetId) return;

        const payload: UpdatePayload[] = [
            {
                table: modelName,       // "Appointment"
                id_field: "_id",
                id_value: targetId,
                data: { nameInput: formatToE164(item.phoneInput), 
                    lastNameInput:'', 
                    unknown:true, 
                    emailInput:'' }, // ✅ solo actualiza 'position'
            },
        ];

        mutate(payload, {
            onSuccess: () => {
                // Limpieza/refresh de caches relacionadas
                searchRef?.current?.clearInput?.();
                queryClient.invalidateQueries({ queryKey: ["DraggableCards"] });
                queryClient.invalidateQueries({ queryKey: ["Appointment"] });
                queryClient.invalidateQueries({ queryKey: [modelName] });
                queryClient.invalidateQueries({ queryKey: ["conversations"] });
                setFilteredItems?.(null);
                trigger?.mutate?.();
            },
            onSettled: () => onClose(),
        });
    };

    return (
        <>
            <Tooltip label="Delete" aria-label="A tooltip">
                <IconButton
                    aria-label="Delete"
                    icon={<ImBin />}
                    size="sm"
                    variant="ghost"
                    colorScheme="red"
                    onClick={(e) => {
                        e.preventDefault();   // ⛔ previene arrastres
                        e.stopPropagation();  // ⛔ no deja que se dispare el drag del padre
                        confirmArchive(item._id);
                    }}
                />
            </Tooltip>

            <Modal isOpen={isOpen} onClose={isPending ? () => { } : onClose} isCentered>
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>Confirm deletion</ModalHeader>
                    <ModalBody>
                        <Text>Are you sure you want to delete this contact?</Text>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="ghost" onClick={onClose} isDisabled={isPending}>
                            Cancel
                        </Button>
                        <Button colorScheme="red" ml={3} onClick={handleArchive} isLoading={isPending}>
                            Delete
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
}
