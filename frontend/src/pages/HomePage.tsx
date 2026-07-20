import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import { competitionApi } from '../api';
import type { CompetitionInfo } from '../api';
import { bootCompetition } from '../branding';
import { COMPETITION_YEAR } from '../constants/formOptions';
import CrescendoWave from '../components/CrescendoWave';

export default function HomePage() {
  const { user } = useAuth();
  const [comp, setComp] = useState<CompetitionInfo | null>(bootCompetition);
  useEffect(() => { competitionApi.cached().then(setComp).catch(() => {}); }, []);
  const name = comp?.display_name ?? 'Evaluation Platform';
  const hero = comp?.presentation?.branding?.hero_image;
  const heroMaxWidth = comp?.presentation?.branding?.hero_max_width || 520;
  const landing = comp?.presentation?.landing;
  const tagline = landing?.tagline
    || 'Submit verification toolkits against cutting-edge benchmarks, run them on provisioned workers, and compare results.';
  const links = landing?.links ?? [];
  const contacts = landing?.contacts ?? [];
  const related = landing?.related;

  return (
    <Box>
      <Box sx={{ bgcolor: 'grey.50', minHeight: '60vh', display: 'flex', alignItems: 'center' }}>
        <Container>
          <Grid container spacing={6} alignItems="center">
            <Grid size={{ xs: 12, lg: hero ? 7 : 12 }}>
              <Box sx={{ textAlign: { xs: 'center', lg: 'left' } }}>
                {/* Same headline accent as the inner pages (PageTitle), scaled to the hero
                    and shown only in the desktop left-aligned layout — the fill rule
                    doesn't fit the centered mobile hero. */}
                <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, mb: 3 }}>
                  <Typography variant={user ? 'h2' : 'h1'} sx={{ fontSize: { xs: '2.6rem', md: user ? '3.2rem' : '5rem' }, fontWeight: 800, lineHeight: 1.1, color: '#000' }}>
                    {user ? `Welcome, ${user.name || user.email}` : `${name} ${COMPETITION_YEAR}`}
                  </Typography>
                  <CrescendoWave height={6} waveHeight={44} strokeWidth={6} mb="10px"
                    sx={{ display: { xs: 'none', lg: 'block' } }} />
                </Box>
                <Typography variant="h5" sx={{ fontSize: { xs: '1.1rem', md: '1.4rem' }, mb: 4, lineHeight: 1.6, color: '#374151', fontWeight: 400 }}>
                  {tagline}
                </Typography>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: { xs: 'center', lg: 'flex-start' } }}>
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
                  {links.map((l) => (
                    <Button key={l.url} component="a" href={l.url} target="_blank" rel="noopener noreferrer" variant="outlined" size="large">
                      {l.label}
                    </Button>
                  ))}
                </Box>

                {contacts.length > 0 && (
                  <Typography variant="body2" sx={{ mt: 3, color: '#374151', textAlign: { xs: 'center', lg: 'left' } }}>
                    Questions? Contact{' '}
                    {contacts.map((email, i) => (
                      <span key={email}>
                        {i > 0 && (i === contacts.length - 1 ? ' and ' : ', ')}
                        <a href={`mailto:${email}`} style={{ color: 'inherit', textDecoration: 'underline' }}>{email}</a>
                      </span>
                    ))}
                    .
                  </Typography>
                )}

                {related?.url && (
                  <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid #d1d5db' }}>
                    <Typography variant="body2" sx={{ color: '#6b7280', textAlign: { xs: 'center', lg: 'left' }, mb: 1.5, fontSize: '0.9rem' }}>
                      {related.text}
                    </Typography>
                    <Button component="a" href={related.url} target="_blank" rel="noopener noreferrer" variant="outlined" size="small">
                      {related.label}
                    </Button>
                  </Box>
                )}
              </Box>
            </Grid>
            {hero && (
              <Grid size={{ xs: 12, lg: 5 }}>
                <Box
                  component="img"
                  src={hero}
                  alt={name}
                  sx={{
                    width: '100%', maxWidth: heroMaxWidth, display: 'block', margin: '0 auto',
                    borderRadius: 4,
                    filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.3))',
                  }}
                />
              </Grid>
            )}
          </Grid>
        </Container>
      </Box>
    </Box>
  );
}
