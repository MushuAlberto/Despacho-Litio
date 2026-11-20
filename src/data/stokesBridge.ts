import { extractMopPlant, parseStokesWorkbook } from '../services/stokesParser';

export { parseStokesWorkbook };

export function normalizarAlmacenCompat(raw: string): string {
  if (!raw) return '—';
  const { origenStokes } = extractMopPlant(raw);
  return origenStokes;
}
