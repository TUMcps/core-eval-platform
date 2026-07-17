import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

/**
 * A page's primary headline followed by a bold rule in the primary color that runs out
 * to fill the leftover width, sitting at the headline's baseline — a small playful accent
 * that frames the page without competing with its content. For headlines that stand alone
 * on their row; pages whose title shares a row with actions keep a plain Typography.
 */
export default function PageTitle({
  children,
  variant = 'h3',
  mb = 2,
}: {
  children: ReactNode;
  variant?: 'h3' | 'h4';
  mb?: number;
}) {
  // Lift the rule off the descender line up to the text baseline.
  const baseline = variant === 'h4' ? '7px' : '10px';
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, mb }}>
      <Typography variant={variant} fontWeight="bold">{children}</Typography>
      <Box aria-hidden sx={{ flex: 1, minWidth: 24, height: 5, mb: baseline, borderRadius: 999, bgcolor: 'primary.main' }} />
    </Box>
  );
}
