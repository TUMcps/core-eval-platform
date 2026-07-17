import type { ReactNode } from 'react';
import { Accordion, AccordionSummary, AccordionDetails, Box, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

/** Collapsible "what was submitted" panel; children are DetailRow pairs. */
export default function SubmissionDetails({ children }: { children: ReactNode }) {
  return (
    <Accordion disableGutters elevation={0}
      sx={{ mt: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography sx={{ fontWeight: 500 }}>Submission details</Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 2, rowGap: 0.75, alignItems: 'baseline' }}>
          {children}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}
