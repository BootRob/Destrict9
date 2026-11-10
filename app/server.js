import express from 'express';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { db, verifyPassword, STAFF_ROLES, ROLE_LABELS } from './db.js';
import * as assistant from './assistant.js';
import * as guides from './guides.js';
import * as checklist from './checklist.js';
import * as onboarding from './onboarding.js';
import * as journey from './journey.js';
import { MAILBOX_ENABLED, listEmails } from './mailer.js';

const PORT = Number(process.env.PORT) || 3000;
const SESSION_MS = 7 * 24 * 3600_000;
const MAX_MESSAGE = 2000;
const publicDir = fileURLToPath(new URL('./public/', import.meta.url));

// ---------- queries ----------
const USER_COLS = 'u.id, u.name, u.email, u.role, u.status, u.job_title, u.location, u.start_date';
const CONV_SUMMARY = `
  c.id, c.kind, c.joiner_id, c.staff_id,
  (SELECT body       FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_body,
  (SELECT created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_at,
  (SELECT sender_id  FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_sender,
  (SELECT COUNT(*)   FROM messages m WHERE m.conversation_id = c.id AND m.sender_id <> :me AND m.read_at IS NULL) AS unread`;

const q = {
  userByEmail:   db.prepare('SELECT * FROM users WHERE email = ?'),
  userById:      db.prepare(`SELECT ${USER_COLS} FROM users u WHERE u.id = ?`),
  sessionUser:   db.prepare(`SELECT ${USER_COLS} FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ? AND u.status = 'active'`),
  createSession: db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'),
  deleteSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
  conversation:  db.prepare('SELECT * FROM conversations WHERE id = ?'),
  convIdsFor:    db.prepare('SELECT id FROM conversations WHERE joiner_id = :me OR staff_id = :me'),
  convsForUser:  db.prepare(`SELECT ${CONV_SUMMARY} FROM conversations c WHERE c.joiner_id = :me OR c.staff_id = :me ORDER BY last_at DESC NULLS LAST, c.id`),
  circleOf:      db.prepare(`SELECT c.kind, ${USER_COLS} FROM conversations c JOIN users u ON u.id = c.staff_id WHERE c.joiner_id = ?`),
  messages:      db.prepare(`
    SELECT * FROM (
      SELECT m.*, u.name AS sender_name FROM messages m JOIN users u ON u.id = m.sender_id
      WHERE m.conversation_id = ? ORDER BY m.id DESC LIMIT 200
    ) ORDER BY id`),
  insertMessage: db.prepare('INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?) RETURNING *'),
  markRead:      db.prepare('UPDATE messages SET read_at = ? WHERE conversation_id = ? AND sender_id <> ? AND read_at IS NULL'),
};

const publicUser = (u) => u && ({
  id: u.id, name: u.name, email: u.email, role: u.role, roleLabel: ROLE_LABELS[u.role],
  jobTitle: u.job_title, location: u.location, startDate: u.start_date, status: u.status,
});
const toMessage = (m, senderName) => ({
  id: m.id, conversationId: m.conversation_id, senderId: m.sender_id, senderName: senderName ?? m.sender_name,
  body: m.body, createdAt: m.created_at, readAt: m.read_at,
});

/** Joiner's circle: their staff by role, with null for roles not yet assigned. */
function circleOf(joinerId) {
  const circle = Object.fromEntries(STAFF_ROLES.map((r) => [r, null]));
  for (const row of q.circleOf.all(joinerId)) circle[row.kind] = publicUser(row);
  return circle;
}

/** Conversation as seen by `me`: who the other person is, and the joiner's wider circle for staff. */
function toConversation(c, me) {
  const joiner = publicUser(q.userById.get(c.joiner_id));
  const staff = publicUser(q.userById.get(c.staff_id));
  return {
    id: c.id,
    kind: c.kind,
    kindLabel: ROLE_LABELS[c.kind],
    joiner,
    staff,
    other: me.id === c.joiner_id ? staff : joiner,
    circle: me.role === 'joiner' ? undefined : circleOf(c.joiner_id),
    lastMessage: c.last_at ? { body: c.last_body, createdAt: c.last_at, senderId: c.last_sender } : null,
    unread: c.unread ?? 0,
  };
}

