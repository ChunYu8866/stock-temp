export const DEMO_DATA = {
  meta: {
    latest: '20260703',
    prev: '20260702',
    price_date: '20260703',
    latest_slash: '2026/07/03',
    prev_slash: '2026/07/02',
    price_date_slash: '2026/07/03',
    generated: '內建示範資料',
    etf_total: 5,
    active_count: 2,
    active_updated: 2,
    active_total: 2,
    cover_latest: 5,
    cover_full: 5,
    incomplete: false,
    win_bases: {
      d5: '2026/06/26',
      d10: '2026/06/18',
      d20: '2026/06/04',
      d60: '2026/04/08',
    },
  },
  etfs: [
    {
      code: '0050',
      name: '元大台灣50',
      type: 'etf',
      scale: 22496.1,
      scale_chg: -45.9,
      yld: 1.26,
      prem: 0.07,
      date: '20260703',
      updated: true,
      price: 240.8,
      chg: -0.81,
      net: -0.38,
      buy_amt: 1.1,
      sell_amt: -1.48,
      add_n: 2,
      cut_n: 2,
      ret: { m1: 0.7, m3: 46.52, m6: 64.12, y1: 124.37, y3: 258.3, y5: 260.33, all: 2334.83, ann: 14.87, since: '20030630' },
      info: { co: '元大投信', etype: '國內指數股票型', idx: '臺灣50指數', pay: '半年配', fee1: 0.07, fee2: 0.027, listed: '20030630' },
      divs: [{ d: '20260121', cash: 3.4 }, { d: '20250716', cash: 3.1 }],
      holdings: [
        { code: '2330', name: '台積電', weight: 57.39, lots: 527446, value: 12896.05, d1: 38, d5: 210, d20: 890, money: 0.93, chg: -0.81 },
        { code: '2317', name: '鴻海', weight: 2.82, lots: 263500, value: 633.72, d1: 2, d5: 85, d20: 120, money: 0.0, chg: 0.63 },
        { code: '2303', name: '聯電', weight: 1.91, lots: 252215, value: 430.03, d1: -5, d5: -40, d20: 75, money: -0.01, chg: 3.02 },
        { code: '2891', name: '中信金', weight: 1.2, lots: 383367, value: 270.66, d1: 27, d5: 320, d20: 850, money: 0.02, chg: 1.0 },
        { code: '2454', name: '聯發科', weight: 4.1, lots: 16200, value: 921.4, d1: -12, d5: -64, d20: 40, money: -0.19, chg: -0.52 },
      ],
    },
    {
      code: '00878',
      name: '國泰永續高股息',
      type: 'etf',
      scale: 6139.2,
      scale_chg: 25.4,
      yld: 5.07,
      prem: -0.03,
      date: '20260703',
      updated: true,
      price: 27.85,
      chg: 0.14,
      net: 2.86,
      buy_amt: 4.12,
      sell_amt: -1.26,
      add_n: 4,
      cut_n: 1,
      ret: { m1: 0.09, m3: 54.95, m6: 58.94, y1: 70.84, y3: 118.41, y5: 165.79, all: 225.17, ann: 21.89, since: '20200720' },
      info: { co: '國泰投信', etype: '國內指數股票型', idx: 'MSCI臺灣ESG永續高股息精選30指數', pay: '季配', fee1: 0.25, fee2: 0.035, listed: '20200720' },
      divs: [{ d: '20260617', cash: 0.55 }, { d: '20260318', cash: 0.5 }],
      holdings: [
        { code: '2891', name: '中信金', weight: 8.4, lots: 452000, value: 319.2, d1: 1180, d5: 9800, d20: 21800, money: 0.83, chg: 1.0 },
        { code: '2886', name: '兆豐金', weight: 6.2, lots: 384000, value: 174.7, d1: 4326, d5: 15120, d20: 26000, money: 1.97, chg: -1.09 },
        { code: '2303', name: '聯電', weight: 5.6, lots: 238000, value: 405.8, d1: -280, d5: 1200, d20: 5800, money: -0.05, chg: 3.02 },
        { code: '2603', name: '長榮', weight: 4.9, lots: 67000, value: 142.7, d1: 880, d5: 2680, d20: 7600, money: 0.19, chg: 1.23, new: true },
        { code: '3045', name: '台灣大', weight: 4.4, lots: 89000, value: 96.1, d1: -650, d5: -1100, d20: 3400, money: -0.07, chg: 0.42 },
      ],
    },
    {
      code: '00919',
      name: '群益台灣精選高息',
      type: 'etf',
      scale: 5351.8,
      scale_chg: 18.6,
      yld: 8.53,
      prem: 0.01,
      date: '20260703',
      updated: true,
      price: 25.4,
      chg: 0.22,
      net: 1.34,
      buy_amt: 2.81,
      sell_amt: -1.47,
      add_n: 3,
      cut_n: 2,
      ret: { m1: -0.84, m3: 36.9, m6: 40.89, y1: 52.53, y3: 109.73, all: 184.49, ann: 32.61, since: '20221020' },
      info: { co: '群益投信', etype: '國內指數股票型', idx: '特選臺灣上市上櫃精選高息指數', pay: '季配', fee1: 0.3, fee2: 0.035, listed: '20221020' },
      divs: [{ d: '20260623', cash: 0.72 }, { d: '20260319', cash: 0.66 }],
      holdings: [
        { code: '2892', name: '第一金', weight: 6.1, lots: 380000, value: 123.1, d1: 3073, d5: 170784, d20: 198400, money: 0.99, chg: 0.93 },
        { code: '2886', name: '兆豐金', weight: 5.4, lots: 295000, value: 134.2, d1: 1885, d5: 14000, d20: 22000, money: 0.86, chg: -1.09 },
        { code: '2603', name: '長榮', weight: 5.1, lots: 82000, value: 174.7, d1: -360, d5: -1880, d20: 6400, money: -0.08, chg: 1.23 },
        { code: '1216', name: '統一', weight: 4.2, lots: 108000, value: 92.8, d1: 410, d5: 1120, d20: 4200, money: 0.04, chg: 0.35 },
      ],
    },
    {
      code: '00981A',
      name: '主動統一台股增長',
      type: 'active',
      scale: 2957.9,
      scale_chg: 86.2,
      yld: null,
      prem: 0.18,
      date: '20260703',
      updated: true,
      price: 34.8,
      chg: 1.72,
      net: 8.64,
      buy_amt: 11.26,
      sell_amt: -2.62,
      add_n: 8,
      cut_n: 4,
      ret: { m1: 3.5, m3: 62.76, m6: 100.12, y1: 200.09, all: 239.58, ann: 203.44, since: '20250527' },
      info: { co: '統一投信', etype: '主動式國內股票型', idx: null, pay: '季配', fee1: 1.014, fee2: 0.101, listed: '20250527' },
      divs: [],
      holdings: [
        { code: '2330', name: '台積電', weight: 18.4, lots: 12800, value: 312.96, d1: 0, d5: 400, d20: 1200, money: 0, chg: -0.81 },
        { code: '2344', name: '華邦電', weight: 7.8, lots: 9800, value: 180.81, d1: 800, d5: 2400, d20: 4100, money: 1.48, chg: 0.54 },
        { code: '3231', name: '緯創', weight: 6.9, lots: 9500, value: 203.3, d1: 620, d5: 1600, d20: 3600, money: 1.33, chg: 2.12 },
        { code: '6669', name: '緯穎', weight: 6.3, lots: 920, value: 251.1, d1: 85, d5: 260, d20: 760, money: 2.32, chg: 1.8, new: true },
        { code: '2454', name: '聯發科', weight: 4.2, lots: 2800, value: 159.2, d1: -220, d5: -360, d20: 420, money: -1.25, chg: -0.52 },
      ],
    },
    {
      code: '00982A',
      name: '主動群益台灣強棒',
      type: 'active',
      scale: 1588.4,
      scale_chg: 42.1,
      yld: null,
      prem: 0.11,
      date: '20260703',
      updated: true,
      price: 28.2,
      chg: 0.88,
      net: 3.24,
      buy_amt: 5.48,
      sell_amt: -2.24,
      add_n: 6,
      cut_n: 5,
      ret: { m1: 2.1, m3: 41.6, m6: 82.4, y1: 146.8, all: 168.1, ann: 148.2, since: '20250527' },
      info: { co: '群益投信', etype: '主動式國內股票型', idx: null, pay: '不配息', fee1: 1.0, fee2: 0.1, listed: '20250527' },
      divs: [],
      holdings: [
        { code: '6182', name: '合晶', weight: 5.6, lots: 4300, value: 70.1, d1: 471, d5: 900, d20: 1640, money: 0.77, chg: 9.76, new: true },
        { code: '2344', name: '華邦電', weight: 5.4, lots: 5200, value: 95.9, d1: 192, d5: 992, d20: 2100, money: 0.35, chg: 0.54 },
        { code: '2357', name: '華碩', weight: 5.1, lots: 1200, value: 76.8, d1: -180, d5: -580, d20: 340, money: -1.15, chg: -0.41 },
        { code: '2633', name: '台灣高鐵', weight: 4.2, lots: 4136, value: 11.1, d1: 4136, d5: 4136, d20: 4136, money: 1.11, chg: 1.52, new: true },
        { code: '2603', name: '長榮', weight: 3.2, lots: 0, value: 0, d1: -1480, d5: -1800, d20: -2200, money: -3.15, chg: 1.23, clear: true },
      ],
    },
  ],
  stocks: {},
  rank: { active: {}, market: {} },
  mkt_streak: {},
};

