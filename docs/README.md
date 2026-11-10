# District 9: joiner companion, project documentation

Team District 9's entry for **LaunchPad '26**, the Modern Workplace Engineering hackathon at Wellington Place, Leeds, on 9 to 10 November 2026.

The app is a mobile-first companion that takes a new joiner from **offer to feeling connected and confident**, in five phases that run to Day 90. It comes with a desktop web app for the recruiters and hiring managers who support them. Everything in it is synthetic, so no real people, data or policies.

| Document | What it covers |
|---|---|
| [01 Overview](01-overview.md) | The challenge, what we built, how it maps to the brief and the judging categories, and what's real versus simulated |
| [02 User journeys](02-user-journeys.md) | Every screen, by role: recruit, recruiter and hiring manager |
| [03 Architecture](03-architecture.md) | Stack, code map, data model, API, real-time events, security and privacy, testing |
| [04 Demo script](04-demo-script.md) | A timed walkthrough for the 10-minute qualifying demo and the final |
| [05 Build log](05-build-log.md) | What we built on Day 1 and Day 2, the decisions and why, how the team worked, and what's left |
| [06 Morning plan](06-morning-plan.md) | The Day 2 plan agreed at 08:00: the five phases, the three parallel workstreams and their file ownership, the shared API contract, the videos, the timeline and the demo order |

For **running the app**, see [`app/README.md`](../app/README.md). It has setup, demo accounts, configuration and the full API tables. These documents explain the *why* and the *how it fits together*; the app README is the operating manual.

## Quick start

```bash
cd app
npm install
npm start            # http://localhost:3000
```

The password for every demo account is `demo1234`. Start as **Jordan Ellis** (recruiter) to follow the journey from the beginning.
