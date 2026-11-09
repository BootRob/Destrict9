// Outgoing email. The prototype doesn't send real email: every message is stored
// in the `emails` table and shown on the demo mailbox page (/mailbox.html).
// To send for real, replace the body of sendEmail with a call to an email service
// (for example Azure Communication Services Email) and keep the same arguments.
import { db } from './db.js';

const q = {
  insert: db.prepare(`
    INSERT INTO emails (to_email, to_name, from_name, subject, body, action_url, action_label)
    VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`),
  all: db.prepare('SELECT * FROM emails ORDER BY id DESC LIMIT 200'),
};

export const MAILBOX_ENABLED = process.env.DEMO_MAILBOX !== 'off';

const toEmail = (e) => ({
  id: e.id, to: e.to_email, toName: e.to_name, from: e.from_name, subject: e.subject,
  body: e.body, actionUrl: e.action_url, actionLabel: e.action_label, createdAt: e.created_at,
});

export function sendEmail({ to, toName = null, fromName, subject, body, actionUrl = null, actionLabel = null }) {
  return toEmail(q.insert.get(to, toName, fromName, subject, body, actionUrl, actionLabel));
}

export const listEmails = () => q.all.all().map(toEmail);
