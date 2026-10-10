'use client';

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LocalVideoTrack, TokenSource, Track } from 'livekit-client';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Camera,
  CameraOff,
  Check,
  Copy,
  Mic,
  MicOff,
  PhoneOff,
  SwitchCamera,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  type ReceivedMessage,
  RoomAudioRenderer,
  SessionProvider,
  StartAudio,
  VideoTrack,
  useAgent,
  useSession,
  useSessionContext,
  useSessionMessages,
  useTrackToggle,
  useTrackVolume,
} from '@livekit/components-react';
import { buttonClass } from '@/components/saathi/button';
import {
  AmbientBg,
  AnimatedText,
  EASE_OUT,
  PageSkeleton,
  Viewfinder,
  rise,
} from '@/components/saathi/motion';
import type { AvatarDrive, AvatarMood } from '@/components/saathi/three/types';
import { AppHeader } from '@/components/saathi/ui';
import { Wordmark } from '@/components/saathi/wordmark';
import { EMERGENCY_LINE, buildBrief, buildGuestBrief, firstName } from '@/lib/brief';
import { cn } from '@/lib/cn';
import { peekPendingConcern, takePendingConcern } from '@/lib/pending-concern';
import {
  type Intake,
  type Profile,
  actions,
  emptyIntake,
  newRef,
  useHydrated,
  useSaathi,
} from '@/lib/saathi-store';

const AvatarStage = dynamic(() => import('@/components/saathi/three/avatar-stage'), {
  ssr: false,
  loading: () => null,
});

/** Stand-in profile for a visitor who starts a consult from the home page without one. */
const GUEST: Profile = {
  id: 'guest',
  name: '',
  relation: 'self',
  age: '',
  sex: '',
  phone: '',
  conditions: '',
  medications: '',
  allergies: '',
};

export function VideoConsult({ agentName }: { agentName?: string }) {
  const hydrated = useHydrated();
  const state = useSaathi();
  const profile = state.profiles.find((p) => p.id === state.activeId) ?? state.profiles[0];
  const intake = profile ? state.intakes[profile.id] : undefined;
  const hasNotes = !!intake && intake.concern.trim().length >= 3;
  // What was typed in the home page box: today's concern for a profile, or a guest's brief.
  const pending = hydrated ? peekPendingConcern() : null;

  useEffect(() => {
    if (!hydrated || !profile || hasNotes) return;
    const text = takePendingConcern();
    if (text) actions.updateIntake(profile.id, { concern: text });
  }, [hydrated, profile, hasNotes]);

  // Wait for the store (and for a pending concern to land) before freezing the brief.
  if (!hydrated || (profile && !hasNotes && pending)) return <PageSkeleton />;

  if (!profile) {
    return (
      <ConsultSession
        guest
        profile={GUEST}
        intake={{ ...emptyIntake(), concern: pending ?? '' }}
        agentName={agentName}
      />
    );
  }
  return (
    <ConsultSession profile={profile} intake={intake ?? emptyIntake()} agentName={agentName} />
  );
}

function ConsultSession({
  profile,
  intake: stored,
  guest = false,
  agentName,
}: {
  profile: Profile;
  intake: Intake;
  guest?: boolean;
  agentName?: string;
}) {
  const tokenSource = useMemo(() => TokenSource.endpoint('/api/token'), []);
  // A guest's token lives only for this consult; a profile's is kept in the store.
  const [guestRef] = useState(() => (guest ? newRef() : ''));
  const intake = guest ? { ...stored, ref: guestRef } : stored;
  // Freeze the brief at mount so typing elsewhere can't change it mid-call.
  const [brief] = useState(() =>
    guest ? buildGuestBrief(intake.concern, guestRef) : buildBrief(profile, intake)
  );
  const session = useSession(tokenSource, {
    // Only pass agentName when it's set. livekit-client copies every key it's given, and an
    // undefined agentName can't be encoded, so the token request fails before it's sent.
    ...(agentName ? { agentName } : {}),
    participantName: profile.name || 'Guest',
    participantAttributes: { 'saathi.brief': brief, 'saathi.ref': intake.ref },
    agentConnectTimeoutMilliseconds: 25_000,
  });

  return (
    <SessionProvider session={session}>
      <Stage profile={profile} intake={intake} guest={guest} />
      <RoomAudioRenderer />
    </SessionProvider>
  );
}

