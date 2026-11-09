# Joiner companion: messaging prototype

A new joiner (on a phone) chats privately with each of their people: their **hiring manager**, **recruiter** and **buddy**. Staff use a desktop web hub. Everything sits behind a login, is styled with the `lbg-style` skill, and uses only synthetic data.

## Run it

```bash
cd app
npm install
npm start          # http://localhost:3000   (npm run dev restarts on file changes)
```

Requires Node 22.13 or later. Storage uses the built-in `node:sqlite`, so there's nothing native to compile.

Settings go in `app/.env`, which git ignores. Copy `.env.example` to start one. Every setting is optional.

## Onboarding assistant

Joiners get an **Onboarding assistant** card above their people. It answers recruiter-type questions (checks, start dates, pay, first day, equipment, training) using only the fictional documents in [`knowledge/`](knowledge/). Each answer:

- lists the documents it used;
- hands off to the right person when it can't answer, or when the question is about the joiner's own case. A button opens that person's chat with the question already filled in. If that person isn't assigned yet, the joiner is pointed to their recruiter instead.

The startup log shows which model backend is in use. Set `ASSISTANT_PROVIDER` in `.env` to choose one:

| Provider | What it uses | Setup |
|---|---|---|
| `cli` | The Claude Code CLI on the machine running the server (`claude -p`), with that person's login. It runs with no tools, no settings and no repo context. For local development only. | Have `claude` installed and logged in. |
| `api` | The Claude API, through `@anthropic-ai/sdk`. The documents sit in a cached system prompt. | Set `ANTHROPIC_API_KEY` in `.env`. Never commit it. |
| `offline` | No model. Quotes the best-matching document section and always offers the recruiter. | None. |
| `auto` (default) | `api` if a key is set, otherwise `cli` if `claude` is installed, otherwise `offline`. | |

If the model call fails, the assistant falls back to the offline answer, so the demo keeps working. `ASSISTANT_MODEL` (default `claude-opus-5-5`, about 6 seconds an answer) and `ASSISTANT_EFFORT` (default `low`) tune speed and quality. `claude-haiku-5-5` is faster.

## Onboarding guides

The documents in `knowledge/` are also **guides that people can read**:

- **Joiners** open **Your guides** on their home screen (`/joiner/guides.html`). The sources under each assistant answer link to the guide they came from.
- **Managers and recruiters** get a **Guides** tab in the staff hub (`/staff/guides.html`). There they can read guides, edit them in Markdown with a live preview of what joiners see, and add new ones. Each save writes the `.md` file and the assistant uses it from the next question.

How editing works:
- Each guide shows who last edited it and when. This is kept in `knowledge/.meta.json`.
- If two people edit the same guide at once, the second save is refused with a message saying who changed it. Nothing is silently overwritten.
- A guide must start with a `# Title` line and be at most 30,000 characters.
- New guides get the next number, for example `12-parking-at-the-leeds-office.md`.
- Editing the files by hand still works too. Restart the server to pick up those changes.

Because edits in the app change files in the repo, commit the guide changes you want to keep, and discard demo edits with `git checkout app/knowledge`. **Real vs simulated:** the answers are really generated from the documents, but the documents are made up and aren't real bank policy. Assistant history is kept in memory per joiner, so it resets when the server restarts.

## Manager Day 1 checklist

Hiring managers get a **Day 1 checklist** at `/staff/checklist.html` (open it directly on this branch; it becomes a sidebar entry once merged with feat/recruiter-onboarding). For each recruit it shows:

