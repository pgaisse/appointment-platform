// apps/frontend/src/Routes/routes.registry.tsx
import Layout from "./Layout";
import Home from "./Home/Index";
import SignIn from "./SignIn";
import Profile from "./Profile";
import Appointments from "./Appointments";
import AppointmentList from "./Appointments/AppointmentList";
import AppointmentManager from "./Appointments/AppointmentManager";
import PatientFinder from "./Appointments/PatientFinder";
import AssignedAppointments from "./Appointments/AssignedAppointments";
import CustomChat from "./Messages/CustomChat";
import ChatHealth from "./Messages/ChatHealth";
import Organizer from "./Organizer";
import LogOut from "./LogOut";
import UsersManager from "./Admin/UsersManager";
import PriorityCategoryManager from "./Settings";

const registry = {
  Layout: <Layout />,
  Home: <Home />,
  SignIn: <SignIn />,
  Profile: <Profile />,
  Appointments: <Appointments />,
  AppointmentList: <AppointmentList />,
  AppointmentManager: <AppointmentManager />,
  PatientFinder: <PatientFinder />,
  AssignedAppointments: <AssignedAppointments />,
  CustomChat: <CustomChat />,
  ChatHealth: <ChatHealth />,
  Organizer: <Organizer />,
  LogOut: <LogOut />,
  UsersManager: <UsersManager />,
  Settings: <PriorityCategoryManager/>
} as const;

export type ComponentKey = keyof typeof registry;

export function getElementByKey(key?: string) {
  if (!key) return undefined;
  return registry[key as ComponentKey];
}
