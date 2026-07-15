import Box from '@mui/material/Box';
import { ownerParts } from '../utils/owner';

/**
 * Consistent owner display: "<name> (<email>)". With `stacked`, the email drops to
 * its own muted line (for narrow overview columns). Falls back to just the email,
 * or an em dash when the owner is unknown.
 */
export default function OwnerLabel({ name, email, stacked = false }: { name?: string | null; email?: string | null; stacked?: boolean }) {
  const p = ownerParts(name, email);
  if (!p) return <>—</>;
  if (!p.name) return <>{p.email || '—'}</>;
  if (stacked) {
    return (
      <Box>
        {p.name}
        <Box component="span" sx={{ display: 'block', color: 'text.secondary', fontSize: '0.85em' }}>
          ({p.email})
        </Box>
      </Box>
    );
  }
  return <>{`${p.name} (${p.email})`}</>;
}
