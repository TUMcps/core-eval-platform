import { useState, useEffect, useRef } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, CircularProgress, Chip, Accordion, AccordionSummary,
  AccordionDetails, Stack, Snackbar, Alert,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PageBreadcrumbs from '../components/PageBreadcrumbs';
import PageHeader from '../components/PageHeader';
import PageSection from '../components/PageSection';
import LiveIndicator from '../components/LiveIndicator';
import { tasksApi, benchmarksApi } from '../api';
import type { Task, TaskStep, Benchmark } from '../api';
import { statusChip } from '../constants/status';
import { formatDateTime } from '../utils/datetime';
import { usePageTitle } from '../hooks/usePageTitle';

const REFRESH_MS = 10000;
const STEP_STATUS: Record<string, string> = { pending: 'Pending', active: 'Running', done: 'Done', failed: 'Error', aborted: 'Aborted' };
const PAUSE_KIND = 'vnn_pause';

// Friendlier step names than the raw kinds.
const KIND_LABEL: Record<string, string> = {
  vnn_create: 'Create submission', assign: 'Assign worker', vnn_generate: 'Generate instances',
  vnn_benchmark_export: 'Export to benchmarks repo', vnn_pause: 'Paused (waiting to continue)', shutdown: 'Shutdown',
};

export default function BenchmarkDetailsPage() {
  const { id } = useParams();
  const [task, setTask] = useState<Task | null>(null);
  const [benchmark, setBenchmark] = useState<Benchmark | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  usePageTitle(task?.name ?? 'Benchmark');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!id) return;
    try {
      const t = await tasksApi.get(id);
      setTask(t);
      // Once files exist, show the benchmark's instances + publish control.
      if (t.benchmark) setBenchmark(await benchmarksApi.get(t.benchmark).catch(() => null));
    } catch { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);
  useEffect(() => {
    if (task && !task.done) { timer.current = setInterval(load, REFRESH_MS); return () => { if (timer.current) clearInterval(timer.current); }; }
    // eslint-disable-next-line
  }, [task?.done, id]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  if (!task) return <PageSection><Typography>Task not found.</Typography></PageSection>;

  const overall = statusChip(task.status || (task.done ? 'Done' : 'Running'));
  const current = task.steps.find((s) => s.status === 'active');
  const isPaused = current?.kind === PAUSE_KIND;
  const stepName = (s: TaskStep) => KIND_LABEL[s.kind] ?? s.kind;

  const doAbort = async () => { if (window.confirm('Abort this submission?')) setTask(await tasksApi.abort(task.id)); };
  const doResume = async () => { setTask(await tasksApi.resume(task.id)); };
  const publish = async () => {
    if (!benchmark) return;
    try { setBenchmark(await benchmarksApi.publish(benchmark.id)); setToast('Published'); }
    catch (err: any) { setError(JSON.stringify(err?.response?.data ?? 'Publish failed')); }
  };

  return (
    <>
      <PageHeader>
        <PageBreadcrumbs items={[{ label: 'Benchmark', to: '/benchmark' }, { label: task.name }]} />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="h3" fontWeight="bold" gutterBottom>{task.name}</Typography>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Chip label={overall.label} color={overall.color} variant={overall.variant} />
              {!task.done && <LiveIndicator label="Live" />}
              <Typography variant="body2" color="text.secondary">Submitted {formatDateTime(task.created_at)}</Typography>
            </Stack>
          </Box>
          <Stack direction="row" spacing={1.5}>
            {isPaused && <Button variant="contained" onClick={doResume}>Continue</Button>}
            {benchmark && task.done && task.status === 'Done' && <Button variant="contained" disabled={benchmark.published} onClick={publish}>{benchmark.published ? 'Published' : 'Publish'}</Button>}
            {!task.done ? (
              <Button variant="outlined" color="error" onClick={doAbort}>Abort submission</Button>
            ) : (
              <Button component={RouterLink} to="/benchmark" variant="outlined" startIcon={<ArrowBackIcon />}>Back</Button>
            )}
          </Stack>
        </Box>
      </PageHeader>

      <PageSection>
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
        <Typography variant="h5" fontWeight="bold" gutterBottom>Pipeline</Typography>
        {task.steps.map((s) => {
          const chip = statusChip(STEP_STATUS[s.status] ?? 'Pending');
          const active = s.status === 'active';
          return (
            <Paper key={s.id} id={`step-${s.order}`} elevation={active ? 3 : 1} sx={{ mb: 1.5, border: active ? '1px solid' : '1px solid transparent', borderColor: active ? 'secondary.main' : 'transparent' }}>
              <Accordion disableGutters elevation={0} defaultExpanded={active} sx={{ '&:before': { display: 'none' }, bgcolor: 'transparent' }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                    <Typography sx={{ fontWeight: 600, minWidth: 40, color: 'text.secondary' }}>{s.order + 1}.</Typography>
                    <Typography sx={{ fontWeight: 600, flexGrow: 1 }}>{stepName(s)}</Typography>
                    {active && <LiveIndicator label={null} />}
                    <Chip size="small" label={chip.label} color={chip.color} variant={chip.variant} />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  {s.has_logs ? (
                    <Box className="console_log">{s.logs}</Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {active ? 'Running… logs will appear here as the worker reports back.' : 'No logs for this step.'}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    {s.started_at ? `started ${formatDateTime(s.started_at)}` : 'not started'}
                    {s.finished_at ? ` · finished ${formatDateTime(s.finished_at)}` : ''}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            </Paper>
          );
        })}

        {benchmark && task.done && task.status === 'Done' && (
          <Alert severity="success" sx={{ mt: 3 }}>
            Benchmark generated and pushed to the benchmarks repository.
            {benchmark.published ? ' It is published and available to tool submissions.' : ' Publish it to make it available to tool submissions.'}
          </Alert>
        )}
      </PageSection>
      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast('')} message={toast} />
    </>
  );
}
