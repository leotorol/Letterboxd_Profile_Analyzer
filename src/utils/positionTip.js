/**
 * Positions a popover centred on an element, clamped inside its wrapper.
 *
 * Every chart that pops a tooltip on hover was reimplementing this same
 * getBoundingClientRect math, so it lives here once.
 *
 * Args:
 *   wrap (Element|null): Clipping container the tip is rendered inside.
 *   node (Element): Element the tip should point at.
 *   margin (number, optional): Horizontal clamp margin in px. Defaults to 90.
 *
 * Returns:
 *   Object: Clamped { x, y } coordinates relative to the wrapper.
 */
export function tipPosition(wrap, node, margin = 90) {
  if (!wrap) return { x: 0, y: 0 };
  const wrapRect = wrap.getBoundingClientRect();
  const rect = node.getBoundingClientRect();
  const x = rect.left - wrapRect.left + rect.width / 2;
  const y = rect.top - wrapRect.top;
  return { x: Math.max(margin, Math.min(wrapRect.width - margin, x)), y };
}
