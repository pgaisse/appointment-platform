export const formatDateSingle = (
  date: Date,
  showHour: boolean = true,
  showMinute: boolean = true
) => {
  const fdate = new Date(date);

  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };

  if (showHour) options.hour = '2-digit';
  if (showMinute) options.minute = '2-digit';

  // Si pides minuto pero no hora, forzamos hora para no romper el formato
  if (!showHour && showMinute) {
    options.hour = '2-digit';
  }

  // Forzar 12 horas
  options.hour12 = true;
  // Suele ser redundante, pero ayuda a forzar 12 h en algunos motores
  (options as any).hourCycle = 'h12';

  return fdate.toLocaleString('en-AU', options);
};
