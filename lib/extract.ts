import type { DocumentKind, Relation, Sex } from '@/lib/saathi-store';

/*
 * Turning what a patient writes, plus photos of prescriptions and reports, into a health
 * profile. The browser posts to /api/extract, which asks Gemini to read everything and answer
 * in this shape. Nothing is stored server-side.
 */

export interface ExtractedDocument {
  title: string;
  kind: DocumentKind;
  date: string;
  summary: string;
}

export interface Extraction {
  name: string;
  relation: Relation | '';
  age: string;
  sex: Sex;
  phone: string;
  conditions: string[];
  medications: string[];
  allergies: string[];
  history: string;
  /** Today's problem, if the text mentions one. */
  concern: string;
  documents: ExtractedDocument[];
  /** Things doctor.ai couldn't read or wasn't sure about, for the patient to check. */
  unsure: string[];
}

export const EXTRACT_LIMITS = {
  files: 4,
  fileBytes: 7 * 1024 * 1024,
  totalBytes: 15 * 1024 * 1024,
  textChars: 6000,
  types: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'],
} as const;

export const ACCEPT = EXTRACT_LIMITS.types.join(',');

export type ExtractErrorCode =
  | 'not-configured'
  | 'too-large'
  | 'unsupported'
  | 'unreadable'
  | 'failed';

export class ExtractError extends Error {
  constructor(public code: ExtractErrorCode) {
    super(code);
  }
}

export function fileProblem(file: File): string | null {
  if (!(EXTRACT_LIMITS.types as readonly string[]).includes(file.type)) {
    return `${file.name} isn’t a photo or PDF.`;
  }
  if (file.size > EXTRACT_LIMITS.fileBytes) return `${file.name} is larger than 7 MB.`;
  return null;
}

/**
 * Sends the text and files for reading. `context` is the existing profile in plain words, so
 * documents added later are read with the patient in mind.
 */
export async function requestExtraction({
  text,
  files,
  context,
  signal,
}: {
  text: string;
  files: File[];
  context?: string;
  signal?: AbortSignal;
}): Promise<Extraction> {
  const body = new FormData();
  body.set('text', text.slice(0, EXTRACT_LIMITS.textChars));
  if (context) body.set('context', context.slice(0, EXTRACT_LIMITS.textChars));
  for (const f of files) body.append('files', f);

  const res = await fetch('/api/extract', { method: 'POST', body, signal });
  if (!res.ok) {
    const code = (await res.json().catch(() => null))?.error as ExtractErrorCode | undefined;
    throw new ExtractError(code ?? 'failed');
  }
  return (await res.json()) as Extraction;
}
