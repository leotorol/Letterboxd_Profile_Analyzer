/**
 * Converts a polar coordinate into cartesian SVG space.
 *
 * Args:
 *   cx (number): Centre X.
 *   cy (number): Centre Y.
 *   r (number): Radius.
 *   deg (number): Angle in degrees, 0 points right, clockwise because SVG.
 *
 * Returns:
 *   Array<number>: [x, y]
 */
export function polarToCartesian(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}
