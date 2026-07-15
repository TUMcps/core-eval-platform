import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageBreadcrumbs from '../components/PageBreadcrumbs';
import PageHeader from '../components/PageHeader';
import PageSection from '../components/PageSection';
import { benchmarksApi } from '../api';
import type { Benchmark } from '../api';
import { formatDateTime } from '../utils/datetime';
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
import Typography from '@mui/material/Typography';

export default function BenchmarkSubmissionsPage() {
  const [items, setItems] = useState<Benchmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  useEffect(() => {
    benchmarksApi.list().then((d) => setItems([...d].reverse())).catch((e) => console.error(e)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}><CircularProgress /></Box>;

  return (
    <>
      <PageHeader>
        <PageBreadcrumbs items={[{ label: 'Benchmark' }]} />
        <Typography variant="h3" fontWeight="bold" gutterBottom>Benchmark Submissions</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Use this page to submit benchmarks and review proposed benchmark entries.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 3 }}>
          <Button component={Link} to="/benchmark/submit" variant="contained" size="large">Propose a new benchmark</Button>
          <Button component={Link} to="/benchmark/info" variant="outlined" size="large" sx={{ fontSize: '1rem', px: 4 }}>Read how the system works</Button>
        </Stack>
      </PageHeader>

      <PageSection>
        <Typography variant="h4" fontWeight="bold" gutterBottom>Proposed Benchmarks</Typography>
        <Typography variant="body1" sx={{ mb: 4 }} color="text.secondary">
          Below are all submitted benchmarks. Add their instances and publish them so tools can run against them.
        </Typography>
        <TableContainer component={Paper} elevation={2}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Instances</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((b) => (
                <TableRow key={b.id} hover>
                  <TableCell>{formatDateTime(b.created_at)}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{b.name}</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{b.category}</TableCell>
                  <TableCell>{b.instances.length}</TableCell>
                  <TableCell align="center"><Chip label={b.published ? 'Published' : 'Draft'} color={b.published ? 'success' : 'default'} size="small" /></TableCell>
                  <TableCell align="center"><Button component={Link} to={`/benchmark/submission/${b.id}`} variant="outlined" size="small" sx={{ fontSize: '0.9rem', px: 4, py: 1 }}>View</Button></TableCell>
                </TableRow>
              ))}
              {items.length === 0 && <TableRow><TableCell colSpan={6}><Typography color="text.secondary" sx={{ py: 2 }}>No benchmarks yet.</Typography></TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={items.length} page={page} onPageChange={(_e, p) => setPage(p)}
          rowsPerPage={rowsPerPage} onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }} rowsPerPageOptions={[25, 50, 100]} />
      </PageSection>
    </>
  );
}
