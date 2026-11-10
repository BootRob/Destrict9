// The recruit's journey after activation:
//   conditional offer (accept/decline) -> screening form -> checks running ->
//   recruiter records the screening result -> unconditional offer (accept/reject) ->
//   connected to their hiring manager.
// Every action checks the current stage, so out-of-order or repeated requests are refused.
import { db } from './db.js';
import { sendEmail } from './mailer.js';
import { OnboardingError, q as aq, toApplicant, ownApplicant, transaction, now, firstName, fmtLongDate } from './onboarding.js';

const MAX_REASON = 500;
const TYPICAL_SCREENING = '2 to 4 weeks';

export const SCREENING_CHECKS = [
  { id: 'identity', label: 'Identity check' },
  { id: 'right_to_work', label: 'Right to work in the UK' },
  { id: 'employment', label: 'Employment history (last 3 years)' },
  { id: 'credit', label: 'Credit and financial check' },
  { id: 'criminal', label: 'Basic criminal record check' },
];

/** Laptops a new joiner can choose from once they've accepted (synthetic catalogue). */
export const DEVICES = {
  mac: {
    id: 'mac', name: 'Apple MacBook Pro 14-inch', image: '/img/devices/macbook-pro.svg',
    specs: ['Apple M-series chip', '16 GB memory', '512 GB storage', '14.2-inch Liquid Retina XDR display', 'macOS with the bank\'s managed apps'],
    bestFor: 'Software engineering, design and anyone building for Apple devices.',
  },
  hp: {
    id: 'hp', name: 'HP EliteBook 840 14-inch', image: '/img/devices/hp-elitebook.svg',
    specs: ['Intel Core Ultra processor', '16 GB memory', '512 GB storage', '14-inch WUXGA display with privacy screen', 'Windows 11 with every bank application'],
    bestFor: 'Most roles. Runs every bank application, including contact centre and branch systems.',
  },
};
const MAC_FIRST_ROLES = ['Software Engineer'];
const recommendedDevice = (jobTitle) => (MAC_FIRST_ROLES.includes(jobTitle) ? 'mac' : 'hp');
const CHANGE_CUTOFF_DAYS = 7; // laptops are prepared a week before the start date

const q = {
  chooseDevice: db.prepare(`UPDATE applicants SET device_choice = ?, device_chosen_at = ? WHERE id = ? AND journey_stage = 'accepted'`),
  acceptConditional: db.prepare(`UPDATE applicants SET journey_stage = 'screening', conditional_responded_at = ? WHERE id = ? AND journey_stage = 'conditional_offer'`),
  decline: db.prepare(`UPDATE applicants SET journey_stage = 'declined', declined_offer = ?, decline_reason = ? WHERE id = ? AND journey_stage = ?`),
  submitScreening: db.prepare(`UPDATE applicants SET journey_stage = 'screening_submitted', screening_submitted_at = ? WHERE id = ? AND journey_stage = 'screening'`),
  clear: db.prepare(`UPDATE applicants SET journey_stage = 'unconditional_offer', screening_result = 'clear', screening_result_at = ?, screening_note = ?, unconditional_sent_at = ? WHERE id = ? AND journey_stage = 'screening_submitted'`),
  notClear: db.prepare(`UPDATE applicants SET journey_stage = 'withdrawn', screening_result = 'not_clear', screening_result_at = ?, screening_note = ? WHERE id = ? AND journey_stage = 'screening_submitted'`),
  acceptUnconditional: db.prepare(`UPDATE applicants SET journey_stage = 'accepted', unconditional_responded_at = ? WHERE id = ? AND journey_stage = 'unconditional_offer'`),
  managerConv: db.prepare("SELECT id FROM conversations WHERE joiner_id = ? AND kind = 'manager'"),
  insertConv: db.prepare('INSERT INTO conversations (joiner_id, staff_id, kind) VALUES (?, ?, ?) RETURNING id'),
};

function applicantForJoiner(user) {
  const a = user?.role === 'joiner' ? aq.byUser.get(user.id) : undefined;
  if (!a) throw new OnboardingError(404, 'No offer found for your account');
  return a;
}

function requireStage(a, stage, message) {
  if (a.journey_stage !== stage) throw new OnboardingError(409, message ?? 'That step is not available right now');
}

/** Adds days to a YYYY-MM-DD date, returning YYYY-MM-DD. */
function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const today = () => new Date().toISOString().slice(0, 10);

/**
 * The recruit's five phases, from offer to "accelerating their career".
 * Phases 1 and 2 follow the recruitment stages; phases 3 to 5 follow the calendar from the start date.
 */
