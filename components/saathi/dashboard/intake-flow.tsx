'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, Pencil, Siren } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { EASE_OUT } from '@/components/saathi/motion';
import { BODY_AREAS, RED_FLAGS, SINCE_LABELS, firstName } from '@/lib/brief';
import { cn } from '@/lib/cn';
import { type Intake, type Profile, type Since, actions } from '@/lib/saathi-store';
import { Pill, Question } from './onboarding';

/*
 * Today's concern, one question at a time. Safety comes first: if any emergency sign is
 * present, the patient is told to get emergency care before anything else. Answers save as
 * they're given; the last screen is a recap with the hand-off to the consult.
 */

const STEPS = ['safety', 'concern', 'where', 'since', 'severity', 'recap'] as const;
type Step = (typeof STEPS)[number];

const SEVERITY_WORDS: [number, string][] = [
  [1, 'Barely there'],
  [3, 'Annoying'],
  [5, 'Hard to ignore'],
  [7, 'Stopping me from normal things'],
  [9, 'Worst I’ve felt'],
];
const severityWord = (n: number | null) =>
  n ? [...SEVERITY_WORDS].reverse().find(([k]) => n >= k)?.[1] : undefined;

function initialStep(intake: Intake): number {
  const answered = intake.concern.trim().length >= 3 && intake.severity !== null;
  return answered ? STEPS.indexOf('recap') : 0;
}

