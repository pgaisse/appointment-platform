import { useSocket } from '@/Hooks/Query/useSocket';
import { useEffect, useState } from 'react';
import {
    useToast,
    Box,
    Text,
    Flex,
    Icon,
    CloseButton,
} from '@chakra-ui/react';
import { CheckCircleIcon, WarningIcon } from '@chakra-ui/icons';
import { useQueryClient } from '@tanstack/react-query';

type MSG = {
    notification: boolean;
    from: string;
    body: string;
    name: string;
    date: string;
    receivedAt: Date;
    decision: 'confirmed' | 'declined' | 'reschedule' | 'unknown';
};

export const SocketNotification = () => {
    
    const { socket, connected } = useSocket();
    const [, setMessages] = useState<MSG[]>([]);
    const toast = useToast();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!socket || !connected) return;

        const handleSMS = (data: MSG) => {
            if (!data.notification) return;
console.log('SocketNotification - decision:', data.decision);
            setMessages((prev) => [...prev, data]);

            const baseProps = {
                duration: 5000,
                isClosable: true,
                position: 'top-right' as const,
            };

            const renderToast = (
                status: 'success' | 'error',
                bg: string,
                title: string,
                extra?: string
            ) =>
                toast({
                    ...baseProps,
                    status,
                    render: ({ onClose }) => (
                        <Box
                            p={4}
                            bg={bg}
                            borderRadius="md"
                            color="white"
                            boxShadow="xl"
                            position="relative"
                        >
                            <CloseButton
                                position="absolute"
                                top="0.5rem"
                                right="0.5rem"
                                onClick={onClose}
                                color="white"
                            />
                            <Flex align="center" gap={2}>
                                <Icon
                                    as={
                                        status === 'success'
                                            ? CheckCircleIcon
                                            : WarningIcon
                                    }
                                    boxSize={6}
                                />
                                <Box>
                                    <Text fontWeight="bold">{title}</Text>
                                    {extra && (
                                        <Text fontWeight="bold">{extra}</Text>
                                    )}
                                    <Text fontSize="sm">
                                        From: {`${data.name} (${data.from})`}
                                    </Text>
                                </Box>
                            </Flex>
                        </Box>
                    ),
                });

            // Render según decisión enviada por backend
            
            if (data.decision === 'confirmed') {
                renderToast(
                    'success',
                    'green.500',
                    'Appointment confirmed',
                    `New Appointment Date: ${data.date}`
                );
            } else if (data.decision === 'declined') {
                renderToast(
                    'error',
                    'red.500',
                    'Appointment declined',
                    `Appointment Date: ${data.date}`
                );
            } else if (data.decision === 'reschedule') {
                renderToast(
                    'error',
                    'yellow.500',
                    'Appointment needs reschedule',
                    `Original Appointment Date: ${data.date}`
                );
            }

            queryClient.invalidateQueries({ queryKey: ['Appointment'] });
            queryClient.invalidateQueries({ queryKey: ['DraggableCards'] });
            queryClient.refetchQueries({ queryKey: ['DraggableCards'] });
        };

        socket.on('confirmationResolved', handleSMS);
        return () => {
            socket.off('confirmationResolved', handleSMS);
        };
    }, [socket, connected, toast]);

    return null;
};
