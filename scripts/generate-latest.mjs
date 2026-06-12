import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { aggregateSectorRotation } from '../src/lib/market-data.mjs';

const outDir = resolve('public/data');
const outFile = resolve(outDir, 'latest.json');

function stableSnapshot(payload) {
  const clone = structuredClone(payload);
  delete clone.updatedAt;
  return clone;
}

async function readPreviousPayload() {
  try {
    return JSON.parse(await readFile(outFile, 'utf8'));
  } catch {
    return null;
  }
}

const payload = await aggregateSectorRotation({ date: process.env.SECTOR_DATE || 'latest' });
const previous = await readPreviousPayload();

if (previous && JSON.stringify(stableSnapshot(previous)) === JSON.stringify(stableSnapshot(payload))) {
  console.log(`No data changes for ${payload.date}; keeping existing ${outFile}`);
  process.exit(0);
}

await mkdir(outDir, { recursive: true });
await writeFile(outFile, JSON.stringify(payload, null, 2), 'utf8');

console.log(`Wrote ${outFile}`);
console.log(`date=${payload.date} sectors=${payload.sectors.length} stocks=${Object.keys(payload.stockData).length}`);
