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

  // Si pides mostrar minuto pero no hora, mostramos solo hora para no romper formato
  if (!showHour && showMinute) {
    options.hour = '2-digit';
  }

  return fdate.toLocaleString('en-AU', options);
};
