import { Input, InputGroup, InputLeftElement, Icon, Flex, Box } from "@chakra-ui/react";
import { FiSearch } from "react-icons/fi";
import { useState, forwardRef, useImperativeHandle } from "react";
import { Appointment } from "@/types";

export type PendingDeclinedSearchBarRef = { clearInput: () => void };

type Props = {
  data: Appointment[];
  onFilter: (filtered: Appointment[] | null) => void;
  placeholder?: string;
};

// Search bar specialized for Pending / Declined panels:
// - Returns null (not empty array) when query is blank so parent can fallback to base dataset
// - Simple case-insensitive match on name, lastName, phone and status
// - Does NOT mutate base list ordering
const PendingDeclinedSearchBar = forwardRef<PendingDeclinedSearchBarRef, Props>(
  ({ data, onFilter, placeholder = "Search by name or phone" }, ref) => {
    const [query, setQuery] = useState("");

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.trim();
      setQuery(value);
      if (value === "") {
        onFilter(null); // fallback to base list
        return;
      }
      const lower = value.toLowerCase();
      const filtered = data.filter((item) => {
        const composite = `${item.nameInput} ${item.lastNameInput} ${item.phoneInput} ${item.contactPreference || ''} ${(item as any).status || ''}`.toLowerCase();
        return composite.includes(lower);
      });
      onFilter(filtered);
    };

    useImperativeHandle(ref, () => ({
      clearInput: () => {
        setQuery("");
        onFilter(null);
      },
    }));

    return (
      <Flex justify="center" mb={4}>
        <Box w="full">
          <InputGroup borderRadius="xl" shadow="sm">
            <InputLeftElement pointerEvents="none">
              <Icon as={FiSearch} color="gray.400" />
            </InputLeftElement>
            <Input
              value={query}
              onChange={handleChange}
              placeholder={placeholder}
              borderRadius="xl"
              py={5}
            />
          </InputGroup>
        </Box>
      </Flex>
    );
  }
);

export default PendingDeclinedSearchBar;
