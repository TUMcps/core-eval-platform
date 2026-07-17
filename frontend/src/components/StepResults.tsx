import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import type { Result } from '../api';
import {
  VERDICTS, VERDICT_COLOR, canonicalVerdict, formatRuntime, resultColor,
} from '../constants/results';

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

/** One benchmark step's raw results file, shown as-is. */
export default function StepResults({ csv, results }: { csv: string; results: Result[] }) {
  return (
    <Box sx={{ mt: 1 }}>
      {results.length > 0 && <Box sx={{ mb: 1 }}><ResultsSummary results={results} /></Box>}
      <Box className="console_log">{csv}</Box>
    </Box>
  );
}

/**
 * A run's verdict tallies. Counted from the run's own rows, which is what the old site
 * fell back to when the scorer's summary was unavailable — so it says nothing about
 * whether a counterexample was *valid*; that lives in the scoring log.
 */
export function ResultsOverview({ results }: { results: Result[] }) {
  const counts = results.reduce<Record<string, number>>((acc, r) => {
    const v = canonicalVerdict(r.result);
    acc[v] = (acc[v] ?? 0) + 1;
    return acc;
  }, {});
  const runtime = results.reduce((sum, r) => sum + (r.time ?? 0), 0);
  const errors = counts.error ?? 0;

  return (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 1.5 }}>
        {VERDICTS.filter((v) => counts[v]).map((v) => (
          <Chip key={v} size="small" color={VERDICT_COLOR[v]} label={`${v}: ${counts[v]}`} />
        ))}
        <Chip size="small" variant="outlined" label={`${results.length} instances`} />
        <Chip size="small" variant="outlined" label={`${formatRuntime(runtime)} total`} />
      </Box>
      <Typography variant="body2" color="text.secondary">
        {errors > 0
          ? `${errors} instance(s) did not produce a usable verdict — see the logs above.`
          : 'Every instance produced a usable verdict.'}
        {' '}A per-instance timeout is a normal outcome and scores 0, not an error.
        Whether a counterexample is <em>valid</em> is decided by the scorer — see the scoring log.
      </Typography>
    </Box>
  );
}
