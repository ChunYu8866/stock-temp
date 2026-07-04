import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DEMO_DATA, DEMO_DTS, DEMO_EVENTS, DEMO_INST, DEMO_ZIJIE } from './data/demo-etf.mjs';

const h = React.createElement;
const base = import.meta.env?.BASE_URL || '/';

function el(type, props, ...children) {
  return h(type, props || {}, ...children.flat(Infinity).filter((child) => child !== null && child !== undefined && child !== false));
}

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function fmtNum(value, digits = 0) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('zh-TW', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function fmtMoney(value, digits = 2) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const sign = Number(value) > 0 ? '+' : '';
  return `${sign}${fmtNum(value, digits)} 億`;
}

function fmtPct(value, digits = 2) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const sign = Number(value) > 0 ? '+' : '';
  return `${sign}${fmtNum(value, digits)}%`;
}

function ymdSlash(value) {
  const raw = String(value || '').replace(/\D/g, '');
  if (raw.length !== 8) return value || '—';
  return `${raw.slice(0, 4)}/${raw.slice(4, 6)}/${raw.slice(6, 8)}`;
}

function tone(value) {
  if (Number(value) > 0) return 'up';
  if (Number(value) < 0) return 'down';
  return 'muted';
}

function absMoney(row) {
  return Math.abs(Number(row?.money || 0));
}

function isActiveEtf(etf) {
  return etf?.type === 'active' || /A$/i.test(String(etf?.code || ''));
}

function normalizeData(payload) {
  if (!payload?.etfs?.length) return DEMO_DATA;
  return {
    ...payload,
    meta: payload.meta || {},
    etfs: payload.etfs || [],
    stocks: payload.stocks || {},
    rank: payload.rank || { active: {}, market: {} },
  };
}

async function requestJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function staticMarketPath(path) {
  const clean = String(path || '').trim().replace(/^\/+/, '');
  if (!/^data\/[a-z0-9_./-]+\.json$/i.test(clean)) return null;
  return `${base}data/market/${clean.replace(/^data\//, '')}`;
}

async function fetchJson(path) {
  try {
    return await requestJson(`${base}api/market-resource?path=${encodeURIComponent(path)}`);
  } catch (apiError) {
    const staticPath = staticMarketPath(path);
    if (!staticPath) throw apiError;
    return requestJson(staticPath);
  }
}

async function fetchPrimaryPayload() {
  try {
    return await requestJson(`${base}api/etf-data`);
  } catch {
    return requestJson(`${base}data/etf-data.json`).then((payload) => ({ ...payload, source: 'live' }));
  }
}

function usePrimaryData() {
  const [state, setState] = useState({ data: DEMO_DATA, source: 'demo', loading: true, error: null });
  useEffect(() => {
    let cancelled = false;
    fetchPrimaryPayload()
      .then((payload) => {
        if (!cancelled) setState({ data: normalizeData(payload), source: payload?.source || 'snapshot', loading: false, error: null });
      })
      .catch((error) => {
        if (!cancelled) setState({ data: DEMO_DATA, source: 'demo', loading: false, error: error.message });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

function useSectorData() {
  const [state, setState] = useState({ data: null, source: 'loading', loading: true, error: null });
  useEffect(() => {
    let cancelled = false;
    fetch(`${base}api/sector-rotation`, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((payload) => {
        if (!cancelled) setState({ data: payload, source: 'live', loading: false, error: null });
      })
      .catch((apiError) => {
        fetch(`${base}data/latest.json`, { cache: 'no-store' })
          .then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
          })
          .then((payload) => {
            if (!cancelled) setState({ data: payload, source: 'snapshot', loading: false, error: null });
          })
          .catch((snapshotError) => {
            if (!cancelled) setState({ data: null, source: 'demo', loading: false, error: `${apiError.message}; ${snapshotError.message}` });
          });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

function useResource(path, enabled, fallback) {
  const [state, setState] = useState({ data: fallback, loading: false, source: 'demo', error: null });
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: null }));
    fetchJson(path)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, source: 'live', error: null });
      })
      .catch((error) => {
        if (!cancelled) setState({ data: fallback, loading: false, source: 'demo', error: error.message });
      });
    return () => {
      cancelled = true;
    };
  }, [path, enabled]);
  return state;
}

function kpi(label, value, detail, toneName) {
  return el('div', { className: 'kpi' },
    el('span', null, label),
    el('b', { className: toneName ? toneName : undefined }, value),
    detail ? el('small', null, detail) : null
  );
}

function DataBadge({ source, loading, error }) {
  const text = loading ? '資料載入中' : source === 'live' ? '資料已更新' : '備援資料';
  return el('span', { className: cx('data-badge', source === 'demo' ? 'demo' : 'live') },
    text,
    error ? el('small', null, ` · 已切換備援`) : null
  );
}

function Header({ dataState, activeTab, onTab }) {
  const { data, source, loading, error } = dataState;
  const meta = data.meta || {};
  const totalNet = data.etfs.reduce((sum, item) => sum + Number(item.net || 0), 0);
  const activeNet = data.etfs.filter(isActiveEtf).reduce((sum, item) => sum + Number(item.net || 0), 0);
  const tabs = [
    ['flow', '資金總覽'],
    ['active', '主動式 ETF 進出'],
    ['etf', 'ETF 總覽'],
    ['rank', '投信買賣超'],
    ['inst', '三大法人'],
    ['stock', '用股票查 ETF'],
    ['perf', '績效圖'],
    ['focus', '每日焦點'],
    ['events', '事件'],
  ];

  return el('header', { className: 'hero' },
    el('div', { className: 'hero-main' },
      el('div', { className: 'brand-row' },
          el('div', { className: 'brand-mark' }, 'F'),
          el('div', null,
            el('h1', null, '資金流向 Super Dashboard'),
          el('p', null, `ETF 持股、主動式換股、法人籌碼與市場事件整合 · 資料日 ${meta.latest_slash || ymdSlash(meta.latest)}`)
        )
      ),
      el('div', { className: 'hero-actions' },
        el('a', { className: 'ghost-link', href: `${base}fund-flow/` }, '原資金流向'),
        el(DataBadge, { source, loading, error })
      )
    ),
    el('div', { className: 'kpi-grid hero-kpis' },
      kpi('ETF 檔數', fmtNum(meta.etf_total || data.etfs.length), `${fmtNum(meta.active_count || data.etfs.filter(isActiveEtf).length)} 檔主動式`),
      kpi('全 ETF 持股淨買賣', fmtMoney(totalNet), '正值代表持股估值淨增加', tone(totalNet)),
      kpi('主動式淨買賣', fmtMoney(activeNet), `${fmtNum(meta.active_updated || 0)} / ${fmtNum(meta.active_total || 0)} 檔已更新`, tone(activeNet)),
      kpi('覆蓋檔數', fmtNum(meta.cover_latest || data.etfs.length), meta.incomplete ? '部分 ETF 資料落後' : '最新日已覆蓋')
    ),
    el('nav', { className: 'tabs', 'aria-label': '功能分頁' },
      tabs.map(([key, label]) => el('button', {
        key,
        className: activeTab === key ? 'on' : '',
        onClick: () => onTab(key),
      }, label))
    )
  );
}

