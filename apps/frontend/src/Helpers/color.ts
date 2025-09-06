// frontend/src/Helpers/color.ts
function parseHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const num = parseInt(full || '000000', 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function luminanceFromRGB(r: number, g: number, b: number): number {
  const toLin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const R = toLin(r), G = toLin(g), B = toLin(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B; // WCAG
}

/** Devuelve un RGBA sutil para borde, basado en la luminancia del fondo. */
export function hairlineFromBg(
  bgHex: string,
  alphaOnLight = 0.08,
  alphaOnDark = 0.10
): string {
  const { r, g, b } = parseHex(bgHex || '#1A202C');
  const L = luminanceFromRGB(r, g, b);
  const isLight = L >= 0.5;
  // En fondo claro usamos negro con poca opacidad; en oscuro, blanco con poca opacidad.
  return isLight ? `rgba(0,0,0,${alphaOnLight})` : `rgba(255,255,255,${alphaOnDark})`;
}
