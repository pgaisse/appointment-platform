import React, { useRef } from "react";
import { DateLocalizer } from "react-big-calendar";

type Props = {
  value?: Date;
  localizer: DateLocalizer;
};

export const CustomTimeSlotWrapper: React.FC<Props> = ({ value, localizer }) => {
  const customTimeLabel = value ? localizer.format(value, "h:mm a") : "";
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      style={{
        fontSize: "12px",
        textAlign: "center",
        color: "gray",
      }}
    >
      <div ref={ref} style={{ height: "100%" }}>
        {customTimeLabel}
      </div>
    </div>
  );
};