type Phase = 'ready' | 'live' | 'ended';

function Stage({ profile, intake, guest }: { profile: Profile; intake: Intake; guest: boolean }) {
  const session = useSessionContext();
  const agent = useAgent();
  // One subscription for the whole consult: captions, transcript and the ended recap read it.
  const chat = useSessionMessages(session);
  const [phase, setPhase] = useState<Phase>('ready');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setError(null);
    setStarting(true);
    try {
      if (!guest) actions.ensureRef(profile.id);
      await session.start({
        tracks: { microphone: { enabled: true }, camera: { enabled: true } },
      });
      if (!guest) actions.logConsult(profile.id, 'video');
      setPhase('live');
    } catch (e) {
      setError(
        e instanceof Error && /permission|denied|notallowed/i.test(e.message + e.name)
          ? 'doctor.ai needs your camera and microphone. Allow them in your browser settings, then try again.'
          : 'The consult could not start. Check your connection and try again.'
      );
    } finally {
      setStarting(false);
    }
  };

  const end = async () => {
    await session.end();
    setPhase('ended');
  };

  // Agent never joined, or dropped: end the call and say so.
  useEffect(() => {
    if (phase === 'live' && agent.state === 'failed') {
      setError(
        'doctor.ai couldn’t join the call. Try again in a minute.' +
          (process.env.NODE_ENV !== 'production'
            ? ` (${agent.failureReasons?.join('; ') || 'agent did not connect'}. Is the agent worker running? cd agent && uv run agent.py dev)`
            : '')
      );
      session.end();
      setPhase('ready');
    }
  }, [phase, agent.state, agent.failureReasons, session]);

  if (phase === 'ended') {
    return <Ended profile={profile} intake={intake} guest={guest} messages={chat.messages} />;
  }
  if (phase === 'ready' || !session.isConnected) {
    return (
      <Lobby
        profile={profile}
        intake={intake}
        guest={guest}
        starting={starting || phase === 'live'}
        error={error}
        onStart={start}
      />
    );
  }
  return <Live profile={profile} intake={intake} chat={chat} onEnd={end} />;
}

/* ───────────────────────── Lobby ───────────────────────── */

