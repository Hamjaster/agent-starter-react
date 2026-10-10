'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Lock, Paperclip, Sparkles } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { buttonClass } from '@/components/saathi/button';
import { EASE_OUT } from '@/components/saathi/motion';
import { cn } from '@/lib/cn';
import { ACCEPT, ExtractError, requestExtraction } from '@/lib/extract';
import {
  type ProfileDraft,
  emptyDraft,
  mergeExtraction,
  profileFromDraft,
} from '@/lib/profile-draft';
import { actions } from '@/lib/saathi-store';
import { AttachmentList, useAttachments } from './attachments';
import { ProfileEditor } from './profile-editor';

const EXAMPLES = [
  'I’m Ayesha, 29. I have asthma and use a salbutamol inhaler. I’m allergic to penicillin.',
  'This is for my father Rashid, 64. He has high blood pressure and takes amlodipine 5mg every morning.',
  'My daughter Zara is 7 and weighs 22 kg. No allergies. She had her tonsils out last year.',
];

const READING_STEPS = [
  'Reading what you wrote…',
  'Reading your documents…',
  'Picking out medicines and allergies…',
  'Putting the profile together…',
];

type Phase = 'compose' | 'reading' | 'review';

/**
 * New health profile in one place: describe the person in your own words, add photos of
 * prescriptions or reports, and doctor.ai turns it into a profile to check and save.
 */