function buildStocks(etfs) {
  const out = {};
  for (const etf of etfs) {
    for (const holding of etf.holdings || []) {
      const stock = out[holding.code] || {
        name: holding.name,
        price: holding.value && holding.lots ? Math.round((holding.value * 100000) / holding.lots * 100) / 100 : null,
        holders: [],
      };
      stock.holders.push({
        etf: etf.code,
        etfname: etf.name,
        lots: holding.lots,
        weight: holding.weight,
        d1: holding.d1,
        streak: holding.d1 > 0 ? 2 : holding.d1 < 0 ? -2 : 0,
      });
      out[holding.code] = stock;
    }
  }
  return out;
}

function rankRows(etfs, onlyActive, windowKey, direction) {
  const field = windowKey === 'd1' ? 'd1' : windowKey;
  const map = new Map();
  for (const etf of etfs.filter((item) => !onlyActive || item.type === 'active')) {
    for (const holding of etf.holdings || []) {
      const lots = holding[field] ?? holding.d1 ?? 0;
      if (!lots) continue;
      const key = holding.code;
      const row = map.get(key) || {
        code: holding.code,
        name: holding.name,
        price: holding.value && holding.lots ? Math.round((holding.value * 100000) / holding.lots * 100) / 100 : null,
        chg: holding.chg,
        lots: 0,
        money: 0,
        etf_count: 0,
        side_lots: 0,
        offset_lots: 0,
        etfs: [],
      };
      row.lots += lots;
      row.money += holding.money ?? 0;
      row.etf_count += 1;
      row.etfs.push({ etf: etf.code, name: etf.name, d1: lots });
      map.set(key, row);
    }
  }
  return [...map.values()]
    .filter((row) => direction === 'buy' ? row.lots > 0 : row.lots < 0)
    .sort((a, b) => direction === 'buy' ? b.money - a.money : a.money - b.money)
    .map((row) => ({ ...row, lots: Math.round(Math.abs(row.lots)), money: Math.round(Math.abs(row.money) * 100) / 100 }));
}

