# Architecture

## Stack

| Layer | Choice | Why |
|---|---|---|
| Server | Node.js (22.13 or later), Express 5 | Small and familiar, with one process for pages, API and websockets |
| Real-time | Socket.IO 4 | Live chat, typing indicators, read receipts and journey updates, with reconnection built in |
| Storage | Node's built-in `node:sqlite` | Nothing to install or compile; one file, `app/data/app.db` (git-ignored) |
| Front end | Plain HTML, CSS and ES modules, with no build step | Anyone on a team of five can edit a page; fast to change during a hackathon |
| Styling | `lbg-style` skill tokens (`brand/tokens.css`) | One source of truth for the LBG look |
| Assistant | Claude API (`@anthropic-ai/sdk`) or the Claude Code CLI, with an offline fallback | Answers grounded in the guides; the demo never breaks |

## Code map

```
app/
├── server.js          Express routes, auth middleware, Socket.IO rooms and events
├── db.js              Schema (version 6), password hashing, synthetic seed data
├── onboarding.js      Applicants, Onboard, activation links (invites), shared helpers
├── journey.js         Recruit stage machine, progress steps (offer to Day 30), laptop catalogue
├── mailer.js          sendEmail(): stores email for the demo mailbox (swap for a real service)
├── assistant.js       Onboarding assistant: providers, grounded prompt, handoffs
├── guides.js          Guides in knowledge/*.md: read, create, edit, conflict detection
├── checklist.js       Manager Day 1 checklist, Day 1 details, pre-start training (own tables)
├── knowledge/         14 synthetic onboarding guides (Markdown)
└── public/
    ├── brand/         LBG tokens, logos, Cancara pattern, icons (copied from the skill)
    ├── css/           app.css (shared), staff.css (staff layout), journey.css (recruit journey)
    ├── js/            chat.js (API, thread, composer), staff-shell.js (sidebar),
    │                  journey-card.js (progress bar and next step), markdown.js (safe renderer)
    ├── login.html  activate.html  mailbox.html  clearpath.html
    ├── joiner/        index (home), offer, screening, device, guides
    ├── staff/         index (messages), applicants, checklist, guides
    └── img/devices/   macbook-pro.svg, hp-elitebook.svg (our own illustrations)
.claude/skills/lbg-style/   Claude Code skill: LBG design rules and assets
docs/                       This documentation
```

## Data model

`db.js` owns the core schema. If `SCHEMA_VERSION` changes, the prototype database is dropped and rebuilt from the seed data, because prototype data is disposable.

| Table | Purpose | Key columns |
|---|---|---|
| `users` | Everyone who can log in | `role` (joiner, manager or recruiter), `status` (invited or active), `password_hash` (NULL until activated), `start_date` |
| `sessions` | Login sessions | random `token`, `expires_at` (7 days) |
| `applicants` | Candidates and their journey | `status` (interviewing, successful or unsuccessful), `recruiter_id`, `hiring_manager_id`, `user_id` once onboarded, `journey_stage`, timestamps for each step, `screening_result`, `declined_offer` and `decline_reason`, `device_choice`, salary and contract |
| `invites` | One-time activation links | `token_hash` (SHA-256, never the token), `expires_at`, `used_at`, `revoked_at` |
| `conversations` | One private chat per recruit per staff member | `joiner_id`, `staff_id`, `kind` (recruiter or manager), unique on (joiner, kind) |
| `messages` | Chat messages | `conversation_id`, `sender_id`, `body`, `read_at` |
| `emails` | Simulated outbox for the demo mailbox | recipient, subject, body, action URL and label |

`checklist.js` creates its own tables (`checklist_items`, `checklist_day1`, `prestart_training`) with `CREATE TABLE IF NOT EXISTS`, keyed by the recruit's email. That way the checklist survives the main database being re-seeded, and it never touched `db.js`, which kept the two parallel branches from conflicting.

### Journey stage machine (`applicants.journey_stage`)

```
(onboarded) → conditional_offer ─accept→ screening ─"added my details"→ screening_submitted
                  │ decline                                    │ recruiter: clear       │ not clear
                  ▼                                            ▼                        ▼
               declined          declined ←reject─ unconditional_offer            withdrawn
                                                        │ accept
                                                        ▼
                                                     accepted  (manager chat opens; laptop choice)
```

Every transition is a conditional `UPDATE … WHERE journey_stage = <expected>`, so repeated or out-of-order requests are refused with a 409 and can't corrupt the state.

The **progress bar** (`stepsFor` in `journey.js`) maps this to 8 steps. The last three (Day 1, Week 1 and Day 30) come from the calendar: after acceptance, the current step is whichever of those comes next, based on today's date and the start date.

## API (summary)

