import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import type { Result, StepSummary } from '../api';
import { VERDICTS, VERDICT_LABEL, canonicalVerdict } from '../constants/results';

/** One benchmark step's raw results file, shown as-is. */
export default function StepResults({ csv }: { csv: string }) {
  return (
    <Box sx={{ mt: 1 }}>
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

  const { verdicts, witnesses, order } = summary.summary;
  const severity = summary.severity === 'unknown' ? 'info' : summary.severity;

  // Variants without witness validation (e.g. ARCH): a plain verdict tally, coloured
  // by the step's own severity. The competition supplies the buckets and their order.
  if (!witnesses) {
    const keys = order ?? Object.keys(verdicts);
    const label = (k: string) => k.charAt(0).toUpperCase() + k.slice(1);
    return (
      <Alert severity={severity} sx={{ mb: 2 }}>
        {keys.map((k) => `${label(k)}: ${n(verdicts, k)}`).join(', ') || 'no results'}
      </Alert>
    );
  }

  const sat = n(verdicts, 'violated');  // the scorer's key; shown as sat
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
