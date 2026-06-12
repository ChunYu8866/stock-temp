import { SECTOR_STOCKS, STOCK_NAMES } from '../data/sectors.mjs?v=10';

export const CATEGORY_META = {
  green: { label: '升溫', sub: '資金加速流入', color: '#ff3b30' },
  yellow: { label: '恆溫', sub: '流入放緩但仍有買盤', color: '#ff9f0a' },
  gray: { label: '低溫', sub: '資金沉寂觀察', color: '#8e8e93' },
  red: { label: '降溫', sub: '資金流出', color: '#34c759' },
};

export function classifySector(sector) {
  if (sector.net_5d_yi > 0 && sector.accel > 0) return 'green';
  if (sector.net_5d_yi > 0 && sector.accel <= 0) return 'yellow';
  if (sector.net_5d_yi <= 0 && sector.net_5d_yi > -0.5) return 'gray';
  return 'red';
}

export function flowColor(value) {
  return value >= 0 ? CATEGORY_META.green.color : CATEGORY_META.red.color;
}

export function parseNumber(value) {
  if (value == null) return Number.NaN;
  const cleaned = String(value)
    .replace(/<[^>]*>/g, '')
    .replace(/,/g, '')
    .replace(/[+％%]/g, '')
    .trim();
  if (!cleaned || cleaned === '--' || cleaned === '---' || cleaned === '除權息') {
    return Number.NaN;
  }
  return Number(cleaned);
}

export function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function normalizeDate(input) {
  if (!input || input === 'latest') return taipeiToday();
  const compact = String(input).replace(/\D/g, '');
  if (compact.length !== 8) throw new Error(`Invalid date: ${input}`);
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

export function taipeiToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function addDays(ymd, delta) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

export function toTwseDate(ymd) {
  return ymd.replaceAll('-', '');
}

export function toRocDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return `${String(y - 1911).padStart(3, '0')}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
}

function codeOf(row) {
  return String(row?.[0] ?? '').trim();
}

function isCommonStockCode(code) {
  return /^\d{4}$/.test(code);
}

function signedTwseDiff(signCell, diffCell) {
  const diff = parseNumber(diffCell);
  if (!Number.isFinite(diff)) return Number.NaN;
  const sign = String(signCell ?? '').replace(/<[^>]*>/g, '').trim();
  const raw = String(signCell ?? '').toLowerCase();
  if (sign.includes('-') || raw.includes('green')) return -Math.abs(diff);
  if (sign.includes('+') || raw.includes('red')) return Math.abs(diff);
  return diff;
}

export function parseTwsePrice(json) {
  const out = new Map();
  const table = (json?.tables ?? []).find((item) => String(item?.title ?? '').includes('每日收盤行情'));
  const rows = table?.data ?? json?.data ?? [];
  const isMiIndexTable = Boolean(table);
  for (const row of rows) {
    const code = codeOf(row);
    if (!isCommonStockCode(code)) continue;
    const close = parseNumber(isMiIndexTable ? row[8] : row[7]);
    const diff = isMiIndexTable ? signedTwseDiff(row[9], row[10]) : parseNumber(row[8]);
    if (!Number.isFinite(close) || !Number.isFinite(diff)) continue;
    const previous = close - diff;
    out.set(code, {
      code,
      name: String(row[1] ?? STOCK_NAMES[code] ?? '').trim(),
      close,
      chg1d: previous > 0 ? (diff / previous) * 100 : 0,
      market: 'TWSE',
    });
  }
  return out;
}

export function parseTwseChip(json) {
  const out = new Map();
  for (const row of json?.data ?? []) {
    const code = codeOf(row);
    if (!isCommonStockCode(code)) continue;
    const net = parseNumber(row[18]);
    if (Number.isFinite(net)) out.set(code, net);
  }
  return out;
}

export function parseTpexPrice(json) {
  const out = new Map();
  const table = (json?.tables ?? []).find((item) => String(item?.title ?? '').includes('上櫃股票行情')) ?? json?.tables?.[0];
  for (const row of table?.data ?? []) {
    const code = codeOf(row);
    if (!isCommonStockCode(code)) continue;
    const close = parseNumber(row[2]);
    const diff = parseNumber(row[3]);
    if (!Number.isFinite(close) || !Number.isFinite(diff)) continue;
    const previous = close - diff;
    out.set(code, {
      code,
      name: String(row[1] ?? STOCK_NAMES[code] ?? '').trim(),
      close,
      chg1d: previous > 0 ? (diff / previous) * 100 : 0,
      market: 'TPEX',
    });
  }
  return out;
}

export function parseTpexChip(json) {
  const out = new Map();
  const table = (json?.tables ?? []).find((item) => String(item?.title ?? '').includes('三大法人')) ?? json?.tables?.[0];
  for (const row of table?.data ?? []) {
    const code = codeOf(row);
    if (!isCommonStockCode(code)) continue;
    const net = parseNumber(row[23]);
    if (Number.isFinite(net)) out.set(code, net);
  }
  return out;
}

export function parseTwseMarketChange(json) {
  const tables = json?.tables ?? [];
  for (const table of tables) {
    for (const row of table?.data ?? []) {
      const label = String(row?.[0] ?? '');
      if (!label.includes('發行量加權股價指數')) continue;
      const pct = parseNumber(row[4]);
      if (Number.isFinite(pct)) return pct;
    }
  }
  return 0;
}

function summarizeSource(name, result, rows, date) {
  if (result.status === 'fulfilled') {
    return { source: name, ok: true, rows, date };
  }
  return {
    source: name,
    ok: false,
    rows: 0,
    date,
    error: result.reason?.message ?? String(result.reason),
  };
}

async function fetchJson(url, { fetchImpl = fetch, timeoutMs = 16000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: {
        accept: 'application/json,text/plain,*/*',
        'user-agent': 'sector-rotation-light/1.0',
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchTradingDay(ymd, options = {}) {
  const twseDate = toTwseDate(ymd);
  const rocDate = encodeURIComponent(toRocDate(ymd));
  const urls = {
    'twse-price': `https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?response=json&date=${twseDate}&type=ALLBUT0999`,
    'twse-chip': `https://www.twse.com.tw/rwd/zh/fund/T86?response=json&date=${twseDate}&selectType=ALL`,
    'tpex-price': `https://www.tpex.org.tw/www/zh-tw/afterTrading/dailyQuotes?date=${rocDate}&response=json`,
    'tpex-chip': `https://www.tpex.org.tw/www/zh-tw/insti/dailyTrade?date=${rocDate}&type=Daily&response=json`,
  };
  const entries = await Promise.allSettled(Object.entries(urls).map(async ([name, url]) => [name, await fetchJson(url, options)]));
  const bySource = new Map();
  for (const result of entries) {
    if (result.status === 'fulfilled') bySource.set(result.value[0], result.value[1]);
  }

  const twsePrices = bySource.has('twse-price') ? parseTwsePrice(bySource.get('twse-price')) : new Map();
  const twseChips = bySource.has('twse-chip') ? parseTwseChip(bySource.get('twse-chip')) : new Map();
  const tpexPrices = bySource.has('tpex-price') ? parseTpexPrice(bySource.get('tpex-price')) : new Map();
  const tpexChips = bySource.has('tpex-chip') ? parseTpexChip(bySource.get('tpex-chip')) : new Map();

  const stocks = new Map();
  for (const [code, item] of [...twsePrices, ...tpexPrices]) {
    const chipMap = item.market === 'TWSE' ? twseChips : tpexChips;
    const netShares = chipMap.get(code) ?? 0;
    stocks.set(code, {
      ...item,
      netShares,
      net_1d_yi: (netShares * item.close) / 1e8,
    });
  }

  return {
    date: ymd,
    stocks,
    hasPrice: twsePrices.size + tpexPrices.size > 0,
    hasChip: twseChips.size + tpexChips.size > 0,
    sourceStatus: [
      summarizeSource('twse-price', entries[0], twsePrices.size, ymd),
      summarizeSource('twse-chip', entries[1], twseChips.size, ymd),
      summarizeSource('tpex-price', entries[2], tpexPrices.size, ymd),
      summarizeSource('tpex-chip', entries[3], tpexChips.size, ymd),
    ],
  };
}

