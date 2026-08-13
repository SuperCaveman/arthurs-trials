import { resolve } from 'node:path';
import { appendAuditFiles } from '../virtual-production/src/audit-ledger.mjs';

const args = process.argv.slice(2);
const valueFor = (flag) => args[args.indexOf(flag) + 1];
const ledgerPath = valueFor('--ledger');
const eventPaths = args.flatMap((value, index) => value === '--event' ? [args[index + 1]] : []).filter(Boolean);
if (!ledgerPath || eventPaths.length === 0) throw new Error('Usage: node scripts/Run-VirtualProductionAuditLedger.mjs --ledger <audit.jsonl> --event <event.json> [--event <event.json>]');
const outcome = await appendAuditFiles({ ledgerPath: resolve(ledgerPath), eventPaths: eventPaths.map((eventPath) => resolve(eventPath)) });
process.stdout.write(`${JSON.stringify({ event: 'virtual_production_audit_ledger_updated', appended: outcome.results.filter((result) => result.disposition === 'APPENDED').length, duplicates: outcome.results.filter((result) => result.disposition === 'DUPLICATE').length, cloudResourcesCreated: false })}\n`);
