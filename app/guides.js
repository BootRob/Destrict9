// Onboarding guides: the Markdown files in ./knowledge/, readable by everyone logged in,
// editable by managers and recruiters. Who last edited each guide is kept in knowledge/.meta.json.
import { readdirSync, readFileSync, writeFileSync, renameSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const EDITOR_ROLES = ['manager', 'recruiter'];
export const MAX_GUIDE_CHARS = 30_000;
const ID_RE = /^[a-z0-9][a-z0-9-]{0,60}$/;

const dir = fileURLToPath(new URL('./knowledge/', import.meta.url));
const metaPath = `${dir}.meta.json`;
const listeners = new Set();

const readMeta = () => (existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {});
const titleOf = (markdown, fallback) => markdown.match(/^#\s+(.+)$/m)?.[1].trim() ?? fallback;

function writeAtomic(path, text) {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, path);
}

function load(id, meta = readMeta()) {
  const path = `${dir}${id}.md`;
  const markdown = readFileSync(path, 'utf8').replace(/\r\n/g, '\n').trim();
  return {
    id,
    title: titleOf(markdown, id),
    markdown,
    // Edits made in the app record who made them; files edited by hand fall back to the file's modified time.
    updatedAt: meta[id]?.updatedAt ?? statSync(path).mtime.toISOString(),
    updatedBy: meta[id]?.updatedBy ?? null,
  };
}

/** All guides, sorted by file name (the assistant relies on this order being stable). */
export function allGuides() {
  const meta = readMeta();
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .sort()
    .map((f) => load(f.slice(0, -3), meta));
}

export function getGuide(id) {
  return ID_RE.test(id) && existsSync(`${dir}${id}.md`) ? load(id) : null;
}

/** Calls `fn()` after any guide is created or updated. */
export const onChange = (fn) => listeners.add(fn);

/** Returns an error message, or null if the Markdown is acceptable. */
export function validate(markdown) {
  if (typeof markdown !== 'string' || !markdown.trim()) return 'The guide is empty';
  if (markdown.length > MAX_GUIDE_CHARS) return `Guides can be up to ${MAX_GUIDE_CHARS.toLocaleString('en-GB')} characters`;
  if (!/^#\s+\S/.test(markdown.trim())) return 'Start the guide with a title line, for example "# Parking at the Leeds office"';
  if (/<\/?documents?\b/i.test(markdown)) return 'Guides can’t contain <document> tags';
  return null;
}

function save(id, markdown, user) {
  const clean = `${markdown.replace(/\r\n/g, '\n').trim()}\n`;
  writeAtomic(`${dir}${id}.md`, clean);
  const meta = readMeta();
  meta[id] = { updatedAt: new Date().toISOString(), updatedBy: { name: user.name, role: user.role } };
  writeAtomic(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
  for (const fn of listeners) fn();
  return load(id, meta);
}

/**
 * Updates an existing guide. `baseUpdatedAt` is the version the editor started from: if someone
 * else saved since, this throws a 409 instead of overwriting their changes.
 */
export function updateGuide(id, markdown, baseUpdatedAt, user) {
  const current = getGuide(id);
  if (!current) throw Object.assign(new Error('Guide not found'), { status: 404 });
  if (baseUpdatedAt && baseUpdatedAt !== current.updatedAt) {
    const who = current.updatedBy?.name ?? 'Someone';
    throw Object.assign(new Error(`${who} changed this guide while you were editing. Copy your changes, reload, and try again.`), { status: 409 });
  }
  const problem = validate(markdown);
  if (problem) throw Object.assign(new Error(problem), { status: 400 });
  return save(id, markdown, user);
}

/** Creates a guide. Its ID is the next number plus a slug of its title, e.g. "12-parking-at-leeds". */
export function createGuide(markdown, user) {
  const problem = validate(markdown);
  if (problem) throw Object.assign(new Error(problem), { status: 400 });
  const slug = titleOf(markdown, 'guide').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'guide';
  const next = Math.max(0, ...allGuides().map((g) => Number.parseInt(g.id, 10) || 0)) + 1;
  const id = `${String(next).padStart(2, '0')}-${slug}`;
  return save(id, markdown, user);
}
