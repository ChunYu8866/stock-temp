import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { STOCK_NAMES, STOCK_TO_SECTORS } from './data/sectors.mjs';
import { CATEGORY_META, classifySector, flowColor } from './lib/market-data.mjs';

const base = import.meta.env?.BASE_URL || '/';

const h = React.createElement;
const cats = ['green', 'yellow', 'gray', 'red'];
const fmtYi = (value, digits = 1) => `${value >= 0 ? '+' : ''}${Number(value || 0).toFixed(digits)} 億`;
const fmtPct = (value, digits = 1) => `${value > 0 ? '+' : ''}${Number(value || 0).toFixed(digits)}%`;
const fmtPrice = (value) => Number(value).toLocaleString('zh-TW', { maximumFractionDigits: 2 });
const pctColor = (value) => value > 0 ? CATEGORY_META.green.color : value < 0 ? CATEGORY_META.red.color : CATEGORY_META.gray.color;
const SOURCE_LABELS = {
  'merged-quotes': '股價補齊',
  'twse-mis': '即時股價',
  'official-daily-quotes': '官方補價',
  'yahoo-chart': 'Yahoo補價',
  'twse-price': '上市收盤價',
  'twse-chip': '上市法人資金',
  'tpex-price': '上櫃收盤價',
  'tpex-chip': '上櫃法人資金',
  'twse-index': '大盤漲跌',
};
const GLOSSARY_STORAGE_KEY = 'sector-temperature-glossary-v1';
const TERM_GLOSSARY = [
  { term: '熱區', desc: '法人資金明顯流入的族群，紅色越深代表買超金額越大。' },
  { term: '冷區', desc: '法人資金明顯流出的族群，綠色越深代表賣超金額越大。' },
  { term: '資金流向', desc: '把三大法人買超或賣超換算成億元，方便比較不同族群。' },
  { term: '升溫', desc: '近 5 日資金流入，而且流入力道比 20 日平均更強。' },
  { term: '恆溫', desc: '近 5 日仍是資金流入，但加速力道沒有變強。' },
  { term: '低溫', desc: '資金接近中性，沒有明顯流入或流出。' },
  { term: '降溫', desc: '近 5 日資金流出，代表族群轉弱或被法人調節。' },
  { term: '資金加速度', desc: '近 5 日每日平均資金，減去近 20 日每日平均資金。' },
  { term: '蓄勢', desc: '資金流入排名靠前，但股價漲幅還不算大。' },
  { term: '逆勢轉強', desc: '大盤偏弱時，仍有法人資金流入的族群。' },
];

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

