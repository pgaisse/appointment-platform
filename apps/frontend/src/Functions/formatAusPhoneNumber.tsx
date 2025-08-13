export const formatAusPhoneNumber = (phone: string) => {
  if (typeof phone !== "string") return "";

  // Eliminar todo excepto dígitos
  let cleaned = phone.replace(/\D/g, "");

  // Quitar código país si existe
  if (cleaned.startsWith("61")) {
    cleaned = cleaned.slice(2);
  }

  // Asegurar que empiece con 0
  if (!cleaned.startsWith("0")) {
    cleaned = "0" + cleaned;
  }

  if (cleaned.length === 10) {
    // Si es móvil (04XX XXXX XXX): 04XX XXX XXX
    if (cleaned.startsWith("04")) {
      return cleaned.replace(/(\d{4})(\d{3})(\d{3})/, "$1 $2 $3");
    }
    // Si es fijo (0X XXXX XXXX)
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, "$1 $2 $3");

  } else if (cleaned.length === 9) {
    // Área 3 dígitos: 0XX XXX XXX
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");
  }

  // No coincide con formato esperado, devolver original
  return phone;
};
