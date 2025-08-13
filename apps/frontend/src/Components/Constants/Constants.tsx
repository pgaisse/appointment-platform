import { DateRange } from "@/Hooks/Handles/useSlotSelection";
import { extendTheme } from "@chakra-ui/react";
const theme = extendTheme({
 breakpoints :{
  base: "0em",       // 0px
  sm: "30em",        // 480px
  md: "48em",        // 768px
  lg: "62em",        // 992px
  xl: "80em",        // 1280px
  "2xl": "96em",     // 1536px
  "3xl": "112em",    // 1792px
  "4xl": "128em",    // 2048px
  "5xl": "144em",    // 2304px
  "6xl": "160em",    // 2560px
  "7xl": "192em",    // 3072px
}

});

export default theme;
export const selectedDatesDefault:DateRange[] = 
    [
        { startDate: new Date('2025-06-02T09:30:00.000Z'), endDate: new Date('2025-06-02T11:30:00.000Z') },
        { startDate: new Date('2025-06-02T11:30:00.000Z'), endDate: new Date('2025-06-02T13:00:00.000Z') },
        { startDate: new Date('2025-06-02T14:00:00.000Z'), endDate: new Date('2025-06-02T16:00:00.000Z') },
        { startDate: new Date('2025-06-02T16:00:00.000Z'), endDate: new Date('2025-06-02T18:00:00.000Z') },

        { startDate: new Date('2025-06-03T09:30:00.000Z'), endDate: new Date('2025-06-03T11:30:00.000Z') },
        { startDate: new Date('2025-06-03T11:30:00.000Z'), endDate: new Date('2025-06-03T13:00:00.000Z') },
        { startDate: new Date('2025-06-03T14:00:00.000Z'), endDate: new Date('2025-06-03T16:00:00.000Z') },
        { startDate: new Date('2025-06-03T16:00:00.000Z'), endDate: new Date('2025-06-03T18:00:00.000Z') },

        { startDate: new Date('2025-06-04T09:30:00.000Z'), endDate: new Date('2025-06-04T11:30:00.000Z') },
        { startDate: new Date('2025-06-04T11:30:00.000Z'), endDate: new Date('2025-06-04T13:00:00.000Z') },
        { startDate: new Date('2025-06-04T14:00:00.000Z'), endDate: new Date('2025-06-04T16:00:00.000Z') },
        { startDate: new Date('2025-06-04T16:00:00.000Z'), endDate: new Date('2025-06-04T18:00:00.000Z') },

        { startDate: new Date('2025-06-05T09:30:00.000Z'), endDate: new Date('2025-06-05T11:30:00.000Z') },
        { startDate: new Date('2025-06-05T11:30:00.000Z'), endDate: new Date('2025-06-05T13:00:00.000Z') },
        { startDate: new Date('2025-06-05T14:00:00.000Z'), endDate: new Date('2025-06-05T16:00:00.000Z') },
        { startDate: new Date('2025-06-05T16:00:00.000Z'), endDate: new Date('2025-06-05T18:00:00.000Z') },

        { startDate: new Date('2025-06-06T09:30:00.000Z'), endDate: new Date('2025-06-06T11:30:00.000Z') },
        { startDate: new Date('2025-06-06T11:30:00.000Z'), endDate: new Date('2025-06-06T13:00:00.000Z') },
        { startDate: new Date('2025-06-06T14:00:00.000Z'), endDate: new Date('2025-06-06T16:00:00.000Z') },
        { startDate: new Date('2025-06-06T16:00:00.000Z'), endDate: new Date('2025-06-06T18:00:00.000Z') },

        { startDate: new Date('2025-06-07T09:30:00.000Z'), endDate: new Date('2025-06-07T11:30:00.000Z') },
        { startDate: new Date('2025-06-07T11:30:00.000Z'), endDate: new Date('2025-06-07T13:00:00.000Z') },
        { startDate: new Date('2025-06-07T14:00:00.000Z'), endDate: new Date('2025-06-07T16:00:00.000Z') },
        { startDate: new Date('2025-06-07T16:00:00.000Z'), endDate: new Date('2025-06-07T18:00:00.000Z') },

        { startDate: new Date('2025-06-08T09:30:00.000Z'), endDate: new Date('2025-06-08T11:30:00.000Z') },
        { startDate: new Date('2025-06-08T11:30:00.000Z'), endDate: new Date('2025-06-08T13:00:00.000Z') },
        { startDate: new Date('2025-06-08T14:00:00.000Z'), endDate: new Date('2025-06-08T16:00:00.000Z') },
        { startDate: new Date('2025-06-08T16:00:00.000Z'), endDate: new Date('2025-06-08T18:00:00.000Z') }
    ]


    // Repetidos para los siguientes 6 días (total 7 días)


