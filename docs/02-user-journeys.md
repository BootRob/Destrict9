# User journeys

Every screen, by role. The demo accounts all use the password `demo1234`.

## Demo accounts and their starting state

| Account | Role | Starting state |
|---|---|---|
| jordan.ellis@example.com | Recruiter | 11 applicants. Ben, Chloe and Daniel are ready to onboard; Priya needs a screening result |
| leah.thompson@example.com | Recruiter | 2 applicants of her own (shows recruiters only see their own) |
| sam.reid@example.com | Hiring manager (Leeds) | Connected to Alex. Priya is still in screening, so not yet |
| hannah.price@example.com | Hiring manager (Cardiff) | Connected to Owen |
| alex.kim@example.com | Recruit | Unconditional offer accepted, starts 30 Nov, laptop not chosen yet, part-way through the manager's checklist |
| priya.shah@example.com | Recruit | Finished with ClearPath, waiting for the screening result |
| owen.davies@example.com | Recruit | Offer accepted, HP laptop chosen |
| ruby.ahmed@example.com | Recruit | Day 12, Software Engineer in Leeds: phase 3, First 30 days. Manager Sam |
| tom.bennett@example.com | Recruit | Day 45, Customer Service Advisor in Cardiff: phase 4, 30 to 60 days. Manager Hannah |

Candidates who haven't been onboarded (Ben, Chloe, Daniel and others) have no account until the recruiter onboards them.

---

## Recruiter (desktop)

The staff app has a green **left sidebar**: Applicants, Messages and Guides, with the user's name and **Log out** at the bottom.

### Applicants (`/staff/applicants.html`)
- **Filter tiles** with counts: All, Ready to onboard, Result needed, Offer in progress, Accepted, Interviewing, Unsuccessful or declined.
- **Table** columns: candidate (name and personal email), role and location, hiring manager, applied date, start date, status pill with a one-line note, and action. The table is searchable.
- **Actions by status:**

| Status | Note shown | Action |
|---|---|---|
| Successful | e.g. "Verbal offer accepted 6 Nov" | **Onboard** |
| Offer sent (not activated) | "Sent 9 Nov · account not activated yet" | **Resend invite**, **View email** |
| Conditional offer / Screening form / Unconditional offer | Waiting for them, with dates | **Message** |
| Result needed | "Finished with ClearPath 9 Nov" | **Record result** |
| Accepted | "Accepted 9 Nov · laptop: HP EliteBook" | **Message** |
| Declined / Offer withdrawn / Unsuccessful | Reason or interview note | – |

- **Onboard** opens a confirmation explaining what will happen: the offer email, the chat with the recruiter, and the steps until they meet their manager. On confirm, the row flips to "Offer sent" and a pop-up links to the email.
- **Record result** asks: Clear (sends the unconditional offer) or Not clear (withdraws the offer), plus an optional internal note that the recruit never sees.
- **Live:** every step the recruit takes updates the row immediately, with a pop-up such as "Ben accepted their conditional offer" or "Ben has finished with ClearPath".

### Messages (`/staff/`)
- Left: the recruits this person is connected to, each with role, days until start ("invite sent, not activated yet" if still invited), last message and an unread badge.
- Middle: the chat, with typing indicator, "Seen" receipts and a send box.
- Right: joining details (start date, location, role) and **their people**, meaning who their recruiter and hiring manager are. You can see who's involved, not their other chats.
- The Messages entry in the sidebar shows the total unread count.

### Guides (`/staff/guides.html`)
Recruiters and managers read, edit (Markdown with a live preview) and add onboarding guides. Each guide shows who last edited it. If two people edit at once, the second save is refused rather than overwriting the first.

---

## Recruit (phone)

