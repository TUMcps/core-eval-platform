import { useEffect, useState } from 'react';
import {
  Paper, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  TextField, MenuItem, Stack, Button, Box,
} from '@mui/material';
import { tracksApi } from '../api';
import type { Track, Scoreboard } from '../api';

export default function ScoreboardPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [trackId, setTrackId] = useState('');
  const [board, setBoard] = useState<Scoreboard | null>(null);
  const [newTrack, setNewTrack] = useState('');

  const loadTracks = async () => setTracks(await tracksApi.list());
  useEffect(() => { loadTracks(); }, []);
  useEffect(() => { if (trackId) tracksApi.scoreboard(trackId).then(setBoard).catch(() => setBoard(null)); }, [trackId]);

  const addTrack = async () => {
    if (!newTrack) return;
    const t = await tracksApi.create(newTrack);
    setNewTrack('');
    await loadTracks();
    setTrackId(t.id);
  };

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>Scoreboard</Typography>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <TextField select label="Track" value={trackId} onChange={(e) => setTrackId(e.target.value)} sx={{ minWidth: 200 }}>
            {tracks.map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
          </TextField>
          <Box sx={{ flexGrow: 1 }} />
          <TextField size="small" label="New track" value={newTrack} onChange={(e) => setNewTrack(e.target.value)} />
          <Button size="small" variant="outlined" onClick={addTrack}>Add track</Button>
        </Stack>
      </Paper>

      {board && (
        <Paper sx={{ p: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>{board.columns.map((c) => <TableCell key={c}>{c}</TableCell>)}</TableRow>
            </TableHead>
            <TableBody>
              {board.rows.map((row, i) => (
                <TableRow key={i}>{board.columns.map((c) => <TableCell key={c}>{String(row[c] ?? '')}</TableCell>)}</TableRow>
              ))}
              {board.rows.length === 0 && <TableRow><TableCell colSpan={board.columns.length}><Box sx={{ color: 'text.secondary' }}>No results yet.</Box></TableCell></TableRow>}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Stack>
  );
}
