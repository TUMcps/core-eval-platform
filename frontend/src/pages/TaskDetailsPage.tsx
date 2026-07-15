import { useEffect, useState } from 'react';
import { Paper, Typography, Table, TableHead, TableRow, TableCell, TableBody, Stack } from '@mui/material';
import { useParams } from 'react-router-dom';
import { tasksApi } from '../api';
import type { Task } from '../api';
import StatusChip from '../components/StatusChip';

export default function TaskDetailsPage() {
  const { id } = useParams();
  const [task, setTask] = useState<Task | null>(null);
  useEffect(() => { if (id) tasksApi.get(id).then(setTask).catch(() => {}); }, [id]);

  if (!task) return null;
  return (
    <Stack spacing={3}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>Task {task.id.slice(0, 8)}</Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <StatusChip status={task.outcome} />
          <Typography color="text.secondary">
            {task.tool ? 'tool run' : 'benchmark'} · created {new Date(task.created_at).toLocaleString()}
          </Typography>
        </Stack>
      </Paper>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>Steps</Typography>
        <Table size="small">
          <TableHead>
            <TableRow><TableCell>#</TableCell><TableCell>Kind</TableCell><TableCell>Status</TableCell><TableCell>Started</TableCell><TableCell>Finished</TableCell></TableRow>
          </TableHead>
          <TableBody>
            {task.steps.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.order}</TableCell>
                <TableCell>{s.kind}</TableCell>
                <TableCell><StatusChip status={s.status} /></TableCell>
                <TableCell>{s.started_at ? new Date(s.started_at).toLocaleTimeString() : '—'}</TableCell>
                <TableCell>{s.finished_at ? new Date(s.finished_at).toLocaleTimeString() : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
