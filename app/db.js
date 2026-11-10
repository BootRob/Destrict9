// SQLite storage via Node's built-in node:sqlite, so no native modules are needed.
// The database file lives in app/data/ (git-ignored). Delete it, or run `npm run reset`, to re-seed.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SCHEMA_VERSION = 7; // 7: recruits who have already started (Ruby, Day 12; Tom, Day 45)

const dataDir = fileURLToPath(new URL('./data/', import.meta.url));
mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(process.env.DB_PATH || `${dataDir}app.db`);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

/** Staff roles a joiner can have a conversation with, in display order. */
export const STAFF_ROLES = ['manager', 'recruiter'];
export const ROLE_LABELS = {
  joiner: 'New joiner',
  manager: 'Hiring manager',
  recruiter: 'Recruiter',
};

/**
 * The recruit's journey after onboarding, in order. `declined` and `withdrawn` end it.
 *   conditional_offer   -> offer sent, waiting for the recruit to accept
 *   screening           -> accepted; recruit completes their details on ClearPath's own site (third party)
 *   screening_submitted -> recruit has confirmed they've done that; checks running at ClearPath
 *   unconditional_offer -> screening clear; waiting for the recruit to accept
 *   accepted            -> accepted the unconditional offer; connected to their hiring manager
 */
export const JOURNEY_STAGES = ['conditional_offer', 'screening', 'screening_submitted', 'unconditional_offer', 'accepted', 'declined', 'withdrawn'];

// Prototype data is disposable: if the schema changes, rebuild from the seed.
if (db.prepare('PRAGMA user_version').get().user_version !== SCHEMA_VERSION) {
  db.exec(`
    PRAGMA foreign_keys = OFF;
    DROP TABLE IF EXISTS emails;
    DROP TABLE IF EXISTS invites;
    DROP TABLE IF EXISTS applicants;
    DROP TABLE IF EXISTS messages;
    DROP TABLE IF EXISTS conversations;
    DROP TABLE IF EXISTS sessions;
    DROP TABLE IF EXISTS users;
    PRAGMA foreign_keys = ON;

    CREATE TABLE users (
      id            INTEGER PRIMARY KEY,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT,             -- NULL until an invited joiner activates their account
      role          TEXT NOT NULL CHECK (role IN ('joiner', 'manager', 'recruiter')),
      status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active')),
      job_title     TEXT,
      location      TEXT,
      start_date    TEXT              -- joiners only, YYYY-MM-DD
    );

    CREATE TABLE sessions (
      token      TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );

    -- One private conversation per joiner per staff member.
    -- The recruiter chat opens at onboarding; the manager chat once the unconditional offer is accepted.
    CREATE TABLE conversations (
      id        INTEGER PRIMARY KEY,
      joiner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      staff_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind      TEXT NOT NULL CHECK (kind IN ('manager', 'recruiter')),
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

    -- Candidates a recruiter is hiring for. Onboarding a successful one creates an
    -- invited joiner account (user_id), sends the conditional offer and starts the journey.
    CREATE TABLE applicants (
      id                INTEGER PRIMARY KEY,
      name              TEXT NOT NULL,
      email             TEXT NOT NULL,       -- personal email: where invites go, and their login
      job_title         TEXT NOT NULL,
      location          TEXT NOT NULL,
      recruiter_id      INTEGER NOT NULL REFERENCES users(id),
      hiring_manager_id INTEGER NOT NULL REFERENCES users(id),
      status            TEXT NOT NULL CHECK (status IN ('interviewing', 'successful', 'unsuccessful')),
      outcome_note      TEXT,
      applied_at        TEXT NOT NULL,
      start_date        TEXT,                -- proposed, YYYY-MM-DD
      salary            TEXT,
      contract          TEXT,
      user_id           INTEGER UNIQUE REFERENCES users(id),
      onboarded_at      TEXT,
      -- journey (NULL until onboarded)
      journey_stage              TEXT CHECK (journey_stage IN ('conditional_offer', 'screening', 'screening_submitted', 'unconditional_offer', 'accepted', 'declined', 'withdrawn')),
      conditional_responded_at   TEXT,
      screening_submitted_at     TEXT,
      screening_result           TEXT CHECK (screening_result IN ('clear', 'not_clear')),
      screening_result_at        TEXT,
      screening_note             TEXT,
      unconditional_sent_at      TEXT,
      unconditional_responded_at TEXT,
      declined_offer             TEXT CHECK (declined_offer IN ('conditional', 'unconditional')),
      decline_reason             TEXT,
      device_choice              TEXT CHECK (device_choice IN ('mac', 'hp')),  -- laptop chosen after accepting
      device_chosen_at           TEXT
    );
    CREATE INDEX applicants_by_recruiter ON applicants (recruiter_id);

    -- One-time activation links. Only a SHA-256 hash of the token is stored.
    CREATE TABLE invites (
      id         INTEGER PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      expires_at TEXT NOT NULL,
      used_at    TEXT,
      revoked_at TEXT
    );

    -- Outgoing email. The prototype doesn't send real email: the demo mailbox
    -- page (/mailbox.html) reads this table instead.
    CREATE TABLE emails (
      id           INTEGER PRIMARY KEY,
      to_email     TEXT NOT NULL,
      to_name      TEXT,
      from_name    TEXT NOT NULL,
      subject      TEXT NOT NULL,
      body         TEXT NOT NULL,
      action_url   TEXT,
      action_label TEXT,
      created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    PRAGMA user_version = ${SCHEMA_VERSION};
  `);
}

