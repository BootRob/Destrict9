# destrict9: Joiner Companion

**Team:** destrict9
**Hackathon:** [LaunchPad '26](https://mwlaunchpad.com), Lloyds Banking Group, Leeds

A mobile-first companion app that takes a new joiner from **offer to "connected and confident"**, in five phases that run to Day 90. It also gives the recruiter and hiring manager the tools to make that happen. All data is synthetic.

## Which part of the challenge this tackles

Workday records the joining process, but nobody guides the joiner through it. We built the guidance layer: one journey in five phases, each with what to do now, its guides and short videos.

| # | Phase | What the app does | Status |
|---|---|---|---|
| 1 | **Offer** *(Saddling up)* | The recruiter onboards a successful candidate, who gets a conditional offer by email and activates their account. They accept or decline the offer, send their screening details to the screening company, and see a calm "no news is normal" view while the checks run. | Works end to end |
| 2 | **Getting ready** *(Joining the stable)* | Accepting the unconditional offer unlocks a chat with their hiring manager, a laptop choice (MacBook or HP, recommended by role), their Day 1 details and the pre-start training. Their manager works through a Day 1 checklist. | Works end to end |
| 3 | **First 30 days** *(Finding your stride)* | A week-by-week plan, LBG systems and jargon, mandatory training, and the 30-day check-in. | Works end to end |
| 4 | **30 to 60 days** *(Setting your course)* | Agreeing goals and a development plan. | Preview: content, no tracking yet |
| 5 | **60 to 90 days and beyond** *(Full horsepower)* | Growing a Lloyds career: mentoring, networks, internal moves. | Preview: content, no tracking yet |

After login, a short welcome screen shows the recruit's pass card, their phase and one tip for it. The home screen has a five-part phase tracker; each phase opens a phase screen (`/joiner/phase.html`) with what to do now, the phase's guides, and videos chosen for their phase, role and city.

Side quests we took on:

- **Always-on chatbot grounded in synthetic policies.** The onboarding assistant answers only from 19 fictional guides. It gives the answer first, in about 60 words, lists the documents it used, and hands off to the right person ("Ask Jordan") when it can't answer. Recruiters and managers edit the guides in the app.
- **Manager's view.** The Day 1 checklist.
- **Event-driven unlocks.** Each step unlocks the next, and every screen updates live.
- **Immersion.** Official Lloyds Banking Group videos (the Leeds office, colleagues in the recruit's field), shown by phase, role and city.

We left out the buddy side, and "when plans change" beyond declined and not-clear outcomes.

## How to run it

Needs Node 22.13 or later. Nothing native to compile.

```bash
cd app
npm install
npm start          # http://localhost:3000
```

Log in with any demo account. The password for all of them is `demo1234`:

| Account | Role |
|---|---|
| `jordan.ellis@example.com` | Recruiter. Start here: open **Applicants** and onboard a candidate. |
| `priya.shah@example.com` | Recruit in phase 1 (Offer), waiting for her screening result. |
| `alex.kim@example.com` | Recruit in phase 2 (Getting ready), offer accepted. Best on a phone, or in browser device mode (F12, then Ctrl+Shift+M). |
| `ruby.ahmed@example.com` | Recruit on Day 12 (phase 3, First 30 days). |
| `tom.bennett@example.com` | Recruit on Day 45 (phase 4, 30 to 60 days). |
| `sam.reid@example.com` | Hiring manager, with the Day 1 checklist. |

To see both sides at once, log in as the recruit in one window and as a staff member in a private window. To see the whole journey from the start, onboard a successful candidate such as Ben Carter as Jordan, then open the **demo mailbox** (`/mailbox.html`) to read the offer email and activate the account.

**On a phone:** the app is a plain web app. Run it on a laptop and open `http://<the laptop's IP address>:3000` from a phone on the same network.

The full list of accounts, the journey step by step, the API and the design choices are in [`app/README.md`](app/README.md).

### The assistant

It works with no setup: without a model it quotes the best-matching guide section and offers the recruiter. With a model, it puts the answer first in about 60 words, with light formatting (bold and bullets). To get model-written answers, copy `app/.env.example` to `app/.env`, then either set `ANTHROPIC_API_KEY` or log in to the Claude Code CLI on the server. `ASSISTANT_PROVIDER` chooses the backend. The default model is Claude Opus; `ASSISTANT_MODEL=claude-haiku-5-5` is slightly faster (in our test through the CLI, 5.0 s against 5.9 s per answer). The `.env` file is ignored by git, and no key is committed.

### Tests

```bash
cd app
npm test
```

About 110 end-to-end checks cover login and roles, chat privacy and live delivery, and the full recruiter-to-recruit journey including the declined and not-clear paths. Each suite runs on a throwaway database, so it needs no setup.

## What is real and what is simulated

| Real | Simulated |
|---|---|
| Accounts, login (httpOnly session cookie, hashed passwords), and role-based access | Email. Messages go to a demo mailbox page instead of being sent. |
| Live chat over WebSockets, stored in SQLite | ClearPath, the screening company. `/clearpath.html` is a labelled stand-in, and the app never collects screening details. |
| The journey state machine: every step checks the current stage, so steps can't be skipped or repeated | Pre-start training. Its status comes from seed data. |
| The grounded assistant and the guide editor | Everyone and everything in the data: names, offers, salaries and policies are made up. The 19 guides are fictional. |
| Phases 1 to 3, end to end. The phase and tracker follow the start date | Phases 4 and 5 are content-rich previews: guides, what to do and videos, but no goal tracking or reviews. Ruby (Day 12) and Tom (Day 45) are seeded relative to today. |
| The videos are official Lloyds Banking Group uploads, embedded from `youtube-nocookie.com` and loaded only when tapped | |

## Stack

Node.js with Express, Socket.IO and the built-in `node:sqlite`. The front end is plain HTML, CSS and JavaScript, with no build step. It is styled with the team's `lbg-style` skill. The assistant uses the Claude API through `@anthropic-ai/sdk`.

## Repo layout

- `app/`: the application, its guides (`app/knowledge/`) and its tests (`app/test/`)
- `mockups/` and `ideas.md`: early design work and ideas
- The remaining files are the hackathon's own instructions.