function stockBucket(code, name) {
  const text = `${code} ${name || ''}`;
  if (/2330|2454|2303|2344|聯電|台積|華邦|發科/.test(text)) return '半導體';
  if (/2317|3231|2382|6669|緯|鴻海|伺服器/.test(text)) return 'AI 伺服器';
  if (/288|289|金融|金/.test(text)) return '金融';
  if (/260|長榮|航|高鐵/.test(text)) return '運輸';
  if (/1216|3045|電信|食品|高息/.test(text)) return '防禦高息';
  return '其他';
}

function computeFlowBuckets(data) {
  const buckets = new Map();
  for (const etf of data.etfs || []) {
    for (const holding of etf.holdings || []) {
      const bucket = stockBucket(holding.code, holding.name);
      const current = buckets.get(bucket) || { name: bucket, money: 0, buys: 0, sells: 0, count: 0, leaders: [] };
      current.money += Number(holding.money || 0);
      current.buys += Math.max(Number(holding.money || 0), 0);
      current.sells += Math.min(Number(holding.money || 0), 0);
      current.count += 1;
      current.leaders.push({ ...holding, etf: etf.code });
      buckets.set(bucket, current);
    }
  }
  return [...buckets.values()]
    .map((bucket) => ({
      ...bucket,
      leaders: bucket.leaders.sort((a, b) => Math.abs(b.money || 0) - Math.abs(a.money || 0)).slice(0, 3),
    }))
    .sort((a, b) => Math.abs(b.money) - Math.abs(a.money));
}

function sectorToneClass(sector) {
  if (sector?.category === 'green' || Number(sector?.net_1d_yi) > 0) return 'flow-in';
  if (sector?.category === 'red' || Number(sector?.net_1d_yi) < 0) return 'flow-out';
  return 'neutral';
}

function MarketHeatPanel({ sectorState }) {
  const sectors = sectorState.data?.sectors || [];
  const topIn = [...sectors].sort((a, b) => Number(b.net_1d_yi || 0) - Number(a.net_1d_yi || 0)).slice(0, 5);
  const topOut = [...sectors].sort((a, b) => Number(a.net_1d_yi || 0) - Number(b.net_1d_yi || 0)).slice(0, 5);
  const bottomFishing = sectors.filter((sector) => sector.is_bottom_fishing).slice(0, 5);
  const marketChg = sectorState.data?.marketChg1d;
  const statusText = sectorState.loading ? '熱區載入中' : sectorState.source === 'live' ? '熱區已更新' : sectorState.data ? '使用本機快照' : '熱區待更新';

  const sectorCard = (sector) => el('div', { key: sector.name, className: cx('sector-card', sectorToneClass(sector)) },
    el('strong', null, sector.name),
    el('b', null, `${fmtNum(sector.net_1d_yi, 2)} 億`),
    el('small', null, `1 日 ${fmtPct(sector.chg_1d)} · 5 日 ${fmtNum(sector.net_5d_yi, 1)} 億`)
  );

  return el('section', { className: 'panel market-merge-panel' },
    el('div', { className: 'panel-title' },
      el('div', null,
        el('h2', null, '台股熱區 × ETF 資金流'),
        el('p', null, '把原本的市場族群資金與 ETF 持股流向放在同一個總覽頁。')
      ),
      el('span', { className: 'hint-pill' }, statusText)
    ),
    el('div', { className: 'merge-grid' },
      el('div', { className: 'merge-summary' },
        kpi('加權指數日變動', marketChg == null ? '—' : fmtPct(marketChg), sectorState.data?.date || '等待資料', tone(marketChg)),
        kpi('熱區族群數', fmtNum(sectors.length), bottomFishing.length ? `${fmtNum(bottomFishing.length)} 組低接訊號` : '市場族群掃描'),
        kpi('ETF 檢視模式', '同頁整合', '下方接續 ETF 資金總覽')
      ),
      el('div', { className: 'sector-column' },
        el('h3', null, '族群流入'),
        topIn.length ? topIn.map(sectorCard) : el('p', { className: 'empty' }, '尚無熱區資料')
      ),
      el('div', { className: 'sector-column' },
        el('h3', null, '族群流出'),
        topOut.length ? topOut.map(sectorCard) : el('p', { className: 'empty' }, '尚無熱區資料')
      ),
      el('div', { className: 'sector-column' },
        el('h3', null, '低接訊號'),
        bottomFishing.length ? bottomFishing.map(sectorCard) : el('p', { className: 'empty' }, '目前沒有明顯低接訊號')
      )
    )
  );
}

function FlowOverview({ data, onEtf, onStock }) {
  const buckets = useMemo(() => computeFlowBuckets(data), [data]);
  const topEtfs = [...data.etfs].sort((a, b) => Math.abs(b.net || 0) - Math.abs(a.net || 0)).slice(0, 8);
  const crowded = Object.entries(data.stocks || {})
    .map(([code, stock]) => ({ code, ...stock, etfCount: (stock.holders || []).filter((hld) => hld.lots > 0).length }))
    .filter((stock) => stock.etfCount)
    .sort((a, b) => b.etfCount - a.etfCount)
    .slice(0, 8);

  return el('section', { className: 'grid-page flow-page' },
    el('div', { className: 'panel wide' },
      el('div', { className: 'panel-title' },
        el('div', null, el('h2', null, '資金流向熱區'), el('p', null, '以 ETF 持股增減估算主題資金，紅色為流入、綠色為流出。')),
        el('span', { className: 'hint-pill' }, 'ETF 持股淨買賣')
      ),
      el('div', { className: 'flow-tiles' },
        buckets.map((bucket) => {
          const magnitude = Math.min(1, Math.abs(bucket.money) / Math.max(...buckets.map((item) => Math.abs(item.money)), 1));
          return el('button', {
            key: bucket.name,
            className: cx('flow-tile', bucket.money >= 0 ? 'flow-in' : 'flow-out'),
            style: { '--strength': String(0.16 + magnitude * 0.68) },
          },
            el('strong', null, bucket.name),
            el('b', null, fmtMoney(bucket.money)),
            el('span', null, `${fmtNum(bucket.count)} 筆持股異動`),
            el('small', null, bucket.leaders.map((item) => `${item.name} ${fmtMoney(item.money, 1)}`).join(' · '))
          );
        })
      )
    ),
    el('aside', { className: 'panel' },
      el('div', { className: 'panel-title' }, el('h2', null, 'ETF 流量雷達')),
      el('div', { className: 'rank-list' },
        topEtfs.map((etf, index) => el('button', { key: etf.code, className: 'rank-row', onClick: () => onEtf(etf.code) },
          el('span', { className: 'rank-no' }, index + 1),
          el('span', null, el('b', null, etf.code), el('small', null, etf.name)),
          el('em', { className: tone(etf.net) }, fmtMoney(etf.net))
        ))
      )
    ),
    el('aside', { className: 'panel' },
      el('div', { className: 'panel-title' }, el('h2', null, '被最多 ETF 持有')),
      el('div', { className: 'chip-list' },
        crowded.map((stock) => el('button', { key: stock.code, className: 'stock-chip', onClick: () => onStock(stock.code) },
          el('b', null, stock.name),
          el('span', null, `${stock.code} · ${stock.etfCount} 檔`)
        ))
      )
    )
  );
}

