// The recruit's progress tracker and "what's next" card on the joiner home screen.
// Usage: const journey = mountJourney(document.getElementById('journey'), { onOpenChat });
//        socket.on('journey:updated', journey.refresh);
import { api, fmtDate } from '/js/chat.js';

const fmtDay = (ymd) => new Date(`${ymd}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

const make = (tag, props = {}, ...children) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...children.filter((c) => c != null && c !== false));
  return n;
};
const link = (href, label, kind = 'primary') => make('a', { className: `lbg-btn lbg-btn--${kind}`, href, textContent: label });
const fmtWhen = (iso) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * The five phases as a tappable tracker, with one progress measure ("Phase 2 of 5").
 * Each phase shows a dot per step inside it; tapping a phase opens its details.
 */
export function renderTracker(j, { selected, onSelect } = {}) {
  const { steps, phases, phase } = j;
  const stopped = steps.find((s) => s.state === 'stopped');
  const complete = steps.every((s) => s.state === 'done');
  const label = complete ? 'Journey complete: welcome to the herd!'
    : stopped ? `Stopped at: ${stopped.label}`
    : `Phase ${phase.n} of ${phase.of}: ${phase.name}`;
  const done = steps.filter((s) => s.state === 'done').length;
  const pct = Math.round((done / steps.length) * 100);

  const bar = make('div', { className: 'progress' },
    make('div', { className: 'progress-label' }, make('strong', { textContent: label }), make('span', { className: 'phase-line', textContent: phase.line })),
    make('div', { className: 'progress-track', role: 'progressbar', ariaValueMin: 0, ariaValueMax: steps.length, ariaValueNow: done, ariaValueText: label, ariaLabel: 'Journey progress' },
      make('span', { className: 'progress-fill', style: `width:${pct}%` })));

  const list = make('ol', { className: 'phase-tracker', ariaLabel: 'Your five phases. Select a phase for details.' }, ...phases.map((p, i) => {
    const mine = steps.filter((s) => s.phase === p.id);
    const state = mine.some((s) => s.state === 'stopped') ? 'stopped'
      : mine.every((s) => s.state === 'done') ? 'done'
      : p.id === phase.id ? 'current' : 'upcoming';
    const btn = make('button', { type: 'button', className: 'phase-btn', ariaPressed: String(p.id === selected) },
      make('span', { className: 'phase-dots', ariaHidden: 'true' }, ...mine.map((s) => make('i', { className: s.state }))),
      make('span', { className: 'phase-name', textContent: p.name }));
    btn.title = `Phase ${i + 1}: ${p.name} (${state})`;
    btn.addEventListener('click', () => onSelect?.(p.id));
    const li = make('li', { className: `${state}${p.id === selected ? ' selected' : ''}` }, btn);
    if (state === 'current') li.setAttribute('aria-current', 'step');
    return li;
  }));
  return make('div', { className: 'journey-progress' }, bar, list);
}

const phaseLink = (id, label, kind = 'primary') => link(`/joiner/phase.html?id=${id}`, label, kind);

/** The next-step card once the recruit has started: what this phase is about, and who to talk to. */
function startedCard(j, chatBtn) {
  const o = j.offer;
  const mgr = o.hiringManager?.split(' ')[0];
  const msg = j.managerConversationId && mgr ? chatBtn('manager', `Message ${mgr}`, 'secondary') : null;
  const eyebrow = make('p', { className: 'eyebrow', textContent: `Day ${j.dayNumber} · ${j.phase.name}` });
  switch (j.phase.id) {
    case 'first_30':
      return make('div', { className: 'next-step' }, eyebrow,
        make('h3', { textContent: j.dayNumber <= 7 ? 'Your first week' : 'Finding your stride' }),
        make('p', { textContent: j.dayNumber <= 7
          ? 'Get set up, meet your team and start your mandatory training. Nobody expects you to deliver yet.'
          : 'Book intro chats with the people you work with, finish your mandatory training, and learn how your team works.' }),
        phaseLink('first_30', 'See your first 30 days'), msg);
    case 'days_30_60':
      return make('div', { className: 'next-step' }, eyebrow,
        make('h3', { textContent: `Agree your goals with ${mgr ?? 'your manager'}` }),
        make('p', { textContent: 'By Day 60, have three clear goals and a development plan that you have agreed together.' }),
        phaseLink('days_30_60', 'Set your goals'), msg);
    default:
      return make('div', { className: 'next-step' }, eyebrow,
        make('h3', { textContent: 'Full horsepower' }),
        make('p', { textContent: 'Find a mentor, join a colleague network and look at where your Lloyds career could go next.' }),
        phaseLink('days_60_90', 'Grow your career'), msg);
  }
}

function card(j, onOpenChat) {
  const o = j.offer;
  const chatBtn = (kind, label, style = 'primary') => {
    const b = make('button', { type: 'button', className: `lbg-btn lbg-btn--${style}`, textContent: label });
    b.addEventListener('click', () => onOpenChat?.(kind));
    return b;
  };
  switch (j.stage) {
    case 'conditional_offer':
      return make('div', { className: 'next-step lbg-surface--racing' },
        make('p', { className: 'eyebrow', textContent: 'Your next step' }),
        make('h3', { textContent: 'Your conditional offer is ready' }),
        make('p', { textContent: `${o.jobTitle} in ${o.location}${o.salary ? `, ${o.salary} a year` : ''}. It's conditional on pre-employment screening, which comes next.` }),
        link('/joiner/offer.html', 'View your offer', 'on-dark'));
    case 'screening':
      return make('div', { className: 'next-step lbg-surface--racing' },
        make('p', { className: 'eyebrow', textContent: 'Your next step' }),
        make('h3', { textContent: 'Complete your pre-employment screening' }),
        make('p', { textContent: "You'll add your details on ClearPath's secure site, our screening partner. It takes about 15 minutes. Screening is routine for everyone who joins a bank: answer honestly and there's nothing to worry about." }),
        link('/joiner/screening.html', 'Start screening', 'on-dark'));
    case 'screening_submitted':
      return make('div', { className: 'next-step' },
        make('p', { className: 'eyebrow', textContent: 'Checks in progress' }),
        make('h3', { textContent: 'Your screening is underway' }),
        make('p', { textContent: `You finished with ClearPath on ${fmtWhen(j.screening.submittedAt)}. Checks usually take ${j.screening.typicalDuration}. No news is normal, and there's nothing you need to do.` }),
        link('/joiner/screening.html', "See what's being checked", 'secondary'));
    case 'unconditional_offer':
      return make('div', { className: 'next-step lbg-surface--racing' },
        make('p', { className: 'eyebrow', textContent: 'Screening complete' }),
        make('h3', { textContent: 'Your unconditional offer is ready' }),
        make('p', { textContent: `Your checks are clear. Accept your offer to be connected with ${o.hiringManager}, your hiring manager.` }),
        link('/joiner/offer.html', 'View and accept', 'accent'));
    case 'accepted':
      if (j.dayNumber) return startedCard(j, chatBtn);
      if (j.device?.available && !j.device.choice && j.device.canChange) {
        return make('div', { className: 'next-step lbg-surface--racing' },
          make('p', { className: 'eyebrow', textContent: 'Your next step' }),
          make('h3', { textContent: 'Choose your laptop' }),
          make('p', { textContent: `MacBook Pro or HP EliteBook: pick the one that suits you and it'll be ready on day 1. You're also now connected with ${o.hiringManager}, your hiring manager.` }),
          make('img', { src: j.device.options[0].image, alt: '', className: 'next-step-img' }),
          link('/joiner/device.html', 'Choose your laptop', 'accent'),
          j.managerConversationId ? chatBtn('manager', `Message ${o.hiringManager.split(' ')[0]}`, 'on-dark') : null);
      }
      return make('div', { className: 'next-step' },
        make('p', { className: 'eyebrow', textContent: "You're all set" }),
        make('h3', { textContent: o.startDate ? `See you on ${fmtDate(o.startDate)}` : "You're joining us" }),
        make('p', { textContent: `You're now connected with ${o.hiringManager}, your hiring manager. Say hello and ask anything about the role or your first week.` }),
        j.managerConversationId ? chatBtn('manager', `Message ${o.hiringManager.split(' ')[0]}`) : null,
        j.device?.choice ? link('/joiner/device.html', 'Your laptop', 'secondary') : null);
    case 'declined':
      return make('div', { className: 'next-step next-step--quiet' },
        make('h3', { textContent: 'You declined the offer' }),
        make('p', { textContent: `Thanks for letting us know. ${o.recruiter} has been told. You can still message them if anything changes.` }),
        chatBtn('recruiter', `Message ${o.recruiter.split(' ')[0]}`, 'secondary'));
    case 'withdrawn':
      return make('div', { className: 'next-step next-step--quiet' },
        make('h3', { textContent: "We couldn't confirm your offer" }),
        make('p', { textContent: `Your screening result means we can't go ahead with your offer right now. ${o.recruiter} would like to talk it through with you, and the screening company can explain what they found.` }),
        chatBtn('recruiter', `Message ${o.recruiter.split(' ')[0]}`));
    default:
      return null;
  }
}

