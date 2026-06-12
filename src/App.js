import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { STOCK_NAMES, STOCK_TO_SECTORS } from './data/sectors.mjs';
import { CATEGORY_META, classifySector, flowColor } from './lib/market-data.mjs';

const base = import.meta.env?.BASE_URL || '/';

const h = React.createElement;
const cats = ['green', 'yellow', 'gray', 'red'];
const fmtYi = (value, digits = 1) => `${value >= 0 ? '+' : ''}${Number(value || 0).toFixed(digits)} 億`;
const fmtPct = (value, digits = 1) => `${value > 0 ? '+' : ''}${Number(value || 0).toFixed(digits)}%`;
const pctColor = (value) => value > 0 ? CATEGORY_META.green.color : value < 0 ? CATEGORY_META.red.color : CATEGORY_META.gray.color;

function useSectorData() {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const load = async (refresh = false) => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const response = await fetch(`${base}api/sector-rotation?date=latest&refresh=${refresh ? 1 : 0}`);
      if (!response.ok) throw new Error(`API HTTP ${response.status}`);
      const payload = await response.json();
      setState({ data: payload, loading: false, error: null });
    } catch (apiError) {
      try {
        const staticResponse = await fetch(`${base}data/latest.json?ts=${Date.now()}`, { cache: 'no-store' });
        if (!staticResponse.ok) throw new Error(`Static fallback failed: HTTP ${staticResponse.status}`);
        const payload = await staticResponse.json();
        setState({ data: { ...payload, cache: { hit: true, stale: false, static: true } }, loading: false, error: null });
      } catch (fallbackError) {
        setState((current) => ({ ...current, loading: false, error: fallbackError.message }));
      }
    }
  };
  useEffect(() => {
    load(false);
  }, []);
  return { ...state, refresh: () => load(true) };
}

function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true);

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
      alert('在 iPhone/iPad 上安裝：\n請點擊瀏覽器底部的「分享」按鈕（正方形往上的箭頭），然後滑動選擇「加入主畫面」。');
    } else {
      alert('您的瀏覽器目前無法自動觸發安裝提示。\n可能原因：\n1. 您已安裝過本 APP（請檢查桌面或應用程式清單）。\n2. 您正在使用無痕模式（無痕模式不支援安裝）。\n3. 網頁暫存未更新（請嘗試清除暫存後重整）。\n\n您可以嘗試從瀏覽器選單中手動尋找「安裝應用程式」或「加到主畫面」的選項。');
    }
  };
  return { canInstall: Boolean(deferredPrompt), isIOS, isStandalone, install: handleInstallClick };
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
      !pwa.isStandalone && h('button', { className: 'install-btn', onClick: pwa.install },
        pwa.isIOS ? '🍎 加到主畫面' : '加到主畫面'
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
  { key: 'accel', label: '加熱/冷卻', kind: 'flow', digits: 1 },
  { key: 'chg_5d', label: '5日漲跌', kind: 'pct', digits: 1 },
];