function Lobby({
  profile,
  intake,
  guest,
  starting,
  error,
  onStart,
}: {
  profile: Profile;
  intake: Intake;
  guest: boolean;
  starting: boolean;
  error: string | null;
  onStart: () => void;
}) {
  const drive = useRef<AvatarDrive>({ level: 0, mood: 'idle', synthetic: true });
  return (
    <div className="to-mist-2 min-h-svh bg-gradient-to-b from-white">
      <AppHeader>
        <Wordmark />
        <Link
          href={guest ? '/' : '/consult'}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="size-4" /> Back
        </Link>
      </AppHeader>
      <main className="mx-auto grid max-w-6xl items-center gap-6 px-6 pt-6 pb-16 md:px-12 lg:grid-cols-[1fr_0.9fr]">
        <div className="order-2 lg:order-1">
          <AnimatedText
            as="h1"
            text="doctor.ai will see what your camera sees."
            className="font-display tracking-display text-4xl leading-[1.05] text-gray-900 md:text-6xl"
          />
          <ul className="mt-8 flex flex-col gap-3 text-gray-700">
            {[
              'Sit near a window or a bright light. Daylight shows colour best.',
              'Keep any medicines or reports you want to ask about within reach.',
              guest
                ? intake.concern.trim()
                  ? 'doctor.ai has read what you typed, so you can start from there.'
                  : 'When doctor.ai says hello, tell it what’s wrong in your own words.'
                : `doctor.ai has read ${
                    profile.relation === 'self' ? 'your' : `${firstName(profile.name)}’s`
                  } notes, so you can start with what’s changed.`,
            ].map((t, i) => (
              <motion.li
                key={t}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.5 + i * 0.1 }}
                className="flex gap-3"
              >
                <span className="bg-brand mt-2 size-1.5 shrink-0 rounded-full" />
                {t}
              </motion.li>
            ))}
          </ul>
          {error && (
            <p
              role="alert"
              className="mt-8 rounded-xl border border-gray-300 bg-white px-5 py-4 text-sm leading-relaxed text-gray-900"
            >
              {error}
            </p>
          )}
          <motion.button
            type="button"
            onClick={onStart}
            disabled={starting}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.9 }}
            className={buttonClass({ size: 'lg' }, 'mt-10 w-full sm:w-auto')}
          >
            <Camera className="size-5" />
            {starting ? 'Connecting…' : 'Start video consult'}
          </motion.button>
          <p className="mt-5 text-xs leading-relaxed text-gray-500">
            Token {intake.ref}. Your browser will ask for camera and microphone access. doctor.ai is
            an AI, not a doctor who can examine you.
          </p>
          {guest && (
            <p className="mt-3 text-sm text-gray-600">
              Want doctor.ai to know your medicines and allergies first?{' '}
              <Link
                href="/dashboard"
                className="font-medium text-gray-900 underline underline-offset-4"
              >
                Set up a health profile
              </Link>
            </p>
          )}
        </div>
        <div className="relative order-1 h-[38svh] min-h-[260px] lg:order-2 lg:h-[min(70vh,640px)]">
          <AvatarStage
            drive={drive}
            framing="call"
            onPoke={() => (drive.current.waveAt = performance.now())}
            className="absolute inset-0 [mask-image:linear-gradient(to_bottom,black_75%,transparent)]"
          />
        </div>
      </main>
    </div>
  );
}

/* ───────────────────────── Live ───────────────────────── */

const STATE_LABEL: Record<string, string> = {
  connecting: 'doctor.ai is joining',
  initializing: 'doctor.ai is joining',
  'pre-connect-buffering': 'doctor.ai is joining',
  idle: 'doctor.ai is joining',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
  disconnected: 'Call ended',
  failed: 'doctor.ai couldn’t join',
};

const glass = 'bg-white/[0.06] ring-1 ring-white/10 backdrop-blur-xl';

type SessionChat = ReturnType<typeof useSessionMessages>;

