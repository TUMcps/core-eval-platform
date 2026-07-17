import GuidePage from '../components/GuidePage';
import type { Guide } from '../api';

/** For a variant that ships no toolkit guide: what holds regardless of competition. */
const FALLBACK: Guide = {
  intro: 'A toolkit submission is cloned onto a worker, installed once, then run against each selected benchmark.',
  pipeline: [],
  sections: [
    {
      heading: 'The submission pipeline',
      blocks: [
        { type: 'text', text: 'When you submit a toolkit, the system provisions a worker (an AWS instance or a Docker container, depending on the deployment), clones your repository at the chosen commit, and advances through an ordered set of steps you can watch live on the submission’s detail page.' },
        { type: 'text', text: 'The steps themselves, and the scripts your repository must provide, are defined by the competition this deployment runs.' },
      ],
    },
  ],
};

export default function ToolkitInfoPage() {
  return (
    <GuidePage
      guideKey="toolkit"
      title="How to submit a toolkit"
      crumb={{ label: 'Toolkit', to: '/toolkit' }}
      cta={{ label: 'Go to toolkit submissions', to: '/toolkit' }}
      fallback={FALLBACK}
    />
  );
}