export const PHASES = [
  { id: 'offer',         name: 'Offer',              line: 'Saddling up' },
  { id: 'getting_ready', name: 'Getting ready',      line: 'Joining the stable' },
  { id: 'first_30',      name: 'First 30 days',      line: 'Finding your stride' },
  { id: 'days_30_60',    name: '30 to 60 days',      line: 'Setting your course' },
  { id: 'days_60_90',    name: '60 to 90 days',      line: 'Full horsepower' },
];

const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** Which phase the recruit is in today, and when it started (YYYY-MM-DD, or null). */
function phaseFor(a) {
  const start = a.start_date;
  const stage = a.journey_stage;
  const t = today();
  let id, startsOn = null;
  if (['conditional_offer', 'screening', 'screening_submitted', 'withdrawn'].includes(stage)
    || (stage === 'declined' && a.declined_offer !== 'unconditional')) {
    id = 'offer';
    startsOn = a.onboarded_at?.slice(0, 10) ?? null;
  } else if (stage !== 'accepted' || !start || t < start) {
    id = 'getting_ready';
    startsOn = a.unconditional_sent_at?.slice(0, 10) ?? null;
  } else {
    const day = daysBetween(start, t);
    id = day < 30 ? 'first_30' : day < 60 ? 'days_30_60' : 'days_60_90';
    startsOn = addDays(start, day < 30 ? 0 : day < 60 ? 30 : 60);
  }
  const n = PHASES.findIndex((p) => p.id === id) + 1;
  return { ...PHASES[n - 1], n, of: PHASES.length, startsOn };
}

/**
 * The whole journey for the tracker, grouped into the five phases.
 * state: done | current | upcoming | stopped. `on` is the date a calendar step begins (YYYY-MM-DD).
 * After the unconditional offer is accepted, "Get ready for Day 1" stays current until the start date,
 * then the calendar steps take over: Day 1 (first week), weeks 2 to 4, Day 30 (goals), Day 60 (career).
 */
function stepsFor(a) {
  const start = a.start_date;
  const on = (days) => (start ? addDays(start, days) : null);
  const defs = [
    { id: 'conditional_offer',   phase: 'offer',         label: 'Conditional offer',   at: a.conditional_responded_at },
    { id: 'screening',           phase: 'offer',         label: 'Screening details',   at: a.screening_submitted_at },
    { id: 'screening_submitted', phase: 'offer',         label: 'Screening checks',    at: a.screening_result_at },
    { id: 'unconditional_offer', phase: 'getting_ready', label: 'Unconditional offer', at: a.unconditional_responded_at },
    { id: 'accepted',            phase: 'getting_ready', label: 'Get ready for Day 1' },
    { id: 'day1',                phase: 'first_30',      label: 'Day 1 and your first week', on: on(0) },
    { id: 'settling_in',         phase: 'first_30',      label: 'Weeks 2 to 4',        on: on(7) },
    { id: 'day30',               phase: 'days_30_60',    label: 'Set your goals',      on: on(30) },
    { id: 'day60',               phase: 'days_60_90',    label: 'Grow your career',    on: on(60) },
  ];

  // Where the journey stopped, if it did.
  const stoppedAt = a.journey_stage === 'declined'
    ? (a.declined_offer === 'unconditional' ? 'unconditional_offer' : 'conditional_offer')
    : a.journey_stage === 'withdrawn' ? 'screening_submitted' : null;

  // Index of the current step.
  const idx = (id) => defs.findIndex((d) => d.id === id);
  let ci;
  if (stoppedAt) ci = idx(stoppedAt);
  else if (a.journey_stage !== 'accepted') ci = idx(a.journey_stage);
  else if (!start || today() < start) ci = idx('accepted');
  else {
    const day = daysBetween(start, today());
    ci = day < 7 ? idx('day1') : day < 30 ? idx('settling_in') : day < 60 ? idx('day30') : day < 90 ? idx('day60') : defs.length;
  }

  return defs.map((d, i) => ({
    id: d.id,
    phase: d.phase,
    label: d.label,
    state: i < ci ? 'done' : i === ci ? (stoppedAt ? 'stopped' : 'current') : 'upcoming',
    at: i < ci && d.at ? d.at : null,
    on: d.on ?? null,
  }));
}

/** One short, phase-specific tip for the welcome screen after login. */
function tipFor(a, phase) {
  const recruiter = a.recruiter_name ? firstName(a.recruiter_name) : 'Your recruiter';
  const manager = a.manager_name ? firstName(a.manager_name) : 'your manager';
  switch (a.journey_stage) {
    case 'conditional_offer': return `Take your time with your offer. ${recruiter} is one message away if anything's unclear.`;
    case 'screening': return 'Have your passport or driving licence to hand: ClearPath asks for it first.';
    case 'screening_submitted': return `No news is normal. Checks usually take ${TYPICAL_SCREENING}, and you don't need to do anything.`;
    case 'unconditional_offer': return "Your offer is unconditional now. Once you accept, it's safe to hand in your notice.";
    case 'declined': case 'withdrawn': return `${recruiter} is still here if you'd like to talk anything through.`;
    default: break;
  }
  switch (phase.id) {
    case 'getting_ready': return a.device_choice
      ? `Say hello to ${manager} before Day 1. A short message goes a long way.`
      : `Choose your laptop soon, so it's ready and waiting on Day 1.`;
    case 'first_30': return "Your first 30 days are for learning, not delivering. Ask all the questions.";
    case 'days_30_60': return `Now's the time to agree three clear goals with ${manager}.`;
    default: return 'Find a mentor and look at where your Lloyds career could go next.';
  }
}

