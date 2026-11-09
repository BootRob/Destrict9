# Demo script

For the **private qualifying walkthrough** (10 minutes on a phone, then 5 minutes of questions) and the **final** (10 minutes plus 3 minutes of questions). Rehearse it, and say out loud what's simulated.

## Before you start (5 minutes before)

1. Reset to a clean state: `cd app && npm run reset && npm start`. Discard any demo guide edits with `git checkout app/knowledge`.
2. **Phone:** open the app and leave it on the login page. If the app is still only running on a laptop, use the browser's device mode (F12, then Ctrl+Shift+M) at a phone size.
3. **Laptop window A (staff):** log in as **Jordan Ellis**, on **Applicants**.
4. **Laptop window B (private):** the demo mailbox, `/mailbox.html`.
5. Each browser window or private window keeps its own login. On localhost, cookies are shared across ports, so keep separate users in separate windows.

## The story (10 minutes)

| Time | Show | Say |
|---|---|---|
| 0:00 | The title | "Joining a bank means weeks of waiting between offer and Day 1, and Workday doesn't guide you through it. We built a companion that takes you from offer to Day 30." |
| 0:45 | **Jordan, Applicants**: the tiles, the table, and Grace's "unsuccessful" note | "The journey starts with the recruiter. Some candidates were successful, some weren't." |
| 1:30 | **Onboard** Ben, then read the confirmation box | "One click sends Ben his conditional offer. His account exists but is switched off until he activates it." |
| 2:00 | **Mailbox**: Ben's offer email, then **View my offer** | "Email is simulated in the prototype. In production this goes through an email service." |
| 2:30 | **Phone**: "Congratulations, Ben!", set a password | "The link is one-time and expires. We store only a hash of it." |
| 3:00 | **Phone, home**: the progress bar "Step 1 of 8" and the offer card | "Prompt 3, *where am I?*: eight steps from offer to Day 30." |
| 3:30 | **Offer**: terms, conditions, **Accept and continue to screening**. Point at **Jordan's screen updating live** | "Notice the advice not to resign yet. And Jordan sees it instantly." |
| 4:15 | **Screening**: reassurance, "Have these ready", **Go to ClearPath** | "We don't collect personal details at all. They go straight to the screening company." |
| 4:45 | Back, then **I've added my details**, then the checks with spinners | "Prompt 2, *honest progress*: what's being checked, the usual timeframe, no news is normal." |
| 5:30 | **Jordan**: Ben shows "Result needed", then **Record result**, **Clear** | "In real life the screening company returns this. The internal note never reaches Ben." |
| 6:00 | **Phone** updates: "Your unconditional offer is ready", **Accept offer** | "Now it's safe to resign. And acceptance opens the chat with his hiring manager." |
| 6:45 | **Choose your laptop**: MacBook or HP, recommendation, choose | "Prompt 6, *early choices*. It can be changed until a week before he starts." |
| 7:30 | **Message Sam**. Then log in as **Sam** in window A and reply live | "Prompt 7, *meet before you meet*." |
| 8:15 | **Sam, Day 1 checklist**: due dates, laptop choice shown, fill in the Day 1 details | "Prompt 8, *what's left?* Saving the details shows Ben a *Your first day* panel." |
| 9:00 | **Phone, assistant**: "What time do I start?" and then "Can I park?" | "It answers from our guides and today's Day 1 details, cites its sources, and hands off to a person when it should." |
| 9:40 | Close | "Real: login, messaging, the journey rules, the assistant. Simulated: email, the screening company, the seed data. Everything is synthetic." |

## Backup routes

- **No time to onboard live:** log in as **Priya**, who is already waiting for a screening result. As Jordan, use **Record result** on her and show both screens update.
- **Assistant slow or offline:** it automatically falls back to quoting the right guide section. Say so.
- **Wi-Fi blocks phone-to-laptop:** use device mode on the laptop, or the Azure deployment once it exists.

## Likely questions

| Question | Answer |
|---|---|
| What's real and what's simulated? | See [Overview](01-overview.md#real-vs-simulated). Email, the screening company and the accounts (no SSO) are stand-ins |
| How do you stop someone skipping a step? | A stage machine on the server. Every transition checks the current stage, and we have tests for out-of-order and repeated requests |
| Where does personal data go? | Nowhere in our app. Screening details go to the third party; we store only a timestamp |
| Why did you drop the buddy? | To focus the journey on the recruiter and manager and keep the scope tight. It would be easy to add back as a third conversation type |
| How was AI used? | Claude Code built most of the code, guided by a branding skill we made, with two sessions in parallel on separate git worktrees. The assistant uses Claude, grounded only in our guides. We checked the AI's work with around 110 end-to-end checks |
| What's next? | See the [build log](05-build-log.md#whats-next) |
