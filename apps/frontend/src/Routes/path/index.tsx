// apps/frontend/src/Routes/path/index.tsx
import { IconType } from "react-icons";
import { FiHome, FiActivity } from "react-icons/fi";
import { FaUserCircle, FaRegCalendarCheck } from "react-icons/fa";
import { MdTextsms } from "react-icons/md";
import { LuCalendarCog, LuUserRoundSearch } from "react-icons/lu";
import { HiOutlineClipboardDocumentCheck } from "react-icons/hi2";
import { TbCalendarPlus, TbSortAscendingSmallBig } from "react-icons/tb";
import { IoSettingsOutline } from "react-icons/io5";
import { MdHealthAndSafety } from "react-icons/md";
import { FcGoogle } from "react-icons/fc";
import { RiCalendarScheduleLine } from "react-icons/ri";

const paths = {
  root: "/",
  signin: "/login",
  profile: "/profile",
  messages: "/messages",
  chat: "/messages/custom-chat",
  chatHealth: "/messages/health",
  appointments: "/appointments",
  appointmentManager: "/appointments/appointment-manager",
  appointmentList: "/appointments/priority-list",
  patientFinder: "/appointments/patient-finder",
  assignedAppointments: "/appointments/assigned-appointments",
  calendar: "/appointments/calendar",
  googleCalendar: "/google-calendar",
  organizer: "/organizer",
  reports: "/reports",
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



  // Links de appointments en el orden solicitado
  {
    key: "appointments.priorityList",
    path: paths.appointmentList,
    label: "Priority List",
    icon: TbSortAscendingSmallBig,
    show: ["sidebar"],
    order: 10,
    requireAuth: true,
    sidebarZone: "main",
    requireAnyPerms: ['appointment_cards:read']
  },

  // Appointments
  {
    key: "appointments",
    path: paths.appointments,
    label: "Appointments",
    icon: TbCalendarPlus,
    show: ["header", "sidebar"],
    order: 15,
    requireAuth: true,
    headerZone: "main",
    sidebarZone: "main"
  },

  // Messages / Chat
  {
    key: "messages",
    path: paths.messages,
    label: "Messages",
    icon: MdTextsms,
    show: ["header", "sidebar"],
    order: 20,
    requireAuth: true,
    headerZone: "main",
    sidebarZone: "main",
    requireAnyPerms: ['chat:read']

  },


   { key: "appointments.patientFinder", 
    path: paths.patientFinder, 
    label: "Patient Finder", 
    icon: LuUserRoundSearch, 
    show: ["sidebar"], 
    order: 30, 
    requireAuth: true, 
    sidebarZone: "main" },

  {
    key: "appointments.manager",
    path: paths.appointmentManager,
    label: "Appointment Manager",
    icon: LuCalendarCog,
    show: ["sidebar"],
    order: 40,
    requireAuth: true,
    sidebarZone: "main"
  },

  { key: "appointments.assigned", path: paths.assignedAppointments, label: "Assigned Appointments", icon: HiOutlineClipboardDocumentCheck, show: ["sidebar"], order: 50, requireAuth: true, sidebarZone: "main" },

  // Home (protegida)
  {
    key: "home",
    path: paths.root,
    label: "Home", icon: FiHome,
    show: ["header", "sidebar"],
    order: 60,
    requireAuth: true,
    headerZone: "main",
    sidebarZone: "main"
  },

  {
    key: "organizer",
    path: paths.organizer,
    label: "Organizer",
    icon: FaRegCalendarCheck,
    show: ["header", "sidebar"],
    order: 70, requireAuth: true,
    headerZone: "main",
    sidebarZone: "main",

  },

  // Chat Health (movido arriba de Reports)
  {
    key: "chatHealth",
    path: paths.chatHealth,
    label: "Chat Health",
    icon: MdHealthAndSafety,
    show: ["sidebar"],
    order: 798, // justo antes de Reports (799)
    requireAuth: true,
    sidebarZone: "bottom",
    requireAnyPerms: ["master"]
  },

  // Reports
  {
    key: "reports",
    path: paths.reports,
    label: "Reports",
    icon: FiActivity,
    show: ["sidebar"],
    order: 799, // just above Settings (800)
    requireAuth: true,
    sidebarZone: "bottom",
    requireAnyPerms: ["master"]
  },

  // Admin y Settings → sidebar "bottom"
  {
    key: "settings", path: paths.settings, label: "Settings", icon: IoSettingsOutline, show: ["sidebar"], order: 800, requireAuth: true,
    requireAnyPerms: ["support:read", "dev-admin", "admin:*"],
    sidebarZone: "bottom"
  },
  {
    key: "admin", path: paths.roles, label: "Admin", icon: FaUserCircle, show: ["sidebar"], order: 850, requireAuth: true,
    requireAnyPerms: ["dev-admin", "admin:*"],
    sidebarZone: "bottom"
  },

  // Sesión en Header → zona "session"
  { key: "signin", path: paths.signin, label: "Sign in", icon: FaUserCircle, show: ["header"], order: 900, headerZone: "session" },
  { key: "logout", path: paths.logout, label: "Log out", icon: FaUserCircle, show: ["header"], order: 999, requireAuth: true, headerZone: "session" },
];


