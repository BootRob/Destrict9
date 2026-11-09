// SQLite storage via Node's built-in node:sqlite, so no native modules are needed.
// The database file lives in app/data/ (git-ignored). Delete it, or run `npm run reset`, to re-seed.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SCHEMA_VERSION = 2;

const dataDir = fileURLToPath(new URL('./data/', import.meta.url));
mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(process.env.DB_PATH || `${dataDir}app.db`);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

/** Staff roles a joiner can have a conversation with, in display order. */
export const STAFF_ROLES = ['manager', 'recruiter', 'buddy'];
export const ROLE_LABELS = {
  joiner: 'New joiner',
  manager: 'Hiring manager',
  recruiter: 'Recruiter',
  buddy: 'Buddy',
};

// Prototype data is disposable: if the schema changes, rebuild from the seed.
if (db.prepare('PRAGMA user_version').get().user_version !== SCHEMA_VERSION) {
  db.exec(`
    PRAGMA foreign_keys = OFF;
    DROP TABLE IF EXISTS messages;
    DROP TABLE IF EXISTS conversations;
    DROP TABLE IF EXISTS sessions;
    DROP TABLE IF EXISTS users;
    PRAGMA foreign_keys = ON;

    CREATE TABLE users (
      id            INTEGER PRIMARY KEY,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL CHECK (role IN ('joiner', 'manager', 'recruiter', 'buddy')),
      job_title     TEXT,
      location      TEXT,
      start_date    TEXT              -- joiners only, YYYY-MM-DD
    );

    CREATE TABLE sessions (
      token      TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );

    -- One private conversation per joiner per assigned staff member.
    -- kind records the staff member's relationship to this joiner.
    CREATE TABLE conversations (
      id        INTEGER PRIMARY KEY,
      joiner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      staff_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind      TEXT NOT NULL CHECK (kind IN ('manager', 'recruiter', 'buddy')),
      UNIQUE (joiner_id, kind)
    );
    CREATE INDEX conversations_by_staff ON conversations (staff_id);

    CREATE TABLE messages (
      id              INTEGER PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id       INTEGER NOT NULL REFERENCES users(id),
      body            TEXT NOT NULL,
      created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      read_at         TEXT
    );
    CREATE INDEX messages_by_conversation ON messages (conversation_id, id);

    PRAGMA user_version = ${SCHEMA_VERSION};
  `);
}

export function hashPassword(password) {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [saltHex, hashHex] = String(stored).split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(String(password), Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(expected, actual);
}

// Synthetic demo accounts. Every name, email and detail here is made up.
export const DEMO_PASSWORD = 'demo1234';

function seed() {
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) return;

  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, job_title, location, start_date)
    VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`);
  const add = (name, email, role, job, location, start = null) =>
    insertUser.get(name, email, hashPassword(DEMO_PASSWORD), role, job, location, start).id;

  // Staff
  const sam    = add('Sam Reid',     'sam.reid@example.com',     'manager',   'Engineering Manager',          'Leeds');
  const hannah = add('Hannah Price', 'hannah.price@example.com', 'manager',   'Contact Centre Manager',       'Cardiff');
  const jordan = add('Jordan Ellis', 'jordan.ellis@example.com', 'recruiter', 'Talent Acquisition Partner',   'Leeds');
  const maya   = add('Maya Okafor',  'maya.okafor@example.com',  'buddy',     'Senior Software Engineer',     'Leeds');
  const rhys   = add('Rhys Morgan',  'rhys.morgan@example.com',  'buddy',     'Customer Service Team Leader', 'Cardiff');

  // Joiners
  const alex  = add('Alex Kim',    'alex.kim@example.com',    'joiner', 'Software Engineer',        'Leeds',   '2026-11-30');
  const priya = add('Priya Shah',  'priya.shah@example.com',  'joiner', 'Data Analyst',             'Leeds',   '2026-12-07');
  const owen  = add('Owen Davies', 'owen.davies@example.com', 'joiner', 'Customer Service Advisor', 'Cardiff', '2026-12-14');

  const insertConv = db.prepare('INSERT INTO conversations (joiner_id, staff_id, kind) VALUES (?, ?, ?) RETURNING id');
  const conv = (joiner, staff, kind) => insertConv.get(joiner, staff, kind).id;

  const alexMgr = conv(alex, sam, 'manager');
  const alexRec = conv(alex, jordan, 'recruiter');
  const alexBud = conv(alex, maya, 'buddy');
  conv(priya, sam, 'manager');
  const priyaRec = conv(priya, jordan, 'recruiter');
  // Priya's buddy isn't assigned yet, which shows the "not assigned" state.
  conv(owen, hannah, 'manager');
  conv(owen, jordan, 'recruiter');
  conv(owen, rhys, 'buddy');

  const insertMsg = db.prepare('INSERT INTO messages (conversation_id, sender_id, body, created_at, read_at) VALUES (?, ?, ?, ?, ?)');
  const ago = (h) => new Date(Date.now() - h * 3600_000).toISOString();
  const msg = (c, from, body, hoursAgo, read = true) => insertMsg.run(c, from, body, ago(hoursAgo), read ? ago(hoursAgo - 0.5) : null);

  msg(alexRec, jordan, "Congratulations again, Alex! Your offer is confirmed. Background checks have started, and I'll keep you posted here.", 72);
  msg(alexRec, alex, 'Thank you! Roughly how long do the checks usually take?', 71);
  msg(alexRec, jordan, "Usually 2 to 4 weeks. It's run by an external company, so just answer honestly and you've nothing to worry about.", 70);
  msg(alexRec, jordan, 'Good news: your checks have cleared. Your start date is confirmed for Monday 30 November.', 5, false);

  msg(alexMgr, sam, "Hi Alex, welcome aboard! I'm Sam, your hiring manager. Really looking forward to having you on the team.", 26);
  msg(alexMgr, sam, 'No rush on anything while your checks complete. Message me here if you have questions about the role or your first week.', 26);
  msg(alexMgr, alex, 'Thanks Sam! Quick one: is there anything I should read up on before I start?', 24, false);

  msg(alexBud, maya, "Hey Alex, I'm Maya, your buddy! Ask me anything, however small: where to get coffee, who's who, how things really work.", 20, false);

  msg(priyaRec, jordan, "Hi Priya, congratulations on your offer! I'll be your contact while your checks run.", 30);
}

seed();
