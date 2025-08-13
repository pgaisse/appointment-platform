import { FormHelperText } from '@chakra-ui/react'
import { ReactNode } from 'react'

type Props = {children: ReactNode}

const CustomFormHelpText = ({children}: Props) => {
  return (
    <>
    <FormHelperText>{children}</FormHelperText>
    </>
  )
}

export default CustomFormHelpText