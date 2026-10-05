import express from 'express';

process.env.VERCEL = '1';
process.env.REPORT_SERVER_URL = process.env.REPORT_SERVER_URL || 'http://clanfdbsw06-li.ad.sqmlitio.com/ReportServer';

const { default: legacyApp } = await import('../server');

const app = express();
const PORT = Number(process.env.STOKES_BRIDGE_PORT || 3847);
const HOST = '127.0.0.1';
const allowedOrigins = new Set(
  (process.env.STOKES_ALLOWED_ORIGINS || 'https://despacho-litio.vercel.app,http://localhost:3000,http://localhost:5173')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean)
);

app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.headers['access-control-request-private-network'] === 'true') {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  if (req.method === 'OPTIONS') {
    return origin && !allowedOrigins.has(origin) ? res.sendStatus(403) : res.sendStatus(204);
  }
  if (origin && !allowedOrigins.has(origin)) {
    return res.status(403).json({ error: 'Origen no autorizado para Stokes Bridge.' });
  }
  next();
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'stokes-bridge', reportServer: 'clanfdbsw06-li.ad.sqmlitio.com', now: new Date().toISOString() });
});

app.use((req, res, next) => {
  if (req.path !== '/api/reporte-stokes') {
    return res.status(404).json({ error: 'Ruta no disponible en Stokes Bridge.' });
  }
  if (req.body && typeof req.body === 'object') {
    delete req.body.serverUrl;
  }
  next();
});

app.use(legacyApp);

app.listen(PORT, HOST, () => {
  console.log(`[Stokes Bridge] activo en http://${HOST}:${PORT}`);
  console.log('[Stokes Bridge] ReportServer interno: clanfdbsw06-li.ad.sqmlitio.com');
});
