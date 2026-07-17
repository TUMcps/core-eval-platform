import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, CircularProgress, Chip, Stack, Alert } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PageBreadcrumbs from '../components/PageBreadcrumbs';
import PageHeader from '../components/PageHeader';
import PageSection from '../components/PageSection';
import LiveIndicator from '../components/LiveIndicator';
import OwnerLabel from '../components/OwnerLabel';
import OwnerReassign from '../components/OwnerReassign';
import DetailRow from '../components/DetailRow';
import SubmissionDetails from '../components/SubmissionDetails';
import DeleteSubmissionDialog from '../components/DeleteSubmissionDialog';
import TaskPipeline from '../components/TaskPipeline';
import { useAuth } from '../context/AuthContext';
import { tasksApi, benchmarksApi } from '../api';
import type { Task, Benchmark } from '../api';
import { statusChip } from '../constants/status';
import { isPauseKind } from '../constants/steps';
import { formatDateTime } from '../utils/datetime';
import { usePageTitle } from '../hooks/usePageTitle';

const REFRESH_MS = 10000;

export default function BenchmarkDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [benchmark, setBenchmark] = useState<Benchmark | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  usePageTitle(task ? `${task.name} (#${task.id})` : 'Benchmark');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!id) return;
    try {
      const t = await tasksApi.get(id);
      setTask(t);
      // Refetched each poll: the export step records the resolved commit and publishes.
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
  const active = task.steps.find((s) => s.status === 'active');
  const isPaused = !!active && isPauseKind(active.kind);
  const extra = (benchmark?.extra ?? {}) as Record<string, string>;

  const doAbort = async () => { if (window.confirm('Abort this submission?')) setTask(await tasksApi.abort(task.id)); };
  const doResume = async () => { setTask(await tasksApi.resume(task.id)); };
  const doDelete = async () => {
    setDeleting(true);
    try { await tasksApi.delete(task.id); navigate('/benchmark'); }
    catch (err: any) { setDeleting(false); setDeleteOpen(false); setError(err?.response?.data?.error ?? 'Delete failed'); }
  };
  // Re-open the submission form with this benchmark's inputs prefilled.
  const repopulate = () => navigate('/benchmark/submit', {
    state: { prefillData: { name: task.name, repository: extra.repository ?? '', hash: extra.hash ?? '', category: benchmark?.category ?? '', fields: extra } },
  });

  return (
    <>
      <PageHeader>
        <PageBreadcrumbs items={[{ label: 'Benchmark', to: '/benchmark' }, { label: `${task.name} (#${task.id})` }]} />
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
            <Button variant="outlined" startIcon={<ContentCopyIcon />} onClick={repopulate}>Populate new submission form</Button>
            {!task.done ? (
              <Button variant="outlined" color="error" onClick={doAbort}>Abort submission</Button>
            ) : (
              <Button variant="outlined" color="error" onClick={() => setDeleteOpen(true)}>Delete submission</Button>
            )}
          </Stack>
        </Box>

        <SubmissionDetails>
          <DetailRow label="Repository"><code>{extra.repository || '—'}</code></DetailRow>
          <DetailRow label="Hash"><code>{extra.hash || '—'}</code></DetailRow>
          <DetailRow label="VNNLIB version"><code>{extra.vnnlib_version || '—'}</code></DetailRow>
          <DetailRow label="Owner">
            {user?.is_admin ? (
              <OwnerReassign taskId={task.id} currentName={task.user_name} currentEmail={task.user_email} onChanged={load} />
            ) : (
              <OwnerLabel name={task.user_name} email={task.user_email} />
            )}
          </DetailRow>
        </SubmissionDetails>
      </PageHeader>

      <DeleteSubmissionDialog open={deleteOpen} name={task.name} deleting={deleting}
        note="The generated benchmark itself is not removed."
        onCancel={() => setDeleteOpen(false)} onConfirm={doDelete} />

      <PageSection>
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
        <Typography variant="h5" fontWeight="bold" gutterBottom>Pipeline</Typography>
        <TaskPipeline steps={task.steps} benchmarkProgress={task.benchmark_progress} />

        {benchmark && task.done && task.status === 'Done' && (
          <Alert severity="success" sx={{ mt: 3 }}>
            Benchmark generated and pushed to the benchmarks repository.
            {benchmark.published ? ' It is published and available to tool submissions.' : ' It is being published automatically.'}
          </Alert>
        )}
      </PageSection>
    </>
  );
}
