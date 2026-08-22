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
const BOT_URL = process.env.BOT_URL || 'https://trading-factory-production.up.railway.app';

// Nuclear fix: handle every possible newline corruption
let rawKey = process.env.KALSHI_PRIVATE_KEY || '';
rawKey = rawKey.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
const KALSHI_PRIVATE_KEY = rawKey.trim();

const SERIES = ['KXBTC15M','KXETH15M','KXSOL15M','KXRPL15M','KXDOGE15M','KXADA15M','KXAVAX15M'];

// DEBUG: Check key format
function checkKey() {
  const lines = KALSHI_PRIVATE_KEY.split('\n');
  return {
    length: KALSHI_PRIVATE_KEY.length,
    firstLine: lines[0],
    lastLine: lines[lines.length - 1],
    lineCount: lines.length,
    hasBegin: KALSHI_PRIVATE_KEY.includes('BEGIN'),
    hasEnd: KALSHI_PRIVATE_KEY.includes('END'),
    hasRSA: KALSHI_PRIVATE_KEY.includes('RSA'),
    hasNewlines: KALSHI_PRIVATE_KEY.includes('\n')
  };
}

function signRequest(method, path) {
  const timestamp = Date.now().toString();
  const message = timestamp + method.toUpperCase() + path;
  
  try {
    const signature = crypto.sign('sha256', Buffer.from(message), {
      key: KALSHI_PRIVATE_KEY,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST
    });
    
    return { timestamp, signature: signature.toString('base64'), error: null };
  } catch (e) {
    return { timestamp, signature: null, error: e.message, keyInfo: checkKey() };
  }
}

async function kalshiGet(path) {
  const signed = signRequest('GET', path);
  if (signed.error) throw new Error(`SIGN_FAIL: ${signed.error}`);
  
  return axios.get(`https://external-api.kalshi.com/trade-api/v2${path}`, {
    headers: {
      'KALSHI-ACCESS-KEY': KALSHI_API_KEY,
      'KALSHI-ACCESS-TIMESTAMP': signed.timestamp,
      'KALSHI-ACCESS-SIGNATURE': signed.signature
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
  } catch (e) { 
    const signed = signRequest('GET', '/portfolio/balance');
    res.status(502).json({ 
      error: e.message,
      keyDebug: signed.keyInfo
    }); 
  }
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