const DEVICE_NAMES = { mac: 'Apple MacBook Pro 14-inch', hp: 'HP EliteBook 840 14-inch' };

/** What happened (or will happen) at a step, for the panel under the tracker. */
function stepDetail(step, j) {
  const o = j.offer;
  const when = (iso) => (iso ? fmtWhen(iso) : null);
  const row = (label, value) => (value ? [label, value] : null);
  const t = { title: step.label, status: { done: 'Completed', current: 'In progress', upcoming: 'Coming up', stopped: 'Stopped here' }[step.state], rows: [], text: '', link: null };

  switch (step.id) {
    case 'conditional_offer':
      t.text = j.declinedOffer === 'conditional'
        ? 'You declined the conditional offer.'
        : `The offer is for ${o.jobTitle} in ${o.location}, conditional on pre-employment screening.`;
      t.rows = [row('Role', o.jobTitle), row('Location', o.location), row('Salary', o.salary && `${o.salary} a year`), row('Contract', o.contract), row('Recruiter', o.recruiter), row('Accepted', when(o.conditionalAcceptedAt))];
      t.link = ['/joiner/offer.html', 'View your offer'];
      break;
    case 'screening':
      t.text = step.state === 'upcoming' ? "Screening opens once you've accepted your conditional offer."
        : "You add your details on ClearPath's secure site, our screening partner. We don't collect them in this app.";
      t.rows = [row('Provider', j.screening.provider.name), row('Details submitted', when(j.screening.submittedAt))];
      t.link = step.state === 'upcoming' ? null : ['/joiner/screening.html', 'Screening details'];
      break;
    case 'screening_submitted':
      t.text = step.state === 'upcoming' ? 'ClearPath runs your checks after you submit your details.'
        : j.screening.result === 'not_clear' ? "The checks didn't come back clear, so we can't go ahead with your offer right now."
        : j.screening.result === 'clear' ? 'Your checks came back clear.'
        : `Checks usually take ${j.screening.typicalDuration}. No news is normal, and there's nothing you need to do.`;
      t.rows = [...j.screening.checks.map((c) => [c.label, step.state === 'done' ? 'Clear' : 'Pending']), row('Result recorded', when(j.screening.resultAt))];
      break;
    case 'unconditional_offer':
      t.text = j.declinedOffer === 'unconditional' ? 'You declined the unconditional offer.'
        : step.state === 'upcoming' ? 'Your unconditional offer is sent once screening is clear.'
        : 'Your checks are clear and the final offer is confirmed.';
      t.rows = [row('Sent', when(o.unconditionalSentAt)), row('Accepted', when(o.unconditionalAcceptedAt))];
      t.link = step.state === 'upcoming' ? null : ['/joiner/offer.html', 'View your offer'];
      break;
    case 'accepted':
      t.text = step.state === 'upcoming' ? `You're connected with ${o.hiringManager}, your hiring manager, once you accept your unconditional offer.`
        : step.state === 'done' ? `You got ready with ${o.hiringManager}: laptop chosen, Day 1 details shared and pre-start training done.`
        : `You're connected with ${o.hiringManager}, your hiring manager. Choose your laptop, read your Day 1 details and do your pre-start training.`;
      t.rows = [row('Hiring manager', o.hiringManager), row('Start date', o.startDate && fmtDate(o.startDate)), row('Laptop', j.device?.choice ? DEVICE_NAMES[j.device.choice] : j.device?.available ? 'Not chosen yet' : null)];
      t.link = j.device?.available && !j.dayNumber ? ['/joiner/device.html', j.device.choice ? 'Your laptop' : 'Choose your laptop'] : null;
      break;
    case 'day1':
      t.text = 'Day 1 and your first week: meeting the team, getting set up and starting your mandatory training.';
      t.rows = [row('Day 1', o.startDate && fmtDate(o.startDate)), row('Location', o.location)];
      t.link = [`/joiner/phase.html?id=${step.phase}`, 'Your first 30 days'];
      break;
    case 'settling_in':
      t.text = 'Weeks 2 to 4: intro chats, learning our systems and ways of working, and finishing your training.';
      t.rows = [row('From', step.on && fmtDate(step.on))];
      t.link = [`/joiner/phase.html?id=${step.phase}`, 'Your first 30 days'];
      break;
    case 'day30':
      t.text = 'Days 30 to 60: agree clear goals and a development plan with your manager.';
      t.rows = [row('From', step.on && fmtDate(step.on))];
      t.link = [`/joiner/phase.html?id=${step.phase}`, 'Goals and development'];
      break;
    case 'day60':
      t.text = 'Day 60 to 90 and beyond: mentoring, networks and growing your Lloyds career.';
      t.rows = [row('From', step.on && fmtDate(step.on))];
      t.link = [`/joiner/phase.html?id=${step.phase}`, 'Grow your career'];
      break;
    default:
  }
  t.rows = t.rows.filter(Boolean);
  return t;
}

