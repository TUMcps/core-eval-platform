import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Step from '@mui/material/Step';
import StepButton from '@mui/material/StepButton';
import Stepper from '@mui/material/Stepper';
import Typography from '@mui/material/Typography';
import RichText from './RichText';
import type { Guide, GuideBlock } from '../api';

const card = {
  p: 3,
  borderRadius: 3,
  border: '1px solid',
  borderColor: 'grey.300',
} as const;

/** One chunk of guide prose. Unknown types render as plain text rather than vanish. */
function Block({ block }: { block: GuideBlock }) {
  if (block.type === 'note') {
    return <Alert severity="info" sx={{ my: 2 }}><RichText text={block.text ?? ''} /></Alert>;
  }
  if (block.type === 'code') {
    return (
      <Box component="pre" sx={{ my: 2, p: 2, overflowX: 'auto', borderRadius: 1, bgcolor: 'grey.100',
        fontFamily: 'Monaco, Consolas, monospace', fontSize: '0.875rem' }}>
        {block.code}
      </Box>
    );
  }
  if (block.type === 'bullets') {
    return (
      <Box component="ul" sx={{ my: 1.5, pl: 3 }}>
        {(block.items ?? []).map((item, i) => (
          <Typography component="li" key={i} variant="body1" color="text.secondary" sx={{ mb: 1 }}>
            <RichText text={item} />
          </Typography>
        ))}
      </Box>
    );
  }
  return (
    <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
      <RichText text={block.text ?? ''} />
    </Typography>
  );
}

/** Ties a box in the strip to the card explaining it. */
const stepId = (i: number) => `guide-step-${i}`;

/**
 * The pipeline at a glance, spread across the full width. A Stepper rather than a row of
 * boxes: it distributes the steps evenly however many there are, and connects them, which
 * is the thing being said — these run in order. Each box jumps to its card below.
 */
function PipelineStrip({ steps }: { steps: Guide['pipeline'] }) {
  const jumpTo = (i: number) =>
    document.getElementById(stepId(i))?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <Paper elevation={0} sx={{ ...card, mb: 4, bgcolor: 'grey.50' }}>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>The Pipeline</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        In order, under the same names they appear under on a submission's page. Some are
        optional and depend on the options you choose. Pick one to read what it does.
      </Typography>
      {/* Below its min width the labels would crush into unreadable columns; scroll instead.
          Only sideways: overflow-x alone would compute overflow-y to auto and bring a
          second scrollbar along with it. */}
      <Box sx={{ overflowX: 'auto', overflowY: 'hidden', py: 1 }}>
        {/* nonLinear, or a stepper with no active step counts every step as unreached
            and disables it — the boxes would render but not take a click. */}
        <Stepper nonLinear alternativeLabel activeStep={-1} sx={{ minWidth: 660 }}>
          {steps.map((step, i) => (
            <Step key={step.title}>
              <StepButton onClick={() => jumpTo(i)}>{step.title}</StepButton>
            </Step>
          ))}
        </Stepper>
      </Box>
    </Paper>
  );
}

/** The step's position, numbered here so the copy doesn't hard-code an order it can't see. */
function StepNumber({ n }: { n: number }) {
  return (
    <Box sx={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', bgcolor: 'primary.main',
      color: 'primary.contrastText', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '0.75rem', fontWeight: 700 }}>
      {n}
    </Box>
  );
}

/**
 * A how-to page's body, as written by the active competition: the pipeline at a glance,
 * the prose sections, then a card per step. The shell lays this out but supplies none of
 * it — only the variant knows its own scripts and pipeline.
 */
export default function GuideView({ guide }: { guide: Guide }) {
  return (
    <>
      {guide.pipeline.length > 0 && <PipelineStrip steps={guide.pipeline} />}

      {guide.sections.map((section) => (
        <Box key={section.heading} sx={{ mb: 4 }}>
          <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>{section.heading}</Typography>
          <Paper elevation={0} sx={card}>
            {section.blocks.map((block, i) => <Block key={i} block={block} />)}
          </Paper>
        </Box>
      ))}

      {guide.pipeline.length > 0 && (
        <>
          <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>What Each Step Does</Typography>
          <Stack spacing={2.5}>
            {guide.pipeline.map((step, i) => (
              <Paper key={step.title} id={stepId(i)} elevation={0} sx={{ ...card, scrollMarginTop: 16 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <StepNumber n={i + 1} />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{step.title}</Typography>
                </Box>
                {step.details.map((paragraph) => (
                  <Typography key={paragraph} variant="body1" color="text.secondary" sx={{ mb: 1.5 }}>
                    <RichText text={paragraph} />
                  </Typography>
                ))}
              </Paper>
            ))}
          </Stack>
        </>
      )}
    </>
  );
}
