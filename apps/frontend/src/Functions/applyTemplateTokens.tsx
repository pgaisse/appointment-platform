import { formatDateSingle } from "./FormatDateSingle";
import { TemplateToken } from "@/types"; // Asegúrate de tener esta interfaz

type PatientInfo = Record<string, any>;

// Helper: safely resolve nested paths like "selectedAppDates.0.startDate"
function getValueByPath(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let cur = obj;
  for (const raw of parts) {
    // Handle numeric-like indices
    const key: string | number = /^\d+$/.test(raw) ? Number(raw) : raw;
    if (cur == null) return undefined;
    cur = cur[key as any];
  }
  return cur;
}

export function applyTemplateTokens(
  template: string,
  patientInfo: PatientInfo,
  tokens: TemplateToken[]
): string {
  let finalText = template;

  tokens.forEach((token) => {
    const { key, field, secondLevelField, type } = token;

    let replacement: string | undefined = "";

    // 🔹 Campos combinados con '+' (ej: "nameInput + lastNameInput")
    if (field && field.includes('+')) {
      const parts = field.split('+').map((s) => s.trim()).filter(Boolean);
      const values = parts
        .map((p) => formatIfNeeded(getValueByPath(patientInfo, p), undefined))
        .filter((v) => v);
      replacement = values.join(' ').trim();
    }
    // 🔹 Campo con nivel secundario definido explícitamente
    else if (field && secondLevelField) {
      const firstLevel = patientInfo[field];
      let nestedValue: any = undefined;
      if (Array.isArray(firstLevel) && firstLevel.length > 0) {
        nestedValue = firstLevel[0]?.[secondLevelField];
      } else if (typeof firstLevel === 'object' && firstLevel) {
        nestedValue = (firstLevel as any)[secondLevelField];
      }
      replacement = formatIfNeeded(nestedValue, type);
    }
    // 🔹 Campo simple o ruta con puntos (soporta selectedAppDates.0.startDate)
    else if (field && !secondLevelField) {
      const val = field.includes('.') ? getValueByPath(patientInfo, field) : patientInfo[field];
      replacement = formatIfNeeded(val, type);
    }

    // 🔹 Si no hay field definido (ej: fecha/hora automática)
    else if (!field) {
      if (key === ":Today") {
        replacement = formatDateSingle(new Date());
      } else if (key === ":Time") {
        replacement = formatDateSingle(new Date(), true, true); // ya considera hora:minuto
      }
    }

    // Reemplaza todas las apariciones del token en el texto
    if (replacement !== undefined && replacement !== null) {
      finalText = finalText.replaceAll(key, replacement.toString());
    }
  });

  return finalText;
}

// 🔧 Formateador condicional según tipo de token
function formatIfNeeded(value: any, type: string | undefined): string {
  if (!value) return "";

  if (type === "date" || type === "time") {
    const date = new Date(value);
    return formatDateSingle(date);
  }

  return value.toString();
}
