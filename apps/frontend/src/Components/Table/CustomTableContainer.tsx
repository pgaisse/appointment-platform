import { TableContainer } from "@chakra-ui/react";
import { ReactNode } from "react";

type Props = { children?: ReactNode };

function CustomTableContainer({children}: Props) {
  return (
    <>
      <TableContainer>{children}</TableContainer>
    </>
  );
}

export default CustomTableContainer;
