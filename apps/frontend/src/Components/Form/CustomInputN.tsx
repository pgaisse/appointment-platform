import { FormControl, FormErrorMessage, FormLabel, Input, InputGroup, InputLeftElement, InputProps } from "@chakra-ui/react";
import { ReactNode } from "react";
import { UseFormRegister, FieldError } from "react-hook-form";

type Props = InputProps & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register?: UseFormRegister<any>;
  name: string;
  error?: FieldError;  // Error type updated for better handling
  anotherName?: string;
  ico?: ReactNode;
  isPending?: boolean
};

function InputText({
  ico,
  onChange,
  placeholder,
  anotherName,
  name,
  type,
  isPending = false,
  register,
  error,
  ...rest
}: Props) {
  return (
    <FormControl isInvalid={!!error} width={"100%"}>
      <FormLabel >
        {(anotherName ? anotherName : placeholder)}
      </FormLabel>
      <InputGroup width={"100%"}>
        <InputLeftElement pointerEvents='none' >
          {ico}
        </InputLeftElement>

        <Input
          isDisabled={isPending ? true : false}
          type={type}
          id={name}
          isReadOnly={false}
          placeholder={placeholder}

         {...register?register(name):{}} {...rest}
          {...rest}  // Spread other props (e.g., className, styles, etc.)

        />
      </InputGroup>
      {error && <FormErrorMessage>{error.message}</FormErrorMessage>}  {/* Show error message */}
    </FormControl>
  );
}

export default InputText;
