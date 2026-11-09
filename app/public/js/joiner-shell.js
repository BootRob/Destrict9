// Shared bottom navigation and chat button for the joiner pages.
// Add class="joiner" to <body> and <script type="module" src="/js/joiner-shell.js"></script>.
const NAV = [
  { id: 'journey', label: 'Journey', href: '/joiner/', icon: 'list-style-tick-rounded-black' },
  { id: 'guides', label: 'Guides', href: '/joiner/guides.html', icon: 'list-style-information-rounded-black' },
];

const make = (tag, props = {}, ...children) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...children.filter((c) => c != null && c !== false));
  return n;
};

const here = location.pathname.endsWith('/guides.html') ? 'guides' : location.pathname === '/joiner/' || location.pathname === '/joiner/index.html' ? 'journey' : null;
const icon = (name) => make('img', { src: `/brand/icons/${name}.svg`, alt: '' });

const count = make('span', { className: 'nav-count', hidden: true });
const chats = make('button', { type: 'button' }, icon('quote'), make('span', { textContent: 'Chats' }), count);
chats.addEventListener('click', () => window.chatWidget?.open());
document.addEventListener('chatwidget:unread', ({ detail }) => { count.textContent = detail.count; count.hidden = !detail.count; });

document.body.append(make('nav', { className: 'jnav', ariaLabel: 'Main' },
  ...NAV.map((n) => {
    const a = make('a', { href: n.href }, icon(n.icon), make('span', { textContent: n.label }));
    if (n.id === here) a.setAttribute('aria-current', 'page');
    return a;
  }),
  chats));

await import('/js/chat-widget.js');
