import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';
import { useId, useMemo } from 'react';

// Wave geometry, in the SVG's own viewBox units (stretched to the leftover width via
// preserveAspectRatio="none"; the stroke stays crisp through vector-effect below).
const VIEW_W = 300;
const VIEW_H = 28;
const MID_Y = VIEW_H / 2;
const FLAT_FRAC = 0.66; // dead-flat for the first two-thirds, then it loosens up
const MAX_AMP = MID_Y - 2; // biggest swing, kept just inside the viewBox
const CYCLES = 9; // total oscillations; ~3 land in the swinging tail
const SAMPLES = 240;

/** A sine wave whose amplitude is zero until FLAT_FRAC, then eases up to MAX_AMP — a taut
 *  string that goes slack toward the end. Built once; it's pure geometry. */
function useWavePath() {
  return useMemo(() => {
    let d = '';
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      const ramp = t <= FLAT_FRAC ? 0 : (t - FLAT_FRAC) / (1 - FLAT_FRAC);
      const amp = MAX_AMP * ramp * ramp; // ease-in: subtle ripple growing into full swings
      const x = t * VIEW_W;
      const y = MID_Y - amp * Math.sin(t * CYCLES * 2 * Math.PI);
      d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    return d;
  }, []);
}

/**
 * The headline accent shared by PageTitle and the home hero: a sound-wave rule in the
 * primary color that fills the leftover width — flat and taut under the text, breaking into
 * full swings at the far right. Its flat centerline sits on the text baseline; the taller
 * wave overflows symmetrically around it.
 */
export default function CrescendoWave({
  height = 5,
  waveHeight = VIEW_H,
  strokeWidth = 5,
  mb = 0,
  sx,
}: {
  height?: number;
  waveHeight?: number;
  strokeWidth?: number;
  mb?: number | string;
  sx?: SxProps<Theme>;
}) {
  const path = useWavePath();
  const gradient = useTheme().waveGradient;
  const gid = 'cwave-' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <Box aria-hidden sx={{ position: 'relative', flex: 1, minWidth: 24, height, mb, color: 'primary.main', ...sx }}>
      <Box
        component="svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        sx={{ position: 'absolute', left: 0, top: '50%', width: '100%', height: waveHeight, transform: 'translateY(-50%)', overflow: 'visible' }}
      >
        {gradient && (
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
              {gradient.stops.map((s, i) => <stop key={i} offset={s.offset} stopColor={s.color} />)}
            </linearGradient>
          </defs>
        )}
        <path
          d={path}
          fill="none"
          stroke={gradient ? `url(#${gid})` : 'currentColor'}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </Box>
    </Box>
  );
}
