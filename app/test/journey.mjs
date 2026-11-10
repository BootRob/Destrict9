// Recruiter onboarding and the full recruit journey. Needs a fresh database; run with `npm test`.
import { DatabaseSync } from 'node:sqlite';
import { ok, login, req, json, post, next, connect, mailFor, tokenOf } from './lib.mjs';

const jordan = await login('jordan.ellis@example.com');
const leah = await login('leah.thompson@example.com');
const sam = await login('sam.reid@example.com');
const alex = await login('alex.kim@example.com');
const priya = await login('priya.shah@example.com');

// ---------- applicants list and permissions
let list = (await json('/api/applicants', jordan.cookie)).applicants;
const count = (stage) => list.filter((a) => a.stage === stage).length;
ok(list.length === 13, `Jordan sees his 13 applicants (got ${list.length})`);
ok(count('successful') === 3 && count('accepted') === 4 && count('screening_submitted') === 1 && count('unsuccessful') === 3 && count('interviewing') === 2,
  'stages: 3 ready, 4 accepted, 1 result needed, 3 unsuccessful, 2 interviewing');
ok(!list.some((a) => a.name === 'Liam Scott'), "Jordan can't see Leah's candidates");
ok((await json('/api/applicants', leah.cookie)).applicants.length === 2, 'Leah sees only her 2');
ok((await req('/api/applicants', sam.cookie)).status === 403, 'managers cannot list applicants');
ok((await req('/api/applicants', alex.cookie)).status === 403, 'recruits cannot list applicants');
ok((await req('/staff/applicants.html', sam.cookie)).headers.get('location') === '/', 'manager redirected away from applicants page');
const find = (name) => list.find((a) => a.name === name);
const [ben, chloe, grace, kate, alexApp, priyaApp] = ['Ben Carter', 'Chloe Evans', 'Grace Lee', 'Kate Hughes', 'Alex Kim', 'Priya Shah'].map(find);
ok((await post(`/api/applicants/${grace.id}/onboard`, jordan.cookie)).status === 409, 'unsuccessful applicant cannot be onboarded');
ok((await post(`/api/applicants/${kate.id}/onboard`, jordan.cookie)).status === 409, 'interviewing applicant cannot be onboarded');
ok((await post(`/api/applicants/${alexApp.id}/onboard`, jordan.cookie)).status === 409, 'already-onboarded applicant cannot be onboarded again');
ok((await post(`/api/applicants/${ben.id}/onboard`, leah.cookie)).status === 404, "another recruiter can't onboard Jordan's candidate");
ok((await post(`/api/applicants/${ben.id}/onboard`, sam.cookie)).status === 403, "a manager can't onboard");

// ---------- onboard Ben = conditional offer sent
const jordanSock = await connect(jordan.cookie);
const samSock = await connect(sam.cookie);
let samListChanged = 0; samSock.on('conversations:changed', () => samListChanged++);
const r = await post(`/api/applicants/${ben.id}/onboard`, jordan.cookie);
ok(r.status === 200 && (await r.json()).applicant.stage === 'invited', 'onboarding Ben sends the offer (invited until he activates)');
ok((await post(`/api/applicants/${ben.id}/onboard`, jordan.cookie)).status === 409, 'double onboarding refused');
const benLoginEarly = await login('ben.carter@example.org', 'whatever');
ok(benLoginEarly.status === 403 && /activation link/.test(benLoginEarly.body.error), 'invited account cannot log in yet');
const [offerMail] = await mailFor('ben.carter@example.org');
ok(/Your offer from Lloyds Banking Group, Ben/.test(offerMail.subject) && /conditional on pre-employment screening/.test(offerMail.body), 'offer email explains the offer is conditional');
const db = new DatabaseSync(process.env.DB_PATH, { readOnly: true });
ok(db.prepare('SELECT token_hash FROM invites').all().every((x) => /^[0-9a-f]{64}$/.test(x.token_hash) && x.token_hash !== tokenOf(offerMail)), 'only a hash of the activation token is stored');

// activation
const updActivated = next(jordanSock, 'applicant:updated');
const act = await post('/api/activate', '', { token: tokenOf(offerMail), password: 'correct horse battery' });
const benCookie = (act.headers.get('set-cookie') || '').split(';')[0];
ok(act.status === 200 && benCookie.startsWith('sid='), 'Ben activates and is signed in');
ok((await updActivated).stage === 'conditional_offer', 'recruiter sees Ben move to "Conditional offer" live');
ok((await post('/api/activate', '', { token: tokenOf(offerMail), password: 'another one!' })).status === 410, 'activation link works only once');

