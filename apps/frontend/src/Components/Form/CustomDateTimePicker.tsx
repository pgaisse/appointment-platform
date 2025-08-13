import { useState, useCallback } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { FormControl, FormLabel } from '@chakra-ui/react';

type Props = {
  labelFechaInicio: string;
  labelFechaFin: string;
  onChangeFechaInicio: (date: Date | null) => void;
  onChangeFechaFin: (date: Date | null) => void;
  fechaInicioSeleccionada: Date | null;
  fechaFinSeleccionada: Date | null;
};

function DateTimePicker({
  labelFechaInicio,
  labelFechaFin,
  onChangeFechaInicio,
  onChangeFechaFin,
  fechaInicioSeleccionada,
  fechaFinSeleccionada,
}: Props) {
  const [fechaInicio, setFechaInicio] = useState(fechaInicioSeleccionada);
  const [fechaFin, setFechaFin] = useState(fechaFinSeleccionada);

  const handleChangeFechaInicio = useCallback(
    (date: Date | null) => {
      setFechaInicio(date);
      onChangeFechaInicio(date);
      if (date) {
        // Fijar la hora del segundo datepicker a la hora del primero
        const nuevaFechaFin = fechaFin ? new Date(fechaFin) : new Date();
        nuevaFechaFin.setHours(date.getHours());
        nuevaFechaFin.setMinutes(date.getMinutes());
        setFechaFin(nuevaFechaFin);
        onChangeFechaFin(nuevaFechaFin);
      }
    },
    [fechaFin, onChangeFechaFin, onChangeFechaInicio]
  );

  const handleChangeFechaFin = useCallback(
    (date: Date | null) => {
      setFechaFin(date);
      onChangeFechaFin(date);
    },
    [onChangeFechaFin]
  );

  return (
    <>
      <FormControl mr="5%">
        <FormLabel htmlFor="fecha-inicio" fontWeight={'normal'}>
          {labelFechaInicio}
        </FormLabel>
        <DatePicker
          id="fecha-inicio"
          selected={fechaInicio}
          onChange={handleChangeFechaInicio}
          showTimeSelect
          dateFormat="dd/MM/yyyy HH:mm"
          timeIntervals={15}
          placeholderText="Seleccionar fecha y hora"
        />
      </FormControl>

      <FormControl>
        <FormLabel htmlFor="fecha-fin" fontWeight={'normal'}>
          {labelFechaFin}
        </FormLabel>
        <DatePicker
          id="fecha-fin"
          selected={fechaFin}
          onChange={handleChangeFechaFin}
          showTimeSelect
          dateFormat="dd/MM/yyyy HH:mm"
          timeIntervals={15}
          placeholderText="Seleccionar fecha y hora"
        />
      </FormControl>
    </>
  );
}

export default DateTimePicker;