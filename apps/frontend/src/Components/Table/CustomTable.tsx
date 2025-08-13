import { Table } from "@chakra-ui/react";
import { ReactNode } from "react";

type Props = { variant?: string; children?: ReactNode };

const CustomTable = ({ variant, children }: Props) => {
  return (
    <>
      <Table variant={variant}>{children}</Table>
    </>
  );
};

export default CustomTable;
