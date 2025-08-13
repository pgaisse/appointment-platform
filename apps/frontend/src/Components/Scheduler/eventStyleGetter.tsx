import { CalendarEvent } from "@/types";

  const eventStyleGetter = (event: CalendarEvent) => {
  const backgroundColor = event.color || "gray";
  return {
    style: {
      backgroundColor,
      color: "white",
      borderRadius: "5px",
      padding: "2px 4px",
      border: "none",
    },
  };
};
export default eventStyleGetter;