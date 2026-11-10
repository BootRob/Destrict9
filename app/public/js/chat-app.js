// The in-app chat screen: conversation list, a thread with composer, and (for joiners) the onboarding assistant.
// Usage: mountChat(document.getElementById('chat'))   — see /joiner/chat.html.
// Deep links: ?id=<conversation>, ?kind=manager|recruiter, ?assistant=1.
import { api, initials, fmtShort, Thread, bindComposer, typingIndicator, emitWithAck } from '/js/chat.js';

const ASSISTANT = 'assistant';
const ROLE_LABELS = { manager: 'Hiring manager', recruiter: 'Recruiter' };
const SUGGESTIONS = ['How long do background checks take?', 'What should I bring on my first day?', 'When will I get paid?', 'Can I move my start date?'];

const make = (tag, props = {}, ...children) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...children.filter((c) => c != null && c !== false));
  return n;
};
const icon = (name, className = '') => make('img', { src: `/brand/icons/${name}.svg`, alt: '', className });

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.io) return resolve();
    const s = make('script', { src });
    s.onload = resolve; s.onerror = reject;
    document.head.append(s);
  });
}

export async function mountChat(container) {
  let me;
  try { ({ user: me } = await api('/api/me')); } catch { return; }
  const isJoiner = me.role === 'joiner';

  if (!document.querySelector('link[href="/css/chat-app.css"]')) document.head.append(make('link', { rel: 'stylesheet', href: '/css/chat-app.css' }));

  // ---------- DOM ----------
  const backBtn = make('button', { type: 'button', className: 'cw-icon-btn', ariaLabel: 'Back to chats', hidden: true }, icon('arrow-left'));
  const avatar = make('span', { className: 'avatar cw-head-avatar', hidden: true });
  const title = make('strong', { textContent: 'Chats' });
  const subtitle = make('small', { textContent: '' });
  const head = make('header', { className: 'cw-head lbg-surface--racing' }, backBtn, avatar, make('div', { className: 'cw-head-text' }, title, subtitle));

  const conn = make('div', { className: 'conn-banner', hidden: true, textContent: 'Reconnecting…' });
  const list = make('div', { className: 'cw-list' });
  const threadEl = make('div', { className: 'thread', ariaLive: 'polite' });
  const typingEl = make('div', { className: 'typing', hidden: true });
  const errorEl = make('p', { className: 'composer-error', role: 'alert', hidden: true });
  const textarea = make('textarea', { rows: 1, maxLength: 2000, ariaLabel: 'Message' });
  const sendBtn = make('button', { className: 'lbg-btn lbg-btn--primary', type: 'submit', textContent: 'Send' });
  const composer = make('form', { className: 'composer' }, textarea, sendBtn);
  const chatView = make('div', { className: 'cw-chat', hidden: true }, threadEl, typingEl, errorEl, composer);

  container.replaceChildren(head, conn, list, chatView);
  container.classList.add('cw-panel');

  // ---------- state ----------
  const thread = new Thread(threadEl, me.id);
  const showTyping = typingIndicator(typingEl);
  let conversations = [];
  let activeId = null; // conversation id, ASSISTANT, or null for the list
  let aiTurns = [];
  let aiLoaded = false;
  let offer = null; // joiner's offer: names the recruiter and hiring manager for every role, even before their chats open

  // The nav badge and tab title are kept by joiner-shell.js; this just tells the page when things change.
  const renderBadge = () => document.dispatchEvent(new CustomEvent('chat:changed'));

  // ---------- list view ----------
  function row({ av, avClass = '', role, name, preview, unread, onClick, time }) {
    const b = make('button', { type: 'button', className: `cw-row${unread ? ' has-unread' : ''}` },
      make('span', { className: `avatar avatar--lg ${avClass}`, textContent: av }),
      make('span', { className: 'cw-row-info' },
        make('span', { className: 'cw-row-role', textContent: role }),
        make('strong', { textContent: name }),
        make('span', { className: 'cw-row-preview', textContent: preview })),
      make('span', { className: 'cw-row-side' },
        time ? make('small', { textContent: time }) : null,
        unread ? make('span', { className: 'cw-count', textContent: unread, ariaLabel: `${unread} unread` }) : null));
    b.addEventListener('click', onClick);
    return b;
  }

  function renderList() {
    const rows = [];
    if (isJoiner) {
      rows.push(row({
        av: 'Ask', avClass: 'avatar--ai', role: 'Onboarding assistant', name: 'Got a question? Ask any time',
        preview: 'Answers from your onboarding guides, day or night', onClick: openAssistant,
      }));
    }
    for (const c of conversations) {
      const last = c.lastMessage;
      rows.push(row({
        av: initials(c.other.name), avClass: c.kind === 'manager' ? '' : 'avatar--racing',
        role: isJoiner ? ROLE_LABELS[c.kind] : `${c.joiner.name === c.other.name ? 'Recruit' : ROLE_LABELS[c.kind]} · ${c.other.jobTitle}`,
        name: c.other.name,
        preview: last ? `${last.senderId === me.id ? 'You: ' : ''}${last.body}` : 'Say hello',
        unread: c.unread, time: last ? fmtShort(last.createdAt) : '', onClick: () => openConversation(c.id),
      }));
    }
    if (isJoiner && offer) {
      // The hiring manager is known from the offer; their chat opens once the unconditional offer is accepted.
      for (const [kind, name, note] of [
        ['recruiter', offer.recruiter, 'Your chat opens when your offer is sent'],
        ['manager', offer.hiringManager, 'Your chat opens when you accept your unconditional offer'],
      ]) {
        if (!name || conversations.some((c) => c.kind === kind)) continue;
        rows.push(make('div', { className: 'cw-row cw-row--locked' },
          make('span', { className: `avatar avatar--lg ${kind === 'manager' ? '' : 'avatar--racing'}`, textContent: initials(name) }),
          make('span', { className: 'cw-row-info' },
            make('span', { className: 'cw-row-role', textContent: ROLE_LABELS[kind] }),
            make('strong', { textContent: name }),
            make('span', { className: 'cw-row-preview', textContent: note }))));
      }
    }
    if (!rows.length) rows.push(make('p', { className: 'cw-empty', textContent: 'No conversations yet.' }));
    list.replaceChildren(...rows);
  }

  async function loadConversations() {
    try { ({ conversations } = await api('/api/conversations')); } catch { return; }
    renderBadge();
    if (activeId == null) renderList();
  }

  // ---------- views ----------
  function show(view, { name = 'Chats', sub = '', av = null } = {}) {
    list.hidden = view !== 'list';
    chatView.hidden = view !== 'chat';
    backBtn.hidden = view === 'list';
    avatar.hidden = !av;
    avatar.textContent = av ?? '';
    title.textContent = name;
    subtitle.textContent = sub;
    typingEl.hidden = true; errorEl.hidden = true;
  }

  function showList() {
    activeId = null;
    show('list');
    renderList();
  }

  const markRead = () => {
    if (activeId == null || activeId === ASSISTANT || document.visibilityState !== 'visible') return;
    const c = conversations.find((x) => x.id === activeId);
    if (c?.unread) { c.unread = 0; renderBadge(); }
    api(`/api/conversations/${activeId}/read`, { method: 'POST' }).catch(() => {});
  };

  async function openConversation(id) {
    const c = conversations.find((x) => x.id === id);
    if (!c) return;
    activeId = id;
    show('chat', {
      name: c.other.name, av: initials(c.other.name),
      sub: isJoiner ? `${ROLE_LABELS[c.kind]} · ${c.other.jobTitle}` : c.other.jobTitle,
    });
    textarea.placeholder = `Message ${c.other.name.split(' ')[0]}`;
    thread.set([]);
    try {
      const { messages } = await api(`/api/conversations/${id}/messages`);
      if (activeId !== id) return;
      thread.set(messages);
      thread.scrollToEnd();
      markRead();
    } catch (err) {
      threadEl.replaceChildren(make('p', { className: 'thread-empty', textContent: `Couldn't load this chat (${err.message}).` }));
    }
  }

  // ---------- assistant ----------
  function renderAssistant() {
    const nodes = [make('p', { className: 'ai-note', textContent: 'Answers come from your onboarding documents. The assistant can make mistakes, so check anything important with your recruiter.' })];
    if (!aiTurns.length) {
      nodes.push(
        make('div', { className: 'msg msg--theirs' }, make('div', { className: 'bubble', textContent: `Hi ${me.name.split(' ')[0]}! Ask me anything about joining: checks, pay, your first day, equipment or training.` })),
        make('div', { className: 'ai-suggestions' }, ...SUGGESTIONS.map((s) => {
          const b = make('button', { type: 'button', textContent: s });
          b.addEventListener('click', () => askAssistant(s));
          return b;
        })));
    }
    for (const t of aiTurns) {
      nodes.push(make('div', { className: 'msg msg--mine' }, make('div', { className: 'bubble', textContent: t.question })));
      if (t.answer == null && !t.error) continue;
      const rowEl = make('div', { className: 'msg msg--theirs' }, make('div', { className: 'bubble', textContent: t.error ?? t.answer }));
      if (t.sources?.length) {
        const links = t.sources.flatMap((s, n) => [n ? ' · ' : '', make('a', { href: `/joiner/guides.html?from=assistant#${encodeURIComponent(s.id)}`, textContent: s.title })]);
        rowEl.append(make('div', { className: 'ai-sources' }, 'From: ', ...links));
      }
      if (t.handoff && t.handoff !== 'none') {
        const c = conversations.find((x) => x.kind === t.handoff);
        if (c) {
          const b = make('button', { type: 'button', className: 'lbg-btn lbg-btn--secondary ai-handoff', textContent: `Ask ${c.other.name.split(' ')[0]}, your ${ROLE_LABELS[t.handoff].toLowerCase()}` });
          b.addEventListener('click', async () => {
            await openConversation(c.id);
            textarea.value = t.question;
            textarea.dispatchEvent(new Event('input'));
            textarea.focus();
          });
          rowEl.append(b);
        } else {
          const who = t.handoff === 'manager' ? offer?.hiringManager : offer?.recruiter;
          rowEl.append(make('div', { className: 'ai-handoff-note', textContent: t.handoff === 'manager'
            ? `${who ?? 'Your hiring manager'} is your hiring manager. Your chat opens once you accept your unconditional offer, and your recruiter can help until then.`
            : `${who ?? 'Your recruiter'} will be in touch soon.` }));
        }
      }
      nodes.push(rowEl);
    }
    threadEl.replaceChildren(...nodes);
    threadEl.scrollTop = threadEl.scrollHeight;
  }

  async function openAssistant() {
    activeId = ASSISTANT;
    show('chat', { name: 'Onboarding assistant', av: 'Ask', sub: 'Answers from your onboarding guides' });
    avatar.classList.add('avatar--ai');
    textarea.placeholder = 'Ask a question';
    threadEl.replaceChildren(); // never leave the previous chat on screen
    if (!aiLoaded) {
      try {
        ({ history: aiTurns } = await api('/api/assistant'));
        aiLoaded = true;
      } catch (err) {
        if (activeId !== ASSISTANT) return;
        threadEl.replaceChildren(make('p', { className: 'thread-empty', textContent: `The assistant isn't available right now (${err.message}). Try again shortly, or message your recruiter.` }));
        return;
      }
    }
    if (activeId === ASSISTANT) renderAssistant();
  }

  async function askAssistant(question) {
    const turn = { question };
    aiTurns.push(turn);
    renderAssistant();
    typingEl.textContent = 'The assistant is looking through your documents…';
    typingEl.hidden = false;
    try {
      Object.assign(turn, await api('/api/assistant', { method: 'POST', body: JSON.stringify({ question }) }));
    } catch (err) {
      turn.error = `Sorry, I couldn't answer that just now (${err.message}). Try again, or ask your recruiter.`;
    } finally {
      typingEl.hidden = true;
      if (activeId === ASSISTANT) renderAssistant();
    }
  }

  backBtn.addEventListener('click', () => { history.replaceState(null, '', location.pathname); showList(); });
  document.addEventListener('visibilitychange', markRead);

  // ---------- composer ----------
  let socket;
  bindComposer(composer, {
    onTyping: () => activeId != null && activeId !== ASSISTANT && socket?.emit('typing', { conversationId: activeId }),
    onSend: async (body) => {
      errorEl.hidden = true;
      if (activeId === ASSISTANT) { askAssistant(body); return; }
      try {
        const { message } = await emitWithAck(socket, 'message:send', { conversationId: activeId, body });
        onMessage(message);
        thread.scrollToEnd();
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
        throw err;
      }
    },
  });

  // ---------- realtime ----------
  function onMessage(m) {
    const c = conversations.find((x) => x.id === m.conversationId);
    if (!c) return loadConversations();
    c.lastMessage = { body: m.body, createdAt: m.createdAt, senderId: m.senderId };
    const viewing = m.conversationId === activeId;
    if (viewing) {
      thread.add(m);
      if (m.senderId !== me.id) { typingEl.hidden = true; markRead(); }
    } else if (m.senderId !== me.id) {
      c.unread += 1;
    }
    conversations.sort((a, b) => (b.lastMessage?.createdAt ?? '').localeCompare(a.lastMessage?.createdAt ?? ''));
    renderBadge();
    if (activeId == null) renderList();
  }

  await loadScript('/socket.io/socket.io.js').catch(() => {});
  if (window.io) {
    socket = window.io();
    socket.on('connect', () => { conn.hidden = true; loadConversations(); });
    socket.on('disconnect', () => { conn.hidden = false; });
    socket.on('connect_error', (err) => { if (err.message !== 'unauthorised') conn.hidden = false; });
    socket.on('message:new', onMessage);
    socket.on('conversations:changed', loadConversations);
    socket.on('journey:updated', loadConversations);
    socket.on('conversation:read', ({ conversationId, readerId, at }) => { if (conversationId === activeId && readerId !== me.id) thread.markReadBy(readerId, at); });
    socket.on('typing', ({ conversationId, name }) => { if (conversationId === activeId) showTyping(name); });
  }

  if (isJoiner) {
    api('/api/journey').then(({ journey }) => { offer = journey.offer; if (activeId == null) renderList(); }).catch(() => {});
  }
  await loadConversations();

  const params = new URLSearchParams(location.search);
  const target = conversations.find((c) => (params.get('id') ? c.id === Number(params.get('id')) : c.kind === params.get('kind')));
  if (params.has('assistant') && isJoiner) await openAssistant();
  else if (target) await openConversation(target.id);
  else showList();
}
