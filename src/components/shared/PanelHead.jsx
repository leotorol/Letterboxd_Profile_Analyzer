/**
 * Shared panel header: icon, label and an optional micro note.
 *
 * Args:
 *   icon (ReactNode): Inline SVG icon.
 *   accent (string, optional): CSS colour for the icon.
 *   label (string): Panel title.
 *   note (string, optional): Micro note on the right.
 *
 * Returns:
 *   JSX.Element: The panel header row.
 */
export default function PanelHead({ icon, accent, label, note }) {
  return (
    <div className="lb-panel-head">
      <div className="lb-panel-title">
        {icon && (
          <div className="lb-panel-icon" style={accent ? { color: accent } : undefined}>
            {icon}
          </div>
        )}
        <div className="lb-panel-label">{label}</div>
      </div>
      {note && <div className="lb-panel-note">{note}</div>}
    </div>
  );
}
