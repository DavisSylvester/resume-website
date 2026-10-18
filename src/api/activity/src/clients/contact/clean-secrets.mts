import type { ContactSecrets } from '../../types/index.mjs';

const PLACEHOLDER: string = 'REPLACE_ME';

/** Drops empty and `REPLACE_ME` values so an unfilled channel reads as "not configured". */
export const cleanSecrets = (raw: Record<string, unknown>): ContactSecrets => {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string' && value.trim().length > 0 && value.trim() !== PLACEHOLDER) {
      out[key] = value.trim();
    }
  }
  return out satisfies ContactSecrets;
};
