# Demo runbook: two presenters, phone and laptop

A walkthrough of about 5 minutes for two people.
- **Presenter A** holds the **phone**, as the recruit.
- **Presenter B** drives the **laptop**, as the recruiter (Jordan) and the hiring manager (Sam).

The point of having two presenters is that the audience sees things happen **live, across both screens**:
- Jordan records a screening result, and the recruit's phone changes.
- The recruit messages their manager, and it arrives on the laptop as they type.

For the longer story (onboarding a new candidate from scratch), see the [demo script](04-demo-script.md).

Every password is `demo1234`. On the login page, tap a demo account to fill in the form.

## Before you start (10 minutes before)

1. **Reset the demo data.**
   - Priya's live steps change her state, so reset before every run-through.
   - Run this on the laptop that hosts the demo:
     ```bash
     cd ~/Hackathon/destrict9-demo/app && npm run reset
     ```
   - Then restart the server:
     ```bash
     PORT=3000 PUBLIC_URL=<tailnet address> npm start
     ```
2. **Phone (A):**
   - Open the app's tailnet address and stay on the login page.
   - Turn the brightness up and turn off auto-lock.
3. **Laptop (B):** set up two browser windows, side by side if you can.
   - **Window 1 (normal):** log in as **Jordan Ellis**, on **Applicants**.
   - **Window 2 (private):** log in as **Sam Reid**, on **Messages**.
   - Private windows keep their own login, so Jordan and Sam can both stay logged in.
4. **Check the Wi-Fi:** play the Wellington Place video once, so it's cached.

## The run

| # | Phone (A) | Laptop (B) | Say |
|---|---|---|---|
| 1 | Log in as **Priya Shah**. The **welcome screen** shows the pass card, "Phase 1 of 5 · Offer", "Saddling up, Priya" and the tip "No news is normal". Tap **Continue**. | | "Joining a bank means weeks of waiting. The app takes you from offer to Day 90 in five phases, and Priya's in phase one." |
| 2 | Home: the phase tracker shows **Phase 1 of 5**. Tap **See what's being checked**: the calm screening timeline, "usually done by" a date. | | "Prompt 2, *honest progress*: what's being checked, how long it usually takes, and that no news is normal." |
| 3 | Go back to **Home** and keep it in view. | **Jordan:** Priya shows **Result needed**. **Record result**, then **Clear**. | "In real life the screening company sends this. Watch the phone." |
| 4 | **Live:** the phone changes to "Your unconditional offer is ready". Tap **View and accept**, then **Accept**. | **Jordan's** table changes to *Accepted*, live. | "Now it's safe to resign, and accepting opens a chat with her hiring manager." |
| 5 | Home: phase **2 · Getting ready**, and the next step is **Choose your laptop**. Pick one, then come back. | | "Prompt 6, *early choices*." |
| 6 | **Chats**, then **Sam Reid**. Type *"Hi Sam! Anything I should read before I start?"* and send. | **Sam:** the message arrives with an unread badge, and the typing indicator shows while A types. Reply: *"Welcome Priya! I'll send your Day 1 details today."* | "Prompt 7, *meet before you meet*: a private, live chat with the manager before Day 1." |
| 7 | | **Sam:** open **Day 1 checklist**, then **Priya**. The laptop she chose is already there. Fill in the **Day 1 details** (9:30am, Reception, Sam Reid, Smart casual, a phone number) and **Save**. | "Prompt 8, *what's left?*: due dates counted back from the start date, and the laptop choice flows through." |
| 8 | **Guides:** the **Your first day** panel now shows Sam's details. | | "One person's action unlocks the next person's view. That's prompt 9, *chain reactions*." |
| 9 | Log out (tap the initials, top right). Log in as **Ruby Ahmed**: "Finding your stride, Ruby", Day 12. **Continue**, then **See your first 30 days**. | | "After Day 1 it keeps going. Ruby's on Day 12: what to do now, the guides, and colleague videos for her role and city." |
| 10 | **Ask the onboarding assistant:** *"What mandatory training do I need to do, and by when?"* Point at the sources. | | "Prompt 11, *9pm on a Sunday*. It answers from our guides, cites them, and hands off to a person when it should." |
| 11 | Log out, then log in as **Tom Bennett** (Day 45). **Set your goals** shows the **PREVIEW** badge. In the strip at the top, tap **5. 60 to 90 days**: "Full horsepower", the Epic Journey advert. | | "Goals, a development plan, then growing your Lloyds career. Phases 4 and 5 are previews, and we say so." |
| 12 | | Close. | "Real: login, live messaging, the journey rules, the assistant. Simulated: email, the screening company, the seed data. Everything is synthetic." |

**Timing:**
- Steps 1 to 8 take about 3 minutes.
- Steps 9 to 12 take about 2 minutes.
- If time is short, skip step 7 and step 8, or skip step 10.

## If something goes wrong

| Problem | What to do |
|---|---|
| The phone doesn't update live at step 4 | Pull down to refresh. The state is right, only the live push was missed. |
| The assistant is slow (more than 10 seconds) | Keep talking: "it's reading the guides". If the model fails, it falls back to quoting the right guide section. |
| The video won't play | Show the thumbnail and say what it is. Don't wait for it. |
| You logged in as the wrong person | Tap the initials (top right) to log out. |
| You need to run it again | Reset (see *Before you start*). Priya goes back to waiting for her screening. |
