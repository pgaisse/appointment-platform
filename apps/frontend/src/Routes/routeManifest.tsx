// apps/frontend/src/Routes/routeManifest.tsx
import { FiHome, FiCalendar } from "react-icons/fi";
import { IoSettingsOutline } from "react-icons/io5";
import { FaUserCircle } from "react-icons/fa";

import paths from "./path";

// Páginas
import Layout from "@/Routes/Layout";
import Home from "./Home/Index";
import SignIn from "./SignIn";
import Profile from "./Profile";
import Appointments from "./Appointments";
import AppointmentList from "./Appointments/AppointmentList";
import AppointmentManager from "./Appointments/AppointmentManager";
import PatientFinder from "./Appointments/PatientFinder";
import AssignedAppointments from "./Appointments/AssignedAppointments";
import CustomChat from "./Messages/CustomChat";
import Organizer from "./Organizer";
import LogOut from "./LogOut";
import UsersManager from "./Admin/UsersManager";
import { JSX } from "react";

export type AppRoute = {
  key: string;
  path: string;               // absoluto "/x" o relativo "x"
  label?: string;             // para menús
  icon?: any;                 // IconType (dejamos any para simplicidad tipada)
  element?: JSX.Element;      // componente a renderizar
  requireAuth?: boolean;      // login requerido
  requireAnyPerms?: string[]; // Gate
  requireAllPerms?: string[];
  forbidPerms?: string[];
  showInHeader?: boolean;     // aparece en Header
  showInSidebar?: boolean;    // aparece en SideBar
  order?: number;             // orden en menús
  children?: AppRoute[];
};

// Manifest central
export const ROUTES: AppRoute[] = [
  {
    key: "root",
    path: paths.root,     // "/"
    element: <Layout />,
    children: [
      { key: "home", path: "", element: <Home />, label: "Home", icon: FiHome, showInHeader: true, showInSidebar: true, order: 10, requireAuth: false },

      // Auth
      { key: "signin", path: paths.signin, element: <SignIn />, label: "Sign in", icon: FaUserCircle, showInHeader: true, order: 900, requireAuth: false },
      { key: "profile", path: paths.profile, element: <Profile />, label: "Profile", icon: FaUserCircle, showInHeader: false, showInSidebar: false, requireAuth: true },

      // Appointments (grupo)
      {
        key: "appointments",
        path: paths.appointments, // "/appointments"
        label: "Appointments",
        icon: FiCalendar,
        showInHeader: true,
        showInSidebar: true,
        order: 20,
        requireAuth: true,
        children: [
          { key: "appointments.index", path: "", element: <Appointments /> },
          { key: "appointments.priorityList", path: "priority-list", element: <AppointmentList />, label: "Priority List", showInSidebar: true, order: 21 },
          { key: "appointments.manager", path: "appointment-manager", element: <AppointmentManager />, label: "Appointment Manager", showInSidebar: true, order: 22 },
          { key: "appointments.patientFinder", path: "patient-finder", element: <PatientFinder />, label: "Patient Finder", showInSidebar: true, order: 23 },
          { key: "appointments.assigned", path: "assigned-appointments", element: <AssignedAppointments />, label: "Assigned Appointments", showInSidebar: true, order: 24 },
        ],
      },

      // Messages
      { 
        key: "messages", 
        path: paths.messages, 
        element: <CustomChat />, 
        label: "Messages", 
        showInHeader: true, 
        showInSidebar: true, 
        order: 30, 
        requireAuth: true 
      },

      // Organizer
      { key: "organizer", 
        path: paths.organizer, 
        element: <Organizer />, 
        label: "Organizer", 
        showInHeader: true, 
        showInSidebar: true, 
        order: 40, 
        requireAuth: true 
      
      },

      // Admin (requiere permisos)
      {
        key: "roles",
        path: paths.roles, // "/admin/access"
        element: <UsersManager />,
        label: "Admin",
        showInSidebar: true,
        order: 800,
        requireAuth: true,
        requireAnyPerms: ["dev-admin", "admin:*"],
      },



      // Logout
      {
        key: "logout",
        path: paths.logout, // "/logout"
        element: <LogOut />,
        label: "Log out",
        showInHeader: true,
        order: 999,
        requireAuth: true,
      },
    ],
  },
];
