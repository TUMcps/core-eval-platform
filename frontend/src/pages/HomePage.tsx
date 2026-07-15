import { useEffect, useState } from 'react';
import { Paper, Box, Typography, Button, Stack } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { competitionApi } from '../api';
import type { CompetitionInfo } from '../api';
import { useAuth } from '../context/AuthContext';

export default function HomePage() {
  const { user } = useAuth();
  const [comp, setComp] = useState<CompetitionInfo | null>(null);
  useEffect(() => { competitionApi.info().then(setComp).catch(() => {}); }, []);

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto' }}>
      <Paper sx={{ p: 5 }}>
        <Typography variant="h3" gutterBottom>{comp?.display_name ?? 'Evaluation Platform'}</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Submit verification tools and benchmarks, run them on provisioned workers, and view results.
          This deployment runs the <b>{comp?.name ?? '…'}</b> competition variant.
        </Typography>
        {user ? (
          <Stack direction="row" spacing={1.5} flexWrap="wrap">
            <Button component={RouterLink} to="/tools" variant="contained">Tools</Button>
            <Button component={RouterLink} to="/benchmarks" variant="outlined">Benchmarks</Button>
            <Button component={RouterLink} to="/tasks" variant="outlined">Tasks</Button>
            <Button component={RouterLink} to="/scoreboard" variant="outlined">Scoreboard</Button>
          </Stack>
        ) : (
          <Stack direction="row" spacing={1.5}>
            <Button component={RouterLink} to="/login" variant="contained">Log in</Button>
            <Button component={RouterLink} to="/signup" variant="outlined">Sign up</Button>
          </Stack>
        )}
      </Paper>
    </Box>
  );
}