function Live({
  profile,
  intake,
  chat,
  onEnd,
}: {
  profile: Profile;
  intake: Intake;
  chat: SessionChat;
  onEnd: () => void;
}) {
  const session = useSessionContext();
  const cameraRef = session.local.cameraTrack;
  const cam = useTrackToggle({ source: Track.Source.Camera });
  const mic = useTrackToggle({ source: Track.Source.Microphone });
  const micLevel = useTrackVolume(session.local.microphoneTrack);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const cameraOn = cam.enabled && !!cameraRef && !cameraRef.publication?.isMuted;

  const flip = async () => {
    const track = cameraRef?.publication?.track;
    if (!(track instanceof LocalVideoTrack)) return;
    const next = facing === 'user' ? 'environment' : 'user';
    try {
      await track.restartTrack({ facingMode: next });
      setFacing(next);
    } catch {
      // Devices with one camera reject the switch; nothing to do.
    }
  };

  return (
    <div className="bg-brand relative isolate flex h-svh flex-col overflow-hidden text-white">
      <AmbientBg className="-z-10" />
      <h1 className="sr-only">Video consult with doctor.ai</h1>

      <header className="flex shrink-0 items-center justify-between gap-4 px-4 py-3 sm:px-5 lg:px-6 lg:py-4">
        <div className="flex items-center gap-3">
          <span className="font-display tracking-display-sm text-2xl leading-none font-bold">
            doctor<span className="text-white/55">.ai</span>
          </span>
          <LiveBadge />
        </div>
        <p className="flex items-center gap-3 text-xs text-white/55">
          <span className="hidden sm:inline">An AI, not a doctor who can examine you</span>
          {intake.ref && (
            <span className={cn(glass, 'rounded-full px-3 py-1.5 text-white/80 tabular-nums')}>
              {intake.ref}
            </span>
          )}
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3 sm:px-4 sm:pb-4 lg:grid lg:grid-cols-[1fr_400px] lg:gap-4 lg:px-5 lg:pb-5">
        {/* What doctor.ai sees */}
        <motion.section
          aria-label="Your camera"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: EASE_OUT }}
          className="bg-brand-ink relative min-h-0 flex-1 overflow-hidden rounded-[28px] shadow-[0_40px_80px_-40px_rgb(0_0_0/0.7)] ring-1 ring-white/10"
        >
          {cameraOn && cameraRef ? (
            <VideoTrack
              trackRef={cameraRef}
              className={cn('h-full w-full object-cover', facing === 'user' && '-scale-x-100')}
            />
          ) : (
            <div className="grid h-full place-items-center p-8 pb-24 text-center sm:pb-8">
              <div>
                <span
                  className={cn(
                    glass,
                    'mx-auto grid size-12 place-items-center rounded-full sm:size-16'
                  )}
                >
                  <CameraOff className="size-6 text-white/70" />
                </span>
                <p className="font-display tracking-display-sm mt-4 text-xl sm:mt-5 sm:text-2xl">
                  Your camera is off.
                </p>
                <p className="mt-1.5 text-sm text-white/55">
                  Turn it on to show doctor.ai the problem.
                </p>
                <button
                  type="button"
                  onClick={() => cam.toggle()}
                  disabled={cam.pending}
                  className={buttonClass(
                    { variant: 'inverse', size: 'sm' },
                    'mt-6 hidden sm:inline-flex'
                  )}
                >
                  <Camera className="size-4" /> Turn camera on
                </button>
              </div>
            </div>
          )}

          {/* Scrims keep the overlays legible on bright video. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/45 to-transparent"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/65 to-transparent"
          />
          <Viewfinder
            scanning={cameraOn}
            className="inset-x-6 top-16 bottom-6 sm:inset-x-10 sm:bottom-10"
          />

          <p
            className={cn(
              glass,
              'absolute top-4 left-4 inline-flex items-center gap-2 rounded-full bg-black/30 px-3 py-1.5 text-xs font-medium'
            )}
          >
            <span className="size-1.5 rounded-full bg-white" />
            What doctor.ai sees
            {facing === 'environment' && <span className="text-white/55">· Back camera</span>}
          </p>

          <Captions messages={chat.messages} />

          {/* Controls dock */}
          <div className="absolute inset-x-0 bottom-4 flex justify-center px-4 sm:bottom-5">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.3 }}
              className={cn(
                glass,
                'flex items-center gap-1.5 rounded-full bg-black/35 p-1.5 sm:gap-2 sm:p-2'
              )}
            >
              <ControlButton
                label={mic.enabled ? 'Mute microphone' : 'Unmute microphone'}
                active={mic.enabled}
                pending={mic.pending}
                level={mic.enabled ? micLevel : 0}
                onClick={() => mic.toggle()}
              >
                {mic.enabled ? <Mic className="size-5" /> : <MicOff className="size-5" />}
              </ControlButton>
              <ControlButton
                label={cam.enabled ? 'Turn camera off' : 'Turn camera on'}
                active={cam.enabled}
                pending={cam.pending}
                onClick={() => cam.toggle()}
              >
                {cam.enabled ? <Camera className="size-5" /> : <CameraOff className="size-5" />}
              </ControlButton>
              <ControlButton label="Switch camera" active onClick={flip} disabled={!cameraOn}>
                <SwitchCamera className="size-5" />
              </ControlButton>
              <span aria-hidden className="mx-1 h-7 w-px bg-white/15" />
              <button
                type="button"
                onClick={onEnd}
                className="bg-danger inline-flex h-11 items-center gap-2 rounded-full px-4 font-medium text-white shadow-[0_10px_30px_-10px_rgb(194_65_45/0.8)] transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-110 sm:h-12 sm:px-5"
              >
                <PhoneOff className="size-5" /> End
              </button>
            </motion.div>
          </div>
        </motion.section>

        {/* doctor.ai + transcript */}
        <motion.aside
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.15 }}
          className={cn(
            glass,
            'flex max-h-[44svh] min-h-0 flex-col overflow-hidden rounded-[28px] lg:max-h-none'
          )}
        >
          <Presence />
          <Transcript patientName={firstName(profile.name) || 'You'} chat={chat} />
        </motion.aside>
      </div>

      <StartAudio
        label="Tap to hear doctor.ai"
        className="fixed inset-x-0 bottom-28 z-20 mx-auto w-fit rounded-full bg-white px-5 py-3 font-medium text-gray-900 shadow-2xl shadow-black/40"
      />
    </div>
  );
}

