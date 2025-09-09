// frontend/src/Components/Kanban/CompletionRadio.tsx
import React from 'react';
import { Center, Icon } from '@chakra-ui/react';
import { CheckIcon } from '@chakra-ui/icons';

/**
 * Completion "radio" con tick.
 * - inline:
 *   * Si checked=false: NO ocupa espacio y aparece en hover del padre (role="group").
 *   * Si checked=true: SIEMPRE visible y reservando espacio (empuja el título).
 * - Bloquea drag/click de la card al interactuar.
 */
export default function CompletionRadio({
  checked,
  onToggle,
  size = 18,
  inline = false,
}: {
  checked: boolean;
  onToggle: () => void;
  size?: number;
  inline?: boolean;
}) {
  const dim = `${size}px`;

  const stop = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    // @ts-ignore
    if (e.nativeEvent?.stopImmediatePropagation) e.nativeEvent.stopImmediatePropagation();
  };

  const common = {
    borderRadius: 'full' as const,
    bg: checked ? 'green.400' : 'gray.700',
    borderWidth: '2px',
    borderColor: checked ? 'green.500' : 'gray.500',
    color: 'white',
    cursor: 'pointer',
    transition: 'all 140ms ease',
    role: 'checkbox' as const,
    'aria-checked': checked,
    title: checked ? 'Mark as incomplete' : 'Mark as complete',
    onClick: (e: React.SyntheticEvent) => {
      stop(e);
      onToggle();
    },
    onPointerDown: stop,
    onMouseDown: stop,
  };

  if (inline) {
    // Si está marcado: siempre visible y reserva espacio
    // Si NO está marcado: w=0 (sin espacio) y aparece en hover del padre (role="group")
    const baseWidth = checked ? dim : '0';
    const baseMinW = checked ? dim : '0';
    const baseOpacity = checked ? 1 : 0;
    const baseMr = checked ? 2 : 0;

    return (
      <Center
        {...common}
        w={baseWidth}
        minW={baseMinW}
        h={dim}
        opacity={baseOpacity}
        overflow="hidden"
        mr={baseMr}
        _groupHover={{ w: dim, minW: dim, opacity: 1, mr: 2 }}
      >
        {checked ? <Icon as={CheckIcon} boxSize="70%" /> : null}
      </Center>
    );
  }

  // Modo absoluto (si lo reutilizas en otra vista)
  return (
    <Center
      {...common}
      position="absolute"
      top="6px"
      left="6px"
      w={dim}
      h={dim}
      opacity={checked ? 1 : 0}
      _groupHover={{ opacity: 1 }}
      zIndex={2}
    >
      {checked ? <Icon as={CheckIcon} boxSize="70%" /> : null}
    </Center>
  );
}
