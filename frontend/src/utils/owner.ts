/**
 * Normalize an owner into name + email. Returns null when nothing is known.
 * Legacy accounts have no name (or name === email), so in that case we drop the
 * name to avoid rendering "x (x)".
 */
export function ownerParts(name?: string | null, email?: string | null): { name: string; email: string } | null {
  const e = (email || '').trim();
  const n = (name || '').trim();
  if (!n && !e) return null;
  return { name: n && n !== e ? n : '', email: e };
}

/** Consistent inline owner label: "<name> (<email>)", or just the email, or "—". */
export function ownerText(name?: string | null, email?: string | null): string {
  const p = ownerParts(name, email);
  if (!p) return '—';
  if (!p.name) return p.email || '—';
  return `${p.name} (${p.email})`;
}