/** "Live" with a running call clock. */
function LiveBadge() {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.floor((now - startedAt) / 1000);
  const clock = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <span
      className={cn(
        glass,
        'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium tabular-nums'
      )}
    >
      <span className="relative flex size-2">
        <span className="absolute inset-0 animate-ping rounded-full bg-white opacity-50" />
        <span className="relative size-2 rounded-full bg-white" />
      </span>
      Live <span className="text-white/55">{clock}</span>
    </span>
  );
}

function ControlButton({
  label,
  active,
  pending,
  disabled,
  level = 0,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  pending?: boolean;
  disabled?: boolean;
  /** 0..1 input level; draws a ring that swells while the patient talks. */
  level?: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled || pending}
      whileTap={{ scale: 0.92 }}
      className={cn(
        'relative grid size-11 place-items-center rounded-full transition-colors disabled:opacity-40 sm:size-12',
        active ? 'bg-white/10 hover:bg-white/20' : 'bg-white text-gray-900 hover:bg-gray-100'
      )}
    >
      {level > 0.02 && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/50 transition-transform duration-100"
          style={{ transform: `scale(${1 + Math.min(level, 1) * 0.35})`, opacity: 0.4 + level }}
        />
      )}
      {children}
    </motion.button>
  );
}

/** The end of a long line, so live captions stay at most a few lines tall. */
function captionTail(text: string, max = 150) {
  const plain = text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(-max);
  return `…${cut.slice(cut.indexOf(' ') + 1)}`;
}

