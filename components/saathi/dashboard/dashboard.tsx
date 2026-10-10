'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, Pencil, Plus, Trash2, Video } from 'lucide-react';
import { motion } from 'motion/react';
import { PageSkeleton, rise } from '@/components/saathi/motion';
import { AppHeader } from '@/components/saathi/ui';
import { Wordmark } from '@/components/saathi/wordmark';
import { RELATION_LABELS, firstName } from '@/lib/brief';
import { cn } from '@/lib/cn';
import { peekPendingConcern, takePendingConcern } from '@/lib/pending-concern';
import { draftFromProfile, profileFromDraft } from '@/lib/profile-draft';
import {
  type Consult,
  type Profile,
  actions,
  emptyIntake,
  useHydrated,
  useSaathi,
} from '@/lib/saathi-store';
import { IntakeFlow } from './intake-flow';
import { ProfileBuilder } from './profile-builder';
import { ProfileEditor } from './profile-editor';

const card = 'rounded-2xl border border-gray-200 bg-white';

export function Dashboard() {
  const hydrated = useHydrated();
  const state = useSaathi();
  const [mode, setMode] = useState<'view' | 'add' | 'edit'>('view');
  const [carried, setCarried] = useState(false);
  const active = state.profiles.find((p) => p.id === state.activeId) ?? state.profiles[0];

  // Whatever was typed on the home page becomes today's concern once there is a profile.
  useEffect(() => {
    if (!hydrated || !active) return;
    if ((state.intakes[active.id]?.concern ?? '').trim()) return;
    const pending = takePendingConcern();
    if (pending) {
      actions.updateIntake(active.id, { concern: pending });
      setCarried(true);
    }
  }, [hydrated, active, state.intakes]);

  if (!hydrated) return <PageSkeleton />;

  if (!active || mode === 'add') {
    return (
      <Shell>
        <ProfileBuilder
          adding={!!active}
          pending={!active ? peekPendingConcern() : null}
          onDone={() => setMode('view')}
          onCancel={active ? () => setMode('view') : undefined}
        />
      </Shell>
    );
  }

  const intake = state.intakes[active.id] ?? emptyIntake();
  const consults = state.consults.filter((c) => c.profileId === active.id);

  return (
    <Shell
      switcher={
        <ProfileSwitcher
          profiles={state.profiles}
          activeId={active.id}
          onAdd={() => setMode('add')}
        />
      }
    >
      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-10 md:px-12 md:py-14 lg:grid-cols-[1fr_360px] lg:gap-8">
        {mode === 'edit' ? (
          <EditProfile key={active.id} profile={active} onDone={() => setMode('view')} />
        ) : (
          <IntakeFlow key={active.id} profile={active} intake={intake} carried={carried} />
        )}
        <motion.aside {...rise(0.35)} className="flex flex-col gap-6">
          <ProfileCard profile={active} editing={mode === 'edit'} onEdit={() => setMode('edit')} />
          <History consults={consults} />
        </motion.aside>
      </div>
    </Shell>
  );
}

