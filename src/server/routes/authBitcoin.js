import rateLimit from 'express-rate-limit';
import express from 'express';
import { validate as validateBTC } from 'bitcoin-address-validation';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { Verifier } from 'bip322-js';

import { generateJWT, generateRefreshToken, verifyRefreshToken } from '../scripts/jwt.js';
import { onAuthentication } from '../scripts/data.js';
import { Pool } from 'pg';

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

const NONCE_EXPIRATION = 300; // 5 minutes

const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: "Too many authentication attempts from this IP. Please wait 5 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
});

const createAuthRouterBitcoin = (redisClient) => {
  const router = express.Router();

  router.post('/nonceBitcoin', authLimiter, async (req, res) => {
    const ip = req.ip;
    const key = `authratelimit:${ip}`;
    try {
      const count = await redisClient.incr(key);
      if (count === 1) await redisClient.expire(key, 300);
      if (count > 20) {
        return res.status(429).json({ error: "Too many authentication attempts. Please wait 5 minutes." });
      }
      const { address } = req.body;
      if (!address) {
        return res.status(400).json({ error: 'Missing address' });
      }
      if (!validateBTC(address)) {
        return res.status(400).json({ error: 'Invalid address' });
      }
      const nonce = `CyberBet.Games - Login | Your ID: ${uuidv4()}`;
      await redisClient.setEx(address, NONCE_EXPIRATION, nonce);
      res.json({ nonce });
    } catch (error) {
      console.error('[BACKEND] Error generating nonce (Bitcoin):', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.post('/verifyBitcoin', authLimiter, async (req, res) => {
    const ip = req.ip;
    const key = `authratelimit:${ip}`;
    const count = await redisClient.incr(key);
    if (count === 1) await redisClient.expire(key, 300);
    if (count > 20) {
      return res.status(429).json({ error: "Too many authentication attempts. Please wait 5 minutes." });
    }

    try {
      let address, signature, publicKey, walletType;
      // Accept both flat and nested signature objects (Leather returns nested)
      if (typeof req.body.signature === 'object' && req.body.signature.result) {
        // Leather: signature is an object with .result.signature, .result.address, .result.message
        address = req.body.signature.result.address;
        signature = req.body.signature.result.signature;
        walletType = req.body.walletType;
        // Leather does not provide publicKey
        publicKey = req.body.publicKey || null;
      } else {
        // UniSat/Xverse: flat
        address = req.body.address;
        signature = req.body.signature;
        publicKey = req.body.publicKey || null;
        walletType = req.body.walletType;
      }
      if (!address || !signature) return res.status(410).json({ error: 'Missing address or signature' });
      if (!validateBTC(address)) return res.status(420).json({ error: 'Invalid address' });
      const nonce = await redisClient.get(address);
      if (!nonce) return res.status(430).json({ error: 'Nonce expired or invalid' });
      let isValid = false;
      try {
        isValid = Verifier.verifySignature(address, nonce, signature);
      } catch (err) {
        return res.status(440).json({ error: 'Invalid signature format', details: err?.message });
      }
      if (!isValid) return res.status(450).json({ error: 'Invalid signature' });
      await redisClient.del(address);
      // JWT and Refresh
      const token = await generateJWT(address);
      const refreshTokenBitcoin = await generateRefreshToken(address);
      onAuthentication(address, walletType, 'bitcoin', token);
      res.json({ success: true, token, refreshTokenBitcoin });
    } catch (error) {
      console.error('[BACKEND] Error verifying BTC signature:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.post('/initializeTokensBitcoin', authLimiter, async (req, res) => {
    try {
      const { address } = req.body;
      if (!address) return res.status(400).json({ error: 'Missing address' });

      const token = await generateJWT(address);
      const refreshTokenBitcoin = await generateRefreshToken(address);

      res.json({ success: true, token, refreshTokenBitcoin });
    } catch (error) {
      console.error('[BACKEND] Error initializing tokens:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.post('/refreshTokenBitcoin', authLimiter, async (req, res) => {
    try {
      const { refreshTokenBitcoin } = req.body;
      if (!refreshTokenBitcoin) return res.status(411).json({ error: 'Missing refresh token' });

      const payload = await verifyRefreshToken(refreshTokenBitcoin);
      const token = await generateJWT(payload.address);
      const newRefreshToken = await generateRefreshToken(payload.address);
      res.json({ token, refreshTokenBitcoin: newRefreshToken });
    } catch (err) {
      console.error('[BACKEND] Refresh failed:', err);
      res.status(411).json({ error: 'Invalid refresh token' });
    }
  });

  router.get('/btc-balance/:address', async (req, res) => {
    const address = req.params.address;
    try {
      const apiUrl = `https://blockstream.info/api/address/${address}`;
      const response = await axios.get(apiUrl);
      const data = response.data;
      let btcBalance = -1;
      if (data && typeof data.chain_stats?.funded_txo_sum === 'number' && typeof data.chain_stats?.spent_txo_sum === 'number') {
        btcBalance = (data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum) / 1e8;
      }

      const query = `
              UPDATE users
              SET crypto_last_amount = $1
              WHERE wallet_address = $2;
          `;
      await pool.query(query, [btcBalance, address]);

      const query2 = `
              UPDATE wallets
              SET balance = $1
              WHERE wallet_address = $2;
          `;
      await pool.query(query2, [btcBalance, address]);

      res.json({ balance: btcBalance });
    } catch (err) {
      console.error('[BACKEND] BTC balance fetch error:', err?.message || err);
      res.status(500).json({ error: 'Failed to fetch BTC balance' });
    }
  });

  return router;
};

export default createAuthRouterBitcoin;