import { Tfoot } from '@chakra-ui/react'
import { ReactNode } from 'react'

type Props = {children?:ReactNode}

function CustomTfoot({children}: Props) {
  return (
    <>
    <Tfoot>{children}</Tfoot>
    </>
  )
}

export default CustomTfoot