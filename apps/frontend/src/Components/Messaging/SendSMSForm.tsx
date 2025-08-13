import React, { useState } from "react";
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Text,
  useToast,
} from "@chakra-ui/react";
import { useSendSMS } from "@/Hooks/Query/useSendSMS";
const SendSMSForm = () => {
  const toast = useToast();
  const { mutate: sendSMS, isPending, error, data } = useSendSMS();

  const [to, setTo] = useState("+61");
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!to || !message) {
      toast({
        title: "Campos requeridos",
        description: "Debes ingresar un número y un mensaje.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    sendSMS(
      { to, message },
      {
        onSuccess: () => {
          toast({
            title: "Mensaje enviado",
            description: "El SMS fue enviado exitosamente.",
            status: "success",
            duration: 3000,
            isClosable: true,
          });
          setMessage("");
        },
      }
    );
  };

  return (
    <Box
      maxW="500px"
      mx="auto"
      mt={8}
      p={6}
      borderWidth="1px"
      borderRadius="xl"
      boxShadow="md"
      bg="white"
    >
      <form onSubmit={handleSubmit}>
        <FormControl id="to" mb={4} isRequired>
          <FormLabel>Número de Teléfono</FormLabel>
          <Input
            type="tel"
            placeholder="+614XXXXXXXX"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </FormControl>

        <FormControl id="message" mb={4} isRequired>
          <FormLabel>Mensaje</FormLabel>
          <Textarea
            placeholder="Escribe tu mensaje aquí"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </FormControl>

        <Button
          type="submit"
          colorScheme="blue"
          isLoading={isPending}
        >
          Enviar SMS
        </Button>

        {error && (
          <Text mt={3} color="red.500">
            Error al enviar: {error.message}
          </Text>
        )}
        {data && (
          <Text mt={3} color="green.500">
            SMS enviado correctamente (SID: {data.sid})
          </Text>
        )}
      </form>
    </Box>
  );
};

export default SendSMSForm;
