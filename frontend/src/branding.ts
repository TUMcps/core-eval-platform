import type { Branding } from './api';

// The Vite branding-injector plugin writes this into <head> before the app boots,
// so the first paint already has the right theme color, title, and favicon (no flash
// of the neutral defaults). The runtime /api/competition/ fetch stays the authority.
declare global {
  interface Window {
    __BRANDING__?: { display_name?: string; branding?: Branding | null };
  }
}

export const bootBranding: Branding | null = window.__BRANDING__?.branding ?? null;
export const bootBrand: string = window.__BRANDING__?.display_name ?? '';
