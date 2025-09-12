// apps/frontend/src/Routes/path/index.tsx
import { IconType } from "react-icons";
import { FiHome} from "react-icons/fi";
import { FaUserCircle, FaRegCalendarCheck } from "react-icons/fa";
import { MdTextsms } from "react-icons/md";
import { LuCalendarCog, LuUserRoundSearch } from "react-icons/lu";
import { HiOutlineClipboardDocumentCheck } from "react-icons/hi2";
import { TbCalendarPlus, TbSortAscendingSmallBig } from "react-icons/tb";

const paths = {
  root: "/",
  signin: "/signin",
  profile: "/profile",
  messages: "/messages",
  chat: "/messages/custom-chat",
  appointments: "/appointments",
  appointmentManager: "/appointments/appointment-manager",
  appointmentList: "/appointments/priority-list",
  patientFinder: "/appointments/patient-finder",
  assignedAppointments: "/appointments/assigned-appointments",
  organizer: "/organizer",
  settings: "/settings",
  logout: "/logout",
  roles: "/admin/access",
};

export default paths;

/** Dónde mostrar cada link */
type WhereToShow = "header" | "sidebar";

/** Zonas/áreas dentro de cada componente */
export type HeaderZone = "main" | "session";
export type SidebarZone = "main" | "bottom";

/** Link de navegación + reglas + zonas */
export type NavLink = {
  key: string;
  path: string;
  label: string;
  icon?: IconType;
  show: WhereToShow[];          // ["header","sidebar"] | ["sidebar"] | ["header"]
  order?: number;
  // Zonas (opcionales): si no se setean, default = "main"
  headerZone?: HeaderZone;      // "main" o "session"
  sidebarZone?: SidebarZone;    // "main" o "bottom"
  // Reglas de acceso
  requireAuth?: boolean;
  requireAnyPerms?: string[];   // pasa si tiene AL MENOS una (wildcards soportados "admin:*")
  requireAllPerms?: string[];   // pasa si tiene TODAS
  forbidPerms?: string[];       // bloquea si tiene alguna
};

/** ÚNICA fuente de verdad para Header/Sidebar (con zonas) */
export const navLinks: NavLink[] = [
  // Home (pública)
  { key: "home", path: paths.root, label: "Home", icon: FiHome, show: ["header", "sidebar"], order: 10, headerZone: "main", sidebarZone: "main" },

  // Appointments (grupo visible) + hijos en sidebar zona "main"
  { key: "appointments", path: paths.appointments, label: "Appointments", icon: TbCalendarPlus, show: ["header", "sidebar"], order: 20, requireAuth: true, headerZone: "main", sidebarZone: "main" },
  { key: "appointments.priorityList", path: paths.appointmentList, label: "Priority List", icon: TbSortAscendingSmallBig, show: ["sidebar"], order: 21, requireAuth: true, sidebarZone: "main" },
  { key: "appointments.manager", path: paths.appointmentManager, label: "Appointment Manager", icon: LuCalendarCog, show: ["sidebar"], order: 22, requireAuth: true, sidebarZone: "main" },
  { key: "appointments.patientFinder", path: paths.patientFinder, label: "Patient Finder", icon: LuUserRoundSearch, show: ["sidebar"], order: 23, requireAuth: true, sidebarZone: "main" },
  { key: "appointments.assigned", path: paths.assignedAppointments, label: "Assigned Appointments", icon: HiOutlineClipboardDocumentCheck, show: ["sidebar"], order: 24, requireAuth: true, sidebarZone: "main" },

  // Messages / Organizer (privadas) → header "main", sidebar "main"
  { key: "messages", path: paths.messages, label: "Messages", icon: MdTextsms, show: ["header", "sidebar"], order: 30, requireAuth: true, headerZone: "main", sidebarZone: "main" },
  { key: "organizer", path: paths.organizer, label: "Organizer", icon: FaRegCalendarCheck, show: ["header", "sidebar"], order: 40, requireAuth: true, headerZone: "main", sidebarZone: "main" },

  // Admin y Settings → sidebar "bottom"
  {
    key: "admin", path: paths.roles, label: "Admin", icon: FaUserCircle, show: ["sidebar"], order: 850, requireAuth: true,
    requireAnyPerms: ["dev-admin", "admin:*"],
    sidebarZone: "bottom"
  },

  // Sesión en Header → zona "session"
  { key: "signin", path: paths.signin, label: "Sign in", icon: FaUserCircle, show: ["header"], order: 900, headerZone: "session" },
  { key: "logout", path: paths.logout, label: "Log out", icon: FaUserCircle, show: ["header"], order: 999, requireAuth: true, headerZone: "session" },
];


/*
export const navLinks: NavLink[] = [
  // Home (pública)
  { key: "home", path: paths.root, label: "Home", icon: FiHome, show: ["header", "sidebar"], order: 10, headerZone: "main", sidebarZone: "main" },

  // Appointments (grupo visible) + hijos en sidebar zona "main"
  { key: "appointments", path: paths.appointments, label: "Appointments", icon: FiCalendar, show: ["header", "sidebar"], order: 20, requireAuth: true, headerZone: "main", sidebarZone: "main" },
  { key: "appointments.priorityList", path: paths.appointmentList, label: "Priority List", icon: TbSortAscendingSmallBig, show: ["sidebar"], order: 21, requireAuth: true, sidebarZone: "main" },
  { key: "appointments.manager", path: paths.appointmentManager, label: "Appointment Manager", icon: TbCalendarPlus, show: ["sidebar"], order: 22, requireAuth: true, sidebarZone: "main" },
  { key: "appointments.patientFinder", path: paths.patientFinder, label: "Patient Finder", icon: LuUserRoundSearch, show: ["sidebar"], order: 23, requireAuth: true, sidebarZone: "main" },
  { key: "appointments.assigned", path: paths.assignedAppointments, label: "Assigned Appointments", icon: HiOutlineClipboardDocumentCheck, show: ["sidebar"], order: 24, requireAuth: true, sidebarZone: "main" },

  // Messages / Organizer (privadas) → header "main", sidebar "main"
  { key: "messages", path: paths.messages, label: "Messages", icon: MdTextsms, show: ["header", "sidebar"], order: 30, requireAuth: true, headerZone: "main", sidebarZone: "main" },
  { key: "organizer", path: paths.organizer, label: "Organizer", icon: FaRegCalendarCheck, show: ["header", "sidebar"], order: 40, requireAuth: true, headerZone: "main", sidebarZone: "main" },

  // Admin y Settings → sidebar "bottom"
  { key: "admin", path: paths.roles, label: "Admin", icon: FaUserCircle, show: ["sidebar"], order: 850, requireAuth: true, 
    requireAnyPerms: ["dev-admin", "admin:*"], 
    sidebarZone: "bottom" },
  
  // Sesión en Header → zona "session"
  { key: "signin", path: paths.signin, label: "Sign in", icon: FaUserCircle, show: ["header"], order: 900, headerZone: "session" },
  { key: "logout", path: paths.logout, label: "Log out", icon: FaUserCircle, show: ["header"], order: 999, requireAuth: true, headerZone: "session" },
];

*/