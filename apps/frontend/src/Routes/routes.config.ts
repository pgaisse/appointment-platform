// apps/frontend/src/Routes/routes.config.ts
import React from "react";
import { IconType } from "react-icons";
import { FiHome, FiCalendar } from "react-icons/fi";
import { FaUserCircle, FaRegCalendarCheck } from "react-icons/fa";
import { MdTextsms } from "react-icons/md";
import { LuUserRoundSearch } from "react-icons/lu";
import { HiOutlineClipboardDocumentCheck } from "react-icons/hi2";
import { TbCalendarPlus, TbSortAscendingSmallBig } from "react-icons/tb";
import paths from "./path";

/** Dónde mostrar el link */
export type WhereToShow = "header" | "sidebar";

/**
 * Props “like Gate” sin children.
 * OJO: NO importamos Gate aquí para evitar ciclos en tiempo de ejecución;
 * usamos un tipo compatible (passthrough).
 */
export type GateLike = {
    requireAuth?: boolean;
    requireRole?: string[];
    requireAllPerms?: string[];
    requireAnyPerms?: string[];
    forbidPerms?: string[];
    source?: "token" | "access" | "both" | "all";
    loadingFallback?: React.ReactNode;
    fallback?: React.ReactNode;
    /** Syntactic sugar: si requireAuth y no está autenticado, redirige aquí */
    redirectToOnUnauthed?: string;
};

export type RouteLink = {
    key: string;
    /** Absoluto "/x" o relativo "x" (si es hijo) */
    path: string;
    /** Clave para mapear al componente en routes.registry.tsx */
    componentKey?: string;
    label?: string;
    icon?: IconType;
    show?: WhereToShow[]; // ["header","sidebar"] | ["sidebar"] | ["header"] | []
    order?: number;
    gate?: boolean | GateLike;   // ⬅️ AQUÍ defines TODO lo de Gate
    children?: RouteLink[];
};

export const ROUTE_LINKS: RouteLink[] = [
    {
        key: "root",
        path: paths.root, // "/"
        componentKey: "Layout",
        // si quieres obligar login para TODO el arbol, puedes poner:
        // gate: { requireAuth: true, source: "all", redirectToOnUnauthed: "/signin" },
        children: [
            {
                key: "home",
                path: "",
                componentKey: "Home",
                label: "Home",
                icon: FiHome,
                show: ["header", "sidebar"],
                order: 10,
                gate: { requireAuth: false }, // público
            },

            // Auth
            {
                key: "signin",
                path: paths.signin,
                componentKey: "SignIn",
                label: "Sign in",
                icon: FaUserCircle,
                show: ["header"],
                order: 900,
                gate: { requireAuth: false },
            },
            {
                key: "profile",
                path: paths.profile,
                componentKey: "Profile",
                label: "Profile",
                icon: FaUserCircle,
                show: [], // oculto de menús
                gate: { requireAuth: true, source: "all", redirectToOnUnauthed: "/signin" },
            },

            // Appointments (grupo)
            {
                key: "appointments",
                path: paths.appointments,
                label: "Appointments",
                icon: FiCalendar,
                show: ["header", "sidebar"],
                order: 20,
                gate: { requireAuth: true, source: "all", redirectToOnUnauthed: "/signin" },
                children: [
                    { key: "appointments.index", path: "", componentKey: "Appointments" },
                    {
                        key: "appointments.priorityList",
                        path: "priority-list",
                        componentKey: "AppointmentList",
                        label: "Priority List",
                        icon: TbSortAscendingSmallBig,
                        show: ["sidebar"],
                        order: 21,
                    },
                    {
                        key: "appointments.manager",
                        path: "appointment-manager",
                        componentKey: "AppointmentManager",
                        label: "Appointment Manager",
                        icon: TbCalendarPlus,
                        show: ["sidebar"],
                        order: 22,
                    },
                    {
                        key: "appointments.patientFinder",
                        path: "patient-finder",
                        componentKey: "PatientFinder",
                        label: "Patient Finder",
                        icon: LuUserRoundSearch,
                        show: ["sidebar"],
                        order: 23,
                    },
                    {
                        key: "appointments.assigned",
                        path: "assigned-appointments",
                        componentKey: "AssignedAppointments",
                        label: "Assigned Appointments",
                        icon: HiOutlineClipboardDocumentCheck,
                        show: ["sidebar"],
                        order: 24,
                    },
                ],
            },

            // Messages
            {
                key: "messages",
                path: paths.messages,
                componentKey: "CustomChat",
                label: "Messages",
                icon: MdTextsms,
                show: ["header", "sidebar"],
                order: 30,
                gate: { requireAuth: true, source: "all", redirectToOnUnauthed: "/signin" },
            },

            // Organizer
            {
                key: "organizer",
                path: paths.organizer,
                componentKey: "Organizer",
                label: "Organizer",
                icon: FaRegCalendarCheck,
                show: ["header", "sidebar"],
                order: 40,
                gate: { requireAuth: true, source: "all", redirectToOnUnauthed: "/signin" },
            },

            // Admin (permisos avanzados con Gate)
            {
                key: "admin",
                path: paths.roles,
                componentKey: "UsersManager",
                label: "Settings",
                icon: FaUserCircle,
                show: ["sidebar"],
                order: 850,
                gate: {
                    // ✅ usa los claims del ID token (los que ves en console.log de user)
                    source: "token",

                    // ✅ exige login y redirige si no hay sesión
                    requireAuth: true,
                    redirectToOnUnauthed: "/signin",

                    // ✅ permisos o rol (cualquiera de los dos te habilita)
                    
                    requireRole: ["Admin"],
                },
            },


          
            // Logout
            {
                key: "logout",
                path: paths.logout,
                componentKey: "LogOut",
                label: "Log out",
                icon: FaUserCircle,
                show: ["header"],
                order: 999,
                gate: { requireAuth: true, source: "all", redirectToOnUnauthed: "/signin" },
            },
        ],
    },
];
