export function ColorScale(score: number) {
  if (score >= 0.9) return "#008000";     // Verde
  if (score >= 0.75) return "#32CD32";    // Verde claro
  if (score >= 0.6) return "#ADFF2F";     // Amarillo verdoso
  if (score >= 0.5) return "#FFFF00";     // Amarillo
  if (score >= 0.4) return "#FFA500";     // Naranja
  if (score >= 0.3) return "#FF4500";     // Naranja oscuro
  return "#FF0000";                       // Rojo
}