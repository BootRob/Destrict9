// Manager Day 1 checklist: what a hiring manager must have ready before their recruit's first day.
// State lives in its own tables (created here, not in db.js) and is keyed by the joiner's email,
// so it survives the demo database being re-seeded with new user IDs.
import { db } from './db.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS checklist_items (
    joiner_email TEXT NOT NULL,
    item_id      TEXT NOT NULL,
    status       TEXT NOT NULL CHECK (status IN ('todo', 'done', 'not_needed')),
    updated_at   TEXT NOT NULL,
    updated_by   TEXT,
    PRIMARY KEY (joiner_email, item_id)
  );
  CREATE TABLE IF NOT EXISTS checklist_day1 (
    joiner_email TEXT PRIMARY KEY,
    details      TEXT NOT NULL,   -- JSON: { time, place, meetBy, dressCode, phone }
    updated_at   TEXT NOT NULL,
    updated_by   TEXT
  );
  CREATE TABLE IF NOT EXISTS prestart_training (
    joiner_email TEXT PRIMARY KEY,
    completed_at TEXT,
    reminded_at  TEXT
  );
`);

/**
 * The checklist. `due` is working days before the start date. `optional` items can be marked
 * "Not needed". `auto` items are worked out from other data rather than ticked.
 */
export const ITEMS = [
  { id: 'laptop', group: 'Kit and access', title: 'Laptop and peripherals ready', hint: 'Monitor, keyboard, mouse and headset, ready to collect on Day 1.', due: 5 },
  { id: 'badge', group: 'Kit and access', title: 'Access badge requested', hint: 'Reception issues it on Day 1 when they show their photo ID.', due: 5 },
  { id: 'access', group: 'Kit and access', title: 'Accounts and system access requested', hint: 'Including any apps their role needs, so IT can set everything up on Day 1.', due: 5 },
  { id: 'reception', group: 'Kit and access', title: 'Reception told who is arriving and when', hint: 'Name, arrival time and who is meeting them.', due: 2 },
  { id: 'day1', group: 'Telling the recruit', title: 'Day 1 details shared with the recruit', hint: 'Start time, where to meet, who meets them, dress code and a number to call. Fill in the form below; the recruit sees it straight away.', due: 3, auto: 'day1' },
  { id: 'desk', group: 'Booked', title: 'Desk booked near the team', hint: 'Book it in the desk booking app.', due: 2 },
  { id: 'induction', group: 'Booked', title: 'Induction session and IT setup slot booked', hint: 'IT setup takes about an hour at the IT Welcome Desk.', due: 5 },
  { id: 'lunch', group: 'Booked', title: 'Team lunch booked', hint: 'Lunch is on us if they finish the pre-start onboarding training before Day 1.', due: 2 },
  { id: 'adjustments', group: 'Only if relevant', title: 'Workplace adjustments in place', hint: 'Only if the recruit asked for adjustments.', due: 5, optional: true },
  { id: 'rota', group: 'Only if relevant', title: 'Shift or rota confirmed', hint: 'For contact centre roles.', due: 5, optional: true },
  { id: 'welcome', group: 'Human touch', title: 'Welcome message sent in the app', hint: 'Say hello in your chat before they start. This ticks itself once you have messaged them.', due: 5, auto: 'welcome' },
];
const itemById = new Map(ITEMS.map((i) => [i.id, i]));
const DAY1_FIELDS = ['time', 'place', 'meetBy', 'dressCode', 'phone'];

const q = {
  managerJoiners: db.prepare(`
    SELECT c.id AS conversation_id, u.id, u.name, u.email, u.job_title, u.location, u.start_date
    FROM conversations c JOIN users u ON u.id = c.joiner_id
    WHERE c.staff_id = ? AND c.kind = 'manager' ORDER BY u.start_date, u.name`),
  managerOf: db.prepare(`
    SELECT c.id AS conversation_id, u.id, u.name, u.email, u.job_title, u.location, u.start_date
    FROM conversations c JOIN users u ON u.id = c.joiner_id
    WHERE c.staff_id = ? AND c.kind = 'manager' AND c.joiner_id = ?`),
  managerHasMessaged: db.prepare('SELECT 1 FROM messages WHERE conversation_id = ? AND sender_id = ? LIMIT 1'),
  items: db.prepare('SELECT * FROM checklist_items WHERE joiner_email = ?'),
  setItem: db.prepare(`
    INSERT INTO checklist_items (joiner_email, item_id, status, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (joiner_email, item_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at, updated_by = excluded.updated_by`),
  day1: db.prepare('SELECT * FROM checklist_day1 WHERE joiner_email = ?'),
  setDay1: db.prepare(`
    INSERT INTO checklist_day1 (joiner_email, details, updated_at, updated_by) VALUES (?, ?, ?, ?)
    ON CONFLICT (joiner_email) DO UPDATE SET details = excluded.details, updated_at = excluded.updated_at, updated_by = excluded.updated_by`),
  training: db.prepare('SELECT * FROM prestart_training WHERE joiner_email = ?'),
  setReminded: db.prepare(`
    INSERT INTO prestart_training (joiner_email, reminded_at) VALUES (?, ?)
    ON CONFLICT (joiner_email) DO UPDATE SET reminded_at = excluded.reminded_at`),
  countAny: db.prepare('SELECT (SELECT COUNT(*) FROM checklist_items) + (SELECT COUNT(*) FROM prestart_training) AS n'),
};

// Demo data, added once: Alex is part-way through, and is the only joiner who has done the training.
// The laptop stays to do: Alex hasn't chosen one yet (it's part of the demo), and the item's hint says so.
if (q.countAny.get().n === 0) {
  const ago = (d) => new Date(Date.now() - d * 86_400_000).toISOString();
  for (const [item, days] of [['badge', 3], ['access', 2]]) q.setItem.run('alex.kim@example.com', item, 'done', ago(days), 'Sam Reid');
  q.setItem.run('alex.kim@example.com', 'rota', 'not_needed', ago(2), 'Sam Reid');
  db.prepare('INSERT INTO prestart_training (joiner_email, completed_at) VALUES (?, ?)').run('alex.kim@example.com', ago(1));
  // Ruby and Tom have already started, so their managers have finished everything (added by WS1).
  for (const [email, by, d, phone] of [['ruby.ahmed@example.com', 'Sam Reid', 20, '0113 496 0000'], ['tom.bennett@example.com', 'Hannah Price', 50, '029 2018 0000']]) {
    for (const i of ITEMS.filter((i) => !i.auto)) q.setItem.run(email, i.id, i.optional ? 'not_needed' : 'done', ago(d), by);
    q.setDay1.run(email, JSON.stringify({ time: '9:30am', place: 'Reception', meetBy: by, dressCode: 'Smart casual', phone }), ago(d), by);
    db.prepare('INSERT INTO prestart_training (joiner_email, completed_at) VALUES (?, ?)').run(email, ago(d));
  }
}

// The recruit's laptop choice comes from feat/recruiter-onboarding's applicants table, if it exists.
const DEVICES = { mac: 'Apple MacBook Pro 14-inch', hp: 'HP EliteBook 840 14-inch' };
const hasApplicants = !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'applicants'").get();
const deviceQuery = hasApplicants ? db.prepare("SELECT * FROM applicants WHERE user_id = ?") : null;
function deviceChoiceFor(joinerId) {
  const row = deviceQuery?.get(joinerId);
  return row && 'device_choice' in row ? (DEVICES[row.device_choice] ?? null) : undefined; // undefined: no data in this build
}

export class ChecklistError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** Date that is `n` working days (Mon to Fri) before `dateStr` (YYYY-MM-DD). */
function workingDaysBefore(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  while (n > 0) {
    d.setUTCDate(d.getUTCDate() - 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) n--;
  }
  return d.toISOString().slice(0, 10);
}

const today = () => new Date().toISOString().slice(0, 10);

export function day1For(email) {
  const row = q.day1.get(email);
  return row ? { ...JSON.parse(row.details), updatedAt: row.updated_at, updatedBy: row.updated_by } : null;
}

export function trainingFor(email) {
  const row = q.training.get(email);
  return { completedAt: row?.completed_at ?? null, remindedAt: row?.reminded_at ?? null };
}

function buildChecklist(manager, j) {
  const saved = new Map(q.items.all(j.email).map((r) => [r.item_id, r]));
  const day1 = day1For(j.email);
  const training = trainingFor(j.email);
  const items = ITEMS.map((item) => {
    let status = saved.get(item.id)?.status ?? 'todo';
    let at = saved.get(item.id)?.updated_at ?? null;
    let by = saved.get(item.id)?.updated_by ?? null;
    if (item.auto === 'day1') { status = day1 ? 'done' : 'todo'; at = day1?.updatedAt ?? null; by = day1?.updatedBy ?? null; }
    if (item.auto === 'welcome') { status = q.managerHasMessaged.get(j.conversation_id, manager.id) ? 'done' : 'todo'; at = null; by = null; }
    const due = j.start_date ? workingDaysBefore(j.start_date, item.due) : null;
    let hint = item.hint;
    if (item.id === 'laptop') {
      const device = deviceChoiceFor(j.id);
      if (device) hint = `They chose the ${device}. Have it ready with a monitor, keyboard, mouse and headset.`;
      else if (device === null) hint = `They haven't chosen their laptop yet. ${item.hint}`;
    }
    return { ...item, hint, status, updatedAt: at, updatedBy: by, dueDate: due, overdue: status === 'todo' && !!due && due < today() };
  });
  const counted = items.filter((i) => i.status !== 'not_needed');
  return {
    joiner: { id: j.id, name: j.name, email: j.email, jobTitle: j.job_title, location: j.location, startDate: j.start_date },
    conversationId: j.conversation_id,
    items,
    day1,
    training,
    progress: { done: counted.filter((i) => i.status === 'done').length, total: counted.length, overdue: items.filter((i) => i.overdue).length },
  };
}

