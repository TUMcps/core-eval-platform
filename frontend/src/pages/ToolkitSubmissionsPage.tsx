import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageBreadcrumbs from '../components/PageBreadcrumbs';
import PageHeader from '../components/PageHeader';
import PageSection from '../components/PageSection';
import LiveIndicator from '../components/LiveIndicator';
import OwnerLabel from '../components/OwnerLabel';
import { toolkitApi } from '../api';
import type { Task } from '../api';
import { useAuth } from '../context/AuthContext';
import { statusChip, statusGroupRank } from '../constants/status';
import { benchmarkStateColor, BENCHMARK_STATE_LEGEND } from '../constants/benchmarks';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

export default function ToolkitSubmissionsPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const loadTasks = async () => {
    try {
      const data = await toolkitApi.getList();
      const ordered = data.reverse();
      ordered.sort((a, b) => statusGroupRank(a.status || 'Running') - statusGroupRank(b.status || 'Running'));
      setTasks(ordered);
    } catch (e) { console.error('Failed to load tasks:', e); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadTasks(); }, []);

  const anyRunning = tasks.some((t) => !t.done);
  useEffect(() => {
    if (!anyRunning) return;
    const handle = setInterval(loadTasks, 30000);
    return () => clearInterval(handle);
  }, [anyRunning]);

  const filtered = searchTerm ? tasks.filter((t) => t.name?.toLowerCase().includes(searchTerm.toLowerCase())) : tasks;
  useEffect(() => { setPage(0); }, [searchTerm]);
  const paged = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}><CircularProgress /></Box>;

  return (
    <>
      <PageHeader>
        <PageBreadcrumbs items={[{ label: 'Toolkit' }]} />
        <Typography variant="h3" fontWeight="bold" gutterBottom>Toolkit Submissions</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Use this page to submit a toolkit and review current toolkit submissions.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 3 }}>
          <Button component={Link} to="/toolkit/submit" variant="contained" size="large">Submit a new toolkit</Button>
          <Button component={Link} to="/toolkit/info" variant="outlined" size="large" sx={{ fontSize: '1rem', px: 4 }}>Read how the system works</Button>
        </Stack>
      </PageHeader>

      <PageSection>
        <Typography variant="h4" fontWeight="bold" gutterBottom>Your Submitted Toolkits</Typography>

        {user?.is_admin && (
          <TextField placeholder="Search for names..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} size="small"
            sx={{ mb: 3, maxWidth: '400px', '& .MuiOutlinedInput-root': { borderRadius: '20px' } }} />
        )}

        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="body2" color="text.secondary">Benchmark progress:</Typography>
          {BENCHMARK_STATE_LEGEND.map((item) => (
            <Chip key={item.state} label={item.label} color={benchmarkStateColor(item.state)} size="small" />
          ))}
          {anyRunning && <LiveIndicator label="Live" />}
        </Box>

        <TableContainer component={Paper} elevation={2}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                {user?.is_admin && <TableCell sx={{ fontWeight: 600 }}>User</TableCell>}
                <TableCell sx={{ fontWeight: 600 }}>Benchmarks</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paged.map((task) => {
                const chip = statusChip(task.status || 'Running');
                const date = task.created_at ? new Date(task.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
                return (
                  <TableRow key={task.id} hover>
                    <TableCell>{date}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{task.name}</TableCell>
                    {user?.is_admin && <TableCell sx={{ color: 'text.secondary' }}><OwnerLabel stacked name={task.user_name} email={task.user_email} /></TableCell>}
                    <TableCell>
                      {task.benchmark_progress?.length ? (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5 }}>
                          {task.benchmark_progress.map((b, i) => (
                            <Fragment key={`${b.name}-${i}`}>
                              <Chip label={b.name} title={b.state} color={benchmarkStateColor(b.state)} size="small" clickable
                                {...({ component: Link, to: `/toolkit/submission/${task.id}#step-${b.step_id}` } as any)} />
                            </Fragment>
                          ))}
                        </Box>
                      ) : 'N/A'}
                    </TableCell>
                    <TableCell align="center"><Chip label={chip.label} color={chip.color} variant={chip.variant} size="small" /></TableCell>
                    <TableCell align="center">
                      <Button component={Link} to={`/toolkit/submission/${task.id}`} variant="outlined" size="small" sx={{ fontSize: '0.9rem', px: 4, py: 1 }}>View</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {paged.length === 0 && <TableRow><TableCell colSpan={6}><Typography color="text.secondary" sx={{ py: 2 }}>No toolkit submissions yet.</Typography></TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={filtered.length} page={page} onPageChange={(_e, p) => setPage(p)}
          rowsPerPage={rowsPerPage} onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }} rowsPerPageOptions={[25, 50, 100]} />
      </PageSection>
    </>
  );
}
