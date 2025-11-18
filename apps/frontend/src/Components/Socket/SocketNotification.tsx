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
import { PENDING_APPROVALS_QK } from '@/Hooks/Query/usePendingApprovals';
import { DECLINED_APPTS_QK } from '@/Hooks/Query/useDeclinedAppointments';
import { ARCHIVED_APPTS_QK } from '@/Hooks/Query/useArchivedAppointments';

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

        const handleSMS = async (data: MSG) => {
            if (!data.notification) return;
console.log('SocketNotification - decision:', data.decision);
            setMessages((prev) => [...prev, data]);

            // Cancel all queries related to priority columns and approval states to avoid race conditions
            await queryClient.cancelQueries({
                predicate: (q) => {
                    const key = q.queryKey as any[];
                    const head = Array.isArray(key) ? key[0] : undefined;
                    return (
                        head === 'DraggableCards' ||
                        head === 'appointments' ||
                        head === 'appointments-search' ||
                        head === 'Appointment'
                    );
                },
            });

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

            // Invalidate all appointment-related caches so UI reflects latest status quickly
            queryClient.invalidateQueries({ queryKey: ['Appointment'] }); // legacy singular
            queryClient.invalidateQueries({ queryKey: ['appointments'] }); // lists and general views
            queryClient.invalidateQueries({ queryKey: ['appointment:one'] }); // detail pages (prefix)
            queryClient.invalidateQueries({ queryKey: ['appointment-providers'] });
            queryClient.invalidateQueries({ queryKey: ['appointment-provider'] });
            queryClient.invalidateQueries({ queryKey: ['provider-appointments'] });
            queryClient.invalidateQueries({ queryKey: ['appointments-month-days'] });

            // Ensure all useGetCollection('Appointment', filters) queries get marked stale too
            queryClient.invalidateQueries({
                predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'Appointment',
            });

            // Dashboards that visualize appointments
            queryClient.invalidateQueries({ queryKey: ['dashboard-today-appointments'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-week-appointments'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-pending-appointments'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-appointments-range'] });
            // Pending approvals (stable key via dedicated hook)
            queryClient.invalidateQueries({ queryKey: PENDING_APPROVALS_QK as any });
            // Declined and Archived (stable keys)
            queryClient.invalidateQueries({ queryKey: DECLINED_APPTS_QK as any });
            queryClient.invalidateQueries({ queryKey: ARCHIVED_APPTS_QK as any });

            // Contact-related refresh (manual contact flows)
            queryClient.invalidateQueries({ queryKey: ['ManualContact'] });

            // Priority/board views where appointments are surfaced
            queryClient.invalidateQueries({ queryKey: ['DraggableCards'] });
            queryClient.refetchQueries({ queryKey: ['DraggableCards'] });
            // Also invalidate PriorityList consumers (forms/filters) that rely on appointment priority groupings
            queryClient.invalidateQueries({ queryKey: ['PriorityList'] });
        };

        socket.on('confirmationResolved', handleSMS);
        return () => {
            socket.off('confirmationResolved', handleSMS);
        };
    }, [socket, connected, toast, queryClient]);

    return null;
};
