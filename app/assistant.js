// Joiner assistant: answers questions from the fictional onboarding documents in ./knowledge/.
//
// Providers, chosen by ASSISTANT_PROVIDER (default "auto"):
//   api      Claude API through @anthropic-ai/sdk. Needs ANTHROPIC_API_KEY in app/.env or the environment.
//   cli      The Claude Code CLI on this machine (`claude -p`), using whoever is logged in. For local dev only.
//   offline  No model: returns the best-matching document section. Works with no key or network.
//   auto     api if ANTHROPIC_API_KEY is set, else cli if `claude` is on the PATH, else offline.
import { execFile, execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { allGuides, onChange } from './guides.js';

const MODEL = process.env.ASSISTANT_MODEL || 'claude-opus-5-5';
const EFFORT = process.env.ASSISTANT_EFFORT || 'low'; // chat: keep it quick
const TIMEOUT_MS = 90_000;
const HISTORY_TURNS = 6; // previous question/answer pairs sent for context
export const HANDOFFS = ['none', 'recruiter', 'manager'];

// ---------- knowledge base ----------
// Rebuilt whenever a guide is saved. Between saves the system prompt is byte-identical (prompt caching).
let kb;
function rebuild() {
  const docs = allGuides().map((g) => ({ id: g.id, title: g.title, text: g.markdown }));
  kb = { docs, byId: new Map(docs.map((d) => [d.id, d])), prompt: systemPrompt(docs), sections: sectionsOf(docs) };
}
onChange(rebuild);
export const docCount = () => kb.docs.length;

const systemPrompt = (docs) => `You are the onboarding assistant in a bank's new-joiner companion app. You answer questions from people who have accepted a job offer and haven't started yet, or are in their first 90 days. Questions are usually the kind a recruiter would otherwise answer: checks, start dates, pay, benefits, first day, equipment, training, systems, goals, career growth and policies.

Answer only from the documents below, plus the <joiner> and <day1_details> blocks in each question. Those blocks are this joiner's own information from the app. When they're more specific than the documents (for example their exact Day 1 start time and meeting point), use them.
- The <joiner> block is correct and comes from the app: never question their dates, or say a date looks wrong or falls on an unusual day.
- Answer for where they are now in their journey (its phase and day). If they've already started, don't give pre-start advice (such as what to bring on Day 1) unless they ask about it; answer for their current phase instead.
- Lead with the direct answer in the first sentence: the fact, date, number or yes/no they asked for. Then add only what they need to act on it. Keep the whole reply to about 60 words (never more than 100), in British English, warmly but without fuss.
- If the documents only partly answer it, say what they do cover and what they don't.
- If the documents don't cover it, or the question depends on the joiner's personal situation (their specific offer, salary, check results, contract, or a decision someone needs to make), don't guess. Say you don't have that information, and hand off to the right person using the "Who to ask" document.
- Never invent policies, figures, dates, names, phone numbers or links.
- If someone sounds worried, acknowledge it in a few words before answering.
- Format with light Markdown: **bold** the key fact (once or twice at most), and use "- " bullet lines for 3 or more items. No headings, tables or links.

Return:
- answer: your reply to the joiner.
- sources: the id attribute of each document you used. Empty if none.
- handoff: who the joiner should message next, if anyone: "recruiter" or "manager". Use "none" if your answer is complete. Use a handoff whenever you couldn't fully answer, or the joiner needs a person to act or decide. Questions for HR Service or the IT Service Desk get "none", with the answer telling them where to go.

<documents>
${docs.map((d) => `<document id="${d.id}">\n${d.text}\n</document>`).join('\n')}
</documents>`;

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    sources: { type: 'array', items: { type: 'string' } },
    handoff: { type: 'string', enum: HANDOFFS },
  },
  required: ['answer', 'sources', 'handoff'],
  additionalProperties: false,
};

