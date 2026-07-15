import type { Branding, CompetitionInfo } from './api';

// The Vite branding-injector plugin writes the full competition payload into <head>
// before the app boots, so the first paint already has the right theme, title, brand,
// favicon, and landing copy — no flash of the neutral defaults. The runtime
// /api/competition/ fetch remains the authority and revalidates in the background.
declare global {
  interface Window {
    __COMPETITION__?: CompetitionInfo;
  }
}

export const bootCompetition: CompetitionInfo | null = window.__COMPETITION__ ?? null;
export const bootBranding: Branding | null = bootCompetition?.presentation?.branding ?? null;
export const bootBrand: string = bootCompetition?.display_name ?? '';
