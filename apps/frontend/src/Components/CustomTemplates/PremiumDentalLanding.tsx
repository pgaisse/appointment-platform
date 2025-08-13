import React from 'react';
import {
  Box,
  Button,
  Heading,
  Text,
  VStack,
  HStack,
  useColorModeValue,
  Flex,
  Icon,
} from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { FaShieldAlt } from 'react-icons/fa';

const MotionBox = motion(Box);
const MotionButton = motion(Button);

const PremiumDentalLanding = () => {
  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      minH="100vh"
      bgGradient="linear(to-b, gray.50, white)"
      px={6}
    >
      <VStack spacing={6} textAlign="center">
        <Heading fontSize={{ base: '3xl', md: '5xl' }} fontWeight="bold">
          Dental appointment scheduling
        </Heading>
        <Heading
          fontSize={{ base: '2xl', md: '4xl' }}
          fontWeight="semibold"
          color="orange.600"
        >
          made effortless
        </Heading>
        <Text fontSize={{ base: 'md', md: 'lg' }} maxW="lg" color="gray.600">
          Minimize lost slots due to last-minute cancellations — effortlessly
          reschedule with smart automation.
        </Text>

        <HStack spacing={4} pt={4}>
          <MotionButton
            whileHover={{ scale: 1.05 }}
            colorScheme="orange"
            size="lg"
            borderRadius="xl"
            shadow="md"
          >
            Get Started
          </MotionButton>
          <Button size="lg" variant="outline" borderRadius="xl">
            Learn More
          </Button>
        </HStack>

        <Box position="relative" pt={8}>
          <Flex justify="center" align="center">
            <Box
              bg="blue.500"
              p={6}
              borderRadius="full"
              boxShadow="xl"
              mr={4}
            >
              <Icon as={FaShieldAlt} w={10} h={10} color="white" />
            </Box>

            <Box
              bg="white"
              p={4}
              borderRadius="xl"
              boxShadow="lg"
              border="1px solid"
              borderColor="gray.200"
            >
              <Text fontWeight="semibold" color="gray.700">
                📅 Patient canceled at 11:00 → Sofia was rescheduled automatically
              </Text>
              <Flex mt={2} justify="center">
                <Box
                  as="table"
                  fontSize="sm"
                  borderRadius="md"
                  boxShadow="sm"
                  sx={{ borderCollapse: 'collapse' }}
                >
                  <Box as="thead">
                    <Flex gap={2} color="gray.500">
                      {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                        <Box key={i} px={2}>
                          {d}
                        </Box>
                      ))}
                    </Flex>
                  </Box>
                  <Box as="tbody">
                    <Flex gap={2} mt={1}>
                      {[4, 5, 6, 7, 8, 9, 10].map((n, i) => (
                        <Box
                          key={i}
                          bg={n === 8 ? 'blue.100' : 'gray.100'}
                          px={3}
                          py={2}
                          borderRadius="md"
                          color={n === 8 ? 'blue.800' : 'gray.600'}
                          fontWeight={n === 8 ? 'bold' : 'normal'}
                        >
                          {n}
                        </Box>
                      ))}
                    </Flex>
                  </Box>
                </Box>
              </Flex>
            </Box>
          </Flex>
        </Box>
      </VStack>
    </Flex>
  );
};

export default PremiumDentalLanding;