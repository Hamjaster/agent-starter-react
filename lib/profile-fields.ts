/*
 * Profile lists are stored as plain strings (so older profiles keep working) and edited as
 * tags. Conditions and allergies are comma-separated; medicines use semicolons because a dose
 * can contain a comma ("500mg, twice a day").
 */

export type ListField = 'conditions' | 'medications' | 'allergies';

const SPLIT: Record<ListField, RegExp> = {
  conditions: /[,;\n]/,
  allergies: /[,;\n]/,
  medications: /[;\n]/,
};
const JOIN: Record<ListField, string> = { conditions: ', ', allergies: ', ', medications: '; ' };

export function splitList(field: ListField, value: string | undefined): string[] {
  return (value ?? '')
    .split(SPLIT[field])
    .map((s) => s.trim())
    .filter(Boolean);
}

export function joinList(field: ListField, items: string[]): string {
  return dedupe(items).join(JOIN[field]);
}

/** Case-insensitive de-duplication that keeps the first spelling. */
export function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  return items
    .map((s) => s.trim())
    .filter((s) => {
      const k = s.toLowerCase();
      if (!s || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}
