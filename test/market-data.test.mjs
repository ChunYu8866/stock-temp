import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateSectorRotation,
  classifySector,
  computeSectors,
  parseNumber,
  parseRealtimeQuotes,
  parseTpexOpenApiQuotes,
  parseTpexChip,
  parseTpexPrice,
  parseTwseChip,
  parseTwseMarketChange,
  parseTwseOpenApiQuotes,
  parseTwsePrice,
  parseYahooChartQuote,
  toRocDate,
  toTwseDate,
} from '../src/lib/market-data.mjs';
import { PRIMARY_SECTOR_BY_STOCK, STOCK_TO_SECTORS } from '../src/data/sectors.mjs';

test('date and numeric helpers normalize exchange formats', () => {
  assert.equal(toTwseDate('2026-06-11'), '20260611');
  assert.equal(toRocDate('2026-06-11'), '115/06/11');
  assert.equal(parseNumber('<p style="color:green">-</p>'), Number.NaN);
  assert.equal(parseNumber('+1,234.50%'), 1234.5);
});

test('TWSE parsers read close, change, and institutional net shares', () => {
  const price = parseTwsePrice({
    tables: [{
      title: '每日收盤行情(全部(不含權證、牛熊證、可展延牛熊證))',
      data: [['2330', '台積電', '1,000', '1', '1,000,000', '990', '1010', '980', '1000', '<p style= color:red>+</p>', '10', '999', '1', '1000', '1', '20']],
    }],
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

test('realtime parser reads MIS quote prices and changes', () => {
  const quotes = parseRealtimeQuotes({
    msgArray: [{
      c: '2330',
      n: '台積電',
      ex: 'tse',
      d: '20260626',
      t: '13:30:00',
      z: '2340.0000',
      y: '2390.0000',
      o: '2360.0000',
      h: '2370.0000',
      l: '2325.0000',
      v: '39059',
    }],
  });
  assert.equal(quotes.get('2330').price, 2340);
  assert.equal(quotes.get('2330').chg_1d, -2.09);
  assert.equal(quotes.get('2330').market, 'TWSE');
  assert.equal(quotes.get('2330').date, '2026-06-26');
});

test('Yahoo fallback parser reads chart quote prices and changes', () => {
  const quote = parseYahooChartQuote({
    chart: {
      result: [{
        meta: {
          symbol: '2330.TW',
          regularMarketPrice: 2340,
          regularMarketTime: 1782451800,
          gmtoffset: 28800,
        },
        timestamp: [1782090000, 1782176400, 1782262800],
        indicators: {
          quote: [{
            close: [2510, 2390, 2340],
            open: [2455, 2410, 2360],
            high: [2510, 2420, 2370],
            low: [2455, 2390, 2325],
            volume: [39272494, 34424468, 39547254],
          }],
        },
      }],
    },
  }, '2330', '2330.TW');
  assert.equal(quote.price, 2340);
  assert.equal(quote.previousClose, 2390);
  assert.equal(quote.chg_1d, -2.09);
  assert.equal(quote.market, 'TWSE');
  assert.equal(quote.quoteStatus, 'fallback');
});

test('official OpenAPI fallback parsers read TWSE and TPEX daily quotes', () => {
  const twse = parseTwseOpenApiQuotes([{
    Date: '1150626',
    Code: '2330',
    Name: '台積電',
    OpeningPrice: '2360.00',
    HighestPrice: '2370.00',
    LowestPrice: '2325.00',
    ClosingPrice: '2340.00',
    Change: '-50.0000',
    TradeVolume: '39547254',
  }]);
  const tpex = parseTpexOpenApiQuotes([{
    Date: '1150626',
    SecuritiesCompanyCode: '3105',
    CompanyName: '穩懋',
    Close: '424.00',
    Change: '-39.00 ',
    Open: '455.00',
    High: '456.00',
    Low: '420.00',
    TradingShares: '1200000',
  }]);

  assert.equal(twse.get('2330').price, 2340);
  assert.equal(twse.get('2330').previousClose, 2390);
  assert.equal(twse.get('2330').chg_1d, -2.09);
  assert.equal(twse.get('2330').date, '2026-06-26');
  assert.equal(twse.get('2330').market, 'TWSE');
  assert.equal(twse.get('2330').source, 'twse-stock-day-all');
  assert.equal(tpex.get('3105').price, 424);
  assert.equal(tpex.get('3105').previousClose, 463);
  assert.equal(tpex.get('3105').chg_1d, -8.42);
  assert.equal(tpex.get('3105').date, '2026-06-26');
  assert.equal(tpex.get('3105').market, 'TPEX');
  assert.equal(tpex.get('3105').source, 'tpex-daily-close');
});

test('primary sector mapping assigns 2330 to foundry once', () => {
  assert.equal(PRIMARY_SECTOR_BY_STOCK['2330'], '晶圓代工');
  assert.deepEqual(STOCK_TO_SECTORS['2330'], ['晶圓代工']);
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
      if (url.includes('MI_INDEX') && url.includes('ALLBUT0999')) return twsePrice;
      if (url.includes('fund/T86')) return twseChip;
      if (url.includes('dailyQuotes')) return tpexPrice;
      if (url.includes('dailyTrade')) return tpexChip;
      if (url.includes('MI_INDEX') && url.includes('IND')) return index;
      throw new Error(url);
    },
  });
  const payload = await aggregateSectorRotation({ date: '2026-06-11', fetchImpl, maxCalendarDays: 20, requestDelayMs: 0 });
  assert.equal(payload.date, '2026-06-11');
  assert.equal(payload.sectors.length > 0, true);
  assert.equal(payload.stockData['2317'].net_1d_yi, 2);
  assert.equal(payload.stockData['6669'].quoteStatus, 'missing');
  assert.equal(payload.sourceStatus.some((item) => item.source === 'twse-index' && item.ok), true);
});
