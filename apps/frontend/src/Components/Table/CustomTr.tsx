import { Tr } from "@chakra-ui/react";
import { ReactNode } from "react";

type Props = { children?: ReactNode; width?:string };

function CustomTr({ children, width}: Props) {
  return <Tr width={width}>{children}</Tr>;
}

export default CustomTr;
