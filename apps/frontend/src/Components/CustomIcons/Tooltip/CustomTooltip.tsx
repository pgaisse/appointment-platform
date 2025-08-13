import { decodeChildren } from "@/Functions/DecodeChildren";
import { Tooltip, TooltipProps } from "@chakra-ui/react";
import { ReactNode } from "react";

interface CustomTooltipProps extends TooltipProps {
  label: string; // texto con entidades HTML
  children: ReactNode;
}

const CustomTooltip = ({ label, children, ...rest }: CustomTooltipProps) => {

  const decodedLabel = decodeChildren(label);

  return (
    <Tooltip
      label={decodedLabel}
      {...rest}
    >
      {children}
    </Tooltip>
  );
};

export default CustomTooltip;
