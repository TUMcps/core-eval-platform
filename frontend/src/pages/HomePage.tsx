import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Box, Container, Typography, Button, Grid, Card, CardContent, Stack, Chip } from '@mui/material';
import BuildIcon from '@mui/icons-material/Build';
import BarChartIcon from '@mui/icons-material/BarChart';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { competitionApi } from '../api';
import type { CompetitionInfo } from '../api';
import { useAuth } from '../context/AuthContext';

const STEPS = [
  { n: 1, label: 'Submit', text: 'Upload verification tools and benchmarks.' },
  { n: 2, label: 'Run', text: 'They run on provisioned workers, staged per benchmark.' },
  { n: 3, label: 'Score', text: 'Results are collected, scored, and ranked per track.' },
];

export default function HomePage() {
  const { user } = useAuth();
  const [comp, setComp] = useState<CompetitionInfo | null>(null);
  useEffect(() => { competitionApi.info().then(setComp).catch(() => {}); }, []);
  const name = comp?.display_name ?? 'Evaluation Platform';

  return (
    <Box>
      <Box sx={{ bgcolor: 'grey.50', minHeight: '62vh', display: 'flex', alignItems: 'center' }}>
        <Container>
          <Grid container spacing={6} alignItems="center">
            <Grid size={{ xs: 12, lg: 7 }}>
              <Chip label={`${comp?.name ?? '…'} variant`} color="primary" size="small" sx={{ mb: 2 }} />
              <Typography variant="h1" sx={{ fontSize: { xs: '2.6rem', md: '4.2rem' }, fontWeight: 800, lineHeight: 1.05, mb: 2, color: '#000' }}>
                {user ? `Welcome back` : name}
              </Typography>
              <Typography variant="h5" sx={{ fontSize: { xs: '1.05rem', md: '1.35rem' }, mb: 4, color: '#374151', fontWeight: 400, maxWidth: 640 }}>
                Submit verification tools and benchmarks, run them on provisioned workers, and compare results — one platform, many competition variants.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                {user ? (
                  <>
                    <Button component={Link} to="/tools" variant="contained" size="large" startIcon={<BuildIcon />}>Tools</Button>
                    <Button component={Link} to="/benchmarks" variant="outlined" size="large" startIcon={<BarChartIcon />}>Benchmarks</Button>
                    <Button component={Link} to="/scoreboard" variant="outlined" size="large" startIcon={<EmojiEventsIcon />}>Scoreboard</Button>
                  </>
                ) : (
                  <>
                    <Button component={Link} to="/login" variant="contained" size="large">Log in</Button>
                    <Button component={Link} to="/signup" variant="contained" size="large">Sign up</Button>
                  </>
                )}
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, lg: 5 }}>
              <Card elevation={2} sx={{ borderRadius: 3 }}>
                <CardContent sx={{ p: 4 }}>
                  <Typography variant="overline" color="text.secondary">How it works</Typography>
                  <Stack spacing={2.5} sx={{ mt: 1 }}>
                    {STEPS.map((s) => (
                      <Stack key={s.n} direction="row" spacing={2} alignItems="flex-start">
                        <Box sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: 'primary.main', color: 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>{s.n}</Box>
                        <Box>
                          <Typography sx={{ fontWeight: 700 }}>{s.label}</Typography>
                          <Typography variant="body2" color="text.secondary">{s.text}</Typography>
                        </Box>
                      </Stack>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>
      <Box sx={{ bgcolor: 'white', py: 3, textAlign: 'center', borderTop: '1px solid', borderColor: 'divider' }}>
        <Container>
          <Typography variant="body2" color="text.secondary">
            {name} — evaluation platform. © {new Date().getFullYear()}.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
