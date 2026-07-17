import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { Result, StepSummary } from '../api';
import { VERDICTS, VERDICT_LABEL, canonicalVerdict, formatRuntime, resultColor } from '../constants/results';

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

const n = (counts: Record<string, number>, key: string) => counts[key] ?? 0;

/**
 * The official scorer's verdict on a run, colour-coded: only a fully valid run is green.
 * The witness breakdown is the point of it — a `sat` the scorer rejected or could not
 * find means the tool claimed a violation it cannot back up.
 *
 * Falls back to counting the run's own rows when the scorer produced no summary (it was
 * skipped, or is still running), which is what the old site did too — but that view
 * cannot speak to witness validity, so it says so.
 */
export function ResultsOverview({ summary, results }: { summary: StepSummary | null; results: Result[] }) {
  if (!summary) {
    const counts = results.reduce<Record<string, number>>((acc, r) => {
      const v = canonicalVerdict(r.result);
      acc[v] = (acc[v] ?? 0) + 1;
      return acc;
    }, {});
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        {VERDICTS.filter((v) => counts[v]).map((v) => `${VERDICT_LABEL[v]}: ${counts[v]}`).join(', ') || 'no results'}
        {' — '}counted from results.csv; the scorer produced no summary, so counterexample
        validity is unknown. See the scoring log.
      </Alert>
    );
  }

  const { verdicts, witnesses } = summary.summary;
  const sat = n(verdicts, 'violated');  // the scorer's key; shown as sat
  const severity = summary.severity === 'unknown' ? 'info' : summary.severity;

  return (
    <Alert severity={severity} sx={{ mb: 2 }}>
      sat: {sat}
      {sat > 0 && (
        <> (valid {n(witnesses, 'valid')}, tol {n(witnesses, 'valid_with_tolerance')},
          {' '}invalid {n(witnesses, 'invalid')}, missing {n(witnesses, 'missing')})</>
      )}
      , unsat: {n(verdicts, 'holds')}, unknown: {n(verdicts, 'unknown')},
      {' '}timeout: {n(verdicts, 'timeout')}, error: {n(verdicts, 'error')}
    </Alert>
  );
}
