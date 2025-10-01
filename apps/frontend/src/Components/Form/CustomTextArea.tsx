import { Textarea, FormControl, FormErrorMessage } from "@chakra-ui/react";
import type { FieldError, UseFormRegister } from "react-hook-form";

type Props = {
  name: string;
  register?: UseFormRegister<any>;
  error?: FieldError;
  /** prop custom de tu app (no nativa del DOM) */
  isPending?: boolean;
} & Omit<React.ComponentProps<typeof Textarea>, "name">;

export default function CustomTextArea({
  name,
  register,
  error,
  isPending,        // ⬅️ la “consumimos” aquí
  isDisabled,       // por si te pasan isDisabled directamente
  ...rest           // ⬅️ lo que quede sí se propaga
}: Props) {
  const reg = register ? register(name) : undefined;

  return (
    <FormControl isInvalid={!!error}>
      <Textarea
        {...rest}
        {...reg}
        // Usamos una prop válida de Chakra en vez de pasar isPending al DOM
        isDisabled={isPending || isDisabled}
      />
      {error && <FormErrorMessage>{error.message}</FormErrorMessage>}
    </FormControl>
  );
}