/** Subtitles over the video while doctor.ai speaks, in the hero's caption style. */
function Captions({ messages }: { messages: ReceivedMessage[] }) {
  const agent = useAgent();
  const reduce = useReducedMotion();
  const last = messages.findLast((m) => m.type === 'agentTranscript');
  const show = agent.state === 'speaking' && !!last?.message.trim();

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center px-6 sm:bottom-28"
    >
      <AnimatePresence mode="wait">
        {show && last && (
          <motion.p
            key={last.id}
            initial={reduce ? false : { opacity: 0, y: 10, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={reduce ? undefined : { opacity: 0, y: -8, filter: 'blur(6px)' }}
            transition={{ duration: 0.45, ease: EASE_OUT }}
            className="font-display max-w-2xl text-center text-xl leading-snug text-white [text-shadow:0_2px_18px_rgb(0_0_0/0.6)] md:text-2xl"
          >
            {captionTail(last.message)}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

const AGENT_MOOD: Record<string, AvatarMood> = {
  listening: 'listening',
  thinking: 'thinking',
  speaking: 'speaking',
};

/** doctor.ai's face for the call: the rigged avatar, driven by the agent's state and voice. */
function Presence() {
  const agent = useAgent();
  const volume = useTrackVolume(agent.microphoneTrack);
  const drive = useRef<AvatarDrive>({ level: 0, mood: 'idle' });
  const label = STATE_LABEL[agent.state] ?? agent.state;
  const joining = !agent.isConnected;

  useEffect(() => {
    drive.current.mood = AGENT_MOOD[agent.state] ?? 'idle';
  }, [agent.state]);
  useEffect(() => {
    drive.current.level = volume;
  }, [volume]);
  // Wave hello once doctor.ai has joined.
  useEffect(() => {
    if (!joining) drive.current.waveAt = performance.now();
  }, [joining]);

  return (
    <div className="flex items-center gap-4 border-b border-white/10 p-3 lg:flex-col lg:items-stretch lg:p-4">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/0 ring-1 ring-white/10 lg:h-64 lg:w-full lg:rounded-[22px]">
        {/* Halo that breathes with doctor.ai's voice */}
        <div
          aria-hidden
          className="absolute inset-0 transition-[transform,opacity] duration-150"
          style={{
            transform: `scale(${1 + Math.min(volume, 1) * 0.25})`,
            opacity: 0.55 + Math.min(volume, 1) * 0.45,
          }}
        >
          <div className="absolute inset-x-[10%] top-[8%] aspect-square rounded-full bg-[radial-gradient(closest-side,rgb(122_158_150/0.45),transparent)]" />
        </div>
        <AvatarStage drive={drive} framing="call" className="absolute inset-0" />
        <span className="absolute bottom-3 left-3 hidden rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-medium text-white/80 backdrop-blur lg:inline">
          AI doctor
        </span>
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3 lg:px-1 lg:pt-1">
        <div className="min-w-0">
          <p className="font-display tracking-display-sm text-2xl leading-none">doctor.ai</p>
          <p
            className={cn(
              'mt-2 flex items-center gap-2 text-sm text-white/65',
              joining && 'animate-pulse'
            )}
          >
            <StateGlyph state={agent.state} level={volume} />
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}

/** A small live sign for what doctor.ai is doing: bars when speaking, dots when thinking. */
function StateGlyph({ state, level }: { state: string; level: number }) {
  const reduce = useReducedMotion();
  if (state === 'speaking') {
    return (
      <span aria-hidden className="flex h-3.5 items-center gap-[3px]">
        {[0.6, 1, 0.75, 0.45].map((k, i) => (
          <span
            key={i}
            className="w-[3px] rounded-full bg-white transition-[height] duration-100"
            style={{ height: `${Math.max(3, Math.min(14, 3 + level * 22 * k))}px` }}
          />
        ))}
      </span>
    );
  }
  if (state === 'thinking') {
    return (
      <span aria-hidden className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="size-1 rounded-full bg-white"
            animate={reduce ? undefined : { opacity: [0.25, 1, 0.25] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
          />
        ))}
      </span>
    );
  }
  if (state === 'listening') {
    return (
      <span aria-hidden className="relative flex size-2">
        <span className="absolute inset-0 animate-ping rounded-full bg-white opacity-40" />
        <span className="relative size-2 rounded-full bg-white" />
      </span>
    );
  }
  return <span aria-hidden className="size-2 rounded-full bg-white/40" />;
}

// doctor.ai posts its sources as Markdown links in the chat. Render those, and bare
// http(s) URLs, as links; everything else stays plain text.
const LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)]+)/g;

function AgentText({ text }: { text: string }) {
  const plain = text.replace(/\*\*(.+?)\*\*/g, '$1');
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of plain.matchAll(LINK_PATTERN)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(plain.slice(last, index));
    const href = match[2] ?? match[3];
    parts.push(
      <a
        key={index}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-white/40 underline-offset-2 hover:decoration-white"
      >
        {match[1] ?? href}
      </a>
    );
    last = index + match[0].length;
  }
  if (last < plain.length) parts.push(plain.slice(last));
  return <span className="whitespace-pre-line text-white">{parts}</span>;
}

function Transcript({ patientName, chat }: { patientName: string; chat: SessionChat }) {
  const { messages, send, isSending } = chat;
  const agent = useAgent();
  // Screen readers hear each reply once it's finished, not every streamed word.
  const [announce, setAnnounce] = useState('');
  const lastState = useRef(agent.state);
  useEffect(() => {
    if (lastState.current === 'speaking' && agent.state !== 'speaking') {
      const last = messages.findLast((m) => m.from?.isLocal !== true);
      if (last) setAnnounce(`doctor.ai: ${plain(last.message)}`);
    }
    lastState.current = agent.state;
  }, [agent.state, messages]);
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const thinking = agent.state === 'thinking';

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages, thinking]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
      <div
        className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-5"
        data-lenis-prevent
      >
        {messages.length === 0 ? (
          <div className="flex h-full min-h-24 flex-col items-center justify-center text-center">
            <p className="font-display tracking-display-sm text-lg text-white/80">
              Just talk, like on a phone call.
            </p>
            <p className="mt-1 text-sm text-white/65">
              Captions appear here as you and doctor.ai talk.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            <AnimatePresence initial={false}>
              {messages.map((m, i) => {
                const mine = m.from?.isLocal === true;
                const prev = messages[i - 1];
                const first = !prev || (prev.from?.isLocal === true) !== mine;
                return (
                  <motion.li
                    key={m.id}
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.35, ease: EASE_OUT }}
                    className={cn(
                      'flex flex-col',
                      mine ? 'items-end' : 'items-start',
                      first && 'mt-3 first:mt-0'
                    )}
                  >
                    {first && (
                      <span className="mb-1.5 px-1 text-[11px] font-medium tracking-wide text-white/65 uppercase">
                        {mine ? patientName : 'doctor.ai'}
                      </span>
                    )}
                    <div
                      className={cn(
                        'max-w-[88%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed',
                        mine
                          ? 'rounded-tr-md bg-white text-gray-900'
                          : 'rounded-tl-md bg-white/[0.08] ring-1 ring-white/[0.06]',
                        !first && (mine ? 'rounded-tr-2xl' : 'rounded-tl-2xl')
                      )}
                    >
                      {mine ? <span>{m.message}</span> : <AgentText text={m.message} />}
                    </div>
                  </motion.li>
                );
              })}
              {thinking && (
                <motion.li
                  key="thinking"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-1.5 flex"
                  aria-label="doctor.ai is thinking"
                >
                  <span className="flex items-center rounded-2xl rounded-tl-md bg-white/[0.08] px-4 py-3.5 ring-1 ring-white/[0.06]">
                    <StateGlyph state="thinking" level={0} />
                  </span>
                </motion.li>
              )}
            </AnimatePresence>
          </ul>
        )}
        <div ref={endRef} />
      </div>
      <form
        className="p-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const text = draft.trim();
          if (!text) return;
          setDraft('');
          await send(text);
        }}
      >
        <div className="flex items-center gap-2 rounded-full bg-white/[0.07] p-1.5 pl-4 ring-1 ring-white/10 transition-shadow focus-within:ring-white/30">
          <label htmlFor="typed-message" className="sr-only">
            Type a message to doctor.ai
          </label>
          <input
            id="typed-message"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type instead of speaking"
            className="h-10 min-w-0 flex-1 bg-transparent text-base text-white placeholder:text-white/55 focus:outline-none"
          />
          <motion.button
            type="submit"
            aria-label="Send message"
            disabled={!draft.trim() || isSending}
            whileTap={{ scale: 0.9 }}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-gray-900 transition-opacity disabled:opacity-30"
          >
            <ArrowUp className="size-4" />
          </motion.button>
        </div>
      </form>
    </div>
  );
}

