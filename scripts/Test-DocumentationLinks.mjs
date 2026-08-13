import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    return extname(entry.name).toLowerCase() === '.md' ? [path] : [];
  }));
  return nested.flat();
}

const files = [resolve(root, 'README.md'), ...(await markdownFiles(resolve(root, 'docs')))];
const missing = [];
for (const file of files) {
  const markdown = await readFile(file, 'utf8');
  const links = [...markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1].trim());
  for (const link of links) {
    const target = link.replace(/^<|>$/g, '').split('#')[0];
    if (!target || /^(https?:|mailto:|aws:)/i.test(target)) continue;
    try {
      const targetStat = await stat(resolve(dirname(file), target));
      if (!targetStat.isFile()) missing.push(`${file}: ${link} is not a file`);
    } catch {
      missing.push(`${file}: ${link} does not exist`);
    }
  }
}

assert.deepEqual(missing, [], `Broken internal Markdown links:\n${missing.join('\n')}`);
console.log(`Verified: ${files.length} portfolio Markdown files have no broken internal links.`);
