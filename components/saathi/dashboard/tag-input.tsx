'use client';

import { useId, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { dedupe } from '@/lib/profile-fields';

/**
 * A list edited as tags: type and press Enter (or a comma, where commas can't be part of an
 * item), tap a suggestion, or remove with ×. Text left in the box is kept on blur.
 */
export function TagInput({
  label,
  values,
  onChange,
  placeholder,
  suggestions = [],
  commaSeparates = true,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  suggestions?: readonly string[];
  commaSeparates?: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState('');
  const has = (s: string) => values.some((v) => v.toLowerCase() === s.toLowerCase());
  const add = (text: string) => {
    const t = text.trim();
    if (t) onChange(dedupe([...values, t]));
    setDraft('');
  };
  const open = suggestions.filter((s) => !has(s));

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-gray-900">
        {label}
      </label>
      <div className="focus-within:border-brand-3 mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-gray-300 bg-white p-2 transition-colors">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex max-w-full items-center gap-1 rounded-full bg-gray-100 py-1 pr-1 pl-3 text-sm text-gray-900"
          >
            <span className="truncate">{v}</span>
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              aria-label={`Remove ${v}`}
              className="grid size-7 shrink-0 place-items-center rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-900"
            >
              <X aria-hidden className="size-3.5" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => {
            const v = e.target.value;
            if (commaSeparates && v.endsWith(',')) add(v.slice(0, -1));
            else setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add(draft);
            } else if (e.key === 'Backspace' && !draft && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={() => add(draft)}
          placeholder={values.length ? 'Add another' : placeholder}
          className="min-h-9 min-w-[10rem] flex-1 bg-transparent px-2 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none"
        />
      </div>
      {open.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {open.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="inline-flex min-h-9 items-center gap-1 rounded-full border border-dashed border-gray-300 px-3 text-sm text-gray-600 transition-colors hover:border-gray-500 hover:text-gray-900"
            >
              <Plus aria-hidden className="size-3.5" /> {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
