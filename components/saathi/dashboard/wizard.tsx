'use client';

import { useEffect, useId, useRef } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * One question per screen. The heading names the step for screen readers, and takes focus when
 * the step changes so keyboard and screen-reader users land on the new question.
 */
export function Question({
  title,
  hint,
  focusOnMount = false,
  children,
}: {
  title: string;
  hint?: string;
  focusOnMount?: boolean;
  children: (ids: { titleId: string; hintId?: string }) => React.ReactNode;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const hintId = useId();
  useEffect(() => {
    if (focusOnMount) ref.current?.focus({ preventScroll: true });
  }, [focusOnMount]);

  return (
    <div>
      <h1
        ref={ref}
        id={titleId}
        tabIndex={-1}
        className="font-display tracking-display text-3xl leading-[1.08] text-gray-900 focus:outline-none md:text-[2.6rem]"
      >
        {title}
      </h1>
      {hint && (
        <p id={hintId} className="mt-3 max-w-md leading-relaxed text-gray-600">
          {hint}
        </p>
      )}
      <div className="mt-8 md:mt-10">
        {children({ titleId, hintId: hint ? hintId : undefined })}
      </div>
    </div>
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
        'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-[15px] transition-[background-color,border-color,color,transform] active:scale-95',
        on
          ? 'border-brand bg-brand text-white'
          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400 hover:text-gray-900'
      )}
    >
      {on && <Check aria-hidden className="size-3.5" strokeWidth={3} />}
      {children}
    </button>
  );
}
