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
import { MdUnarchive } from "react-icons/md";

type UnarchiveButtonProps = {
    id: string;
    modelName: string;
    defaultPosition?: number;
    onSuccess?: (itemId: string) => void;
};

export default function UnarchiveItemButton({
    id,
    modelName,
    defaultPosition = 0,
    onSuccess,
}: UnarchiveButtonProps) {
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [targetId, setTargetId] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const { mutate, isPending } = useUpdateItems();

    const confirmUnarchive = (itemId: string) => {
        setTargetId(itemId);
        onOpen();
    };

    const handleUnarchive = () => {
        if (!targetId) return;

        const payload: UpdatePayload[] = [
            {
                table: modelName,
                id_field: "_id",
                id_value: targetId,
                data: { position: defaultPosition },
            },
        ];

        mutate(payload, {
            onSuccess: () => {
                if (onSuccess) {
                    onSuccess(targetId);
                } else {
                    queryClient.invalidateQueries({ queryKey: ["DraggableCards"] });
                    queryClient.invalidateQueries({ queryKey: ["Appointment"] });
                    queryClient.invalidateQueries({ queryKey: [modelName] });
                    queryClient.invalidateQueries({ queryKey: ["conversations"] });
                }
            },
            onSettled: () => onClose(),
        });
    };

    return (
        <>
            <Tooltip label="Restore" aria-label="Restore tooltip">
                <IconButton
                    aria-label="Unarchive"
                    icon={<MdUnarchive />}
                    size="sm"
                    variant="ghost"
                    colorScheme="green"
                    isDisabled={isPending}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        confirmUnarchive(id);
                    }}
                />
            </Tooltip>

            <Modal isOpen={isOpen} onClose={isPending ? () => { } : onClose} isCentered>
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>Confirm restore</ModalHeader>
                    <ModalBody>
                        <Text>Are you sure you want to restore this item?</Text>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="ghost" onClick={onClose} isDisabled={isPending}>
                            Cancel
                        </Button>
                        <Button colorScheme="green" ml={3} onClick={handleUnarchive} isLoading={isPending}>
                            Restore
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
}
