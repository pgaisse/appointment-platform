/**
 * Calcula los colores apropiados para un Avatar basado en el color del appointment/patient/provider.
 * Soporta colores de Chakra UI (ej: "blue", "red.500") y hexadecimales (ej: "#FF5733").
 * Aplica YIQ algorithm para calcular contraste automático del texto.
 */
export function getAvatarColors(color?: string): {
  bg: string;
  color: string;
} {
  if (!color) {
    return { bg: "gray.500", color: "white" };
  }

  // Color de Chakra sin nivel (ej: "blue", "red")
  if (!color.startsWith('#') && !color.includes('.')) {
    return { bg: `${color}.500`, color: "white" };
  }

  // Color de Chakra con nivel (ej: "blue.500")
  if (color.includes(".")) {
    const [base] = color.split(".");
    return { bg: `${base}.500`, color: "white" };
  }

  // Color hexadecimal - calcular contraste con YIQ algorithm
  const hex = color.replace("#", "");
  const int = parseInt(
    hex.length === 3 
      ? hex.split("").map((c) => c + c).join("") 
      : hex, 
    16
  );
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  
  // YIQ algorithm: perceived brightness
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  const textColor = yiq >= 128 ? "black" : "white";

  return { bg: color, color: textColor };
}
