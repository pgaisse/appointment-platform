import { IconType } from "react-icons";
import { FiHome, FiCalendar } from "react-icons/fi";
import { FaUserCircle, FaRegCalendarCheck } from "react-icons/fa";
import { MdTextsms } from "react-icons/md";
import { LuUserRoundSearch } from "react-icons/lu";
import { HiOutlineClipboardDocumentCheck } from "react-icons/hi2";
import { TbCalendarPlus, TbSortAscendingSmallBig } from "react-icons/tb";

import paths from "./path";

export type NavRoute = {
  key: string;
  path: string;                // "/x" o "x"
  label?: string;
  icon?: IconType;             // ⬅️ importante
  requireAuth?: boolean;
  requireAnyPerms?: string[];
  requireAllPerms?: string[];
  forbidPerms?: string[];
  showInHeader?: boolean;
  showInSidebar?: boolean;
  order?: number;
  children?: NavRoute[];
};

export const NAV_ROUTES: NavRoute[] = [
  {
    key: "root",
    path: paths.root, // "/"
    children: [
      {
        key: "home",
        path: "",
        label: "Home",
        icon: FiHome,
        showInHeader: true,
        showInSidebar: true,
        order: 10,
        requireAuth: false,
      },

      // Auth
     

      // Appointments (grupo con hijas, todas con ícono)
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
          { key: "appointments.index", path: "" }, // portada del grupo
          {
            key: "appointments.priorityList",
            path: "priority-list",
            label: "Priority List",
            icon: TbSortAscendingSmallBig,
            showInSidebar: true,
            order: 21,
          },
          {
            key: "appointments.manager",
            path: "appointment-manager",
            label: "Appointment Manager",
            icon: TbCalendarPlus,
            showInSidebar: true,
            order: 22,
          },
          {
            key: "appointments.patientFinder",
            path: "patient-finder",
            label: "Patient Finder",
            icon: LuUserRoundSearch,
            showInSidebar: true,
            order: 23,
          },
          {
            key: "appointments.assigned",
            path: "assigned-appointments",
            label: "Assigned Appointments",
            icon: HiOutlineClipboardDocumentCheck,
            showInSidebar: true,
            order: 24,
          },
        ],
      },

      // Messages
      {
        key: "messages",
        path: paths.messages,
        label: "Messages",
        icon: MdTextsms,                // ⬅️ antes faltaba
        showInHeader: true,
        showInSidebar: true,
        order: 30,
        requireAuth: true,
      },

      // Organizer
      {
        key: "organizer",
        path: paths.organizer,
        label: "Organizer",
        icon: FaRegCalendarCheck,       // ⬅️ antes faltaba
        showInHeader: true,
        showInSidebar: true,
        order: 40,
        requireAuth: true,
      },

      // Admin
      {
        key: "admin",
        path: paths.roles, // "/admin/access"
        label: "Admin",
        icon: FaUserCircle,             // opcional: cambia si quieres otro
        showInSidebar: true,
        order: 800,
        requireAuth: true,
        requireAnyPerms: ["dev-admin", "admin:*"],
      },


     
    ],
  },
];
