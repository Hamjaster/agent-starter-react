import { cn } from '@/lib/cn';

/*
 * The one button recipe, for <button> and <Link>/<a> alike. Every CTA on the site uses it so
 * shape, size and states stay in step:
 *   primary       brand slate, the main action on light surfaces
 *   inverse       white, the main action on dark (brand) surfaces
 *   outline       secondary action on light surfaces
 *   outline-dark  secondary action on dark surfaces
 *   wa            WhatsApp green, only for opening WhatsApp
 *   wa-outline    secondary WhatsApp action
 */
export type ButtonVariant =
  | 'primary'
  | 'inverse'
  | 'outline'
  | 'outline-dark'
  | 'wa'
  | 'wa-outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-2',
  inverse: 'bg-white text-gray-900 hover:bg-gray-100',
  outline: 'border border-gray-200 bg-white text-gray-900 hover:border-gray-400',
  'outline-dark': 'border border-white/30 text-white hover:bg-white/10',
  wa: 'bg-wa text-wa-ink font-semibold',
  'wa-outline': 'border border-wa-ink/70 text-wa-ink hover:bg-wa/10',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-10 px-4 text-sm',
  md: 'min-h-12 px-6',
  lg: 'min-h-14 px-7 text-lg',
};

export function buttonClass(
  { variant = 'primary', size = 'md' }: { variant?: ButtonVariant; size?: ButtonSize } = {},
  className?: string
) {
  return cn(
    'group inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-[transform,background-color,border-color,opacity] hover:-translate-y-0.5',
    'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0',
    'aria-disabled:pointer-events-none aria-disabled:opacity-40',
    VARIANTS[variant],
    SIZES[size],
    className
  );
}