function useRealtimeQuotes(data) {
  const [state, setState] = useState({ quotes: {}, status: null, updatedAt: null, disabled: false, error: null });
  useEffect(() => {
    if (!data?.stockData) return undefined;
    const codes = Object.keys(data.stockData);
    if (!codes.length) return undefined;
    let cancelled = false;
    let timer = null;

    const load = async () => {
      try {
        const response = await fetch(`${base}api/realtime-quotes?codes=${encodeURIComponent(codes.join(','))}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Realtime HTTP ${response.status}`);
        const payload = await response.json();
        if (cancelled) return;
        setState({
          quotes: payload.quotes || {},
          status: payload.sourceStatus?.[0] || null,
          updatedAt: payload.updatedAt || null,
          disabled: false,
          error: null,
        });
      } catch (error) {
        if (cancelled) return;
        setState((current) => ({ ...current, disabled: true, error: error.message }));
        if (timer) clearInterval(timer);
      }
    };

    load();
    timer = setInterval(load, 30000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [data?.date, data?.updatedAt]);
  return state;
}

function mergeRealtimeData(data, realtime) {
  const quoteEntries = Object.entries(realtime.quotes || {});
  if (!data || !quoteEntries.length) return data;
  const stockData = { ...(data.stockData || {}) };
  for (const [code, quote] of quoteEntries) {
    stockData[code] = {
      ...(stockData[code] || {}),
      name: quote.name || stockData[code]?.name || STOCK_NAMES[code] || code,
      price: quote.price,
      chg_1d: quote.chg_1d,
      market: quote.market || stockData[code]?.market || null,
      quoteStatus: quote.quoteStatus || 'realtime',
      quoteSource: quote.source,
      quoteDate: quote.date,
      quoteTime: quote.time,
      quoteUpdatedAt: realtime.updatedAt,
      previousClose: quote.previousClose,
      volume: quote.volume,
    };
  }
  return {
    ...data,
    stockData,
    realtime: {
      updatedAt: realtime.updatedAt,
      status: realtime.status,
    },
  };
}

function realtimeFromStaticData(data) {
  const status = data?.realtimeStatus || data?.sourceStatus?.find((item) => item.source === 'twse-mis');
  if (!status?.ok) return null;
  return {
    quotes: {},
    status,
    updatedAt: data.quoteUpdatedAt || data.updatedAt,
    disabled: false,
    static: true,
  };
}

function useGlossaryPrompt() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(GLOSSARY_STORAGE_KEY) !== 'seen') setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  const close = () => {
    setOpen(false);
    try {
      window.localStorage.setItem(GLOSSARY_STORAGE_KEY, 'seen');
    } catch {}
  };

  return { open, close, openAgain: () => setOpen(true) };
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

function Header({ data, loading, onRefresh, realtime, onOpenGlossary }) {
  const pwa = useInstallPrompt();
  const liveOk = realtime?.status?.ok;
  const liveLabel = liveOk
    ? `即時股價 ${realtime.status.lastOkDate || ''}`
    : realtime?.disabled ? '盤後股價' : null;
  return h('header', { className: 'top-shell glass' },
    h('div', { className: 'brand' },
      h('div', { className: 'brand-mark' },
        h('img', { src: `${base}assets/icon.svg`, alt: '', 'aria-hidden': true })
      ),
      h('div', null,
        h('h1', null, '台股資金溫度計'),
        h('p', null, data ? `資料日期 ${data.date} · 更新 ${new Date(data.updatedAt).toLocaleString('zh-TW', { hour12: false })}` : '載入官方資料')
      )
    ),
    h('div', { className: 'header-actions' },
      data?.cache?.stale ? h('span', { className: 'pill warn' }, '暫存資料') : null,
      data ? h('span', { className: `pill ${data.marketChg1d >= 0 ? 'up' : 'down'}` }, `大盤漲跌 ${fmtPct(data.marketChg1d, 2)}`) : null,
      liveLabel ? h('span', { className: `pill ${liveOk ? 'live' : ''}` }, liveLabel) : null,
      h('button', { className: 'icon-btn', onClick: onOpenGlossary, title: '名詞說明', 'aria-label': '名詞說明' }, '?'),
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
        out.push({ key: sector.name, label: sector.name, tag: '族群', sector });
      }
    }
    for (const [code, name] of Object.entries(STOCK_NAMES)) {
      if (!code.includes(q) && !String(name).toLowerCase().includes(q) && !String(name).includes(query.trim())) continue;
      for (const sectorName of STOCK_TO_SECTORS[code] || []) {
        const sector = sectors.find((item) => item.name === sectorName);
        const key = `${code}-${sectorName}`;
        if (!sector || seen.has(key)) continue;
        seen.add(key);
        out.push({ key, label: `${code} ${name || ''}`.trim(), tag: `主族群 · ${sectorName}`, sector });
      }
    }
    return out.slice(0, 12);
  }, [query, sectors]);

  return h('div', { className: 'search glass' },
    h('span', { className: 'search-icon' }, '⌕'),
    h('input', {
      value: query,
      onChange: (event) => setQuery(event.target.value),
      placeholder: '搜尋股票或族群',
      autoComplete: 'off',
    }),
    results.length ? h('div', { className: 'search-menu' },
      results.map((item) => h('button', {
        key: item.key,
        type: 'button',
        onMouseDown: (event) => {
          event.preventDefault();
        },
        onClick: () => {
          setQuery('');
          onSelect(item.sector);
        },
      },
        h('span', null, item.label),
        h('small', null, item.tag)
      ))
    ) : query.trim() ? h('div', { className: 'search-menu empty' }, '沒有符合的族群') : null
  );
}

function GlossaryModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return h('div', { className: 'glossary-backdrop', onClick: onClose },
    h('section', {
      className: 'glossary-modal glass',
      role: 'dialog',
      'aria-modal': true,
      'aria-labelledby': 'glossary-title',
      onClick: (event) => event.stopPropagation(),
    },
      h('div', { className: 'glossary-head' },
        h('div', null,
          h('span', { className: 'glossary-kicker' }, '第一次使用'),
          h('h2', { id: 'glossary-title' }, '名詞說明'),
          h('p', null, '這套介面用資金流入、流出來判斷族群狀態；股價與漲跌維持一般股票用語。')
        ),
        h('button', { className: 'icon-btn', onClick: onClose, title: '關閉', 'aria-label': '關閉名詞說明' }, '×')
      ),
      h('div', { className: 'glossary-grid' },
        TERM_GLOSSARY.map((item) => h('article', { key: item.term, className: 'glossary-item' },
          h('strong', null, item.term),
          h('p', null, item.desc)
        ))
      ),
      h('div', { className: 'glossary-actions' },
        h('button', { className: 'install-btn', onClick: onClose }, '開始使用')
      )
    )
  );
}

const heatmapMetrics = [
  { key: 'net_1d_yi', label: '1日資金', kind: 'flow', digits: 1 },
  { key: 'net_5d_yi', label: '5日資金', kind: 'flow', digits: 1 },
  { key: 'net_20d_yi', label: '20日資金', kind: 'flow', digits: 0 },
  { key: 'accel', label: '資金加速度', kind: 'flow', digits: 1 },
  { key: 'chg_5d', label: '5日漲跌', kind: 'pct', digits: 1 },
];

const sortOptions = [
  { key: 'net_1d_yi', dir: 'desc', label: '1日流入' },
  { key: 'net_1d_yi', dir: 'asc', label: '1日流出' },
  { key: 'net_5d_yi', dir: 'desc', label: '5日流入' },
  { key: 'net_5d_yi', dir: 'asc', label: '5日流出' },
  { key: 'net_20d_yi', dir: 'desc', label: '20日流入' },
  { key: 'net_20d_yi', dir: 'asc', label: '20日流出' },
  { key: 'accel', dir: 'desc', label: '加速' },
  { key: 'accel', dir: 'asc', label: '降速' },
  { key: 'chg_5d', dir: 'desc', label: '5日漲跌' },
];

