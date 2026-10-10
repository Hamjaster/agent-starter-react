'use client';

import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, Video } from 'lucide-react';
import { motion } from 'motion/react';
import { EASE_OUT, PageSkeleton, rise } from '@/components/saathi/motion';
import { AppHeader } from '@/components/saathi/ui';
import { Wordmark } from '@/components/saathi/wordmark';
import { RELATION_LABELS, firstName } from '@/lib/brief';
import { cn } from '@/lib/cn';
import { peekPendingConcern, takePendingConcern } from '@/lib/pending-concern';
import {
  type Consult,
  type Profile,
  actions,
  emptyIntake,
  useHydrated,
  useSaathi,
} from '@/lib/saathi-store';
import { IntakeFlow } from './intake-flow';
import { Onboarding } from './onboarding';
import { ProfileForm } from './profile-form';

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
        <Onboarding
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
        <IntakeFlow key={active.id} profile={active} intake={intake} carried={carried} />
        <motion.aside {...rise(0.35)} className="flex flex-col gap-6">
          {mode === 'edit' ? (
            <div className={cn(card, 'p-5 sm:p-6')}>
              <h2 className="font-display tracking-display-sm mb-6 text-2xl text-gray-900">
                Edit {firstName(active.name)}
              </h2>
              <ProfileForm
                initial={active}
                submitLabel="Save changes"
                onDone={() => setMode('view')}
                onCancel={() => setMode('view')}
              />
            </div>
          ) : (
            <ProfileCard profile={active} onEdit={() => setMode('edit')} />
          )}
          <History consults={consults} />
        </motion.aside>
      </div>
    </Shell>
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
              'relative shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-colors',
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
            <span className="relative">{firstName(p.name)}</span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={onAdd}
        className="grid size-8 shrink-0 place-items-center rounded-full text-gray-500 transition-colors hover:bg-white hover:text-gray-900"
        aria-label="Add a family member"
        title="Add a family member"
      >
        <Plus className="size-4" />
      </button>
    </nav>
  );
}

/* ───────────────────────── Profile card ───────────────────────── */

function ProfileCard({ profile, onEdit }: { profile: Profile; onEdit: () => void }) {
  const meta = [
    RELATION_LABELS[profile.relation],
    profile.age && `${profile.age} yrs`,
    profile.sex && profile.sex[0].toUpperCase() + profile.sex.slice(1),
  ].filter(Boolean);
  const rows = [
    { label: 'Conditions', value: profile.conditions },
    { label: 'Medicines', value: profile.medications },
    { label: 'Allergies', value: profile.allergies },
  ];

  return (
    <div className={cn(card, 'overflow-hidden shadow-sm')}>
      <div className="bg-brand relative overflow-hidden p-6 text-white">
        <div
          aria-hidden
          className="absolute -top-16 -right-16 size-48 rounded-full bg-[radial-gradient(circle,rgb(255_255_255/0.12),transparent_65%)]"
        />
        <p className="relative text-sm text-gray-300">Health profile</p>
        <p className="font-display tracking-display-sm relative mt-2 text-3xl leading-none">
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
            <dt className="text-gray-500">{r.label}</dt>
            <dd className={r.value.trim() ? 'text-gray-900' : 'text-gray-400'}>
              {r.value.trim() || 'None added'}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
        >
          <Pencil className="size-3.5" /> Edit profile
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Delete ${profile.name}'s profile? This can’t be undone.`)) {
              actions.removeProfile(profile.id);
            }
          }}
          className="hover:bg-danger-soft hover:text-danger inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500"
        >
          <Trash2 className="size-3.5" /> Delete
        </button>
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
        <p className="mt-3 text-sm leading-relaxed text-gray-500">
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
              <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1.5">
                  {c.channel === 'video' ? (
                    <Video className="size-3.5" />
                  ) : (
                    <span className="bg-wa size-1.5 rounded-full" />
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
              <p className="mt-2 text-xs text-gray-400 tabular-nums">{c.ref}</p>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
