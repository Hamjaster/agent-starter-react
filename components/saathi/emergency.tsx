'use client';

import { forwardRef } from 'react';
import { HeartHandshake, Phone, Siren } from 'lucide-react';
import { CRISIS_LINE, EMERGENCY_LINE, SELF_HARM_FLAG } from '@/lib/brief';
import { cn } from '@/lib/cn';

/**
 * The one emergency message, used wherever red flags are shown. It leads with a tap-to-call
 * button so the next action is one tap away, and adds the crisis line for self-harm.
 */
export const EmergencyAlert = forwardRef<
  HTMLDivElement,
  { flags: readonly string[]; who?: string; className?: string }
>(function EmergencyAlert({ flags, who, className }, ref) {
  const selfHarm = flags.includes(SELF_HARM_FLAG);
  return (
    <div
      ref={ref}
      role="alert"
      className={cn('bg-danger scroll-mt-24 rounded-2xl p-5 text-white sm:p-6', className)}
    >
      <div className="flex gap-4">
        <Siren aria-hidden className="mt-0.5 size-6 shrink-0" />
        <div className="min-w-0">
          <p className="text-lg font-semibold">Get emergency care now.</p>
          <p className="mt-1 leading-relaxed text-white/90">
            {who ? `${who} needs` : 'This needs'} a doctor in person, not a call. Call{' '}
            {EMERGENCY_LINE.name} or go to the nearest emergency department. doctor.ai can’t treat
            an emergency.
          </p>
          {selfHarm && (
            <p className="mt-3 flex gap-2 leading-relaxed text-white/90">
              <HeartHandshake aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                If you’re thinking about harming yourself, you’re not alone. {CRISIS_LINE.name} is
                free, confidential and open all day and night: {CRISIS_LINE.display}.
              </span>
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={`tel:${EMERGENCY_LINE.tel}`}
              className="text-danger inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-5 font-semibold transition-transform hover:-translate-y-0.5"
            >
              <Phone aria-hidden className="size-4 fill-current" /> Call {EMERGENCY_LINE.tel}
            </a>
            {selfHarm && (
              <a
                href={`tel:${CRISIS_LINE.tel}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/60 px-5 font-medium text-white transition-colors hover:bg-white/10"
              >
                Call {CRISIS_LINE.name}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
