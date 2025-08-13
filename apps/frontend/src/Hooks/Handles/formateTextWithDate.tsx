import formatDate from "./formatDate";

export default function useFormatTextWithDates({ text }: { text: string }) {
  const isoDateRegex = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g;

  const replaceDates = (text: string): string => {
    if (typeof text !== "string") return text;

    const matches = [...text.matchAll(isoDateRegex)];
    if (matches.length === 0) return text;

    let newText = text;

    for (let i = 0; i < matches.length; i++) {
      const current = matches[i][0];
      const nextMatch = matches[i + 1]?.[0];

      const currentIndex = newText.indexOf(current);
      const expectedNext = ` - ${nextMatch}`;
      const hasRange = nextMatch && newText.indexOf(expectedNext, currentIndex + current.length) === currentIndex + current.length;

      const currentDate = new Date(current);
      const { dDay: day1, dHours: hour1 } = formatDate(currentDate);

      if (hasRange) {
        const nextDate = new Date(nextMatch);
        const { dDay: day2, dHours: hour2 } = formatDate(nextDate);

        const replacement = day1 === day2
          ? `${day1} ${hour1} - ${hour2}`
          : `${day1} ${hour1} - ${day2} ${hour2}`;

        const fullMatch = `${current} - ${nextMatch}`;
        newText = newText.replace(fullMatch, replacement);
        i++; // skip next since it's part of the range
      } else {
        newText = newText.replace(current, `${day1} ${hour1}`);
      }
    }

    return newText;
  };

  const formattedText = replaceDates(text);

  return { formattedText };
}
