'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ImagePlus, Phone, UserRound, Video, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { EASE_OUT } from '@/components/saathi/motion';
import { cn } from '@/lib/cn';
import { savePendingConcern } from '@/lib/pending-concern';

const EXAMPLES = [
  'My child has had a fever since last night…',
  'A red itchy rash on my forearm…',
  'Can you read my blood test report?',
  'My mother’s blood pressure is 160/100…',
  'A cough that won’t go away for two weeks…',
];

const SUGGESTIONS = [
  { href: '/consult', label: 'Call on WhatsApp', icon: Phone },
  { href: '/dashboard', label: 'Set up a health profile', icon: UserRound },
];

/**
 * The hero's "tell doctor.ai" composer. Sending starts a video consult: what's typed is stashed
 * and handed to doctor.ai as the brief, and becomes today's concern if a profile exists. The
 * suggestion links carry the text along too.
 */
export function Composer({ delay = 0 }: { delay?: number }) {
  const reduce = useReducedMotion();
  const router = useRouter();
  const id = useId();
  const area = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [example, setExample] = useState(0);
  const [photo, setPhoto] = useState<{ url: string; name: string } | null>(null);
  const ready = text.trim().length > 0;

  // Cycle the placeholder through real things people ask.
  useEffect(() => {
    if (reduce || text) return;
    const t = setInterval(() => setExample((v) => (v + 1) % EXAMPLES.length), 3200);
    return () => clearInterval(t);
  }, [reduce, text]);

  // Grow with the text, up to a limit.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [text]);

  useEffect(() => () => void (photo && URL.revokeObjectURL(photo.url)), [photo]);

  const carry = () => {
    if (ready) savePendingConcern(text);
  };
  const submit = () => {
    if (!ready) return;
    carry();
    router.push('/consult/video');
  };

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: EASE_OUT, delay }}
      className="w-full max-w-xl"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={cn(
          'relative rounded-[22px] border bg-white/90 p-3 backdrop-blur-xl transition-[border-color,box-shadow] duration-300 sm:p-4',
          focused
            ? 'border-gray-300 shadow-[0_0_0_6px_rgb(43_53_52/0.07),0_30px_60px_-24px_rgb(43_53_52/0.35)]'
            : 'border-gray-200 shadow-[0_24px_50px_-28px_rgb(43_53_52/0.35)]'
        )}
      >
        <label htmlFor={id} className="sr-only">
          Tell doctor.ai what’s bothering you
        </label>
        <div className="relative">
          <textarea
            id={id}
            ref={area}
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            className="block min-h-[64px] w-full resize-none bg-transparent px-2 pt-1.5 text-base leading-relaxed text-gray-900 focus:outline-none md:text-lg"
          />
          {/* Rotating placeholder: real examples, one at a time */}
          {!text && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-2 top-1.5 overflow-hidden text-base leading-relaxed text-gray-500 md:text-lg"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={example}
                  initial={reduce ? false : { opacity: 0, y: 14, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={reduce ? undefined : { opacity: 0, y: -14, filter: 'blur(4px)' }}
                  transition={{ duration: 0.45, ease: EASE_OUT }}
                  className="block truncate"
                >
                  {EXAMPLES[example]}
                </motion.span>
              </AnimatePresence>
            </div>
          )}
        </div>

        <AnimatePresence>
          {photo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 flex items-center gap-3 rounded-xl bg-gray-50 p-2 pr-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt="" className="size-10 rounded-lg object-cover" />
                <p className="min-w-0 flex-1 text-xs leading-snug text-gray-600">
                  Photo stays on this device. Hold it up to the camera on the call.
                </p>
                <button
                  type="button"
                  aria-label="Remove photo"
                  onClick={() => setPhoto(null)}
                  className="grid size-10 place-items-center rounded-full text-gray-500 hover:bg-gray-200"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <input
              ref={file}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setPhoto({ url: URL.createObjectURL(f), name: f.name });
                e.target.value = '';
              }}
            />
            <ToolButton label="Add a photo" onClick={() => file.current?.click()}>
              <ImagePlus className="size-[18px]" />
            </ToolButton>
            <span className="ml-1 hidden text-xs text-gray-500 sm:inline">
              Enter to start · Shift + Enter for a new line
            </span>
          </div>
          <motion.button
            type="submit"
            disabled={!ready}
            animate={
              reduce
                ? undefined
                : ready
                  ? { scale: 1, opacity: 1, y: 0 }
                  : { scale: 0.92, opacity: 0.5, y: 0 }
            }
            whileHover={ready ? { y: -2 } : undefined}
            whileTap={ready ? { scale: 0.9 } : undefined}
            transition={{ type: 'spring', stiffness: 420, damping: 24 }}
            className={cn(
              'inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-5 text-sm font-medium transition-colors',
              ready
                ? 'bg-brand hover:bg-brand-2 text-white shadow-lg shadow-gray-900/20'
                : 'cursor-not-allowed bg-gray-200 text-gray-600'
            )}
          >
            <Video aria-hidden className="size-4" />
            Talk on video
          </motion.button>
        </div>
      </form>

      {/* Suggestions */}
      <div className="mt-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map(({ href, label, icon: Icon }, i) => (
          <motion.div
            key={label}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE_OUT, delay: delay + 0.25 + i * 0.08 }}
            whileHover={reduce ? undefined : { y: -3 }}
          >
            <Link
              href={href}
              onClick={carry}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 shadow-sm transition-[border-color,box-shadow,color] hover:border-gray-300 hover:text-gray-900 hover:shadow-md"
            >
              <Icon className="size-4 text-gray-500" />
              {label}
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function ToolButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-11 place-items-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
    >
      {children}
    </button>
  );
}
