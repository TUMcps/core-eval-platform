import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import PageBreadcrumbs from './PageBreadcrumbs';
import PageHeader from './PageHeader';
import PageSection from './PageSection';
import GuideView from './GuideView';
import { competitionApi } from '../api';
import type { CompetitionInfo, Guide } from '../api';
import { bootCompetition } from '../branding';

interface Props {
  /** Which guide to ask the active competition for: "toolkit" or "benchmark". */
  guideKey: string;
  title: string;
  crumb: { label: string; to: string };
  cta: { label: string; to: string };
  /** Rendered when the active variant ships no guide for this page. */
  fallback: Guide;
}

/**
 * A how-to page: the shell's chrome (crumbs, title, call to action) around a guide the
 * active competition wrote. Both info pages are this — they differ only in which guide
 * they ask for.
 */
export default function GuidePage({ guideKey, title, crumb, cta, fallback }: Props) {
  const [comp, setComp] = useState<CompetitionInfo | null>(bootCompetition);
  useEffect(() => { competitionApi.cached().then(setComp).catch(() => {}); }, []);
  const guide = comp?.presentation?.guides?.[guideKey] ?? fallback;

  return (
    <>
      <PageHeader>
        <PageBreadcrumbs items={[crumb, { label: 'Info' }]} />
        <Typography variant="h3" fontWeight="bold" gutterBottom>{title}</Typography>
        {guide.intro && <Typography variant="body1" color="text.secondary">{guide.intro}</Typography>}
        <Button component={Link} to={cta.to} variant="contained" size="large" sx={{ mt: 3 }}>
          {cta.label}
        </Button>
      </PageHeader>
      <PageSection>
        <GuideView guide={guide} />
      </PageSection>
    </>
  );
}
