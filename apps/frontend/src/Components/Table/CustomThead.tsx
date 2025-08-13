import { Thead } from '@chakra-ui/react'
import { ReactNode } from 'react'

type Props = {children?: ReactNode}

function CustomThead({children}: Props) {
  return (
    <>
    <Thead>{children}</Thead>
    </>
  )
}

export default CustomThead