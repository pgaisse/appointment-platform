import { formatDateSingle } from "./FormatDateSingle";
import { TemplateToken } from "@/types"; // Asegúrate de tener esta interfaz
import { getLatestSelectedAppDate } from "@/Functions/getLatestSelectedAppDate";

type PatientInfo = Record<string, any>;

export function applyTemplateTokens(
  template: string,
  patientInfo: PatientInfo,
  tokens: TemplateToken[]
): string {
  let finalText = template;

  tokens.forEach((token) => {
    const { key, field, secondLevelField, type, label } = token;

    let replacement: string | undefined = "";
    let hasValue = false;

    // 🔹 Si el token apunta a un campo con nivel secundario, como selectedAppDates.startDate (antes se pensaba .0.startDate)
    if (field && secondLevelField) {
      const firstLevel = patientInfo[field];
      if (Array.isArray(firstLevel) && firstLevel.length > 0) {
        // Prefer the latest appointment slot if the field is selectedAppDates
        const targetObj =
          field === "selectedAppDates"
            ? getLatestSelectedAppDate(firstLevel) ?? firstLevel[firstLevel.length - 1]
            : typeof firstLevel[0] === "object"
            ? firstLevel[0]
            : undefined;

        if (targetObj && typeof targetObj === "object") {
          const nestedValue = (targetObj as any)[secondLevelField];
          replacement = formatIfNeeded(nestedValue, type);
          hasValue = !!replacement;
        }
      }
    }

    // 🔹 Si solo tiene un campo plano (ej: nameInput)
    else if (field && !secondLevelField) {
      replacement = formatIfNeeded(patientInfo[field], type);
      hasValue = !!replacement;
    }

    // 🔹 Si no hay field definido (ej: fecha/hora automática)
    else if (!field) {
      if (key === ":Today") {
        replacement = formatDateSingle(new Date());
        hasValue = true;
      } else if (key === ":Time") {
        replacement = formatDateSingle(new Date(), true, true); // ya considera hora:minuto
        hasValue = true;
      }
    }

    // 🔹 Si el token está vacío, mostrar [TokenLabel]
    if (!hasValue && replacement === "") {
      const tokenName = label || key.replace(':', '');
      replacement = `[${tokenName}]`;
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
