import get from 'lodash.get'; // asegúrate de instalar lodash si no lo tienes

function ReGroup<T extends Record<string, any>>(
  appointments: T[],
  groupBy: string = 'note'
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};

  appointments.forEach((appt) => {
    const key = (get(appt, groupBy) as string) || 'Sin categoría';
    if (!groups[key]) groups[key] = [];
    groups[key].push(appt);
  });

  return groups;
}

export default ReGroup;
