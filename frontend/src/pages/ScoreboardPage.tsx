import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import PageBreadcrumbs from '../components/PageBreadcrumbs';
import PageHeader from '../components/PageHeader';
import PageSection from '../components/PageSection';
import PageTitle from '../components/PageTitle';
import { tracksApi } from '../api';
import type { Scoreboard, Track } from '../api';

export default function ScoreboardPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selected, setSelected] = useState('');
  const [board, setBoard] = useState<Scoreboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tracksApi.list().then(async (items) => {
      setTracks(items);
      const first = items[0]?.id || '';
      setSelected(first);
      if (first) setBoard(await tracksApi.scoreboard(first));
    }).finally(() => setLoading(false));
  }, []);

  const selectTrack = (track: string) => {
    setSelected(track);
    setLoading(true);
    tracksApi.scoreboard(track).then(setBoard).finally(() => setLoading(false));
  };

  const groups = board?.groups?.length
    ? board.groups
    : board ? [{ name: 'default', columns: board.columns, rows: board.rows }] : [];
  const showHeadings = groups.length > 1 || (groups.length === 1 && groups[0].name !== 'default');

  return (
    <>
      <PageHeader>
        <PageBreadcrumbs items={[{ label: 'Scoreboard' }]} />
        <PageTitle>Scoreboard</PageTitle>
        <Typography color="text.secondary">Results are scored independently for each benchmark group.</Typography>
      </PageHeader>
      <PageSection>
        <TextField select label="Track" value={selected} onChange={(event) => selectTrack(event.target.value)}
          sx={{ minWidth: 260, mb: 3 }} disabled={!tracks.length}>
          {tracks.map((track) => <MenuItem key={track.id} value={track.id}>{track.name}</MenuItem>)}
        </TextField>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : !tracks.length ? (
          <Typography color="text.secondary">No evaluation tracks have been configured.</Typography>
        ) : groups.map((group) => (
          <Box key={group.name} sx={{ mb: 4 }}>
            {showHeadings && <Typography variant="h5" fontWeight="bold" sx={{ mb: 1.5 }}>{group.name}</Typography>}
            <TableContainer component={Paper} elevation={2}>
              <Table>
                <TableHead><TableRow>{group.columns.map((column) => (
                  <TableCell key={column} sx={{ fontWeight: 600 }}>{column}</TableCell>
                ))}</TableRow></TableHead>
                <TableBody>
                  {group.rows.map((row, index) => (
                    <TableRow key={index}>{group.columns.map((column) => (
                      <TableCell key={column}>{String(row[column] ?? '—')}</TableCell>
                    ))}</TableRow>
                  ))}
                  {!group.rows.length && <TableRow><TableCell colSpan={Math.max(group.columns.length, 1)}>
                    <Typography color="text.secondary" sx={{ py: 2 }}>No scored results in this group.</Typography>
                  </TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        ))}
      </PageSection>
    </>
  );
}