function ActiveMoves({ data, onEtf }) {
  const [sortKey, setSortKey] = useState('action');
  const [mode, setMode] = useState('cards');
  const [query, setQuery] = useState('');
  const active = data.etfs.filter(isActiveEtf);
  const rows = useMemo(() => active.map((etf) => {
    const holdings = etf.holdings || [];
    const buys = holdings.filter((hld) => Number(hld.d1 || 0) > 0).sort((a, b) => absMoney(b) - absMoney(a));
    const sells = holdings.filter((hld) => Number(hld.d1 || 0) < 0).sort((a, b) => absMoney(b) - absMoney(a));
    return {
      etf,
      action: Math.abs(etf.buy_amt || 0) + Math.abs(etf.sell_amt || 0),
      changes: holdings.filter((hld) => hld.new || hld.clear || hld.d1).length,
      buys,
      sells,
      newCount: holdings.filter((hld) => hld.new).length,
      clearCount: holdings.filter((hld) => hld.clear).length,
    };
  })
    .filter((row) => !query.trim() || `${row.etf.code} ${row.etf.name}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => {
      if (sortKey === 'scale') return (b.etf.scale || 0) - (a.etf.scale || 0);
      if (sortKey === 'net') return (b.etf.net || 0) - (a.etf.net || 0);
      if (sortKey === 'changes') return b.changes - a.changes;
      return b.action - a.action;
    }), [active, query, sortKey]);

  const totalBuy = active.reduce((sum, etf) => sum + Math.max(etf.buy_amt || 0, 0), 0);
  const totalSell = active.reduce((sum, etf) => sum + Math.abs(Math.min(etf.sell_amt || 0, 0)), 0);

  return el('section', { className: 'stack' },
    el('div', { className: 'kpi-grid' },
      kpi('主動式檔數', fmtNum(active.length), '只統計代號 A 或 type=active'),
      kpi('今日加碼', fmtMoney(totalBuy), '持股增加估值', 'up'),
      kpi('今日減碼', fmtMoney(-totalSell), '持股減少估值', 'down'),
      kpi('淨操作', fmtMoney(totalBuy - totalSell), '加碼扣減碼', tone(totalBuy - totalSell))
    ),
    el('div', { className: 'toolbar panel' },
      el('input', { value: query, onChange: (event) => setQuery(event.target.value), placeholder: '搜尋主動式 ETF 代號或名稱' }),
      el('div', { className: 'segmented' },
        [['action', '操作強度'], ['net', '淨買賣'], ['scale', '規模'], ['changes', '異動數']].map(([key, label]) => el('button', { key, className: sortKey === key ? 'on' : '', onClick: () => setSortKey(key) }, label))
      ),
      el('div', { className: 'segmented' },
        [['cards', '卡片'], ['list', '列表']].map(([key, label]) => el('button', { key, className: mode === key ? 'on' : '', onClick: () => setMode(key) }, label))
      )
    ),
    mode === 'cards'
      ? el('div', { className: 'active-grid' }, rows.map((row) => el(ActiveCard, { key: row.etf.code, row, onEtf })))
      : el('div', { className: 'panel table-wrap' }, el(SimpleTable, {
        columns: ['ETF', '規模', '淨買賣', '加碼', '減碼', '新進/出清'],
        rows: rows.map((row) => [
          el('button', { className: 'linklike', onClick: () => onEtf(row.etf.code) }, `${row.etf.code} ${row.etf.name}`),
          `${fmtNum(row.etf.scale, 1)} 億`,
          el('span', { className: tone(row.etf.net) }, fmtMoney(row.etf.net)),
          fmtMoney(row.etf.buy_amt),
          fmtMoney(row.etf.sell_amt),
          `${row.newCount} / ${row.clearCount}`,
        ]),
      }))
  );
}

function ActiveCard({ row, onEtf }) {
  const { etf, buys, sells } = row;
  const list = (items) => items.slice(0, 5).map((item) => el('div', { key: `${item.code}-${item.d1}`, className: 'move-line' },
    el('span', null, el('b', null, item.name), el('small', null, item.code)),
    el('em', { className: tone(item.d1) }, `${Number(item.d1) > 0 ? '+' : ''}${fmtNum(item.d1)} 張`, el('small', null, fmtMoney(item.money)))
  ));
  return el('article', { className: 'active-card' },
    el('div', { className: 'card-head' },
      el('div', null, el('b', null, etf.code), el('h3', null, etf.name), el('p', null, `${etf.info?.co || '投信'} · 規模 ${fmtNum(etf.scale, 1)} 億`)),
      el('button', { className: 'icon-action', onClick: () => onEtf(etf.code), title: 'ETF 明細' }, '↗')
    ),
    el('div', { className: 'mini-kpis' },
      kpi('淨買賣', fmtMoney(etf.net), null, tone(etf.net)),
      kpi('新進', fmtNum(row.newCount), '檔'),
      kpi('出清', fmtNum(row.clearCount), '檔')
    ),
    el('div', { className: 'move-cols' },
      el('div', null, el('h4', null, '加碼'), list(buys)),
      el('div', null, el('h4', null, '減碼'), list(sells))
    )
  );
}

function EtfOverview({ data, onEtf }) {
  const [kind, setKind] = useState('all');
  const [view, setView] = useState('card');
  const [scaleBasis, setScaleBasis] = useState('daily');
  const [query, setQuery] = useState('');
  const rows = useMemo(() => data.etfs
    .filter((etf) => kind === 'all' || (kind === 'active' ? isActiveEtf(etf) : !isActiveEtf(etf)))
    .filter((etf) => !query.trim() || `${etf.code} ${etf.name}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => (b.scale || 0) - (a.scale || 0)), [data, kind, query]);

  return el('section', { className: 'stack' },
    el('div', { className: 'toolbar panel' },
      el('input', { value: query, onChange: (event) => setQuery(event.target.value), placeholder: '搜尋 ETF 代號或名稱' }),
      el('div', { className: 'segmented' },
        [['all', '全部'], ['active', '主動式'], ['passive', '被動']].map(([key, label]) => el('button', { key, className: kind === key ? 'on' : '', onClick: () => setKind(key) }, label))
      ),
      el('div', { className: 'segmented' },
        [['card', '卡片'], ['list', '列表']].map(([key, label]) => el('button', { key, className: view === key ? 'on' : '', onClick: () => setView(key) }, label))
      ),
      el('div', { className: 'segmented' },
        [['daily', '日更新規模'], ['month', '上月底規模']].map(([key, label]) => el('button', { key, className: scaleBasis === key ? 'on' : '', onClick: () => setScaleBasis(key) }, label))
      )
    ),
    view === 'card'
      ? el('div', { className: 'etf-grid' }, rows.map((etf) => el(EtfCard, { key: etf.code, etf, onEtf, scaleBasis })))
      : el('div', { className: 'panel table-wrap' }, el(SimpleTable, {
        columns: ['ETF', '類型', '規模', '持股淨買賣', '殖利率', '折溢價', '更新日'],
        rows: rows.map((etf) => [
          el('button', { className: 'linklike', onClick: () => onEtf(etf.code) }, `${etf.code} ${etf.name}`),
          isActiveEtf(etf) ? '主動式' : '被動',
          `${fmtNum(etf[scaleBasis === 'month' ? 'mscale' : 'scale'] ?? etf.scale, 1)} 億`,
          el('span', { className: tone(etf.net) }, fmtMoney(etf.net)),
          etf.yld == null ? '—' : fmtPct(etf.yld),
          etf.prem == null ? '—' : fmtPct(etf.prem),
          ymdSlash(etf.date),
        ]),
      }))
  );
}

