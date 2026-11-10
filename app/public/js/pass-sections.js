// The pass card fills in as the recruit progresses: it is split into five sections, one per phase, and
// the sections not yet reached are shown in greyscale (left to right). Its "card number" is a live
// 12-digit countdown to 9:30 on Day 1 (days padded to six digits, then hours, minutes and seconds),
// and once they have started it counts up from Day 1 instead.
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
  pass.append(num, ticks, mask);

  let start = null;
  let timer = null;
  const tick = () => {
    if (!start) { num.textContent = ''; return; }
    const s = Math.floor(Math.abs(start - Date.now()) / 1000);
    num.textContent = (pad(s / 86400, 6) + pad((s % 86400) / 3600) + pad((s % 3600) / 60) + pad(s % 60)).match(/.{4}/g).join(' ');
  };

  async function update(j, me) {
    const n = j?.phase?.n ?? 1;
    mask.style.left = `${n * 20}%`;
    mask.hidden = n >= 5;
    pass.setAttribute('aria-label', `Your joiner pass: phase ${n} of 5${j?.phase?.name ? `, ${j.phase.name}` : ''}`);
    start = me?.startDate ? new Date(`${me.startDate}T${await startTime()}:00`) : null;
    tick();
    if (!timer) timer = setInterval(tick, 1000);
  }
  return { update };
}
