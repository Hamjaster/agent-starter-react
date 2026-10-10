# doctor.ai

An AI doctor you can talk to. Patients write down what's wrong once, then hand off to doctor.ai on
WhatsApp or in a video consult in the browser, where a Gemini Live model hears them, sees their
camera, and already has their notes.

doctor.ai is an AI, not a replacement for a doctor who can examine you. Every consult says so, and
emergency signs send patients to emergency care instead.

## What's in the repo

| Path                                 | What it is                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `app/`, `components/saathi/`, `lib/` | The Next.js site: landing page, patient dashboard (profiles, intake), WhatsApp hand-off and the video consult |
| `agent/`                             | The LiveKit agent (Python): Gemini Live with camera input, a clinical prompt and a medical lookup tool        |
| `whatsapp-bot/`                      | A WhatsApp chat doctor on WAHA. See its [README](whatsapp-bot/README.md)                                      |
| `motion/`                            | HyperFrames sources for the product films in `public/videos/`                                                 |
| `scripts/avatar/`                    | Converts the Rocketbox avatar to the GLB used by the 3D doctor                                                |

Patient profiles and notes stay in the browser (localStorage). They only leave the device when
the patient sends them on WhatsApp or starts a video consult, where the notes travel as the
`saathi.brief` participant attribute.

## Run the site

Requires Node 24 and pnpm.

```bash
cp .env.example .env.local   # fill in LIVEKIT_* and SAATHI_WHATSAPP_NUMBER
pnpm install
pnpm dev                     # http://localhost:3000
```

The token endpoint in `app/api/token/route.ts` only runs in development or on Vercel previews.
Add authentication before putting it in production.

## Run the agent

Requires Python 3.12 and [uv](https://docs.astral.sh/uv/).

```bash
cd agent
# agent/.env: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, GOOGLE_API_KEY
uv sync
uv run agent.py dev
```

The agent uses automatic dispatch, so leave `AGENT_NAME` blank in the site's env.

## Checks

```bash
pnpm lint
pnpm format:check
pnpm build
```

## Credits

Built from LiveKit's [agent-starter-react](https://github.com/livekit-examples/agent-starter-react)
(MIT, see `LICENSE`). The 3D doctor is Microsoft Rocketbox `Medical_Male_03` (MIT); see
`public/models/CREDITS.md`.
