import { useState, useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Box, Typography, Paper, Chip, Collapse, IconButton } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LiveIndicator from './LiveIndicator';
import type { TaskStep, BenchmarkProgress } from '../api';
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
}

/** A submission's ordered steps: status, live-tailing logs, and timings. */
export default function TaskPipeline({ steps, benchmarkProgress }: Props) {
  const [openLogs, setOpenLogs] = useState<Record<string, boolean>>({});
  const logRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // A log box follows its tail until the user scrolls up inside it, so reading
  // earlier output isn't yanked back down by the next refresh.
  const pinned = useRef<Record<string, boolean>>({});

  const jumpToTail = (id: string) => {
    const el = logRefs.current[id];
    if (el) el.scrollTop = el.scrollHeight;
  };

  const benchmarkAt = new Map((benchmarkProgress ?? []).map((p) => [p.step_id, p.name]));
  const stepName = (s: TaskStep): ReactNode => {
    const name = s.kind === 'run_benchmark' ? benchmarkAt.get(s.order) : undefined;
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
        const open = openLogs[s.id] ?? active;  // the running step's logs start expanded
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
              <Box sx={{ mt: 1.5 }}>
                <Box onClick={() => {
                  const next = !open;
                  setOpenLogs((o) => ({ ...o, [s.id]: next }));
                  // Opening a collapsed log jumps it to the tail (after the expand animation).
                  if (next) { pinned.current[s.id] = true; setTimeout(() => jumpToTail(s.id), 120); }
                }}
                  sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none', p: 0.5, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}>
                  <IconButton size="small" sx={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                    <ExpandMoreIcon />
                  </IconButton>
                  <Typography variant="body2" fontWeight="medium">Logs</Typography>
                </Box>
                <Collapse in={open}>
                  <Box className="console_log"
                    ref={(el: HTMLDivElement | null) => { logRefs.current[s.id] = el; }}
                    onScroll={(e) => { pinned.current[s.id] = isAtBottom(e.currentTarget); }}>
                    {logTail(s.logs)}
                  </Box>
                </Collapse>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {active ? 'Running… logs will appear here as the worker reports back.' : 'No logs for this step.'}
              </Typography>
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
