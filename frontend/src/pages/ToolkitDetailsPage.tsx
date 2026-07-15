import { useState, useEffect, useRef } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, CircularProgress, Chip, Accordion, AccordionSummary,
  AccordionDetails, Stack,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PageBreadcrumbs from '../components/PageBreadcrumbs';
import PageHeader from '../components/PageHeader';
import PageSection from '../components/PageSection';
import LiveIndicator from '../components/LiveIndicator';
import { toolkitApi } from '../api';
import type { Task, TaskStep } from '../api';
import { statusChip } from '../constants/status';
import { usePageTitle } from '../hooks/usePageTitle';

const REFRESH_MS = 10000;
const STEP_STATUS: Record<string, string> = { pending: 'Pending', active: 'Running', done: 'Done', failed: 'Error', aborted: 'Aborted' };
const PAUSE_KIND = 'vnn_pause';

// Friendlier step names than the raw kinds.
const KIND_LABEL: Record<string, string> = {
  vnn_create: 'Create submission', assign: 'Assign worker', vnn_install: 'Install toolkit',
  vnn_pause: 'Paused (waiting to continue)', run_benchmark: 'Run benchmark', vnn_export: 'Export results', shutdown: 'Shutdown',
};

export default function ToolkitDetailsPage() {
  const { id } = useParams();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  usePageTitle(task?.name ?? 'Toolkit');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!id) return;
    try { setTask(await toolkitApi.get(id)); } catch { /* ignore */ } finally { setLoading(false); }
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

  const stepName = (s: TaskStep) => {
    if (s.kind === 'run_benchmark') return 'Run benchmark';
    return KIND_LABEL[s.kind] ?? s.kind;
  };

  const doAbort = async () => { if (window.confirm('Abort this submission?')) setTask(await toolkitApi.abort(task.id)); };
  const doResume = async () => { setTask(await toolkitApi.resume(task.id)); };

  return (
    <>
      <PageHeader>
        <PageBreadcrumbs items={[{ label: 'Toolkit', to: '/toolkit' }, { label: task.name }]} />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="h3" fontWeight="bold" gutterBottom>{task.name}</Typography>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Chip label={overall.label} color={overall.color} variant={overall.variant} />
              {!task.done && <LiveIndicator label="Live" />}
              <Typography variant="body2" color="text.secondary">Submitted {new Date(task.created_at).toLocaleString()}</Typography>
            </Stack>
          </Box>
          <Stack direction="row" spacing={1.5}>
            {isPaused && <Button variant="contained" onClick={doResume}>Continue</Button>}
            {!task.done ? (
              <Button variant="outlined" color="error" onClick={doAbort}>Abort submission</Button>
            ) : (
              <Button component={RouterLink} to="/toolkit" variant="outlined" startIcon={<ArrowBackIcon />}>Back</Button>
            )}
          </Stack>
        </Box>
      </PageHeader>

      <PageSection>
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
                    {s.started_at ? `started ${new Date(s.started_at).toLocaleTimeString()}` : 'not started'}
                    {s.finished_at ? ` · finished ${new Date(s.finished_at).toLocaleTimeString()}` : ''}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            </Paper>
          );
        })}
      </PageSection>
    </>
  );
}
