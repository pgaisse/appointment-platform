import { TableCaption } from "@chakra-ui/react";
import { ReactNode } from "react";

type Props = { children?: ReactNode };

function CustomTableCaption({ children }: Props) {
  return (
    <>
      <TableCaption>{children}</TableCaption>
    </>
  );
}

export default CustomTableCaption;
