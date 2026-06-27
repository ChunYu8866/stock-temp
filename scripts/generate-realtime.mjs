import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fetchRealtimeQuotes } from '../src/lib/market-data.mjs';

const outputPath = resolve('public/data/latest.json');

function stablePayload(payload) {
  return JSON.stringify(payload, (key, value) => {
    if (key === 'quoteUpdatedAt' || key === 'updatedAt') return null;
    return value;
  });
}

const payload = JSON.parse(await readFile(outputPath, 'utf8'));
const before = stablePayload(payload);
const stockData = payload.stockData || {};
const codes = Object.keys(stockData);
const marketByCode = Object.fromEntries(
  codes
    .map((code) => [code, stockData[code]?.market])
    .filter(([, market]) => Boolean(market))
);

const result = await fetchRealtimeQuotes(codes, {
  marketByCode,
  batchSize: 70,
  timeoutMs: 30000,
});

if (!result.quotes.size) {
  throw new Error(result.sourceStatus.lastError || 'No realtime quotes returned from TWSE MIS');
}

for (const [code, quote] of result.quotes) {
  stockData[code] = {
    ...(stockData[code] || {}),
    name: quote.name || stockData[code]?.name || code,
    price: quote.price,
    chg_1d: quote.chg_1d,
    market: quote.market || stockData[code]?.market || null,
    quoteStatus: 'realtime',
    quoteSource: quote.source,
    quoteDate: quote.date,
    quoteTime: quote.time,
    quoteUpdatedAt: result.updatedAt,
    previousClose: quote.previousClose,
    volume: quote.volume,
  };
}

payload.stockData = stockData;
payload.quoteUpdatedAt = result.updatedAt;
payload.realtimeStatus = result.sourceStatus;
payload.sourceStatus = [
  result.sourceStatus,
  ...(payload.sourceStatus || []).filter((item) => item.source !== result.sourceStatus.source),
];

if (before === stablePayload(payload)) {
  console.log(`No realtime quote changes. rows=${result.quotes.size}`);
  process.exit(0);
}

await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`Wrote ${outputPath}`);
console.log(`realtimeDate=${result.sourceStatus.lastOkDate} rows=${result.quotes.size}`);