/** Days until the start date (before it), or which day of the job it is (from Day 1). */
function calendarFor(a) {
  if (!a.start_date) return { daysToStart: null, dayNumber: null };
  const diff = daysBetween(today(), a.start_date);
  return diff > 0 ? { daysToStart: diff, dayNumber: null } : { daysToStart: 0, dayNumber: 1 - diff };
}

/** Whether (and until when) the recruit can choose or change their laptop. */
function deviceInfo(a) {
  const cutoff = a.start_date ? addDays(a.start_date, -CHANGE_CUTOFF_DAYS) : null;
  const open = a.journey_stage === 'accepted' && (!cutoff || today() <= cutoff);
  return {
    choice: a.device_choice, chosenAt: a.device_chosen_at,
    available: a.journey_stage === 'accepted', canChange: open, changeUntil: cutoff,
    recommended: recommendedDevice(a.job_title),
    options: [DEVICES[recommendedDevice(a.job_title)], DEVICES[recommendedDevice(a.job_title) === 'mac' ? 'hp' : 'mac']],
  };
}

/** Recruit chooses (or changes) their laptop. Open once the unconditional offer is accepted, until a week before the start date. */
export function chooseDevice(user, device) {
  const a = applicantForJoiner(user);
  if (!DEVICES[device]) throw new OnboardingError(400, 'Choose the MacBook or the HP');
  const info = deviceInfo(a);
  if (!info.available) throw new OnboardingError(409, 'You can choose your laptop once you have accepted your unconditional offer');
  if (!info.canChange) throw new OnboardingError(409, 'Your laptop is already being prepared. Ask your hiring manager if you need to change it.');
  q.chooseDevice.run(device, now(), a.id);
  return toApplicant(aq.byId.get(a.id));
}

/** Everything the recruit's journey screens need. */
export function journeyFor(user) {
  const a = applicantForJoiner(user);
  const phase = phaseFor(a);
  return {
    stage: a.journey_stage,
    phase: { ...phase, tip: tipFor(a, phase) },
    phases: PHASES,
    ...calendarFor(a),
    steps: stepsFor(a),
    offer: {
      jobTitle: a.job_title, location: a.location, salary: a.salary, contract: a.contract,
      startDate: a.start_date, hiringManager: a.manager_name, recruiter: a.recruiter_name,
      conditionalAcceptedAt: a.conditional_responded_at, unconditionalSentAt: a.unconditional_sent_at,
      unconditionalAcceptedAt: a.unconditional_responded_at,
    },
    screening: {
      submittedAt: a.screening_submitted_at,
      typicalDuration: TYPICAL_SCREENING,
      checks: SCREENING_CHECKS,
      result: a.screening_result,
      resultAt: a.screening_result_at,
      provider: { name: 'ClearPath Screening', url: '/clearpath.html' },
    },
    declinedOffer: a.declined_offer,
    device: deviceInfo(a),
    managerConversationId: q.managerConv.get(a.user_id)?.id ?? null,
  };
}

const fromRecruiter = (a) => `${a.recruiter_name} (Lloyds Banking Group)`;

/** Recruit accepts the conditional offer: screening opens and they're emailed the link. */
export function acceptConditional(user, origin) {
  const a = applicantForJoiner(user);
  requireStage(a, 'conditional_offer', 'This offer has already been answered');
  q.acceptConditional.run(now(), a.id);
  sendEmail({
    to: a.email, toName: a.name, fromName: fromRecruiter(a),
    subject: 'Next step: your pre-employment screening',
    body: [
      `Hi ${firstName(a.name)},`,
      '',
      `Thank you for accepting your conditional offer for the ${a.job_title} role. The next step is pre-employment screening.`,
      '',
      `You'll complete your details directly with ClearPath, our independent screening partner. They check your identity, right to work, recent employment history, credit history and basic criminal record. It usually takes ${TYPICAL_SCREENING}.`,
      '',
      "It's routine for everyone who joins a bank. Answer every question honestly: that's what matters.",
      '',
      'Best wishes,',
      a.recruiter_name,
    ].join('\n'),
    actionUrl: `${origin}/joiner/screening.html`,
    actionLabel: 'Start my screening',
  });
  return toApplicant(aq.byId.get(a.id));
}

