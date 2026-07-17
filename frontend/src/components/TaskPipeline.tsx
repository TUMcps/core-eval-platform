import { useState, useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Box, Typography, Paper, Chip, Button } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import LiveIndicator from './LiveIndicator';
import CollapsibleSection from './CollapsibleSection';
import ResultsTable, { ResultsSummary } from './ResultsTable';
import { tasksApi } from '../api';
import type { TaskStep, BenchmarkProgress, Result } from '../api';
import { statusChip } from '../constants/status';
import { KIND_LABEL, STEP_STATUS, isPauseKind } from '../constants/steps';
import { logTail } from '../utils/logTail';
import { formatDateTime } from '../utils/datetime';

const isAtBottom = (el: HTMLDivElement | null) =>
  !el || el.scrollHeight - el.scrollTop - el.clientHeight < 50;

interface Props {
  steps: TaskStep[];
  /** Names each run_benchmark step, keyed by step order. */
  benchmarkProgress?: BenchmarkProgress[];
  /** The task's results; each lands under the benchmark step that produced it. */
  results?: Result[];
  /** The variant's presentation.result_columns. */
  resultColumns?: string[];
  /** The task these steps belong to; needed to download a step's exported archive. */
  taskId?: number;
}

/** A submission's ordered steps: status, live-tailing logs, per-benchmark results, timings. */
export default function TaskPipeline({ steps, benchmarkProgress, results = [], resultColumns, taskId }: Props) {
  const [openLogs, setOpenLogs] = useState<Record<string, boolean>>({});
  const [openResults, setOpenResults] = useState<Record<string, boolean>>({});
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const logRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // A log box follows its tail until the user scrolls up inside it, so reading
  // earlier output isn't yanked back down by the next refresh.
  const pinned = useRef<Record<string, boolean>>({});

  const jumpToTail = (id: string) => {
    const el = logRefs.current[id];
    if (el) el.scrollTop = el.scrollHeight;
  };

  const download = async (step: TaskStep) => {
    if (taskId === undefined) return;
    setDownloading((d) => ({ ...d, [step.id]: true }));
    try {
      const blob = await tasksApi.resultsArchive(taskId, step.order);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `task${taskId}_step${step.order}_results.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // The button only shows once the export step is done, so a failure here means
      // the archive went missing server-side; the step's own log says why.
    } finally {
      setDownloading((d) => ({ ...d, [step.id]: false }));
    }
  };

  const benchmarkAt = new Map((benchmarkProgress ?? []).map((p) => [p.step_id, p.name]));
  /** The benchmark a run step ran, or undefined for every other kind. */
  const benchmarkOf = (s: TaskStep) => (s.kind === 'run_benchmark' ? benchmarkAt.get(s.order) : undefined);
  const stepName = (s: TaskStep): ReactNode => {
    const name = benchmarkOf(s);
    if (name) return <>Run benchmark: <strong>{name}</strong></>;
    return KIND_LABEL[s.kind] ?? s.kind;
  };

  useLayoutEffect(() => {
    steps.forEach((s) => { if (pinned.current[s.id] ?? true) jumpToTail(s.id); });
  }, [steps]);

  return (
    <>
      {steps.map((s) => {
        const active = s.status === 'active';
        const paused = active && isPauseKind(s.kind);
        const chip = statusChip(paused ? 'Paused' : (STEP_STATUS[s.status] ?? 'Pending'));
        const logsOpen = openLogs[s.id] ?? active;  // the running step's logs start expanded
        const name = benchmarkOf(s);
        const stepResults = name ? results.filter((r) => r.benchmark_name === name) : [];
        return (
          <Paper key={s.id} id={`step-${s.order}`} elevation={active ? 3 : 0}
            sx={{ p: 3, mb: 2, bgcolor: 'grey.50', border: '1px solid', borderColor: active ? 'secondary.main' : 'grey.300' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography sx={{ fontWeight: 600, minWidth: 24, color: 'text.secondary' }}>{s.order + 1}.</Typography>
              <Typography sx={{ fontWeight: 600, flexGrow: 1 }} component="div">{stepName(s)}</Typography>
              {active && !paused && <LiveIndicator label={null} />}
              <Chip size="small" label={chip.label} color={chip.color} variant={chip.variant} />
            </Box>

            {s.has_logs ? (
              <CollapsibleSection title="Logs" open={logsOpen}
                onToggle={() => {
                  const next = !logsOpen;
                  setOpenLogs((o) => ({ ...o, [s.id]: next }));
                  // Opening a collapsed log jumps it to the tail (after the expand animation).
                  if (next) { pinned.current[s.id] = true; setTimeout(() => jumpToTail(s.id), 120); }
                }}>
                <Box className="console_log"
                  ref={(el: HTMLDivElement | null) => { logRefs.current[s.id] = el; }}
                  onScroll={(e) => { pinned.current[s.id] = isAtBottom(e.currentTarget); }}>
                  {logTail(s.logs)}
                </Box>
              </CollapsibleSection>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {active ? 'Running… logs will appear here as the worker reports back.' : 'No logs for this step.'}
              </Typography>
            )}

            {s.can_download_results && taskId !== undefined && (
              <Box sx={{ mt: 1.5 }}>
                <Button variant="outlined" size="small" startIcon={<DownloadIcon />}
                  disabled={!!downloading[s.id]} onClick={() => download(s)}>
                  {downloading[s.id] ? 'Preparing download…' : 'Download results'}
                </Button>
              </Box>
            )}

            {stepResults.length > 0 && (
              <CollapsibleSection title={`Results (${stepResults.length})`}
                open={openResults[s.id] ?? false}
                onToggle={() => setOpenResults((o) => ({ ...o, [s.id]: !(o[s.id] ?? false) }))}>
                <Box sx={{ mt: 1 }}>
                  <Box sx={{ mb: 1 }}><ResultsSummary results={stepResults} /></Box>
                  <ResultsTable results={stepResults} columns={resultColumns} />
                </Box>
              </CollapsibleSection>
            )}

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              {s.started_at ? `started ${formatDateTime(s.started_at)}` : 'not started'}
              {s.finished_at ? ` · finished ${formatDateTime(s.finished_at)}` : ''}
            </Typography>
          </Paper>
        );
      })}
    </>
  );
}