for (const scope of ['active', 'market']) {
  DEMO_DATA.rank[scope] = {};
  for (const win of ['d1', 'd5', 'd20', 'd60']) {
    DEMO_DATA.rank[scope][win] = {
      buy: rankRows(DEMO_DATA.etfs, scope === 'active', win, 'buy'),
      sell: rankRows(DEMO_DATA.etfs, scope === 'active', win, 'sell'),
    };
  }
}

DEMO_DATA.stocks = buildStocks(DEMO_DATA.etfs);

export const DEMO_INST = {
  date: '20260703',
  slash: '2026/07/03',
  bases: { d1: '2026/07/03', d5: '2026/06/29', d20: '2026/06/05', d60: '2026/04/09' },
  summary: [
    { k: '外資', v: -218.4 },
    { k: '投信', v: 41.7 },
    { k: '自營商', v: 12.8 },
  ],
  report: { fx: -81052, fx_chg: 3435, rt: 5309, rt_chg: -2268, gov: 111.7, gov_date: '2026/07/03', fin: 191.2, sht: 0.49, m_date: '2026/07/03' },
  wins: {
    d1: [
      ['2344', '華邦電', 184.5, 0.54, 18850, 3200, 900, 1240, 4.44],
      ['2886', '兆豐金', 45.5, -1.09, -12600, 9600, 1800, 700, 0.82],
      ['2330', '台積電', 2445, -0.81, -7200, 2300, -1400, -800, -17.2],
      ['6182', '合晶', 163, 9.76, 5100, 4300, 500, 280, 1.72],
    ],
    d5: [
      ['2892', '第一金', 32.4, 0.93, 82000, 30000, 16000, 4200, 4.28],
      ['2344', '華邦電', 184.5, 0.54, 42000, 15800, 6200, 3800, 12.5],
      ['2330', '台積電', 2445, -0.81, -31000, 8200, -5400, -2800, -38.4],
    ],
    d20: [],
    d60: [],
  },
};

