import type { ReactNode } from 'react';
import Typography from '@mui/material/Typography';

/** One label/value pair in a SubmissionDetails grid. */
export default function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>{label}</Typography>
      <Typography variant="body2" component="div">{children}</Typography>
    </>
  );
}
