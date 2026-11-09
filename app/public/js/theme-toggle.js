// The light/dark switch. `makeThemeToggle({ label })` returns a button; the choice is saved in localStorage.
const MOON = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M21 14.5A9 9 0 0 1 9.5 3a9 9 0 1 0 11.5 11.5z"/></svg>';
const SUN = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/></g></svg>';

const root = document.documentElement;
const current = () => (root.dataset.theme === 'dark' ? 'dark' : 'light');

function apply(theme) {
  root.dataset.theme = theme;
  try { localStorage.setItem('theme', theme); } catch { /* not saved, still applies for this visit */ }
  const joiner = document.body.classList.contains('joiner'); // the joiner app uses the stone/near-black "Pass" palette
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? (joiner ? '#070908' : '#101312') : (joiner ? '#ece8e0' : '#024731'));
  document.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
}

export function makeThemeToggle({ label = false } = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `theme-toggle${label ? ' theme-toggle--label' : ''}`;
  const sync = () => {
    const dark = current() === 'dark';
    btn.setAttribute('aria-pressed', String(dark));
    btn.setAttribute('aria-label', 'Dark mode');
    btn.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
    btn.innerHTML = (dark ? SUN : MOON) + (label ? `<span>${dark ? 'Light mode' : 'Dark mode'}</span>` : '');
  };
  btn.addEventListener('click', () => apply(current() === 'dark' ? 'light' : 'dark'));
  document.addEventListener('themechange', sync);
  sync();
  return btn;
}
