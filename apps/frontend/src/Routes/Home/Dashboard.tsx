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
} from "@chakra-ui/react";
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
import {
  useTodayAppointments,
  useWeekAppointments,
  usePendingAppointments,
  useTodayMessages,
  useMonthMessages,
} from "@/Hooks/Query/useDashboardDetails";
import { useProfile } from "@/Hooks/Query/useProfile";

const Dashboard: React.FC = () => {
  const { data: stats, isLoading, isError, error } = useDashboardStats();
  const { data: profile } = useProfile();
  const navigate = useNavigate();

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
              base: "repeat(1, 1fr)",
              md: "repeat(2, 1fr)",
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
                title="Contacts"
                description="Manage clients"
                icon={FiUsers}
                color="purple"
                to="/clients"
              />
              <QuickAction
                title="Pending Appointments"
                description="Review pending items"
                icon={FiClock}
                color="orange"
                to="/appointments"
              />
              <QuickAction
                title="Reports (no ready yet)"
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
