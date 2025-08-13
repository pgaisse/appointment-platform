import { formatDateSingle } from "./FormatDateSingle";
import { TemplateToken } from "@/types"; // Asegúrate de tener esta interfaz

type PatientInfo = Record<string, any>;

export function applyTemplateTokens(
  template: string,
  patientInfo: PatientInfo,
  tokens: TemplateToken[]
): string {
  let finalText = template;

  tokens.forEach((token) => {
    const { key, field, secondLevelField, type } = token;

    let replacement: string | undefined = "";

    // 🔹 Si el token apunta a un campo con nivel secundario, como selectedAppDates.0.startDate
    if (field && secondLevelField) {
      const firstLevel = patientInfo[field];
      if (Array.isArray(firstLevel) && firstLevel.length > 0 && typeof firstLevel[0] === "object") {
        const nestedValue = firstLevel[0][secondLevelField];
        replacement = formatIfNeeded(nestedValue, type);
      }
    }

    // 🔹 Si solo tiene un campo plano (ej: nameInput)
    else if (field && !secondLevelField) {
      replacement = formatIfNeeded(patientInfo[field], type);
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
