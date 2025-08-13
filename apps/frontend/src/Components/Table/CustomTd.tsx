import { decodeChildren } from '@/Functions/DecodeChildren';
import { Td } from '@chakra-ui/react'
import { ReactNode } from 'react'

type Props = {children?:ReactNode
    id?:string;
    colSpan?:number
}

function CustomTd({children,id, colSpan}: Props) {
  const decodedChildren = decodeChildren(children);
  return (
    <>
    <Td id={id} colSpan={colSpan}>{decodedChildren}</Td>
    </>
  )
}

export default CustomTd