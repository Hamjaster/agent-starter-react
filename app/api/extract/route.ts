import { NextResponse } from 'next/server';
import { EXTRACT_LIMITS, type Extraction } from '@/lib/extract';

/*
 * Reads what a patient wrote, plus photos/PDFs of prescriptions and reports, and returns a
 * structured health profile. Files are sent to Gemini for this one request and never stored.
 */

const API_KEY = process.env.GOOGLE_API_KEY;
const MODEL = process.env.DOCTOR_AI_EXTRACT_MODEL || 'gemini-flash-latest';

export const runtime = 'nodejs';
export const maxDuration = 60;

const INSTRUCTIONS = `You turn what a patient (or their family member) writes, and photos or PDFs
of their prescriptions, lab reports, discharge summaries and medicine packs, into a health
profile for doctor.ai, an AI doctor.

Rules:
- Only record what is written or clearly shown. Never guess a diagnosis, dose or date.
- relation: who the profile is for, from the writer's point of view. "I", "me" -> self;
  "my mother/father" -> parent; "my son/daughter" -> child; "my husband/wife" -> spouse;
  anyone else -> other. Leave empty if unclear.
- age: a number of years as text, e.g. "64". Convert "born 1961" only if a year is given.
- conditions: ongoing conditions in plain English, e.g. "High blood pressure", "Type 2 diabetes".
  Include a condition named on a prescription or report.
- relation and sex: null when not stated.
- medications: one entry per medicine taken regularly, with strength and how often when known,
  e.g. "Amlodipine 5mg once a day". Use the generic name if the brand is unclear.
- allergies: substances, e.g. "Penicillin".
- history: one or two short sentences for anything else useful: surgeries, pregnancies,
  family history, smoking. Empty if none.
- concern: today's problem if the writer describes one (symptoms now), in their words. Empty if
  none.
- documents: one entry per uploaded file: a short title ("Prescription from Dr. Khan",
  "CBC blood test"), its kind, its date as written (empty if none), and a 1–2 sentence plain
  English summary of what matters (results out of range, medicines prescribed).
- unsure: short notes on anything unreadable or ambiguous the patient should check, e.g.
  "Couldn't read the dose of the second medicine". Empty if all clear.
- Write in plain English even if the input is Urdu or Roman Urdu. Never give medical advice.`;

const S = { type: 'STRING' } as const;
const LIST = { type: 'ARRAY', items: S } as const;
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: S,
    relation: {
      type: 'STRING',
      enum: ['self', 'parent', 'child', 'spouse', 'other'],
      nullable: true,
    },
    age: S,
    sex: { type: 'STRING', enum: ['female', 'male', 'other'], nullable: true },
    phone: S,
    conditions: LIST,
    medications: LIST,
    allergies: LIST,
    history: S,
    concern: S,
    documents: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: S,
          kind: {
            type: 'STRING',
            enum: ['prescription', 'lab-report', 'discharge-summary', 'medicine-pack', 'other'],
          },
          date: S,
          summary: S,
        },
        required: ['title', 'kind', 'date', 'summary'],
      },
    },
    unsure: LIST,
  },
  required: [
    'name',
    'relation',
    'age',
    'sex',
    'phone',
    'conditions',
    'medications',
    'allergies',
    'history',
    'concern',
    'documents',
    'unsure',
  ],
};

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  if (!API_KEY) return fail('not-configured', 503);

  // Only this site's pages may use the route.
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).host !== req.headers.get('host')) return fail('forbidden', 403);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail('failed', 400);
  }
  const text = String(form.get('text') ?? '').slice(0, EXTRACT_LIMITS.textChars);
  const context = String(form.get('context') ?? '').slice(0, EXTRACT_LIMITS.textChars);
  const files = form.getAll('files').filter((f): f is File => f instanceof File);

  if (!text.trim() && files.length === 0) return fail('failed', 400);
  if (files.length > EXTRACT_LIMITS.files) return fail('too-large', 413);
  let total = 0;
  for (const f of files) {
    total += f.size;
    if (!(EXTRACT_LIMITS.types as readonly string[]).includes(f.type)) {
      return fail('unsupported', 415);
    }
    if (f.size > EXTRACT_LIMITS.fileBytes) return fail('too-large', 413);
  }
  if (total > EXTRACT_LIMITS.totalBytes) return fail('too-large', 413);

  const parts: unknown[] = [];
  if (context.trim()) parts.push({ text: `Existing profile (for context):\n${context}` });
  parts.push({ text: text.trim() ? `What they wrote:\n${text}` : 'They only uploaded files.' });
  for (const [i, f] of files.entries()) {
    parts.push({ text: `File ${i + 1}: ${f.name}` });
    parts.push({
      inlineData: { mimeType: f.type, data: Buffer.from(await f.arrayBuffer()).toString('base64') },
    });
  }

  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: INSTRUCTIONS }] },
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
            responseSchema: SCHEMA,
          },
        }),
        signal: AbortSignal.timeout(55_000),
      }
    );
  } catch (e) {
    console.error('extract: request failed', e);
    return fail('failed', 502);
  }
  if (!res.ok) {
    console.error('extract: gemini', res.status, (await res.text()).slice(0, 500));
    return fail('failed', 502);
  }

  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof raw !== 'string') return fail('unreadable', 422);
  try {
    return NextResponse.json(clean(JSON.parse(raw)), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return fail('unreadable', 422);
  }
}

/** Trusts nothing from the model: types, enums and lengths are enforced here. */
function clean(x: Record<string, unknown>): Extraction {
  const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const list = (v: unknown, max = 20) =>
    Array.isArray(v)
      ? v
          .map((s) => str(s, 160))
          .filter(Boolean)
          .slice(0, max)
      : [];
  const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | '' =>
    allowed.includes(v as T) ? (v as T) : '';
  const KINDS = [
    'prescription',
    'lab-report',
    'discharge-summary',
    'medicine-pack',
    'other',
  ] as const;

  return {
    name: str(x.name, 80),
    relation: pick(x.relation, ['self', 'parent', 'child', 'spouse', 'other'] as const),
    age: str(x.age, 3).replace(/\D/g, ''),
    sex: pick(x.sex, ['female', 'male', 'other'] as const),
    phone: str(x.phone, 20),
    conditions: list(x.conditions),
    medications: list(x.medications),
    allergies: list(x.allergies),
    history: str(x.history, 600),
    concern: str(x.concern, 600),
    documents: (Array.isArray(x.documents) ? x.documents : []).slice(0, 8).map((d) => {
      const doc = (d ?? {}) as Record<string, unknown>;
      return {
        title: str(doc.title, 80) || 'Document',
        kind: pick(doc.kind, KINDS) || 'other',
        date: str(doc.date, 40),
        summary: str(doc.summary, 400),
      };
    }),
    unsure: list(x.unsure, 6),
  };
}