// ---------- auth helpers ----------
function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
const userForCookieHeader = (header) => {
  const token = parseCookies(header).sid;
  return token ? q.sessionUser.get(token, new Date().toISOString()) : undefined;
};

/** Returns the conversation if `user` is one of its two participants. */
function conversationFor(user, conversationId) {
  if (!user || !Number.isInteger(conversationId)) return undefined;
  const c = q.conversation.get(conversationId);
  return c && (c.joiner_id === user.id || c.staff_id === user.id) ? c : undefined;
}

const homeFor = (user) => (!user ? '/login.html' : user.role === 'joiner' ? '/joiner/' : '/staff/');

const requireAuth = (req, res, next) => {
  req.user = userForCookieHeader(req.headers.cookie);
  if (!req.user) return res.status(401).json({ error: 'Please log in' });
  next();
};
const requireConversation = (req, res, next) => {
  req.conversation = conversationFor(req.user, Number(req.params.id));
  if (!req.conversation) return res.status(404).json({ error: 'Conversation not found' });
  next();
};
const pageFor = (allow) => (req, res, next) => {
  const user = userForCookieHeader(req.headers.cookie);
  if (!user) return res.redirect('/login.html');
  if (!allow(user)) return res.redirect('/');
  next();
};

// ---------- app ----------
const app = express();
const server = createServer(app);
const io = new Server(server);

app.disable('x-powered-by');
app.set('trust proxy', true); // so req.protocol is right behind Azure's HTTPS front end
app.use(express.json({ limit: '64kb' })); // room for a full guide (guides.MAX_GUIDE_CHARS)

app.post('/api/login', (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const user = q.userByEmail.get(email);
  if (user?.status === 'invited') {
    return res.status(403).json({ error: "Your account isn't set up yet. Use the activation link in your welcome email." });
  }
  if (!user || !verifyPassword(req.body?.password ?? '', user.password_hash)) {
    return res.status(401).json({ error: 'Email or password is incorrect' });
  }
  startSession(res, user);
  res.json({ user: publicUser(user), home: homeFor(user) });
});

function startSession(res, user) {
  const token = randomBytes(32).toString('base64url');
  q.createSession.run(token, user.id, new Date(Date.now() + SESSION_MS).toISOString());
  res.cookie('sid', token, {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: SESSION_MS,
    secure: process.env.NODE_ENV === 'production',
  });
}

app.post('/api/logout', (req, res) => {
  const token = parseCookies(req.headers.cookie).sid;
  if (token) q.deleteSession.run(token);
  res.clearCookie('sid', { path: '/' });
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  const me = publicUser(req.user);
  res.json({ user: me, home: homeFor(req.user), circle: me.role === 'joiner' ? circleOf(me.id) : undefined });
});

app.get('/api/conversations', requireAuth, (req, res) => {
  res.json({ conversations: q.convsForUser.all({ me: req.user.id }).map((c) => toConversation(c, req.user)) });
});

app.get('/api/conversations/:id/messages', requireAuth, requireConversation, (req, res) => {
  res.json({ messages: q.messages.all(req.conversation.id).map((m) => toMessage(m)) });
});

app.post('/api/conversations/:id/read', requireAuth, requireConversation, (req, res) => {
  const at = new Date().toISOString();
  const { changes } = q.markRead.run(at, req.conversation.id, req.user.id);
  if (changes) io.to(`conv:${req.conversation.id}`).emit('conversation:read', { conversationId: req.conversation.id, readerId: req.user.id, at });
  res.json({ ok: true, marked: Number(changes) });
});

// ---------- joiner assistant ----------
const requireJoiner = (req, res, next) => (req.user.role === 'joiner' ? next() : res.status(403).json({ error: 'The assistant is for joiners' }));

