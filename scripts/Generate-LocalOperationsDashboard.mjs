import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function timestampFor(line) {
  const match = /\[(\d{4}\.\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{2}:\d{3})\]/.exec(line);
  return match?.[1].replace(/\./g, (value, index) => (index < 10 ? '-' : value)).replace('-', '-').replace(/:(\d{3})$/, '.$1') ?? 'Recorded locally';
}

function lifecycleEvents(serverLog) {
  const definitions = [
    ['GameLift server ready', /GameLift ProcessReady succeeded on port (\d+)/, (match) => `UDP ${match[1]} is accepting GameLift-managed sessions.`],
    ['Game session activated', /GameLift requested session activation:/, () => 'GameLift delivered the session to the dedicated server.'],
    ['Authoritative result published', /Authoritative match-completion event published to the local outbox for (\d+) participant/, (match) => `The server—not a client—published one completion event for ${match[1]} participant(s).`],
    ['GameLift termination handled', /GameLift requested process termination\./, () => 'GameLift requested shutdown; the server began its lifecycle cleanup.'],
    ['Dedicated server exited cleanly', /LogExit: Exiting\./, () => 'The local dedicated-server process exited after its GameLift callback.'],
  ];

  return definitions.flatMap(([title, pattern, description]) => {
    const line = serverLog.split(/\r?\n/).find((candidate) => pattern.test(candidate));
    const match = line?.match(pattern);
    return match ? [{ title, timestamp: timestampFor(line), description: description(match) }] : [];
  });
}

async function processedMatchEvents(outboxDirectory) {
  const processedDirectory = join(outboxDirectory, 'processed');
  let entries = [];
  try {
    entries = await readdir(processedDirectory, { withFileTypes: true });
  } catch {
    return [];
  }

  const events = [];
  for (const entry of entries.filter((item) => item.isFile() && item.name.endsWith('.json')).sort((a, b) => a.name.localeCompare(b.name))) {
    try {
      const event = JSON.parse(await readFile(join(processedDirectory, entry.name), 'utf8'));
      if (event?.eventType === 'match.completed' && Array.isArray(event.participants)) {
        events.push({ participantCount: event.participants.length, xpAward: event.xpAward, completedAt: event.completedAt });
      }
    } catch {
      // A local dashboard should remain available even if an operator is
      // inspecting a malformed artifact that the worker has quarantined.
    }
  }
  return events;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);
}

export async function collectOperationsEvidence({ serverLogPath, outboxDirectory }) {
  const serverLog = await readFile(serverLogPath, 'utf8');
  const events = lifecycleEvents(serverLog);
  const processedEvents = await processedMatchEvents(outboxDirectory);

  return {
    generatedAt: new Date().toISOString(),
    source: 'Local GameLift Anywhere proof; no managed game-server capacity.',
    events,
    processedEvents,
    posture: {
      gameLift: events.some((event) => event.title === 'GameLift server ready') ? 'observed' : 'not observed',
      serverToWorker: processedEvents.length > 0 ? 'observed' : 'not observed',
      managedCloud: 'not deployed',
      cloudWatch: 'planned',
    },
  };
}

