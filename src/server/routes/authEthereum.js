import rateLimit from 'express-rate-limit';
import express from 'express';
import { isAddress, verifyMessage } from 'ethers';

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

import { v4 as uuidv4 } from 'uuid';

const NONCE_EXPIRATION = 300; // 5 minutes

const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20, // Limit each IP to 20 requests per windowMs
  message: "Too many authentication attempts from this IP. Please wait 5 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
});

const createAuthRouterEthereum = (redisClient) => {

  const router = express.Router();
  // Public endpoints (no JWT required)
  router.post('/nonceEthereum', authLimiter, async (req, res) => {
    const ip = req.ip;
    const key = `authratelimit:${ip}`;
    const count = await redisClient.incr(key);
    if (count === 1) await redisClient.expire(key, 300); // 5 min window
    if (count > 20) {
      return res.status(429).json({ error: "Too many authentication attempts. Please wait 5 minutes." });
    }
    try {
      const { address } = req.body;
      if (!isAddress(address)) {
        return res.status(400).json({ error: 'Invalid address' });
      }
      const nonce = `CyberBet.Games - Login | Your ID: ${uuidv4()}`;
      await redisClient.setEx(address.toLowerCase(), NONCE_EXPIRATION, nonce);
      res.json({ nonce });
    } catch (error) {
      console.error('[BACKEND] Error generating nonce:', error);
      res.status(500).json({ error: 'Server error' });
    }

  });

  router.post('/verifyEthereum', authLimiter, async (req, res) => {

    const ip = req.ip;
    const key = `authratelimit:${ip}`;
    const count = await redisClient.incr(key);

    if (count === 1) await redisClient.expire(key, 300); // 5 min window

    if (count > 20) {
      return res.status(429).json({ error: "Too many authentication attempts. Please wait 5 minutes." });
    }

    try {

      const { address, signature, walletType, chainType } = req.body;

      if (!address || !signature) { return res.status(400).json({ error: 'Missing address or signature' }); }

      const nonce = await redisClient.get(address.toLowerCase());

      if (!nonce) { return res.status(400).json({ error: 'Nonce expired or invalid' }); }

      let recoveredAddress;
      try { recoveredAddress = verifyMessage(nonce, signature); }
      catch (err) { return res.status(400).json({ error: 'Invalid signature format' }); }

      if (recoveredAddress.toLowerCase() !== address.toLowerCase()) { return res.status(400).json({ error: 'Invalid signature' }); }

      await redisClient.del(address.toLowerCase());

      ////////////////////////////////////////////////////////////////

      const token = await generateJWT(address);
      const refreshTokenEthereum = await generateRefreshToken(address);

      ////////////////////////////////////////////////////////////////
      onAuthentication(address, walletType, chainType, token);
      res.json({ success: true, token: token, refreshToken: refreshTokenEthereum });

      ////////////////////////////////////////////////////////////////

    } catch (error) {
      console.error('[BACKEND] Error verifying signature:', error);
      res.status(500).json({ error: 'Server error' });
    }

  });

  router.post('/initializeTokensEthereum', authLimiter, async (req, res) => {
    try {
      const { address } = req.body;
      if (!address) return res.status(400).json({ error: 'Missing address' });

      const token = await generateJWT(address);
      const refreshTokenEthereum = await generateRefreshToken(address);

      res.json({ success: true, token: token, refreshTokenEthereum: refreshTokenEthereum });
    } catch (error) {
      console.error('[BACKEND] Error initializing tokens:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.post('/refreshTokenEthereum', authLimiter, async (req, res) => {

    try {
      const { refreshTokenEthereum } = req.body;

      if (!refreshTokenEthereum) return res.status(401).json({ error: 'Missing refresh token' });

      const payload = await verifyRefreshToken(refreshTokenEthereum);
      const token = await generateJWT(payload.address);
      const newRefreshToken = await generateRefreshToken(payload.address);
      res.json({ token: token, refreshTokenEthereum: newRefreshToken });
    } catch (err) {
      console.error('[BACKEND] Refresh failed:', err);
      res.status(401).json({ error: 'Invalid refresh token' });
    }

  });

  router.post('/eth-balance', authLimiter, async (req, res) => {
    const walletAddress = req.body.address;
    const balance = req.body.balance;
    const cryptoSelected = req.body.cryptoSelected || 'ethereum';

    try {
      const query = `
              UPDATE users
              SET crypto_last_amount = $1
              WHERE wallet_address = $2 AND crypto_selected = $3;
          `;
      await pool.query(query, [balance, walletAddress, cryptoSelected]);

      const query2 = `
              UPDATE wallets
              SET balance = $1
              WHERE wallet_address = $2 AND crypto_selected = $3;
          `;
      await pool.query(query2, [balance, walletAddress, cryptoSelected]);

      res.status(200).json({ message: 'Balance updated successfully', balance: balance });
    } catch (error) {
      console.error('[ETHEREUM][BALANCE] Error updating balance:', error);
      res.status(500).json({ error: 'Failed to update balance' });
    }
  });

  return router;
};

///////////////////////////////////////////////////////////////////////////

export default createAuthRouterEthereum;