/** The per-request part: who's asking, recent conversation, then the question. Kept out of the cached system prompt. */
function buildPrompt(user, history, question, context = {}) {
  const lines = [
    '<joiner>',
    `Name: ${user.name}`,
    `Role: ${user.job_title ?? 'unknown'}`,
    `Location: ${user.location ?? 'unknown'}`,
    `Start date: ${user.start_date ?? 'not confirmed'}`,
    `Today: ${new Date().toISOString().slice(0, 10)}`,
    ...(context.journey ? [
      `Phase: ${context.journey.phase.name} (phase ${context.journey.phase.n} of ${context.journey.phase.of})`,
      context.journey.dayNumber ? `They have started: today is Day ${context.journey.dayNumber} of their job` : `Not started yet: ${context.journey.daysToStart ?? 'unknown'} days until their start date`,
    ] : []),
    `Pre-start onboarding training: ${context.training?.completedAt ? `completed on ${context.training.completedAt.slice(0, 10)}, so their Day 1 lunch is on us` : 'not completed yet'}`,
    '</joiner>',
  ];
  const d = context.day1;
  lines.push(d
    ? ['<day1_details from="their hiring manager">', `Start time: ${d.time}`, `Where to meet: ${d.place}`, `Who meets them: ${d.meetBy}`, `Dress code: ${d.dressCode}`, `Number to call if late or unwell: ${d.phone}`, '</day1_details>'].join('\n')
    : '<day1_details>Their manager has not shared Day 1 details yet. For their exact time and meeting point, hand off to the manager.</day1_details>');
  if (history.length) {
    lines.push('<earlier_conversation>');
    for (const t of history) lines.push(`Joiner: ${t.question}`, `Assistant: ${t.answer}`);
    lines.push('</earlier_conversation>');
  }
  lines.push(`<question>\n${question}\n</question>`);
  return lines.join('\n');
}

// ---------- providers ----------
async function askApi(prompt) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = (askApi.client ??= new Anthropic());
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default', // if the model declines, the API retries on its recommended fallback model
    output_config: { effort: EFFORT, format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    system: [{ type: 'text', text: kb.prompt, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: prompt }],
  });
  if (res.stop_reason === 'refusal') throw new Error('The model declined this question');
  const text = res.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error(`No answer from the model (stop reason: ${res.stop_reason})`);
  return JSON.parse(text);
}

function askCli(prompt) {
  const args = [
    '-p',
    '--system-prompt', kb.prompt,
    '--json-schema', JSON.stringify(OUTPUT_SCHEMA),
    '--output-format', 'json',
    '--model', MODEL,
    '--effort', EFFORT,
    '--tools', '',            // no file, shell or web access
    '--setting-sources', '',  // ignore CLAUDE.md files and local settings
    '--strict-mcp-config',    // no MCP servers
    '--no-session-persistence',
  ];
  return new Promise((resolve, reject) => {
    // Runs in the temp dir, so it can't pick up this repo's files as context.
    const child = execFile('claude', args, { cwd: tmpdir(), timeout: TIMEOUT_MS, maxBuffer: 4 << 20 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`claude CLI failed: ${stderr?.trim() || err.message}`));
      try {
        const out = JSON.parse(stdout);
        if (out.is_error || !out.structured_output) throw new Error(out.result || 'no structured output');
        resolve(out.structured_output);
      } catch (e) {
        reject(new Error(`claude CLI returned an unexpected response: ${e.message}`));
      }
    });
    child.stdin.end(prompt);
  });
}