/** Recruit declines either offer. */
export function declineOffer(user, which, reason) {
  const a = applicantForJoiner(user);
  const stage = which === 'unconditional' ? 'unconditional_offer' : which === 'conditional' ? 'conditional_offer' : null;
  if (!stage) throw new OnboardingError(400, 'Unknown offer');
  requireStage(a, stage, 'This offer has already been answered');
  const text = String(reason ?? '').trim().slice(0, MAX_REASON) || null;
  q.decline.run(which, text, a.id, stage);
  return toApplicant(aq.byId.get(a.id));
}

/**
 * Recruit confirms they've completed their details on ClearPath's own site.
 * The app never collects or stores personal details: ClearPath (the third party) does.
 */
export function submitScreening(user, origin) {
  const a = applicantForJoiner(user);
  requireStage(a, 'screening', a.journey_stage === 'screening_submitted' ? "You've already told us your details are with ClearPath" : 'Screening is not open yet');
  q.submitScreening.run(now(), a.id);
  sendEmail({
    to: a.email, toName: a.name, fromName: fromRecruiter(a),
    subject: 'Your screening checks are underway',
    body: [
      `Hi ${firstName(a.name)},`,
      '',
      `Thanks for completing your details with ClearPath, our screening partner. Your checks are now underway and usually take ${TYPICAL_SCREENING}.`,
      '',
      "You don't need to do anything else. If the screening company needs more information, they'll contact you directly. Your app shows where things are, and I'll be in touch as soon as there's news.",
      '',
      'Best wishes,',
      a.recruiter_name,
    ].join('\n'),
    actionUrl: `${origin}/joiner/`,
    actionLabel: 'Open my app',
  });
  return toApplicant(aq.byId.get(a.id));
}

/**
 * Recruiter records the screening provider's result. Clear sends the unconditional
 * offer; not clear withdraws the conditional offer. Returns the updated applicant.
 */
export function recordScreeningResult(recruiter, applicantId, result, note, origin) {
  const a = ownApplicant(recruiter, applicantId);
  requireStage(a, 'screening_submitted', 'There is no screening result waiting for this applicant');
  const text = String(note ?? '').trim().slice(0, MAX_REASON) || null;
  if (result === 'clear') {
    q.clear.run(now(), text, now(), a.id);
    sendEmail({
      to: a.email, toName: a.name, fromName: fromRecruiter(a),
      subject: `Your unconditional offer, ${firstName(a.name)}`,
      body: [
        `Hi ${firstName(a.name)},`,
        '',
        `Great news: your pre-employment screening is complete and clear. Your offer for the ${a.job_title} role is now unconditional.`,
        '',
        a.start_date ? `Your proposed start date is ${fmtLongDate(a.start_date)}.` : '',
        '',
        `Open your app to accept it. Once you do, you'll be connected with ${a.manager_name}, your hiring manager.`,
        '',
        'Best wishes,',
        a.recruiter_name,
      ].filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n'),
      actionUrl: `${origin}/joiner/offer.html`,
      actionLabel: 'View my unconditional offer',
    });
  } else if (result === 'not_clear') {
    q.notClear.run(now(), text, a.id);
    sendEmail({
      to: a.email, toName: a.name, fromName: fromRecruiter(a),
      subject: 'An update on your application',
      body: [
        `Hi ${firstName(a.name)},`,
        '',
        "Thank you for completing your pre-employment screening. Unfortunately we're unable to confirm your offer based on the results.",
        '',
        "I'd like to talk this through with you personally. You can message me in the app, and the screening company can tell you what they found and how to query it.",
        '',
        'Best wishes,',
        a.recruiter_name,
      ].join('\n'),
      actionUrl: `${origin}/joiner/`,
      actionLabel: 'Open my app',
    });
  } else {
    throw new OnboardingError(400, 'Result must be clear or not clear');
  }
  return toApplicant(aq.byId.get(a.id));
}

/**
 * Recruit accepts the unconditional offer: the hiring-manager chat opens.
 * Returns { applicant, managerConversation: { id, staffId } }.
 */
export function acceptUnconditional(user) {
  const a = applicantForJoiner(user);
  requireStage(a, 'unconditional_offer', a.journey_stage === 'accepted' ? "You've already accepted this offer" : 'Your unconditional offer is not ready yet');
  const managerConversation = transaction(() => {
    q.acceptUnconditional.run(now(), a.id);
    const existing = q.managerConv.get(a.user_id);
    const id = existing?.id ?? q.insertConv.get(a.user_id, a.hiring_manager_id, 'manager').id;
    return { id, staffId: a.hiring_manager_id };
  });
  return { applicant: toApplicant(aq.byId.get(a.id)), managerConversation };
}
