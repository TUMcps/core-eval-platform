import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import CrescendoWave from './CrescendoWave';

/**
 * A page's primary headline followed by a sound-wave rule (see CrescendoWave) that runs out
 * to fill the leftover width — flat and taut under the text, breaking into full swings at
 * the far right. Its flat centerline sits at the headline's baseline, so it frames the page
 * without competing with its content. For headlines that stand alone on their row; pages
 * whose title shares a row with actions keep a plain Typography.
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
  // Lift the flat centerline off the descender line up to the text baseline.
  const baseline = variant === 'h4' ? '7px' : '10px';
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, mb }}>
      <Typography variant={variant} fontWeight="bold">{children}</Typography>
      <CrescendoWave mb={baseline} />
    </Box>
  );
}
