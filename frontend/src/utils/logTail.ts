// Render only the tail of a log: a very verbose step (e.g. a generator spamming a
// progress bar) can produce a multi-MB log that freezes the tab if put in the DOM
// whole. Configurable via VITE_MAX_LOG_KB (default 1 MB); lower it if the tab lags.
const MAX_LOG_CHARS = Number(import.meta.env.VITE_MAX_LOG_KB ?? 1000) * 1000;

const kb = (chars: number) => Math.round(chars / 1000);

export const logTail = (text: string): string =>
  text.length <= MAX_LOG_CHARS
    ? text
    : `… (showing the last ${kb(MAX_LOG_CHARS)} KB of ${kb(text.length)} KB)\n${text.slice(-MAX_LOG_CHARS)}`;