let j = (await json('/api/journey', benCookie)).journey;
ok(j.stage === 'conditional_offer' && j.offer.salary === '£48,000' && j.offer.hiringManager === 'Sam Reid', 'Ben sees his conditional offer with role, salary and manager');
ok(j.steps.length === 9 && j.steps.map((s) => s.label).join('|') === 'Conditional offer|Screening details|Screening checks|Unconditional offer|Get ready for Day 1|Day 1 and your first week|Weeks 2 to 4|Set your goals|Grow your career', 'journey runs from offer to Day 90 (9 steps)');
ok(j.phases.map((p) => p.id).join('|') === 'offer|getting_ready|first_30|days_30_60|days_60_90' && j.steps.map((s) => s.phase).join('|') === 'offer|offer|offer|getting_ready|getting_ready|first_30|first_30|days_30_60|days_60_90', 'steps are grouped into the five phases');
ok(j.phase.id === 'offer' && j.phase.n === 1 && j.phase.of === 5 && j.phase.line && j.phase.tip && j.daysToStart > 0 && j.dayNumber === null, 'Ben is in phase 1 (Offer), counting down to his start date, with a tip');
ok(j.steps[0].state === 'current' && j.steps.slice(1).every((s) => s.state === 'upcoming'), 'first step is current, the rest upcoming');
ok(j.steps[5].on === '2027-01-04' && j.steps[6].on === '2027-01-11' && j.steps[7].on === '2027-02-03' && j.steps[8].on === '2027-03-05', 'Day 1, week 2, Day 30 and Day 60 are dated from the start date');
let benConvs = (await json('/api/conversations', benCookie)).conversations;
ok(benConvs.length === 1 && benConvs[0].kind === 'recruiter', 'Ben can only message his recruiter so far');
ok(samListChanged === 0 && !(await json('/api/conversations', sam.cookie)).conversations.some((c) => c.joiner.name === 'Ben Carter'), 'hiring manager is not connected yet');

// out-of-order actions are refused
ok((await post('/api/journey/screening', benCookie, { form: {} })).status === 409, "can't submit screening before accepting the offer");
ok((await post('/api/journey/unconditional/accept', benCookie)).status === 409, "can't accept an unconditional offer that doesn't exist");
ok((await post('/api/journey/device', benCookie, { device: 'mac' })).status === 409, "can't choose a laptop before accepting");
ok((await req('/api/journey', sam.cookie)).status === 403, 'staff have no journey endpoint');

// accept conditional
const benSock = await connect(benCookie);
const upd1 = next(jordanSock, 'applicant:updated');
j = (await (await post('/api/journey/conditional/accept', benCookie)).json()).journey;
ok(j.stage === 'screening' && j.steps[0].state === 'done' && j.steps[1].state === 'current', 'accepting moves Ben to the screening form');
ok((await upd1).stage === 'screening', 'recruiter sees it live');
ok((await post('/api/journey/conditional/accept', benCookie)).status === 409, 'accepting twice is refused');
ok((await mailFor('ben.carter@example.org')).some((e) => /Next step: your pre-employment screening/.test(e.subject) && e.actionUrl.endsWith('/joiner/screening.html')), 'screening link emailed');

// screening: details go to ClearPath (third party); the app only records that it's done
ok(j.screening.provider?.url === '/clearpath.html', 'screening points the recruit to ClearPath');
ok((await req('/clearpath.html')).status === 200, 'ClearPath stand-in page is served');
const upd2 = next(jordanSock, 'applicant:updated');
// Even if a client sends personal details, the server ignores them.
const sneaky = { form: { legalName: 'Benjamin Testcase Carter', postcode: 'ZZ1 1ZZ', dateOfBirth: '1995-05-05' } };
j = (await (await post('/api/journey/screening', benCookie, sneaky)).json()).journey;
ok(j.stage === 'screening_submitted' && j.steps[2].state === 'current' && j.screening.checks.length === 5, '"I\'ve added my details" moves Ben to checks in progress');
ok((await upd2).stage === 'screening_submitted', 'recruiter sees "Result needed" live');
const row = db.prepare('SELECT * FROM applicants WHERE name = ?').get('Ben Carter');
ok(!JSON.stringify(row).match(/Benjamin|ZZ1|1995-05-05/) && !('screening_summary' in row), 'no personal details are collected or stored');
ok((await mailFor('ben.carter@example.org')).some((e) => /checks are underway/i.test(e.subject)), 'confirmation email sent');
ok((await post('/api/journey/screening', benCookie)).status === 409, 'confirming twice is refused');

// recruiter records the result
ok((await post(`/api/applicants/${ben.id}/screening-result`, leah.cookie, { result: 'clear' })).status === 404, "another recruiter can't record Ben's result");
ok((await post(`/api/applicants/${ben.id}/screening-result`, sam.cookie, { result: 'clear' })).status === 403, "a manager can't record results");
ok((await post(`/api/applicants/${ben.id}/screening-result`, jordan.cookie, { result: 'maybe' })).status === 400, 'invalid result rejected');
const benNotified = next(benSock, 'journey:updated');
const rr = await post(`/api/applicants/${ben.id}/screening-result`, jordan.cookie, { result: 'clear', note: 'All checks returned clear' });
ok(rr.status === 200 && (await rr.json()).applicant.stage === 'unconditional_offer', 'clear result sends the unconditional offer');
await benNotified; ok(true, "Ben's screen is told live");
ok((await mailFor('ben.carter@example.org')).some((e) => /Your unconditional offer, Ben/.test(e.subject)), 'unconditional offer emailed');
ok((await post(`/api/applicants/${ben.id}/screening-result`, jordan.cookie, { result: 'clear' })).status === 409, 'result cannot be recorded twice');

