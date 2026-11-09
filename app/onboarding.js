// Recruiter onboarding: list applicants, onboard a successful one (creates an invited
// joiner account, opens the recruiter chat and emails the conditional offer with an
// activation link), resend the link, and activate the account when the recruit sets a password.
// The rest of the journey (accepting offers, screening) lives in journey.js.
import { createHash, randomBytes } from 'node:crypto';
import { db, hashPassword } from './db.js';
import { sendEmail } from './mailer.js';

const INVITE_MS = 7 * 24 * 3600_000;
export const MIN_PASSWORD = 8;
const MAX_PASSWORD = 200;

export class OnboardingError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
export const now = () => new Date().toISOString();
export const firstName = (name) => name.split(' ')[0];
export const fmtLongDate = (d) => d && new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const APPLICANT_SELECT = `
  SELECT a.*, m.name AS manager_name, r.name AS recruiter_name, u.status AS user_status,
    (SELECT c.id FROM conversations c WHERE c.joiner_id = a.user_id AND c.staff_id = a.recruiter_id) AS conversation_id
  FROM applicants a
  JOIN users m ON m.id = a.hiring_manager_id
  JOIN users r ON r.id = a.recruiter_id
  LEFT JOIN users u ON u.id = a.user_id`;

export const q = {
  forRecruiter: db.prepare(`${APPLICANT_SELECT} WHERE a.recruiter_id = ? ORDER BY a.applied_at DESC`),
  byId: db.prepare(`${APPLICANT_SELECT} WHERE a.id = ?`),
  byUser: db.prepare(`${APPLICANT_SELECT} WHERE a.user_id = ?`),
  userByEmail: db.prepare('SELECT id FROM users WHERE email = ?'),
  insertUser: db.prepare(`
    INSERT INTO users (name, email, password_hash, role, status, job_title, location, start_date)
    VALUES (?, ?, NULL, 'joiner', 'invited', ?, ?, ?) RETURNING id`),
  linkApplicant: db.prepare("UPDATE applicants SET user_id = ?, onboarded_at = ?, journey_stage = 'conditional_offer' WHERE id = ?"),
  insertConv: db.prepare('INSERT INTO conversations (joiner_id, staff_id, kind) VALUES (?, ?, ?) ON CONFLICT (joiner_id, kind) DO NOTHING RETURNING id'),
  insertMessage: db.prepare('INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)'),
  revokeInvites: db.prepare('UPDATE invites SET revoked_at = ? WHERE user_id = ? AND used_at IS NULL AND revoked_at IS NULL'),
  insertInvite: db.prepare('INSERT INTO invites (user_id, token_hash, expires_at) VALUES (?, ?, ?)'),
  invite: db.prepare(`
    SELECT i.*, u.name, u.email, u.job_title, u.location, u.start_date, u.status
    FROM invites i JOIN users u ON u.id = i.user_id WHERE i.token_hash = ?`),
  activateUser: db.prepare("UPDATE users SET password_hash = ?, status = 'active' WHERE id = ? AND status = 'invited'"),
  useInvite: db.prepare('UPDATE invites SET used_at = ? WHERE id = ?'),
};

/**
 * Applicant as shown to the recruiter. `stage` folds hiring status, account state and
 * journey into one value: interviewing | successful | unsuccessful | invited |
 * conditional_offer | screening | screening_submitted | unconditional_offer | accepted | declined | withdrawn
 */
export function toApplicant(a) {
  const stage = !a.user_id ? a.status : a.user_status === 'invited' ? 'invited' : a.journey_stage;
  return {
    id: a.id, name: a.name, email: a.email, jobTitle: a.job_title, location: a.location,
    hiringManager: { id: a.hiring_manager_id, name: a.manager_name },
    recruiterId: a.recruiter_id,
    status: a.status, stage, journeyStage: a.journey_stage, outcomeNote: a.outcome_note,
    appliedAt: a.applied_at, startDate: a.start_date, salary: a.salary,
    userId: a.user_id, onboardedAt: a.onboarded_at, conversationId: a.conversation_id ?? null,
    screeningSubmittedAt: a.screening_submitted_at, screeningResult: a.screening_result,
    declinedOffer: a.declined_offer, declineReason: a.decline_reason,
    conditionalAcceptedAt: a.conditional_responded_at, unconditionalSentAt: a.unconditional_sent_at,
    unconditionalAcceptedAt: a.unconditional_responded_at, device: a.device_choice,
    canOnboard: a.status === 'successful' && !a.user_id,
    canRecordResult: a.journey_stage === 'screening_submitted',
  };
}

export const listApplicants = (recruiterId) => q.forRecruiter.all(recruiterId).map(toApplicant);

export function getApplicant(id) {
  const a = q.byId.get(id);
  return a ? toApplicant(a) : null;
}

/** Recruiter's own applicant row, or a 404 (other recruiters' candidates are invisible, not forbidden). */
export function ownApplicant(recruiter, applicantId) {
  const a = Number.isInteger(applicantId) ? q.byId.get(applicantId) : undefined;
  if (!a || a.recruiter_id !== recruiter.id) throw new OnboardingError(404, 'Applicant not found');
  return a;
}

