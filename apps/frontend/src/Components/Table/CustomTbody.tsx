import { Tbody } from "@chakra-ui/react";
import { ReactNode } from "react";

type Props = { children?: ReactNode;
    id?:string;
 };

function CustomTbody({ children,id }: Props) {
  return <Tbody id={id}>{children}</Tbody>;
}

export default CustomTbody;
