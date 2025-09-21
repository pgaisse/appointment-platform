// theme/index.ts
import { extendTheme } from "@chakra-ui/react";
import { CalendarEvent } from "../Scheduler/CalendarEvent";

export const theme = extendTheme({
  components: {
    CalendarEvent,
  },
});
