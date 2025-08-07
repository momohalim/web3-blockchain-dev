import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import nacl from 'tweetnacl';
import { v4 as uuidv4 } from 'uuid';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { generateJWT, generateRefreshToken, verifyRefreshToken, } from '../scripts/jwt.js';
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

const APTOS_ADDR_REGEX = /^(0x)?[a-fA-F0-9]{1,64}$/;
const NONCE_EXPIRATION = 300; // 5 minutes

// Helper function to convert hex string to Uint8Array
function hexToUint8Array(hexString) {
  let localHexString = String(hexString); // Ensure it's a string
  if (localHexString.startsWith('0x')) {
    localHexString = localHexString.slice(2);
  }
  if (localHexString.length % 2 !== 0) {
    console.error('[APTOS][AUTH] hexToUint8Array: Hex string must have an even number of characters. Received:', localHexString);
    throw new Error('Hex string must have an even number of characters.');
  }
  const byteArray = new Uint8Array(localHexString.length / 2);
  for (let i = 0; i < localHexString.length; i += 2) {
    const byte = parseInt(localHexString.substring(i, i + 2), 16);
    if (isNaN(byte)) {
      console.error('[APTOS][AUTH] hexToUint8Array: Invalid hex character in string. String:', localHexString);
      throw new Error(`Invalid hex character in string: ${localHexString}`);
    }
    byteArray[i / 2] = byte;
  }
  return byteArray;
}

const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: "Too many authentication attempts from this IP. Please wait 5 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
});

function normalizeAptosAddress(address) {
  if (!address) return null;

  // Remove 0x prefix if present
  let cleanAddress = address.startsWith('0x') ? address.slice(2) : address;

  // Pad with leading zeros to make it 64 characters (32 bytes)
  cleanAddress = cleanAddress.padStart(64, '0');

  // Add 0x prefix back
  return '0x' + cleanAddress;
}

// Modified to accept 'message' (which will be the fullMessage from client) instead of 'nonce'
function verifyAptosSignature({ publicKey, signature, message }) {
  try {

    if (typeof message !== 'string') {
      console.error('[APTOS][AUTH] Message to verify must be a string.');
      return false;
    }

    const messageBytes = new TextEncoder().encode(message); // Use the fullMessage from client
    const signatureBytes = hexToUint8Array(signature);
    const publicKeyBytes = hexToUint8Array(publicKey);

    if (signatureBytes.length !== nacl.sign.signatureLength) {
      console.error(`[APTOS][AUTH] Invalid signature length. Expected ${nacl.sign.signatureLength}, got ${signatureBytes.length}`);
      return false;
    }
    if (publicKeyBytes.length !== nacl.sign.publicKeyLength) {
      console.error(`[APTOS][AUTH] Invalid public key length. Expected ${nacl.sign.publicKeyLength}, got ${publicKeyBytes.length}`);
      return false;
    }

    const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

    //console.log('[APTOS][AUTH] Signature verification result:', isValid);
    return isValid;
  } catch (error) {
    console.error('[APTOS][AUTH] Signature verification error with tweetnacl:', error.message);
    console.error('[APTOS][AUTH] Error name:', error.name);
    // console.error('[APTOS][AUTH] Error stack:', error.stack);
    if (error.cause) {
      console.error('[APTOS][AUTH] Error cause:', error.cause);
    }
    return false;
  }
}