### 1. The offer email and activation (`/activate.html`)
- **Email**, read on the demo mailbox: "Your offer from Lloyds Banking Group, Ben". It explains the offer is conditional on pre-employment screening, and has a **View my offer** button.
- **Activation page:** "Congratulations, Ben!", with role, location and proposed start date. The login email is pre-filled, and they choose and confirm a password (at least 8 characters).
- **Link rules:** the link works once and expires in 7 days. Resending kills the old link. Clear messages explain each case: used, expired, replaced, invalid.

### 2. Welcome screen (`/joiner/welcome.html`)
Shown once after each login and after activation. The pass card animates in with the recruit's phase, its horse line (for example "Joining the stable") and one tip for that phase. It stays until the recruit taps **Continue**, so there's time to read the tip.

### 3. Home screen (`/joiner/`)
From top to bottom:
- **Header:** "Hi Ben", role and location, and a days-to-go countdown.
- **Your journey:**
  - The **pass card**: its chip shows the phase, and its look changes with it.
  - A **five-part phase tracker** with one progress measure, for example "Phase 2 of 5". Tapping a phase opens its phase screen.
  - Nine steps grouped under the phases: conditional offer, screening details and screening checks (Offer); unconditional offer and getting ready for Day 1 (Getting ready); Day 1 and the first week, and weeks 2 to 4 (First 30 days); set your goals (30 to 60 days); grow your career (60 to 90 days). Calendar steps show their dates.
  - A **next-step card** that changes with the stage (see the table below).
- **Onboarding assistant** card, then **Your guides** card.
- **Your people:** the recruiter and the hiring manager. Until the unconditional offer is accepted, the manager card reads "You'll be connected with your hiring manager once you accept your unconditional offer".

| Stage | Next-step card |
|---|---|
| Conditional offer | "Your conditional offer is ready", **View your offer** |
| Screening | "Complete your pre-employment screening" (via ClearPath), **Start screening** |
| Checks running | "Your screening is underway… No news is normal", **See what's being checked** |
| Unconditional offer | "Your unconditional offer is ready", **View and accept** |
| Accepted, no laptop yet | "Choose your laptop", with a picture, **Choose your laptop** and **Message Sam** |
| Accepted | "See you on Mon 4 Jan", **Message Sam** and **Your laptop** |
| Declined | "You declined the offer", **Message Jordan** |
| Not clear | "We couldn't confirm your offer… Jordan would like to talk it through", **Message Jordan** |

### 4. Offer (`/joiner/offer.html`)
- **Terms:** role, location, salary, contract, start date, hiring manager and recruiter.
- **Conditional offer:**
  - The conditions are spelled out (screening checks), along with "please don't hand in your notice until your offer becomes unconditional".
  - Buttons: **Accept and continue to screening** or **Decline offer**.
- **Unconditional offer:**
  - "It's now safe to hand in your notice."
  - Buttons: **Accept offer** or **Reject offer**.
- **Declining:**
  - A bottom sheet asks for an optional reason and confirms ("Keep my offer" or "Yes, decline").
  - The recruiter sees the reason.

### 5. Screening (`/joiner/screening.html`)
The app **doesn't collect personal details**. Screening is done with ClearPath, the third party.
- Reassurance comes first: everyone who joins a bank is screened, and being honest is what matters.
- **How it works**, in three steps: go to ClearPath, complete your details there (about 15 minutes), then come back and tap "I've added my details".
- **Have these ready:** passport or driving licence, 5 years of addresses, 3 years of employment or study, and National Insurance number.
- **Go to ClearPath** opens the third party's site in a new tab. In the prototype that's `/clearpath.html`, a deliberately non-LBG page labelled as simulated.
- **I've added my details** asks for confirmation, then shows the five checks with "In progress" spinners: identity, right to work, employment history, credit, and basic criminal record. Each turns to "Clear" when the recruiter records a clear result.

