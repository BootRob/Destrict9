# destrict9: Joiner Companion

**Team:** destrict9
**Hackathon:** [LaunchPad '26](https://mwlaunchpad.com), Lloyds Banking Group, Leeds

A mobile-first companion app that takes a new joiner from **unconditional offer to "connected and confident"**. It also gives the recruiter and hiring manager the tools to make that happen. All data is synthetic.

## Which part of the challenge this tackles

Workday records the joining process, but nobody guides the joiner through it. We built the guidance layer, following the brief's six-stage journey:

| Stage in the brief | What the app does |
|---|---|
| Offer | The recruiter onboards a successful candidate. The candidate gets a conditional offer by email and activates their account. They accept or decline the offer, and the screening step follows. |
| Unlock and choose | Accepting the unconditional offer unlocks their hiring-manager chat and a laptop choice (MacBook or HP, with a recommendation by role). |
| Meet your people | Private, live chats with the recruiter and, once unlocked, the hiring manager. Typing indicators, unread badges and read receipts. |
| Manager ready | The manager has a Day 1 checklist with due dates counted back from the start date, Day 1 details to share, and a training reminder. |
| Day 1 to Week 1, Day 30 | A progress bar and countdown to the milestones, driven by the start date. This stage is the lightest part. |

Side quests we took on:

- **Always-on chatbot grounded in synthetic policies.** The onboarding assistant answers only from fictional guides, lists the documents it used, and hands off to the right person when it can't answer. Recruiters and managers edit the guides in the app.
- **Manager's view.** The Day 1 checklist.
- **Event-driven unlocks.** Each step unlocks the next, and every screen updates live.

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
| `alex.kim@example.com` | Recruit, offer accepted. Best on a phone, or in browser device mode (F12, then Ctrl+Shift+M). |
| `sam.reid@example.com` | Hiring manager, with the Day 1 checklist. |

To see both sides at once, log in as the recruit in one window and as a staff member in a private window. To see the whole journey from the start, onboard a successful candidate such as Ben Carter as Jordan, then open the **demo mailbox** (`/mailbox.html`) to read the offer email and activate the account.

**On a phone:** the app is a plain web app. Run it on a laptop and open `http://<the laptop's IP address>:3000` from a phone on the same network.

The full list of accounts, the journey step by step, the API and the design choices are in [`app/README.md`](app/README.md).

### The assistant

It works with no setup: without a model it quotes the best-matching guide section and offers the recruiter. To get model-written answers, copy `app/.env.example` to `app/.env`, then either set `ANTHROPIC_API_KEY` or log in to the Claude Code CLI on the server. `ASSISTANT_PROVIDER` chooses the backend. The `.env` file is ignored by git, and no key is committed.

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
| The grounded assistant and the guide editor | Everyone and everything in the data: names, offers, salaries and policies are made up. |

## Stack

Node.js with Express, Socket.IO and the built-in `node:sqlite`. The front end is plain HTML, CSS and JavaScript, with no build step. It is styled with the team's `lbg-style` skill. The assistant uses the Claude API through `@anthropic-ai/sdk`.

## Repo layout

- `app/`: the application, its guides (`app/knowledge/`) and its tests (`app/test/`)
- `mockups/` and `ideas.md`: early design work and ideas
- The remaining files are the hackathon's own instructions.