/* ───────────────────────── Ended ───────────────────────── */

/** Markdown links and bold to plain text, for the recap and the copied notes. */
function plain(text: string) {
  return text
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1 ($2)')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .trim();
}

function Ended({
  profile,
  intake,
  guest,
  messages,
}: {
  profile: Profile;
  intake: Intake;
  guest: boolean;
  messages: ReceivedMessage[];
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const name = firstName(profile.name);
  const said = messages.filter((m) => m.from?.isLocal !== true && m.message.trim());
  const recap = said.slice(-3);

  const copyNotes = async () => {
    const lines = [`doctor.ai consult ${intake.ref}`];
    if (intake.concern.trim()) lines.push(`Concern: ${intake.concern.trim()}`);
    lines.push('');
    for (const m of messages) {
      if (!m.message.trim()) continue;
      lines.push(`${m.from?.isLocal ? name || 'Me' : 'doctor.ai'}: ${plain(m.message)}`);
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
    } catch {
      // Clipboard blocked: nothing to do, the recap is still on screen.
    }
  };

  return (
    <div className="to-mist min-h-svh bg-gradient-to-b from-white">
      <AppHeader>
        <Wordmark />
      </AppHeader>
      <main className="mx-auto max-w-xl px-6 py-12 md:py-16">
        <AnimatedText
          as="h1"
          text={name ? `Take care, ${name}.` : 'Take care.'}
          className="font-display tracking-display text-4xl leading-[1.05] text-gray-900 md:text-6xl"
        />
        <p className="mt-4 leading-relaxed text-gray-600">
          Your token was <span className="text-gray-900 tabular-nums">{intake.ref}</span>. If things
          get worse, or anything new appears, start another consult.
        </p>

        {recap.length > 0 && (
          <motion.section
            {...rise(0.3)}
            aria-labelledby="recap-title"
            className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <h2 id="recap-title" className="font-display tracking-display-sm text-xl text-gray-900">
              What doctor.ai said last
            </h2>
            <ul className="mt-4 flex flex-col gap-3">
              {recap.map((m) => (
                <li
                  key={m.id}
                  className="rounded-xl bg-gray-50 px-4 py-3 text-[15px] leading-relaxed whitespace-pre-line text-gray-800"
                >
                  {plain(m.message)}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={copyNotes}
              className={buttonClass({ variant: 'outline', size: 'sm' }, 'mt-4')}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? 'Copied' : 'Copy consult notes'}
            </button>
          </motion.section>
        )}

        <motion.p
          {...rise(0.4)}
          className="border-danger/30 bg-danger-soft mt-6 rounded-xl border px-4 py-3 text-sm leading-relaxed text-gray-900"
        >
          If it becomes an emergency, call{' '}
          <a href={`tel:${EMERGENCY_LINE.tel}`} className="font-semibold underline">
            {EMERGENCY_LINE.tel}
          </a>{' '}
          or go to the nearest emergency department.
        </motion.p>

        <motion.div {...rise(0.5)} className="mt-10 flex flex-col gap-3 sm:flex-row">
          {guest ? (
            <>
              <Link href="/dashboard" className={buttonClass({}, 'w-full sm:w-auto')}>
                Save a health profile <ArrowRight className="size-4" />
              </Link>
              <Link href="/" className={buttonClass({ variant: 'outline' }, 'w-full sm:w-auto')}>
                Back to home
              </Link>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  actions.closeIntake(profile.id);
                  router.push('/dashboard');
                }}
                className={buttonClass({}, 'w-full sm:w-auto')}
              >
                Done, back to my dashboard
              </button>
              <Link
                href="/consult"
                className={buttonClass({ variant: 'outline' }, 'w-full sm:w-auto')}
              >
                Continue on WhatsApp
              </Link>
            </>
          )}
        </motion.div>
      </main>
    </div>
  );
}
