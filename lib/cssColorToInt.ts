export function cssColorToInt(css: string): number {
  const value = css.trim();

  if (value.startsWith("#")) {
    const hex = value.slice(1);
    return parseInt(hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex, 16);
  }

  const rgb = value.match(/[\d.]+/g);
  if (rgb && rgb.length >= 3) {
    const [r, g, b] = rgb.map((part) => Math.round(Number(part)));
    return (r << 16) | (g << 8) | b;
  }

  return 0x09090b;
}
