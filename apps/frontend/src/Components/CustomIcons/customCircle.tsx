import React from 'react';
import { Icon, IconProps } from '@chakra-ui/react';

type Props = IconProps;

// Icono de prioridad (círculo con signo de exclamación)
export const CustomPriority: React.FC<Props> = (props) => {
  return (
    <Icon viewBox="0 0 24 24" {...props}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
      <line x1="12" y1="7" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </Icon>
  );
};

// Icono en forma de estrella (representa destacado o prioridad)
export const CustomStar: React.FC<Props> = (props) => {
  return (
    <Icon viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M12 2l2.92 6.26L22 9.27l-5 4.87L18.18 22 
           12 18.56 5.82 22 7 14.14 2 9.27l7.08-1.01L12 2z"
      />
    </Icon>
  );
};

// Icono de orden de llegada (lista de elementos)
export const CustomOrder: React.FC<Props> = (props) => {
  return (
    <Icon viewBox="0 0 24 24" {...props}>
      <circle cx="4" cy="6" r="1.5" fill="currentColor" />
      <rect x="8" y="5" width="12" height="2" fill="currentColor" />
      <circle cx="4" cy="12" r="1.5" fill="currentColor" />
      <rect x="8" y="11" width="12" height="2" fill="currentColor" />
      <circle cx="4" cy="18" r="1.5" fill="currentColor" />
      <rect x="8" y="17" width="12" height="2" fill="currentColor" />
    </Icon>
  );
};

// Icono de total score (medalla con estrella)
export const CustomScore: React.FC<Props> = (props) => {
  return (
    <Icon viewBox="0 0 24 24" {...props}>
      <circle cx="12" cy="10" r="6" stroke="currentColor" strokeWidth="2" fill="none" />
      <path
        fill="currentColor"
        d="M12 7.5l0.95 1.93 2.13 0.31-1.54 1.5 0.36 2.11L12 12.75l-1.9 1 0.36-2.11-1.54-1.5 2.13-0.31L12 7.5z"
      />
      <path
        fill="currentColor"
        d="M10 16v4l2-1 2 1v-4"
      />
    </Icon>
  );
};

// Icono de fechas encajadas (calendarios superpuestos)
export const CustomDatesMatched: React.FC<Props> = (props) => {
  return (
    <Icon viewBox="0 0 24 24" {...props}>
      {/* Estructura del calendario */}
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2" fill="none" />
      {/* Línea divisoria superior */}
      <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="2" />
      {/* Check dentro del calendario */}
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 14l2 2 4-4"
      />
    </Icon>
  );
};