const treemapMetricOptions = [
  { key: 'net_1d_yi', label: '今日資金', getValue: (sector) => sector.net_1d_yi ?? 0 },
  { key: 'net_5d_yi', label: '5日資金', getValue: (sector) => sector.net_5d_yi ?? 0 },
  { key: 'net_20d_yi', label: '20日資金', getValue: (sector) => sector.net_20d_yi ?? 0 },
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

function blendRgb(base, strength) {
  return base.map((channel) => Math.round(255 + (channel - 255) * strength));
}

function treemapTileStyle(value, maxAbs) {
  const intensity = Math.min(1, Math.abs(value) / Math.max(maxAbs, 1));
  const base = value >= 0 ? [255, 59, 48] : [45, 143, 72];
  const strength = 0.24 + intensity * 0.62;
  const [r, g, b] = blendRgb(base, strength);
  const useLightText = intensity > 0.36;
  return {
    backgroundColor: `rgb(${r}, ${g}, ${b})`,
    color: useLightText ? '#fff' : '#1d1d1f',
    '--tile-text-shadow': useLightText ? '0 1px 12px rgba(0, 0, 0, 0.22)' : 'none',
  };
}

function splitTreemap(items, x, y, width, height) {
  if (!items.length || width <= 0 || height <= 0) return [];
  if (items.length === 1) return [{ ...items[0], x, y, width, height }];

  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let running = 0;
  let splitIndex = 0;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (let index = 0; index < items.length - 1; index += 1) {
    running += items[index].weight;
    const diff = Math.abs(total / 2 - running);
    if (diff < bestDiff) {
      bestDiff = diff;
      splitIndex = index + 1;
    }
  }

  const first = items.slice(0, splitIndex);
  const second = items.slice(splitIndex);
  const firstTotal = first.reduce((sum, item) => sum + item.weight, 0);
  if (width >= height) {
    const firstWidth = width * (firstTotal / total);
    return [
      ...splitTreemap(first, x, y, firstWidth, height),
      ...splitTreemap(second, x + firstWidth, y, width - firstWidth, height),
    ];
  }
  const firstHeight = height * (firstTotal / total);
  return [
    ...splitTreemap(first, x, y, width, firstHeight),
    ...splitTreemap(second, x, y + firstHeight, width, height - firstHeight),
  ];
}

function treemapSizeClass(width, height) {
  const area = width * height;
  const shortest = Math.min(width, height);
  if (area >= 1450 && shortest >= 22) return 'xxl';
  if (area >= 720 && shortest >= 14) return 'large';
  if (area >= 300 && shortest >= 8) return 'medium';
  if (area >= 130 && shortest >= 5) return 'small';
  return 'micro';
}

function DailyFlowHeatmap({ sectors, activeCats, date, onSelect }) {
  const [metricKey, setMetricKey] = useState('net_1d_yi');
  const metric = treemapMetricOptions.find((item) => item.key === metricKey) || treemapMetricOptions[0];
  const tiles = useMemo(() => {
    return sectors
      .filter((sector) => activeCats.has(classifySector(sector)))
      .map((sector) => {
        const value = metric.getValue(sector);
        return {
          sector,
          value,
          weight: Math.max(Math.abs(value), 0.1),
        };
      })
      .filter((item) => Number.isFinite(item.value) && item.weight > 0)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 36);
  }, [activeCats, metric, sectors]);
  const maxAbs = useMemo(() => Math.max(...tiles.map((tile) => Math.abs(tile.value)), 1), [tiles]);
  const layouts = useMemo(() => splitTreemap(tiles, 0, 0, 100, 100), [tiles]);
  const flowIn = tiles.reduce((sum, tile) => sum + Math.max(tile.value, 0), 0);
  const flowOut = tiles.reduce((sum, tile) => sum + Math.abs(Math.min(tile.value, 0)), 0);

  return h('section', { className: 'flow-map-card glass' },
    h('div', { className: 'view-head' },
      h('div', null,
        h('strong', null, '每日資金流向熱力圖'),
        h('span', null, `${date || 'latest'} · 面積代表資金規模，紅色流入、綠色流出`)
      ),
      h('div', { className: 'flow-legend' },
        h('span', { className: 'hot' }, '流入'),
        h('span', { className: 'cold' }, '流出')
      )
    ),
    h('div', { className: 'flow-map-toolbar' },
      h('div', { className: 'flow-map-condition' },
        h('span', null, `面積：${metric.label}`),
        h('span', null, `顏色：${metric.label}流向`)
      ),
      h('div', { className: 'heatmap-tools' },
        treemapMetricOptions.map((option) => h('button', {
          key: option.key,
          className: metric.key === option.key ? 'active' : '',
          onClick: () => setMetricKey(option.key),
        }, option.label))
      )
    ),
    h('div', { className: 'treemap-canvas', role: 'list', 'aria-label': '每日資金流向熱力圖' },
      layouts.map((tile) => {
        const { sector, value, x, y, width, height } = tile;
        const sizeClass = treemapSizeClass(width, height);
        return h('button', {
          key: sector.name,
          className: `flow-tile ${sizeClass}`,
          role: 'listitem',
          onClick: () => onSelect(sector),
          title: `${sector.name} ${metric.label} ${fmtYi(value, 1)}，1日漲跌 ${fmtPct(sector.chg_1d, 1)}`,
          style: {
            left: `${x}%`,
            top: `${y}%`,
            width: `${width}%`,
            height: `${height}%`,
            ...treemapTileStyle(value, maxAbs),
          },
        },
          h('span', { className: 'flow-tile-name' }, sector.name),
        );
      })
    ),
    h('div', { className: 'treemap-footer' },
      h('div', { className: 'treemap-scale', 'aria-hidden': true },
        h('div', { className: 'treemap-gradient' }),
        h('div', { className: 'treemap-scale-labels' },
          h('span', null, '強流入'),
          h('span', null, '中性'),
          h('span', null, '強流出')
        )
      ),
      h('div', { className: 'flow-summary' },
        h('span', null, `流入 ${fmtYi(flowIn, 0)}`),
        h('span', null, `流出 ${fmtYi(flowOut, 0)}`),
        h('span', null, `${tiles.length} / ${sectors.length} 族群`)
      )
    )
  );
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
      { label: '5日流入最多', metric: heatmapMetrics[1], sector: by('net_5d_yi') },
      { label: '資金加速最快', metric: heatmapMetrics[3], sector: by('accel') },
      { label: '5日流出最多', metric: heatmapMetrics[1], sector: by('net_5d_yi', 'asc') },
    ].filter((item) => item.sector);
  }, [sectors]);

  return h('section', { className: 'heatmap-card glass' },
    h('div', { className: 'view-head' },
      h('div', null,
        h('strong', null, '族群資金總覽'),
        h('span', null, `${visible.length} / ${sectors.length} 族群 · 點列可看成分股`)
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
        h('span', null, '族群'),
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
  return h('aside', { className: 'ranking glass' },
    h('div', { className: 'panel-headline' },
      h('div', null, h('strong', null, '資金排行'), h('span', null, mode === 'cp' ? '流入強勢' : '逆勢轉強')),
      h('div', { className: 'segmented' },
        h('button', { className: mode === 'cp' ? 'active' : '', onClick: () => setMode('cp') }, '流入'),
        h('button', { className: mode === 'bottom' ? 'active' : '', onClick: () => setMode('bottom') }, `逆勢 ${bottomCount || ''}`)
      )
    ),
    rows.length ? h('div', { className: 'ranking-list' },
      rows.map((sector, index) => {
        const value = mode === 'bottom' ? sector.net_1d_yi : sector.net_5d_yi;
        return h('button', { key: sector.name, className: 'ranking-row', onClick: () => onSelect(sector) },
          h('span', { className: 'rank-num' }, index + 1),
          h('span', { className: 'rank-name' }, sector.name),
          h('span', { className: 'rank-pct', style: { color: pctColor(mode === 'bottom' ? sector.chg_1d : sector.chg_5d) } }, fmtPct(mode === 'bottom' ? sector.chg_1d : sector.chg_5d, 1)),
          h('span', { className: 'rank-flow', style: { color: flowColor(value) } }, fmtYi(value, 1))
        );
      })
    ) : h('div', { className: 'empty-panel' }, mode === 'bottom' ? '目前沒有逆勢轉強族群' : '目前沒有資金流入族群')
  );
}

function SectorDrawer({ sector, data, onClose }) {
  if (!sector) return null;
  const cat = classifySector(sector);
  const meta = CATEGORY_META[cat];
  const stockData = data.stockData || {};
  const hasPublicQuote = (code) => stockData[code]?.quoteStatus === 'realtime' || stockData[code]?.quoteStatus === 'ok' || stockData[code]?.price != null;
  const displayStocks = sector.stocks.filter(hasPublicQuote);
  const quotedCount = displayStocks.length;
  const unavailableCount = sector.stocks.length - quotedCount;
  const realtimeCount = displayStocks.filter((code) => stockData[code]?.quoteStatus === 'realtime').length;
  const fallbackCount = displayStocks.filter((code) => stockData[code]?.quoteStatus === 'fallback').length;
  const quoteLabel = realtimeCount ? '即時股價' : fallbackCount ? '補齊股價' : '官方股價';
  return h('div', { className: 'drawer-backdrop', onClick: onClose },
    h('aside', { className: 'drawer glass', onClick: (event) => event.stopPropagation() },
      h('div', { className: 'drawer-head' },
        h('div', null,
          h('span', { className: 'drawer-badge', style: { color: meta.color, borderColor: meta.color } }, meta.label),
          h('h2', null, sector.name),
          h('p', { className: 'quote-coverage' },
            `${quoteLabel} ${quotedCount} / ${sector.stocks.length}`,
            unavailableCount ? `，已排除 ${unavailableCount} 檔無公開報價` : ''
          )
        ),
        h('button', { className: 'icon-btn', onClick: onClose, title: '關閉' }, '×')
      ),
      h('div', { className: 'metric-grid' },
        h('div', null, h('small', null, '當日資金'), h('strong', { style: { color: flowColor(sector.net_1d_yi) } }, fmtYi(sector.net_1d_yi, 2))),
        h('div', null, h('small', null, '5 日資金'), h('strong', { style: { color: flowColor(sector.net_5d_yi) } }, fmtYi(sector.net_5d_yi, 2))),
        h('div', null, h('small', null, '20 日資金'), h('strong', { style: { color: flowColor(sector.net_20d_yi) } }, fmtYi(sector.net_20d_yi, 2))),
        h('div', null, h('small', null, '資金加速度'), h('strong', { style: { color: flowColor(sector.accel) } }, `${sector.accel > 0 ? '+' : ''}${sector.accel.toFixed(2)}`)),
        h('div', null, h('small', null, '1 日漲跌'), h('strong', { style: { color: pctColor(sector.chg_1d) } }, fmtPct(sector.chg_1d, 2))),
        h('div', null, h('small', null, '5 日漲跌'), h('strong', { style: { color: pctColor(sector.chg_5d) } }, fmtPct(sector.chg_5d, 2)))
      ),
      h('div', { className: 'stock-table' },
        h('div', { className: 'stock-row head' }, h('span', null, '代碼'), h('span', null, '名稱'), h('span', null, '股價'), h('span', null, '漲跌'), h('span', null, '資金')),
        displayStocks.length ? displayStocks.map((code) => {
          const item = stockData[code];
          const hasQuote = item?.quoteStatus === 'realtime' || item?.quoteStatus === 'ok' || item?.price != null;
          const isRealtime = item?.quoteStatus === 'realtime';
          return h('div', { className: 'stock-row', key: code },
            h('span', null, code),
            h('span', null, item?.name || STOCK_NAMES[code] || '—'),
            h('span', { className: hasQuote ? (isRealtime ? 'live-price' : '') : 'quote-missing' },
              hasQuote ? fmtPrice(item.price) : '無公開報價'
            ),
            h('span', { style: { color: hasQuote ? pctColor(item.chg_1d) : undefined } }, hasQuote ? fmtPct(item.chg_1d, 2) : '—'),
            h('span', { style: { color: hasQuote ? flowColor(item.net_1d_yi) : undefined } }, hasQuote ? fmtYi(item.net_1d_yi, 2) : '—')
          );
        }) : h('div', { className: 'empty-panel' }, '此族群目前沒有可公開報價的成分股')
      )
    )
  );
}

function SourceStrip({ data, realtime }) {
  const statuses = data.sourceStatus.filter((item) => !(realtime?.status && item.source === realtime.status.source));
  const sourceLabel = (item) => SOURCE_LABELS[item.source] || item.source;
  return h('div', { className: 'source-strip glass' },
    realtime?.status ? h('span', { key: 'twse-mis', className: realtime.status.ok ? 'ok' : 'bad' },
      `${sourceLabel(realtime.status)} ${realtime.status.ok ? `${realtime.status.rows} 檔` : 'failed'}`
    ) : null,
    statuses.map((item) => h('span', { key: item.source, className: item.ok ? 'ok' : 'bad' },
      `${sourceLabel(item)} ${item.ok ? item.lastOkDate || item.okCount : 'failed'}`
    ))
  );
}

function App() {
  const { data, loading, error, refresh } = useSectorData();
  const glossary = useGlossaryPrompt();
  const realtime = useRealtimeQuotes(data);
  const staticRealtime = useMemo(() => realtimeFromStaticData(data), [data]);
  const effectiveRealtime = realtime.status ? realtime : staticRealtime || realtime;
  const displayData = useMemo(() => mergeRealtimeData(data, effectiveRealtime), [data, effectiveRealtime]);
  const [activeCats, setActiveCats] = useState(new Set(cats));
  const [selected, setSelected] = useState(null);
  const sectors = displayData?.sectors || [];
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
      h(Header, { data: displayData, loading, onRefresh: refresh, realtime: effectiveRealtime, onOpenGlossary: glossary.openAgain }),
      error ? h('div', { className: 'error glass' }, error) : null,
      !displayData ? h('div', { className: 'loading glass' }, loading ? '正在載入官方資料…' : '沒有資料') : h(React.Fragment, null,
        h('section', { className: 'utility-row' },
          h(SearchBox, { sectors, onSelect: setSelected }),
          h(SourceStrip, { data: displayData, realtime: effectiveRealtime })
        ),
        h(StatusCards, { sectors, activeCats, onToggle: toggleCat }),
        h(DailyFlowHeatmap, { sectors, activeCats, date: displayData.date, onSelect: setSelected }),
        h('section', { className: 'bento-layout' },
          h(HeatmapPanel, { sectors, activeCats, onSelect: setSelected }),
          h(RankingPanel, { data: displayData, onSelect: setSelected })
        ),
        h('footer', { className: 'disclaimer' }, '本網站僅彙整公開法人資金資料，僅供參考，不構成任何投資建議；投資人應自行判斷並自負盈虧。')
      )
    ),
    h(GlossaryModal, { open: glossary.open, onClose: glossary.close }),
    h(SectorDrawer, { sector: selected, data: displayData || {}, onClose: () => setSelected(null) })
  );
}

createRoot(document.getElementById('root')).render(h(App));
