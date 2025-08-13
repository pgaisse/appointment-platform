import React from "react";
import { Text, TextProps } from "@chakra-ui/react";
import { decodeChildren } from "@/Functions/DecodeChildren";


const CustomText = React.forwardRef<HTMLParagraphElement, TextProps>((props, ref) => {
  const { children, ...rest } = props;

  // Si children es texto, decodificamos HTML entities
  
  
 const decodedChildren = decodeChildren(children);


  return (
    <Text ref={ref} {...rest}>
      {decodedChildren}
    </Text>
  );
});

export default CustomText;