### 6. Laptop (`/joiner/device.html`)
Available once the unconditional offer is accepted:
- **Two cards:** an Apple MacBook Pro 14-inch and an HP EliteBook 840. Each has a large illustration, the specs, and who it's best for.
- **Recommendation:** a "Recommended for Software Engineers" tag on the Mac for engineers, and on the HP for every other role.
- **Choosing:** the recruit picks one and confirms. They see "It'll be set up and waiting for you on day 1. Collect it from reception."
- **Changing:** allowed until 7 days before the start date. After that, the hiring manager arranges it.

### 7. Messaging
- **Recruiter chat:** open from onboarding. A welcome message is waiting.
- **Hiring manager chat:** opens when the unconditional offer is accepted.
- **Live features:** delivery, typing indicators, unread badges and read receipts.

### 8. Phase screen (`/joiner/phase.html?id=<phase>`)
Opened from the phase tracker. With no `id`, it shows the recruit's current phase.
- **Tabs** for all five phases, with "Now" on the current one, and a "Next" link at the bottom.
- **Header:** "Phase 3 of 5 · You are here", the phase name, what it's about, and its horse line.
- **What to do now:** three or four numbered actions. Those with a screen or a guide link straight to it (for example **Choose your laptop** in phase 2).
- **Guides for this phase:** for example, phase 3 lists the first 30 days week by week, LBG systems and ways of working, and mandatory training.
- **Watch:** up to three official Lloyds Banking Group videos, picked for the phase, the recruit's role and their city. A video loads from `youtube-nocookie.com` only when its thumbnail is tapped.
- Phases 4 and 5 carry a **Preview** label and the note "A preview of what's coming".

### 9. Onboarding assistant and guides
- **Assistant:**
  - Answers questions from the onboarding guides and cites which guides it used.
  - Puts the answer first, in about 60 words, with the key fact in bold and bullets for lists.
  - When it can't answer, or the question is personal (their own salary or check results), it hands off with a button, for example **Ask Jordan**, that opens the right person's chat with the question pre-filled.
  - Once the manager has shared Day 1 details, it also uses them to answer questions like "What time do I start?".
- **Guides (`/joiner/guides.html`):** 19 synthetic guides, including the journey, pre-employment checks, first day and week, pay, hybrid working, laptop and IT, purpose, values, getting to the office, the first 30 days week by week, LBG systems and ways of working, mandatory training, goals and a development plan, and growing your career. Once the manager shares Day 1 details, a **Your first day** panel appears at the top.

---

## Hiring manager (desktop)

### Messages (`/staff/`)
- A recruit appears here once they accept their unconditional offer. The list refreshes live when that happens.
- The layout is the same as for recruiters: a recruit list, the chat, and a details panel.

### Day 1 checklist (`/staff/checklist.html`)
Per recruit:
- **Items with due dates**, counted back in working days from the start date and flagged **overdue** if they slip:
  - laptop and peripherals (showing the recruit's choice)
  - access badge
  - accounts and system access
  - reception told
  - desk
  - induction and IT setup
  - team lunch
  - welcome message
- **Optional items** (workplace adjustments, shift or rota) can be marked **Not needed**.
- **Self-ticking items:**
  - "Welcome message sent" ticks once the manager has messaged the recruit.
  - "Day 1 details shared" ticks once the Day 1 form is filled in.
- **Day 1 details form:** start time, where to meet, who meets them, dress code and a phone number. Saving it shows the recruit a **Your first day** panel and feeds the assistant.
- **Pre-start training:** whether the recruit has finished it (finishing earns the Day 1 lunch), with a **Send a reminder** button that posts in their chat.

### Guides
The same as for recruiters: read, edit and add.

---

## Demo mailbox (`/mailbox.html`)
A stand-in for the recruit's personal inbox, clearly labelled. It lists every email the app would have sent: the offer and activation link, a new link, the next step for screening, checks underway, the unconditional offer, and an update on the application. It can be filtered by recipient (`?to=`), and each email shows its action button. It must be turned off (`DEMO_MAILBOX=off`) anywhere real, because anyone who can open it could activate invited accounts.
