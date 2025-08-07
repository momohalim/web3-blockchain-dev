import rateLimit from 'express-rate-limit';
import express from 'express';

import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

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
  max: 20, // Limit each IP to 20 requests per windowMs
  message: "Too many authentication attempts from this IP. Please wait 5 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
});

const createAuthRouterSolana = (redisClient) => {
  const router = express.Router();

  // Public endpoints (no JWT required)
  router.post('/nonceSolana', authLimiter, async (req, res) => {
    const ip = req.ip;
    const key = `authratelimit:${ip}`;
    try {
      const count = await redisClient.incr(key);
      if (count === 1) await redisClient.expire(key, 300); // 5 min window
      if (count > 20) {
        console.warn('[SOLANA][AUTH] Rate limit exceeded for IP:', ip);
        return res.status(429).json({ error: "Too many authentication attempts. Please wait 5 minutes." });
      }
      const { address } = req.body;
      if (!address) {
        console.warn('[SOLANA][AUTH] /nonceSolana missing address');
        return res.status(400).json({ error: 'Missing address' });
      }
      if (!/^([1-9A-HJ-NP-Za-km-z]{32,44})$/.test(address)) {
        console.warn('[SOLANA][AUTH] /nonceSolana invalid address:', address);
        return res.status(400).json({ error: 'Invalid Solana address' });
      }
      const nonce = `CyberBet.Games - Login | Your ID: ${uuidv4()}`;
      await redisClient.setEx(address, NONCE_EXPIRATION, nonce);
      res.json({ nonce });
    } catch (error) {
      console.error('[SOLANA][AUTH] Error generating nonce:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.post('/verifySolana', authLimiter, async (req, res) => {
    const ip = req.ip;
    const key = `authratelimit:${ip}`;
    const count = await redisClient.incr(key);
    if (count === 1) await redisClient.expire(key, 300);
    if (count > 20) {
      console.warn('[SOLANA][AUTH] Rate limit exceeded for IP:', ip);
      return res.status(429).json({ error: "Too many authentication attempts. Please wait 5 minutes." });
    }
    try {
      let { address, signature, walletType } = req.body;
      if (!address || !signature) {
        console.warn('[SOLANA][AUTH] /verifySolana missing address or signature');
        return res.status(400).json({ error: 'Missing address or signature' });
      }
      if (!/^([1-9A-HJ-NP-Za-km-z]{32,44})$/.test(address)) {
        console.warn('[SOLANA][AUTH] /verifySolana invalid address:', address);
        return res.status(400).json({ error: 'Invalid Solana address' });
      }
      const nonce = await redisClient.get(address);
      if (!nonce) {
        console.warn('[SOLANA][AUTH] /verifySolana nonce expired or not found for', address);
        return res.status(400).json({ error: 'Nonce expired or not found' });
      }
      let isValid = false;
      try {
        const pubKeyBytes = bs58.decode(address);
        const sigBytes = bs58.decode(signature);
        const msgBytes = new TextEncoder().encode(nonce);
        isValid = nacl.sign.detached.verify(msgBytes, sigBytes, pubKeyBytes);
      } catch (err) {
        console.error('[SOLANA][AUTH] Signature verification error:', err);
        return res.status(400).json({ error: 'Signature verification failed' });
      }
      if (!isValid) {
        console.warn('[SOLANA][AUTH] Invalid signature for', address);
        return res.status(400).json({ error: 'Invalid signature' });
      }
      await redisClient.del(address);
      const token = await generateJWT(address);
      const refreshTokenSolana = await generateRefreshToken(address);
      onAuthentication(address, walletType, 'solana', token);
      res.json({ success: true, token, refreshTokenSolana });
    } catch (error) {
      console.error('[SOLANA][AUTH] Error verifying signature:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.post('/initializeTokensSolana', authLimiter, async (req, res) => {
    try {
      const { address } = req.body;
      if (!address) return res.status(400).json({ error: 'Missing address' });
      const token = await generateJWT(address);
      const refreshTokenSolana = await generateRefreshToken(address);
      res.json({ success: true, token, refreshTokenSolana });
    } catch (error) {
      console.error('[SOLANA][AUTH] Error initializing tokens:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.post('/refreshTokenSolana', authLimiter, async (req, res) => {
    const { refreshTokenSolana } = req.body;
    if (!refreshTokenSolana) {
      console.error("[BACKEND] Missing Solana refresh token in request body.");
      return res.status(400).json({ error: "Missing Solana refresh token." });
    }
    try {
      const decoded = await verifyRefreshToken(refreshTokenSolana);
      //console.log("[BACKEND] Decoded refresh token payload:", decoded);
      const newToken = await generateJWT(decoded.address);
      const newRefreshToken = await generateRefreshToken(decoded.address);
      res.json({ token: newToken, refreshTokenSolana: newRefreshToken });
    } catch (err) {
      console.error("[BACKEND] Error refreshing Solana token:", err);
      res.status(401).json({ error: "Invalid or expired refresh token." });
    }
  });

  router.get('/sol-balance/:address', async (req, res) => {
    const address = req.params.address;
    try {
      // Use public Solana RPC (ANKR or other) to fetch balance
      const rpcUrl = 'https://api.mainnet-beta.solana.com';
      const body = {
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [address],
      };
      const rpcRes = await axios.post(rpcUrl, body, {
        headers: { 'Content-Type': 'application/json' },
      });
      const data = rpcRes.data;
      const balance = data.result?.value || 0;

      const query = `
              UPDATE users
              SET crypto_last_amount = $1
              WHERE wallet_address = $2;
          `;
      await pool.query(query, [balance, address]);

      const query2 = `
              UPDATE wallets
              SET balance = $1
              WHERE wallet_address = $2;
          `;
      await pool.query(query2, [balance, address]);

      res.json({ balance });
    } catch (err) {
      console.error('[BACKEND] Error fetching Solana balance:', err);
      res.status(500).json({ error: 'Failed to fetch balance' });
    }
  });

  return router;
};

export default createAuthRouterSolana;