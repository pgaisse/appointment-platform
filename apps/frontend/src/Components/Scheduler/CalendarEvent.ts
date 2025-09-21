import { defineStyleConfig } from "@chakra-ui/react";
import { getColor } from "@chakra-ui/theme-tools";

export const CalendarEvent = defineStyleConfig({
  baseStyle: (props) => {
    const c = props.colorScheme ?? "teal";
    const s500 = getColor(props.theme, `${c}.500`, "#319795");
    const s600 = getColor(props.theme, `${c}.600`, "#2C7A7B");
    const s700 = getColor(props.theme, `${c}.700`, "#285E61");
    return {
      bgGradient: `linear(135deg, ${s500} 0%, ${s600} 60%, ${s700} 100%)`,
      color: "white",
      borderWidth: "1px",
      borderColor: s700,
      borderRadius: "xl",
      px: 2,
      py: 1,
      boxShadow: "xl",
      _hover: { filter: "brightness(1.05)" },
      _focusVisible: { outline: "2px solid", outlineColor: s700 },
    };
  },
  defaultProps: { colorScheme: "teal" },
});
