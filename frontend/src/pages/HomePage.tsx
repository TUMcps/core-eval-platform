import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import { competitionApi } from '../api';
import type { CompetitionInfo } from '../api';
import { COMPETITION_YEAR } from '../constants/formOptions';

export default function HomePage() {
  const { user } = useAuth();
  const [comp, setComp] = useState<CompetitionInfo | null>(null);
  useEffect(() => { competitionApi.cached().then(setComp).catch(() => {}); }, []);
  const name = comp?.display_name ?? 'Evaluation Platform';
  const hero = comp?.presentation?.branding?.hero_image;

  return (
    <Box>
      <Box sx={{ bgcolor: 'grey.50', minHeight: '60vh', display: 'flex', alignItems: 'center' }}>
        <Container>
          <Grid container spacing={6} alignItems="center">
            <Grid size={{ xs: 12, lg: hero ? 7 : 12 }}>
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
            {hero && (
              <Grid size={{ xs: 12, lg: 5 }}>
                <Box
                  component="img"
                  src={hero}
                  alt={name}
                  sx={{
                    width: '100%', maxWidth: 520, display: 'block', margin: '0 auto',
                    filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.3))',
                  }}
                />
              </Grid>
            )}
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
