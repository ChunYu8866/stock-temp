import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { aggregateSectorRotation, normalizeDate } from './src/lib/market-data.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname);
const CACHE_DIR = join(ROOT, '.cache');
const PORT = Number(process.env.PORT || 3000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function sendJson(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

function safeStaticPath(pathname) {
  const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const candidate = resolve(ROOT, clean.slice(1));
  if (!candidate.startsWith(ROOT)) return null;
  return candidate;
}

async function readCache(cacheKey) {
  try {
    const raw = await readFile(join(CACHE_DIR, `${cacheKey}.json`), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeCache(cacheKey, payload) {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(join(CACHE_DIR, `${cacheKey}.json`), JSON.stringify(payload), 'utf8');
}

function isFresh(payload, minutes = 25) {
  if (!payload?.updatedAt) return false;
  return Date.now() - Date.parse(payload.updatedAt) < minutes * 60 * 1000;
}

async function handleApi(req, res, url) {
  const dateParam = url.searchParams.get('date') || 'latest';
  const refresh = url.searchParams.get('refresh') === '1';
  const cacheKey = dateParam === 'latest' ? 'latest' : normalizeDate(dateParam);
  const cached = await readCache(cacheKey);
  if (!refresh && cached && isFresh(cached, dateParam === 'latest' ? 25 : 24 * 60)) {
    sendJson(res, 200, { ...cached, cache: { hit: true, stale: false } });
    return;
  }

  try {
    const payload = await aggregateSectorRotation({ date: dateParam });
    await writeCache(cacheKey, payload);
    if (dateParam === 'latest') await writeCache(payload.date, payload);
    sendJson(res, 200, { ...payload, cache: { hit: false, stale: false } });
  } catch (error) {
    if (cached) {
      sendJson(res, 200, {
        ...cached,
        cache: { hit: true, stale: true, error: error.message },
      });
      return;
    }
    sendJson(res, 502, {
      error: 'Unable to load official market data',
      detail: error.message,
    });
  }
}

async function handleStatic(req, res, url) {
  let pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  if (pathname === '/manifest.webmanifest') pathname = '/public/manifest.webmanifest';
  if (pathname === '/sw.js') pathname = '/public/sw.js';
  if (pathname.startsWith('/assets/')) pathname = `/public${pathname}`;
  if (pathname.startsWith('/data/')) pathname = `/public${pathname}`;

  const target = safeStaticPath(pathname);
  if (!target) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const info = await stat(target);
    if (!info.isFile()) throw new Error('not a file');
    const noCache = pathname === '/index.html'
      || pathname === '/public/sw.js'
      || pathname === '/public/manifest.webmanifest'
      || pathname === '/public/data/latest.json'
      || pathname.startsWith('/src/');
    res.writeHead(200, {
      'content-type': MIME[extname(target)] || 'application/octet-stream',
      'cache-control': noCache ? 'no-cache' : 'public, max-age=3600',
    });
    createReadStream(target).pipe(res);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname === '/api/sector-rotation') {
      await handleApi(req, res, url);
    } else {
      await handleStatic(req, res, url);
    }
  } catch (error) {
    sendJson(res, 500, { error: 'Internal server error', detail: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Sector Rotation Light running at http://localhost:${PORT}`);
});
