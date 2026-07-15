import { useEffect, useState } from 'react';
import { Paper, Typography, Table, TableHead, TableRow, TableCell, TableBody, Box } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { tasksApi } from '../api';
import type { Task } from '../api';
import StatusChip from '../components/StatusChip';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  useEffect(() => { tasksApi.list().then(setTasks).catch(() => {}); }, []);

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>Tasks</Typography>
      <Table size="small">
        <TableHead>
          <TableRow><TableCell>Task</TableCell><TableCell>Outcome</TableCell><TableCell>Steps</TableCell><TableCell>Created</TableCell></TableRow>
        </TableHead>
        <TableBody>
          {tasks.map((t) => (
            <TableRow key={t.id} hover>
              <TableCell><RouterLink to={`/tasks/${t.id}`}>{t.id.slice(0, 8)}</RouterLink></TableCell>
              <TableCell><StatusChip status={t.outcome} /></TableCell>
              <TableCell>{t.steps.length}</TableCell>
              <TableCell>{new Date(t.created_at).toLocaleString()}</TableCell>
            </TableRow>
          ))}
          {tasks.length === 0 && <TableRow><TableCell colSpan={4}><Box sx={{ color: 'text.secondary' }}>No tasks yet — run a tool.</Box></TableCell></TableRow>}
        </TableBody>
      </Table>
    </Paper>
  );
}