function EtfCard({ etf, onEtf, scaleBasis }) {
  const top = [...(etf.holdings || [])].filter((item) => item.lots > 0).sort((a, b) => (b.value || 0) - (a.value || 0)).slice(0, 3);
  const scale = etf[scaleBasis === 'month' ? 'mscale' : 'scale'] ?? etf.scale;
  return el('button', { className: 'etf-card', onClick: () => onEtf(etf.code) },
    el('div', { className: 'card-head' },
      el('div', null, el('b', null, etf.code), el('h3', null, etf.name), el('p', null, `${isActiveEtf(etf) ? '主動式' : '被動'} · ${ymdSlash(etf.date)}`)),
      el('em', { className: tone(etf.net) }, fmtMoney(etf.net))
    ),
    el('div', { className: 'meta-row' },
      el('span', null, `規模 ${fmtNum(scale, 1)} 億`),
      el('span', null, etf.yld == null ? '殖利率 —' : `殖利率 ${fmtPct(etf.yld)}`),
      el('span', null, etf.prem == null ? '折溢價 —' : `折溢價 ${fmtPct(etf.prem)}`)
    ),
    el('div', { className: 'top-holdings' },
      top.map((holding) => el('div', { key: holding.code },
        el('span', null, holding.name),
        el('b', null, fmtPct(holding.weight))
      ))
    )
  );
}

function RankView({ data, onStock }) {
  const [scope, setScope] = useState('active');
  const [dir, setDir] = useState('buy');
  const [win, setWin] = useState('d1');
  const [query, setQuery] = useState('');
  const pack = data.rank?.[scope]?.[win] || {};
  const rows = (pack[dir] || [])
    .filter((row) => !query.trim() || `${row.code} ${row.name}`.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 80);
  const meta = data.meta || {};
  const range = win === 'd1' ? (meta.latest_slash || ymdSlash(meta.latest)) : `${meta.win_bases?.[win] || '—'} → ${meta.latest_slash || ymdSlash(meta.latest)}`;

  return el('section', { className: 'stack' },
    el('div', { className: 'toolbar panel' },
      el('input', { value: query, onChange: (event) => setQuery(event.target.value), placeholder: '搜尋股票代號或名稱' }),
      el('div', { className: 'segmented buy-sell' },
        [['buy', '買超'], ['sell', '賣超']].map(([key, label]) => el('button', { key, className: dir === key ? 'on' : '', onClick: () => setDir(key) }, label))
      ),
      el('div', { className: 'segmented' },
        [['active', '台股主動式'], ['market', '全市場已更新']].map(([key, label]) => el('button', { key, className: scope === key ? 'on' : '', onClick: () => setScope(key) }, label))
      ),
      el('div', { className: 'segmented' },
        [['d1', '當日'], ['d5', '5日'], ['d10', '10日'], ['d20', '20日'], ['d60', '60日']].map(([key, label]) => el('button', { key, className: win === key ? 'on' : '', onClick: () => setWin(key) }, label))
      )
    ),
    el('div', { className: 'panel table-wrap' },
      el('div', { className: 'panel-title' }, el('h2', null, `${scope === 'active' ? '主動式 ETF' : '全市場 ETF'} · ${dir === 'buy' ? '買超' : '賣超'}排行`), el('p', null, `統計區間：${range} · 金額以收盤價估算`)),
      el(SimpleTable, {
        columns: ['#', '股票', '價格/漲跌', '張數', '估值', 'ETF 檔數', '主要來源'],
        rows: rows.map((row, index) => [
          index + 1,
          el('button', { className: 'linklike', onClick: () => onStock(row.code) }, `${row.name} (${row.code})`),
          el('span', null, fmtNum(row.price, 2), el('small', { className: tone(row.chg) }, fmtPct(row.chg))),
          fmtNum(row.lots),
          el('span', { className: dir === 'buy' ? 'up' : 'down' }, fmtMoney(dir === 'buy' ? row.money : -row.money)),
          fmtNum(row.etf_count),
          (row.etfs || []).slice(0, 4).map((item) => `${item.etf} ${Number(item.d1) > 0 ? '+' : ''}${fmtNum(item.d1)}`).join(' · '),
        ]),
      })
    )
  );
}

function StockLookup({ data, initialCode, onEtf }) {
  const [query, setQuery] = useState(initialCode || '');
  const [selected, setSelected] = useState(initialCode || '');
  const detail = useResource(selected ? `data/stock/${selected}.json` : '', Boolean(selected), null);
  useEffect(() => {
    if (initialCode) {
      setQuery(initialCode);
      setSelected(initialCode);
    }
  }, [initialCode]);
  const stocks = data.stocks || {};
  const topHeld = Object.entries(stocks).map(([code, stock]) => ({ code, ...stock, count: (stock.holders || []).filter((hld) => hld.lots > 0).length }))
    .filter((stock) => stock.count)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const resolve = (value) => {
    const q = value.trim().toLowerCase();
    if (!q) return '';
    if (stocks[q]) return q;
    const found = Object.entries(stocks).find(([code, stock]) => code.includes(q) || String(stock.name || '').toLowerCase().includes(q));
    return found?.[0] || '';
  };
  const code = selected && stocks[selected] ? selected : resolve(query);
  const stock = stocks[code];
  const rows = stock ? [...(stock.holders || [])].sort((a, b) => (b.lots || 0) - (a.lots || 0)) : [];

  return el('section', { className: 'stack' },
    el('div', { className: 'toolbar panel' },
      el('input', {
        value: query,
        onChange: (event) => {
          setQuery(event.target.value);
          const next = resolve(event.target.value);
          if (next) setSelected(next);
        },
        placeholder: '輸入股票代號或名稱，例如 2330、台積電',
      }),
      el('button', { className: 'primary-btn', onClick: () => setSelected(resolve(query)) }, '查詢')
    ),
    stock ? el('div', { className: 'panel' },
      el('div', { className: 'stock-head' },
        el('div', null, el('h2', null, `${stock.name} (${code})`), el('p', null, `目前被 ${rows.filter((row) => row.lots > 0).length} 檔 ETF 持有 · 估計股價 ${fmtNum(stock.price, 2)}`)),
        el('span', { className: 'hint-pill' }, detail.source === 'live' ? '含歷史快照' : '目前持有')
      ),
      el(StockHistory, { detail: detail.data, stock }),
      el(SimpleTable, {
        columns: ['ETF', '權重', '庫存張數', '今日增減', '連買賣'],
        rows: rows.map((row) => [
          el('button', { className: 'linklike', onClick: () => onEtf(row.etf) }, `${row.etf} ${row.etfname}`),
          fmtPct(row.weight),
          fmtNum(row.lots),
          el('span', { className: tone(row.d1) }, `${Number(row.d1) > 0 ? '+' : ''}${fmtNum(row.d1)} 張`),
          row.streak ? el('span', { className: tone(row.streak) }, `${row.streak > 0 ? '+' : ''}${row.streak}`) : '無',
        ]),
      })
    ) : el('div', { className: 'panel' },
      el('div', { className: 'panel-title' }, el('h2', null, '被最多 ETF 持有')),
      el('div', { className: 'chip-list' }, topHeld.map((item) => el('button', { key: item.code, className: 'stock-chip', onClick: () => { setQuery(item.code); setSelected(item.code); } },
        el('b', null, item.name),
        el('span', null, `${item.code} · ${item.count} 檔 ETF`)
      )))
    )
  );
}