export async function fetchMarketChange(ymd, options = {}) {
  const url = `https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?response=json&date=${toTwseDate(ymd)}&type=IND`;
  const json = await fetchJson(url, options);
  return parseTwseMarketChange(json);
}

function mean(values) {
  const filtered = values.filter(Number.isFinite);
  if (!filtered.length) return 0;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function stockFiveDayChange(code, days) {
  const first = days[0]?.stocks.get(code)?.close;
  const fifth = days[4]?.stocks.get(code)?.close;
  if (Number.isFinite(first) && Number.isFinite(fifth) && fifth > 0) {
    return ((first - fifth) / fifth) * 100;
  }
  return Number.NaN;
}

export function computeSectors(days, marketChg1d = 0) {
  const sectors = Object.entries(SECTOR_STOCKS).map(([name, codes]) => {
    const dailyNets = days.map((day) => {
      return codes.reduce((sum, code) => sum + (day.stocks.get(code)?.net_1d_yi ?? 0), 0);
    });
    const day0 = days[0];
    const net_1d_yi = dailyNets[0] ?? 0;
    const net_5d_yi = dailyNets.slice(0, 5).reduce((sum, value) => sum + value, 0);
    const net_20d_yi = dailyNets.slice(0, 20).reduce((sum, value) => sum + value, 0);
    const avg_abs_daily_20d = mean(dailyNets.slice(0, 20).map(Math.abs));
    const chg_1d = mean(codes.map((code) => day0?.stocks.get(code)?.chg1d ?? Number.NaN));
    const chg_5d = mean(codes.map((code) => stockFiveDayChange(code, days)));
    const accel = net_5d_yi / 5 - net_20d_yi / 20;
    return {
      name,
      stocks: codes,
      net_1d_yi: round(net_1d_yi, 2),
      net_5d_yi: round(net_5d_yi, 2),
      net_20d_yi: round(net_20d_yi, 2),
      avg_abs_daily_20d: round(avg_abs_daily_20d, 2),
      chg_1d: round(chg_1d, 2),
      chg_5d: round(chg_5d, 2),
      accel: round(accel, 2),
      category: 'gray',
      is_bottom_fishing: false,
      bottom_score: 0,
    };
  });

  for (const sector of sectors) {
    sector.category = classifySector(sector);
    const threshold = Math.max(sector.avg_abs_daily_20d * 1.5, 3);
    if (marketChg1d <= -1 && sector.chg_1d < -0.5 && sector.net_1d_yi > threshold) {
      sector.is_bottom_fishing = true;
      sector.bottom_score = round(sector.net_1d_yi * Math.abs(sector.chg_1d), 2);
    }
  }

  const bottom = sectors
    .filter((sector) => sector.is_bottom_fishing)
    .sort((a, b) => b.bottom_score - a.bottom_score);
  bottom.slice(5).forEach((sector) => {
    sector.is_bottom_fishing = false;
    sector.bottom_score = 0;
  });

  return sectors;
}

function summarizeStatuses(days, extra = []) {
  const sourceMap = new Map();
  for (const day of days) {
    for (const status of day.sourceStatus) {
      if (!sourceMap.has(status.source)) {
        sourceMap.set(status.source, {
          source: status.source,
          ok: false,
          okCount: 0,
          failCount: 0,
          rows: 0,
          lastOkDate: null,
          lastError: null,
        });
      }
      const summary = sourceMap.get(status.source);
      if (status.ok) {
        summary.ok = true;
        summary.okCount += 1;
        summary.rows += status.rows;
        if (!summary.lastOkDate) summary.lastOkDate = status.date;
      } else {
        summary.failCount += 1;
        summary.lastError = status.error;
      }
    }
  }
  for (const item of extra) sourceMap.set(item.source, item);
  return [...sourceMap.values()];
}

export async function aggregateSectorRotation({ date = 'latest', fetchImpl = fetch, maxCalendarDays = 35, requestDelayMs = 1500 } = {}) {
  const endDate = normalizeDate(date);
  const days = [];
  let marketChg1d = 0;
  let marketStatus = { source: 'twse-index', ok: false, okCount: 0, failCount: 1, rows: 0, lastOkDate: null, lastError: 'Not fetched' };

  for (let offset = 0; offset < maxCalendarDays && days.length < 20; offset += 1) {
    const candidate = addDays(endDate, -offset);
    const day = await fetchTradingDay(candidate, { fetchImpl });
    if (day.hasPrice && day.hasChip) {
      days.push(day);
      if (days.length === 1) {
        try {
          marketChg1d = await fetchMarketChange(day.date, { fetchImpl });
          marketStatus = { source: 'twse-index', ok: true, okCount: 1, failCount: 0, rows: 1, lastOkDate: day.date, lastError: null };
        } catch (error) {
          marketStatus = { source: 'twse-index', ok: false, okCount: 0, failCount: 1, rows: 0, lastOkDate: null, lastError: error.message };
        }
      }
    }
    // Add delay to prevent exchange API rate limits during scheduled refreshes.
    if (requestDelayMs > 0 && days.length < 20 && offset + 1 < maxCalendarDays) {
      await new Promise((resolve) => setTimeout(resolve, requestDelayMs));
    }
  }
  if (!days.length) throw new Error('No trading data available from TWSE/TPEX');

  const sectors = computeSectors(days, marketChg1d).sort((a, b) => b.net_5d_yi - a.net_5d_yi);
  const stockData = {};
  const sectorCodes = new Set(sectors.flatMap((sector) => sector.stocks));
  for (const code of sectorCodes) {
    const item = days[0].stocks.get(code);
    if (item) {
      stockData[code] = {
        name: item.name || STOCK_NAMES[code] || code,
        price: round(item.close, 2),
        chg_1d: round(item.chg1d, 2),
        net_1d_yi: round(item.net_1d_yi, 2),
        market: item.market,
        quoteStatus: 'ok',
      };
    } else {
      stockData[code] = {
        name: STOCK_NAMES[code] || code,
        price: null,
        chg_1d: null,
        net_1d_yi: null,
        market: null,
        quoteStatus: 'missing',
      };
    }
  }

  return {
    date: days[0].date,
    requestedDate: endDate,
    updatedAt: new Date().toISOString(),
    marketChg1d: round(marketChg1d, 2),
    isMarketDown: marketChg1d <= -1,
    sectors,
    stockData,
    sourceStatus: summarizeStatuses(days, [marketStatus]),
  };
}
