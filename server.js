const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const KALSHI_API_KEY = process.env.KALSHI_API_KEY;
const BOT_URL = process.env.BOT_URL || 'https://trading-factory-production.up.railway.app';

const SERIES = ['KXBTC15M','KXETH15M','KXSOL15M','KXRPL15M','KXDOGE15M','KXADA15M','KXAVAX15M'];

async function kalshiGet(path) {
  return axios.get(`https://external-api.kalshi.com/trade-api/v2${path}`, {
    headers: { Authorization: KALSHI_API_KEY },
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
