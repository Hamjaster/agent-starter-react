'use client';

import { useId, useRef, useState } from 'react';
import {
  AlertCircle,
  FileText,
  FlaskConical,
  Hospital,
  Paperclip,
  Pill as PillIcon,
  ScrollText,
  Trash2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { buttonClass } from '@/components/saathi/button';
import { inputClass } from '@/components/saathi/ui';
import { RELATION_LABELS } from '@/lib/brief';
import { cn } from '@/lib/cn';
import { ACCEPT, ExtractError, requestExtraction } from '@/lib/extract';
import { type ProfileDraft, draftContext, mergeExtraction } from '@/lib/profile-draft';
import type { DocumentKind, Relation, Sex } from '@/lib/saathi-store';
import { AttachmentList, useAttachments } from './attachments';
import { TagInput } from './tag-input';

export const CONDITIONS = [
  'Diabetes',
  'High blood pressure',
  'Asthma',
  'Heart condition',
  'Thyroid',
  'Pregnant',
] as const;
export const ALLERGIES = [
  'Penicillin',
  'Sulfa drugs',
  'Aspirin',
  'Nuts',
  'Dust or pollen',
] as const;

const KIND: Record<DocumentKind, { label: string; icon: typeof FileText }> = {
  prescription: { label: 'Prescription', icon: ScrollText },
  'lab-report': { label: 'Lab report', icon: FlaskConical },
  'discharge-summary': { label: 'Discharge summary', icon: Hospital },
  'medicine-pack': { label: 'Medicine pack', icon: PillIcon },
  other: { label: 'Document', icon: FileText },
};

const SEXES: { value: Exclude<Sex, ''>; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
];

export const card = 'rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7';
/**
 * The health profile as one editable page: who it's for, their health, and the documents
 * doctor.ai has read. Used to review what doctor.ai understood and to edit later.
 */
export function ProfileEditor({
  draft,
  onChange,
  onSave,
  onCancel,
  saveLabel,
  unsure = [],
}: {
  draft: ProfileDraft;
  onChange: (d: ProfileDraft) => void;
  onSave: () => void;
  onCancel?: () => void;
  saveLabel: string;
  unsure?: string[];
}) {
  const set = <K extends keyof ProfileDraft>(k: K, v: ProfileDraft[K]) =>
    onChange({ ...draft, [k]: v });
  const self = draft.relation === 'self';
  const valid = draft.name.trim().length > 0;
  const nameId = useId();
  const ageId = useId();
  const phoneId = useId();
  const historyId = useId();

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSave();
      }}
    >
      {unsure.length > 0 && (
        <div className="bg-mist flex gap-3 rounded-2xl border border-gray-300 p-4 text-sm leading-relaxed text-gray-900 sm:p-5">
          <AlertCircle aria-hidden className="text-brand-3 mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-medium">Please check these:</p>
            <ul className="mt-1 list-disc pl-5">
              {unsure.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <section className={card} aria-labelledby={`${nameId}-about`}>
        <h2
          id={`${nameId}-about`}
          className="font-display tracking-display-sm text-2xl text-gray-900"
        >
          About
        </h2>
        <fieldset className="mt-5">
          <legend className="text-sm font-medium text-gray-900">Who is this profile for?</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(Object.keys(RELATION_LABELS) as Relation[]).map((r) => (
              <Choice key={r} on={draft.relation === r} onClick={() => set('relation', r)}>
                {RELATION_LABELS[r]}
              </Choice>
            ))}
          </div>
        </fieldset>

        <div className="mt-5 grid gap-5 sm:grid-cols-[1fr_7rem]">
          <div>
            <label htmlFor={nameId} className="text-sm font-medium text-gray-900">
              {self ? 'Your name' : 'Their name'} <span className="text-gray-500">(required)</span>
            </label>
            <input
              id={nameId}
              required
              value={draft.name}
              onChange={(e) => set('name', e.target.value.slice(0, 80))}
              autoComplete={self ? 'name' : 'off'}
              className={cn(inputClass, 'mt-2')}
            />
          </div>
          <div>
            <label htmlFor={ageId} className="text-sm font-medium text-gray-900">
              Age
            </label>
            <input
              id={ageId}
              inputMode="numeric"
              value={draft.age}
              onChange={(e) => set('age', e.target.value.replace(/\D/g, '').slice(0, 3))}
              className={cn(inputClass, 'mt-2')}
            />
          </div>
        </div>

        <fieldset className="mt-5">
          <legend className="text-sm font-medium text-gray-900">Sex</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {SEXES.map((s) => (
              <Choice
                key={s.value}
                on={draft.sex === s.value}
                onClick={() => set('sex', draft.sex === s.value ? '' : s.value)}
              >
                {s.label}
              </Choice>
            ))}
          </div>
        </fieldset>

        <div className="mt-5">
          <label htmlFor={phoneId} className="text-sm font-medium text-gray-900">
            WhatsApp number
          </label>
          <input
            id={phoneId}
            type="tel"
            inputMode="tel"
            autoComplete={self ? 'tel' : 'off'}
            value={draft.phone}
            onChange={(e) => set('phone', e.target.value.slice(0, 20))}
            placeholder="+92 300 1234567"
            aria-describedby={`${phoneId}-hint`}
            className={cn(inputClass, 'mt-2')}
          />
          <p id={`${phoneId}-hint`} className="mt-2 text-sm text-gray-600">
            The number you’ll call doctor.ai from, so it knows it’s you.
          </p>
        </div>
      </section>

      <section className={card} aria-labelledby={`${nameId}-health`}>
        <h2
          id={`${nameId}-health`}
          className="font-display tracking-display-sm text-2xl text-gray-900"
        >
          Health
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          doctor.ai checks these before suggesting anything.
        </p>
        <div className="mt-5 flex flex-col gap-6">
          <TagInput
            label="Ongoing conditions"
            values={draft.conditions}
            onChange={(v) => set('conditions', v)}
            placeholder="e.g. High blood pressure"
            suggestions={CONDITIONS}
          />
          <TagInput
            label="Medicines taken regularly"
            values={draft.medications}
            onChange={(v) => set('medications', v)}
            placeholder="e.g. Metformin 500mg twice a day"
            commaSeparates={false}
          />
          <TagInput
            label="Allergies"
            values={draft.allergies}
            onChange={(v) => set('allergies', v)}
            placeholder="e.g. Penicillin"
            suggestions={ALLERGIES}
          />
          <div>
            <label htmlFor={historyId} className="text-sm font-medium text-gray-900">
              Anything else worth knowing
            </label>
            <textarea
              id={historyId}
              rows={3}
              value={draft.history}
              onChange={(e) => set('history', e.target.value.slice(0, 600))}
              placeholder="Past surgeries, pregnancies, family history…"
              className={cn(inputClass, 'mt-2 resize-y')}
            />
          </div>
        </div>
      </section>

      <Documents draft={draft} onChange={onChange} />

      {/* Save bar: sticks to the bottom on long pages so it's always in reach. */}
      <div className="sticky bottom-0 z-10 -mx-1 flex flex-col-reverse gap-3 border-t border-gray-200 bg-white/90 px-1 py-4 backdrop-blur sm:flex-row sm:justify-end">
        {onCancel && (
          <button type="button" onClick={onCancel} className={buttonClass({ variant: 'outline' })}>
            Cancel
          </button>
        )}
        <button type="submit" disabled={!valid} className={buttonClass()}>
          {saveLabel}
        </button>
      </div>
    </form>
  );
}