/** The manager's recruits, each with progress counts, soonest start date first. */
export function listFor(manager) {
  return q.managerJoiners.all(manager.id).map((j) => {
    const { joiner, progress, training } = buildChecklist(manager, j);
    return { joiner, progress, trainingDone: !!training.completedAt };
  });
}

function requireJoinerOf(manager, joinerId) {
  const j = q.managerOf.get(manager.id, joinerId);
  if (!j) throw new ChecklistError(404, 'Recruit not found, or you are not their hiring manager');
  return j;
}

export const checklistFor = (manager, joinerId) => buildChecklist(manager, requireJoinerOf(manager, joinerId));

export function setItem(manager, joinerId, itemId, status) {
  const j = requireJoinerOf(manager, joinerId);
  const item = itemById.get(itemId);
  if (!item) throw new ChecklistError(404, 'Checklist item not found');
  if (item.auto) throw new ChecklistError(400, 'This item updates itself');
  if (!['todo', 'done', 'not_needed'].includes(status)) throw new ChecklistError(400, 'Status must be todo, done or not_needed');
  if (status === 'not_needed' && !item.optional) throw new ChecklistError(400, 'Only optional items can be marked as not needed');
  q.setItem.run(j.email, itemId, status, new Date().toISOString(), manager.name);
  return buildChecklist(manager, j);
}

export function setDay1(manager, joinerId, input) {
  const j = requireJoinerOf(manager, joinerId);
  const details = {};
  for (const f of DAY1_FIELDS) {
    const v = String(input?.[f] ?? '').trim();
    if (!v) throw new ChecklistError(400, 'Fill in every Day 1 detail before sharing it');
    if (v.length > 200) throw new ChecklistError(400, 'Each Day 1 detail can be up to 200 characters');
    details[f] = v;
  }
  q.setDay1.run(j.email, JSON.stringify(details), new Date().toISOString(), manager.name);
  return buildChecklist(manager, j);
}

/** Records a training reminder and returns the chat message text for the server to send. */
export function trainingReminder(manager, joinerId) {
  const j = requireJoinerOf(manager, joinerId);
  if (trainingFor(j.email).completedAt) throw new ChecklistError(400, `${j.name.split(' ')[0]} has already finished the training`);
  q.setReminded.run(j.email, new Date().toISOString());
  const text = `Hi ${j.name.split(' ')[0]}, a quick reminder to do your pre-start onboarding training before your first day. It takes about 40 minutes, and if you finish it before Day 1, your lunch with the team is on us. You'll find details in your guides under "Learning and mandatory training".`;
  return { conversationId: j.conversation_id, text };
}