The full tables are in [`app/README.md`](../app/README.md#api). The groups are:

| Group | Endpoints | Who |
|---|---|---|
| Auth | `POST /api/login`, `POST /api/logout`, `GET /api/me` | Anyone; invited accounts are refused at login with a pointer to the activation email |
| Messaging | `GET /api/conversations`, `GET …/:id/messages`, `POST …/:id/read` | Participants of that conversation only |
| Applicants | `GET /api/applicants`, `POST …/:id/onboard`, `…/resend`, `…/screening-result` | Recruiters, for their own applicants only |
| Activation | `GET/POST /api/activate` | Holder of a valid token |
| Journey | `GET /api/journey`, `POST …/conditional/accept`, `…/decline`, `…/screening`, `…/unconditional/accept`, `…/device` | Recruits, for their own journey |
| Guides | `GET/POST/PUT /api/guides` | Everyone reads; managers and recruiters edit |
| Assistant | `GET/POST /api/assistant` | Recruits |
| Checklist and Day 1 | `/api/checklist…`, `GET /api/day1` | Managers for their recruits; recruits read their own Day 1 details |
| Demo | `GET /api/mailbox` | Anyone (switch off with `DEMO_MAILBOX=off`) |

## Real-time

Each socket connects with the session cookie (unauthenticated sockets are refused). It joins `user:<id>` and one `conv:<id>` room for each conversation it belongs to.

| Event | When | To |
|---|---|---|
| `message:new` | A message is sent | The conversation room |
| `typing`, `conversation:read` | Typing, or messages read | The conversation room |
| `applicant:updated` | The recruit moves a step (or activates) | The recruiter's user room. The Applicants row updates, and a pop-up appears if the stage changed |
| `journey:updated` | The recruiter records a result (or another tab moves the journey) | The recruit's user room. The progress bar and card refresh |
| `conversations:changed` | A new chat opens (onboarding, or acceptance opens the manager chat) | The staff member's and recruit's user rooms. The new room is joined straight away with `socketsJoin` |

## Security and privacy

- **Passwords:** hashed with scrypt and a per-user salt, compared in constant time.
- **Sessions:** a random 32-byte token in an httpOnly, SameSite=Lax cookie, with `Secure` set in production. Logging out deletes the session row.
- **Activation links:**
  - The 32-byte token is emailed; only its SHA-256 hash is stored.
  - Links expire after 7 days and work once.
  - Resending revokes the old link.
  - Invited accounts can't log in or open sockets.
- **Authorisation on every call:**
  - Chats are private to their two participants. Others get a 404 rather than a 403, so the API doesn't reveal that a chat exists.
  - Recruiters see and act on their own applicants only.
  - Managers see a recruit only once connected to them.
  - Pages are guarded by role on the server.
- **No personal data collected for screening:** the recruit gives their details directly to ClearPath (a third party). The app stores only the time they confirmed, and ignores personal fields even if a client sends them. A test checks this.
- **Internal notes stay internal:** the recruiter's screening note is never shown or emailed to the recruit.
- **No passwords in chat:** the idea of the manager sending Day 1 credentials in the app was deliberately not built. Guide 06 tells recruits nobody will ever ask for their password.
- **XSS:**
  - Message text is always rendered with `textContent`.
  - The guide renderer (`markdown.js`) builds DOM nodes and never uses `innerHTML`.
- **Prompt injection:**
  - Guides can't contain `<document>` tags, which would break the assistant's prompt boundary.
  - The assistant's cited sources are checked against the real guides.
- **Guides:**
  - IDs must match a pattern, which blocks path traversal.
  - Writes are atomic, and there's a size limit.
  - Concurrent edits get a 409 rather than overwriting each other.
- **Secrets:** none in the repo. Settings go in `app/.env` (git-ignored), and `app/.env.example` documents them.
- **Demo-only risk:** the demo mailbox shows every activation link, so it must be off (`DEMO_MAILBOX=off`) on anything real.

## Branding

`.claude/skills/lbg-style/` is a Claude Code skill built from the public lloydsbankinggroup.com site. It contains colour tokens (heritage `#006a4d`, racing `#024731`, everyday `#11b67a`, accent `#0be248`), type, buttons, the logo (colour and white), the Cancara pattern and the site's icon set. Claude Code loads it automatically for UI work in the repo, which keeps every screen consistent.

GT Ultra, the site's font, is licensed, so it isn't included; system fonts are used instead. Every screen says it's a concept prototype.

## Testing

Two end-to-end suites run against a real server, with a throwaway database and a real logged-in socket client:

| Suite | Checks | Covers |
|---|---|---|
| Messaging | 37 | Login, roles and routing; who sees which chats; unread counts; live delivery both ways; typing and read receipts; privacy (who can't read or post); validation; logout |
| Journey | 71 | Applicant permissions; onboarding; activation link rules; every journey step in order; refusing repeated and out-of-order steps; no personal data stored; result recording (clear, not clear, wrong recruiter, manager); live updates both sides; manager chat opening; laptop rules; decline path |

Both suites pass on `main` after all five PRs were merged. **Caveat:** the suites currently live outside the repo, in the session's temporary folder. Adding them to `app/test/` with an `npm test` script is on the to-do list (see the [build log](05-build-log.md#whats-next)).

The other session tested the assistant, guides and checklist at the API level, plus manual testing by the team. The screens have no automated browser tests. Page scripts were syntax-checked, and the laptop illustrations were rendered and checked by eye.

## Deployment

Not done yet. Plan: Azure App Service (UK South or Italy North, in the team's resource group, named `app-teamNN-…`). Settings needed:
- `NODE_ENV=production` (secure cookies)
- `PUBLIC_URL` (email links)
- `ANTHROPIC_API_KEY` (the assistant; a deployed copy has no Claude CLI, so without a key it falls back to offline answers)

Keep `DEMO_MAILBOX` on for the demo only. SQLite on App Service needs a persistent path (`DB_PATH`) or can be re-seeded on each start.
