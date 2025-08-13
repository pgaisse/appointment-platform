import { FormLabel } from '@chakra-ui/react'
import { ReactNode } from 'react'

type Props = {htmlFor?:string;
     children:ReactNode}

function CustomFormLabel({children, htmlFor}: Props) {
  return (
    <>
    <FormLabel htmlFor={htmlFor}>
        {children}
    </FormLabel>
    </>
  )
}

export default CustomFormLabel