app.get('/api/assistant', requireAuth, requireJoiner, (req, res) => {
  res.json({ provider: assistant.PROVIDER, history: assistant.historyFor(req.user.id) });
});

app.post('/api/assistant', requireAuth, requireJoiner, async (req, res) => {
  const question = String(req.body?.question ?? '').trim();
  if (!question || question.length > MAX_MESSAGE) return res.status(400).json({ error: `Questions must be 1 to ${MAX_MESSAGE} characters` });
  try {
    const context = { day1: checklist.day1For(req.user.email), training: checklist.trainingFor(req.user.email) };
    res.json(await assistant.ask(req.user, question, context));
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.status ? err.message : 'The assistant is unavailable right now' });
  }
});

// ---------- onboarding guides (knowledge/*.md) ----------
const requireEditor = (req, res, next) => (guides.EDITOR_ROLES.includes(req.user.role) ? next() : res.status(403).json({ error: 'Only managers and recruiters can edit guides' }));
const guideSummary = ({ markdown, ...g }) => ({ ...g, minutes: Math.max(1, Math.round(markdown.split(/\s+/).length / 200)) }); // reading time for the list
const guideError = (res, err) => {
  if (!err.status) console.error('Saving guide failed:', err);
  res.status(err.status ?? 500).json({ error: err.status ? err.message : 'The guide could not be saved' });
};

app.get('/api/guides', requireAuth, (req, res) => {
  res.json({ guides: guides.allGuides().map(guideSummary), canEdit: guides.EDITOR_ROLES.includes(req.user.role) });
});

app.get('/api/guides/:id', requireAuth, (req, res) => {
  const guide = guides.getGuide(req.params.id);
  if (!guide) return res.status(404).json({ error: 'Guide not found' });
  res.json({ guide });
});

app.post('/api/guides', requireAuth, requireEditor, (req, res) => {
  try {
    res.status(201).json({ guide: guides.createGuide(req.body?.markdown, req.user) });
  } catch (err) { guideError(res, err); }
});

app.put('/api/guides/:id', requireAuth, requireEditor, (req, res) => {
  try {
    res.json({ guide: guides.updateGuide(req.params.id, req.body?.markdown, req.body?.baseUpdatedAt, req.user) });
  } catch (err) { guideError(res, err); }
});

// ---------- manager Day 1 checklist ----------
const requireManager = (req, res, next) => (req.user.role === 'manager' ? next() : res.status(403).json({ error: 'The Day 1 checklist is for hiring managers' }));
const checklistRoute = (fn) => (req, res) => {
  try {
    res.json(fn(req));
  } catch (err) {
    if (!err.status) console.error('Checklist failed:', err);
    res.status(err.status ?? 500).json({ error: err.status ? err.message : 'The checklist could not be updated' });
  }
};

app.get('/api/checklist', requireAuth, requireManager, checklistRoute((req) => ({ joiners: checklist.listFor(req.user) })));
app.get('/api/checklist/:joinerId', requireAuth, requireManager, checklistRoute((req) => checklist.checklistFor(req.user, Number(req.params.joinerId))));
app.put('/api/checklist/:joinerId/items/:itemId', requireAuth, requireManager,
  checklistRoute((req) => checklist.setItem(req.user, Number(req.params.joinerId), req.params.itemId, req.body?.status)));
app.put('/api/checklist/:joinerId/day1', requireAuth, requireManager,
  checklistRoute((req) => checklist.setDay1(req.user, Number(req.params.joinerId), req.body)));
// Sends the recruit a chat message from their manager, through the normal messaging path.
app.post('/api/checklist/:joinerId/training-reminder', requireAuth, requireManager, checklistRoute((req) => {
  const { conversationId, text } = checklist.trainingReminder(req.user, Number(req.params.joinerId));
  const message = toMessage(q.insertMessage.get(conversationId, req.user.id, text), req.user.name);
  io.to(`conv:${conversationId}`).emit('message:new', message);
  return checklist.checklistFor(req.user, Number(req.params.joinerId));
}));
// The recruit's own Day 1 details, once their manager has shared them.
app.get('/api/day1', requireAuth, requireJoiner, (req, res) => {
  res.json({ day1: checklist.day1For(req.user.email), training: checklist.trainingFor(req.user.email) });
});

