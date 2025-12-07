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
import { IoMdClose } from "react-icons/io";

type ArchiveButtonProps = {
    id: string;
    modelName: string; // p.ej. "Appointment"
    searchRef?: React.RefObject<{ clearInput: () => void }>;
    trigger?: { mutate: () => void };
    setFilteredItems?: (items: any[] | null) => void;
    onSuccess?: (itemId: string) => void; // ✅ Callback personalizado para optimizar actualizaciones
};

export default function ArchiveItemButton({
    id,
    modelName,
    searchRef,
    trigger,
    setFilteredItems,
    onSuccess,
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
                data: { position: -1 }, // ✅ solo actualiza 'position'
            },
        ];

        mutate(payload, {
            onSuccess: () => {
                // ✅ Si hay callback personalizado, usarlo en lugar de invalidar todo
                if (onSuccess) {
                    onSuccess(targetId);
                } else {
                    // Comportamiento por defecto: invalidar todas las queries relacionadas
                    searchRef?.current?.clearInput?.();
                    queryClient.invalidateQueries({ queryKey: ["DraggableCards"] });
                    queryClient.invalidateQueries({ queryKey: ["Appointment"] });
                    queryClient.invalidateQueries({ queryKey: [modelName] });
                    queryClient.invalidateQueries({ queryKey: ["conversations"] });
                    setFilteredItems?.(null);
                    trigger?.mutate?.();
                }
            },
            onSettled: () => onClose(),
        });
    };

    return (
        <>
            <Tooltip label="Discard" aria-label="A tooltip">
                <IconButton
                    aria-label="Archive"
                    icon={<IoMdClose />}
                    size="sm"
                    variant="ghost"
                    colorScheme="red"
                    isDisabled={isPending}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation(); // evita drag de padre
                        confirmArchive(id);
                    }}
                />
            </Tooltip>

            <Modal isOpen={isOpen} onClose={isPending ? () => { } : onClose} isCentered>
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>Confirm discard</ModalHeader>
                    <ModalBody>
                        <Text>Are you sure you want to discard this item?</Text>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="ghost" onClick={onClose} isDisabled={isPending}>
                            Cancel
                        </Button>
                        <Button colorScheme="red" ml={3} onClick={handleArchive} isLoading={isPending}>
                            Discard
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
}
