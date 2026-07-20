import { createTheme, lighten } from '@mui/material/styles';

// Variant branding overrides this (competition presentation.branding.primary_color);
// the near-black slate is the neutral default when a variant sets no color.
const DEFAULT_PRIMARY = '#111827';

/** Color stops parsed out of a CSS ``linear-gradient(...)`` so SVG strokes (the
 *  decorative waves) can reuse the same gradient the navbar/buttons paint. */
export interface WaveGradient { stops: { offset: string; color: string }[]; }

/** Pull the color stops out of a CSS linear-gradient string; null if it isn't one.
 *  Missing stop offsets are spread evenly, so both `#a, #b` and `#a 0%, #b 100%` work.
 *  The angle is dropped — the waves are thin horizontal rules, so the gradient always
 *  runs left→right regardless. */
export function parseWaveGradient(css?: string): WaveGradient | null {
  const inner = css?.match(/linear-gradient\(([^)]*)\)/i)?.[1];
  if (!inner) return null;
  const parts = inner.split(',').map((s) => s.trim());
  if (/^[-\d.]+deg$/i.test(parts[0]) || /^to\s/i.test(parts[0])) parts.shift();
  const raw = parts.map((p) => { const [color, offset] = p.split(/\s+/); return { color, offset }; });
  if (raw.length < 2) return null;
  const stops = raw.map((s, i) => ({ color: s.color, offset: s.offset || `${(i / (raw.length - 1)) * 100}%` }));
  return { stops };
}

// Expose the parsed gradient on the theme so leaf components (the waves) can read it.
declare module '@mui/material/styles' {
  interface Theme { waveGradient: WaveGradient | null; }
  interface ThemeOptions { waveGradient?: WaveGradient | null; }
}

// Soft "pill" palette for status chips (Active / Done / Aborted / ...), matching the
// subtle look from the design mock: pale background + darker text instead of MUI's
// default saturated filled chips.
// `hover` is one subtle shade deeper than `backgroundColor`, for clickable chips —
// MUI's default clickable hover slams the fill to a dark palette shade (jarring).
const softChipColors: Record<string, { backgroundColor: string; color: string; hover: string }> = {
  default: { backgroundColor: '#eceff1', color: '#37474f', hover: '#e1e5e8' },
  primary: { backgroundColor: '#e3f2fd', color: '#1565c0', hover: '#d3e8fb' },
  secondary: { backgroundColor: '#ede7f6', color: '#5e35b1', hover: '#e0d7f0' },
  success: { backgroundColor: '#e8f5e9', color: '#2e7d32', hover: '#d8eeda' },
  error: { backgroundColor: '#ffebee', color: '#c62828', hover: '#ffdbe0' },
  warning: { backgroundColor: '#fff8e1', color: '#7a5c00', hover: '#fdefc4' },
  info: { backgroundColor: '#e1f5fe', color: '#0277bd', hover: '#cfeefc' },
};

