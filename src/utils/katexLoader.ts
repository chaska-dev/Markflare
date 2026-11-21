// KaTeX is only needed by math blocks, so it (and its stylesheet + fonts) is
// fetched on first use instead of shipping in the main bundle.

import { useEffect, useMemo, useState } from 'react';

type Katex = typeof import('katex').default;

let katexPromise: Promise<Katex> | null = null;

export function loadKatex(): Promise<Katex> {
  if (!katexPromise) {
    katexPromise = Promise.all([
      import('katex'),
      import('katex/dist/katex.min.css'),
    ]).then(([mod]) => mod.default);
    // Allow a retry after a failed chunk load (offline, deploy in between).
    katexPromise.catch(() => { katexPromise = null; });
  }
  return katexPromise;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Rendered HTML for a LaTeX string. `html` is null while KaTeX is still loading
// (callers show a fallback) and '' for an empty formula.
export function useKatexHtml(latex: string): string | null {
  const [katex, setKatex] = useState<Katex | null>(null);
  const needsKatex = Boolean(latex && latex.trim());

  useEffect(() => {
    if (!needsKatex || katex) return;
    let cancelled = false;
    loadKatex().then(k => { if (!cancelled) setKatex(k); }).catch(() => {});
    return () => { cancelled = true; };
  }, [needsKatex, katex]);

  return useMemo(() => {
    if (!needsKatex) return '';
    if (!katex) return null;
    try {
      return katex.renderToString(latex, { displayMode: true, throwOnError: false });
    } catch (e: any) {
      return `<span class="katex-error">${escapeHtml(e?.message || 'LaTeX syntax error')}</span>`;
    }
  }, [katex, latex, needsKatex]);
}
