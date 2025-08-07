import rateLimit from 'express-rate-limit';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { generateJWT, generateRefreshToken, verifyRefreshToken } from '../scripts/jwt.js';
import { Buffer } from 'buffer';
import { verifyPersonalMessageSignature } from '@mysten/sui/verify';
import axios from 'axios';
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

const createAuthRouterSui = (redisClient) => {
  const router = express.Router();

  // Public endpoints (no JWT required)
  router.post('/nonceSui', authLimiter, async (req, res) => {
    try {
      const { address } = req.body;

      // Validate the address
      if (!address || typeof address !== 'string' || address.trim() === '') {
        return res.status(400).json({ error: 'Invalid or missing address.' });
      }

      // Generate a nonce
      const nonce = `CyberBet.Games - Login | Your ID: ${uuidv4()}`;
      // Store the nonce in Redis with expiration
      await redisClient.setEx(`sui_nonce_${address}`, NONCE_EXPIRATION, nonce);

      res.json({ nonce });
    } catch (error) {
      console.error('[SUI][AUTH] Error generating nonce:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.post('/verifySui', authLimiter, async (req, res) => {
    try {
      const { address, signaturePayload, walletType } = req.body;
      const { bytes, signature, publicKey } = signaturePayload || {};
      const messageBytes = bytes
      //console.log('[SUI][AUTH] Received payload:', { address, bytes, signature, publicKey });

      // Validate input
      if (!address || typeof address !== 'string' || address.trim() === '') {
        return res.status(400).json({ error: 'Invalid or missing address.' });
      }
      if (!messageBytes) {
        console.error('[SUI][AUTH] Missing messageBytes in payload:', { address, signature, publicKey });
        return res.status(401).json({ error: 'Missing messageBytes in payload.' });
      }
      if (!signature || !publicKey) {
        return res.status(402).json({ error: 'Invalid or missing signature payload.' });
      }

      // Ensure messageBytes and signature are valid Base64 strings
      const isBase64 = (str) => /^[A-Za-z0-9+/=]+$/.test(str);
      if (!isBase64(messageBytes) || !isBase64(signature)) {
        return res.status(403).json({ error: 'Invalid Base64 encoding in messageBytes or signature.' });
      }

      // Retrieve the nonce from Redis
      const nonceKey = `sui_nonce_${address}`;
      const storedNonce = await redisClient.get(nonceKey);
      if (!storedNonce) {
        return res.status(404).json({ error: 'Nonce expired or invalid.' });
      }

      // Decode messageBytes
      const decodedMessageBytes = Buffer.from(messageBytes, 'base64');

      // Verify the signature
      try {

        const isValid = await verifyPersonalMessageSignature(
          decodedMessageBytes,
          signature,
          address
        );
        if (!isValid) {
          return res.status(405).json({ error: 'Invalid signature or address.' });
        }
      } catch (verificationError) {
        console.error('[SUI][AUTH] Signature verification failed:', verificationError);
        return res.status(406).json({ error: 'Invalid signature or address.' });
      }

      // Clean up the nonce
      await redisClient.del(nonceKey);

      // Generate tokens
      const token = await generateJWT(address);
      const refreshToken = await generateRefreshToken(address);
      onAuthentication(address, walletType, 'sui', token);
      res.json({ success: true, token, refreshToken, balance: -1 });
    } catch (error) {
      console.error('[SUI][AUTH] Error verifying signature:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.post('/initializeTokensSui', authLimiter, async (req, res) => {
    try {
      const { address } = req.body;
      if (!address) {
        return res.status(400).json({ error: 'Address is required.' });
      }

      const token = await generateJWT(address);
      const refreshToken = await generateRefreshToken(address);

      res.json({ token, refreshToken });
    } catch (error) {
      console.error('[SUI][AUTH] Error initializing tokens:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.post('/refreshTokenSui', authLimiter, async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required.' });
      }

      const address = await verifyRefreshToken(refreshToken);
      if (!address) {
        return res.status(400).json({ error: 'Invalid refresh token.' });
      }

      const newToken = await generateJWT(address);
      const newRefreshToken = await generateRefreshToken(address);

      res.json({ token: newToken, refreshToken: newRefreshToken });
    } catch (error) {
      console.error('[SUI][AUTH] Error refreshing token:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.get('/sui-balance/:address', async (req, res) => {
    let balance = -1;
    const address = req.params.address;
    try {
      // Use public Sui RPC to fetch balance
      const rpcUrl = 'https://fullnode.mainnet.sui.io';
      const body = {
        jsonrpc: "2.0",
        id: 1,
        method: "suix_getBalance",
        params: [address],
      };
      const rpcRes = await axios.post(rpcUrl, body, {
        headers: { 'Content-Type': 'application/json' },
      });
      const data = rpcRes.data;

      balance = data.result?.totalBalance;
      //console.log('[SUI][AUTH] Fetched balance:', rpcRes);
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
      console.error('[SUI][AUTH] Error fetching balance:', err);
      res.status(500).json({ error: 'Failed to fetch balance' });
    }
  });

  router.post('/sui-balance', authLimiter, async (req, res) => {
    const walletAddress = req.body.address;
    const balance = req.body.balance;
    const cryptoSelected = req.body.cryptoSelected || 'sui';

    try {
      const query = `
            UPDATE wallets
            SET balance = $1
            WHERE wallet_address = $2 AND crypto_selected = $3;
        `;
      await pool.query(query, [balance, walletAddress, cryptoSelected]);
      res.status(200).json({ message: 'Balance updated successfully' });
    } catch (error) {
      console.error('[SUI][BALANCE] Error updating balance:', error);
      res.status(500).json({ error: 'Failed to update balance' });
    }
  });

  return router;
};

export default createAuthRouterSui;