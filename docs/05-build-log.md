# Build log

What we built on Day 1 (Monday 9 November 2026), in order, with the decisions behind it. Two Claude Code sessions worked in parallel for the team:

- **Session A** (`~/Hackathon/destrict9`): branding skill, messaging, roles and login, the staff web app, recruiter onboarding, the recruit journey, laptop choice.
- **Session B** (`~/Hackathon/destrict9-assistant`): onboarding assistant, guides and guide editor, guide content, manager Day 1 checklist.

## Timeline

| Step | What | Where |
|---|---|---|
| 1 | Cloned the team fork (`bootrob/destrict9`) and read the LaunchPad brief from mwlaunchpad.com | – |
| 2 | **`lbg-style` skill:** colours, type, buttons, logos, the Cancara pattern and icons from lloydsbankinggroup.com, plus a style mock page. `.gitignore` changed so `.claude/skills/` is shared | PR #1 (merged) |
| 3 | Rob's notes on what the app should do (`ideas.md`) | PR #2 (merged) |
| 4 | **Messaging prototype:** login with seeded synthetic accounts; a manager web hub and recruit mobile chat; live messaging over Socket.IO with typing indicators, unread counts and read receipts | Session A |
| 5 | **More roles:** hiring manager, recruiter and buddy, each with a private 1:1 chat with the recruit; one staff hub for all staff roles | Session A |
| 6 | **Onboarding assistant and guides:** an assistant grounded in synthetic guides, with handoffs to a person; guides readable by recruits and editable by staff | Session B |
| 7 | **Parallel sessions collided:** shared files, branch and port caused mixed edits and a stopped server. We checkpointed and split into **git worktrees** (one folder, branch and port per session) | – |
| 8 | Checkpoint of both sessions' work: messaging, assistant and guides | PR #3 (merged) |
| 9 | **Staff web app:** a desktop layout with a left sidebar replacing the phone-style hub. **Recruiter onboarding:** applicants table, Onboard, activation links, demo mailbox | Session A |
| 10 | **Buddy role removed** (team decision), from the code (Session A) and from the assistant and guides (Session B) | both |
| 11 | **Recruit journey:** conditional offer, then screening, then the recruiter's result, then the unconditional offer, then the manager chat. The **progress bar from offer to Day 30** (team request) | Session A |
| 12 | **Laptop choice:** MacBook Pro or HP EliteBook, with pictures (team request) | Session A |
| 13 | **Screening changed to a hand-off:** no personal details in the app. The recruit goes to ClearPath, then taps "I've added my details" (team request) | Session A |
| 14 | **Guides rewritten** for the new flow; new guides for purpose, values and getting to the office; team content decisions recorded | Session B |
| 15 | Onboarding, journey, laptop choice and the staff sidebar | PR #4 (merged) |
| 16 | **Manager Day 1 checklist**, Day 1 details, pre-start training status; guide updates | PR #5 (merged; Session A's test suites re-run against it, all passing) |
| 17 | This documentation | `docs/` |

## Day 2 (Tuesday 10 November 2026)

A design critique of "The Pass" restyle scored it 27/40 and found it unfinished, with some bugs visible in the demo. A grilling session at 08:00 agreed a morning plan: build **the recruit's journey in five phases**, from offer to Day 90, with the horse theme kept to the pass card, the welcome screen and one line per phase. Three Claude Code sessions worked in parallel, each in its own worktree, branch and port, with a feature freeze at 11:45.

| Workstream | What | Where |
|---|---|---|
| WS1: journey backbone | Five phases in `journey.js`, with nine steps grouped under them; `/api/journey` returns `phase`. A phase tracker on the home screen with one progress measure (fixing "5/8" next to "69%"); the pass card follows the phase. A welcome screen after login. Ruby (Day 12) and Tom (Day 45) seeded | PR #12 (merged) |
| WS2: The Pass everywhere | The Pass look on login, activation, offer, screening, laptop and guides; fixes for the demo bugs the critique found | `feat/polish` |
| WS3: content | Five new guides (the first 30 days week by week, LBG systems and ways of working, mandatory training, goals, growing your career). Video cards from `youtube-nocookie.com`, chosen by phase, role and city. A phase screen per phase, with 4 and 5 as previews. Assistant answers first, in about 60 words, rendered as Markdown; the handoff button is now "Ask Jordan" | PR #13 |

Day 2 decisions:

| Decision | Why |
|---|---|
| **Five phases** (Offer, Getting ready, First 30 days, 30 to 60 days, 60 to 90 days and beyond), each with a plain name and a horse line as subtitle | Best-in-class onboarding has clear 30/60/90 plans; plain names keep it usable, the horse line keeps it memorable |
| **Phases 1 to 3 work end to end; 4 and 5 are content-rich previews**, and we say so | Honest scope for the time left |
| **Videos load only when tapped**, from `youtube-nocookie.com` | No YouTube player or cookies until the recruit chooses to watch, and a lighter page on a phone |
| **Assistant answers first, in about 60 words** | Answers were correct but long on a phone |
| **Opus stays the assistant's default.** Haiku was timed: 5.0 s against 5.9 s on average over 5 questions through the CLI, where CLI start-up dominates | Too small a difference to swap. Haiku once handed off to the recruiter when it didn't need to |
| **New guide details to confirm:** 25- and 50-minute meetings, probation extension of up to 3 months, about 12 months in role before an internal move, 2 volunteering days | Written for the prototype; the assistant will quote them |

