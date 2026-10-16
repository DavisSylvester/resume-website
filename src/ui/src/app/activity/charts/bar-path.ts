/**
 * A bar with a rounded data end and a square baseline end.
 * `base` and `tip` are y (vertical bars) or x (horizontal bars) pixel positions;
 * the bar may grow in either direction from its base.
 */
export const roundedBar = (
  across: number,
  thickness: number,
  base: number,
  tip: number,
  horizontal: boolean = false,
  radius: number = 4,
): string => {
  const length: number = Math.abs(tip - base);
  if (length < 0.5) return '';
  const r: number = Math.min(radius, length, thickness / 2);
  const dir: number = tip < base ? -1 : 1;
  const a0: number = across;
  const a1: number = across + thickness;
  if (!horizontal) {
    return [
      `M${a0},${base}`,
      `V${tip - dir * r}`,
      `Q${a0},${tip} ${a0 + r},${tip}`,
      `H${a1 - r}`,
      `Q${a1},${tip} ${a1},${tip - dir * r}`,
      `V${base}`,
      'Z',
    ].join('');
  }
  return [
    `M${base},${a0}`,
    `H${tip - dir * r}`,
    `Q${tip},${a0} ${tip},${a0 + r}`,
    `V${a1 - r}`,
    `Q${tip},${a1} ${tip - dir * r},${a1}`,
    `H${base}`,
    'Z',
  ].join('');
};
