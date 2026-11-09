// Shared helpers for the manager and joiner chat screens.
// Message text is always rendered with textContent, never innerHTML.

export async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 401) {
    location.href = '/login.html';
    throw new Error('Not logged in');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export async function logout() {
  await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
  location.href = '/login.html';
}

export const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase();

export const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export function fmtDay(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Short relative label for list previews: 14:05, Yesterday, 3 Nov. */
export function fmtShort(iso) {
  const day = fmtDay(iso);
  return day === 'Today' ? fmtTime(iso) : day === 'Yesterday' ? day : new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const start = new Date(`${dateStr}T00:00:00`);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((start - today) / 86_400_000);
}

export const fmtDate = (dateStr) =>
  new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/**
 * Renders a scrolling message thread with day separators, own/their bubbles
 * and a "Seen" receipt under the latest own message once the other side reads it.
 */
export class Thread {
  constructor(listEl, meId) {
    this.listEl = listEl;
    this.meId = meId;
    this.messages = [];
  }

  set(messages) {
    this.messages = [...messages];
    this.render();
  }

  add(message) {
    if (this.messages.some((m) => m.id === message.id)) return;
    this.messages.push(message);
    this.render();
  }

  markReadBy(readerId, at) {
    let changed = false;
    for (const m of this.messages) {
      if (m.senderId !== readerId && !m.readAt) { m.readAt = at; changed = true; }
    }
    if (changed) this.render();
  }

  render() {
    const nearBottom = this.listEl.scrollHeight - this.listEl.scrollTop - this.listEl.clientHeight < 120;
    this.listEl.replaceChildren();

    if (!this.messages.length) {
      this.listEl.append(el('p', 'thread-empty', 'No messages yet. Say hello!'));
      return;
    }

    const lastMine = [...this.messages].reverse().find((m) => m.senderId === this.meId);
    let lastDay = null;
    for (const m of this.messages) {
      const day = fmtDay(m.createdAt);
      if (day !== lastDay) {
        this.listEl.append(el('div', 'day-sep', day));
        lastDay = day;
      }
      const mine = m.senderId === this.meId;
      const row = el('div', `msg ${mine ? 'msg--mine' : 'msg--theirs'}`);
      row.append(el('div', 'bubble', m.body));
      const meta = el('div', 'msg-meta', fmtTime(m.createdAt));
      if (mine && m === lastMine && m.readAt) meta.textContent += ' · Seen';
      row.append(meta);
      this.listEl.append(row);
    }

    if (nearBottom || this.forceScroll) {
      this.listEl.scrollTop = this.listEl.scrollHeight;
      this.forceScroll = false;
    }
  }

  scrollToEnd() {
    this.forceScroll = true;
    this.render();
  }
}

/** Wires a textarea + form: Enter sends, Shift+Enter adds a new line, auto-grows, emits typing. */
export function bindComposer(form, { onSend, onTyping }) {
  const input = form.querySelector('textarea');
  const button = form.querySelector('button[type="submit"]');
  let lastTyping = 0;

  const resize = () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
    button.disabled = !input.value.trim();
  };

  input.addEventListener('input', () => {
    resize();
    if (Date.now() - lastTyping > 1500) { lastTyping = Date.now(); onTyping?.(); }
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = input.value.trim();
    if (!body) return;
    button.disabled = true;
    try {
      await onSend(body);
      input.value = '';
    } finally {
      resize();
      input.focus();
    }
  });
  resize();
  return { input, setEnabled: (on) => { input.disabled = !on; resize(); if (!on) button.disabled = true; } };
}

/** Shows "Name is typing…" for a few seconds after each typing event. */
export function typingIndicator(node) {
  let timer;
  return (name) => {
    node.textContent = `${name.split(' ')[0]} is typing…`;
    node.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => { node.hidden = true; }, 3000);
  };
}

/** Promise wrapper around socket.emit with an acknowledgement. */
export function emitWithAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(8000).emit(event, payload, (err, res) => {
      if (err) return reject(new Error('Connection lost, message not sent'));
      if (res?.error) return reject(new Error(res.error));
      resolve(res);
    });
  });
}
