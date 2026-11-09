// The recruit's progress tracker and "what's next" card on the joiner home screen.
// Usage: const journey = mountJourney(document.getElementById('journey'), { onOpenChat });
//        socket.on('journey:updated', journey.refresh);
import { api, fmtDate } from '/js/chat.js';

const SHORT_LABELS = { conditional_offer: 'Offer', screening: 'Details', screening_submitted: 'Checks', unconditional_offer: 'Final offer', accepted: 'Manager', day1: 'Day 1', week1: 'Week 1', day30: 'Day 30' };
const fmtDay = (ymd) => new Date(`${ymd}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

const make = (tag, props = {}, ...children) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...children.filter((c) => c != null && c !== false));
  return n;
};
const link = (href, label, kind = 'primary') => make('a', { className: `lbg-btn lbg-btn--${kind}`, href, textContent: label });
const fmtWhen = (iso) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** Filled bar with "Step N of M" plus the step-by-step tracker, from offer to Day 30. */
export function renderTracker(steps, { selected, onSelect } = {}) {
  const done = steps.filter((s) => s.state === 'done').length;
  const current = steps.find((s) => s.state === 'current' || s.state === 'stopped');
  const pct = Math.round(((done + (current?.state === 'current' ? 0.5 : 0)) / steps.length) * 100);
  const label = !current ? 'Journey complete: welcome to the team!'
    : current.state === 'stopped' ? `Stopped at: ${current.label}`
    : `Step ${steps.indexOf(current) + 1} of ${steps.length}: ${current.label}`;

  const bar = make('div', { className: 'progress' },
    make('div', { className: 'progress-label' }, make('strong', { textContent: label }), make('span', { textContent: `${pct}%` })),
    make('div', { className: 'progress-track', role: 'progressbar', ariaValueMin: 0, ariaValueMax: 100, ariaValueNow: pct, ariaLabel: 'Journey progress' },
      make('span', { className: 'progress-fill', style: `width:${pct}%` })));

  const list = make('ol', { className: 'tracker', ariaLabel: 'Your journey, offer to Day 30. Select a step for details.' }, ...steps.map((s) => {
    const btn = make('button', { type: 'button', className: 'tracker-step', ariaPressed: String(s.id === selected) },
      make('span', { className: 'dot' }, s.state === 'done' ? make('img', { src: '/brand/icons/checked.svg', alt: '' }) : null),
      make('span', { textContent: SHORT_LABELS[s.id] ?? s.label }),
      s.on ? make('small', { textContent: fmtDay(s.on) }) : null);
    btn.title = `${s.label}: ${s.state}${s.on ? ` (${fmtDay(s.on)})` : ''}`;
    btn.addEventListener('click', () => onSelect?.(s.id));
    const li = make('li', { className: `${s.state}${s.id === selected ? ' selected' : ''}` }, btn);
    if (s.state === 'current') li.setAttribute('aria-current', 'step');
    return li;
  }));
  list.style.setProperty('--steps', steps.length);
  return make('div', { className: 'journey-progress' }, bar, list);
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
        : `You're connected with ${o.hiringManager}, your hiring manager. Message them any time, and choose your laptop.`;
      t.rows = [row('Hiring manager', o.hiringManager), row('Laptop', j.device?.choice ? DEVICE_NAMES[j.device.choice] : j.device?.available ? 'Not chosen yet' : null)];
      t.link = j.device?.available ? ['/joiner/device.html', j.device.choice ? 'Your laptop' : 'Choose your laptop'] : null;
      break;
    case 'day1':
      t.text = 'Your first day. Your hiring manager will have your equipment and Day 1 plan ready.';
      t.rows = [row('Date', o.startDate && fmtDate(o.startDate)), row('Location', o.location)];
      t.link = ['/joiner/guides.html', 'Read the first-day guides'];
      break;
    case 'week1':
      t.text = 'Your first week: meeting the team, getting set up and learning how things work.';
      t.rows = [row('Week ends', step.on && fmtDate(step.on))];
      t.link = ['/joiner/guides.html', 'Read the guides'];
      break;
    case 'day30':
      t.text = 'Thirty days in: a check-in on how you feel connected and confident.';
      t.rows = [row('Date', step.on && fmtDate(step.on))];
      break;
    default:
  }
  t.rows = t.rows.filter(Boolean);
  return t;
}

function detailPanel(step, j) {
  const d = stepDetail(step, j);
  return make('div', { className: `step-detail step-detail--${step.state}`, role: 'region', ariaLabel: `${d.title} details` },
    make('p', { className: 'eyebrow', textContent: d.status }),
    make('h3', { textContent: d.title }),
    d.text ? make('p', { textContent: d.text }) : null,
    d.rows.length ? make('dl', { className: 'terms' }, ...d.rows.map(([k, v]) => make('div', {}, make('dt', { textContent: k }), make('dd', { textContent: v })))) : null,
    d.link ? make('a', { className: 'lbg-btn lbg-btn--secondary', href: d.link[0], textContent: d.link[1] }) : null);
}

export function mountJourney(container, { onOpenChat } = {}) {
  let selected = null; // step id the user clicked; null shows the next-step card
  let last = null;

  function render(journey) {
    const step = journey.steps.find((s) => s.id === selected);
    container.replaceChildren(
      make('h2', { textContent: 'Your journey' }),
      renderTracker(journey.steps, {
        selected,
        onSelect: (id) => { selected = selected === id ? null : id; render(last); },
      }),
      step ? detailPanel(step, journey) : card(journey, onOpenChat),
      step ? make('button', { type: 'button', className: 'link-btn step-back', textContent: 'Back to your next step', onclick: () => { selected = null; render(last); } }) : null);
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
