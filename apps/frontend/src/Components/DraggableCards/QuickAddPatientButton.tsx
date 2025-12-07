// apps/frontend/src/Components/DraggableCards/QuickAddPatientButton.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  Input,
  HStack,
  Text,
  VStack,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  useToast,
  Spinner,
  IconButton,
} from '@chakra-ui/react';
import { AddIcon, CheckIcon, CloseIcon } from '@chakra-ui/icons';
import { useDebounce } from '@/Hooks/useDebounce';
import { useAppointmentSearch } from '@/Hooks/Query/useAppointmentSearch';
import { useInsertToCollection } from '@/Hooks/Query/useInsertToCollection';
import { useAddAppointmentSlot } from '@/Hooks/Query/useAddAppointmentSlot';
import { useQueryClient } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import type { Appointment } from '@/types';

type Props = {
  priorityId: string;
  priorityName: string;
  priorityColor?: string;
  onSuccess?: () => void;
};

export default function QuickAddPatientButton({ 
  priorityId, 
  priorityName, 
  priorityColor = 'gray',
  onSuccess 
}: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Appointment | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const queryClient = useQueryClient();
  
  const debouncedSearch = useDebounce(inputValue, 300);
  
  // Search existing patients
  const searchQuery = useAppointmentSearch<Appointment>(
    debouncedSearch,
    10, // limit
    false // not exact match
  );
  
  const searchResults = searchQuery.data?.items ?? [];
  const isSearching = searchQuery.isLoading;
  
  // Mutations
  const createAppointment = useInsertToCollection<{ message: string; document: Appointment }>('Appointment');
  const addSlot = useAddAppointmentSlot();
  
  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);
  
  const handleCancel = () => {
    setIsAdding(false);
    setInputValue('');
    setSelectedPatient(null);
  };
  
  // Helper: Calculate tomorrow at 9 AM (Australia/Sydney)
  const getTomorrowAt9AM = () => {
    return DateTime.now()
      .setZone('Australia/Sydney')
      .plus({ days: 1 })
      .set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
      .toJSDate();
  };
  
  const handleSubmit = async () => {
    if (!inputValue.trim()) {
      handleCancel();
      return;
    }
    
    try {
      // Calculate default dates (tomorrow 9 AM + 1 hour)
      const startDate = getTomorrowAt9AM();
      const endDate = DateTime.fromJSDate(startDate).plus({ hours: 1 }).toJSDate();
      
      console.group('📤 QuickAddPatientButton');
      console.log('Selected Patient:', selectedPatient);
      console.log('Priority:', { id: priorityId, name: priorityName });
      console.log('Dates:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      console.groupEnd();
      
      if (selectedPatient) {
        // CASE 1: Existing patient → add NEW slot with dates
        await addSlot.mutateAsync({
          appointmentId: selectedPatient._id!,
          slotData: {
            priority: priorityId,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            status: 'NoContacted',
            duration: 60,
            needsScheduling: false,
            position: 0,
          },
        });
        
        toast({
          title: 'Slot added',
          description: `New slot added to ${selectedPatient.nameInput} ${selectedPatient.lastNameInput}`,
          status: 'success',
          duration: 4000,
        });
      } else {
        // CASE 2: New patient → create appointment with slot that has dates
        const nameParts = inputValue.trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        const appointmentData = {
          nameInput: firstName,
          lastNameInput: lastName,
          phoneInput: 'TBD',
          emailInput: '',
          contactPreference: 'sms' as const,
          selectedAppDates: [
            {
              priority: priorityId,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              status: 'NoContacted' as const,
              duration: 60,
              needsScheduling: false,
              position: 0,
            },
          ],
        };
        
        await createAppointment.mutateAsync(appointmentData);
        
        toast({
          title: 'Patient created',
          description: `${firstName} ${lastName} added to ${priorityName}`,
          status: 'success',
          duration: 4000,
        });
      }
      
      // Invalidate queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['DraggableCards'] }),
        queryClient.invalidateQueries({ queryKey: ['appointments'] }),
        queryClient.invalidateQueries({ queryKey: ['appointments-paginated'] }),
      ]);
      
      console.log('✅ Operation completed successfully');
      
      handleCancel();
      onSuccess?.();
    } catch (error: any) {
      console.group('❌ Error');
      console.error('Error:', error);
      console.error('Response:', error?.response?.data);
      console.groupEnd();
      
      const errorMessage = 
        error?.response?.data?.error ||
        error?.response?.data?.message || 
        error?.message || 
        'Could not complete operation. Please try again.';
      
      toast({
        title: selectedPatient ? 'Error adding slot' : 'Error creating patient',
        description: errorMessage,
        status: 'error',
        duration: 6000,
        isClosable: true,
      });
    }
  };
  
  const handleSelectPatient = (patient: Appointment) => {
    setSelectedPatient(patient);
    setInputValue(`${patient.nameInput || ''} ${patient.lastNameInput || ''}`.trim());
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };
  
  const showResults = isAdding && 
    debouncedSearch.length >= 2 && 
    !selectedPatient && 
    (searchResults.length > 0 || !isSearching);
  
  if (!isAdding) {
    return (
      <Button
        size="sm"
        variant="ghost"
        colorScheme={priorityColor}
        leftIcon={<AddIcon boxSize={3} />}
        onClick={() => setIsAdding(true)}
        w="full"
        justifyContent="flex-start"
        fontWeight="normal"
        _hover={{
          bg: `${priorityColor}.50`,
          color: `${priorityColor}.700`,
        }}
      >
        Add to {priorityName}
      </Button>
    );
  }
  
  return (
    <Popover
      isOpen={showResults}
      placement="bottom-start"
      closeOnBlur={false}
      isLazy
      lazyBehavior="keepMounted"
    >
      <PopoverTrigger>
        <Box w="full">
          <HStack spacing={1}>
            <Input
              ref={inputRef}
              size="sm"
              placeholder="Type patient name..."
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setSelectedPatient(null);
              }}
              onKeyDown={handleKeyDown}
              borderColor={`${priorityColor}.300`}
              _focus={{ 
                borderColor: `${priorityColor}.500`,
                boxShadow: `0 0 0 1px var(--chakra-colors-${priorityColor}-500)`,
              }}
              flex="1"
              autoComplete="off"
            />
            
            <IconButton
              aria-label="Confirm"
              icon={<CheckIcon />}
              size="sm"
              colorScheme="green"
              onClick={handleSubmit}
              isLoading={createAppointment.isPending || addSlot.isPending}
              disabled={!inputValue.trim()}
            />
            
            <IconButton
              aria-label="Cancel"
              icon={<CloseIcon />}
              size="sm"
              variant="ghost"
              onClick={handleCancel}
            />
          </HStack>
        </Box>
      </PopoverTrigger>
      
      <PopoverContent w="300px" shadow="lg">
        <PopoverBody maxH="250px" overflowY="auto" p={2}>
          {isSearching ? (
            <HStack justify="center" py={3}>
              <Spinner size="sm" color={`${priorityColor}.500`} />
              <Text fontSize="sm" color="gray.500">Searching...</Text>
            </HStack>
          ) : searchResults.length === 0 ? (
            <Box
              p={3}
              borderRadius="md"
              cursor="pointer"
              bg="gray.50"
              _hover={{ bg: 'gray.100' }}
              onClick={handleSubmit}
            >
              <HStack spacing={2}>
                <AddIcon boxSize={3} color={`${priorityColor}.500`} />
                <VStack align="start" spacing={0}>
                  <Text fontSize="sm" fontWeight="medium">
                    Create new patient
                  </Text>
                  <Text fontSize="xs" color="gray.600">
                    "{inputValue}"
                  </Text>
                </VStack>
              </HStack>
            </Box>
          ) : (
            <VStack align="stretch" spacing={1}>
              {searchResults.map((patient) => (
                <Box
                  key={patient._id}
                  p={2}
                  borderRadius="md"
                  cursor="pointer"
                  _hover={{ bg: `${priorityColor}.50` }}
                  onClick={() => handleSelectPatient(patient)}
                  transition="background 0.15s"
                >
                  <Text fontWeight="medium" fontSize="sm">
                    {patient.nameInput} {patient.lastNameInput}
                  </Text>
                  {patient.phoneInput && patient.phoneInput !== 'TBD' && (
                    <Text fontSize="xs" color="gray.500">
                      {patient.phoneInput}
                    </Text>
                  )}
                  <Text fontSize="xs" color="blue.600" fontWeight="medium" mt={1}>
                    → Add new slot to this patient
                  </Text>
                </Box>
              ))}
              
              <Box
                p={2}
                borderRadius="md"
                cursor="pointer"
                borderTop="1px solid"
                borderColor="gray.200"
                mt={1}
                bg="gray.50"
                _hover={{ bg: 'gray.100' }}
                onClick={handleSubmit}
              >
                <HStack spacing={2}>
                  <AddIcon boxSize={3} color={`${priorityColor}.500`} />
                  <Text fontSize="sm" fontWeight="medium">
                    Create "{inputValue}" as new patient
                  </Text>
                </HStack>
              </Box>
            </VStack>
          )}
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}
