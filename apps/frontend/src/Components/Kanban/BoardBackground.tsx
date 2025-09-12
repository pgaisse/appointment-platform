import React from 'react';
import { Box } from '@chakra-ui/react';
import type { TopicAppearance } from '@/Hooks/useTopicAppearance';

export default function BoardBackground({ appearance }: { appearance?: TopicAppearance }) {
  const bgType = appearance?.background?.type ?? 'color';
  const color = appearance?.background?.color ?? '#1A202C';
  const imageUrl = appearance?.background?.imageUrl;
  const blur = typeof appearance?.overlay?.blur === 'number' ? appearance!.overlay!.blur! : 0;
  const brightness = typeof appearance?.overlay?.brightness === 'number' ? appearance!.overlay!.brightness! : 1;

  const baseStyles: React.CSSProperties =
    bgType === 'image' && imageUrl
      ? {
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          filter: `blur(${blur}px) brightness(${brightness})`,
        }
      : {
          backgroundColor: color,
          filter: `blur(${blur}px) brightness(${brightness})`,
        };
  return (
    <Box position="fixed" inset="0" zIndex={-1} pointerEvents="none" aria-hidden>
      <Box position="absolute" inset="0" style={baseStyles} />
    </Box>
  );
}
