// apps/frontend/src/Routes/Home/Dashboard.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Grid,
  Heading,
  Text,
  VStack,
  useColorModeValue,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  HStack,
  Button,
  Input,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Avatar,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import {
  FiCalendar,
  FiMessageSquare,
  FiUsers,
  FiClock,
  FiAlertCircle,
  FiActivity,
} from "react-icons/fi";
import { StatCard } from "@/Components/Dashboard/StatCard";
import { QuickAction } from "@/Components/Dashboard/QuickAction";
import { AppointmentDetailsModal } from "@/Components/Dashboard/AppointmentDetailsModal";
import { MessagesDetailsModal } from "@/Components/Dashboard/MessagesDetailsModal";
import AppointmentModal from "@/Components/Modal/AppointmentModal";
import { ModalStackProvider } from "@/Components/ModalStack/ModalStackContext";
import { useDashboardStats } from "@/Hooks/Query/useDashboardStats";
import { useInvalidSidCount } from "@/Hooks/Query/useInvalidSidCount";
import {
  useTodayAppointments,
  useWeekAppointments,
  usePendingAppointments,
  useTodayMessages,
  useMonthMessages,
  useMonthNewPatients,
  useAppointmentsRange,
} from "@/Hooks/Query/useDashboardDetails";
import dayjs from 'dayjs';
import { useProfile } from "@/Hooks/Query/useProfile";
import { getAvatarColors } from "@/utils/avatarColors";

