import { FormControl, FormErrorMessage, Select } from "@chakra-ui/react";
import React, { ReactNode } from "react";
import { FieldError } from "react-hook-form";

type Props = {
  id?: string;
  placeholder: string;
  isDisabled?: boolean;
  children: ReactNode;
  name?: string;
  error?: FieldError;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
};

function CustomSelect({
  id,
  name,
  placeholder,
  isDisabled,
  children,
  error,
  value,
  onChange,
}: Props) {
  return (
    <FormControl isInvalid={!!error}>
      <Select fontSize="xs"
        id={id}
        name={name}
        placeholder={placeholder}
        isDisabled={isDisabled}
        value={value}
        onChange={onChange}
      >
        {children}
      </Select>
      {error && <FormErrorMessage>{error.message}</FormErrorMessage>}
    </FormControl>
  );
}

export default CustomSelect;