// ---------- recruiter onboarding ----------
const requireRecruiter = (req, res, next) => (req.user.role === 'recruiter' ? next() : res.status(403).json({ error: 'Only recruiters can manage applicants' }));
const publicOrigin = (req) => process.env.PUBLIC_URL?.replace(/\/$/, '') || `${req.protocol}://${req.get('host')}`;
const onboardingError = (res, err) => {
  if (!err.status) console.error('Onboarding failed:', err);
  res.status(err.status ?? 500).json({ error: err.status ? err.message : 'Something went wrong. Please try again.' });
};

app.get('/api/applicants', requireAuth, requireRecruiter, (req, res) => {
  res.json({ applicants: onboarding.listApplicants(req.user.id), mailbox: MAILBOX_ENABLED });
});

app.post('/api/applicants/:id/onboard', requireAuth, requireRecruiter, (req, res) => {
  try {
    const result = onboarding.onboard(req.user, Number(req.params.id), publicOrigin(req));
    // Staff who are online join the new chat rooms straight away and refresh their lists.
    for (const { id, staffId } of result.conversations) {
      io.in(`user:${staffId}`).socketsJoin(`conv:${id}`);
      io.to(`user:${staffId}`).emit('conversations:changed');
    }
    res.json({ applicant: result.applicant, email: result.email });
  } catch (err) { onboardingError(res, err); }
});

app.post('/api/applicants/:id/resend', requireAuth, requireRecruiter, (req, res) => {
  try {
    res.json(onboarding.resendInvite(req.user, Number(req.params.id), publicOrigin(req)));
  } catch (err) { onboardingError(res, err); }
});

app.get('/api/activate', (req, res) => {
  try {
    res.json({ invite: onboarding.inviteInfo(req.query.token) });
  } catch (err) { onboardingError(res, err); }
});

app.post('/api/activate', (req, res) => {
  try {
    const { userId, applicantId } = onboarding.activate(req.body?.token, req.body?.password);
    const user = q.userById.get(userId);
    startSession(res, user);
    const applicant = applicantId && onboarding.getApplicant(applicantId);
    if (applicant) io.to(`user:${applicant.recruiterId}`).emit('applicant:updated', applicant);
    for (const staff of q.circleOf.all(userId)) io.to(`user:${staff.id}`).emit('conversations:changed');
    res.json({ user: publicUser(user), home: homeFor(user) });
  } catch (err) { onboardingError(res, err); }
});

app.post('/api/applicants/:id/screening-result', requireAuth, requireRecruiter, (req, res) => {
  try {
    const applicant = journey.recordScreeningResult(req.user, Number(req.params.id), req.body?.result, req.body?.note, publicOrigin(req));
    io.to(`user:${applicant.userId}`).emit('journey:updated');
    res.json({ applicant });
  } catch (err) { onboardingError(res, err); }
});

// ---------- the recruit's journey (joiners only) ----------
const requireJoinerRole = (req, res, next) => (req.user.role === 'joiner' ? next() : res.status(403).json({ error: 'Only for new joiners' }));
/** Tell the recruiter (live table) and the recruit's other tabs that the journey moved. */
const journeyMoved = (applicant) => {
  io.to(`user:${applicant.recruiterId}`).emit('applicant:updated', applicant);
  io.to(`user:${applicant.userId}`).emit('journey:updated');
};
const journeyAction = (fn) => (req, res) => {
  try {
    const applicant = fn(req);
    journeyMoved(applicant);
    res.json({ journey: journey.journeyFor(req.user) });
  } catch (err) { onboardingError(res, err); }
};

