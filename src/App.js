import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { STOCK_NAMES, STOCK_TO_SECTORS } from './data/sectors.mjs?v=10';
import { CATEGORY_META, classifySector, flowColor } from './lib/market-data.mjs?v=10';

const h = React.createElement;
const cats = ['green', 'yellow', 'gray', 'red'];
const fmtYi = (value, digits = 1) => `${value >= 0 ? '+' : ''}${Number(value || 0).toFixed(digits)} 億`;
const fmtPct = (value, digits = 1) => `${value >= 0 ? '+' : ''}${Number(value || 0).toFixed(digits)}%`;

function useSectorData() {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const load = async (refresh = false) => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const response = await fetch(`/api/sector-rotation?date=latest&refresh=${refresh ? 1 : 0}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || payload.error || `HTTP ${response.status}`);
      setState({ data: payload, loading: false, error: null });
    } catch (error) {
      try {
        const staticResponse = await fetch(`/data/latest.json?ts=${refresh ? Date.now() : ''}`, { cache: refresh ? 'reload' : 'default' });
        if (!staticResponse.ok) throw error;
        const payload = await staticResponse.json();
        setState({ data: { ...payload, cache: { hit: true, stale: false, static: true } }, loading: false, error: null });
      } catch {
        setState((current) => ({ ...current, loading: false, error: error.message }));
      }
    }
  };
  useEffect(() => {
    load(false);
  }, []);
  return { ...state, refresh: () => load(true) };
}

function useInstallPrompt() {
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(window.matchMedia('(display-mode: standalone)').matches);
  useEffect(() => {
    const onPrompt = (event) => {
      event.preventDefault();
      setPrompt(event);
    };
    const onInstalled = () => {
      setPrompt(null);
      setInstalled(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  const install = async () => {
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  };
  return { canInstall: Boolean(prompt), installed, install };
}

function Header({ data, loading, onRefresh }) {
  const pwa = useInstallPrompt();
  return h('header', { className: 'top-shell glass' },
    h('div', { className: 'brand' },
      h('div', { className: 'brand-mark' }, 'SR'),
      h('div', null,
        h('h1', null, '台股板塊溫度計'),
        h('p', null, data ? `資料日期 ${data.date} · 更新 ${new Date(data.updatedAt).toLocaleString('zh-TW', { hour12: false })}` : '載入官方盤後資料')
      )
    ),
    h('div', { className: 'header-actions' },
      data?.cache?.stale ? h('span', { className: 'pill warn' }, '快取資料') : null,
      data ? h('span', { className: `pill ${data.marketChg1d >= 0 ? 'up' : 'down'}` }, `加權 ${fmtPct(data.marketChg1d, 2)}`) : null,
      h('button', { className: 'icon-btn', onClick: onRefresh, disabled: loading, title: '重新整理' }, loading ? '↻' : '⟳'),
      h('button', { className: 'install-btn', onClick: pwa.install, disabled: !pwa.canInstall || pwa.installed },
        pwa.installed ? 'PWA 已安裝' : pwa.canInstall ? '安裝 PWA' : 'PWA Ready'
      )
    )
  );
}

function StatusCards({ sectors, activeCats, onToggle }) {
  const counts = useMemo(() => {
    const out = Object.fromEntries(cats.map((cat) => [cat, 0]));
    for (const sector of sectors) out[classifySector(sector)] += 1;
    return out;
  }, [sectors]);
  return h('section', { className: 'status-grid' },
    cats.map((cat) => {
      const meta = CATEGORY_META[cat];
      const active = activeCats.has(cat);
      return h('button', {
        key: cat,
        className: `status-card glass ${active ? 'active' : 'muted'}`,
        style: { '--accent': meta.color },
        onClick: () => onToggle(cat),
      },
        h('span', { className: 'status-dot' }),
        h('span', { className: 'status-label' }, meta.label),
        h('strong', null, counts[cat]),
        h('small', null, meta.sub)
      );
    })
  );
}

function SearchBox({ sectors, onSelect }) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const seen = new Set();
    const out = [];
    for (const sector of sectors) {
      if (sector.name.toLowerCase().includes(q)) {
        seen.add(sector.name);
        out.push({ key: sector.name, label: sector.name, tag: '板塊', sector });
      }
    }
    for (const [code, name] of Object.entries(STOCK_NAMES)) {
      if (!code.includes(q) && !String(name).toLowerCase().includes(q) && !String(name).includes(query.trim())) continue;
      for (const sectorName of STOCK_TO_SECTORS[code] || []) {
        const sector = sectors.find((item) => item.name === sectorName);
        const key = `${code}-${sectorName}`;
        if (!sector || seen.has(key)) continue;
        seen.add(key);
        out.push({ key, label: `${code} ${name || ''}`.trim(), tag: sectorName, sector });
      }
    }
    return out.slice(0, 12);
  }, [query, sectors]);

  return h('div', { className: 'search glass' },
    h('span', { className: 'search-icon' }, '⌕'),
    h('input', {
      value: query,
      onChange: (event) => setQuery(event.target.value),
      placeholder: '搜尋股票或板塊',
      autoComplete: 'off',
    }),
    results.length ? h('div', { className: 'search-menu' },
      results.map((item) => h('button', {
        key: item.key,
        onMouseDown: (event) => {
          event.preventDefault();
          setQuery('');
          onSelect(item.sector);
        },
      },
        h('span', null, item.label),
        h('small', null, item.tag)
      ))
    ) : query.trim() ? h('div', { className: 'search-menu empty' }, '沒有符合的板塊') : null
  );
}

const heatmapMetrics = [
  { key: 'net_1d_yi', label: '1日買超', kind: 'flow', digits: 1 },
  { key: 'net_5d_yi', label: '5日買超', kind: 'flow', digits: 1 },
  { key: 'net_20d_yi', label: '20日買超', kind: 'flow', digits: 0 },
  { key: 'accel', label: '加速度', kind: 'flow', digits: 1 },
  { key: 'chg_5d', label: '5日漲跌', kind: 'pct', digits: 1 },
];

function metricText(value, metric) {
  return metric.kind === 'pct' ? fmtPct(value, metric.digits) : fmtYi(value, metric.digits);
}

function metricHeatStyle(value, maxAbs) {
  const intensity = Math.min(1, Math.abs(value) / Math.max(maxAbs, 1));
  const rgb = value >= 0 ? '255, 59, 48' : '52, 199, 89';
  return {
    color: value >= 0 ? CATEGORY_META.green.color : CATEGORY_META.red.color,
    '--heat-bg': `rgba(${rgb}, ${0.05 + intensity * 0.18})`,
    '--heat-bar': `rgba(${rgb}, ${0.5 + intensity * 0.35})`,
    '--heat-width': `${Math.max(7, intensity * 100)}%`,
  };
}

function HeatmapPanel({ sectors, activeCats, onSelect }) {
  const [sortKey, setSortKey] = useState('net_5d_yi');
  const visible = useMemo(() => {
    return sectors
      .filter((sector) => activeCats.has(classifySector(sector)))
      .sort((a, b) => (b[sortKey] ?? 0) - (a[sortKey] ?? 0));
  }, [activeCats, sectors, sortKey]);
  const maxByMetric = useMemo(() => {
    const out = {};
    for (const metric of heatmapMetrics) {
      out[metric.key] = Math.max(...sectors.map((sector) => Math.abs(sector[metric.key] ?? 0)), 1);
    }
    return out;
  }, [sectors]);
  const leaders = useMemo(() => {
    const by = (key, direction = 'desc') => [...sectors].sort((a, b) => direction === 'desc' ? b[key] - a[key] : a[key] - b[key])[0];
    return [
      { label: '5日買超最強', metric: heatmapMetrics[1], sector: by('net_5d_yi') },
      { label: '加速度最強', metric: heatmapMetrics[3], sector: by('accel') },
      { label: '流出最大', metric: heatmapMetrics[1], sector: by('net_5d_yi', 'asc') },
    ].filter((item) => item.sector);
  }, [sectors]);

  return h('section', { className: 'heatmap-card glass' },
    h('div', { className: 'view-head' },
      h('div', null,
        h('strong', null, '板塊熱力圖'),
        h('span', null, `${visible.length} / ${sectors.length} 板塊 · 點列可看成分股`)
      )
    ),
    h('div', { className: 'signal-strip' },
      leaders.map(({ label, metric, sector }) => {
        const cat = classifySector(sector);
        const value = sector[metric.key] ?? 0;
        return h('button', { key: label, className: 'signal-card', onClick: () => onSelect(sector), style: { '--accent': CATEGORY_META[cat].color } },
          h('span', null, label),
          h('strong', null, sector.name),
          h('small', { style: { color: flowColor(value) } }, metricText(value, metric))
        );
      })
    ),
    h('div', { className: 'heatmap-tools' },
      h('span', null, '排序'),
      heatmapMetrics.map((metric) => h('button', {
        key: metric.key,
        className: sortKey === metric.key ? 'active' : '',
        onClick: () => setSortKey(metric.key),
      }, metric.label))
    ),
    h('div', { className: 'heatmap-grid', role: 'table' },
      h('div', { className: 'heatmap-row heatmap-header', role: 'row' },
        h('span', null, '板塊'),
        heatmapMetrics.map((metric) => h('span', { key: metric.key }, metric.label)),
        h('span', null, '狀態')
      ),
      visible.map((sector) => {
        const cat = classifySector(sector);
        return h('button', { key: sector.name, className: 'heatmap-row', role: 'row', onClick: () => onSelect(sector) },
          h('span', { className: 'heatmap-name' },
            h('i', { style: { background: CATEGORY_META[cat].color } }),
            h('strong', null, sector.name)
          ),
          heatmapMetrics.map((metric) => {
            const value = sector[metric.key] ?? 0;
            return h('span', {
              key: metric.key,
              className: 'heat-cell',
              style: metricHeatStyle(value, maxByMetric[metric.key]),
            }, metricText(value, metric));
          }),
          h('span', { className: 'heat-status', style: { color: CATEGORY_META[cat].color, borderColor: CATEGORY_META[cat].color } }, CATEGORY_META[cat].label)
        );
      })
    )
  );
}

function RankingPanel({ data, onSelect }) {
  const [mode, setMode] = useState('cp');
  const sectors = data.sectors;
  const bottomCount = sectors.filter((sector) => sector.is_bottom_fishing).length;
  const rows = useMemo(() => {
    if (mode === 'bottom') {
      return sectors
        .filter((sector) => sector.is_bottom_fishing)
        .sort((a, b) => b.bottom_score - a.bottom_score)
        .slice(0, 10);
    }
    return sectors
      .filter((sector) => classifySector(sector) === 'green')
      .map((sector) => ({ ...sector, cp: sector.net_5d_yi * (1 - sector.chg_5d / 100) }))
      .sort((a, b) => b.cp - a.cp)
      .slice(0, 10);
  }, [mode, sectors]);
  const max = Math.max(...rows.map((row) => Math.abs(mode === 'bottom' ? row.bottom_score : row.net_5d_yi)), 1);
  return h('aside', { className: 'ranking glass' },
    h('div', { className: 'panel-headline' },
      h('div', null, h('strong', null, '排行'), h('span', null, mode === 'cp' ? '價量背離' : '逆勢買超')),
      h('div', { className: 'segmented' },
        h('button', { className: mode === 'cp' ? 'active' : '', onClick: () => setMode('cp') }, 'CP'),
        h('button', { className: mode === 'bottom' ? 'active' : '', onClick: () => setMode('bottom') }, `逆勢 ${bottomCount || ''}`)
      )
    ),
    rows.length ? h('div', { className: 'ranking-list' },
      rows.map((sector, index) => {
        const cat = classifySector(sector);
        const value = mode === 'bottom' ? sector.net_1d_yi : sector.net_5d_yi;
        const bar = Math.min(100, Math.abs(mode === 'bottom' ? sector.bottom_score : sector.net_5d_yi) / max * 100);
        return h('button', { key: sector.name, className: 'ranking-row', onClick: () => onSelect(sector) },
          h('span', { className: 'rank-num' }, index + 1),
          h('span', { className: 'rank-dot', style: { background: CATEGORY_META[cat].color } }),
          h('span', { className: 'rank-name' }, sector.name),
          h('span', { className: 'rank-pct', style: { color: sector.chg_5d >= 0 ? CATEGORY_META.green.color : CATEGORY_META.red.color } }, fmtPct(mode === 'bottom' ? sector.chg_1d : sector.chg_5d, 1)),
          h('span', { className: 'rank-flow', style: { color: flowColor(value) } }, fmtYi(value, 1)),
          h('span', { className: 'rank-bar' }, h('i', { style: { width: `${bar}%`, background: CATEGORY_META[cat].color } }))
        );
      })
    ) : h('div', { className: 'empty-panel' }, mode === 'bottom' ? '目前沒有逆勢買超訊號' : '目前沒有升溫板塊')
  );
}

function SectorDrawer({ sector, data, onClose }) {
  if (!sector) return null;
  const cat = classifySector(sector);
  const meta = CATEGORY_META[cat];
  const stockData = data.stockData || {};
  return h('div', { className: 'drawer-backdrop', onClick: onClose },
    h('aside', { className: 'drawer glass', onClick: (event) => event.stopPropagation() },
      h('div', { className: 'drawer-head' },
        h('div', null,
          h('span', { className: 'drawer-badge', style: { color: meta.color, borderColor: meta.color } }, meta.label),
          h('h2', null, sector.name)
        ),
        h('button', { className: 'icon-btn', onClick: onClose, title: '關閉' }, '×')
      ),
      h('div', { className: 'metric-grid' },
        h('div', null, h('small', null, '當日'), h('strong', { style: { color: flowColor(sector.net_1d_yi) } }, fmtYi(sector.net_1d_yi, 2))),
        h('div', null, h('small', null, '近 5 日'), h('strong', { style: { color: flowColor(sector.net_5d_yi) } }, fmtYi(sector.net_5d_yi, 2))),
        h('div', null, h('small', null, '近 20 日'), h('strong', { style: { color: flowColor(sector.net_20d_yi) } }, fmtYi(sector.net_20d_yi, 2))),
        h('div', null, h('small', null, '加速度'), h('strong', { style: { color: flowColor(sector.accel) } }, `${sector.accel >= 0 ? '+' : ''}${sector.accel.toFixed(2)}`)),
        h('div', null, h('small', null, '1 日漲跌'), h('strong', { style: { color: sector.chg_1d >= 0 ? CATEGORY_META.green.color : CATEGORY_META.red.color } }, fmtPct(sector.chg_1d, 2))),
        h('div', null, h('small', null, '5 日漲跌'), h('strong', { style: { color: sector.chg_5d >= 0 ? CATEGORY_META.green.color : CATEGORY_META.red.color } }, fmtPct(sector.chg_5d, 2)))
      ),
      h('div', { className: 'stock-table' },
        h('div', { className: 'stock-row head' }, h('span', null, '代碼'), h('span', null, '名稱'), h('span', null, '漲跌'), h('span', null, '買超')),
        sector.stocks.map((code) => {
          const item = stockData[code];
          return h('div', { className: 'stock-row', key: code },
            h('span', null, code),
            h('span', null, item?.name || STOCK_NAMES[code] || '—'),
            h('span', { style: { color: item ? (item.chg_1d >= 0 ? CATEGORY_META.green.color : CATEGORY_META.red.color) : undefined } }, item ? fmtPct(item.chg_1d, 2) : '—'),
            h('span', { style: { color: item ? flowColor(item.net_1d_yi) : undefined } }, item ? fmtYi(item.net_1d_yi, 2) : '—')
          );
        })
      )
    )
  );
}

function SourceStrip({ data }) {
  return h('div', { className: 'source-strip glass' },
    data.sourceStatus.map((item) => h('span', { key: item.source, className: item.ok ? 'ok' : 'bad' },
      `${item.source} ${item.ok ? item.lastOkDate || item.okCount : 'failed'}`
    ))
  );
}

function App() {
  const { data, loading, error, refresh } = useSectorData();
  const [activeCats, setActiveCats] = useState(new Set(cats));
  const [selected, setSelected] = useState(null);
  const sectors = data?.sectors || [];
  const toggleCat = (cat) => {
    setActiveCats((current) => {
      if (current.size === 1 && current.has(cat)) return new Set(cats);
      return new Set([cat]);
    });
  };

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  return h(React.Fragment, null,
    h('main', { className: 'app-shell' },
      h(Header, { data, loading, onRefresh: refresh }),
      error ? h('div', { className: 'error glass' }, error) : null,
      !data ? h('div', { className: 'loading glass' }, loading ? '正在載入官方資料…' : '沒有資料') : h(React.Fragment, null,
        h('section', { className: 'utility-row' },
          h(SearchBox, { sectors, onSelect: setSelected }),
          h(SourceStrip, { data })
        ),
        h(StatusCards, { sectors, activeCats, onToggle: toggleCat }),
        h('section', { className: 'bento-layout' },
          h(HeatmapPanel, { sectors, activeCats, onSelect: setSelected }),
          h(RankingPanel, { data, onSelect: setSelected })
        ),
        h('footer', { className: 'disclaimer' }, '本網站僅彙整公開之三大法人買賣超資料，僅供參考，不構成任何投資建議；投資人應自行判斷並自負盈虧。')
      )
    ),
    h(SectorDrawer, { sector: selected, data: data || {}, onClose: () => setSelected(null) })
  );
}

createRoot(document.getElementById('root')).render(h(App));
