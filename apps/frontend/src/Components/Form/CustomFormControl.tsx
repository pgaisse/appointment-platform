import { FormControl } from "@chakra-ui/react";
import { ReactNode } from "react";

type Props = { children: ReactNode };

function CustomFormControl({ children }: Props) {
  return (
    <>
      <FormControl>{children}</FormControl>
    </>
  );
}

export default CustomFormControl;
