/**
 * Shared chapter heading: the number, the name, the title and an optional aside.
 *
 * Every section composes one of these so the chapter mark stays consistent while
 * the variant decides where the copy, the rule and the aside land.
 *
 * Args:
 *   number (string): Chapter number, shown as is.
 *   name (string): Short chapter name for the rule.
 *   title (ReactNode): Section heading.
 *   subtitle (ReactNode, optional): Supporting sentence under the heading.
 *   aside (ReactNode, optional): Slot for controls or a supporting stat.
 *   variant (string, optional): center, split, masthead, narrow, credit or manuscript.
 *
 * Returns:
 *   JSX.Element: The chapter heading block.
 */
export default function ChapterHeading({ number, name, title, subtitle, aside, variant = 'center' }) {
  return (
    <header className={`lb-head is-${variant}`}>
      <div className="lb-mark">
        <span className="lb-mark-num tabular-nums">{number}</span>
        <span className="lb-mark-name">{name}</span>
        <span className="lb-mark-rule" aria-hidden="true" />
      </div>
      <div className="lb-head-copy">
        <h2 className="lb-title">{title}</h2>
        {subtitle && <p className="lb-sub">{subtitle}</p>}
      </div>
      {aside && <div className="lb-head-aside">{aside}</div>}
    </header>
  );
}