export function IntakeFlow({
  profile,
  intake,
  carried,
}: {
  profile: Profile;
  intake: Intake;
  carried: boolean;
}) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(() => initialStep(intake));
  const [dir, setDir] = useState(1);
  const update = (patch: Partial<Intake>) => actions.updateIntake(profile.id, patch);
  const step: Step = STEPS[i];
  const self = profile.relation === 'self';
  const name = firstName(profile.name);
  const emergency = intake.redFlags.length > 0;
  const ready = intake.concern.trim().length >= 3;

  const goTo = (n: number) => {
    setDir(n > i ? 1 : -1);
    setI(Math.min(STEPS.length - 1, Math.max(0, n)));
  };
  const next = () => goTo(i + 1);

  const canContinue = step !== 'concern' || ready;
  const progress = i / (STEPS.length - 1);

  return (
    <section
      aria-label="Today’s concern"
      className="flex min-h-[560px] flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10"
    >
      {/* Progress */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => goTo(i - 1)}
          aria-label="Back"
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900',
            i === 0 && 'invisible'
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
          {step === 'recap' ? '' : `${i + 1}/${STEPS.length - 1}`}
        </span>
      </div>

      <div className="relative mt-10 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={reduce ? false : { opacity: 0, x: dir * 40, filter: 'blur(6px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={reduce ? undefined : { opacity: 0, x: dir * -40, filter: 'blur(6px)' }}
            transition={{ duration: 0.38, ease: EASE_OUT }}
          >
            {step === 'safety' && (
              <Question
                title={
                  self
                    ? 'First, is any of this happening now?'
                    : `First, is ${name} having any of this now?`
                }
                hint="Tap any that apply."
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  {RED_FLAGS.map((f) => {
                    const on = intake.redFlags.includes(f);
                    return (
                      <button
                        key={f}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          update({
                            redFlags: on
                              ? intake.redFlags.filter((x) => x !== f)
                              : [...intake.redFlags, f],
                          })
                        }
                        className={cn(
                          'flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-[15px] transition-[background-color,border-color,color,transform] active:scale-[0.99]',
                          on
                            ? 'border-danger bg-danger text-white'
                            : 'border-gray-200 bg-white text-gray-800 hover:border-gray-400'
                        )}
                      >
                        <span
                          className={cn(
                            'grid size-5 shrink-0 place-items-center rounded-md border',
                            on ? 'border-white bg-white/20' : 'border-gray-300'
                          )}
                        >
                          {on && <Check className="size-3.5" strokeWidth={3} />}
                        </span>
                        {f}
                      </button>
                    );
                  })}
                </div>
                <AnimatePresence>
                  {emergency && (
                    <motion.div
                      role="alert"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-danger mt-6 flex gap-4 rounded-2xl p-5 text-white">
                        <Siren className="mt-0.5 size-6 shrink-0" />
                        <div>
                          <p className="text-lg font-semibold">Get emergency care now.</p>
                          <p className="mt-1 leading-relaxed text-white/90">
                            Call your local emergency number or go to the nearest emergency
                            department. Don’t wait for a consult with doctor.ai.
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Question>
            )}

            {step === 'concern' && (
              <Question
                title={self ? 'What’s bothering you?' : `What’s bothering ${name}?`}
                hint={
                  carried
                    ? 'We added what you typed on the home page. Add anything else.'
                    : 'In your own words. What, where, since when, what makes it worse.'
                }
              >
                <textarea
                  autoFocus
                  rows={4}
                  value={intake.concern}
                  onChange={(e) => update({ concern: e.target.value })}
                  placeholder="An itchy red rash on my forearm. It started three days ago and is worse at night."
                  className="w-full resize-none border-b-2 border-gray-200 bg-transparent py-3 text-xl leading-relaxed text-gray-900 placeholder:text-gray-300 focus:border-gray-900 focus:outline-none md:text-2xl"
                />
              </Question>
            )}

            {step === 'where' && (
              <Question title="Where is it?" hint="Tap all that apply.">
                <div className="flex flex-wrap gap-2">
                  {BODY_AREAS.map((a) => (
                    <Pill
                      key={a}
                      on={intake.areas.includes(a)}
                      onClick={() =>
                        update({
                          areas: intake.areas.includes(a)
                            ? intake.areas.filter((x) => x !== a)
                            : [...intake.areas, a],
                        })
                      }
                    >
                      {a}
                    </Pill>
                  ))}
                </div>
              </Question>
            )}

            {step === 'since' && (
              <Question title="When did it start?">
                <div className="grid gap-2 sm:grid-cols-2">
                  {(Object.keys(SINCE_LABELS) as Exclude<Since, ''>[]).map((k) => {
                    const on = intake.since === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          update({ since: k });
                          setTimeout(next, 160);
                        }}
                        className={cn(
                          'rounded-xl border px-5 py-4 text-left text-lg transition-[background-color,border-color,color,transform] active:scale-[0.99]',
                          on
                            ? 'border-brand bg-brand text-white'
                            : 'border-gray-200 bg-white text-gray-900 hover:-translate-y-0.5 hover:border-gray-400'
                        )}
                      >
                        {SINCE_LABELS[k]}
                      </button>
                    );
                  })}
                </div>
              </Question>
            )}

            {step === 'severity' && (
              <Question title="How bad is it right now?">
                <p className="font-display tracking-display-sm mb-6 h-8 text-2xl text-gray-900">
                  {severityWord(intake.severity) ?? (
                    <span className="text-gray-300">Pick a number</span>
                  )}
                </p>
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                  {Array.from({ length: 10 }, (_, k) => k + 1).map((n) => {
                    const on = intake.severity !== null && n <= intake.severity;
                    return (
                      <motion.button
                        key={n}
                        type="button"
                        whileTap={{ scale: 0.9 }}
                        aria-label={`${n} out of 10`}
                        aria-pressed={intake.severity === n}
                        onClick={() => update({ severity: n })}
                        className={cn(
                          'h-14 rounded-xl border text-lg tabular-nums transition-colors',
                          on
                            ? n >= 8
                              ? 'border-danger bg-danger text-white'
                              : 'border-brand bg-brand text-white'
                            : 'border-gray-200 bg-white text-gray-500 hover:border-gray-400'
                        )}
                        style={on ? { transitionDelay: `${(n - 1) * 25}ms` } : undefined}
                      >
                        {n}
                      </motion.button>
                    );
                  })}
                </div>
              </Question>
            )}

            {step === 'recap' && (
              <Question
                title={self ? 'Ready when you are.' : `${name}’s notes are ready.`}
                hint="doctor.ai reads this before it says hello. Tap anything to change it."
              >
                <dl className="divide-y divide-gray-100 border-y border-gray-100">
                  <Row label="What’s wrong" onEdit={() => goTo(1)}>
                    {intake.concern.trim() || <Empty />}
                  </Row>
                  <Row label="Where" onEdit={() => goTo(2)}>
                    {intake.areas.join(', ') || <Empty />}
                  </Row>
                  <Row label="Started" onEdit={() => goTo(3)}>
                    {intake.since ? SINCE_LABELS[intake.since] : <Empty />}
                  </Row>
                  <Row label="How bad" onEdit={() => goTo(4)}>
                    {intake.severity ? (
                      `${intake.severity}/10 · ${severityWord(intake.severity)}`
                    ) : (
                      <Empty />
                    )}
                  </Row>
                  <Row label="Emergency signs" onEdit={() => goTo(0)}>
                    {emergency ? (
                      <span className="text-danger">{intake.redFlags.join(', ')}</span>
                    ) : (
                      'None'
                    )}
                  </Row>
                </dl>
              </Question>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Actions */}
      <div className="mt-10 flex items-center justify-between gap-3">
        {step === 'safety' ? (
          <>
            <span />
            {emergency ? (
              <button
                type="button"
                onClick={next}
                className="rounded-xl border border-gray-200 px-5 py-3.5 font-medium text-gray-900 transition-colors hover:border-gray-400"
              >
                I’m safe, continue to doctor.ai
              </button>
            ) : (
              <button
                type="button"
                onClick={next}
                className="bg-brand hover:bg-brand-2 inline-flex items-center gap-2 rounded-xl px-6 py-3.5 font-medium text-white transition-[transform,background-color] hover:-translate-y-0.5"
              >
                None of these <ArrowRight className="size-4" />
              </button>
            )}
          </>
        ) : step === 'recap' ? (
          <>
            <span className="text-sm text-gray-500">
              {ready ? '' : 'Add what’s wrong to continue.'}
            </span>
            <Link
              href="/consult"
              aria-disabled={!ready}
              tabIndex={ready ? undefined : -1}
              onClick={(e) => !ready && e.preventDefault()}
              className={cn(
                'group inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-medium transition-[transform,background-color,opacity]',
                !ready && 'pointer-events-none opacity-40',
                emergency
                  ? 'border border-gray-200 bg-white text-gray-900'
                  : 'bg-brand hover:bg-brand-2 text-white hover:-translate-y-0.5'
              )}
            >
              {emergency ? 'Continue to doctor.ai anyway' : 'Continue to consult'}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </>
        ) : (
          <>
            {step === 'concern' ? (
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
    </section>
  );
}

function Row({
  label,
  onEdit,
  children,
}: {
  label: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="group grid w-full grid-cols-[110px_1fr_auto] items-start gap-4 py-4 text-left sm:grid-cols-[150px_1fr_auto]"
    >
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="line-clamp-3 text-[15px] text-gray-900">{children}</dd>
      <Pencil className="mt-0.5 size-4 text-gray-300 transition-colors group-hover:text-gray-900" />
    </button>
  );
}

function Empty() {
  return <span className="text-gray-400">Not added</span>;
}