// ---------- offline search: no model, pick the best-matching document section ----------
const STOP = new Set('the and what when how can does for you your are will with have about should there this that need any get who why which from into before after its it’s our out was were has had not but all one also than then them they their just like much many more most some such only very would could here where i’m dont don’t yet use do my me is am be of to in on at by or an a if as so it we us no up'.split(' '));
const stem = (w) => w.replace(/(ings?|ed|es|s)$/, '') || w;
const terms = (s) => (s.toLowerCase().match(/[a-z0-9’']+/g) ?? []).filter((w) => w.length > 1 && !STOP.has(w)).map(stem);

function sectionsOf(docs) {
  const hasBody = (section) => section.split('\n').some((l) => l.trim() && !/^(#{1,4}\s|>)/.test(l));
  return docs.flatMap((doc) =>
    doc.text.split(/\n(?=## )/).filter(hasBody).map((section) => {
      const heading = section.match(/^#{1,2}\s+(.+)$/m)?.[1] ?? doc.title;
      return { doc, section, terms: new Set(terms(section)), headingTerms: new Set(terms(`${doc.title} ${heading}`)) };
    }));
}

function askOffline(question) {
  const { sections } = kb;
  const idf = (t) => Math.log((sections.length + 1) / (sections.filter((s) => s.terms.has(t)).length + 0.5));
  const q = [...new Set(terms(question))];
  let best = { score: 0 };
  for (const s of sections) {
    const score = q.reduce((n, t) => n + (s.terms.has(t) ? idf(t) : 0) + (s.headingTerms.has(t) ? idf(t) : 0), 0);
    if (score > best.score) best = { score, ...s };
  }
  if (best.score < 2.5) {
    return { answer: "I couldn't find that in your onboarding documents. Your recruiter will be able to help.", sources: [], handoff: 'recruiter' };
  }
  const body = best.section
    .replace(/^#{1,2}\s+/gm, '')
    .replace(/^>.*$/gm, '')
    .replace(/\*\*|\*/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
  // Without a model we can't tell whether this fully answers the question, so always offer a person too.
  return { answer: `This section of your onboarding documents looks relevant:\n${body}`, sources: [best.doc.id], handoff: 'recruiter' };
}

function hasClaudeCli() {
  try {
    execFileSync('claude', ['--version'], { stdio: 'ignore', timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

const configured = (process.env.ASSISTANT_PROVIDER || 'auto').toLowerCase();
export const PROVIDER =
  configured !== 'auto' ? configured
  : process.env.ANTHROPIC_API_KEY ? 'api'
  : hasClaudeCli() ? 'cli'
  : 'offline';
if (!['api', 'cli', 'offline'].includes(PROVIDER)) throw new Error(`Unknown ASSISTANT_PROVIDER "${PROVIDER}"`);

rebuild(); // after the helpers above are defined

// ---------- public API ----------
const histories = new Map(); // userId -> [{ question, answer }], in memory only (resets on restart)
const busy = new Set();      // one question at a time per user

export function historyFor(userId) {
  return (histories.get(userId) ?? []).map(({ question, answer, sources, handoff }) => ({ question, answer, sources, handoff }));
}

/**
 * Answers a joiner's question. `user` is the users row (name, job_title, location, start_date).
 * Returns { answer, sources: [{ id, title }], handoff, provider }.
 */
export async function ask(user, question, context = {}) {
  if (busy.has(user.id)) throw Object.assign(new Error('Still answering your last question'), { status: 429 });
  busy.add(user.id);
  try {
    const history = (histories.get(user.id) ?? []).slice(-HISTORY_TURNS);
    let raw;
    let provider = PROVIDER;
    try {
      raw = PROVIDER === 'api' ? await askApi(buildPrompt(user, history, question, context))
        : PROVIDER === 'cli' ? await askCli(buildPrompt(user, history, question, context))
        : askOffline(question);
    } catch (err) {
      // Keep the demo working: if the model fails, fall back to quoting the documents.
      console.error(`Assistant (${PROVIDER}) failed, using offline answer:`, err.message);
      raw = askOffline(question);
      provider = 'offline';
    }
    const result = {
      answer: String(raw.answer ?? '').trim() || "Sorry, I couldn't answer that. Your recruiter will be able to help.",
      sources: [...new Set(raw.sources ?? [])].filter((id) => kb.byId.has(id)).map((id) => ({ id, title: kb.byId.get(id).title })),
      handoff: HANDOFFS.includes(raw.handoff) ? raw.handoff : 'none',
      provider,
    };
    histories.set(user.id, [...history, { question, ...result }].slice(-HISTORY_TURNS));
    return result;
  } finally {
    busy.delete(user.id);
  }
}
