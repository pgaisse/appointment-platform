import CustomTableApp from '@/Components/CustomTemplates/CustomTableApp'

type Props = {}

const AppointmentManager = (props: Props) => {
  return (
    <>
      <CustomTableApp pageSize={10} />
    </>

  )
}

export default AppointmentManager