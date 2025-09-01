export const formatFromE164 = (number: string): string => {
  // Elimina espacios, guiones y paréntesis
  const cleaned = number.replace(/[\s\-()]/g, "");

  // Si empieza con +61 y tiene al menos 11 dígitos (ej: +61412345678)
  if (cleaned.startsWith("+61") && cleaned.length >= 12) {
    return "0" + cleaned.slice(3); // reemplaza +61 por 0
  }

  // Si ya empieza con 0 (ej: local), lo devuelve igual
  if (cleaned.startsWith("0")) {
    return cleaned;
  }

  // En cualquier otro caso, se devuelve tal cual
  return number;
};