function StockHistory({ detail, stock }) {
  const series = useMemo(() => {
    if (!detail?.snap_dates?.length || !detail?.snaps) return null;
    return detail.snap_dates.slice().reverse().map((date) => {
      const total = (detail.snaps[date] || []).reduce((sum, item) => sum + Number(item[1] || 0), 0);
      return { date, value: total };
    });
  }, [detail]);
  if (!series?.length) return el('div', { className: 'soft-note' }, '尚未載入歷史持有快照，先顯示目前各 ETF 持有狀況。');
  return el('div', { className: 'history-box' },
    el('h3', null, 'ETF 合計持有張數趨勢'),
    el(InteractiveLineChart, { series: [{ name: stock.name, points: series, color: '#f59e0b' }], height: 140, valueSuffix: ' 張' })
  );
}

function PerformanceView({ data, perfCodes, setPerfCodes }) {
  const [mode, setMode] = useState('chart');
  const [addText, setAddText] = useState('');
  const [win, setWin] = useState('all');
  const [pair, setPair] = useState(['0050', '00981A']);
  const etfMap = new Map(data.etfs.map((etf) => [etf.code, etf]));
  const validCodes = perfCodes.filter((code) => etfMap.has(code)).slice(0, 8);
  const addCode = () => {
    const q = addText.trim().toLowerCase();
    const found = data.etfs.find((etf) => etf.code.toLowerCase() === q || etf.name.toLowerCase().includes(q));
    if (found && !perfCodes.includes(found.code)) setPerfCodes([...perfCodes, found.code].slice(0, 8));
    setAddText('');
  };

  return el('section', { className: 'stack' },
    el('div', { className: 'toolbar panel' },
      el('div', { className: 'segmented' },
        [['chart', '績效比較'], ['sim', 'ETF 相似度']].map(([key, label]) => el('button', { key, className: mode === key ? 'on' : '', onClick: () => setMode(key) }, label))
      ),
      mode === 'chart' ? el(React.Fragment, null,
        el('input', { value: addText, onChange: (event) => setAddText(event.target.value), placeholder: '輸入 ETF 代號或名稱加入比較' }),
        el('button', { className: 'primary-btn', onClick: addCode }, '加入'),
        el('div', { className: 'segmented' },
          [['m1', '1月'], ['m3', '3月'], ['m6', '6月'], ['y1', '1年'], ['y3', '3年'], ['all', '全部']].map(([key, label]) => el('button', { key, className: win === key ? 'on' : '', onClick: () => setWin(key) }, label))
        )
      ) : null
    ),
    mode === 'chart'
      ? el(PerfChartPanel, { codes: validCodes, etfMap, setPerfCodes, win })
      : el(SimilarityPanel, { data, pair, setPair })
  );
}

function PerfChartPanel({ codes, etfMap, setPerfCodes, win }) {
  const [seriesMap, setSeriesMap] = useState({});
  useEffect(() => {
    let cancelled = false;
    Promise.all(codes.map((code) => fetchJson(`data/perf/${code}.json`).then((data) => [code, data]).catch(() => [code, null])))
      .then((entries) => {
        if (!cancelled) setSeriesMap(Object.fromEntries(entries));
      });
    return () => {
      cancelled = true;
    };
  }, [codes.join(',')]);

  const chartSeries = codes.map((code, index) => {
    const raw = seriesMap[code];
    const points = raw?.d?.map((date, idx) => ({ date, value: raw.c[idx] })).filter((item) => Number.isFinite(item.value));
    return { name: code, points: windowedPoints(points, win), color: CHART_COLORS[index % CHART_COLORS.length] };
  }).filter((item) => item.points?.length > 1);

  return el('div', { className: 'panel' },
    el('div', { className: 'panel-title' },
      el('div', null, el('h2', null, '績效比較'), el('p', null, '報酬率以外部資料的含息還原序列繪製；無序列時仍顯示 ETF 績效表。'))
    ),
    el('div', { className: 'selected-chips' },
      codes.map((code) => el('button', { key: code, onClick: () => setPerfCodes(codes.filter((item) => item !== code)) }, `${code} ×`))
    ),
    chartSeries.length ? el(InteractiveLineChart, { series: normalizeSeries(chartSeries), height: 280, valueSuffix: '%', baseline: 100 }) : el('div', { className: 'soft-note' }, '尚未載入績效序列，請確認資料服務是否啟動。'),
    el(SimpleTable, {
      columns: ['ETF', '1月', '3月', '6月', '1年', '3年', '年化', '上市'],
      rows: codes.map((code) => {
        const etf = etfMap.get(code);
        return [
          `${code} ${etf?.name || ''}`,
          fmtPct(etf?.ret?.m1),
          fmtPct(etf?.ret?.m3),
          fmtPct(etf?.ret?.m6),
          fmtPct(etf?.ret?.y1),
          fmtPct(etf?.ret?.y3),
          fmtPct(etf?.ret?.ann),
          ymdSlash(etf?.ret?.since || etf?.info?.listed),
        ];
      }),
    })
  );
}

const CHART_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#f59e0b', '#7c3aed', '#0891b2', '#db2777', '#475569'];

function windowedPoints(points, win) {
  if (!points?.length || win === 'all') return points || [];
  const count = { m1: 5, m3: 14, m6: 27, y1: 54, y3: 160 }[win] || points.length;
  return points.slice(-count);
}

function normalizeSeries(series) {
  return series.map((item) => {
    const first = item.points[0]?.value || 1;
    return { ...item, points: item.points.map((point) => ({ ...point, value: (point.value / first) * 100 })) };
  });
}

function SimilarityPanel({ data, pair, setPair }) {
  const etfs = data.etfs;
  const a = etfs.find((etf) => etf.code === pair[0]) || etfs[0];
  const b = etfs.find((etf) => etf.code === pair[1]) || etfs[1] || etfs[0];
  const rows = similarityRows(a, b);
  const score = rows.reduce((sum, row) => sum + row.overlap, 0);
  const select = (idx) => el('select', { value: pair[idx], onChange: (event) => setPair(idx === 0 ? [event.target.value, pair[1]] : [pair[0], event.target.value]) },
    etfs.map((etf) => el('option', { key: etf.code, value: etf.code }, `${etf.code} ${etf.name}`))
  );
  return el('div', { className: 'panel' },
    el('div', { className: 'compare-row' }, select(0), el('span', null, 'vs'), select(1), el('b', { className: score > 45 ? 'up' : score > 20 ? 'warn' : 'muted' }, `相似度 ${fmtPct(score)}`)),
    el(SimpleTable, {
      columns: ['股票', `${a?.code} 權重`, `${b?.code} 權重`, '重疊權重'],
      rows: rows.slice(0, 20).map((row) => [row.name, fmtPct(row.aw), fmtPct(row.bw), fmtPct(row.overlap)]),
    })
  );
}

