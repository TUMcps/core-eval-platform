import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

/** Light-gray band at the top of every page: title + optional subtitle + actions. */
export default function PageHeader({ title, subtitle, action }: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Box sx={{ bgcolor: 'grey.50', py: { xs: 4, md: 6 }, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Container>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="h3" sx={{ fontSize: { xs: '2rem', md: '2.6rem' } }}>{title}</Typography>
            {subtitle && (
              <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400, mt: 1 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          {action && <Box sx={{ mt: { xs: 1, md: 0 } }}>{action}</Box>}
        </Box>
      </Container>
    </Box>
  );
}
