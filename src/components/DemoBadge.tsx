/** Shown on any profile/job page backed by demo or sample data, so a real
 * user never mistakes an auto-generated starter entry for an actual person
 * or employer. */
export function DemoBadge({ label = 'Demo profile — not a real candidate' }: { label?: string }) {
  return <span className="demo-badge">DEMO<small>{label}</small></span>;
}
