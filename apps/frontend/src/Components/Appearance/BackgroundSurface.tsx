// src/components/ui/BackgroundSurface.tsx
import React from "react";
import { Box, BoxProps, useColorModeValue } from "@chakra-ui/react";

type BackgroundSurfaceProps = {
  src?: string;
  overlayOpacity?: number;
  overlayColor?: string;
  blurPx?: number;
  brightness?: number;
  bgPosition?: BoxProps["bgPosition"];
  bgSize?: BoxProps["bgSize"];
  bgRepeat?: BoxProps["bgRepeat"];
  containerProps?: BoxProps;
  children?: React.ReactNode;
};

const BackgroundSurface: React.FC<BackgroundSurfaceProps> = ({
  src,
  overlayOpacity,
  overlayColor,
  blurPx = 2,
  brightness = 0.8,
  bgPosition = "center",
  bgSize = "cover",
  bgRepeat = "no-repeat",
  containerProps,
  children,
}) => {
  const defaultOverlayOpacity = useColorModeValue(0.35, 0.45);
  const defaultOverlayColor = useColorModeValue("black", "black");

  const finalOverlayOpacity =
    typeof overlayOpacity === "number" ? overlayOpacity : defaultOverlayOpacity;
  const finalOverlayColor = overlayColor ?? defaultOverlayColor;

  return (
    <Box
      position="relative"
      overflow="hidden"
      rounded="2xl"
      minH="240px"
      w="full"              // ← asegura ancho 100% del contenedor padre
      display="block"       // ← por si se usa dentro de layouts inusuales
      {...containerProps}
    >
      <Box
      
        position="absolute"
        inset="0"
        bgImage={src ? `url(${src})` : undefined}
        bgPosition={bgPosition}
        bgSize={bgSize}
        bgRepeat={bgRepeat}
        transform={blurPx > 0 ? "scale(1.03)" : undefined}
        filter={`brightness(${brightness})${blurPx ? ` blur(${blurPx}px)` : ""}`}
        bg={src ? undefined : containerProps?.bg}
        bgGradient={src ? undefined : containerProps?.bgGradient}
        aria-hidden
      />
      <Box position="absolute" inset="0" bg={finalOverlayColor} opacity={finalOverlayOpacity} aria-hidden />
      <Box position="relative" zIndex={1}>{children}</Box>
    </Box>
  );
};

export default BackgroundSurface;
