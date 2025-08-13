import { Card, CardBody, Heading, SimpleGrid, Skeleton, Stack } from '@chakra-ui/react'
import React from 'react'

type Props = {}

function CustomSkeleton({}: Props) {

      const templateCoumns = {
    base: "repeat(1, minmax(150px, 1fr))",
    sm: "repeat(1, minmax(150px, 2fr))",
    lg: "repeat(2, minmax(150px, 2fr))",
    xl: "repeat(4, minmax(150px, 1fr))",
    "2xl": "repeat(4, minmax(150px, 1fr))",
    "5xl": "repeat(4, minmax(150px, 1fr))",
  };
  return (
   <SimpleGrid spacing={4} templateColumns={templateCoumns}>
           {[...Array(8)].map((_, i) => (
             <Card
               key={i}
               minW="300px"
               flex="1 1 300px"
               minHeight="300px"
               border="1px solid #E2E8F0"
               borderRadius="md"
             >
               <CardBody>
                 <Heading size="md" mb={3}>
                   <Stack>
                     <Skeleton height="20px" />
                   </Stack>
                 </Heading>
                 <Stack mt={10}>
                   <Skeleton height="20px" />
                   <Skeleton height="20px" />
                   <Skeleton height="20px" />
                 </Stack>
               </CardBody>
             </Card>
           ))}
         </SimpleGrid>
  )
}

export default CustomSkeleton