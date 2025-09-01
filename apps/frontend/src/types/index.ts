import { DateRange } from "@/Hooks/Handles/useEventSelection";
import { User } from "@auth0/auth0-react";

export interface BackendEvent {
  id: string;
  num: number;
  name: string;
  lastName: string;
  title: string;
  start: Date;
  end: Date;
  desc: string;
  color: string;
  data?: any[]; // Puedes tiparlo mejor si sabes la estructura
  selectedStart?: Date;
  selectedEnd?: Date;
  cat?: string;
  note?: string;
  phoneInput?: string;
  priorityColor?: string;
  otherData?: BackendEvent[];
}

interface EnvConfig {
  AUTH0_DOMAIN: string;
  AUTH0_CLIENT_ID: string;
  AUTH0_AUDIENCE: string;
  BASE_URL: string;
  SERVER_NAME: string;
  VITE_APP_SERVER: string;
  VITE_BASE_URL: string;
  VITE_AUTH0_AUDIENCE: string;
  VITE_AUTH0_CLIENT_ID: string;
  VITE_AUTH0_DOMAIN: string;
  VITE_AUTH0_REDIRECT_URI: string;
  VITE_AUTH0_LOGOUT_REDIRECT_URI: string;
  VITE_AUTH0_SCOPE: string;
  VITE_AUTH0_CACHE_LOCATION: string;
  VITE_AUTH0_USE_REFRESH_TOKENS: boolean;
  VITE_AUTH0_USE_REFRESH_TOKENS_FALLBACK: boolean;
  VITE_AUTH0_ORGANIZATION: string;
  VITE_AUTH0_ORGANIZATION_NAME: string;
  VITE_AUTH0_ORGANIZATION_LOGO: string;
  VITE_AUTH0_ORGANIZATION_ENABLED: boolean;
  VITE_AUTH0_ORGANIZATION_DEFAULT: string;
  VITE_AUTH0_ORGANIZATION_DEFAULT_NAME: string;
  VITE_AUTH0_ORGANIZATION_DEFAULT_LOGO: string;
}

export const env: EnvConfig = (window as any).__ENV__;

export type FormMode = "CREATION" | "EDITION"

export type Event = {
  title: string;
  start: Date;
  end: Date;
  desc: string;
  color: string;
};

export type CalendarEvent = {
  title: string;
  start: Date | undefined;
  end: Date | undefined;
  desc: string;
  color: string;
};

export type DragDropArg<T> = {
  event: T;
  start: Date;
  end: Date;
  allDay?: boolean;
};
// types/CalendarDragTypes.ts (o directamente al inicio de tu archivo si es local)
export type CalendarDragArg<T> = {
  event: T;
  start: Date;
  end: Date;
  allDay?: boolean;
};
// En algún archivo global de tipos, por ejemplo: src/types/reactBigCalendar.d.ts
export type EventDropArg<T> = {
  event: T;
  start: Date;
  end: Date;
  isAllDay?: boolean;
};

// src/types/reactBigCalendar.ts

export type EventResizeDoneArg<T> = {
  event: T;
  start: Date;
  end: Date;
  allDay?: boolean;
};




export type Patient = {
  id: string;
  num: number;
  name: string;
  lastName: string;
  title: string;
  [key: string]: any; // permite campos adicionales
}

export type Patients = Patient[];




export interface AppointmentPriority {
  _id?: string; // opcional si estás trabajando con MongoDB
  organization: string;
  priorities: Priority[];
}


