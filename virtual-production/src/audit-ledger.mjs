import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

function auditEventId(event) {
  return createHash('sha256').update(JSON.stringify({ event: event.event, versionId: event.versionId ?? event.currentVersion, stageTarget: event.stageTarget, status: event.approval?.status ?? event.recovery?.finalStageVersion })).digest('hex');
}

async function readLedger(ledgerPath) {
  try {
    const text = await readFile(ledgerPath, 'utf8');
    return text.trim() ? text.trim().split('\n').map(JSON.parse) : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export async function appendAuditEvents({ ledgerPath, events }) {
  const entries = await readLedger(ledgerPath);
  const existingIds = new Set(entries.map((entry) => entry.eventId));
  const results = events.map((event) => {
    const eventId = auditEventId(event);
    if (existingIds.has(eventId)) return { disposition: 'DUPLICATE', eventId };
    const entry = { eventId, receivedAt: new Date().toISOString(), event };
    entries.push(entry);
    existingIds.add(eventId);
    return { disposition: 'APPENDED', eventId };
  });
  await mkdir(dirname(ledgerPath), { recursive: true });
  await writeFile(ledgerPath, `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`);
  return { results, entries };
}

export async function appendAuditFiles({ ledgerPath, eventPaths }) {
  const events = await Promise.all(eventPaths.map(async (eventPath) => JSON.parse(await readFile(eventPath, 'utf8'))));
  return appendAuditEvents({ ledgerPath, events });
}
