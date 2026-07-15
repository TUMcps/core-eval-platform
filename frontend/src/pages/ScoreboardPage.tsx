import { useEffect, useState } from 'react';
import {
  Card, CardHeader, CardContent, Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  TextField, MenuItem, Stack, Button, Typography,
} from '@mui/material';
import { tracksApi } from '../api';
import type { Track, Scoreboard } from '../api';
import PageHeader from '../components/PageHeader';
import PageSection from '../components/PageSection';

export default function ScoreboardPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [trackId, setTrackId] = useState('');
  const [board, setBoard] = useState<Scoreboard | null>(null);
  const [newTrack, setNewTrack] = useState('');

  const loadTracks = async () => setTracks(await tracksApi.list());
  useEffect(() => { loadTracks(); }, []);
  useEffect(() => { if (trackId) tracksApi.scoreboard(trackId).then(setBoard).catch(() => setBoard(null)); else setBoard(null); }, [trackId]);

  const addTrack = async () => {
    if (!newTrack) return;
    const t = await tracksApi.create(newTrack); setNewTrack(''); await loadTracks(); setTrackId(t.id);
  };

  const controls = (
    <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
      <TextField select size="small" label="Track" value={trackId} onChange={(e) => setTrackId(e.target.value)} sx={{ minWidth: 180, bgcolor: 'background.paper' }}>
        {tracks.map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
        {tracks.length === 0 && <MenuItem disabled value="">No tracks yet</MenuItem>}
      </TextField>
      <TextField size="small" label="New track" value={newTrack} onChange={(e) => setNewTrack(e.target.value)} sx={{ bgcolor: 'background.paper' }} />
      <Button size="small" variant="outlined" onClick={addTrack}>Add</Button>
    </Stack>
  );

  return (
    <>
      <PageHeader title="Scoreboard" subtitle="Per-track ranking, scored by the active competition." action={controls} />
      <PageSection>
        <Card>
          <CardHeader title={tracks.find((t) => t.id === trackId)?.name ?? 'Select a track'} />
          <CardContent>
            {board ? (
              <TableContainer>
                <Table size="small">
                  <TableHead><TableRow>{board.columns.map((c) => <TableCell key={c} sx={{ textTransform: 'capitalize' }}>{c}</TableCell>)}</TableRow></TableHead>
                  <TableBody>
                    {board.rows.map((row, i) => (
                      <TableRow key={i} hover>{board.columns.map((c) => <TableCell key={c}>{String(row[c] ?? '')}</TableCell>)}</TableRow>
                    ))}
                    {board.rows.length === 0 && <TableRow><TableCell colSpan={board.columns.length}><Typography color="text.secondary" sx={{ py: 2 }}>No results yet for this track.</Typography></TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography color="text.secondary" sx={{ py: 2 }}>Pick a track (or add one) to see its scoreboard.</Typography>
            )}
          </CardContent>
        </Card>
      </PageSection>
    </>
  );
}
