import { FormControl, FormLabel, Input, InputProps } from '@chakra-ui/react'



function InputText(props: InputProps) {
  const {onChange}=props
  return (
            <FormControl mr="5%">
              <FormLabel htmlFor="first-name" fontWeight={'normal'}>
                {props.name}
              </FormLabel>
              <Input type={props.type} id={props.name} placeholder={props.placeholder}  onChange={(e) => onChange && onChange(e)} />
            </FormControl>
  )
}

export default InputText