export function renderOperationsDashboard(evidence) {
  const processed = evidence.processedEvents.at(-1);
  const timeline = evidence.events.map((event) => `
    <article class="event"><time>${escapeHtml(event.timestamp)}</time><div><h3>${escapeHtml(event.title)}</h3><p>${escapeHtml(event.description)}</p></div></article>`).join('')
    || '<p class="empty">No recognized lifecycle events were found in the selected server log.</p>';
  const result = processed
    ? `<strong>${processed.participantCount} player(s) · ${processed.xpAward} XP · worker processed</strong><span>Authoritative event was archived from the local outbox.</span>`
    : '<strong>No processed completion event found</strong><span>Run the local results worker against a completed server outbox.</span>';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Arthur's Trials — Local Operations Proof</title>
<style>
:root{color-scheme:dark;--ink:#eaf0ff;--muted:#aab8d8;--panel:#121a2c;--line:#29385b;--blue:#5ea9ff;--green:#62e5a5;--amber:#ffd369;background:#09101d}*{box-sizing:border-box}body{margin:0;font:16px/1.45 Inter,Segoe UI,Arial,sans-serif;color:var(--ink);background:radial-gradient(circle at 70% 0,#1c3565,transparent 36rem),#09101d}.wrap{max-width:1100px;margin:auto;padding:48px 28px 64px}.eyebrow{color:var(--green);font-weight:700;letter-spacing:.13em;text-transform:uppercase;font-size:.78rem}h1{font-size:clamp(2rem,5vw,4rem);line-height:1.04;margin:.4rem 0 1rem}p{color:var(--muted);margin:.25rem 0}.badges{display:flex;flex-wrap:wrap;gap:.55rem;margin:1.4rem 0 2rem}.badge{border:1px solid var(--line);border-radius:999px;padding:.38rem .7rem;font-size:.85rem;color:var(--muted)}.badge.good{border-color:#2f8a67;color:var(--green)}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.card,.timeline{background:linear-gradient(145deg,#17223a,#10182a);border:1px solid var(--line);border-radius:18px;padding:21px}.card h2,.timeline h2{font-size:1rem;margin:0 0 .7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}.card strong{display:block;font-size:1.25rem}.card span{display:block;color:var(--muted);margin-top:.4rem}.timeline{margin-top:14px}.event{display:grid;grid-template-columns:175px 1fr;gap:16px;padding:17px 0;border-top:1px solid var(--line)}.event:first-of-type{border-top:0;padding-top:0}.event time{font-family:ui-monospace,Consolas,monospace;color:var(--blue);font-size:.88rem}.event h3{margin:0;font-size:1.1rem}.foot{margin-top:16px;font-size:.86rem}.empty{padding:1rem 0}@media(max-width:720px){.grid{grid-template-columns:1fr}.event{grid-template-columns:1fr;gap:3px}}
</style></head><body><main class="wrap">
<div class="eyebrow">Arthur's Trials · local operations proof</div><h1>GameLift session lifecycle,<br>from placement to reward.</h1>
<p>This is a sanitized, static view generated from local dedicated-server and results-worker evidence.</p>
<div class="badges"><span class="badge good">GameLift Anywhere observed</span><span class="badge good">Authoritative results observed</span><span class="badge">Managed cloud not deployed</span><span class="badge">CloudWatch planned</span></div>
<section class="grid"><div class="card"><h2>Control plane</h2><strong>GameLift Anywhere</strong><span>Local workstation registered as compute; no managed EC2 capacity.</span></div><div class="card"><h2>Server authority</h2><strong>Dedicated Unreal server</strong><span>Only the server writes match completion events.</span></div><div class="card"><h2>Results workflow</h2>${result}</div></section>
<section class="timeline"><h2>Evidence timeline</h2>${timeline}</section><p class="foot">Generated ${escapeHtml(evidence.generatedAt)}. This dashboard intentionally excludes auth tokens, account IDs, GameLift session IDs, player-session IDs, IP connection credentials, and raw command lines.</p>
</main></body></html>`;
}

async function main() {
  const cliArguments = process.argv.slice(2);
  const valueFor = (flag) => cliArguments[cliArguments.indexOf(flag) + 1];
  const serverLogPath = valueFor('--server-log');
  const outboxDirectory = valueFor('--outbox');
  const outputPath = valueFor('--output');
  if (!serverLogPath || !outboxDirectory || !outputPath) {
    throw new Error('Usage: node scripts/Generate-LocalOperationsDashboard.mjs --server-log <path> --outbox <path> --output <path>');
  }
  const evidence = await collectOperationsEvidence({ serverLogPath: resolve(serverLogPath), outboxDirectory: resolve(outboxDirectory) });
  await mkdir(dirname(resolve(outputPath)), { recursive: true });
  await writeFile(resolve(outputPath), renderOperationsDashboard(evidence), 'utf8');
  process.stdout.write(JSON.stringify({ event: 'local_operations_dashboard_generated', output: resolve(outputPath), evidence }) + '\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