/** Runs fn inside a transaction. */
export function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function issueInvite(userId) {
  const token = randomBytes(32).toString('base64url');
  q.revokeInvites.run(now(), userId);
  q.insertInvite.run(userId, sha256(token), new Date(Date.now() + INVITE_MS).toISOString());
  return token;
}

function sendInviteEmail(a, token, origin, { reminder = false } = {}) {
  const lines = [
    `Hi ${firstName(a.name)},`,
    '',
    reminder
      ? "Here's a fresh link to set up your joiner companion app. Your previous link no longer works."
      : `Congratulations! We're delighted to offer you the role of ${a.job_title} in ${a.location}.`,
  ];
  if (!reminder) {
    lines.push(
      '',
      'Your conditional offer is waiting for you in your joiner companion app. It is conditional on pre-employment screening, which the app will walk you through once you accept.',
      '',
      'The app will guide you from here to your first 30 days, and you can message me there at any time.',
    );
  }
  lines.push(
    '',
    'Use the button below to set your password and view your offer. The link works once and expires in 7 days.',
    '',
    'Best wishes,',
    a.recruiter_name,
    'Talent Acquisition',
  );
  return sendEmail({
    to: a.email,
    toName: a.name,
    fromName: `${a.recruiter_name} (Lloyds Banking Group)`,
    subject: reminder ? 'Your new link to the joiner companion app' : `Your offer from Lloyds Banking Group, ${firstName(a.name)}`,
    body: lines.join('\n'),
    actionUrl: `${origin}/activate.html?token=${token}`,
    actionLabel: 'View my offer',
  });
}

/**
 * Onboards a successful applicant: creates an invited joiner account, opens the recruiter
 * chat (with a welcome message), starts the journey at "conditional offer" and emails a
 * one-time activation link. The hiring-manager chat opens later, when the unconditional
 * offer is accepted. Returns { applicant, email, conversations: [{ id, staffId }] }.
 */
export function onboard(recruiter, applicantId, origin) {
  const a = ownApplicant(recruiter, applicantId);
  if (a.user_id) throw new OnboardingError(409, `${a.name} has already been onboarded`);
  if (a.status !== 'successful') throw new OnboardingError(409, 'Only successful applicants can be onboarded');
  const email = a.email.trim().toLowerCase();
  if (q.userByEmail.get(email)) throw new OnboardingError(409, `An account already exists for ${email}`);

  const result = transaction(() => {
    const userId = q.insertUser.get(a.name, email, a.job_title, a.location, a.start_date).id;
    q.linkApplicant.run(userId, now(), a.id);
    const recruiterConv = q.insertConv.get(userId, a.recruiter_id, 'recruiter').id;
    q.insertMessage.run(recruiterConv, a.recruiter_id,
      `Hi ${firstName(a.name)}, congratulations and welcome to your joiner companion app! I'm ${a.recruiter_name}, your recruiter. ` +
      "Your conditional offer is on your home screen. Ask me anything along the way.");
    const token = issueInvite(userId);
    return { email: sendInviteEmail(a, token, origin), conversations: [{ id: recruiterConv, staffId: a.recruiter_id }] };
  });
  return { applicant: getApplicant(a.id), ...result };
}

/** Sends a new activation link (and revokes the old one) to an invited applicant. */
export function resendInvite(recruiter, applicantId, origin) {
  const a = ownApplicant(recruiter, applicantId);
  if (!a.user_id) throw new OnboardingError(409, `${a.name} hasn't been onboarded yet`);
  if (a.user_status !== 'invited') throw new OnboardingError(409, `${a.name} has already activated their account`);
  const token = issueInvite(a.user_id);
  return { applicant: getApplicant(a.id), email: sendInviteEmail(a, token, origin, { reminder: true }) };
}

function validInvite(token) {
  const invite = typeof token === 'string' && token.length >= 20 ? q.invite.get(sha256(token)) : undefined;
  if (!invite) throw new OnboardingError(404, "This link isn't valid. Ask your recruiter to send a new one.");
  if (invite.used_at || invite.status === 'active') throw new OnboardingError(410, 'This link has already been used. Log in with your email and password.');
  if (invite.revoked_at) throw new OnboardingError(410, 'A newer link has been sent. Use the most recent email from your recruiter.');
  if (invite.expires_at <= now()) throw new OnboardingError(410, 'This link has expired. Ask your recruiter to send a new one.');
  return invite;
}

/** What the activation page shows before the recruit sets a password. */
export function inviteInfo(token) {
  const i = validInvite(token);
  return { name: i.name, email: i.email, jobTitle: i.job_title, location: i.location, startDate: i.start_date, minPassword: MIN_PASSWORD };
}

/** Sets the password, marks the account active and burns the link. Returns { userId, applicantId }. */
export function activate(token, password) {
  const invite = validInvite(token);
  const pw = String(password ?? '');
  if (pw.length < MIN_PASSWORD) throw new OnboardingError(400, `Use at least ${MIN_PASSWORD} characters for your password`);
  if (pw.length > MAX_PASSWORD) throw new OnboardingError(400, 'That password is too long');
  transaction(() => {
    const { changes } = q.activateUser.run(hashPassword(pw), invite.user_id);
    if (!changes) throw new OnboardingError(410, 'This account is already active. Log in with your email and password.');
    q.useInvite.run(now(), invite.id);
  });
  return { userId: invite.user_id, applicantId: q.byUser.get(invite.user_id)?.id ?? null };
}