The laptop ran out of memory at 08:33 with three sessions running headless browsers that kept their profiles in `/tmp`, which is in RAM. The fix was to keep scratch files on disk and run one headless browser at a time.

## Decisions and why

### Product

| Decision | Why |
|---|---|
| **Start the journey with the recruiter**, at the applicant list | The brief begins at the offer. Starting a step earlier shows the warm handover (prompt 01) and gives a complete story |
| **Conditional, then screening, then unconditional**, with an accept step at each offer | It mirrors how bank offers actually work, and lets us tell recruits when it's safe to resign |
| **Screening happens on the third party's site.** The app only records "I've added my details" | We don't want to hold sensitive personal data in a prototype, or in an onboarding app at all. The screening company owns that data |
| **The recruiter records the screening result** | It stands in for the screening company's callback, and gives the presenter control over timing in a demo |
| **The manager chat opens only after the unconditional offer** | The manager relationship is earned, not assumed, and it avoids managers bonding with candidates who may not pass screening |
| **Buddy role removed** | To focus on the recruiter and manager and keep the scope tight. It's easy to add back as another conversation type |
| **Laptop choice after acceptance; changes allowed until 7 days before start** | A real early choice (prompt 06). The cut-off reflects the time needed to prepare the kit. The recommendation varies by role |
| **Progress bar includes Day 1, Week 1 and Day 30**, dated from the start date | The brief's goal is Day 30, not day one (prompt 03, *where am I?*) |
| **The Day 1 lunch is earned by finishing the pre-start training** | Team decision; it fits prompt 04, *earned, not withheld* |
| **No colleague car park, no remote starts** | Team content decisions, reflected in the guides |
| **No passwords in chat** | Rob's notes suggested the manager share the Day 1 password in the app. We deliberately didn't build it: sending credentials through chat is a red flag at a bank, and guide 06 says nobody will ever ask for your password. IT sets it with the recruit on Day 1 |
| **Email is simulated, with a demo mailbox** | The people are made up, so we can't send real email. The mailbox makes the email steps visible in a demo |

### Technical

| Decision | Why |
|---|---|
| Node, Express, Socket.IO, built-in SQLite, plain HTML with no build step | Nothing to compile, and quick for five people to edit |
| One private conversation per recruit per staff member | Privacy (what you ask your recruiter isn't seen by your manager), enforced on every call |
| A stage machine with conditional UPDATEs | Steps can't be skipped or repeated, even by double clicks or crafted requests |
| Hashed, one-time, expiring activation links; invited accounts can't log in | Standard secure invite pattern |
| The checklist keeps its own tables, keyed by email (Session B) | It survives the demo database being re-seeded, and kept the two branches from conflicting on `db.js` |
| Assistant providers: API, then CLI, then offline fallback (Session B) | It works anywhere, and the demo never breaks if the model is unavailable |
| Guides as Markdown files in the repo, editable in the app (Session B) | The team can edit in git or in the app; the assistant picks up changes immediately |
| Our own SVG laptop illustrations | Manufacturer photos are copyrighted and the repo is treated as public. They're easy to swap |
| GT Ultra font not included | It's a licensed font; system fonts are used instead |

### Team process

- **One worktree per parallel session**, each with its own branch and port. Sessions coordinated through Claude Code's cross-session messaging before touching shared files (`server.js`, `db.js`, `staff/*.html`, `joiner/index.html`).
- **Shared files touched minimally**, with new logic in new files (`onboarding.js`, `journey.js`, `checklist.js` and so on), to keep merges clean. The one merge conflict (`server.js`, PR #5) was resolved by keeping both route blocks. Both test suites were re-run on the result.
- **One PR per feature** into `main`, reviewed and merged by the team.

## Known issues and caveats

- **No browser click-through tests.** Screens were checked by hand. The checklist and guide editor have been tested at the API level and partly by hand.
- **Training status is seed data.** There's no actual course.
- **No demo recruit is overdue on the checklist,** because all start dates are weeks away.
- **Assistant history resets** when the server restarts (memory only).
- **On localhost, cookies are shared across ports.** Use separate private windows for different users.
- **`app/README.md` has two stale bits:** the API table says applicant stages end at "invited or active", and "Next ideas" still lists the recruiter-to-manager handover, which is now built.
- **Open question:** should `app/knowledge/.meta.json` (who last edited each guide) be git-ignored?
- **Stray test guide:** a placeholder guide created while testing the editor (`12-new-guide-title.md`) exists untracked in one checkout. It isn't in the repo.

## What's next

In rough priority order for the 13:00 Tuesday build freeze:

1. **Deploy to Azure App Service** so the demo runs on a real phone (a hard rule). Set `NODE_ENV`, `PUBLIC_URL` and `ANTHROPIC_API_KEY`, and decide on a persistent database or re-seeding on start.
2. **Add the test suites to the repo** (`app/test/`, `npm test`). This is evidence for the "tests run" part of Best Technical Approach.
3. **Rehearse the [demo script](04-demo-script.md)** on a phone.
4. **Update the top-level `README.md`** (team name, what we built, which part of the challenge, how to run it). The submission checklist requires it, and judges read it first.
5. Nice to have:
   - a start-date email from the manager that updates the countdown
   - a "read before you start" checklist linking the purpose, values and travel guides
   - a Day 1 card on the home screen (from `GET /api/day1`)
   - an email alert to staff when a recruit messages
   - a way to measure "connected and confident" at Day 30 (prompt 12)
