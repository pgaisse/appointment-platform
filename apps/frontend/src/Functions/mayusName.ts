export function mayusName(input: string = ""): string {
  return input
    .trim()
    .replace(/\p{L}+/gu, (w) =>
      w[0].toLocaleUpperCase("es-ES") + w.slice(1).toLocaleLowerCase("es-ES")
    );
}