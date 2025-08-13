import React from "react";
import { format, addDays, startOfWeek } from "date-fns";

const CustomMinCal = ({ startDate = new Date(), onSelect }) => {
  const weekStart = startOfWeek(startDate, { weekStartsOn: 1 }); // Lunes
  const days = [...Array(7)].map((_, i) => addDays(weekStart, i));

  return (
    <div style={{ display: "flex", gap: "4px", fontSize: "12px" }}>
      {days.map((day) => (
        <div
          key={day.toISOString()}
          onClick={() => onSelect?.(day)}
          style={{
            padding: "6px 8px",
            borderRadius: "6px",
            cursor: "pointer",
            background: format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") ? "#3182ce" : "#e2e8f0",
            color: format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") ? "#fff" : "#000",
          }}
        >
          <div>{format(day, "EE")}</div>
          <div>{format(day, "d")}</div>
        </div>
      ))}
    </div>
  );
};

export default CustomMinCal;
