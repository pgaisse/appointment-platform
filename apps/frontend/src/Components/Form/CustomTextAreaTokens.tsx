import {
  FormControl,
  FormErrorMessage,
  FormLabel,
  Textarea,
  TextareaProps,
} from "@chakra-ui/react";
import { FieldError, UseFormRegister } from "react-hook-form";
import { forwardRef } from "react";

type Props = TextareaProps & {
  register: UseFormRegister<any>;
  error?: FieldError;
  name: string;
  isPending?: boolean;
  anotherName?: string;
};

const CustomTextArea = forwardRef<HTMLTextAreaElement, Props>(function CustomTextArea(
  { anotherName, name, isPending = false, rows, placeholder, register, error, ...rest },
  ref
) {
  return (
    <FormControl isInvalid={!!error}>
      {<FormLabel>{anotherName ?? placeholder}</FormLabel>}
      <Textarea
        isDisabled={isPending}
        rows={rows || 4}
        placeholder={placeholder}
        {...register(name)}
        {...rest}
        ref={ref} // ✅ ahora sí el ref funciona
      />
      {error && <FormErrorMessage>{error.message}</FormErrorMessage>}
    </FormControl>
  );
});

export default CustomTextArea;
