import { FormControl, FormErrorMessage, FormLabel, InputGroup, InputLeftElement, NumberInput, NumberInputField, NumberInputProps } from "@chakra-ui/react";
import { ReactNode } from 'react';
import { FieldError, UseFormRegister } from 'react-hook-form';

type Props = NumberInputProps & {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    register: UseFormRegister<any>;
    name: string;
    error?: FieldError;  // Error type updated for better handling
    anotherName?: string;
    ico?: ReactNode;
    _placeholder:string
}

function CustomNumberInput({
    _placeholder,
    ico,
    anotherName,
    name,
    register,
    error,
    ...rest
}: Props) {


    return (
        <FormControl isInvalid={!!error} width={"100%"}>
            { <FormLabel >
                {anotherName}
            </FormLabel> }

            <InputGroup width={"100%"}>
                <InputLeftElement pointerEvents='none' >
                    {ico}
                </InputLeftElement>
                <NumberInput 
                     width={"100%"}
                    fontSize="xs"
                    id={name}
                    {...rest}
                >
                    <NumberInputField pl={10}
                        placeholder={_placeholder}
                        // Register only the input field, not the whole NumberInput
                        {...register(name, {
                            valueAsNumber: true,  // Let react-hook-form handle number parsing
                        })}
                    />

                </NumberInput>
            </InputGroup>
            {error && <FormErrorMessage>{error.message}</FormErrorMessage>}  {/* Show error message */}
        </FormControl>
    )
}

export default CustomNumberInput