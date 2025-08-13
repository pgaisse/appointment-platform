import {
  Input,
  InputGroup,
  InputLeftElement,
  Icon,
  Flex,
  Box,
} from "@chakra-ui/react";
import { FiSearch } from "react-icons/fi";
import { useState, forwardRef, useImperativeHandle } from "react";
import { Appointment } from "@/types";

type Props = {
  data: Appointment[];
  onFilter: (filtered: Appointment[]) => void;
};

export type SearchBarRef = {
  clearInput: () => void;
};

const SearchBar = forwardRef<SearchBarRef, Props>(({ data, onFilter }, ref) => {
  const [query, setQuery] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase();
    setQuery(value);

    const filtered = data.filter((item) =>
      `${item.nameInput} ${item.lastNameInput} ${item.phoneInput} ${item.priority?.name || ""}`
        .toLowerCase()
        .includes(value)
    );

    onFilter(filtered);
  };

  // 👉 Exponer función clearInput al componente padre
  useImperativeHandle(ref, () => ({
    clearInput: () => {
      setQuery("");       // 🔁 Limpia visualmente el input
      onFilter(data);     // 🔁 Restaura lista original
    },
  }));

  return (
    <Flex justify="center" mb={4}>
      <Box w={{ base: "100%", md: "60%", lg: "40%" }}>
        <InputGroup borderRadius="xl" shadow="sm">
          <InputLeftElement pointerEvents="none">
            <Icon as={FiSearch} color="gray.400" />
          </InputLeftElement>
          <Input
            value={query}
            onChange={handleChange}
            placeholder="Search patient by name, phone or priority"
            borderRadius="xl"
            py={5}
          />
        </InputGroup>
      </Box>
    </Flex>
  );
});

export default SearchBar;
