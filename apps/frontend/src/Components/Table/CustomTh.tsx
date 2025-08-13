import { Th } from '@chakra-ui/react'
import { ReactNode } from 'react'
import { decodeChildren } from '@/Functions/DecodeChildren';

type Props = {children?:ReactNode, width?:string}



function CustomTh({children, width}: Props) {
  
  const decodedChildren = decodeChildren(children);
   //console.log("No-decodedText",children)
    // console.log("decodedText",decodedChildren)
  return (
    <Th width={width} px={7} py={1}>{decodedChildren}</Th>
  )
}

export default CustomTh