- **Items with due dates** counted back in working days from the start date, flagged **overdue** if they slip: laptop and peripherals (showing the recruit's laptop choice when that data exists), access badge, accounts and system access, reception told, desk, induction and IT setup, team lunch, and a welcome message.
- **Optional items** (workplace adjustments, shift or rota) that can be marked **Not needed**.
- **Items that tick themselves.** "Welcome message sent" ticks once the manager has messaged the recruit. "Day 1 details shared" ticks once the Day 1 form is filled in.
- **Day 1 details:** start time, where to meet, who meets them, dress code and a number to call. Sharing them shows a **Your first day** panel at the top of the recruit's guides page, and the assistant uses them to answer questions like "What time do I start?".
- **Pre-start onboarding training:** whether the recruit has finished it (finishing earns their Day 1 lunch), with a **Send a reminder** button that posts a message in their chat.

The state is kept in its own tables (`checklist_items`, `checklist_day1`, `prestart_training`), created by `checklist.js` and keyed by the recruit's email, so it doesn't depend on `db.js`'s schema version. Seed data: Alex is part-way through and has finished the training; Priya and Owen are just starting. There's no training course in the prototype, so training status comes only from the seed data.

## Try both sides at once

1. Normal window: open http://localhost:3000 and log in as **Alex Kim** (joiner). You land on the mobile screen with Alex's three people. Use the browser's device mode (F12, then Ctrl+Shift+M) to see it at phone size.
2. Private window: log in as one of Alex's people (**Sam Reid**, **Jordan Ellis** or **Maya Okafor**). You land on the staff hub.
3. Send messages either way. They appear instantly, with typing indicators, unread badges and "Seen" receipts.

Each private window has its own cookies, so the two logins don't clash. For a third person at once, use a different browser or browser profile.

| Account | Role | Joiners / people |
|---|---|---|
| alex.kim@example.com | Joiner | Manager Sam, recruiter Jordan, buddy Maya |
| priya.shah@example.com | Joiner | Manager Sam, recruiter Jordan, **no buddy yet** |
| owen.davies@example.com | Joiner | Manager Hannah, recruiter Jordan, buddy Rhys |
| sam.reid@example.com | Hiring manager | Alex, Priya |
| hannah.price@example.com | Hiring manager | Owen |
| jordan.ellis@example.com | Recruiter | Alex, Priya, Owen |
| maya.okafor@example.com | Buddy | Alex |
| rhys.morgan@example.com | Buddy | Owen |

The password for every account is `demo1234`. These are demo credentials for synthetic users, not secrets.

## Design choices

- **Private 1:1 chats.** Each conversation is between one joiner and one of their people, so a question for the buddy isn't seen by the manager. Staff can see who else is in a joiner's circle, but not those conversations.
- **One hub for all staff roles.** Managers, recruiters and buddies share `/staff/`, titled by role. Each sees only the joiners they're assigned to.
- **Unassigned roles are shown, not hidden.** A joiner with no buddy yet sees a placeholder explaining when one will arrive.
- **Real vs simulated:** messaging is real and works end to end. The login is a demo login against seeded accounts, standing in for company SSO. Assignments come from the seed data; there's no admin screen yet.

## How it works

- **`db.js`**:
  - The SQLite schema: `users` (with a role of joiner, manager, recruiter or buddy), `sessions`, `conversations` (one per joiner per assigned staff member, with `kind` = their relationship) and `messages`.
  - Seeds the demo data. Passwords are hashed with scrypt.
  - The database is in `app/data/`, which git ignores. `npm run reset` re-seeds it. A schema version bump rebuilds it automatically.
- **`server.js`**:
  - Express pages plus a JSON API, and Socket.IO for live updates.
  - Each conversation is a room, `conv:<id>`. A socket joins only the rooms for conversations it's part of.
  - Every API call and socket event checks that the caller is one of that conversation's two participants.
- **`guides.js`**: reads and writes `knowledge/*.md` (with safe file names and atomic writes), validates guides, and records who edited them.
- **`public/js/markdown.js`**: a small Markdown renderer that builds page elements directly rather than inserting HTML, so guide text can't inject markup.
- **`checklist.js`**: the manager Day 1 checklist: items, due dates, Day 1 details and training status.
- **`assistant.js`**: loads the guides (and reloads them after every save), builds the grounded prompt, calls the chosen provider, and returns structured JSON (`answer`, `sources`, `handoff`). Source IDs are checked against the real documents. Each joiner can have only one question in progress at a time.
- **Login**: a random session token stored in an httpOnly, SameSite=Lax cookie (marked `Secure` when `NODE_ENV=production`).
- **`public/`**:
  - `login.html`
  - `joiner/` (mobile: assistant, guides and people list, then chat; `guides.html` is the guide reader)
  - `staff/` (desktop: joiner list, chat, joiner details and circle; `guides.html` is the guide editor)
  - shared `js/chat.js` and `css/app.css`
  - `brand/`, copied from the skill

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/login` | `{ email, password }`, sets the session cookie, returns `{ user, home }` |
| POST | `/api/logout` | Ends the session |
| GET | `/api/me` | The logged-in user, plus their circle (people by role) if they're a joiner |
| GET | `/api/conversations` | The caller's conversations, with the other person, last message and unread count. Staff also get the joiner's circle |
| GET | `/api/conversations/:id/messages` | Last 200 messages |
| POST | `/api/conversations/:id/read` | Marks the other side's messages as read |
| GET | `/api/guides` | Everyone: guide list (`id`, `title`, `updatedAt`, `updatedBy`) and `canEdit` |
| GET | `/api/guides/:id` | Everyone: one guide, including its `markdown` |
| POST | `/api/guides` | Managers and recruiters: `{ markdown }` creates a guide |
| PUT | `/api/guides/:id` | Managers and recruiters: `{ markdown, baseUpdatedAt }` updates a guide. Returns 409 if someone else saved since `baseUpdatedAt` |
| GET | `/api/checklist` | Managers: their recruits with checklist progress |
| GET | `/api/checklist/:joinerId` | Managers: one recruit's checklist, Day 1 details and training status |
| PUT | `/api/checklist/:joinerId/items/:itemId` | Managers: `{ status }`, which is `todo`, `done` or (optional items only) `not_needed` |
| PUT | `/api/checklist/:joinerId/day1` | Managers: `{ time, place, meetBy, dressCode, phone }` shares the Day 1 details |
| POST | `/api/checklist/:joinerId/training-reminder` | Managers: sends the recruit a training reminder in their chat |
| GET | `/api/day1` | Joiners: their Day 1 details (or `null`) and training status |
| GET | `/api/assistant` | Joiners only: `{ provider, history }` |
| POST | `/api/assistant` | Joiners only: `{ question }`, returns `{ answer, sources: [{ id, title }], handoff, provider }`. `handoff` is `none`, `recruiter` or `manager` |

| Socket event | Direction | Payload |
|---|---|---|
| `message:send` | client to server (with ack) | `{ conversationId, body }` |
| `message:new` | server to room | message |
| `typing` | both ways | `{ conversationId }` / `{ conversationId, userId, name }` |
| `conversation:read` | server to room | `{ conversationId, readerId, at }` |

## Next ideas

- Email notification when a joiner messages (from Rob's notes).
- An optional group chat for the joiner and all their people.
- Recruiter hands over to the manager once checks clear.
- A screen to assign a buddy, which creates the conversation and notifies the joiner.
- Deployment to Azure App Service so it runs on a real phone.
