import {
  Box,
  Flex,
  Icon,
  Spinner,
  Text,
  useToast,
} from "@chakra-ui/react";
import * as RiIcons from "react-icons/ri";
import * as MdIcons from "react-icons/md";
import * as GiIcons from "react-icons/gi";
import { useGetCollection } from "@/Hooks/Query/useGetCollection";
import { Treatment } from "@/types";

const iconMap = {
  ...RiIcons,
  ...MdIcons,
  ...GiIcons,
};

interface Props {
  onSelect: (treatment: Treatment) => void;
  selectedId?: string;
  query?: object;
  limit?: number;
  selected: number;

  onChange?: (id: string, value: string, color?: string, duration?: number | null) => void;
}

export const TreatmentSelector = ({ onChange,selected, onSelect, selectedId, query = {}, limit = 20 }: Props) => {
  const {
    data,
    isSuccess,
    isFetching,
  } = useGetCollection<Treatment>("Treatment", { query, limit });
  if (isFetching) {
    return (
      <Flex justify="center" py={4}>
        <Spinner />
      </Flex>
    );
  }

  if (!isSuccess || data.length === 0) {
    return (
      <Box textAlign="center" py={4} color="gray.500">
        No treatments found.
      </Box>
    );
  }

  return (
    <Box overflowX="auto" whiteSpace="nowrap" pb={4}>
      <Flex gap={4} px={2} minW="max-content">
        {data.map((t) => {
          const IconComponent = iconMap[t.icon as keyof typeof iconMap];

          return (
            <Box
              key={t._id}
              bg={`${t.color}.100`}
              borderRadius="xl"
              px={4}
              py={3}
              minW="180px"
              boxShadow={selectedId === t._id ? "lg" : "sm"}
              border={selectedId === t._id ? "2px solid #3182CE" : "none"}
              cursor="pointer"
              onClick={() => {
                onChange?.(t._id ?? "", t.name, t.color, t.duration);
                onSelect(t)
              }}
              transition="all 0.2s ease"
              _hover={{ transform: "scale(1.03)" }}
            >
              <Flex direction="column" align="center" justify="center">
                {IconComponent && <Icon as={IconComponent} boxSize={6} mb={2} />}
                <Text fontWeight="bold" fontSize="sm" textAlign="center">
                  {t.name}
                </Text>
                <Text fontSize="xs" color="gray.600">
                  {t.duration} min
                </Text>
              </Flex>
            </Box>
          );
        })}
      </Flex>
    </Box>
  );
};