app.get('/api/journey', requireAuth, requireJoinerRole, (req, res) => {
  try { res.json({ journey: journey.journeyFor(req.user) }); } catch (err) { onboardingError(res, err); }
});
app.post('/api/journey/conditional/accept', requireAuth, requireJoinerRole, journeyAction((req) => journey.acceptConditional(req.user, publicOrigin(req))));
app.post('/api/journey/decline', requireAuth, requireJoinerRole, journeyAction((req) => journey.declineOffer(req.user, req.body?.offer, req.body?.reason)));
app.post('/api/journey/screening', requireAuth, requireJoinerRole, journeyAction((req) => journey.submitScreening(req.user, publicOrigin(req))));
app.post('/api/journey/device', requireAuth, requireJoinerRole, journeyAction((req) => journey.chooseDevice(req.user, req.body?.device)));
app.post('/api/journey/photo', requireAuth, requireJoinerRole, journeyAction((req) => journey.setPassPhoto(req.user, req.body?.image)));
app.get('/api/journey/photo', requireAuth, requireJoinerRole, (req, res) => {
  try {
    const p = journey.passPhotoFor(req.user);
    if (!p) return res.status(404).json({ error: 'No pass photo yet' });
    res.set({ 'Content-Type': p.mime, 'Cache-Control': 'private, max-age=31536000, immutable' }).send(p.bytes); // the URL carries ?v=updatedAt
  } catch (err) { onboardingError(res, err); }
});
app.post('/api/journey/unconditional/accept', requireAuth, requireJoinerRole, journeyAction((req) => {
  const { applicant, managerConversation: { id, staffId } } = journey.acceptUnconditional(req.user);
  // Manager and recruit join the new chat room straight away and refresh their lists.
  for (const userId of [staffId, req.user.id]) {
    io.in(`user:${userId}`).socketsJoin(`conv:${id}`);
    io.to(`user:${userId}`).emit('conversations:changed');
  }
  return applicant;
}));

// Demo only: the simulated inbox for every invite email. Turn off with DEMO_MAILBOX=off.
app.get('/api/mailbox', (req, res) => {
  if (!MAILBOX_ENABLED) return res.status(404).json({ error: 'Not found' });
  res.json({ emails: listEmails() });
});
app.use('/mailbox.html', (req, res, next) => (MAILBOX_ENABLED ? next() : res.status(404).end()));

app.get('/', (req, res) => res.redirect(homeFor(userForCookieHeader(req.headers.cookie))));
app.use('/joiner', pageFor((u) => u.role === 'joiner'));
app.use('/staff/applicants.html', pageFor((u) => u.role === 'recruiter'));
app.use('/staff', pageFor((u) => STAFF_ROLES.includes(u.role)));
app.use(express.static(publicDir));

// ---------- realtime ----------
io.use((socket, next) => {
  const user = userForCookieHeader(socket.handshake.headers.cookie);
  if (!user) return next(new Error('unauthorised'));
  socket.data.user = user;
  next();
});

io.on('connection', (socket) => {
  const me = socket.data.user;
  socket.join(`user:${me.id}`);
  for (const { id } of q.convIdsFor.all({ me: me.id })) socket.join(`conv:${id}`);

  socket.on('message:send', (payload, ack = () => {}) => {
    const body = String(payload?.body ?? '').trim();
    if (!body || body.length > MAX_MESSAGE) return ack({ error: `Messages must be 1 to ${MAX_MESSAGE} characters` });
    const conv = conversationFor(me, Number(payload?.conversationId));
    if (!conv) return ack({ error: 'Conversation not found' });
    const message = toMessage(q.insertMessage.get(conv.id, me.id, body), me.name);
    io.to(`conv:${conv.id}`).emit('message:new', message);
    ack({ ok: true, message });
  });

  socket.on('typing', (payload) => {
    const conv = conversationFor(me, Number(payload?.conversationId));
    if (conv) socket.to(`conv:${conv.id}`).emit('typing', { conversationId: conv.id, userId: me.id, name: me.name });
  });
});

server.listen(PORT, () => {
  console.log(`Joiner companion running at http://localhost:${PORT}`);
  console.log(`Joiner assistant: ${assistant.PROVIDER} provider, ${assistant.docCount()} guides`);
});
