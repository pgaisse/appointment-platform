import React, { ReactNode, ForwardedRef } from "react";
import {
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  InputGroup,
  InputLeftElement,
  InputProps,
} from "@chakra-ui/react";
import { UseFormRegister, FieldError } from "react-hook-form";

type Props = Omit<InputProps, "name"> & {
  /** register de RHF (opcional). Si se provee, se usa para name/onChange/onBlur/ref */
  register?: UseFormRegister<any>;
  name: string;
  error?: FieldError;
  anotherName?: string;
  ico?: ReactNode;
  /** Estado de carga propio de la app. NO se pasa al DOM. */
  isPending?: boolean;
};

function InputTextBase(
  {
    ico,
    placeholder,
    anotherName,
    name,
    type = "text",
    isPending = false,
    register,
    error,
    isDisabled,
    isReadOnly,
    ...rest
  }: Props,
  ref: ForwardedRef<HTMLInputElement>
) {
  // Si viene register, obtenemos handlers/refs de RHF
  const reg = register ? register(name) : undefined;

  // Encadenamos onChange/onBlur del register con los que pueda traer el caller
  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    reg?.onChange?.(e);
    (rest as any)?.onChange?.(e);
  };

  const handleBlur: React.FocusEventHandler<HTMLInputElement> = (e) => {
    reg?.onBlur?.(e);
    (rest as any)?.onBlur?.(e);
  };

  // Componemos ref para no pisar el de RHF
  const combinedRef = (node: HTMLInputElement | null) => {
    if (typeof ref === "function") ref(node);
    else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
    if (reg && typeof reg.ref === "function") reg.ref(node);
  };

  const disabled = isPending || !!isDisabled;

  return (
    <FormControl isInvalid={!!error} width="100%">
      <FormLabel>{anotherName ?? placeholder}</FormLabel>
      <InputGroup width="100%">
        {ico && (
          <InputLeftElement pointerEvents="none">
            {ico}
          </InputLeftElement>
        )}

        <Input
          type={type}
          id={name}
          name={reg?.name ?? name}
          placeholder={placeholder}
          isDisabled={disabled}
          isReadOnly={isReadOnly}
          onChange={handleChange}
          onBlur={handleBlur}
          ref={combinedRef}
          data-pending={isPending ? "true" : "false"} // opcional, útil para tests/estilos
          {...rest}
        />
      </InputGroup>

      {error && <FormErrorMessage>{error.message}</FormErrorMessage>}
    </FormControl>
  );
}

const InputText = React.memo(React.forwardRef<HTMLInputElement, Props>(InputTextBase));
InputText.displayName = "CustomInputN";
export default InputText;
