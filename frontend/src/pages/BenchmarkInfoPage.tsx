import GuidePage from '../components/GuidePage';
import type { Guide } from '../api';

/** For a variant that ships no benchmark guide: what holds regardless of competition. */
const FALLBACK: Guide = {
  intro: 'A benchmark belongs to a category and defines a list of instances that tools run against.',
  pipeline: [],
  sections: [
    {
      heading: 'Structure',
      blocks: [
        { type: 'text', text: 'Each benchmark names a set of instances (individual cases), generated from the repository you propose. What an instance consists of is defined by the competition this deployment runs.' },
      ],
    },
    {
      heading: 'Submitting',
      blocks: [
        { type: 'text', text: 'Propose a benchmark (name + repository); its instances are generated from the repo. Once the run completes and validates, it is published automatically — selectable when submitting a toolkit, and organizers can group it into evaluation tracks.' },
      ],
    },
  ],
};

export default function BenchmarkInfoPage() {
  return (
    <GuidePage
      guideKey="benchmark"
      title="How to propose a benchmark"
      crumb={{ label: 'Benchmark', to: '/benchmark' }}
      cta={{ label: 'Go to benchmark submissions', to: '/benchmark' }}
      fallback={FALLBACK}
    />
  );
}
