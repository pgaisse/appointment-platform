import { Grid, GridProps} from '@chakra-ui/react'

type Props = GridProps&{}

const CustomGrid = (props: Props) => {
  return (
    <>
    <Grid {... props}>
        
    </Grid>
    </>
  )
}

export default CustomGrid