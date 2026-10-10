'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Baby,
  Check,
  Heart,
  HeartHandshake,
  Sparkles,
  User,
  Users,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { EASE_OUT } from '@/components/saathi/motion';
import { firstName } from '@/lib/brief';
import { cn } from '@/lib/cn';
import { type Profile, type Relation, type Sex, actions } from '@/lib/saathi-store';

/*
 * New-profile onboarding: one question per screen instead of one long form.
 * Only the name is required; everything else can be skipped and edited later.
 */

const WHO: { value: Relation; label: string; icon: typeof User }[] = [
  { value: 'self', label: 'Me', icon: User },
  { value: 'parent', label: 'My parent', icon: HeartHandshake },
  { value: 'child', label: 'My child', icon: Baby },
  { value: 'spouse', label: 'My spouse', icon: Heart },
  { value: 'other', label: 'Someone else', icon: Users },
];

const CONDITIONS = [
  'Diabetes',
  'High blood pressure',
  'Asthma',
  'Heart condition',
  'Thyroid',
  'Pregnant',
];
const ALLERGIES = ['Penicillin', 'Sulfa drugs', 'Aspirin', 'Nuts', 'Dust or pollen'];

type Draft = Omit<Profile, 'id'> & { conditionTags: string[]; allergyTags: string[] };

const STEPS = ['who', 'name', 'basics', 'phone', 'conditions', 'medicines', 'done'] as const;
type Step = (typeof STEPS)[number];

