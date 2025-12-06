// Functions/extractSlotData.ts
import type { Appointment } from '@/types';

export type SlotData = {
  treatment?: {
    _id: string;
    name?: string;
    color?: string;
    minIcon?: string;
    icon?: string;
    duration?: number;
    category?: string;
  } | null;
  priority?: {
    _id: string;
    name?: string;
    color?: string;
    description?: string;
    durationHours?: number;
  } | null;
  providers?: Array<{
    _id: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    email?: string;
    phone?: string;
  }> | null;
  status?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  duration?: number;
};

/**
 * Extrae el slot "Pending" si existe, sino el más reciente por timestamp de ObjectId
 */
export function getRelevantSlot(slots?: any[]): any | null {
  if (!Array.isArray(slots) || !slots.length) return null;
  
  // Prioridad 1: Slot con status "Pending"
  const pending = slots.find(s => 
    String(s?.status || '').toLowerCase() === 'pending'
  );
  if (pending) return pending;
  
  // Prioridad 2: Slot más reciente por _id (timestamp en ObjectId)
  const sorted = [...slots].sort((a, b) => {
    const ta = String(a?._id || '').slice(0, 8);
    const tb = String(b?._id || '').slice(0, 8);
    const sa = parseInt(ta, 16) || 0;
    const sb = parseInt(tb, 16) || 0;
    return sb - sa; // DESC
  });
  
  return sorted[0] || null;
}

/**
 * Normaliza un objeto que puede ser ObjectId o populated object
 */
function normalizeObject(obj: any): any | null {
  if (!obj) return null;
  
  // Si es un string (ObjectId), retornar null (no podemos hacer nada)
  if (typeof obj === 'string') return null;
  
  // Si es un objeto con _id, es un objeto populated
  if (typeof obj === 'object' && obj._id) return obj;
  
  return null;
}

/**
 * Normaliza un array de objetos que pueden ser ObjectIds o populated objects
 */
function normalizeArray(arr: any[]): any[] | null {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  
  // Filtrar solo objetos populated (con _id)
  const populated = arr
    .map(item => normalizeObject(item))
    .filter(item => item !== null);
  
  return populated.length > 0 ? populated : null;
}

/**
 * Extrae treatment/priority/providers del appointment
 * Soporta AMBAS estructuras (root y dentro de slot)
 * Prioriza datos del slot sobre datos del root
 */
export function extractSlotData(appointment: Appointment): SlotData {
  const slot = getRelevantSlot(appointment.selectedAppDates as any[]);
  
  // Extraer treatment: prioridad slot > root
  const slotTreatment = normalizeObject(slot?.treatment);
  const rootTreatment = normalizeObject((appointment as any).treatment);
  const treatment = slotTreatment || rootTreatment;
  
  // Extraer priority: prioridad slot > root
  const slotPriority = normalizeObject(slot?.priority);
  const rootPriority = normalizeObject((appointment as any).priority);
  const priority = slotPriority || rootPriority;
  
  // Extraer providers: prioridad slot > root
  const slotProviders = normalizeArray(slot?.providers);
  const rootProviders = normalizeArray((appointment as any).providers);
  const providers = slotProviders || rootProviders;
  
  return {
    treatment,
    priority,
    providers,
    status: slot?.status,
    startDate: slot?.startDate,
    endDate: slot?.endDate,
    duration: slot?.duration,
  };
}

/**
 * Extrae solo el color de priority (útil para cards)
 */
export function getPriorityColor(appointment: Appointment, fallback = 'gray'): string {
  const { priority } = extractSlotData(appointment);
  return priority?.color || fallback;
}

/**
 * Extrae solo el treatment (útil para iconos)
 */
export function getTreatment(appointment: Appointment) {
  const { treatment } = extractSlotData(appointment);
  return treatment;
}

/**
 * Extrae solo la priority
 */
export function getPriority(appointment: Appointment) {
  const { priority } = extractSlotData(appointment);
  return priority;
}

/**
 * Extrae solo los providers
 */
export function getProviders(appointment: Appointment) {
  const { providers } = extractSlotData(appointment);
  return providers;
}

/**
 * Extrae el slot completo más relevante
 */
export function getDisplaySlot(appointment: Appointment) {
  return getRelevantSlot(appointment.selectedAppDates as any[]);
}
