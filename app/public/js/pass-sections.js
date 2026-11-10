// The pass card fills in as the recruit progresses: it is split into five sections, one per phase, and
// the sections not yet reached are shown in greyscale (left to right). Its "card number" is the
// recruit's start date and time as a 16-digit card number, 0000 DDMM YYYY HHMM (for example 0000 3011 2026 0930), using the
// recruit's start date and time as 12 digits, DDMM YYYY HHMM (for example 3011 2026 0930), using the
// manager's Day 1 time if they've shared it, or 9:30am. The bottom-right corner shows the days to go
// (or, once they've started, which day of the job it is).
//   const sections = mountPassSections(document.getElementById('pass'));
//   sections.update(journey, me);   // call again whenever the journey changes; the grey edge slides along

import { api } from '/js/chat.js';

const pad = (n, w = 2) => String(Math.max(0, Math.floor(n))).padStart(w, '0');
const make = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };

/** The Day 1 start time: from the manager's Day 1 details if they've shared them, otherwise 9:30am. */
async function startTime() {
  try {
    const { day1 } = await api('/api/day1');
    const m = String(day1?.time ?? '').match(/(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?/i);
    if (m) {
      let h = Number(m[1]);
      if (m[3]?.toLowerCase() === 'pm' && h < 12) h += 12;
      return `${pad(h)}:${m[2] ?? '00'}`;
    }
  } catch { /* fall back to the guides' 9:30am */ }
  return '09:30';
}

export function mountPassSections(pass) {
  pass.classList.add('sect');
  const num = make('div', { className: 'num12', ariaHidden: 'true' });
  const ticks = make('div', { className: 'ticks', ariaHidden: 'true' }, ...Array.from({ length: 5 }, () => make('i')));
  const mask = make('div', { className: 'mask', ariaHidden: 'true' });
  const cornerLabel = make('span');
  const cornerValue = make('b');
  const corner = make('div', { className: 'dtg' }, cornerLabel, cornerValue);
  pass.append(num, corner, ticks, mask);

  async function update(j, me) {
    const n = j?.phase?.n ?? 1;
    mask.style.left = `${n * 20}%`;
    mask.hidden = n >= 5;
    pass.setAttribute('aria-label', `Your joiner card: phase ${n} of 5${j?.phase?.name ? `, ${j.phase.name}` : ''}`);
    const started = Boolean(j?.dayNumber);
    corner.hidden = !started && j?.daysToStart == null;
    cornerLabel.textContent = started ? 'Today is day' : 'Days to go';
    cornerValue.textContent = String(started ? j.dayNumber : j?.daysToStart ?? '');
    if (!me?.startDate) { num.textContent = ''; return; }
    const [yyyy, mm, dd] = me.startDate.split('-');
    num.textContent = `0000 ${dd}${mm} ${yyyy} ${(await startTime()).replace(':', '')}`; // 16 digits, like a card number
    num.textContent = `${dd}${mm} ${yyyy} ${(await startTime()).replace(':', '')}`;
  }
  return { update };
}
