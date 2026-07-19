import Box from '@mui/material/Box';
import { useMemo } from 'react';

// Wave geometry in the SVG's own viewBox units (stretched to the box width via
// preserveAspectRatio="none"; the stroke stays crisp through vector-effect below).
const VIEW_W = 320;
const VIEW_H = 32;
const MID_Y = VIEW_H / 2;
const MAX_AMP = MID_Y - 2; // biggest swing, kept just inside the viewBox
const CYCLES = 5; // oscillations before it settles
const DECAY = 3.2; // exponential damping: e^-DECAY at the tail ≈ flat
const SAMPLES = 260;

/** A damped sine wave: full swings on the left ringing down to a flat line on the right —
 *  the closing counterpart to PageTitle's crescendo. Pure geometry, built once. */
function useDampedWavePath() {
  return useMemo(() => {
    let d = '';
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      const amp = MAX_AMP * Math.exp(-DECAY * t);
      const x = t * VIEW_W;
      const y = MID_Y - amp * Math.sin(t * CYCLES * 2 * Math.PI);
      d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    return d;
  }, []);
}

/**
 * A small decorative sound wave closing the page, sitting in the gap above the footer:
 * full swings on the left that ring down to a calm flat line — a mirror of the header's
 * crescendo. Runs from the far left to the middle.
 */
export default function FooterWave() {
  const d = useDampedWavePath();
  return (
    <Box aria-hidden sx={{ display: 'flex', justifyContent: 'flex-start', py: { xs: 3, md: 5 }, color: 'primary.main' }}>
      <Box
        component="svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        sx={{ width: '50%', height: VIEW_H, overflow: 'visible' }}
      >
        <path
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </Box>
    </Box>
  );
}