function similarityRows(a, b) {
  const aw = new Map((a?.holdings || []).map((item) => [item.code, item]));
  const bw = new Map((b?.holdings || []).map((item) => [item.code, item]));
  const codes = [...new Set([...aw.keys(), ...bw.keys()])];
  return codes.map((code) => {
    const x = aw.get(code);
    const y = bw.get(code);
    return {
      code,
      name: x?.name || y?.name || code,
      aw: x?.weight || 0,
      bw: y?.weight || 0,
      overlap: Math.min(x?.weight || 0, y?.weight || 0),
    };
  }).filter((row) => row.overlap > 0).sort((x, y) => y.overlap - x.overlap);
}

function FocusView({ data, onStock, onEtf }) {
  const moves = [];
  data.etfs.forEach((etf) => (etf.holdings || []).forEach((holding) => moves.push({ etf, holding })));
  const news = moves.filter((item) => item.holding.new).sort((a, b) => absMoney(b.holding) - absMoney(a.holding)).slice(0, 10);
  const clears = moves.filter((item) => item.holding.clear).sort((a, b) => absMoney(b.holding) - absMoney(a.holding)).slice(0, 10);
  const rebalances = data.etfs.map((etf) => ({ etf, n: (etf.holdings || []).filter((hld) => hld.new || hld.clear || Math.abs(hld.d1 || 0) > 0).length }))
    .filter((item) => item.n >= 4)
    .sort((a, b) => b.n - a.n)
    .slice(0, 8);
  const sync = Object.entries(data.stocks || {}).map(([code, stock]) => ({
    code,
    stock,
    n: (stock.holders || []).filter((hld) => hld.d1 > 0).length,
  })).filter((item) => item.n >= 2).sort((a, b) => b.n - a.n).slice(0, 8);

  return el('section', { className: 'focus-grid' },
    el(FocusPanel, { title: '今日新進', rows: news.map((item) => ({
      key: `${item.etf.code}-${item.holding.code}`,
      left: `${item.holding.name} (${item.holding.code})`,
      sub: item.etf.name,
      right: fmtMoney(item.holding.money),
      tone: 'up',
      onClick: () => onStock(item.holding.code),
    })) }),
    el(FocusPanel, { title: '今日出清', rows: clears.map((item) => ({
      key: `${item.etf.code}-${item.holding.code}`,
      left: `${item.holding.name} (${item.holding.code})`,
      sub: item.etf.name,
      right: fmtMoney(item.holding.money),
      tone: 'down',
      onClick: () => onStock(item.holding.code),
    })) }),
    el(FocusPanel, { title: '換股雷達', rows: rebalances.map((item) => ({
      key: item.etf.code,
      left: `${item.etf.code} ${item.etf.name}`,
      sub: '同日大量進出，可能正在調整持股結構',
      right: `${item.n} 筆`,
      onClick: () => onEtf(item.etf.code),
    })) }),
    el(FocusPanel, { title: '同步加碼', rows: sync.map((item) => ({
      key: item.code,
      left: `${item.stock.name} (${item.code})`,
      sub: '多檔 ETF 同日加碼',
      right: `${item.n} 檔`,
      tone: 'up',
      onClick: () => onStock(item.code),
    })) })
  );
}

function FocusPanel({ title, rows }) {
  return el('div', { className: 'panel' },
    el('div', { className: 'panel-title' }, el('h2', null, title)),
    rows.length ? el('div', { className: 'focus-list' }, rows.map((row) => el('button', { key: row.key, onClick: row.onClick },
      el('span', null, el('b', null, row.left), el('small', null, row.sub)),
      el('em', { className: row.tone }, row.right)
    ))) : el('div', { className: 'empty' }, '目前沒有符合條件的資料')
  );
}

function InstView({ active }) {
  const inst = useResource('data/inst.json', active, DEMO_INST);
  const [dir, setDir] = useState('buy');
  const [who, setWho] = useState('t');
  const [win, setWin] = useState('d1');
  const [scope, setScope] = useState('stock');
  const [query, setQuery] = useState('');
  const data = inst.data || DEMO_INST;
  const idx = { f: 4, t: 5, dl: 6, s: 7 }[who] ?? 5;
  const rows = (data.wins?.[win] || [])
    .map((row) => ({ code: row[0], name: row[1], price: row[2], chg: row[3], f: row[4], t: row[5], dl: row[6], s: row[7], amt: row[8], value: row[idx] }))
    .filter((row) => scope !== 'stock' || (/^\d{4}$/.test(row.code) && !row.code.startsWith('00')))
    .filter((row) => !query.trim() || `${row.code} ${row.name}`.toLowerCase().includes(query.trim().toLowerCase()))
    .filter((row) => dir === 'buy' ? row.value > 0 : row.value < 0)
    .sort((a, b) => dir === 'buy' ? b.value - a.value : a.value - b.value)
    .slice(0, 100);

  return el('section', { className: 'stack' },
    el('div', { className: 'kpi-grid' },
      (data.summary || []).map((item) => kpi(`${item.k}買賣超`, fmtMoney(item.v), data.slash, tone(item.v))),
      kpi('期貨外資未平倉', fmtNum(data.report?.fx), `日變動 ${fmtNum(data.report?.fx_chg)}`, tone(data.report?.fx_chg))
    ),
    el('div', { className: 'toolbar panel' },
      el('input', { value: query, onChange: (event) => setQuery(event.target.value), placeholder: '搜尋法人買賣超股票' }),
      el('div', { className: 'segmented buy-sell' }, [['buy', '買超'], ['sell', '賣超']].map(([key, label]) => el('button', { key, className: dir === key ? 'on' : '', onClick: () => setDir(key) }, label))),
      el('div', { className: 'segmented' }, [['t', '投信'], ['f', '外資'], ['dl', '自營避險'], ['s', '自營商']].map(([key, label]) => el('button', { key, className: who === key ? 'on' : '', onClick: () => setWho(key) }, label))),
      el('div', { className: 'segmented' }, [['d1', '當日'], ['d5', '5日'], ['d20', '20日'], ['d60', '60日']].map(([key, label]) => el('button', { key, className: win === key ? 'on' : '', onClick: () => setWin(key) }, label))),
      el('div', { className: 'segmented' }, [['stock', '只看個股'], ['all', '含 ETF']].map(([key, label]) => el('button', { key, className: scope === key ? 'on' : '', onClick: () => setScope(key) }, label)))
    ),
    el('div', { className: 'panel table-wrap' },
      el('div', { className: 'panel-title' }, el('h2', null, '三大法人買賣超'), el('p', null, `資料日 ${data.slash || '—'} · 單位：張`)),
      el(SimpleTable, {
        columns: ['#', '股票', '價格/漲跌', '外資', '投信', '自營避險', '自營商', '估值'],
        rows: rows.map((row, index) => [
          index + 1,
          `${row.name} (${row.code})`,
          el('span', null, fmtNum(row.price, 2), el('small', { className: tone(row.chg) }, fmtPct(row.chg))),
          el('span', { className: tone(row.f) }, fmtNum(row.f)),
          el('span', { className: tone(row.t) }, fmtNum(row.t)),
          el('span', { className: tone(row.dl) }, fmtNum(row.dl)),
          el('span', { className: tone(row.s) }, fmtNum(row.s)),
          row.amt == null ? '—' : fmtMoney(row.amt),
        ]),
      })
    )
  );
}

