import { DateRange } from "@/Hooks/Handles/useEventSelection";

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



export interface PaginatedMessages {
  messages: Message[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}
export interface SyncMessages {
  newMessages: Message[];
  updatedMessages: Message[];
}
export type Owner = {
  _id?: string;
  name?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  org_id?: string;
  avatar?: string
  unknown?: boolean;
};
export interface ConversationChat {
  conversationId: string;
  chatmessage?: Message,
  lastMessage: Message,
  owner: Owner
}
export type MessageStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | (string & {}); // <- extensible
export type PreviewItem = { id: string; url: string; name: string; size: number };

export interface Message {
  clientSid?: string
  clientTempId?: string
  sid: string; // Twilio Message SID (IMxxxx) o ID interno
  conversationId: string; // CHxxxx (Twilio Conversation SID) o ID interno
  author: string; // quién envió el mensaje ("clinic", teléfono paciente, etc.)
  body?: string; // texto opcional
  index?: string;       // 👈 Twilio index
  media: {
    url: string;  // URL en tu S3/CloudFront (o Drive)
    type: string; // MIME type (image/png, application/pdf, etc.)
    size?: number; // tamaño opcional en bytes
  }[];

  direction: "inbound" | "outbound"; // recibido o enviado
  createdAt: string; // ISO string de creación
  updatedAt: string; // ISO string de última actualización
  tempOrder?: number;   // 👈 orden local para optimistas
  status: MessageStatus;   // <- usa el tipo flexible
}


export type MessagesByPhone = Record<string, Message[]>;

export type SelectedConversation = {
  conversationId: string; // puede ser local-* hasta que el backend devuelva CH...
  phone: string;
  name: string;
};

export type AddToChatListInput = {
  conversationId: string;
  phone: string;
  name: string;
  lastMessage?: Message;
};

// (single) cuando solo hay texto o 1 mensaje
export type SendChatMessageResponseSingle = {
  success: true;
  messageSid: string;
  conversationSid: string;
  index?: number;
};

// (batch) cuando envías N archivos -> N mensajes
export type SendChatMessageResponseBatch = {
  success: true;
  groupId: string;
  created: { sid: string; index?: number }[];
  conversationSid?: string; // opcional por compat
};
export interface ContactAppointment {
  _id?: string;
  appointment?: string; // referencia al Appointment
  org_id?: string;
  status?: string; // ContactStatus
  startDate?: Date;
  endDate?: Date;
  context?: string;
  cSid?: string;
  pSid?: string;
  createdAt?: string;
  updatedAt?: string;
  user: User
}

export interface User {
  id: string;                // mapeado desde _id
  auth0_id: string;
  email?: string | null;
  emailVerified: boolean;
  name?: string | null;
  picture?: string | null;
  org_id?: string | null;
  orgs: string[];
  roles: string[];
  permissions: string[];
  status: UserStatus;
  lastLoginAt?: string | null; // en frontend normalmente viaja como string ISO
  createdAt?: string;
  updatedAt?: string;
}
export type UserStatus = "active" | "blocked";
export type SendChatMessageResponse =
  | SendChatMessageResponseSingle
  | SendChatMessageResponseBatch;


export type GroupedAppointments = AppointmentGroup[];

export type ContactStatus = 'Pending' | 'Contacted' | 'Failed' | 'NoContacted' | 'Confirmed' | 'Rescheduled' | 'Cancelled' | 'Rejected'

export type ContactPreference = "call" | "sms";
export interface Appointment {
  contactPreference?: ContactPreference // 🆕
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
  unknown: boolean;
  proxyAddress: string;
  selectedDates: SelectedDates;
  selectedAppDates: Array<{
    status: ContactStatus;
    rescheduleRequested: boolean
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
  media?: MediaFile[]
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
  appId: string,
  lastMessage: Date,
  chatmessage: ChatMessage[]
}
export interface ConversationS {
  conversationId: string;
  phone: string;
  name: string;
  lastMessage: Message;
  chatmessage: Message;
}

export interface ChatMessage {
  sid: string
  nextToken: string;
  name: string;
  phone: string;
  author: string;
  body: string;
  avatar: string | undefined
  lastMessage: Date
  dateCreated?: string | Date;
  appId?: string
  messageSid?: string
  media: MediaFile[] | [];


}
import { IconType } from "react-icons";
export interface LinkItem {
  name: string;
  path: string;
  icon: IconType;
  color: string;
}

export interface MediaFile {
  url: string;
  type?: string;
  size?: number;
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


export type MentionItem = {
  id: string;
  nameInput: string; // display/search key
  type?: string;     // e.g., "patient", "provider"
  avatarUrl?: string;
  subtitle?: string; // secondary line: phone/email/etc.
  [k: string]: any;  // pass-through fields
};

export type ExtractedMention = {
  display: string;
  type: string;
  id: string;
  start: number; // inclusive
  end: number;   // exclusive
};

export type HashtagMentionInputProps = {
  value: string;
  onChange: (value: string) => void;
  onMentionAdd?: (item: MentionItem) => void;
  onMentionsChange?: (mentions: ExtractedMention[]) => void;
  fetchSuggestions: (query: string) => Promise<MentionItem[]>;
  renderItem?: (item: MentionItem, isActive: boolean) => React.ReactNode;
  placeholder?: string;
  isDisabled?: boolean;
  maxSuggestions?: number;
  requireBoundaryBeforeHash?: boolean;
  minQueryLength?: number;
  debounceMs?: number;
  rows?: number;
};
