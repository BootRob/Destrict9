// `npm test`: runs each suite against its own server on a free port and a throwaway database.
// Nothing here touches app/data/, and the assistant runs offline so no model or API key is needed.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const appDir = join(here, '..');
const suites = process.argv.slice(2).length ? process.argv.slice(2) : ['messaging.mjs', 'journey.mjs'];

const freePort = () => new Promise((res, rej) => {
  const s = createServer().once('error', rej).listen(0, () => { const { port } = s.address(); s.close(() => res(port)); });
});

async function runSuite(file) {
  const dir = mkdtempSync(join(tmpdir(), 'joiner-test-'));
  const port = await freePort();
  const env = { ...process.env, PORT: String(port), DB_PATH: join(dir, 'test.db'), BASE: `http://localhost:${port}`,
    ASSISTANT_PROVIDER: 'offline', DEMO_MAILBOX: 'on', PUBLIC_URL: '', NODE_ENV: 'test' };
  const server = spawn(process.execPath, ['server.js'], { cwd: appDir, env, stdio: ['ignore', 'pipe', 'inherit'] });
  try {
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('server did not start within 15s')), 15000);
      server.stdout.on('data', (d) => /running at/.test(String(d)) && (clearTimeout(t), res()));
      server.once('exit', (code) => rej(new Error(`server exited early (code ${code})`)));
    });
    console.log(`\n== ${file}`);
    return await new Promise((res) => spawn(process.execPath, [join(here, file)], { env, stdio: 'inherit' }).once('exit', (code) => res(code ?? 1)));
  } finally {
    server.kill();
    rmSync(dir, { recursive: true, force: true });
  }
}

let failed = 0;
for (const file of suites) failed += (await runSuite(file)) === 0 ? 0 : 1;
console.log(failed ? `\n${failed} suite(s) failed` : '\nAll suites passed');
process.exit(failed ? 1 : 0);
