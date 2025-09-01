// theme.ts
import { extendTheme } from "@chakra-ui/react";

export const theme = extendTheme({
  config: { initialColorMode: "system", useSystemColorMode: true },
  colors: {
    brand: {
      50:"#ecfeff",100:"#cffafe",200:"#a5f3fc",300:"#67e8f9",400:"#22d3ee",
      500:"#06b6d4",600:"#0891b2",700:"#0e7490",800:"#155e75",900:"#164e63"
    },
    surface: { 0:"#f7f8fa", 1:"#ffffff", 2:"#f1f5f9" },
    surfaceDark: { 0:"#0b0f17", 1:"#0f1623", 2:"#111927" },
  },
  radii: { xl:"1rem", "2xl":"1.25rem" },
  shadows: { soft:"0 10px 30px rgba(2,6,23,.10)" },
  styles: {
    global: {
      "html, body, #root": { height: "100%" },
      body: {
        bg: "surface.0",
        _dark: { bg: "surfaceDark.0" },
        bgGradient: {
          base: "linear(to-br, surface.0, surface.1)",
          _dark: "linear(to-br, surfaceDark.0, surfaceDark.1)",
        },
      },
      "::-webkit-scrollbar": { width: "0px", height: "0px" },
    },
  },
  components: {
    Button: { defaultProps: { colorScheme: "brand" } },
  },
});