export function Onboarding({
  adding,
  pending,
  onDone,
  onCancel,
}: {
  /** Adding another person (vs. the very first profile). */
  adding: boolean;
  /** Concern typed on the home page, carried into today's notes after setup. */
  pending: string | null;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [d, setD] = useState<Draft>({
    name: '',
    relation: adding ? 'parent' : 'self',
    age: '',
    sex: '',
    phone: '',
    conditions: '',
    medications: '',
    allergies: '',
    conditionTags: [],
    allergyTags: [],
  });
  const step: Step = STEPS[i];
  const self = d.relation === 'self';
  const who = d.name.trim() ? firstName(d.name) : self ? 'you' : 'them';
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((cur) => ({ ...cur, [k]: v }));

  const go = (delta: number) => {
    setDir(delta);
    setI((v) => Math.min(STEPS.length - 1, Math.max(0, v + delta)));
  };
  const next = () => go(1);
  const back = () => (i === 0 ? onCancel?.() : go(-1));

  const save = () => {
    const join = (tags: string[], extra: string) =>
      [...tags, ...extra.split(',').map((s) => s.trim())].filter(Boolean).join(', ');
    actions.saveProfile({
      name: d.name.trim(),
      relation: d.relation,
      age: d.age,
      sex: d.sex,
      phone: d.phone.trim(),
      conditions: join(d.conditionTags, d.conditions),
      medications: d.medications.trim(),
      allergies: join(d.allergyTags, d.allergies),
    });
    onDone();
  };

  const canContinue = step !== 'name' || d.name.trim().length > 0;
  const progress = i / (STEPS.length - 1);

  return (
    <div className="mx-auto flex min-h-[calc(100svh-73px)] max-w-xl flex-col px-6 pt-6 pb-10 md:pt-10">
      {/* Progress */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={back}
          aria-label={i === 0 ? 'Cancel' : 'Back'}
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900',
            i === 0 && !onCancel && 'invisible'
          )}
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-gray-100">
          <motion.div
            className="bg-brand h-full rounded-full"
            initial={false}
            animate={{ width: `${Math.max(6, progress * 100)}%` }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
          />
        </div>
        <span className="w-10 shrink-0 text-right text-xs text-gray-400 tabular-nums">
          {step === 'done' ? '' : `${i + 1}/${STEPS.length - 1}`}
        </span>
      </div>

      {/* Step */}
      <div className="relative mt-12 flex-1 md:mt-16">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={step}
            custom={dir}
            initial={reduce ? false : { opacity: 0, x: dir * 40, filter: 'blur(6px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={reduce ? undefined : { opacity: 0, x: dir * -40, filter: 'blur(6px)' }}
            transition={{ duration: 0.38, ease: EASE_OUT }}
          >
            {step === 'who' && (
              <Question
                title={adding ? 'Who else do you look after?' : 'Who is this for?'}
                hint={
                  pending ? undefined : 'You can add family members later and switch between them.'
                }
              >
                {pending && (
                  <p className="bg-mist mb-6 flex gap-3 rounded-xl px-4 py-3 text-sm text-gray-700">
                    <Sparkles className="mt-0.5 size-4 shrink-0" />
                    <span>
                      We’ll carry over “{pending.slice(0, 70)}
                      {pending.length > 70 ? '…' : ''}” to today’s notes.
                    </span>
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {WHO.filter((w) => !adding || w.value !== 'self').map(
                    ({ value, label, icon: Icon }) => {
                      const on = d.relation === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            set('relation', value);
                            setTimeout(next, 140);
                          }}
                          className={cn(
                            'group flex flex-col items-start gap-6 rounded-2xl border p-4 text-left transition-[border-color,background-color,transform] active:scale-[0.98]',
                            on
                              ? 'border-brand bg-brand text-white'
                              : 'border-gray-200 bg-white text-gray-900 hover:-translate-y-0.5 hover:border-gray-400'
                          )}
                        >
                          <Icon className={cn('size-5', on ? 'text-white' : 'text-gray-500')} />
                          <span className="font-medium">{label}</span>
                        </button>
                      );
                    }
                  )}
                </div>
              </Question>
            )}

            {step === 'name' && (
              <Question title={self ? 'What should doctor.ai call you?' : 'What’s their name?'}>
                <BigInput
                  value={d.name}
                  onChange={(v) => set('name', v)}
                  onEnter={() => canContinue && next()}
                  placeholder={self ? 'Your name' : d.relation === 'parent' ? 'Ammi' : 'Their name'}
                  autoComplete={self ? 'name' : 'off'}
                />
              </Question>
            )}

            {step === 'basics' && (
              <Question
                title={self ? 'A little about you' : `A little about ${who}`}
                hint="Age and sex change what’s likely, so doctor.ai asks better questions."
              >
                <div className="flex flex-col gap-8">
                  <div>
                    <p className="mb-3 text-sm text-gray-500">Age</p>
                    <BigInput
                      value={d.age}
                      onChange={(v) => set('age', v.replace(/\D/g, '').slice(0, 3))}
                      onEnter={next}
                      placeholder="34"
                      inputMode="numeric"
                      className="max-w-[9rem]"
                      suffix="years"
                    />
                  </div>
                  <div>
                    <p className="mb-3 text-sm text-gray-500">Sex</p>
                    <div className="flex flex-wrap gap-2">
                      {(['female', 'male', 'other'] as Exclude<Sex, ''>[]).map((s) => (
                        <Pill key={s} on={d.sex === s} onClick={() => set('sex', s)}>
                          {s[0].toUpperCase() + s.slice(1)}
                        </Pill>
                      ))}
                    </div>
                  </div>
                </div>
              </Question>
            )}

            {step === 'phone' && (
              <Question
                title="Which WhatsApp number will you call from?"
                hint="So doctor.ai knows it’s you when the call comes in. Include the country code."
              >
                <BigInput
                  value={d.phone}
                  onChange={(v) => set('phone', v)}
                  onEnter={next}
                  placeholder="+92 300 1234567"
                  type="tel"
                  autoComplete="tel"
                />
              </Question>
            )}

            {step === 'conditions' && (
              <Question
                title={
                  self ? 'Any ongoing conditions?' : `Does ${who} have any ongoing conditions?`
                }
                hint="Tap any that apply. Skip if none."
              >
                <div className="flex flex-wrap gap-2">
                  {CONDITIONS.map((c) => (
                    <Pill
                      key={c}
                      on={d.conditionTags.includes(c)}
                      onClick={() =>
                        set(
                          'conditionTags',
                          d.conditionTags.includes(c)
                            ? d.conditionTags.filter((x) => x !== c)
                            : [...d.conditionTags, c]
                        )
                      }
                    >
                      {c}
                    </Pill>
                  ))}
                </div>
                <input
                  value={d.conditions}
                  onChange={(e) => set('conditions', e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && next()}
                  placeholder="Something else? Type it here"
                  className="mt-6 w-full border-b border-gray-200 bg-transparent py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none"
                />
              </Question>
            )}

            {step === 'medicines' && (
              <Question
                title="Medicines and allergies"
                hint="doctor.ai checks these before suggesting anything."
              >
                <p className="mb-3 text-sm text-gray-500">Taken regularly</p>
                <input
                  value={d.medications}
                  onChange={(e) => set('medications', e.target.value)}
                  placeholder="e.g. Metformin 500mg twice a day"
                  className="w-full border-b border-gray-200 bg-transparent py-3 text-lg text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none"
                />
                <p className="mt-8 mb-3 text-sm text-gray-500">Allergic to</p>
                <div className="flex flex-wrap gap-2">
                  {ALLERGIES.map((a) => (
                    <Pill
                      key={a}
                      on={d.allergyTags.includes(a)}
                      onClick={() =>
                        set(
                          'allergyTags',
                          d.allergyTags.includes(a)
                            ? d.allergyTags.filter((x) => x !== a)
                            : [...d.allergyTags, a]
                        )
                      }
                    >
                      {a}
                    </Pill>
                  ))}
                </div>
                <input
                  value={d.allergies}
                  onChange={(e) => set('allergies', e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && next()}
                  placeholder="Something else?"
                  className="mt-4 w-full border-b border-gray-200 bg-transparent py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none"
                />
              </Question>
            )}

            {step === 'done' && (
              <div className="flex flex-col items-start">
                <motion.span
                  initial={reduce ? false : { scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}
                  className="bg-brand grid size-14 place-items-center rounded-full text-white"
                >
                  <Check className="size-7" strokeWidth={2.5} />
                </motion.span>
                <h1 className="font-display tracking-display mt-8 text-4xl leading-[1.05] text-gray-900 md:text-5xl">
                  {self ? `You’re all set, ${who}.` : `${who} is all set.`}
                </h1>
                <p className="mt-4 max-w-md text-lg leading-relaxed text-gray-600">
                  doctor.ai will read this before every consult. You can change it any time from the
                  profile card.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Actions */}
      <div className="mt-10 flex items-center justify-between gap-3">
        {step === 'done' ? (
          <button
            type="button"
            onClick={save}
            className="bg-brand hover:bg-brand-2 inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-4 font-medium text-white transition-[transform,background-color] hover:-translate-y-0.5 sm:w-auto"
          >
            {pending ? 'Continue to today’s notes' : 'Go to my dashboard'}
            <ArrowRight className="size-4" />
          </button>
        ) : step === 'who' ? (
          <span />
        ) : (
          <>
            {step === 'name' ? (
              <span />
            ) : (
              <button
                type="button"
                onClick={next}
                className="px-2 py-3 text-sm text-gray-500 transition-colors hover:text-gray-900"
              >
                Skip
              </button>
            )}
            <button
              type="button"
              disabled={!canContinue}
              onClick={next}
              className="bg-brand hover:bg-brand-2 inline-flex items-center gap-2 rounded-xl px-6 py-3.5 font-medium text-white transition-[transform,background-color,opacity] enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Continue <ArrowRight className="size-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function Question({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="font-display tracking-display text-3xl leading-[1.08] text-gray-900 md:text-[2.6rem]">
        {title}
      </h1>
      {hint && <p className="mt-3 max-w-md leading-relaxed text-gray-500">{hint}</p>}
      <div className="mt-8 md:mt-10">{children}</div>
    </div>
  );
}

export function BigInput({
  value,
  onChange,
  onEnter,
  placeholder,
  suffix,
  className,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
  placeholder: string;
  suffix?: string;
  className?: string;
} & Pick<React.ComponentProps<'input'>, 'type' | 'inputMode' | 'autoComplete'>) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 380);
    return () => clearTimeout(t);
  }, []);
  return (
    <label
      className={cn(
        'flex items-baseline gap-3 border-b-2 border-gray-200 transition-colors focus-within:border-gray-900',
        className
      )}
    >
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter()}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent py-3 text-2xl text-gray-900 placeholder:text-gray-300 focus:outline-none md:text-3xl"
        {...rest}
      />
      {suffix && <span className="text-gray-400">{suffix}</span>}
    </label>
  );
}

export function Pill({
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
        'inline-flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-[15px] transition-[background-color,border-color,color,transform] active:scale-95',
        on
          ? 'border-brand bg-brand text-white'
          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400 hover:text-gray-900'
      )}
    >
      {on && <Check className="size-3.5" strokeWidth={3} />}
      {children}
    </button>
  );
}