function EditProfile({ profile, onDone }: { profile: Profile; onDone: () => void }) {
  const [draft, setDraft] = useState(() => draftFromProfile(profile));
  const title = useRef<HTMLHeadingElement>(null);
  // On phones the edit button sits below this form; bring the form into view and focus it.
  useEffect(() => {
    title.current?.focus({ preventScroll: true });
    title.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, []);
  return (
    <section aria-labelledby="edit-title" className="scroll-mt-24">
      <h1
        ref={title}
        tabIndex={-1}
        id="edit-title"
        className="font-display tracking-display scroll-mt-24 text-3xl leading-[1.08] text-gray-900 focus:outline-none md:text-[2.6rem]"
      >
        Edit {firstName(profile.name)}’s profile
      </h1>
      <p className="mt-3 max-w-lg leading-relaxed text-gray-600">
        Add a new prescription or report and doctor.ai will add what it finds.
      </p>
      <div className="mt-8">
        <ProfileEditor
          draft={draft}
          onChange={setDraft}
          onSave={() => {
            actions.saveProfile(profileFromDraft(draft));
            onDone();
          }}
          onCancel={onDone}
          saveLabel="Save changes"
        />
      </div>
    </section>
  );
}

function Shell({ children, switcher }: { children: React.ReactNode; switcher?: React.ReactNode }) {
  return (
    <div className="to-mist min-h-svh bg-gradient-to-b from-white">
      <AppHeader>
        <Wordmark />
        {switcher}
      </AppHeader>
      <main>{children}</main>
    </div>
  );
}

function ProfileSwitcher({
  profiles,
  activeId,
  onAdd,
}: {
  profiles: Profile[];
  activeId: string;
  onAdd: () => void;
}) {
  return (
    <nav
      aria-label="Profiles"
      className="-mr-2 flex min-w-0 items-center gap-1 overflow-x-auto rounded-full bg-gray-100 p-1 pr-1"
    >
      {profiles.map((p) => {
        const on = p.id === activeId;
        return (
          <button
            key={p.id}
            type="button"
            aria-current={on ? 'true' : undefined}
            onClick={() => actions.setActive(p.id)}
            className={cn(
              'relative min-h-10 shrink-0 rounded-full px-4 text-sm transition-colors',
              on ? 'text-white' : 'text-gray-600 hover:text-gray-900'
            )}
          >
            {on && (
              <motion.span
                layoutId="profile-pill"
                className="bg-brand absolute inset-0 rounded-full"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative block max-w-[8rem] truncate">{firstName(p.name)}</span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={onAdd}
        className="grid size-10 shrink-0 place-items-center rounded-full text-gray-600 transition-colors hover:bg-white hover:text-gray-900"
        aria-label="Add a family member"
        title="Add a family member"
      >
        <Plus className="size-4" />
      </button>
    </nav>
  );
}

/* ───────────────────────── Profile card ───────────────────────── */

function ProfileCard({
  profile,
  editing,
  onEdit,
}: {
  profile: Profile;
  editing: boolean;
  onEdit: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const meta = [
    RELATION_LABELS[profile.relation],
    profile.age && `${profile.age} yrs`,
    profile.sex && profile.sex[0].toUpperCase() + profile.sex.slice(1),
  ].filter(Boolean);
  const rows = [
    { label: 'Conditions', value: profile.conditions },
    { label: 'Medicines', value: profile.medications },
    { label: 'Allergies', value: profile.allergies },
    ...(profile.history?.trim() ? [{ label: 'Also', value: profile.history }] : []),
  ];
  const docs = profile.documents ?? [];

  return (
    <div className={cn(card, 'overflow-hidden shadow-sm')}>
      <div className="bg-brand relative overflow-hidden p-6 text-white">
        <div
          aria-hidden
          className="absolute -top-16 -right-16 size-48 rounded-full bg-[radial-gradient(circle,rgb(255_255_255/0.12),transparent_65%)]"
        />
        <p className="relative text-sm text-gray-300">Health profile</p>
        <p className="font-display tracking-display-sm relative mt-2 text-3xl leading-none break-words">
          {profile.name}
        </p>
        <p className="relative mt-2 text-sm text-gray-300">{meta.join(' · ')}</p>
        {profile.phone && (
          <p className="relative mt-4 text-sm text-white tabular-nums">{profile.phone}</p>
        )}
      </div>
      <dl className="divide-y divide-gray-100">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[96px_1fr] gap-3 px-6 py-4 text-sm">
            <dt className="text-gray-600">{r.label}</dt>
            <dd className={cn('break-words', r.value.trim() ? 'text-gray-900' : 'text-gray-500')}>
              {r.value.trim() || 'None added'}
            </dd>
          </div>
        ))}
        {docs.length > 0 && (
          <div className="grid grid-cols-[96px_1fr] gap-3 px-6 py-4 text-sm">
            <dt className="text-gray-600">Documents</dt>
            <dd>
              <ul className="flex flex-col gap-1.5">
                {docs.slice(-4).map((d) => (
                  <li key={d.id} className="flex gap-2 text-gray-900">
                    <FileText aria-hidden className="mt-0.5 size-3.5 shrink-0 text-gray-500" />
                    <span className="min-w-0 break-words">
                      {d.title}
                      {d.date && <span className="text-gray-500"> · {d.date}</span>}
                    </span>
                  </li>
                ))}
                {docs.length > 4 && <li className="text-gray-600">and {docs.length - 4} more</li>}
              </ul>
            </dd>
          </div>
        )}
      </dl>
      <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-3 py-2">
        {confirming ? (
          <div role="alert" className="flex w-full flex-wrap items-center justify-between gap-2">
            <p className="px-2 text-sm text-gray-900">Delete this profile for good?</p>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="min-h-11 rounded-lg px-3 text-sm text-gray-700 hover:bg-gray-50"
              >
                Keep
              </button>
              <button
                type="button"
                onClick={() => actions.removeProfile(profile.id)}
                className="bg-danger min-h-11 rounded-lg px-3 text-sm font-medium text-white"
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={onEdit}
              disabled={editing}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:text-gray-500"
            >
              <Pencil aria-hidden className="size-3.5" /> {editing ? 'Editing' : 'Edit profile'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="hover:text-danger inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-gray-600 hover:bg-gray-50"
            >
              <Trash2 aria-hidden className="size-3.5" /> Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── History ───────────────────────── */

const CHANNEL_LABEL: Record<Consult['channel'], string> = {
  'whatsapp-chat': 'WhatsApp notes',
  'whatsapp-call': 'WhatsApp call',
  video: 'Video consult',
};

function History({ consults }: { consults: Consult[] }) {
  return (
    <div className={cn(card, 'p-6 shadow-sm')}>
      <h2 className="font-display tracking-display-sm text-xl text-gray-900">Past consults</h2>
      {consults.length === 0 ? (
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          None yet. Each time you hand off to doctor.ai, it’s listed here with its token number.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {consults.slice(0, 8).map((c, i) => (
            <motion.li
              key={c.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.05 }}
              className="rounded-xl bg-gray-50 p-4"
            >
              <div className="flex items-center justify-between gap-3 text-xs text-gray-600">
                <span className="inline-flex items-center gap-1.5">
                  {c.channel === 'video' ? (
                    <Video aria-hidden className="size-3.5" />
                  ) : (
                    <span aria-hidden className="bg-wa size-1.5 rounded-full" />
                  )}
                  {CHANNEL_LABEL[c.channel]}
                </span>
                <time dateTime={new Date(c.at).toISOString()}>
                  {new Date(c.at).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </time>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-gray-900">{c.concern}</p>
              <p className="mt-2 text-xs text-gray-600 tabular-nums">Token {c.ref}</p>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