export const DEMO_DTS = {
  slash: '2026/07/03',
  src: '示範資料',
  rows: [
    { c: '1718', n: '中纖', price: 14.95, chg: 9.93, mkt: '市', lots: 551, cnt: 13, mx: 6, sr: 6.37, det: [[45, 6], [138, 4.73], [179, 0.468]] },
    { c: '6182', n: '合晶', price: 163, chg: 9.76, mkt: '櫃', lots: 471, cnt: 9, mx: 7, sr: 6.15, det: [[169, 7], [62, 3.5], [97, 0.764]] },
  ],
};

export const DEMO_EVENTS = {
  slash: '2026/07/03',
  buyback: [
    { c: '2385', n: '群光', price: 107, chg: 1.42, f: '2026/07/01', t: '2026/08/29', lots: 6000, done: 0, why: '維護公司信用及股東權益', st: '進行中' },
    { c: '4114', n: '健喬', price: 31.8, chg: 2.09, f: '2026/06/29', t: '2026/08/28', lots: 3000, done: 0, why: '轉讓股份予員工', st: '進行中' },
  ],
  dispose: [
    { c: '6182', n: '合晶', price: 163, chg: 9.76, iv: '5', f: '2026/07/01', t: '2026/07/09', ms: 8.2, pos: 92, st: '處置中' },
    { c: '2344', n: '華邦電', price: 184.5, chg: 0.54, iv: '20', f: '2026/06/26', t: '2026/07/04', ms: 6.1, pos: 87, st: '即將出關' },
  ],
  transfer: [
    { c: '2357', n: '華碩', price: 640, chg: -0.41, d: '2026/07/03', role: '董事', way: '一般交易', lots: 300, f: '2026/07/06', st: '轉讓中' },
  ],
  acquire: [
    { tcode: '2603', n: '長榮', d: '2026/07/03', who_short: '策略投資人', who: '策略投資人', pct: 6.8, lots: 82000, period: '2026/06/01-2026/07/03', url: 'https://mops.twse.com.tw/' },
  ],
  disp: [
    { by: '2881', byname: '富邦金', tcode: '2330', tgt: '台積電', d: '2026/07/03', lots: 500, amt: 12.2, url: 'https://mops.twse.com.tw/' },
  ],
  xd: [
    { c: '00878', n: '國泰永續高股息', d: '2026/07/16', price: 27.85, chg: 0.14, kind: '息', cash: 0.55, stk: 0, yld: 5.07, pay: '2026/08/12', hasW: false, hasF: false },
  ],
};

export const DEMO_ZIJIE = {
  generated: '2026/07/04 00:00',
  rows: [
    { code: '3023', name: '信邦', date_ce: '2026/07/03', time: '17:57:09', subject: '自結 5 月 EPS 1.03 元，年增 24%', eps_m: 1.03, eps_m_yoy: 24, eps_q: 3.6, eps_4q: 12.77, url: 'https://mops.twse.com.tw/' },
    { code: '1515', name: '力山', date_ce: '2026/07/03', time: '15:45:46', subject: '公布近期財務業務資訊', eps_m: 0.32, eps_m_yoy: -8, eps_q: 1.1, eps_4q: 4.05, url: 'https://mops.twse.com.tw/' },
  ],
};
