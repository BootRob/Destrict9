# destrict9: morning plan, Tue 10 Nov 2026

The build freeze is at 13:00: the submission is whatever is on `main` at that moment. Our own feature freeze is **11:45**. The checkpoint is at 10:15.
Everything here was agreed in a review and grilling session at 08:00, after a design critique of "The Pass" scored 27/40.

## Memory rules (after the 08:33 crash)

At 08:33 the laptop ran out of memory: it has only 7.7 GB of RAM, and `/tmp` is stored in RAM. The system shut down a terminal window, which took WS2, WS3 and their browsers with it. To stop that happening again:
- **Save screenshots, browser profiles and scratch copies on disk,** under `~/.cache/d9-shots/<ws>/`. Never put them in `/tmp`.
- **Run one headless Brave at a time,** across all sessions. Kill it, and delete its profile, as soon as the screenshots are taken.
- **Don't copy `node_modules` into scratch folders.** Test a branch from its own worktree instead.
- **WS3's Haiku vs Opus timing results** are saved in `~/.cache/d9-shots/ws3-timing/`.
- **WS2 left 2 uncommitted files** in `destrict9-polish` when it crashed. They're work in progress, so keep them.

## Focus: the recruit's journey in 5 phases

| # | id | Name | Horse line | Who / what |
|---|---|---|---|---|
| 1 | `offer` | Offer | Saddling up | Conditional offer and security checks. The recruit talks only to the recruiter. |
| 2 | `getting_ready` | Getting ready | Joining the stable | Unconditional offer accepted. The manager chat, laptop choice, start date, Day 1 info and pre-start training. |
| 3 | `first_30` | First 30 days | Finding your stride | What to do, where to find information about LBG, its systems and ways of working, and training. |
| 4 | `days_30_60` | 30 to 60 days | Setting your course | Setting targets: clear goals and a development plan. Shown as a preview. |
| 5 | `days_60_90` | 60 to 90 days and beyond | Full horsepower | Growing your Lloyds career. Shown as a preview. |

- **Phase names:** plain names, with the horse line as a subtitle.
- **Where the horse theme goes:** the pass card, the transition screen, and one line per phase. No puns anywhere else.
- **What's real:** phases 1 to 3 work end to end. Phases 4 and 5 are content-rich previews, and we say so in the README.

## Shared contract (don't change it without telling the other workstreams)

`GET /api/journey` gains:
```
phase: { id, n, name, line, startsOn }
```
- `id` is one of the five ids above.
- `n` runs from 1 to 5.
- `startsOn` is an ISO date, or null.
- The existing `steps` stay, each step with a `phase` id added.

Phases 3 to 5 start at the start date, start + 30 days and start + 60 days.

