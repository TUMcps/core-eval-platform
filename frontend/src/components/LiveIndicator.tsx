import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface LiveIndicatorProps {
  /** Optional text shown next to the pulsing dot. Pass null/'' for dot only. */
  label?: string | null;
  /** Diameter of the dot in pixels. */
  size?: number;
}

/**
 * Pulsing red "live" dot, used to signal that something is actively running.
 * Mirrors the per-step indicator on the task detail pages.
 */
export default function LiveIndicator({ label = 'Live', size = 10 }: LiveIndicatorProps) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, verticalAlign: 'middle' }}>
      <Box
        component="span"
        sx={{
          width: size,
          height: size,
          borderRadius: '50%',
          backgroundColor: 'red',
          display: 'inline-block',
          animation: 'pulse 1.2s ease-in-out infinite',
          '@keyframes pulse': {
            '0%, 100%': { opacity: 1 },
            '50%': { opacity: 0.2 },
          },
        }}
      />
      {label && (
        <Typography component="span" variant="body2" sx={{ color: 'red', fontWeight: 'medium' }}>
          {label}
        </Typography>
      )}
    </Box>
  );
}