function Choice({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'min-h-11 rounded-full border px-4 text-[15px] transition-[background-color,border-color,color]',
        on
          ? 'border-brand bg-brand text-white'
          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400 hover:text-gray-900'
      )}
    >
      {children}
    </button>
  );
}

/** What doctor.ai has read so far, plus adding more prescriptions or reports. */
function Documents({
  draft,
  onChange,
}: {
  draft: ProfileDraft;
  onChange: (d: ProfileDraft) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const att = useAttachments();
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();

  const read = async () => {
    if (!att.files.length) return;
    setReading(true);
    setError(null);
    try {
      const x = await requestExtraction({
        text: '',
        files: att.files,
        context: draftContext(draft),
      });
      onChange(mergeExtraction(draft, x));
      att.clear();
    } catch (e) {
      setError(
        e instanceof ExtractError && e.code === 'not-configured'
          ? 'Reading documents isn’t set up on this site yet.'
          : 'doctor.ai couldn’t read those files. Try clearer photos, or add the details yourself.'
      );
    } finally {
      setReading(false);
    }
  };

  return (
    <section className={card} aria-labelledby={titleId}>
      <h2 id={titleId} className="font-display tracking-display-sm text-2xl text-gray-900">
        Documents
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        Prescriptions and reports doctor.ai has read. The files themselves aren’t kept.
      </p>

      {draft.documents.length > 0 && (
        <ul className="mt-5 flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {draft.documents.map((d) => {
              const { label, icon: Icon } = KIND[d.kind] ?? KIND.other;
              return (
                <motion.li
                  key={d.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex gap-4 rounded-xl bg-gray-50 p-4"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-gray-700 ring-1 ring-gray-200">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium break-words text-gray-900">{d.title}</p>
                    <p className="text-xs text-gray-600">
                      {label}
                      {d.date && ` · ${d.date}`}
                    </p>
                    {d.summary && (
                      <p className="mt-2 text-sm leading-relaxed text-gray-700">{d.summary}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...draft,
                        documents: draft.documents.filter((x) => x.id !== d.id),
                      })
                    }
                    aria-label={`Remove ${d.title}`}
                    className="grid size-10 shrink-0 place-items-center rounded-full text-gray-500 hover:bg-white hover:text-gray-900"
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      <div className="mt-5 flex flex-col gap-3">
        <AttachmentList
          files={att.files}
          previews={att.previews}
          onRemove={att.remove}
          reading={reading}
        />
        {(att.problem || error) && (
          <p role="alert" className="text-sm text-gray-900">
            {att.problem || error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
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
            disabled={reading}
            onClick={() => input.current?.click()}
            className={buttonClass({ variant: 'outline', size: 'sm' })}
          >
            <Paperclip aria-hidden className="size-4" /> Add prescriptions or reports
          </button>
          {att.files.length > 0 && (
            <button
              type="button"
              disabled={reading}
              onClick={read}
              className={buttonClass({ size: 'sm' })}
            >
              {reading ? 'Reading…' : `Read ${att.files.length === 1 ? 'it' : 'them'}`}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