export function ProfileBuilder({
  adding,
  pending,
  onDone,
  onCancel,
}: {
  /** Adding another person (vs. the very first profile). */
  adding: boolean;
  /** Concern typed on the home page, carried into today's notes after setup. */
  pending: string | null;
  onDone: (id: string) => void;
  onCancel?: () => void;
}) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('compose');
  const [text, setText] = useState('');
  const [draft, setDraft] = useState<ProfileDraft>(() => emptyDraft(adding ? 'parent' : 'self'));
  const [unsure, setUnsure] = useState<string[]>([]);
  const [concern, setConcern] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [over, setOver] = useState(false);
  const [example, setExample] = useState(0);
  const att = useAttachments();
  const fileInput = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const abort = useRef<AbortController | null>(null);
  const textId = useId();
  const hintId = useId();
  const ready = text.trim().length >= 3 || att.files.length > 0;

  useEffect(() => {
    if (reduce || text || phase !== 'compose') return;
    const t = setInterval(() => setExample((v) => (v + 1) % EXAMPLES.length), 4200);
    return () => clearInterval(t);
  }, [reduce, text, phase]);

  useEffect(() => {
    if (phase !== 'reading') return;
    const t = setInterval(() => setStep((v) => Math.min(v + 1, READING_STEPS.length - 1)), 1800);
    return () => clearInterval(t);
  }, [phase]);

  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 132), 320)}px`;
  }, [text, phase]);

  useEffect(() => () => abort.current?.abort(), []);

  const build = async () => {
    if (!ready) return;
    setError(null);
    setStep(0);
    setPhase('reading');
    abort.current = new AbortController();
    try {
      const x = await requestExtraction({
        text,
        files: att.files,
        signal: abort.current.signal,
      });
      // Each build starts from what was written now, so rebuilding doesn't duplicate anything.
      setDraft(mergeExtraction(emptyDraft(adding ? 'parent' : 'self'), x));
      setUnsure(x.unsure);
      setConcern(x.concern);
      setPhase('review');
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setPhase('compose');
      setError(
        e instanceof ExtractError && e.code === 'not-configured'
          ? 'Reading isn’t set up on this site yet. You can fill the profile in yourself.'
          : e instanceof ExtractError && e.code === 'too-large'
            ? 'Those files are too large. Try fewer or smaller photos.'
            : 'doctor.ai couldn’t read that just now. Try again, or fill it in yourself.'
      );
    }
  };

  const save = () => {
    const id = actions.saveProfile(profileFromDraft(draft));
    // What they described as today's problem starts today's notes, unless the home page
    // already carried one in.
    if (concern && !pending) actions.updateIntake(id, { concern });
    onDone(id);
  };

  if (phase === 'review') {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10 md:py-14">
        <button
          type="button"
          onClick={() => setPhase('compose')}
          className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft aria-hidden className="size-4" /> Back to what I wrote
        </button>
        <h1 className="font-display tracking-display mt-4 text-3xl leading-[1.08] text-gray-900 md:text-[2.6rem]">
          {draft.name ? `Here’s ${draft.name.split(' ')[0]}’s profile.` : 'Check the profile.'}
        </h1>
        <p className="mt-3 max-w-lg leading-relaxed text-gray-600">
          This is what doctor.ai understood. Fix anything that’s wrong, then save. doctor.ai reads
          it before every consult.
        </p>
        <div className="mt-8">
          <ProfileEditor
            draft={draft}
            onChange={setDraft}
            onSave={save}
            onCancel={onCancel}
            saveLabel="Save profile"
            unsure={unsure}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10 md:py-16">
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="mb-4 -ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft aria-hidden className="size-4" /> Back
        </button>
      )}
      <h1 className="font-display tracking-display text-4xl leading-[1.05] text-gray-900 md:text-5xl">
        {adding ? 'Who else do you look after?' : 'Tell doctor.ai who this is for.'}
      </h1>
      <p id={hintId} className="mt-4 max-w-xl leading-relaxed text-gray-600">
        Write it the way you’d tell a doctor: name, age, conditions, medicines, allergies. Add
        photos of prescriptions or reports and doctor.ai will read them too.
      </p>

      {pending && (
        <p className="bg-mist mt-6 rounded-xl px-4 py-3 text-sm leading-relaxed text-gray-700">
          After this, we’ll add what you told doctor.ai on the home page to today’s notes: “
          {pending.slice(0, 80)}
          {pending.length > 80 ? '…' : ''}”
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          build();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          att.add(e.dataTransfer.files);
        }}
        className={cn(
          'mt-8 rounded-[22px] border bg-white p-3 transition-[border-color,box-shadow] duration-300 sm:p-4',
          over
            ? 'border-brand-3 shadow-[0_0_0_6px_rgb(43_53_52/0.08)]'
            : 'border-gray-200 shadow-[0_24px_50px_-28px_rgb(43_53_52/0.35)] focus-within:border-gray-300 focus-within:shadow-[0_0_0_6px_rgb(43_53_52/0.07),0_30px_60px_-24px_rgb(43_53_52/0.35)]'
        )}
      >
        <label htmlFor={textId} className="sr-only">
          Describe the person this profile is for
        </label>
        <div className="relative">
          <textarea
            id={textId}
            ref={area}
            value={text}
            disabled={phase === 'reading'}
            aria-describedby={hintId}
            onChange={(e) => setText(e.target.value.slice(0, 6000))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                build();
              }
            }}
            className="block w-full resize-none bg-transparent px-2 pt-1.5 text-base leading-relaxed text-gray-900 focus:outline-none disabled:text-gray-500 md:text-lg"
          />
          {!text && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-2 top-1.5 text-base leading-relaxed text-gray-400 md:text-lg"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={example}
                  initial={reduce ? false : { opacity: 0, y: 10, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={reduce ? undefined : { opacity: 0, y: -10, filter: 'blur(4px)' }}
                  transition={{ duration: 0.45, ease: EASE_OUT }}
                  className="block"
                >
                  {EXAMPLES[example]}
                </motion.span>
              </AnimatePresence>
            </div>
          )}
        </div>

        {att.files.length > 0 && (
          <div className="mt-3 px-1">
            <AttachmentList
              files={att.files}
              previews={att.previews}
              onRemove={att.remove}
              reading={phase === 'reading'}
            />
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              att.add(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={phase === 'reading'}
            onClick={() => fileInput.current?.click()}
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40"
          >
            <Paperclip aria-hidden className="size-4" />
            Add prescriptions or reports
          </button>
          <button
            type="submit"
            disabled={!ready || phase === 'reading'}
            className={buttonClass({}, 'rounded-full')}
          >
            <Sparkles aria-hidden className="size-4" />
            {phase === 'reading' ? 'Reading…' : 'Build profile'}
          </button>
        </div>
      </form>

      <div aria-live="polite" className="mt-4 min-h-6">
        {phase === 'reading' ? (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-gray-700">{READING_STEPS[step]}</p>
            <button
              type="button"
              onClick={() => {
                abort.current?.abort();
                setPhase('compose');
              }}
              className="min-h-11 rounded-lg px-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
          </div>
        ) : (
          (att.problem || error) && (
            <p role="alert" className="text-sm text-gray-900">
              {att.problem || error}
            </p>
          )
        )}
      </div>

      <div className="mt-6 flex flex-col gap-4 border-t border-gray-200 pt-6 sm:flex-row sm:items-start sm:justify-between">
        <p className="flex max-w-sm gap-2 text-sm leading-relaxed text-gray-600">
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
          What you write and attach is sent to Google Gemini to be read, then discarded. The profile
          is saved only in this browser.
        </p>
        <button
          type="button"
          onClick={() => {
            setUnsure([]);
            setPhase('review');
          }}
          className="min-h-11 shrink-0 text-left text-sm font-medium text-gray-900 underline underline-offset-4 sm:text-right"
        >
          Fill it in myself instead
        </button>
      </div>
    </div>
  );
}
