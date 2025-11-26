// TreatmentPopoverSelector.tsx
// Selector de tratamiento con Popover/Portal para mejor UX
import React, { useState } from 'react';
import {
  Box,
  Button,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverArrow,
  PopoverCloseButton,
  Portal,
  Flex,
  Icon,
  Spinner,
  Text,
  VStack,
  HStack,
  Badge,
} from '@chakra-ui/react';
import { MdExpandMore, MdCheckCircle } from 'react-icons/md';
import * as RiIcons from 'react-icons/ri';
import * as MdIcons from 'react-icons/md';
import * as GiIcons from 'react-icons/gi';
import * as FaIcons from 'react-icons/fa';
import * as FiIcons from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { useGetCollection } from '@/Hooks/Query/useGetCollection';
import { Treatment } from '@/types';

// 🔹 Registro de librerías
const ICON_SETS: Record<string, Record<string, IconType>> = {
  fi: FiIcons,
  fa: FaIcons,
  md: MdIcons,
  ri: RiIcons,
  gi: GiIcons,
};

// 🔹 Fallback para íconos inexistentes
const ICON_FALLBACKS: Record<string, string> = {
  'gi:GiToothImplant': 'gi:GiTooth',
};

// 🔹 Normalizador: agrega prefijo si falta
function normalizeIconKey(key: string): string {
  if (!key) return '';
  if (key.includes(':')) return key;
  if (key.startsWith('Fi')) return `fi:${key}`;
  if (key.startsWith('Fa')) return `fa:${key}`;
  if (key.startsWith('Md')) return `md:${key}`;
  if (key.startsWith('Ri')) return `ri:${key}`;
  if (key.startsWith('Gi')) return `gi:${key}`;
  return key;
}

// 🔹 Busca el componente de ícono dinámicamente
function getIconComponent(key?: string): IconType | undefined {
  if (!key) return undefined;
  const normKey = normalizeIconKey(key);
  const fixedKey = ICON_FALLBACKS[normKey] || normKey;
  const [pack, name] = fixedKey.split(':');
  const set = ICON_SETS[pack?.toLowerCase?.()];
  return set ? set[name] : undefined;
}

interface Props {
  value?: string; // Treatment ID
  onChange?: (treatmentId: string, treatment?: Treatment) => void;
  isDisabled?: boolean;
}

export const TreatmentPopoverSelector: React.FC<Props> = ({
  value,
  onChange,
  isDisabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const { data: treatments = [], isSuccess, isFetching } = useGetCollection<Treatment>(
    'Treatment',
    { query: {}, limit: 50 }
  );

  const selectedTreatment = treatments.find((t) => t._id === value);

  const handleSelect = (treatment: Treatment) => {
    onChange?.(treatment._id ?? '', treatment);
    setIsOpen(false);
  };

  return (
    <Popover
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      placement="bottom-start"
      closeOnBlur={true}
      isLazy
      lazyBehavior="keepMounted"
    >
      <PopoverTrigger>
        <Button
          onClick={() => setIsOpen(!isOpen)}
          isDisabled={isDisabled}
          width="100%"
          justifyContent="space-between"
          rightIcon={<MdExpandMore />}
          variant="outline"
          size="md"
          borderRadius="md"
          px={4}
          py={2}
          fontWeight="normal"
          textAlign="left"
          bg="white"
          _hover={{ bg: 'gray.50', borderColor: 'blue.400' }}
          _focus={{ borderColor: 'blue.500', boxShadow: '0 0 0 1px #3182ce' }}
        >
          {selectedTreatment ? (
            <HStack spacing={2}>
              {(() => {
                const IconComponent = getIconComponent(selectedTreatment.icon);
                return IconComponent ? <Icon as={IconComponent} boxSize={4} /> : null;
              })()}
              <Text>{selectedTreatment.name}</Text>
              <Badge colorScheme={selectedTreatment.color} fontSize="xs">
                {selectedTreatment.duration} min
              </Badge>
            </HStack>
          ) : (
            <Text color="gray.400">Select treatment...</Text>
          )}
        </Button>
      </PopoverTrigger>
      
      <Portal>
        <PopoverContent
          maxW="400px"
          borderRadius="lg"
          boxShadow="2xl"
          border="1px solid"
          borderColor="gray.200"
        >
          <PopoverArrow />
          <PopoverCloseButton />
          <PopoverHeader fontWeight="bold" fontSize="md" borderBottomWidth="1px">
            Select Treatment
          </PopoverHeader>
          
          <PopoverBody maxH="400px" overflowY="auto" p={2}>
            {isFetching ? (
              <Flex justify="center" py={6}>
                <Spinner />
              </Flex>
            ) : !isSuccess || treatments.length === 0 ? (
              <Text textAlign="center" py={6} color="gray.500">
                No treatments found.
              </Text>
            ) : (
              <VStack spacing={1} align="stretch">
                {treatments.map((treatment) => {
                  const IconComponent = getIconComponent(treatment.icon);
                  const isSelected = value === treatment._id;

                  return (
                    <Box
                      key={treatment._id}
                      as="button"
                      type="button"
                      onClick={() => handleSelect(treatment)}
                      p={3}
                      borderRadius="md"
                      bg={isSelected ? `${treatment.color}.50` : 'transparent'}
                      border="1px solid"
                      borderColor={isSelected ? `${treatment.color}.300` : 'transparent'}
                      _hover={{
                        bg: `${treatment.color}.50`,
                        borderColor: `${treatment.color}.200`,
                      }}
                      transition="all 0.15s ease"
                      cursor="pointer"
                      width="100%"
                      textAlign="left"
                      position="relative"
                    >
                      <HStack spacing={3} justify="space-between">
                        <HStack spacing={3} flex={1}>
                          {IconComponent && (
                            <Box
                              bg={`${treatment.color}.100`}
                              p={2}
                              borderRadius="md"
                            >
                              <Icon as={IconComponent} boxSize={5} color={`${treatment.color}.600`} />
                            </Box>
                          )}
                          <VStack align="start" spacing={0} flex={1}>
                            <Text fontWeight="semibold" fontSize="sm">
                              {treatment.name}
                            </Text>
                            <Text fontSize="xs" color="gray.600">
                              {treatment.duration} minutes
                            </Text>
                          </VStack>
                        </HStack>
                        
                        {isSelected && (
                          <Icon
                            as={MdCheckCircle}
                            boxSize={5}
                            color={`${treatment.color}.500`}
                          />
                        )}
                      </HStack>
                    </Box>
                  );
                })}
              </VStack>
            )}
          </PopoverBody>
        </PopoverContent>
      </Portal>
    </Popover>
  );
};
