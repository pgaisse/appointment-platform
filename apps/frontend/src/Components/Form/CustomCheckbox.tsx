import { Checkbox, CheckboxProps, FormControl, FormErrorMessage, FormLabel, HStack, InputGroup, InputLeftElement } from "@chakra-ui/react";
import { ReactNode } from "react";
import { FieldError, UseFormRegister } from "react-hook-form";

type Props = CheckboxProps & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register?: UseFormRegister<any>;
  name: string;
  error?: FieldError;  // Error type updated for better handling
  anotherName?: string;
  ico?: ReactNode;
  isPending?: boolean;
};

function CustomCheckbox({
  ico,
  isPending = false,
  onChange,
  anotherName,
  name,
  register,
  error,
  ...rest
}: Props) {

  return (
    <FormControl isInvalid={!!error} width={"100%"}>
      <HStack spacing={4}  width={"100%"}  alignItems="center">
        <FormLabel whiteSpace="nowrap" >
          {(anotherName ? anotherName : name)}
        </FormLabel>
        <InputGroup width={"100%"}>
          <InputLeftElement pointerEvents='none' >
            {ico}
          </InputLeftElement>

          <Checkbox
           isDisabled={isPending? true : false}
            id={name}
            isReadOnly={false}
            onChange={(e) => onChange?.(e)} // pasa el evento completo
            {...register ? { ...register(name) } : null} // Use the register hook to bind this field to the form
            {...rest}  // Spread other props (e.g., className, styles, etc.)

          />
        </InputGroup>
        {error && <FormErrorMessage>{error.message}</FormErrorMessage>}  {/* Show error message */}
      </HStack>
    </FormControl>
  );
}

export default CustomCheckbox;
