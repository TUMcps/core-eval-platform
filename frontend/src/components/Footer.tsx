import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import MuiLink from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { competitionApi } from '../api';
import type { CompetitionInfo } from '../api';
import { bootCompetition } from '../branding';
import { COMPETITION_YEAR } from '../constants/formOptions';

/**
 * The band closing every page: whose competition this is, and the handful of links
 * worth reaching from anywhere. The copy comes from the active competition, like the
 * landing page's — the shell names no competition of its own.
 *
 * App pins this to the bottom of the viewport on pages too short to fill it; the gap
 * above it is this component's own margin.
 */
export default function Footer() {
  const [comp, setComp] = useState<CompetitionInfo | null>(bootCompetition);
  useEffect(() => { competitionApi.cached().then(setComp).catch(() => {}); }, []);
  const name = comp?.display_name ?? 'Evaluation Platform';
  const links = comp?.presentation?.landing?.links ?? [];
  const contacts = comp?.presentation?.landing?.contacts ?? [];

  return (
    <Box component="footer" sx={{ mt: { xs: 4, md: 6 }, py: 3, bgcolor: 'background.paper',
      borderTop: '1px solid', borderColor: 'divider' }}>
      <Container>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">
            © {name} {COMPETITION_YEAR}. All rights reserved.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {links.map((l) => (
              <MuiLink key={l.url} href={l.url} target="_blank" rel="noopener noreferrer"
                variant="body2" color="text.secondary" underline="hover">
                {l.label}
              </MuiLink>
            ))}
            {contacts.map((email) => (
              <MuiLink key={email} href={`mailto:${email}`}
                variant="body2" color="text.secondary" underline="hover">
                {email}
              </MuiLink>
            ))}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
