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
export function renderTracker(steps) {
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

  const list = make('ol', { className: 'tracker', ariaLabel: 'Your journey, offer to Day 30' }, ...steps.map((s) => {
    const li = make('li', { className: s.state },
      make('span', { className: 'dot' }, s.state === 'done' ? make('img', { src: '/brand/icons/checked.svg', alt: '' }) : null),
      make('span', { textContent: SHORT_LABELS[s.id] ?? s.label }),
      s.on ? make('small', { textContent: fmtDay(s.on) }) : null);
    li.title = `${s.label}: ${s.state}${s.on ? ` (${fmtDay(s.on)})` : ''}`;
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

export function mountJourney(container, { onOpenChat } = {}) {
  async function refresh() {
    try {
      const { journey } = await api('/api/journey');
      container.replaceChildren(
        make('h2', { textContent: 'Your journey' }),
        renderTracker(journey.steps),
        card(journey, onOpenChat));
      container.hidden = false;
      return journey;
    } catch {
      container.hidden = true; // no offer on this account (for example, seeded before onboarding existed)
      return null;
    }
  }
  refresh();
  return { refresh };
}
