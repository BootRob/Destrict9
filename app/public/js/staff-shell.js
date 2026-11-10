// Shared layout for the staff web app: left sidebar with role-based navigation,
// the signed-in user and log out. Each staff page has <nav id="staff-nav"> and calls
// `const me = await mountShell('messages')` (or 'applicants', 'checklist', 'guides').
import { api, logout, initials } from '/js/chat.js';
import { makeThemeToggle } from '/js/theme-toggle.js';

const NAV = [
  { id: 'applicants', label: 'Applicants', href: '/staff/applicants.html', icon: '/brand/icons/job-type.svg', roles: ['recruiter'] },
  { id: 'messages', label: 'Messages', href: '/staff/', icon: '/brand/icons/quote.svg', roles: ['manager', 'recruiter'] },
  { id: 'checklist', label: 'Day 1 checklist', href: '/staff/checklist.html', icon: '/brand/icons/list-style-tick-rounded-black.svg', roles: ['manager'] },
  { id: 'guides', label: 'Guides', href: '/staff/guides.html', icon: '/brand/icons/list-style-information-rounded-black.svg', roles: ['manager', 'recruiter'] },
];
export const HUB_TITLES = { manager: 'Manager hub', recruiter: 'Recruiter hub' };

const make = (tag, props = {}, ...children) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...children.filter((c) => c !== null && c !== undefined && c !== false));
  return n;
};

export async function mountShell(active) {
  const { user: me } = await api('/api/me');
  const nav = document.getElementById('staff-nav');
  nav.setAttribute('aria-label', 'Main');

  const items = NAV.filter((item) => item.roles.includes(me.role)).map((item) => {
    const link = make('a', { href: item.href },
      make('img', { src: item.icon, alt: '' }),
      make('span', { textContent: item.label }),
      make('span', { className: 'nav-badge', hidden: true }));
    link.dataset.nav = item.id;
    if (item.id === active) link.setAttribute('aria-current', 'page');
    return make('li', {}, link);
  });

  const logoutBtn = make('button', { type: 'button', className: 'link-btn', textContent: 'Log out' });
  logoutBtn.addEventListener('click', logout);

  nav.replaceChildren(
    make('a', { className: 'brand', href: '/' },
      make('img', { src: '/brand/logos/lbg-logo-white.svg', alt: 'Lloyds Banking Group' }),
      make('span', { textContent: HUB_TITLES[me.role] ?? 'Staff hub' })),
    make('ul', {}, ...items),
    make('div', { className: 'me' },
      make('span', { className: 'avatar', textContent: initials(me.name) }),
      make('span', { className: 'who' },
        make('strong', { textContent: me.name }),
        make('small', { textContent: `${me.roleLabel} · ${me.jobTitle}` })),
      make('div', { className: 'me-actions' }, logoutBtn, makeThemeToggle())),
  );

  // Unread count on Messages, wherever you are in the hub.
  api('/api/conversations')
    .then(({ conversations }) => setNavBadge('messages', conversations.reduce((n, c) => n + c.unread, 0)))
    .catch(() => {});

  return me;
}

export function setNavBadge(id, count) {
  const badge = document.querySelector(`#staff-nav a[data-nav="${id}"] .nav-badge`);
  if (!badge) return;
  badge.textContent = count;
  badge.hidden = !count;
}