const Dashboard: React.FC = () => {
  const { data: stats, isLoading, isError, error } = useDashboardStats();
  const { data: monthNewPatients = [] } = useMonthNewPatients();
  const { data: profile } = useProfile();
  const navigate = useNavigate();

  // Patients modal state and view selection
  const { isOpen: isPatientsOpen, onOpen: onPatientsOpen, onClose: onPatientsClose } = useDisclosure();
  const [patientsView, setPatientsView] = useState<'today' | 'week' | 'month' | 'range'>('month');
  const [rangeStart, setRangeStart] = useState<string>('');
  const [rangeEnd, setRangeEnd] = useState<string>('');

  // compute ranges
  const todayStart = dayjs().startOf('day').format('YYYY-MM-DD');
  const todayEnd = dayjs().endOf('day').format('YYYY-MM-DD');
  const weekStart = dayjs().startOf('week').format('YYYY-MM-DD');
  const weekEnd = dayjs().endOf('week').format('YYYY-MM-DD');

  // Fetch patients (appointments created) for selected ranges — enabled only when the view is active
  const { data: todayNewPatients = [] } = useAppointmentsRange(todayStart, todayEnd, patientsView === 'today');
  const { data: weekNewPatients = [] } = useAppointmentsRange(weekStart, weekEnd, patientsView === 'week');
  const { data: rangePatients = [] } = useAppointmentsRange(rangeStart, rangeEnd, patientsView === 'range' && !!rangeStart && !!rangeEnd);
  const monthNew = monthNewPatients;

  // Modals state
  const { isOpen: isTodayOpen, onOpen: onTodayOpen, onClose: onTodayClose } = useDisclosure();
  const { isOpen: isWeekOpen, onOpen: onWeekOpen, onClose: onWeekClose } = useDisclosure();
  const { isOpen: isPendingOpen, onOpen: onPendingOpen, onClose: onPendingClose } = useDisclosure();
  const { isOpen: isMessagesOpen, onOpen: onMessagesOpen, onClose: onMessagesClose } = useDisclosure();
  const { isOpen: isAppointmentModalOpen, onOpen: onAppointmentModalOpen, onClose: onAppointmentModalClose } = useDisclosure();

  // Selected appointment for detail modal
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [messageDirection, setMessageDirection] = useState<'outbound' | 'inbound' | 'both'>('outbound');

  // Fetch detailed data
  const { data: todayAppointments = [], isLoading: isLoadingToday } = useTodayAppointments();
  const { data: weekAppointments = [], isLoading: isLoadingWeek } = useWeekAppointments();
  const { data: pendingAppointments = [], isLoading: isLoadingPending } = usePendingAppointments();
  const { data: todayMessages = [], isLoading: isLoadingTodayMsg } = useTodayMessages(messageDirection);
  const { data: monthMessages = [], isLoading: isLoadingMonthMsg } = useMonthMessages(messageDirection);

  // Handler to open appointment detail modal
  const handleAppointmentClick = (appointmentId: string) => {
    setSelectedAppointmentId(appointmentId);
    onAppointmentModalOpen();
  };

  // Handler to navigate to chat with selected conversation
  const handleMessageClick = (conversationId: string) => {
    navigate(`/messages?conversationId=${conversationId}`);
  };

  const bgGradient = useColorModeValue(
    "linear(to-br, blue.50, purple.50)",
    "linear(to-br, gray.900, gray.800)"
  );

  const userName = profile?.dbUser?.name || profile?.tokenUser?.name || "User";
  const firstName = userName.split(" ")[0];
  const permissions = [
    ...(Array.isArray(profile?.dbUser?.permissions) ? profile!.dbUser!.permissions : []),
    ...(Array.isArray(profile?.tokenUser?.permissions) ? profile!.tokenUser!.permissions : []),
  ];
  const hasMaster = permissions.includes('master');
  // Chequeo manual del conteo de invalid SID: no cargar automáticamente
  const {
    data: invalidSidData,
    isFetching: isFetchingInvalidSid,
    isSuccess: isSuccessInvalidSid,
    refetch: refetchInvalidSid,
  } = useInvalidSidCount(false);

  if (isError) {
    return (
      <Container maxW="7xl" py={8}>
        <Alert status="error" borderRadius="lg">
          <AlertIcon />
          <Box>
            <AlertTitle>Error loading dashboard</AlertTitle>
            <AlertDescription>
              {error?.message || "Could not fetch statistics"}
            </AlertDescription>
          </Box>
        </Alert>
      </Container>
    );
  }

  return (
    <Box minH="100vh" bg={bgGradient}>
      <Container maxW="7xl" py={8}>
        <VStack spacing={8} align="stretch">
          {/* Header */}
          <Box>
            <Heading size="xl" mb={2}>
              Welcome back, {firstName}! 👋
            </Heading>
            <Text fontSize="lg" color="gray.600">
              Here's your system overview
            </Text>
          </Box>

          {/* Primary Stats Grid */}
          <Grid
            templateColumns={{
              base: "repeat(1, 1fr)",
              md: "repeat(2, 1fr)",
              lg: "repeat(3, 1fr)",
            }}
            gap={6}
          >
            <StatCard
              title="Appointments Today"
              value={stats?.appointments.today || 0}
              icon={FiCalendar}
              color="blue"
              subtitle="Scheduled for today"
              isLoading={isLoading}
              onClick={onTodayOpen}
              isClickable
            />
            <StatCard
              title="This Week"
              value={stats?.appointments.thisWeek || 0}
              icon={FiActivity}
              color="purple"
              subtitle="Appointments this week"
              isLoading={isLoading}
              onClick={onWeekOpen}
              isClickable
            />
            <StatCard
              title="Messages"
              value={
                <VStack spacing={0} align="start">
                  <Text fontSize="3xl" fontWeight="bold">
                    {stats?.messages.today || 0}
                  </Text>
                  <Text fontSize="sm" color="gray.500">
                    Today • {stats?.messages.thisMonth || 0} this month
                  </Text>
                </VStack>
              }
              icon={FiMessageSquare}
              color="green"
              subtitle="Sent messages"
              isLoading={isLoading}
              onClick={onMessagesOpen}
              isClickable
            />
          </Grid>

          {/* Secondary Stats */}
          <Grid
            templateColumns={{
              base: 'repeat(1, 1fr)',
              md: hasMaster ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
              lg: hasMaster ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
            }}
            gap={6}
          >
            <StatCard
              title="Active Contacts"
              value={stats?.contacts.active || 0}
              icon={FiUsers}
              color="orange"
              subtitle="Active clients"
              isLoading={isLoading}
            />
            <StatCard
              title="New Patients"
              value={stats?.contacts.new || 0}
              icon={FiUsers}
              color="cyan"
              subtitle="Added this month"
              isLoading={isLoading}
              onClick={() => onPatientsOpen()}
              isClickable
            />
            {hasMaster && (
              <StatCard
                title="Invalid Chat SIDs"
                value={(() => {
                  if (isSuccessInvalidSid) return (invalidSidData?.invalidSidCount || 0);
                  if (isFetchingInvalidSid) {
                    const bounce = keyframes`0%{transform:translateY(0);opacity:.6}50%{transform:translateY(-4px);opacity:1}100%{transform:translateY(0);opacity:.6}`;
                    return (
                      <HStack spacing={2}>
                        <HStack spacing={1} onClick={(e)=>{e.stopPropagation(); navigate('/messages/health');}} cursor="pointer" role="link" aria-label="Go to Chat Health">
                          {[0,1,2].map(i => (
                            <Box key={i} w="6px" h="6px" borderRadius="full" bg="gray.500" animation={`${bounce} 1.2s ${i*0.15}s infinite`} />
                          ))}
                        </HStack>
                        <Text fontSize="xs" color="gray.500">Health</Text>
                      </HStack>
                    );
                  }
                  return '—';
                })()}
                valueFontSize={isSuccessInvalidSid ? undefined : (isFetchingInvalidSid ? undefined : 'xl')}
                icon={FiAlertCircle}
                color={!isSuccessInvalidSid ? 'gray' : (invalidSidData?.invalidSidCount || 0) > 0 ? 'red' : 'teal'}
                subtitle={isSuccessInvalidSid ? (invalidSidData?.invalidSidCount || 0) > 0 ? 'Need repair' : 'All healthy' : (isFetchingInvalidSid ? 'Checking…' : 'Tap to check')}
                isLoading={false}
                onClick={() => {
                  if (isFetchingInvalidSid) {
                    navigate('/messages/health');
                  } else if (!isSuccessInvalidSid) {
                    refetchInvalidSid();
                  } else {
                    navigate('/messages/health');
                  }
                }}
                isClickable
              />
            )}

          </Grid>


          <Grid
            templateColumns={{
              base: "repeat(1, 1fr)",
              md: "repeat(1, 1fr)",
            }}
            gap={6}
          >

            <StatCard
              title="Pending"
              value={stats?.pending.total || 0}
              icon={FiClock}
              color="yellow"
              subtitle="Awaiting confirmation"
              isLoading={isLoading}
              onClick={onPendingOpen}
              isClickable
            />
          </Grid>

          {/* Quick Actions */}
          <Box>
            <Heading size="md" mb={4}>
              Quick Actions
            </Heading>
            <Grid
              templateColumns={{
                base: "repeat(1, 1fr)",
                md: "repeat(2, 1fr)",
                lg: "repeat(3, 1fr)",
              }}
              gap={4}
            >
              <QuickAction
                title="Calendar"
                description="View and manage appointments"
                icon={FiCalendar}
                color="blue"
                to="/appointments/assigned-appointments"
              />
              <QuickAction
                title="Messages"
                description="Review conversations"
                icon={FiMessageSquare}
                color="green"
                to="/messages"
              />
   
              <QuickAction
                title="Pending Appointments"
                description="Review pending items"
                icon={FiClock}
                color="orange"
                to="/appointments/priority-list?focus=pending"
              />
              <QuickAction
                title="Reports"
                description="View statistics"
                icon={FiActivity}
                color="pink"
                to="/reports"
              />
              <QuickAction
                title="Settings"
                description="System configuration"
                icon={FiAlertCircle}
                color="gray"
                to="/settings"
              />
            </Grid>
          </Box>
        </VStack>

        {/* Modals */}
        <AppointmentDetailsModal
          isOpen={isTodayOpen}
          onClose={onTodayClose}
          appointments={todayAppointments}
          title="Today's Appointments"
          isLoading={isLoadingToday}
          onAppointmentClick={handleAppointmentClick}
        />

        <AppointmentDetailsModal
          isOpen={isWeekOpen}
          onClose={onWeekClose}
          appointments={weekAppointments}
          title="This Week's Appointments"
          isLoading={isLoadingWeek}
          onAppointmentClick={handleAppointmentClick}
        />

        <AppointmentDetailsModal
          isOpen={isPendingOpen}
          onClose={onPendingClose}
          appointments={pendingAppointments}
          title="Pending Appointments"
          isLoading={isLoadingPending}
          onAppointmentClick={handleAppointmentClick}
        />

        <MessagesDetailsModal
          isOpen={isMessagesOpen}
          onClose={onMessagesClose}
          todayMessages={todayMessages}
          monthMessages={monthMessages}
          isLoadingToday={isLoadingTodayMsg}
          isLoadingMonth={isLoadingMonthMsg}
          onMessageClick={handleMessageClick}
          direction={messageDirection}
          onDirectionChange={setMessageDirection}
        />

        {/* New Patients modal (custom) */}
        <Modal isOpen={isPatientsOpen} onClose={onPatientsClose} size="3xl">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>New patients</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <Tabs index={['today', 'week', 'month', 'range'].indexOf(patientsView)} onChange={(i) => {
                const map: any = ['today', 'week', 'month', 'range'];
                setPatientsView(map[i]);
              }}>
                <TabList>
                  <Tab>Today</Tab>
                  <Tab>This week</Tab>
                  <Tab>This month</Tab>
                  <Tab>Custom range</Tab>
                </TabList>

                <TabPanels>
                  <TabPanel>
                    {/* Today */}
                    <Table size="sm">
                      <Thead>
                        <Tr>
                          <Th>Name</Th>
                          <Th>Phone</Th>
                          <Th>Created</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {(todayNewPatients || []).map((a: any) => {
                          const rawName = ([a.nameInput].filter(Boolean).join(' ') || '');
                          const cleaned = rawName.replace(/\s+/g, ' ').trim();
                          const displayName = cleaned
                            ? cleaned
                              .split(' ')
                              .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                              .join(' ')
                            : '—';
                          return (
                            <Tr key={a._id} _hover={{ bg: 'blackAlpha.50' }} onClick={() => handleAppointmentClick(a._id)} style={{ cursor: 'pointer' }}>
                              <Td>
                                <HStack spacing={3} align="center">
                                  <Avatar size="sm" {...getAvatarColors(a.color)} name={displayName}></Avatar>
                                  <Box>{displayName}</Box>
                                </HStack>
                              </Td>
                              <Td>{a.phoneInput || a.phoneE164 || '—'}</Td>
                              <Td>{a.createdAt ? new Date(a.createdAt).toLocaleString() : '—'}</Td>
                            </Tr>
                          );
                        })}
                        {(todayNewPatients || []).length === 0 && (
                          <Tr><Td colSpan={3}><Text color="gray.500">No patients added today.</Text></Td></Tr>
                        )}
                      </Tbody>
                    </Table>
                  </TabPanel>
                  <TabPanel>
                    {/* Week */}
                    <Table size="sm">
                      <Thead>
                        <Tr>
                          <Th>Name</Th>
                          <Th>Phone</Th>
                          <Th>Created</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {(weekNewPatients || []).map((a: any) => {
                          const rawName = ([a.nameInput].filter(Boolean).join(' ') || '');
                          const cleaned = rawName.replace(/\s+/g, ' ').trim();
                          const displayName = cleaned
                            ? cleaned
                              .split(' ')
                              .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                              .join(' ')
                            : '—';
                          return (
                            <Tr key={a._id} _hover={{ bg: 'blackAlpha.50' }} onClick={() => handleAppointmentClick(a._id)} style={{ cursor: 'pointer' }}>
                              <Td>
                                <HStack spacing={3} align="center">
                                  <Avatar size="sm" {...getAvatarColors(a.color)} name={displayName}></Avatar>
                                  <Box>{displayName}</Box>
                                </HStack>
                              </Td>
                              <Td>{a.phoneInput || a.phoneE164 || '—'}</Td>
                              <Td>{a.createdAt ? new Date(a.createdAt).toLocaleString() : '—'}</Td>
                            </Tr>
                          );
                        })}
                        {(weekNewPatients || []).length === 0 && (
                          <Tr><Td colSpan={3}><Text color="gray.500">No patients added this week.</Text></Td></Tr>
                        )}
                      </Tbody>
                    </Table>
                  </TabPanel>
                  <TabPanel>
                    {/* Month */}
                    <Table size="sm">
                      <Thead>
                        <Tr>
                          <Th>Name</Th>
                          <Th>Phone</Th>
                          <Th>Created</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {(monthNew || []).map((a: any) => {
                          const rawName = ([a.nameInput].filter(Boolean).join(' ') || '');
                          const cleaned = rawName.replace(/\s+/g, ' ').trim();
                          const displayName = cleaned
                            ? cleaned
                              .split(' ')
                              .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                              .join(' ')
                            : '—';
                          return (
                            <Tr key={a._id} _hover={{ bg: 'blackAlpha.50' }} onClick={() => handleAppointmentClick(a._id)} style={{ cursor: 'pointer' }}>
                              <Td>
                                <HStack spacing={3} align="center">
                                  <Avatar size="sm" {...getAvatarColors(a.color)} name={displayName}></Avatar>
                                  <Box>{displayName}</Box>
                                </HStack>
                              </Td>
                              <Td>{a.phoneInput || a.phoneE164 || '—'}</Td>
                              <Td>{a.createdAt ? new Date(a.createdAt).toLocaleString() : '—'}</Td>
                            </Tr>
                          );
                        })}
                        {(monthNew || []).length === 0 && (
                          <Tr><Td colSpan={3}><Text color="gray.500">No patients added this month.</Text></Td></Tr>
                        )}
                      </Tbody>
                    </Table>
                  </TabPanel>
                  <TabPanel>
                    {/* Range */}
                    <HStack mb={3} spacing={3}>
                      <Input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
                      <Input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
                      <Button colorScheme="teal" onClick={() => setPatientsView('range')}>Load</Button>
                    </HStack>
                    <Table size="sm">
                      <Thead>
                        <Tr>
                          <Th>Name</Th>
                          <Th>Phone</Th>
                          <Th>Created</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {(rangePatients || []).map((a: any) => {
                          const rawName = ([a.nameInput].filter(Boolean).join(' ') || '');
                          const cleaned = rawName.replace(/\s+/g, ' ').trim();
                          const displayName = cleaned
                            ? cleaned
                              .split(' ')
                              .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                              .join(' ')
                            : '—';
                          return (
                            <Tr key={a._id} _hover={{ bg: 'blackAlpha.50' }} onClick={() => handleAppointmentClick(a._id)} style={{ cursor: 'pointer' }}>
                              <Td>
                                <HStack spacing={3} align="center">
                                  <Avatar size="sm" {...getAvatarColors(a.color)} name={displayName}></Avatar>
                                  <Box>{displayName}</Box>
                                </HStack>
                              </Td>
                              <Td>{a.phoneInput || a.phoneE164 || '—'}</Td>
                              <Td>{a.createdAt ? new Date(a.createdAt).toLocaleString() : '—'}</Td>
                            </Tr>
                          );
                        })}
                        {(rangePatients || []).length === 0 && (
                          <Tr><Td colSpan={3}><Text color="gray.500">No patients in the selected range.</Text></Td></Tr>
                        )}
                      </Tbody>
                    </Table>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" onClick={onPatientsClose}>Close</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Appointment Detail Modal */}
        {selectedAppointmentId && (
          <ModalStackProvider>
            <AppointmentModal
              id={selectedAppointmentId}
              isOpen={isAppointmentModalOpen}
              onClose={onAppointmentModalClose}
            />
          </ModalStackProvider>
        )}
      </Container>
    </Box>
  );
};

export default Dashboard;
