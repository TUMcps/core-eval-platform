import { Fragment, useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Chip, Stack, Alert } from '@mui/material';
import Skeleton from '@mui/material/Skeleton';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PageBreadcrumbs from '../components/PageBreadcrumbs';
import PageHeader from '../components/PageHeader';
import PageTitle from '../components/PageTitle';
import PageSection from '../components/PageSection';
import LiveIndicator from '../components/LiveIndicator';
import OwnerLabel from '../components/OwnerLabel';
import OwnerReassign from '../components/OwnerReassign';
import DetailRow from '../components/DetailRow';
import SubmissionDetails from '../components/SubmissionDetails';
import DeleteSubmissionDialog from '../components/DeleteSubmissionDialog';
import TaskPipeline from '../components/TaskPipeline';
import TaskTimer from '../components/TaskTimer';
import { useAuth } from '../context/AuthContext';
import { tasksApi, benchmarksApi, downloadTaskResults } from '../api';
import type { Task, Benchmark } from '../api';
import { statusChip } from '../constants/status';
import { isPauseKind } from '../constants/steps';
import { usePageTitle } from '../hooks/usePageTitle';

const REFRESH_MS = 10000;

function BenchmarkDetailsSkeleton() {
  return (
    <>
      <PageHeader>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ flexGrow: 1, minWidth: 280 }}>
            <Skeleton variant="text" width="42%" height={68} />
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Skeleton variant="rounded" width={92} height={28} />
              <Skeleton variant="rounded" width={56} height={24} />
              <Skeleton variant="rounded" width={92} height={24} />
            </Stack>
          </Box>
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
            <Skeleton variant="rounded" width={118} height={36} />
            <Skeleton variant="rounded" width={236} height={36} />
            <Skeleton variant="rounded" width={148} height={36} />
          </Stack>
        </Box>

        <Box sx={{ mt: 3, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
          <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Skeleton variant="text" width={180} height={28} />
          </Box>
          <Box sx={{ px: 2.5, py: 2.5 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 2, rowGap: 1, alignItems: 'baseline' }}>
              {Array.from({ length: 4 }).map((_, index) => (
                <Fragment key={index}>
                  <Skeleton variant="text" width={index === 0 ? 96 : 72} height={24} />
                  <Skeleton variant="text" width={index === 0 ? '68%' : '52%'} height={24} />
                </Fragment>
              ))}
            </Box>
          </Box>
        </Box>
      </PageHeader>

      <PageSection>
        <Skeleton variant="text" width={120} height={40} sx={{ mb: 2 }} />
        {Array.from({ length: 6 }).map((_, index) => (
          <Box
            key={index}
            sx={{
              p: 3,
              mb: 2,
              bgcolor: 'grey.50',
              border: '1px solid',
              borderColor: 'grey.300',
              borderRadius: 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Skeleton variant="text" width={20} height={28} />
              <Skeleton variant="text" width="38%" height={28} sx={{ flexGrow: 1 }} />
              <Skeleton variant="rounded" width={72} height={24} />
              <Skeleton variant="rounded" width={56} height={24} />
            </Box>
            <Skeleton variant="rectangular" width="42%" height={18} sx={{ mt: 1 }} />
            <Skeleton variant="rectangular" width="100%" height={72} sx={{ mt: 2, borderRadius: 1 }} />
          </Box>
        ))}
      </PageSection>
    </>
  );
}

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

  if (loading) return <BenchmarkDetailsSkeleton />;
  if (!task) return <PageSection><Typography>Task not found.</Typography></PageSection>;

  const overall = statusChip(task.status || (task.done ? 'Done' : 'Running'));
  const active = task.steps.find((s) => s.status === 'active');
  const isPaused = !!active && isPauseKind(active.kind);
  const isRemoteDocker = task.execution_backend === 'remote_docker';
  const canDownloadResults = task.done || ['done', 'success', 'succeeded', 'failed', 'timed_out', 'error', 'aborted'].includes((task as any).status || (task as any).outcome);
  const extra = ((benchmark?.extra ?? (task as any).payload ?? {}) as Record<string, any>);
  const repository = task.repository || '';
  const hash = task.hash || '';
  const categoryId = (task.category ?? benchmark?.category ?? '') as string;
  // A per-category load (ARCH) is a category task, not one Benchmark.
  const isCategoryLoad = !task.benchmark && !!task.category;

  const doAbort = async () => { if (window.confirm('Abort this submission?')) setTask(await tasksApi.abort(task.id)); };
  const doResume = async () => { setTask(await tasksApi.resume(task.id)); };
  const doDownloadResults = async () => {
    try {
      await downloadTaskResults(task.id);
    } catch (err) {
      console.error('Download results failed', err);
    }
  };
  const doDelete = async () => {
    setDeleting(true);
    try { await tasksApi.delete(task.id); navigate('/benchmark'); }
    catch (err: any) { setDeleting(false); setDeleteOpen(false); setError(err?.response?.data?.error ?? 'Delete failed'); }
  };
  // Re-open the submission form with this submission's inputs prefilled. (The ARCH form
  // ignores `name`; the VNN form ignores `category`.)
  const repopulate = () => navigate('/benchmark/submit', {
    state: { prefillData: { name: task.name, repository, hash, category: categoryId, fields: extra } },
  });

  return (
    <>
      <PageHeader>
        <PageBreadcrumbs items={[{ label: 'Benchmark', to: '/benchmark' }, { label: `${task.name} (#${task.id})` }]} />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ flexGrow: 1, minWidth: 280 }}>
            <PageTitle variant="h3" mb={1}>{task.name}</PageTitle>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Chip label={overall.label} color={overall.color} variant={overall.variant} />
              {!task.done && <LiveIndicator label="Live" />}
              <TaskTimer task={task} />
            </Stack>
          </Box>
          <Stack direction="row" spacing={1.5}>
            {isPaused && <Button variant="contained" onClick={doResume}>Continue</Button>}
            <Button variant="outlined" startIcon={<ContentCopyIcon />} onClick={repopulate}>Populate new submission form</Button>
            {canDownloadResults && <Button variant="outlined" onClick={doDownloadResults}>Download Results</Button>}
            {!task.done ? (
              <Button variant="outlined" color="error" onClick={doAbort}>Abort submission</Button>
            ) : (
              <Button variant="outlined" color="error" onClick={() => setDeleteOpen(true)}>Delete submission</Button>
            )}
          </Stack>
        </Box>

        <SubmissionDetails>
          {isCategoryLoad && <DetailRow label="Category"><code>{task.name}</code></DetailRow>}
          <DetailRow label="Repository"><code>{repository || '—'}</code></DetailRow>
          <DetailRow label="Hash"><code>{hash || '—'}</code></DetailRow>
          {!isCategoryLoad && <DetailRow label="VNNLIB version"><code>{extra.vnnlib_version || '—'}</code></DetailRow>}
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
        {isRemoteDocker && !task.done && active?.kind === 'assign' && <Alert severity="warning" sx={{ mb: 3 }}>This submission is running on remote_docker. If it appears to stall while assigning a worker, the worker service may still be provisioning or syncing the container.</Alert>}
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
