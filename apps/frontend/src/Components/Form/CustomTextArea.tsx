import { FormControl, FormErrorMessage, FormLabel, Textarea, TextareaProps } from "@chakra-ui/react";
import { FieldError, UseFormRegister } from "react-hook-form";
type Props = TextareaProps & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
  error?: FieldError;  // Error type updated for better handling
  name: string;
  isPending?: boolean;
  anotherName?: string;
};

function CustomTextArea({
  anotherName,
  name,
  isPending = false,
  rows,
  placeholder,
  register,
  error,
  ...rest

}: Props) {
  return (
    <>
      <FormControl  isInvalid={!!error}>
        { <FormLabel>
           {(anotherName?anotherName:placeholder)}
        </FormLabel> }
        <Textarea
         isDisabled={isPending? true : false}
          rows={rows || 4}
          placeholder={placeholder}
          {...register(name)}  // Use the register hook to bind this field to the form
          {...rest}  // Spread other props (e.g., className, styles, etc.)
        />
        {error && <FormErrorMessage>{error.message}</FormErrorMessage>}  {/* Show error message */}
      </FormControl>
    </>

  );
}

export default CustomTextArea;