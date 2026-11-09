// Shared bottom navigation for the joiner pages, including the unread-message count on Chats.
// Add class="joiner" to <body> and <script type="module" src="/js/joiner-shell.js"></script>.
import { api } from '/js/chat.js';

const NAV = [
  { id: 'journey', label: 'Journey', href: '/joiner/', icon: 'list-style-tick-rounded-black' },
  { id: 'guides', label: 'Guides', href: '/joiner/guides.html', icon: 'list-style-information-rounded-black' },
  { id: 'chat', label: 'Chats', href: '/joiner/chat.html', icon: 'quote' },
];

const make = (tag, props = {}, ...children) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...children.filter((c) => c != null && c !== false));
  return n;
};

const path = location.pathname;
const here = path.endsWith('/guides.html') ? 'guides' : path.endsWith('/chat.html') ? 'chat' : path === '/joiner/' || path.endsWith('/index.html') ? 'journey' : null;
const icon = (name) => make('img', { src: `/brand/icons/${name}.svg`, alt: '' });

const count = make('span', { className: 'nav-count', hidden: true });
document.body.append(make('nav', { className: 'jnav', ariaLabel: 'Main' },
  ...NAV.map((n) => {
    const a = make('a', { href: n.href }, icon(n.icon), make('span', { textContent: n.label }), n.id === 'chat' ? count : null);
    if (n.id === here) a.setAttribute('aria-current', 'page');
    return a;
  })));

// Unread count: on the Chats item, in the tab title, and as a 'chat:unread' event for the page.
const baseTitle = document.title;
let unread = 0;
async function refreshUnread() {
  try {
    const { conversations } = await api('/api/conversations');
    unread = conversations.reduce((n, c) => n + c.unread, 0);
  } catch { return; }
  count.textContent = unread > 99 ? '99+' : unread;
  count.hidden = !unread;
  document.querySelector('.jnav a[href="/joiner/chat.html"]').ariaLabel = unread ? `Chats, ${unread} unread` : 'Chats';
  document.title = `${unread ? `(${unread}) ` : ''}${baseTitle}`;
  document.dispatchEvent(new CustomEvent('chat:unread', { detail: { count: unread } }));
}
refreshUnread();
document.addEventListener('chat:changed', refreshUnread);

const sock = document.createElement('script');
sock.src = '/socket.io/socket.io.js';
sock.onload = () => {
  const s = window.io();
  for (const ev of ['message:new', 'conversation:read', 'conversations:changed', 'journey:updated']) s.on(ev, refreshUnread);
};
document.head.append(sock);
