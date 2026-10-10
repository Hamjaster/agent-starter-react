'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileText, X } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { EXTRACT_LIMITS, fileProblem } from '@/lib/extract';

/** Photos and PDFs picked for reading, with previews and the limits enforced up front. */
export function useAttachments() {
  const [files, setFiles] = useState<File[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  const previews = useMemo(
    () => files.map((f) => (f.type.startsWith('image/') ? URL.createObjectURL(f) : null)),
    [files]
  );
  useEffect(() => () => previews.forEach((u) => u && URL.revokeObjectURL(u)), [previews]);

  const add = (list: FileList | File[] | null) => {
    if (!list) return;
    const next = [...files];
    let issue: string | null = null;
    for (const f of Array.from(list)) {
      const p = fileProblem(f);
      if (p) issue = p;
      else if (next.length >= EXTRACT_LIMITS.files)
        issue = `Up to ${EXTRACT_LIMITS.files} files at a time.`;
      else if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
    }
    setFiles(next);
    setProblem(issue);
  };
  const remove = (i: number) => {
    setFiles((cur) => cur.filter((_, k) => k !== i));
    setProblem(null);
  };
  const clear = () => {
    setFiles([]);
    setProblem(null);
  };

  return { files, previews, problem, add, remove, clear };
}

export function AttachmentList({
  files,
  previews,
  onRemove,
  reading = false,
}: {
  files: File[];
  previews: (string | null)[];
  onRemove?: (i: number) => void;
  reading?: boolean;
}) {
  const reduce = useReducedMotion();
  if (!files.length) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {files.map((f, i) => (
        <li
          key={`${f.name}-${f.size}`}
          className="relative flex max-w-full items-center gap-3 overflow-hidden rounded-xl border border-gray-200 bg-white p-2 pr-3"
        >
          <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-gray-100">
            {previews[i] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previews[i]!} alt="" className="size-full object-cover" />
            ) : (
              <FileText aria-hidden className="size-5 text-gray-500" />
            )}
            {reading && !reduce && (
              <span aria-hidden className="absolute inset-x-0 top-0 h-full">
                <span className="animate-scan bg-brand-3 block h-0.5 w-full shadow-[0_0_12px_2px_rgb(77_92_90/0.5)]" />
              </span>
            )}
          </span>
          <span className="min-w-0">
            <span className="block max-w-[12rem] truncate text-sm text-gray-900">{f.name}</span>
            <span className="block text-xs text-gray-500">
              {reading ? 'Reading…' : `${Math.max(1, Math.round(f.size / 1024))} KB`}
            </span>
          </span>
          {onRemove && !reading && (
            <button
              type="button"
              onClick={() => onRemove(i)}
              aria-label={`Remove ${f.name}`}
              className="grid size-9 shrink-0 place-items-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            >
              <X aria-hidden className="size-4" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