export interface ManualContact {
  _id: string;
  nameInput: string;
  lastNameInput: string;
  phoneInput: string;
  org_id: string;
  org_name: string;
  sid: string;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Priority {
  _id?: string;
  id: number;
  description?: string;
  notes?: string;
  durationHours?: number;
  name: string;
  color: string;
}

export interface Treatment {
  _id: string;            // MongoDB ID
  name: string;           // Nombre del tratamiento
  duration: number;       // Duración en minutos
  icon: string;           // Nombre del icono (ej: "GiToothImplant")
  minIcon: string;
  color: string;          // Código de color (ej: "#BEE3F8" o Chakra color name)
  category?: string;      // Opcional: categoría del tratamiento
  active?: boolean;       // Opcional: si el tratamiento está disponible
  createdAt?: string;     // Automático si usas timestamps en Mongoose
  updatedAt?: string;
}
export type AppointmentGroup = {
  dateRange: DateRange;
  priorities: {
    priority: Priority;
    appointments: (Appointment & {
      fitScore: string;
      matchedInterval: DateRange;
    })[];
  }[];
};


export type GroupedAppointments = AppointmentGroup[];

export type ContactStatus = 'Pending' | 'Contacted' | 'Failed' | 'No Contacted';

export interface ContactAppointment {
  _id?: string; // asignado por MongoDB
  status?: ContactStatus;
  context?: string;
  cSid: string,
  pSid: string

}

export interface Appointment {
  _id: string;
  sid: string;
  nameInput: string;
  emailInput: string;
  phoneInput: string;
  lastNameInput: string;
  textAreaInput: string;
  priority: Priority;
  note: string;
  treatment: Treatment;
  matchedBlocks: TimeBlock[];
  totalOverlapMinutes: number;
  matchLevel: "Perfect Match" | "High Match" | "Medium Match" | "Low Match";
  color: string;
  user_id: string;
  org_id: string;
  org_name: string;
  position: number;
  reschedule: boolean;
  selectedDates: SelectedDates;
  selectedAppDates: Array<{
    contact: ContactAppointment;
    startDate: Date;
    endDate: Date;
    propStartDate: Date,
    propEndDate: Date,
  }>;
}


export type LocalMessage = {
  author: string;
  body: string;
  sid?: string
  avatar?: string
  dateCreated?: Date
  messageSid?: string
  media?:MediaFile[]
};

export type TokenType = 'string' | 'date' | 'time' | 'phone' | 'custom';

export interface TemplateToken {
  key: string;           // Ej: ":Name"
  label: string;         // Ej: "Patient Name"
  description: string;   // Ej: "Full name of the patient"
  field: string | null;  // Ej: "nameInput", "nameInput + lastNameInput", or null
  secondLevelField: string | null;
  type: TokenType;
  org_id: string;
  _id: string
}


export interface MessageTemplate {
  _id: string;
  title: string;
  content: string;
  org_id: string;
  createdBy: string;
  variablesUsed: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Conversation {
  name: string,
  appId:string,
  lastMessage: Date,
  chatmessage: ChatMessage[]
}

export interface ChatMessage {
  sid: string
  nextToken: string;
  name: string;
  phone: string;
  author: string;
  body: string;
  avatar: string | undefined
  lastMessage:Date
  dateCreated?: string | Date;
  appId?: string
  messageSid?: string
  media:MediaFile[] | [];
  

}
import { IconType } from "react-icons";
export interface LinkItem {
  name: string;
  path: string;
  icon: IconType;
  color: string;
}

export interface MediaFile {
  category: 'media' | 'audio' | 'video' | 'document';
  filename: string;
  size: number;
  content_type: string;
  sid: string;
}

export type GroupedAppointment = {
  _id: string | null; // puede ser null si no hay prioridad asignada
  priority: Priority;
  priorityNum: number;
  priorityName?: string;
  priorityColor?: string;
  priorityId?: string;
  count: number;
  patients: Appointment[]; // puedes tipar mejor si tienes el modelo de Appointment
};


export interface TimeBlock {
  _id?: string;           // Mongo ObjectId (opcional porque lo crea Mongo)
  org_id: string;         // ID de la organización
  blockNumber: number;    // Número del bloque (1, 2, 3, 4...)
  label: TimeSlot;          // Nombre completo del bloque ("Early Morning")
  short: string;         // Nombre corto ("EMor")
  from: string;           // Hora inicio, formato "HH:mm" ("09:30")
  to: string;             // Hora fin, formato "HH:mm" ("11:30")
  createdAt?: string;     // Timestamp (opcional)
  updatedAt?: string;     // Timestamp (opcional)
}

export interface SelectedDates {
  startDate: Date; // o Date si lo conviertes con new Date()
  endDate: Date;
  days: Array<{
    weekDay: WeekDay;
    timeBlocks: TimeBlock[];
    timeBlocksData?: TimeBlock[];
  }>;
}

export interface CustomUser extends Omit<User, 'org_id' | 'org_name'> {
  'https://iconicsmile.com/org_id': string;
  'https://iconicsmile.com/org_name': string;
}

export type TimeSlot = 'Early Morning' | 'Late Morning' | 'Early Afternoon' | 'Late Afternoon';
export type WeekDay = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
