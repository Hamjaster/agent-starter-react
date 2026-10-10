'use client';

import { type ButtonSize, type ButtonVariant, buttonClass } from '@/components/saathi/button';

/** Text inputs and textareas on light surfaces: 16px text so iOS doesn't zoom, visible focus. */
export const inputClass =
  'w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-500 transition-colors focus:border-brand-3 focus:ring-4 focus:ring-brand/10 focus:outline-none';

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: React.ComponentProps<'button'> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button {...props} className={buttonClass({ variant, size }, className)} />;
}

/** Page header for the app screens (dashboard, consult, video). */
export function AppHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4 md:px-12">
        {children}
      </div>
    </header>
  );
}
