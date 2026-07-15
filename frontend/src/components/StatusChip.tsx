import { Chip } from '@mui/material';

const COLORS: Record<string, 'default' | 'primary' | 'success' | 'error' | 'warning' | 'info'> = {
  pending: 'default', running: 'info', active: 'info',
  done: 'success', succeeded: 'success',
  failed: 'error', error: 'error',
  aborted: 'warning', timed_out: 'warning',
};

export default function StatusChip({ status }: { status: string }) {
  return <Chip size="small" label={status.replace('_', ' ')} color={COLORS[status] ?? 'default'} />;
}
