import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateSectorRotation,
  classifySector,
  computeSectors,
  parseNumber,
  parseTpexChip,
  parseTpexPrice,
  parseTwseChip,
  parseTwseMarketChange,
  parseTwsePrice,
  toRocDate,
  toTwseDate,
} from '../src/lib/market-data.mjs';

test('date and numeric helpers normalize exchange formats', () => {
  assert.equal(toTwseDate('2026-06-11'), '20260611');
  assert.equal(toRocDate('2026-06-11'), '115/06/11');
  assert.equal(parseNumber('<p style="color:green">-</p>'), Number.NaN);
  assert.equal(parseNumber('+1,234.50%'), 1234.5);
});

test('TWSE parsers read close, change, and institutional net shares', () => {
  const price = parseTwsePrice({
    data: [['2330', '台積電', '1,000', '1,000', '1000', '1010', '990', '1000', '+10', '1']],
  });
  const chip = parseTwseChip({
    data: [['2330', '台積電', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '1,500,000']],
  });
  assert.equal(price.get('2330').close, 1000);
  assert.equal(Math.round(price.get('2330').chg1d * 100) / 100, 1.01);
  assert.equal(chip.get('2330'), 1500000);
});

test('TPEX parsers read close, change, and institutional net shares', () => {
  const price = parseTpexPrice({
    tables: [{ title: '上櫃股票行情', data: [['3105', '穩懋', '120.5', '-1.5']] }],
  });
  const chip = parseTpexChip({
    tables: [{ title: '三大法人買賣明細資訊', data: [['3105', '穩懋', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '-2,000']] }],
  });
  assert.equal(price.get('3105').close, 120.5);
  assert.equal(Math.round(price.get('3105').chg1d * 100) / 100, -1.23);
  assert.equal(chip.get('3105'), -2000);
});

test('market index parser reads TAIEX percentage change', () => {
  const change = parseTwseMarketChange({
    tables: [{
      data: [
        ['寶島股價指數', '48,141.74', '-', '68.36', '-0.14', ''],
        ['發行量加權股價指數', '43,149.46', '-', '76.08', '-0.18', ''],
      ],
    }],
  });
  assert.equal(change, -0.18);
});

test('sector computation classifies flow and bottom-fishing signals', () => {
  const makeDay = (date, net, chg, close = 100) => ({
    date,
    stocks: new Map([
      ['2317', { close, chg1d: chg, net_1d_yi: net }],
      ['6669', { close, chg1d: chg, net_1d_yi: net }],
    ]),
  });
  const days = Array.from({ length: 20 }, (_, index) => makeDay(`2026-06-${String(20 - index).padStart(2, '0')}`, index === 0 ? 8 : 1, index === 0 ? -1.2 : 0.1, 100 + index));
  const sectors = computeSectors(days, -1.4);
  const target = sectors.find((sector) => sector.name === 'AI 伺服器組裝');
  assert.equal(classifySector(target), 'green');
  assert.equal(target.is_bottom_fishing, true);
  assert.equal(target.net_1d_yi, 16);
});

test('aggregateSectorRotation returns the public API contract with mocked official feeds', async () => {
  const twsePrice = { data: [['2317', '鴻海', '0', '0', '0', '0', '0', '100', '+1', '1']] };
  const twseChip = { data: [['2317', '鴻海', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '2,000,000']] };
  const tpexPrice = { tables: [{ title: '上櫃股票行情', data: [['3105', '穩懋', '100', '+1']] }] };
  const tpexChip = { tables: [{ title: '三大法人買賣明細資訊', data: [['3105', '穩懋', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '1,000,000']] }] };
  const index = { tables: [{ data: [['發行量加權股價指數', '1', '+', '1', '0.5', '']] }] };
  const fetchImpl = async (url) => ({
    ok: true,
    json: async () => {
      if (url.includes('STOCK_DAY_ALL')) return twsePrice;
      if (url.includes('fund/T86')) return twseChip;
      if (url.includes('dailyQuotes')) return tpexPrice;
      if (url.includes('dailyTrade')) return tpexChip;
      if (url.includes('MI_INDEX')) return index;
      throw new Error(url);
    },
  });
  const payload = await aggregateSectorRotation({ date: '2026-06-11', fetchImpl, maxCalendarDays: 20 });
  assert.equal(payload.date, '2026-06-11');
  assert.equal(payload.sectors.length > 0, true);
  assert.equal(payload.stockData['2317'].net_1d_yi, 2);
  assert.equal(payload.sourceStatus.some((item) => item.source === 'twse-index' && item.ok), true);
});
