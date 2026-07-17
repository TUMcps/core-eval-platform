import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { Result } from '../api';
import { formatRuntime, resultColor } from '../constants/results';
import { logTail } from '../utils/logTail';

/** Solved/total + total runtime for one benchmark's parsed rows. */
export function ResultsSummary({ results }: { results: Result[] }) {
  const decided = results.filter((r) => resultColor(r.result) === 'success').length;
  const total = results.reduce((sum, r) => sum + (r.time ?? 0), 0);
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      <Typography variant="body2" color="text.secondary">{decided}/{results.length} decided</Typography>
      <Typography variant="body2" color="text.secondary">·</Typography>
      <Typography variant="body2" color="text.secondary">{formatRuntime(total)} total</Typography>
    </Box>
  );
}

interface Props {
  /** The results file the node produced, shown as-is. */
  csv: string;
  /** The same run's parsed rows, for the tally above it. */
  results: Result[];
}

/** One benchmark step's results: its raw results.csv, with a tally on top. */
export default function StepResults({ csv, results }: Props) {
  return (
    <Box sx={{ mt: 1 }}>
      {results.length > 0 && <Box sx={{ mb: 1 }}><ResultsSummary results={results} /></Box>}
      <Box className="console_log">{logTail(csv)}</Box>
    </Box>
  );
}
