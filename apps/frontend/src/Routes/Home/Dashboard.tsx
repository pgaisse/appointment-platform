// apps/frontend/src/Routes/Home/Dashboard.tsx
import React from "react";
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
} from "@chakra-ui/react";
import {
  FiCalendar,
  FiMessageSquare,
  FiUsers,
  FiClock,
  FiCheckCircle,
  FiAlertCircle,
  FiActivity,
  FiSend,
  FiTrendingUp,
} from "react-icons/fi";
import { StatCard } from "@/Components/Dashboard/StatCard";
import { QuickAction } from "@/Components/Dashboard/QuickAction";
import { useDashboardStats } from "@/Hooks/Query/useDashboardStats";
import { useProfile } from "@/Hooks/Query/useProfile";

const Dashboard: React.FC = () => {
  const { data: stats, isLoading, isError, error } = useDashboardStats();
  const { data: profile } = useProfile();
  
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
              lg: "repeat(4, 1fr)",
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
            />
            <StatCard
              title="This Week"
              value={stats?.appointments.thisWeek || 0}
              icon={FiActivity}
              color="purple"
              subtitle="Appointments this week"
              isLoading={isLoading}
            />
            <StatCard
              title="Messages Today"
              value={stats?.messages.today || 0}
              icon={FiSend}
              color="green"
              subtitle="Sent today"
              isLoading={isLoading}
            />
            <StatCard
              title="Messages This Month"
              value={stats?.messages.thisMonth || 0}
              icon={FiTrendingUp}
              color="teal"
              subtitle="Sent this month"
              isLoading={isLoading}
            />
          </Grid>

          {/* Secondary Stats */}
          <Grid
            templateColumns={{
              base: "repeat(1, 1fr)",
              md: "repeat(2, 1fr)",
              lg: "repeat(4, 1fr)",
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
            />
            <StatCard
              title="Completed"
              value={stats?.appointments.completed || 0}
              icon={FiCheckCircle}
              color="green"
              subtitle="This month"
              isLoading={isLoading}
            />
            <StatCard
              title="Urgent"
              value={stats?.pending.urgent || 0}
              icon={FiAlertCircle}
              color="red"
              subtitle="Require attention"
              isLoading={isLoading}
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
      </Container>
    </Box>
  );
};

export default Dashboard;