// accept unconditional -> connected to manager
const samChanged = next(samSock, 'conversations:changed');
const upd3 = next(jordanSock, 'applicant:updated');
j = (await (await post('/api/journey/unconditional/accept', benCookie)).json()).journey;
ok(j.stage === 'accepted' && j.managerConversationId, 'accepting the unconditional offer connects Ben to his manager');
ok(j.steps.slice(0, 4).every((s) => s.state === 'done') && j.steps[4].state === 'current' && j.phase.id === 'getting_ready', 'progress: offer steps done, getting ready for Day 1 (phase 2)');
await samChanged; ok(true, 'Sam is told live');
ok((await upd3).stage === 'accepted', 'recruiter sees "Accepted" live');
benConvs = (await json('/api/conversations', benCookie)).conversations;
ok(benConvs.length === 2 && benConvs.some((c) => c.kind === 'manager' && c.other.name === 'Sam Reid'), 'Ben now has a chat with Sam');
const samGot = next(samSock, 'message:new');
await benSock.emitWithAck('message:send', { conversationId: j.managerConversationId, body: 'Hi Sam, excited to join!' });
ok((await samGot).body === 'Hi Sam, excited to join!', "Sam receives Ben's first message live, no reload");
ok((await post('/api/journey/unconditional/accept', benCookie)).status === 409, 'accepting twice is refused');

// laptop choice
ok(j.device.available && j.device.canChange && !j.device.choice && j.device.recommended === 'hp', 'laptop choice opens after acceptance (HP recommended for this role)');
ok(j.device.options.length === 2 && j.device.options.every((o) => o.image && o.specs.length >= 4), 'both laptops come with picture and specs');
ok((await post('/api/journey/device', benCookie, { device: 'chromebook' })).status === 400, 'unknown laptop rejected');
j = (await (await post('/api/journey/device', benCookie, { device: 'mac' })).json()).journey;
ok(j.device.choice === 'mac', 'Ben chooses the MacBook');
j = (await (await post('/api/journey/device', benCookie, { device: 'hp' })).json()).journey;
ok(j.device.choice === 'hp', 'and can change his mind before the cut-off');
ok((await json('/api/applicants', jordan.cookie)).applicants.find((a) => a.name === 'Ben Carter').device === 'hp', 'recruiter can see the laptop choice');
const alexJ = (await json('/api/journey', alex.cookie)).journey;
ok(alexJ.device.recommended === 'mac', 'MacBook is recommended for software engineers');
ok((await req('/api/img/x')).status === 404 && (await req('/img/devices/macbook-pro.svg')).status === 200 && (await req('/img/devices/hp-elitebook.svg')).status === 200, 'laptop pictures are served');

// ---------- not clear path (Priya, seeded mid-screening)
const priyaNotified = next(await connect(priya.cookie), 'journey:updated');
const nc = await post(`/api/applicants/${priyaApp.id}/screening-result`, jordan.cookie, { result: 'not_clear', note: 'Discrepancy in employment dates' });
ok(nc.status === 200 && (await nc.json()).applicant.stage === 'withdrawn', 'not clear withdraws the offer');
await priyaNotified; ok(true, "Priya's screen is told live");
const pj = (await json('/api/journey', priya.cookie)).journey;
ok(pj.stage === 'withdrawn' && pj.steps[2].state === 'stopped' && pj.managerConversationId === null, 'Priya sees where it stopped, and is not connected to the manager');
ok((await mailFor('priya.shah@example.com')).some((e) => /update on your application/i.test(e.subject) && !/Discrepancy/.test(e.body)), 'gentle email sent; internal note not shared');

// ---------- decline path (Chloe)
await post(`/api/applicants/${chloe.id}/onboard`, jordan.cookie);
const chloeAct = await post('/api/activate', '', { token: tokenOf((await mailFor('chloe.evans@example.org'))[0]), password: 'chloe-password' });
const chloeCookie = (chloeAct.headers.get('set-cookie') || '').split(';')[0];
ok((await post('/api/journey/decline', chloeCookie, { offer: 'unconditional' })).status === 409, "can't decline an offer that isn't the current one");
const dec = await post('/api/journey/decline', chloeCookie, { offer: 'conditional', reason: 'Accepted a role closer to home' });
const cj = (await dec.json()).journey;
ok(dec.status === 200 && cj.stage === 'declined' && cj.steps[0].state === 'stopped', 'Chloe declines; her journey shows it stopped at the offer');
const chloeRow = (await json('/api/applicants', jordan.cookie)).applicants.find((a) => a.name === 'Chloe Evans');
ok(chloeRow.stage === 'declined' && chloeRow.declineReason === 'Accepted a role closer to home', 'recruiter sees the decline and the reason');
ok((await post('/api/journey/conditional/accept', chloeCookie)).status === 409, "can't accept after declining");

[jordanSock, samSock, benSock].forEach((s) => s.close());
process.exit();
