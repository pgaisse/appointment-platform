import { ReactNode } from "react";
import { Heading, ResponsiveValue } from "@chakra-ui/react";
type Props = { children: ReactNode; 
  fontWeight?: string, 
  fontSize?: ResponsiveValue<number | "small" | (string & {}) | "sm" | "md" | "lg" | "xl" | "2xl" | "4xl" | "3xl" | "xs" | "-moz-initial" | "inherit" | "initial" | "revert" | "revert-layer" | "unset" | "3xs" | "9xl" > | undefined 
};

function CustomHeading({ children, fontWeight, fontSize }: Props) {
  return (
    <>
      <Heading w="100%" fontSize={fontSize} fontWeight={fontWeight} textAlign={"center"} mb="2%">
        {children}
      </Heading>
    </>
  );
}

export default CustomHeading;
