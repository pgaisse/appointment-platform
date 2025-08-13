import { formatAustralianMobile } from "@/Functions/formatAustralianMobile";
import {
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  InputGroup,
  InputLeftElement,
  InputProps,
} from "@chakra-ui/react";
import { ReactNode, useEffect, useState } from "react";
import { FieldError } from "react-hook-form";

type Props = InputProps & {
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: FieldError;
  ico?: ReactNode;
  anotherName?: string;
  isPending?: boolean;
};

const PhoneInput = ({
  name,
  value,
  onChange,
  error,
  ico,
  placeholder,
  anotherName,
  isPending = false,
  ...rest
}: Props) => {
  const [displayValue, setDisplayValue] = useState("");

  useEffect(() => {
    setDisplayValue(formatAustralianMobile(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const digits = input.replace(/\D/g, "").slice(0, 10);
    onChange(digits); // Enviamos el número limpio (sin espacios)
  };

  return (
    <FormControl isInvalid={!!error}>
      <FormLabel>{anotherName || placeholder}</FormLabel>
      <InputGroup>
        <InputLeftElement pointerEvents="none">{ico}</InputLeftElement>
        <Input
          type="tel"
          name={name}
          value={displayValue}
          onChange={handleChange}
          isDisabled={isPending}
          maxLength={12}
          placeholder={placeholder}
          {...rest}
        />
      </InputGroup>
      <FormErrorMessage>{error?.message}</FormErrorMessage>
    </FormControl>
  );
};

export default PhoneInput;