const createAuthRouterAptos = (redisClient) => {
  const router = express.Router();

  // Generate nonce for authentication
  router.post("/nonceAptos", authLimiter, async (req, res) => {
    try {
      const { address, walletType } = req.body;

      if (!address || typeof address !== "string" || !APTOS_ADDR_REGEX.test(address)) {
        return res.status(400).json({ error: "Invalid Aptos address" });
      }

      if (!walletType || typeof walletType !== "string") {
        return res.status(400).json({ error: "Wallet type is required" });
      }

      const normalizedAddress = normalizeAptosAddress(address);
      // The nonce generated here is the `message` part of the signPayload on the client.
      // It will also be part of the `fullMessage` constructed by the wallet.
      const nonceForClientToSign = `CyberBet.Games - Login | Your ID: ${uuidv4()}`

      // Store this server-generated nonce. The client will include it in what it signs.
      // We will use this for an initial check, but the primary verification will be against the fullMessage.
      await redisClient.setEx(`aptos_nonce_${normalizedAddress}`, NONCE_EXPIRATION.toString(), nonceForClientToSign);

      //console.log(`[APTOS][AUTH] Generated nonce for ${walletType} wallet (${normalizedAddress}): "${nonceForClientToSign}"`);
      res.json({ nonce: nonceForClientToSign }); // Send this to the client
    } catch (err) {
      console.error('[APTOS][AUTH] Error generating nonce:', err);
      res.status(500).json({ error: "Internal error requesting nonce." });
    }
  });

  // Verify signature and authenticate
  // Modified to receive 'message' (the fullMessage from client) instead of 'nonce'
  router.post("/verifyAptos", authLimiter, async (req, res) => {
    const { address, walletType, message, signature, publicKey } = req.body; // 'nonce' is now 'message'

    try {
      if (!address || !APTOS_ADDR_REGEX.test(address)) {
        return res.status(400).json({ error: "Invalid Aptos address" });
      }

      // 'message' is the fullMessage string from the client wallet
      if (!message || typeof message !== "string" || !signature || !publicKey) {
        return res.status(400).json({ error: "Missing message, signature, or public key." });
      }

      if (!walletType || typeof walletType !== "string") {
        return res.status(400).json({ error: "Wallet type is required" });
      }

      const normalizedAddress = normalizeAptosAddress(address);

      // Optional: Retrieve the original nonce we sent to the client for an initial sanity check.
      // This helps ensure the message being verified at least contains the nonce we issued.
      const storedServerNonce = await redisClient.get(`aptos_nonce_${normalizedAddress}`);
      if (!storedServerNonce) {
        return res.status(400).json({ error: "Nonce expired or not found for address. Please try again." });
      }

      // Basic check: Does the fullMessage from the client contain the nonce we issued?
      // This is a good first-pass filter.
      if (!message.includes(storedServerNonce)) {
        console.warn(`[APTOS][AUTH] Verification failure: Client's fullMessage does not contain the server-issued nonce. Server Nonce: "${storedServerNonce}", Client Message: "${message}"`);
        return res.status(400).json({ error: "Message content mismatch with server nonce." });
      }

      // Nonce has served its initial purpose for lookup and basic check, remove it.
      await redisClient.del(`aptos_nonce_${normalizedAddress}`);

      // Verify signature against the fullMessage provided by the client
      const isSignatureValid = verifyAptosSignature({
        publicKey,
        signature,
        message // Pass the fullMessage here
      });

      if (!isSignatureValid) {
        //console.log('[APTOS][AUTH] Signature verification failed');
        return res.status(400).json({ error: "Invalid signature." });
      }

      //console.log(`[APTOS][AUTH] Signature verified successfully for ${walletType} wallet: ${normalizedAddress}`);

      // Generate JWT tokens
      const token = await generateJWT(normalizedAddress, 'aptos');
      const refreshTokenAptos = await generateRefreshToken(normalizedAddress);

      // Store refresh token
      await redisClient.setEx(`refresh_aptos_${normalizedAddress}`, (7 * 24 * 60 * 60).toString(), refreshTokenAptos);
      // Call authentication handler
      await onAuthentication(normalizedAddress, walletType, 'aptos', token);

      res.json({
        success: true,
        token,
        refreshTokenAptos,
        address: normalizedAddress,
        walletType,
        chainType: 'aptos'
      });
    } catch (err) {
      console.error('[APTOS][AUTH] Verification error:', err);
      res.status(500).json({ error: "Internal authentication error." });
    }
  });

  // Initialize tokens for new users
  router.post("/initializeTokensAptos", authLimiter, async (req, res) => {
    try {
      const { address } = req.body;

      if (!address || !APTOS_ADDR_REGEX.test(address)) {
        return res.status(400).json({ error: "Invalid Aptos address" });
      }

      const normalizedAddress = normalizeAptosAddress(address);

      // Generate initial tokens
      const token = await generateJWT(normalizedAddress, 'aptos');
      const refreshTokenAptos = await generateRefreshToken(normalizedAddress);

      // Store refresh token
      await redisClient.setEx(`refresh_aptos_${normalizedAddress}`, (7 * 24 * 60 * 60).toString(), refreshTokenAptos);
      //console.log(`[APTOS][AUTH] Initialized tokens for: ${normalizedAddress}`);

      res.json({
        token,
        refreshTokenAptos,
        address: normalizedAddress
      });
    } catch (err) {
      console.error('[APTOS][AUTH] Token initialization error:', err);
      res.status(500).json({ error: "Internal error initializing tokens." });
    }
  });

  // Refresh JWT token
  router.post("/refreshTokenAptos", authLimiter, async (req, res) => {
    try {
      const { refreshTokenAptos } = req.body;

      if (!refreshTokenAptos) {
        return res.status(400).json({ error: "Refresh token is required" });
      }

      // Verify refresh token format
      const isValidRefreshToken = verifyRefreshToken(refreshTokenAptos);
      if (!isValidRefreshToken) {
        return res.status(400).json({ error: "Invalid refresh token format" });
      }

      // Find address associated with this refresh token
      const keys = await redisClient.keys('refresh_aptos_*');
      let associatedAddress = null;

      for (const key of keys) {
        const storedToken = await redisClient.get(key);
        if (storedToken === refreshTokenAptos) {
          associatedAddress = key.replace('refresh_aptos_', '');
          break;
        }
      }

      if (!associatedAddress) {
        return res.status(400).json({ error: "Refresh token not found or expired" });
      }

      // Generate new tokens
      const newToken = await generateJWT(associatedAddress, 'aptos');
      const newRefreshToken = await generateRefreshToken(associatedAddress);

      // Update stored refresh token
      await redisClient.setEx(`refresh_aptos_${associatedAddress}`, (7 * 24 * 60 * 60).toString(), newRefreshToken);
      res.json({ token: newToken, refreshTokenAptos: newRefreshToken });
    } catch (err) {
      console.error('[APTOS][AUTH] Token refresh error:', err);
      res.status(500).json({ error: "Internal error refreshing token." });
    }
  });

  router.post('/apt-balance', authLimiter, async (req, res) => {
    const walletAddress = req.body.address;
    const balance = req.body.balance;
    const cryptoSelected = req.body.cryptoSelected || 'aptos';
    console.log(balance)
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
      res.status(200).json({ message: 'Balance updated successfully' });
    } catch (error) {
      console.error('[APTOS][BALANCE] Error updating balance:', error);
      res.status(500).json({ error: 'Failed to update balance' });
    }
  });

  return router;
};

export default createAuthRouterAptos;