const sortOptions = [
  { key: 'net_1d_yi', dir: 'desc', label: '1日買超' },
  { key: 'net_1d_yi', dir: 'asc', label: '1日賣超' },
  { key: 'net_5d_yi', dir: 'desc', label: '5日買超' },
  { key: 'net_5d_yi', dir: 'asc', label: '5日賣超' },
  { key: 'net_20d_yi', dir: 'desc', label: '20日買超' },
  { key: 'net_20d_yi', dir: 'asc', label: '20日賣超' },
  { key: 'accel', dir: 'desc', label: '加熱' },
  { key: 'accel', dir: 'asc', label: '冷卻' },
  { key: 'chg_5d', dir: 'desc', label: '5日漲跌' },
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
  const [sortParam, setSortParam] = useState({ key: 'net_5d_yi', dir: 'desc' });
  const visible = useMemo(() => {
    return sectors
      .filter((sector) => activeCats.has(classifySector(sector)))
      .sort((a, b) => {
        const valA = a[sortParam.key] ?? 0;
        const valB = b[sortParam.key] ?? 0;
        return sortParam.dir === 'desc' ? valB - valA : valA - valB;
      });
  }, [activeCats, sectors, sortParam]);
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
      sortOptions.map((opt) => h('button', {
        key: opt.label,
        className: sortParam.key === opt.key && sortParam.dir === opt.dir ? 'active' : '',
        onClick: () => setSortParam({ key: opt.key, dir: opt.dir }),
      }, opt.label))
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
          h('span', { className: 'rank-pct', style: { color: pctColor(mode === 'bottom' ? sector.chg_1d : sector.chg_5d) } }, fmtPct(mode === 'bottom' ? sector.chg_1d : sector.chg_5d, 1)),
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
  const quotedCount = sector.stocks.filter((code) => stockData[code]?.quoteStatus === 'ok' || stockData[code]?.price != null).length;
  return h('div', { className: 'drawer-backdrop', onClick: onClose },
    h('aside', { className: 'drawer glass', onClick: (event) => event.stopPropagation() },
      h('div', { className: 'drawer-head' },
        h('div', null,
          h('span', { className: 'drawer-badge', style: { color: meta.color, borderColor: meta.color } }, meta.label),
          h('h2', null, sector.name),
          h('p', { className: 'quote-coverage' }, `官方報價 ${quotedCount} / ${sector.stocks.length}`)
        ),
        h('button', { className: 'icon-btn', onClick: onClose, title: '關閉' }, '×')
      ),
      h('div', { className: 'metric-grid' },
        h('div', null, h('small', null, '當日'), h('strong', { style: { color: flowColor(sector.net_1d_yi) } }, fmtYi(sector.net_1d_yi, 2))),
        h('div', null, h('small', null, '近 5 日'), h('strong', { style: { color: flowColor(sector.net_5d_yi) } }, fmtYi(sector.net_5d_yi, 2))),
        h('div', null, h('small', null, '近 20 日'), h('strong', { style: { color: flowColor(sector.net_20d_yi) } }, fmtYi(sector.net_20d_yi, 2))),
        h('div', null, h('small', null, '加速度'), h('strong', { style: { color: flowColor(sector.accel) } }, `${sector.accel > 0 ? '+' : ''}${sector.accel.toFixed(2)}`)),
        h('div', null, h('small', null, '1 日漲跌'), h('strong', { style: { color: pctColor(sector.chg_1d) } }, fmtPct(sector.chg_1d, 2))),
        h('div', null, h('small', null, '5 日漲跌'), h('strong', { style: { color: pctColor(sector.chg_5d) } }, fmtPct(sector.chg_5d, 2)))
      ),
      h('div', { className: 'stock-table' },
        h('div', { className: 'stock-row head' }, h('span', null, '代碼'), h('span', null, '名稱'), h('span', null, '股價'), h('span', null, '漲跌'), h('span', null, '買超')),
        sector.stocks.map((code) => {
          const item = stockData[code];
          const hasQuote = item?.quoteStatus === 'ok' || item?.price != null;
          return h('div', { className: 'stock-row', key: code },
            h('span', null, code),
            h('span', null, item?.name || STOCK_NAMES[code] || '—'),
            h('span', { className: hasQuote ? '' : 'quote-missing' }, hasQuote ? item.price : '無報價'),
            h('span', { style: { color: hasQuote ? pctColor(item.chg_1d) : undefined } }, hasQuote ? fmtPct(item.chg_1d, 2) : '—'),
            h('span', { style: { color: hasQuote ? flowColor(item.net_1d_yi) : undefined } }, hasQuote ? fmtYi(item.net_1d_yi, 2) : '—')
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
    if ('serviceWorker' in navigator) navigator.serviceWorker.register(`${base}sw.js`).catch(() => {});
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