function EventsView({ active }) {
  const dts = useResource('data/dts.json', active, DEMO_DTS);
  const events = useResource('data/events.json', active, DEMO_EVENTS);
  const zijie = useResource('data/zijie.json', active, DEMO_ZIJIE);
  const [tab, setTab] = useState('dts');
  const [query, setQuery] = useState('');
  const ev = events.data || DEMO_EVENTS;
  const tabs = [
    ['dts', '券差', dts.data?.rows?.length],
    ['bb', '庫藏股', ev.buyback?.length],
    ['dp', '處置股', ev.dispose?.length],
    ['tr', '申報轉讓', ev.transfer?.length],
    ['acq', '43-1取得', ev.acquire?.length],
    ['zj', '自結', zijie.data?.rows?.length],
    ['xd', '除權息', ev.xd?.length],
  ];
  return el('section', { className: 'stack' },
    el('div', { className: 'toolbar panel' },
      el('div', { className: 'segmented event-tabs' }, tabs.map(([key, label, count]) => el('button', { key, className: tab === key ? 'on' : '', onClick: () => setTab(key) }, `${label}${count != null ? ` ${count}` : ''}`))),
      el('input', { value: query, onChange: (event) => setQuery(event.target.value), placeholder: '搜尋股票、事件或公告文字' })
    ),
    el('div', { className: 'panel table-wrap' }, renderEventTable(tab, query, dts.data || DEMO_DTS, ev, zijie.data || DEMO_ZIJIE))
  );
}

function renderEventTable(tab, query, dts, ev, zijie) {
  const q = query.trim().toLowerCase();
  const has = (row) => !q || JSON.stringify(row).toLowerCase().includes(q);
  if (tab === 'dts') {
    const rows = (dts.rows || []).filter(has).sort((a, b) => ((b.lots || 0) * (b.price || 0)) - ((a.lots || 0) * (a.price || 0))).slice(0, 80);
    return el(React.Fragment, null,
      el('div', { className: 'panel-title' }, el('h2', null, '當沖券差借券'), el('p', null, `資料狀態：${dts.src || '—'} · 潛在買盤為標借張數乘收盤價估算`)),
      el(SimpleTable, { columns: ['#', '股票', '收盤/漲跌', '標借張數', '潛在買盤(萬)', '筆數', '最高費率', '券資比'], rows: rows.map((row, index) => [index + 1, `${row.n} (${row.c})`, el('span', null, fmtNum(row.price, 2), el('small', { className: tone(row.chg) }, fmtPct(row.chg))), fmtNum(row.lots), fmtNum((row.lots || 0) * (row.price || 0) / 10), fmtNum(row.cnt), fmtPct(row.mx), fmtPct(row.sr)]) })
    );
  }
  if (tab === 'bb') return eventSimple('庫藏股', ev.buyback, ['股票', '期間', '預定張數', '狀態', '原因'], (row) => [`${row.n} (${row.c})`, `${row.f} → ${row.t}`, fmtNum(row.lots), row.st, row.why], has);
  if (tab === 'dp') return eventSimple('處置股', ev.dispose, ['股票', '分盤', '處置起訖', '位階', '狀態'], (row) => [`${row.n} (${row.c})`, `${row.iv} 分`, `${row.f} → ${row.t}`, row.pos ?? '—', row.st], has);
  if (tab === 'tr') return eventSimple('申報轉讓', ev.transfer, ['股票', '身分', '原因', '張數', '狀態'], (row) => [`${row.n} (${row.c})`, row.role, row.way, fmtNum(row.lots), row.st], has);
  if (tab === 'acq') return eventSimple('43-1 大量取得', ev.acquire, ['標的', '取得人', '持股比例', '持股張數', '公告'], (row) => [`${row.n || row.tgt} (${row.tcode})`, row.who_short || row.who, fmtPct(row.pct), fmtNum(row.lots), row.url ? el('a', { href: row.url, target: '_blank', rel: 'noreferrer' }, '看公告') : '—'], has);
  if (tab === 'zj') return eventSimple('自結損益', zijie.rows, ['股票', '公告時間', '主旨', '月 EPS', '近四季 EPS'], (row) => [`${row.name} (${row.code})`, `${row.date_ce || row.date} ${row.time || ''}`, row.subject, row.eps_m ?? '—', row.eps_4q ?? '—'], has);
  return eventSimple('除權息', ev.xd, ['股票', '日期', '類型', '現金股利', '殖利率', '發放日'], (row) => [`${row.n} (${row.c})`, row.d, row.kind, row.cash ?? '—', fmtPct(row.yld), row.pay || '—'], has);
}

function eventSimple(title, sourceRows = [], columns, mapRow, predicate) {
  const rows = sourceRows.filter(predicate).slice(0, 100);
  return el(React.Fragment, null,
    el('div', { className: 'panel-title' }, el('h2', null, title)),
    el(SimpleTable, { columns: ['#', ...columns], rows: rows.map((row, index) => [index + 1, ...mapRow(row)]) })
  );
}

function EtfDrawer({ code, data, onClose, onStock, addPerf }) {
  const etf = data.etfs.find((item) => item.code === code);
  if (!etf) return null;
  const holdings = [...(etf.holdings || [])].sort((a, b) => (b.value || 0) - (a.value || 0));
  return el('div', { className: 'drawer-backdrop', onClick: onClose },
    el('aside', { className: 'drawer', onClick: (event) => event.stopPropagation() },
      el('div', { className: 'drawer-head' },
        el('div', null, el('span', { className: 'hint-pill' }, isActiveEtf(etf) ? '主動式 ETF' : 'ETF'), el('h2', null, `${etf.code} ${etf.name}`), el('p', null, `${etf.info?.co || '投信'} · ${etf.info?.etype || 'ETF'} · ${ymdSlash(etf.date)}`)),
        el('button', { className: 'icon-action', onClick: onClose }, '×')
      ),
      el('div', { className: 'kpi-grid drawer-kpis' },
        kpi('規模', `${fmtNum(etf.scale, 1)} 億`),
        kpi('持股淨買賣', fmtMoney(etf.net), null, tone(etf.net)),
        kpi('殖利率', fmtPct(etf.yld)),
        kpi('年化報酬', fmtPct(etf.ret?.ann), etf.ret?.since ? `上市 ${ymdSlash(etf.ret.since)}` : null)
      ),
      el('div', { className: 'drawer-actions' },
        el('button', { className: 'primary-btn', onClick: () => addPerf(etf.code) }, '加入績效比較'),
        etf.info?.idx ? el('span', null, `追蹤指數：${etf.info.idx}`) : el('span', null, '主動式策略：持股調整需觀察換股與資金方向')
      ),
      el(SimpleTable, {
        columns: ['持股', '權重', '庫存張數', '今日增減', '估值', '漲跌'],
        rows: holdings.map((holding) => [
          el('button', { className: 'linklike', onClick: () => onStock(holding.code) }, `${holding.name} (${holding.code})`),
          fmtPct(holding.weight),
          fmtNum(holding.lots),
          el('span', { className: tone(holding.d1) }, `${Number(holding.d1) > 0 ? '+' : ''}${fmtNum(holding.d1)} 張`),
          fmtMoney(holding.money),
          el('span', { className: tone(holding.chg) }, fmtPct(holding.chg)),
        ]),
      })
    )
  );
}

