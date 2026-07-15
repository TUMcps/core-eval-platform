import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import { competitionApi } from '../api';
import type { CompetitionInfo } from '../api';
import { COMPETITION_YEAR } from '../constants/formOptions';

const STEPS = [
  { n: 1, label: 'Submit', text: 'Upload a toolkit (a tool repository) and benchmarks.' },
  { n: 2, label: 'Run', text: 'Each submission runs on a provisioned worker, staged per benchmark.' },
  { n: 3, label: 'Results', text: 'Progress and results are collected, scored, and displayed.' },
];

export default function HomePage() {
  const { user } = useAuth();
  const [comp, setComp] = useState<CompetitionInfo | null>(null);
  useEffect(() => { competitionApi.info().then(setComp).catch(() => {}); }, []);
  const name = comp?.display_name ?? 'Evaluation Platform';

  return (
    <Box>
      <Box sx={{ bgcolor: 'grey.50', minHeight: '60vh', display: 'flex', alignItems: 'center' }}>
        <Container>
          <Grid container spacing={6} alignItems="center">
            <Grid size={{ xs: 12, lg: 7 }}>
              <Box sx={{ textAlign: { xs: 'center', lg: 'left' } }}>
                <Typography variant={user ? 'h2' : 'h1'} sx={{ fontSize: { xs: '2.6rem', md: user ? '3.2rem' : '5rem' }, fontWeight: 800, lineHeight: 1.1, mb: 3, color: '#000' }}>
                  {user ? `Welcome ${user.email}` : `${name} ${COMPETITION_YEAR}`}
                </Typography>
                <Typography variant="h5" sx={{ fontSize: { xs: '1.1rem', md: '1.4rem' }, mb: 4, lineHeight: 1.6, color: '#374151', fontWeight: 400 }}>
                  Submit verification toolkits against cutting-edge benchmarks, run them on provisioned
                  workers, and compare results. The {COMPETITION_YEAR} cycle is live.
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent={{ xs: 'center', lg: 'flex-start' }}>
                  {user ? (
                    <>
                      <Button component={Link} to="/toolkit" variant="contained" size="large">Toolkits</Button>
                      <Button component={Link} to="/benchmark" variant="contained" size="large">Benchmarks</Button>
                    </>
                  ) : (
                    <>
                      <Button component={Link} to="/login" variant="contained" size="large">Log in</Button>
                      <Button component={Link} to="/signup" variant="contained" size="large">Sign up</Button>
                    </>
                  )}
                </Stack>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, lg: 5 }}>
              <Card elevation={2} sx={{ borderRadius: 3 }}>
                <CardContent sx={{ p: 4 }}>
                  <Typography variant="overline" color="text.secondary">How it works</Typography>
                  <Stack spacing={2.5} sx={{ mt: 1 }}>
                    {STEPS.map((s) => (
                      <Stack key={s.n} direction="row" spacing={2} alignItems="flex-start">
                        <Box sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: 'primary.main', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>{s.n}</Box>
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
          <Typography variant="body2" color="text.secondary">© {name} {COMPETITION_YEAR}. All rights reserved.</Typography>
        </Container>
      </Box>
    </Box>
  );
}