export function hashPassword(password) {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password, stored) {
  if (!stored) return false;
  const [saltHex, hashHex] = String(stored).split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(String(password), Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(expected, actual);
}

/** Synthetic salaries by role. */
export const OFFER_TERMS = {
  'Software Engineer':        '£52,000',
  'Data Analyst':             '£41,000',
  'Customer Service Advisor': '£24,500',
  'Cyber Security Analyst':   '£48,000',
  'Mortgage Advisor':         '£33,000',
};
export const DEFAULT_CONTRACT = 'Permanent · 35 hours a week · hybrid, 2 days a week in the office';

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
  const sam    = add('Sam Reid',      'sam.reid@example.com',      'manager',   'Engineering Manager',        'Leeds');
  const hannah = add('Hannah Price',  'hannah.price@example.com',  'manager',   'Contact Centre Manager',     'Cardiff');
  const jordan = add('Jordan Ellis',  'jordan.ellis@example.com',  'recruiter', 'Talent Acquisition Partner', 'Leeds');
  const leah   = add('Leah Thompson', 'leah.thompson@example.com', 'recruiter', 'Talent Acquisition Partner', 'Cardiff');

  // Joiners who are already part-way through
  const alex  = add('Alex Kim',    'alex.kim@example.com',    'joiner', 'Software Engineer',        'Leeds',   '2026-11-30');
  const priya = add('Priya Shah',  'priya.shah@example.com',  'joiner', 'Data Analyst',             'Leeds',   '2026-12-07');
  const owen  = add('Owen Davies', 'owen.davies@example.com', 'joiner', 'Customer Service Advisor', 'Cardiff', '2026-12-14');
  // Recruits who have already started, dated from today so they stay on Day 12 and Day 45.
  const startedDaysAgo = (d) => new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10);
  const rubyStart = startedDaysAgo(11), tomStart = startedDaysAgo(44);
  const ruby  = add('Ruby Ahmed', 'ruby.ahmed@example.com', 'joiner', 'Software Engineer',        'Leeds',   rubyStart);
  const tom   = add('Tom Bennett', 'tom.bennett@example.com', 'joiner', 'Customer Service Advisor', 'Cardiff', tomStart);

  const insertConv = db.prepare('INSERT INTO conversations (joiner_id, staff_id, kind) VALUES (?, ?, ?) RETURNING id');
  const conv = (joiner, staff, kind) => insertConv.get(joiner, staff, kind).id;

  const alexMgr = conv(alex, sam, 'manager');       // Alex and Owen have accepted unconditional offers
  const alexRec = conv(alex, jordan, 'recruiter');
  const priyaRec = conv(priya, jordan, 'recruiter'); // Priya is waiting on screening: no manager chat yet
  const owenRec = conv(owen, jordan, 'recruiter');
  conv(owen, hannah, 'manager');
  const rubyMgr = conv(ruby, sam, 'manager');
  conv(ruby, jordan, 'recruiter');
  const tomMgr = conv(tom, hannah, 'manager');
  conv(tom, jordan, 'recruiter');

  const insertMsg = db.prepare('INSERT INTO messages (conversation_id, sender_id, body, created_at, read_at) VALUES (?, ?, ?, ?, ?)');
  const ago = (h) => new Date(Date.now() - h * 3600_000).toISOString();
  const msg = (c, from, body, hoursAgo, read = true) => insertMsg.run(c, from, body, ago(hoursAgo), read ? ago(hoursAgo - 0.5) : null);

  msg(alexRec, jordan, "Congratulations, Alex! Your conditional offer is in the app. Accept it when you're ready and I'll start your screening.", 400);
  msg(alexRec, alex, 'Accepted! Roughly how long does screening take?', 380);
  msg(alexRec, jordan, "Usually 2 to 4 weeks. It's run by an external company, so just answer honestly and you've nothing to worry about.", 379);
  msg(alexRec, jordan, 'Good news: your screening is clear and your unconditional offer is confirmed. Start date: Monday 30 November.', 120, false);

  msg(alexMgr, sam, "Hi Alex, welcome aboard! I'm Sam, your hiring manager. Really looking forward to having you on the team.", 26);
  msg(alexMgr, sam, 'Message me here if you have questions about the role or your first week.', 26);
  msg(alexMgr, alex, 'Thanks Sam! Quick one: is there anything I should read up on before I start?', 24, false);

  msg(priyaRec, jordan, "Hi Priya, thanks for completing your screening form. The checks are with our screening partner now. I'll message you as soon as there's news.", 90);
  msg(owenRec, jordan, "Welcome aboard, Owen! You're now connected with Hannah, your hiring manager.", 60);
  msg(rubyMgr, sam, 'Great first week, Ruby! Your 1:1s are on Thursdays at 10. Shout if anything is blocking you.', 70);
  msg(rubyMgr, ruby, "Thanks Sam. I've got my dev environment working. Who's best to ask about the release process?", 50);
  msg(rubyMgr, sam, 'Priti on the platform team. I\'ve introduced you both on Teams.', 49, false);
  msg(tomMgr, hannah, "Hi Tom, let's use Friday's 1:1 to agree your goals for the next couple of months. Have a think about what you'd like to get better at.", 30);
  msg(tomMgr, tom, 'Will do. I would like to get more confident with mortgage queries.', 28);

  // Applicants
  const insertApplicant = db.prepare(`
    INSERT INTO applicants (name, email, job_title, location, recruiter_id, hiring_manager_id, status, outcome_note,
      applied_at, start_date, salary, contract, user_id, onboarded_at, journey_stage, conditional_responded_at,
      screening_submitted_at, screening_result, screening_result_at, unconditional_sent_at, unconditional_responded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const daysAgo = (d) => (d == null ? null : new Date(Date.now() - d * 86_400_000).toISOString());
  const applicant = (name, email, job, location, recruiter, manager, status, o = {}) =>
    insertApplicant.run(name, email, job, location, recruiter, manager, status, o.note ?? null,
      daysAgo(o.applied ?? 30), o.start ?? null, OFFER_TERMS[job] ?? null, DEFAULT_CONTRACT,
      o.user ?? null, daysAgo(o.onboarded), o.stage ?? null, daysAgo(o.accepted),
      daysAgo(o.submitted), o.result ?? null, daysAgo(o.resultAt),
      daysAgo(o.uncond), daysAgo(o.uncondAccepted));

  applicant('Alex Kim',    'alex.kim@example.com',    'Software Engineer',        'Leeds',   jordan, sam,    'successful',
    { applied: 60, start: '2026-11-30', user: alex,  onboarded: 17, stage: 'accepted', accepted: 16, submitted: 15, result: 'clear', resultAt: 5, uncond: 5, uncondAccepted: 4 });
  applicant('Priya Shah',  'priya.shah@example.com',  'Data Analyst',             'Leeds',   jordan, sam,    'successful',
    { applied: 55, start: '2026-12-07', user: priya, onboarded: 6,  stage: 'screening_submitted', accepted: 5, submitted: 4 });
  applicant('Owen Davies', 'owen.davies@example.com', 'Customer Service Advisor', 'Cardiff', jordan, hannah, 'successful',
    { applied: 50, start: '2026-12-14', user: owen,  onboarded: 14, stage: 'accepted', accepted: 13, submitted: 12, result: 'clear', resultAt: 3, uncond: 3, uncondAccepted: 2.5 });
  db.prepare("UPDATE applicants SET device_choice = 'hp', device_chosen_at = ? WHERE user_id = ?").run(daysAgo(2), owen);
  applicant('Ruby Ahmed', 'ruby.ahmed@example.com', 'Software Engineer',        'Leeds',   jordan, sam,    'successful',
    { applied: 90, start: rubyStart, user: ruby, onboarded: 60, stage: 'accepted', accepted: 59, submitted: 58, result: 'clear', resultAt: 40, uncond: 40, uncondAccepted: 39 });
  applicant('Tom Bennett', 'tom.bennett@example.com', 'Customer Service Advisor', 'Cardiff', jordan, hannah, 'successful',
    { applied: 120, start: tomStart, user: tom, onboarded: 95, stage: 'accepted', accepted: 94, submitted: 93, result: 'clear', resultAt: 75, uncond: 75, uncondAccepted: 74 });
  db.prepare("UPDATE applicants SET device_choice = 'mac', device_chosen_at = ? WHERE user_id = ?").run(daysAgo(35), ruby);
  db.prepare("UPDATE applicants SET device_choice = 'hp', device_chosen_at = ? WHERE user_id = ?").run(daysAgo(70), tom);
  applicant('Ben Carter',    'ben.carter@example.org',    'Cyber Security Analyst',   'Leeds',   jordan, sam,    'successful',   { applied: 34, start: '2027-01-04', note: 'Verbal offer accepted 6 Nov' });
  applicant('Chloe Evans',   'chloe.evans@example.org',   'Mortgage Advisor',         'Cardiff', jordan, hannah, 'successful',   { applied: 31, start: '2027-01-11', note: 'Verbal offer accepted 5 Nov' });
  applicant('Daniel Wright', 'daniel.wright@example.org', 'Software Engineer',        'Leeds',   jordan, sam,    'successful',   { applied: 28, start: '2027-01-18', note: 'Verbal offer accepted 8 Nov' });
  applicant('Grace Lee',     'grace.lee@example.org',     'Data Analyst',             'Leeds',   jordan, sam,    'unsuccessful', { applied: 40, note: 'Strong interview; another candidate had more SQL experience' });
  applicant('Harry Patel',   'harry.patel@example.org',   'Customer Service Advisor', 'Cardiff', jordan, hannah, 'unsuccessful', { applied: 37, note: 'Not progressed after the assessment centre' });
  applicant('Isla Murray',   'isla.murray@example.org',   'Software Engineer',        'Leeds',   jordan, sam,    'unsuccessful', { applied: 33, note: 'Withdrew to accept another offer' });
  applicant('Jack Robinson', 'jack.robinson@example.org', 'Customer Service Advisor', 'Cardiff', jordan, hannah, 'interviewing', { applied: 12, note: 'Final interview Thu 12 Nov' });
  applicant('Kate Hughes',   'kate.hughes@example.org',   'Data Analyst',             'Leeds',   jordan, sam,    'interviewing', { applied: 9,  note: 'Technical test sent' });
  // Leah's candidates: Jordan never sees these.
  applicant('Liam Scott',    'liam.scott@example.org',    'Mortgage Advisor',         'Cardiff', leah,   hannah, 'successful',   { applied: 26, start: '2027-01-25', note: 'Verbal offer accepted 4 Nov' });
  applicant('Mia Clarke',    'mia.clarke@example.org',    'Customer Service Advisor', 'Cardiff', leah,   hannah, 'interviewing', { applied: 7,  note: 'Phone screen booked' });
}

seed();
