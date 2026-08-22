const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const KALSHI_API_KEY = process.env.KALSHI_API_KEY;
const KALSHI_PRIVATE_KEY = process.env.KALSHI_PRIVATE_KEY;
const BOT_URL = process.env.BOT_URL || 'https://trading-factory-production.up.railway.app';

const SERIES = ['KXBTC15M','KXETH15M','KXSOL15M','KXRPL15M','KXDOGE15M','KXADA15M','KXAVAX15M'];

function signRequest(method, path) {
  const timestamp = Date.now().toString();
  const msg = timestamp + method + path;
  const sig = crypto.createSign('RSA-SHA256');
  sig.update(msg);
  const signature = sig.sign(KALSHI_PRIVATE_KEY, 'base64');
  return { timestamp, signature };
}

async function kalshiGet(path) {
  const { timestamp, signature } = signRequest('GET', path);
  return axios.get(`https://external-api.kalshi.com/trade-api/v2${path}`, {
    headers: {
      'KALSHI-ACCESS-KEY': KALSHI_API_KEY,
      'KALSHI-ACCESS-TIMESTAMP': timestamp,
      'KALSHI-ACCESS-SIGNATURE': signature
    },
    timeout: 5000
  });
}

app.get('/api/markets/:series', async (req, res) => {
  try {
    const r = await kalshiGet(`/markets?status=open&series_ticker=${req.params.series}&limit=1`);
    res.json(r.data);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.get('/api/balance', async (req, res) => {
  try {
    const r = await kalshiGet('/portfolio/balance');
    res.json(r.data);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.get('/api/bot-health', async (req, res) => {
  try {
    const r = await axios.get(`${BOT_URL}/health`, { timeout: 3000 });
    res.json(r.data);
  } catch (e) { res.status(502).json({ status: 'down' }); }
});

app.get('/api/positions', async (req, res) => {
  try {
    const r = await kalshiGet('/portfolio/positions');
    res.json(r.data);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Monitor on port ${PORT}`));
