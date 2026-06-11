import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { aggregateSectorRotation } from '../src/lib/market-data.mjs';

const outDir = resolve('public/data');
const outFile = resolve(outDir, 'latest.json');

const payload = await aggregateSectorRotation({ date: process.env.SECTOR_DATE || 'latest' });
await mkdir(outDir, { recursive: true });
await writeFile(outFile, JSON.stringify(payload, null, 2), 'utf8');

console.log(`Wrote ${outFile}`);
console.log(`date=${payload.date} sectors=${payload.sectors.length} stocks=${Object.keys(payload.stockData).length}`);
