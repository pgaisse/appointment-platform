export const formatToE164 = (number: string) => {
  const cleaned = number.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return '+61' + cleaned.slice(1);
  }
  return number; // asume que ya está en E.164
};