export const buildTheme = (primaryColor?: string, navbarGradient?: string, accentColor?: string) => {
const primary = primaryColor || DEFAULT_PRIMARY;
const waveGradient = parseWaveGradient(navbarGradient);
// Color for outlined/secondary buttons: an explicit accent_color if the variant
// sets one (e.g. the gradient's trailing color), else the gradient's leading
// (left-edge) color so they match where the navbar gradient starts.
const accent = accentColor || waveGradient?.stops[0]?.color;
return createTheme({
  waveGradient,
  palette: {
    primary: { main: primary, contrastText: '#ffffff' },
    secondary: { main: accent || '#2563eb' },
    background: { default: '#f7f8fa', paper: '#ffffff' },
    text: { primary: '#1f2937', secondary: '#6b7280' },
    divider: '#e5e7eb',
    success: { main: '#2e7d32' },
    error: { main: '#c62828' },
    warning: { main: '#b26a00' },
    info: { main: '#0277bd' },
  },

  shape: { borderRadius: 10 },

  typography: {
    fontFamily: '"Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h1: { fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontWeight: 700, letterSpacing: '-0.02em' },
    h3: { fontWeight: 700, letterSpacing: '-0.015em' },
    h4: { fontWeight: 700, letterSpacing: '-0.01em' },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { fontWeight: 600, textTransform: 'none' },
  },

  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 999 }, // pill buttons
        // One size scale for the whole app: pick size="small|medium|large",
        // never set fontSize/px/py per button.
        sizeSmall: { fontSize: '0.9rem', padding: '4px 18px' },
        sizeMedium: { fontSize: '0.95rem', padding: '7px 22px' },
        sizeLarge: { fontSize: '1rem', padding: '10px 30px' },
        // Hover "thickens" the border via an inset shadow (currentColor), not
        // borderWidth — box size stays fixed so the page never shifts on hover.
        outlined: {
          '&:hover': {
            boxShadow: 'inset 0 0 0 1px currentColor, 0 2px 6px rgba(16,24,40,0.12)',
          },
        },
        // Match the navbar: gradient competitions get gradient-filled primary
        // buttons (brightened on hover, since a gradient has no single shade to
        // lighten). Solid competitions keep the flat fill — dark primaries make
        // MUI's auto-darkened hover invisible and disableElevation strips the
        // shadow, so lift to a lighter shade instead.
        containedPrimary: navbarGradient
          ? {
              // Scope the gradient to enabled buttons so a disabled button keeps
              // MUI's grey fill (the gradient is a background-image that would
              // otherwise show through the disabled background-color).
              '&:not(.Mui-disabled)': { background: navbarGradient },
              '&:hover': { filter: 'brightness(1.08)' },
            }
          : { '&:hover': { backgroundColor: lighten(primary, 0.18) } },
        // Outlined buttons draw in the accent color (gradient end/start per variant)
        // so they match the navbar (error/others keep their own color).
        ...(accent ? {
          outlinedPrimary: {
            color: accent,
            borderColor: accent,
            '&:hover': { borderColor: accent },
          },
        } : {}),
      },
    },
    MuiContainer: {
      defaultProps: { maxWidth: 'xl' },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        // Flat, lightly bordered surfaces rather than heavy drop shadows.
        elevation1: { boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)' },
        elevation2: { boxShadow: '0 2px 6px rgba(16,24,40,0.06), 0 1px 2px rgba(16,24,40,0.04)' },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'primary' },
      styleOverrides: {
        root: { background: navbarGradient || primary, color: '#ffffff' },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: { root: { borderRadius: 10 } },
    },
    MuiInputBase: {
      styleOverrides: {
        // MUI pins textareas to resize:none. Multiline fields here hold scripts, whose
        // length the form cannot guess — give them a fixed `rows` and let the user drag.
        // (Only fields with `rows`; `minRows` autosizes and would fight the drag.)
        inputMultiline: { resize: 'vertical' },
      },
    },
    // Steppers here diagram a pipeline rather than walk the user through a wizard: no
    // step is "current", so they all read as real instead of one lit and the rest greyed
    // out as unreached.
    MuiStepIcon: {
      styleOverrides: {
        root: { color: primary, fontSize: '1.65rem' },
      },
    },
    MuiStepLabel: {
      styleOverrides: {
        label: { fontWeight: 600, lineHeight: 1.35 },
      },
    },
    // MUI widens a step's hit area by padding it and cancelling that with negative
    // margins, which puts the button's box outside the strip that scrolls it and raises
    // a scrollbar on both axes. Drop both: the icon and its label are target enough, and
    // zeroing them in pairs keeps the icons on the connector line.
    MuiStepButton: {
      styleOverrides: {
        root: { margin: 0, padding: 0 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: '#eef0f3' },
        head: { fontWeight: 600, color: '#374151', backgroundColor: '#fafbfc' },
      },
    },
    MuiTableContainer: {
      styleOverrides: { root: { borderRadius: 12 } },
    },
    MuiChip: {
      styleOverrides: {
        root: ({ ownerState }: any) => {
          const soft = softChipColors[ownerState.color as string] ?? softChipColors.default;
          // Outlined chips (e.g. the "Paused" status) are styled as an "inactive"
          // version of their filled counterpart: the same pale fill + accent text as
          // Running, but with a dashed border and reduced opacity so the chip visibly
          // recedes ("held / paused") while staying in the same blue family.
          if (ownerState.variant === 'outlined') {
            return {
              backgroundColor: soft.backgroundColor,
              color: soft.color,
              borderColor: soft.color,
              borderStyle: 'dashed',
              opacity: 0.65,
              fontWeight: 600,
            };
          }
          return {
            backgroundColor: soft.backgroundColor,
            color: soft.color,
            fontWeight: 600,
            // Clickable chips (e.g. the linked benchmark chips): subtle same-family hover,
            // no shadow — mirrors the flat containedPrimary button, not MUI's dark default.
            '&.MuiChip-clickable': {
              transition: 'background-color 120ms ease',
              '&:hover, &:focus, &:active': { backgroundColor: soft.hover, boxShadow: 'none' },
            },
          };
        },
      },
    },
  },
});
};

const theme = buildTheme();
export default theme;