**What WS1 built** (PR #12, branch `feat/phases`; base your work on it):
- `phase` also carries `of` (5) and `tip`, a short tip for the phase.
- The response also has `phases`, the list of all 5, and `daysToStart` and `dayNumber`. `dayNumber` is null before the start date and runs 1, 2, 3… from then on.
- There are 9 steps: `conditional_offer`, `screening`, `screening_submitted`, `unconditional_offer`, `accepted`, `day1`, `settling_in`, `day30` and `day60`.
- **WS3:** the home screen links to `/joiner/phase.html?id=<phaseId>`, so build `phase.html` to read `?id=`.
- **Seeded recruits who have started:** `ruby.ahmed@example.com` (Day 12, Software Engineer, Leeds, manager Sam) and `tom.bennett@example.com` (Day 45, Customer Service Advisor, Cardiff, manager Hannah). Run `npm run reset` to load them.

## Workstreams: one worktree, branch and port each

Rules: start from `main`, stay in the files you own, and keep any edit to someone else's file to a line or two, saying so in the commit message.

### WS1: Journey backbone and the pass card
Worktree `~/Hackathon/destrict9-phases`, branch `feat/phases`, `PORT=3001`.
- The 5 phases in `journey.js`, with the 8 steps grouped under them. `/api/journey` returns `phase`.
- Home screen (`joiner/index.html`, `js/journey-card.js`):
  - The pass card's chip shows the phase, and the card changes state.
  - The tracker is grouped by phase.
  - **One progress measure:** fixes "5/8" next to "69%".
  - Tracker labels at 12px or more.
- Transition screen after login, in a new `joiner/welcome.html`: the pass card animates in, with the person's phase and one tip for it. About 3 seconds, skippable, once per login.
- Seeded recruits in `db.js`: one at Day 12 (phase 3) and one at Day 45 (phase 4). Add both to the README accounts table.
- **Owns:** `journey.js`, `db.js` seed, `js/journey-card.js`, `joiner/index.html`, `joiner/welcome.html` (new), `css/phases.css` (new), plus a one-line change to the login redirect.

### WS2: The Pass everywhere, and the demo bugs
Worktree `~/Hackathon/destrict9-polish`, branch `feat/polish`, `PORT=3002`.
- The Pass look on:
  - `login.html` (the first frame of the demo)
  - `activate.html`
  - the offer, screening, device and guides headers
- Bugs to fix:
  - **Offer page:** it says "When you accept…" above "You accepted…".
  - **Manager checklist:** "Laptop ready" is ticked while its hint says no laptop has been chosen (seed data in `checklist.js`).
  - **Staff sidebar:** a horizontal scrollbar. Add `overflow-x: hidden` to `.staff-nav`.
  - **Mailbox:** 444px wide on a 390px phone, and the empty state needs designing.
  - **Guides:** every one says "Updated Yesterday".
  - **Grey text:** `#6c6a63` on stone is 4.43:1; it needs at least 4.5:1.
  - **Tap targets:** the 28px checklist toggles and the 40px buttons need to reach 44px.
- Screening wait: replace the five spinners with one calm, static "With ClearPath, usually done by ~DATE" timeline.
- **Owns:** `css/pass.css`, `css/theme.css`, `css/staff.css`, `login.html`, `activate.html`, `joiner/offer.html`, `joiner/screening.html`, `joiner/device.html`, the guides page header, `checklist.js`, `mailbox.html`. **Not** `joiner/index.html`.

### WS3: Phase content, videos and the assistant
Worktree `~/Hackathon/destrict9-content`, branch `feat/content`, `PORT=3003`.
- New guides in `app/knowledge/`:
  - The first 30 days, week by week
  - LBG systems and ways of working
  - Mandatory training
  - Goals and a development plan (30 to 60 days)
  - Growing your career (60 to 90 days)
- Video cards in a new `js/video.js`: a thumbnail that loads the video only when tapped, from `youtube-nocookie.com`, chosen by phase, role and city.
- A phase screen in a new `joiner/phase.html`: what to do now, the phase's guides and its videos. Phases 4 and 5 are labelled as previews.
- Assistant:
  - Render answers as Markdown.
  - Answer first, in about 60 words.
  - Shorten the handoff button to "Ask Hannah".
  - Time Haiku against Opus for speed.
- At 11:45: update the README and `docs/` for the phases and what's real and what's simulated.
- **Owns:** `app/knowledge/`, `assistant.js`, the chat rendering in `js/`, `js/video.js` (new), `joiner/phase.html` (new), `README.md`, `docs/`.
- **If time runs short:** drop the Haiku timing and the depth of phase 5 first.

## Videos

All are official LBG or Lloyds Bank uploads. The video search confirmed each exists and can be embedded. Embed as `https://www.youtube-nocookie.com/embed/<ID>`.

| Use | Title | ID |
|---|---|---|
| Transition screen or ending | Lloyds Bank – Epic Journey (black horse), 1:00 | `lr3ybKC44XQ` |
| Alternatives | Forever Forwards · Drumbeat | `HNHhwUyr38g` · `1u9TBXx6ltg` |
| Phase 2, Leeds | Lloyds Banking Group Wellington Place Leeds, 1:03 | `ZQ17oSp_j7w` |
| Phase 3 | Emma, Software Engineering, Leeds · Holly, Data, Leeds | `PSM-dEue30I` · `Jnnmxc2CWIE` |
| Phase 5 | Abhinandan, Technology Engineering, Leeds · Real questions: Career change | `0R4P_ca1xns` · `5IS6FyUAw0A` |
| Contact centre (Cardiff) | Be the Voice that helps: Customer Care | `2x-2JNBubC0` |

- **Office address:** the Leeds office is **11 & 12 Wellington Place**, not 1 and 2.
- **Careers channel:** `@LloydsBankingGroupCareers`.

## Timeline

| Time | What happens |
|---|---|
| 08:30 | Start work. |
| ~10:00 | Each workstream merges whatever works into `main`, ready for the 10:15 checkpoint. |
| 11:45 | Feature freeze, then the final merge. |
| 11:45–12:45 | The demo server runs from a clean copy of `main` on :3000 and goes on the tailnet via `tailscale serve` at port 10002 of the laptop's tailnet address. Rehearse on the phone. Fixes only. |
| 12:45 | Check the README. `main` is frozen. |

## The 3-minute demo

| Step | Who | What to show |
|---|---|---|
| 1 | Priya, phase 1 | Login, then the transition screen ("No news is normal"). |
| 2 | Alex, phase 2 | The pass card, choosing a laptop, chatting with Sam, the Wellington Place video. |
| 3 | Ruby (Day 12), phase 3 | Their first 30 days, and the assistant with its sources. |
| 4 | Tom (Day 45), phase 4 | Goals. |
| 5 | Ending | The phase 5 "Full horsepower" screen. |
| 6 | Staff view, about 20 seconds | The manager's checklist. |
