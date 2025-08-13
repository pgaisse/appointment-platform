import { ChevronLeftIcon, ChevronRightIcon } from "@chakra-ui/icons"
import { Button, HStack, IconButton } from "@chakra-ui/react"

type Props={
    totalPages:number;
    currentPage:number;
    onPageChange:(n:number)=>void
    isPlaceholderData?:boolean
}

const Pagination = ({ isPlaceholderData,totalPages, currentPage, onPageChange }:Props) => {
    return (
      <HStack spacing={2}>
        <IconButton
          icon={<ChevronLeftIcon />}
          onClick={() => onPageChange(currentPage - 1)}
          isDisabled={currentPage === 1}
          aria-label="Previous"
        />
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <Button
            key={page}
            onClick={() => onPageChange(page)}
            colorScheme={currentPage === page ? 'blue' : 'gray'}
            size="sm"
          >
            {page}
          </Button>
        ))}
        <IconButton
          icon={<ChevronRightIcon />}
          onClick={() => onPageChange(currentPage + 1)}
          isDisabled={currentPage === totalPages}
          aria-label="Next"
        />
        {isPlaceholderData && <span>Loading...</span>}
      </HStack>
      
    )
  }
  export default Pagination;