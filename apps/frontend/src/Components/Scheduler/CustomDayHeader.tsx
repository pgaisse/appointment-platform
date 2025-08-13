
type Props = {label:string}


function customDayHeader({ label }:Props) {
    
        // Abreviaciones de los días
        const daysAbbreviations: Record<"Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat", string> = {
            Sun: "S",
            Mon: "M",
            Tue: "T",
            Wed: "W",
            Thu: "T",
            Fri: "F",
            Sat: "S",
          };
          // Acceso seguro usando 'keyof typeof'
          const abbreviation = daysAbbreviations[label as keyof typeof daysAbbreviations];

        return (
     
            <span>{abbreviation?abbreviation:label}</span>
          
        );
     
    }
export default customDayHeader