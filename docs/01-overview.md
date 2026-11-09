# Overview

## The challenge

From the LaunchPad '26 brief:

> Design and build a mobile-first companion that takes a new joiner from unconditional offer to feeling connected and confident by Day 30.

Why it matters: vetting and screening at a bank mean weeks or months between offer and first day. Workday records the joining process but doesn't guide anyone through it. New starters don't know what comes next or what applies to their role and location. They can't meet their manager before they arrive. And the support stops at day one.

**Hard rules:**
- The demo runs on a phone.
- Synthetic data only.
- No internal LBG systems.
- No secrets in the repo.
- Whatever is in the repo at **13:00 on Tuesday 10 November** is the submission.

## What we built

A web app with two faces, sharing one server:

- **For the recruit (phone):** a home screen showing where they are on the journey, with a progress bar from offer to Day 30 and a card saying what to do next. They can also:
  - view and accept their offers
  - go through pre-employment screening with the external screening company
  - choose a laptop
  - read onboarding guides
  - ask an assistant that answers from those guides
  - chat privately with their recruiter and, later, their hiring manager
- **For staff (desktop web app):**
  - **Recruiters** manage applicants, onboard successful candidates, record screening results and message their recruits.
  - **Hiring managers** message their recruits, work through a Day 1 checklist and share Day 1 details.
  - Both can read and edit the onboarding guides.

### Roles

| Role | Device | What they do |
|---|---|---|
| Recruit (joiner) | Phone | Follows their journey, accepts offers, completes screening with ClearPath, chooses a laptop, reads guides, asks the assistant, messages their people |
| Recruiter | Desktop | Sees their applicants, onboards successful ones (sends the conditional offer), records screening results, messages recruits |
| Hiring manager | Desktop | Is connected to the recruit once the unconditional offer is accepted, messages them, works through the Day 1 checklist |

There was briefly a **buddy** role. The team removed it to focus the journey on the recruiter and hiring manager (see the [build log](05-build-log.md)).

### The journey, end to end

```
Recruiter: Applicants → Onboard
      │  email: conditional offer + one-time activation link
      ▼
Recruit: activate account (set password)
      ▼
1 Conditional offer ──── accept / decline
      ▼
2 Screening details ──── "Go to ClearPath" (third party) → "I've added my details"
      ▼
3 Screening checks ───── honest progress; recruiter records clear / not clear
      ▼
4 Unconditional offer ── accept / reject
      ▼
5 Meet your manager ──── manager chat opens · choose laptop · Day 1 details arrive
      ▼
6 Day 1 → 7 Week 1 → 8 Day 30   (dated from the start date)
```

## How it answers the brief

The brief gave twelve prompts as context. Here's where each one shows up:

| Prompt | Where it's addressed |
|---|---|
| 01 A warm handover | The recruiter's **Onboard** sends a personal offer email. The recruit's first screen is "Congratulations, Ben!", and a welcome message from their recruiter is waiting |
| 02 Honest progress | The screening checks screen: what's being checked, when they finished with ClearPath, the typical timeframe (2 to 4 weeks), and "no news is normal" |
| 03 Where am I? | The 8-step progress bar on the home screen, plus a "what's next" card |
| 04 Earned, not withheld | Steps unlock in order: screening after the conditional offer, the manager chat and laptop choice after the unconditional offer |
| 05 Not the same pack | The laptop recommendation depends on the role, offer terms are per role, and guides cover Leeds and Cardiff separately |
| 06 Early choices | Laptop choice (MacBook Pro or HP EliteBook), which can be changed until a week before the start date |
| 07 Meet before you meet | A private chat with the hiring manager as soon as the offer is unconditional |
| 08 What's left? | The manager's Day 1 checklist, with due dates counted back from the start date and overdue flags |
| 09 Chain reactions | Each action moves the next person on: Onboard → email → activation → recruiter table updates live. Accepting the unconditional offer opens the manager chat. Sharing Day 1 details ticks the checklist and shows the recruit a "Your first day" panel |
| 10 Guide, don't nag | One "what's next" card rather than a to-do list. A training reminder is something the manager chooses to send |
| 11 9pm on a Sunday | The onboarding assistant answers from the guides at any hour and hands off to the right person when it can't |
| 12 Did it work? | Day 1, Week 1 and Day 30 are on the progress bar. Measuring "connected and confident" is still open (see the build log) |

## Judging categories

| Category | What we'd show |
|---|---|
| **Best Demo** | The full journey live on a phone, from Onboard to manager chat, with both sides updating in real time. We'd be clear about what's simulated |
| **Best Technical Approach** | A stage machine that refuses out-of-order steps; hashed one-time activation links; no personal data collected; private conversations enforced on every API call and socket event; around 110 automated end-to-end checks |
| **Best UX** | Mobile-first recruit screens with reassurance copy; a desktop staff app; accessible contrast (LBG palette checked against WCAG AA); focus rings; reduced-motion support |
| **Best Feature Fit** | We prioritised the pain points in the brief: the long, uncertain gap between offer and Day 1, and meeting your manager before you arrive. We dropped the buddy role to keep the scope tight |
| **Most Innovative** | An assistant grounded in guides that staff can edit, with cited sources and handoffs to a person. Honest progress during screening. An event-driven journey |

## Real vs simulated

| Real (works end to end) | Simulated or stand-in |
|---|---|
| Login, sessions and role-based access | Accounts are seeded demo users, standing in for company SSO |
| Live private messaging (Socket.IO) | |
| Applicants, onboarding, the stage machine and activation links | Applicant data is seeded |
| The progress bar and journey rules | Day 1, Week 1 and Day 30 come from seeded start dates |
| | **Email**: written to a table and shown on the demo mailbox page (`/mailbox.html`), not sent |
| | **ClearPath** (screening company): a labelled stand-in page; the recruiter records the result by hand |
| The assistant: answers really are generated from the guides (Claude API or CLI, with an offline fallback) | The guides are fictional, not real bank policy |
| Manager Day 1 checklist, Day 1 details | Pre-start training status is seeded; there's no course |
| Laptop choice | Laptop pictures are our own illustrations, not manufacturer photos |

Branding comes from the public lloydsbankinggroup.com site (see [03 Architecture](03-architecture.md#branding)).
