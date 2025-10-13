const to12Hour = (hhmm: string): string => {
  const m = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) throw new Error("Formato inválido. Usa HH:MM");
  let [, hStr, min] = m;

  const hNum = Number(hStr);
  const minNum = Number(min);
  if (hNum > 23 || minNum > 59) throw new Error("Hora fuera de rango");

  const period = hNum >= 12 ? "PM" : "AM";
  const h12 = hNum % 12 === 0 ? 12 : hNum % 12;

  return `${String(h12).padStart(2, "0")}:${min} ${period}`;
};
module.exports = to12Hour;