function SimpleTable({ columns, rows }) {
  return el('table', { className: 'data-table' },
    el('thead', null, el('tr', null, columns.map((column) => el('th', { key: String(column) }, column)))),
    el('tbody', null,
      rows.length ? rows.map((row, index) => el('tr', { key: index }, row.map((cell, cellIndex) => el('td', { key: cellIndex, className: cellIndex === 0 || cellIndex === 1 ? 'left' : undefined }, cell))))
        : el('tr', null, el('td', { colSpan: columns.length, className: 'empty' }, '查無資料'))
    )
  );
}

function InteractiveLineChart({ series, height = 240, valueSuffix = '', baseline = null }) {
  const width = 860;
  const pad = 38;
  const [hoverRatio, setHoverRatio] = useState(null);
  const all = series.flatMap((item) => item.points || []);
  if (!all.length) return null;
  const values = baseline == null ? all.map((item) => item.value) : [...all.map((item) => item.value), baseline];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const yMin = min === max ? min - 1 : min;
  const yMax = min === max ? max + 1 : max;
  const ratio = hoverRatio == null ? 1 : hoverRatio;
  const xForRatio = (nextRatio) => pad + nextRatio * (width - pad * 2);
  const xFor = (points, index) => xForRatio(index / Math.max(points.length - 1, 1));
  const yFor = (value) => height - pad - ((value - yMin) / Math.max(yMax - yMin, 1)) * (height - pad * 2);
  const hoverX = xForRatio(ratio);
  const readout = series.map((item) => {
    const points = item.points || [];
    const index = Math.max(0, Math.min(points.length - 1, Math.round(ratio * Math.max(points.length - 1, 0))));
    return { ...item, point: points[index], index };
  }).filter((item) => item.point);
  const activeDate = readout[0]?.point?.date;
  const handlePointerMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const next = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(rect.width, 1)));
    setHoverRatio(next);
  };

  return el('div', { className: 'chart-wrap interactive-chart' },
    el('svg', {
      viewBox: `0 0 ${width} ${height}`,
      role: 'img',
      tabIndex: 0,
      onPointerMove: handlePointerMove,
      onPointerLeave: () => setHoverRatio(null),
      onFocus: () => setHoverRatio(1),
      onKeyDown: (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        setHoverRatio((current) => Math.max(0, Math.min(1, (current ?? 1) + (event.key === 'ArrowLeft' ? -0.025 : 0.025))));
      },
    },
      el('line', { x1: pad, x2: width - pad, y1: height - pad, y2: height - pad, className: 'axis' }),
      el('line', { x1: pad, x2: pad, y1: pad, y2: height - pad, className: 'axis' }),
      baseline == null ? null : el('line', { x1: pad, x2: width - pad, y1: yFor(baseline), y2: yFor(baseline), className: 'baseline' }),
      series.map((item) => {
        const points = item.points || [];
        const d = points.map((point, index) => `${index ? 'L' : 'M'}${xFor(points, index).toFixed(1)},${yFor(point.value).toFixed(1)}`).join(' ');
        return el('path', { key: item.name, d, fill: 'none', stroke: item.color, strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round' });
      }),
      el('line', { x1: hoverX, x2: hoverX, y1: pad, y2: height - pad, className: 'crosshair' }),
      readout.map((item) => el('circle', {
        key: `${item.name}-${item.index}`,
        cx: xFor(item.points || [], item.index),
        cy: yFor(item.point.value),
        r: 4.5,
        fill: item.color,
        stroke: '#fff',
        strokeWidth: 2,
      }))
    ),
    el('div', { className: 'chart-readout' },
      el('strong', null, activeDate ? ymdSlash(activeDate) : '最新'),
      readout.map((item) => el('span', { key: item.name },
        el('i', { style: { background: item.color } }),
        `${item.name} ${fmtNum(item.point.value, 2)}${valueSuffix}`
      ))
    ),
    el('div', { className: 'legend' }, series.map((item) => el('span', { key: item.name }, el('i', { style: { background: item.color } }), item.name)))
  );
}

function App() {
  const dataState = usePrimaryData();
  const sectorState = useSectorData();
  const data = dataState.data;
  const [tab, setTab] = useState('flow');
  const [selectedEtf, setSelectedEtf] = useState(null);
  const [stockCode, setStockCode] = useState('');
  const [perfCodes, setPerfCodes] = useState(['0050', '00878', '00919', '00981A']);
  const openEtf = (code) => setSelectedEtf(code);
  const openStock = (code) => {
    setStockCode(code);
    setTab('stock');
  };
  const addPerf = (code) => {
    setPerfCodes((current) => current.includes(code) ? current : [...current, code].slice(0, 8));
    setTab('perf');
  };

  return el(React.Fragment, null,
    el('main', { className: 'app-shell' },
      el(Header, { dataState, activeTab: tab, onTab: setTab }),
      tab === 'flow' ? el(React.Fragment, null,
        el(MarketHeatPanel, { sectorState }),
        el(FlowOverview, { data, onEtf: openEtf, onStock: openStock })
      ) : null,
      tab === 'active' ? el(ActiveMoves, { data, onEtf: openEtf }) : null,
      tab === 'etf' ? el(EtfOverview, { data, onEtf: openEtf }) : null,
      tab === 'rank' ? el(RankView, { data, onStock: openStock }) : null,
      tab === 'inst' ? el(InstView, { active: tab === 'inst' }) : null,
      tab === 'stock' ? el(StockLookup, { data, initialCode: stockCode, onEtf: openEtf }) : null,
      tab === 'perf' ? el(PerformanceView, { data, perfCodes, setPerfCodes }) : null,
      tab === 'focus' ? el(FocusView, { data, onStock: openStock, onEtf: openEtf }) : null,
      tab === 'events' ? el(EventsView, { active: tab === 'events' }) : null,
      el('footer', null, '本工具整合 ETF 持股、法人籌碼與市場事件，資料僅供研究與流程展示，不構成投資建議。')
    ),
    el(EtfDrawer, { code: selectedEtf, data, onClose: () => setSelectedEtf(null), onStock: openStock, addPerf })
  );
}

createRoot(document.getElementById('root')).render(el(App));
