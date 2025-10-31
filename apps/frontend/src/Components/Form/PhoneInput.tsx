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
import React, { ReactNode, useEffect, useRef, useState } from "react";
import { FieldError } from "react-hook-form";

type Props = Omit<InputProps, "value" | "onChange"> & {
  name: string;
  value: string;                    // clean digits you store in RHF (e.g., 04XXXXXXXX)
  onChange: (value: string) => void;
  onComplete?: (cleanDigits: string) => void; // fires when the number is “complete”
  error?: FieldError;
  ico?: ReactNode;
  anotherName?: string;
  isPending?: boolean;
};

const isAUCompleteMobile = (digits?: string) =>
  !!digits && /^04\d{8}$/.test(digits); // 10 digits, starts with 04

const PhoneInput: React.FC<Props> = React.memo(({
  name,
  value,
  onChange,
  onComplete,
  error,
  ico,
  placeholder,
  anotherName,
  isPending = false,
  ...rest
}) => {
  const [displayValue, setDisplayValue] = useState(() => formatAustralianMobile(value || ""));
  const lastEmittedRef = useRef<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Update masked value only when controlled value changes from outside
  useEffect(() => {
    const formatted = formatAustralianMobile(value || "");
    // Only update if different to avoid cursor jumps
    if (displayValue !== formatted && document.activeElement !== inputRef.current) {
      setDisplayValue(formatted);
    }
  }, [value, displayValue]);

  // Emit completion once per completed value
  useEffect(() => {
    if (onComplete && isAUCompleteMobile(value) && lastEmittedRef.current !== value) {
      lastEmittedRef.current = value;
      // defer to ensure RHF state is current
      queueMicrotask(() => onComplete(value));
    }
    if (!isAUCompleteMobile(value)) {
      lastEmittedRef.current = "";
    }
  }, [value, onComplete]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const digits = input.replace(/\D/g, "").slice(0, 10);
    
    // Update display immediately for better UX
    setDisplayValue(formatAustralianMobile(digits));
    
    // Only call onChange if value actually changed
    if (digits !== value) {
      onChange(digits);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    rest.onBlur?.(e);
    if (onComplete && isAUCompleteMobile(value)) onComplete(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    rest.onKeyDown?.(e);
    if (e.key === "Enter" && onComplete && isAUCompleteMobile(value)) {
      onComplete(value);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    rest.onPaste?.(e);
    // wait one tick so RHF receives the new value through onChange
    setTimeout(() => {
      if (onComplete && isAUCompleteMobile(value)) onComplete(value);
    }, 0);
  };

  return (
    <FormControl isInvalid={!!error}>
      <FormLabel>{anotherName || placeholder}</FormLabel>
      <InputGroup>
        <InputLeftElement pointerEvents="none">{ico}</InputLeftElement>
        <Input
          ref={inputRef}
          type="tel"
          name={name}
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          isDisabled={isPending}
          maxLength={12} // includes spaces in the pretty format
          placeholder={placeholder}
          {...rest}
        />
      </InputGroup>
      <FormErrorMessage>{error?.message}</FormErrorMessage>
    </FormControl>
  );
});

PhoneInput.displayName = "PhoneInput";

export default PhoneInput;
