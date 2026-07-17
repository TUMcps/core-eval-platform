import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import type { Result } from '../api';
import { BASE_RESULT_COLUMNS, formatRuntime, resultColor } from '../constants/results';

interface Props {
  /** One benchmark's results, in run order. */
  results: Result[];
  /**
   * The variant's result_columns (competition presentation). Anything beyond the
   * base instance/result/time is read from each row's `extra`.
   */
  columns?: string[];
}

/** Per-instance verdicts for one benchmark run. */
export default function ResultsTable({ results, columns = [] }: Props) {
  const extras = columns.filter((c) => !BASE_RESULT_COLUMNS.includes(c));

  return (
    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'grey.300' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600 }}>Instance</TableCell>
            <TableCell align="center" sx={{ fontWeight: 600 }}>Result</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>Time</TableCell>
            {extras.map((c) => (
              <TableCell key={c} sx={{ fontWeight: 600 }}>{c}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {results.map((r) => (
            <TableRow key={r.id} hover>
              <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                {r.instance_name ?? '—'}
              </TableCell>
              <TableCell align="center">
                <Chip label={r.result || 'unknown'} color={resultColor(r.result)} size="small" />
              </TableCell>
              <TableCell align="right">{formatRuntime(r.time)}</TableCell>
              {extras.map((c) => (
                <TableCell key={c}>{String(r.extra?.[c] ?? '—')}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/** Solved/total + total runtime for one benchmark's results. */
export function ResultsSummary({ results }: { results: Result[] }) {
  const decided = results.filter((r) => resultColor(r.result) === 'success').length;
  const total = results.reduce((sum, r) => sum + (r.time ?? 0), 0);
  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      <Typography variant="body2" color="text.secondary">
        {decided}/{results.length} decided
      </Typography>
      <Typography variant="body2" color="text.secondary">·</Typography>
      <Typography variant="body2" color="text.secondary">{formatRuntime(total)} total</Typography>
    </Box>
  );
}