const STATE_TEXT = { done: 'Done', current: 'Now', upcoming: 'Coming up', stopped: 'Stopped here' };

/** Details for one phase: its steps, and what the most relevant step means for the recruit. */
function phasePanel(phaseId, j) {
  const n = j.phases.findIndex((p) => p.id === phaseId);
  const p = j.phases[n];
  const mine = j.steps.filter((s) => s.phase === phaseId);
  const focus = mine.find((s) => s.state === 'current' || s.state === 'stopped')
    ?? (mine.every((s) => s.state === 'done') ? mine.at(-1) : mine[0]);
  const d = stepDetail(focus, j);
  const status = mine.every((s) => s.state === 'done') ? 'Completed' : phaseId === j.phase.id ? 'You are here' : 'Coming up';
  return make('div', { className: 'step-detail phase-detail', role: 'region', ariaLabel: `${p.name} details` },
    make('p', { className: 'eyebrow', textContent: `Phase ${n + 1} · ${status}` }),
    make('h3', { textContent: p.name }),
    make('p', { className: 'phase-line', textContent: p.line }),
    make('ol', { className: 'phase-steps' }, ...mine.map((s) => make('li', { className: s.state },
      make('span', { textContent: s.label }),
      make('small', { textContent: s.state === 'upcoming' && s.on ? fmtDate(s.on) : STATE_TEXT[s.state] })))),
    d.text ? make('p', { textContent: d.text }) : null,
    d.rows.length ? make('dl', { className: 'terms' }, ...d.rows.map(([k, v]) => make('div', {}, make('dt', { textContent: k }), make('dd', { textContent: v })))) : null,
    d.link ? make('a', { className: 'lbg-btn lbg-btn--secondary', href: d.link[0], textContent: d.link[1] }) : null);
}

export function mountJourney(container, { onOpenChat } = {}) {
  let selected = null; // phase id the user tapped; null shows the next-step card
  let last = null;

  function render(journey) {
    const open = journey.phases.some((p) => p.id === selected);
    container.replaceChildren(...[
      make('h2', { textContent: 'Your journey' }),
      renderTracker(journey, {
        selected,
        onSelect: (id) => { selected = selected === id ? null : id; render(last); },
      }),
      open ? phasePanel(selected, journey) : card(journey, onOpenChat),
      open ? make('button', { type: 'button', className: 'link-btn step-back', textContent: 'Back to your next step', onclick: () => { selected = null; render(last); } }) : null,
    ].filter(Boolean)); // replaceChildren would print a null child as the text "null"
    container.hidden = false;
  }

  async function refresh() {
    try {
      const { journey } = await api('/api/journey');
      last = journey;
      render(journey);
      return journey;
    } catch {
      container.hidden = true; // no offer on this account (for example, seeded before onboarding existed)
      return null;
    }
  }
  refresh();
  return { refresh };
}
