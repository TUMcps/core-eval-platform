import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { competitionApi } from '../api';
import { bootBrand } from '../branding';
import { COMPETITION_YEAR } from '../constants/formOptions';

/**
 * The band closing every page. Only whose competition this is — the name comes from the
 * active competition, as the shell names none of its own.
 *
 * App pins this to the bottom of the viewport on pages too short to fill it; the gap
 * above it is this component's own margin.
 */
export default function Footer() {
  const [name, setName] = useState(bootBrand || 'Evaluation Platform');
  useEffect(() => { competitionApi.cached().then((c) => setName(c.display_name)).catch(() => {}); }, []);

  return (
    <Box component="footer" sx={{ mt: { xs: 4, md: 6 }, py: 3, textAlign: 'center',
      bgcolor: 'background.paper', borderTop: '1px solid', borderColor: 'divider' }}>
      <Container>
        <Typography variant="body2" color="text.secondary">
          © {name} {COMPETITION_YEAR}. All rights reserved.
        </Typography>
      </Container>
    </Box>
  );
}
