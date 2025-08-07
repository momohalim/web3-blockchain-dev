import express from "express";
import rateLimit from "express-rate-limit";
import { v4 as uuidv4 } from "uuid";
import CardanoWasm from "@emurgo/cardano-serialization-lib-nodejs";
import cbor from "cbor";
import { generateJWT, generateRefreshToken, verifyRefreshToken } from "../scripts/jwt.js";
import { onAuthentication } from "../scripts/data.js";
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

const CARDANO_ADDR_REGEX = /^addr1[0-9a-z]{20,150}$/;
const NONCE_EXPIRATION = 300; // 5 min

const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: "Too many authentication attempts from this IP. Please wait 5 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
});

function extractEd25519Pubkey(key) {
  if (/^[0-9a-fA-F]{64}$/.test(key)) return key;
  function findPubkey(obj) {
    if (!obj) return null;
    if (typeof obj.get === 'function') {
      for (const k of [-2, -1]) {
        if (obj.has(k)) {
          const val = obj.get(k);
          if (Buffer.isBuffer(val) && val.length === 32) return val;
        }
      }
      for (const v of obj.values()) {
        const found = findPubkey(v);
        if (found) return found;
      }
    }
    if (Array.isArray(obj)) {
      for (const v of obj) {
        const found = findPubkey(v);
        if (found) return found;
      }
    }
    if (typeof obj === 'object' && obj !== null && !Buffer.isBuffer(obj)) {
      for (const v of Object.values(obj)) {
        const found = findPubkey(v);
        if (found) return found;
      }
    }
    return null;
  }
  try {
    const buf = Buffer.from(key, "hex");
    const decoded = cbor.decode(buf);
    const pubkeyBuf = findPubkey(decoded);
    if (!Buffer.isBuffer(pubkeyBuf) || pubkeyBuf.length !== 32)
      throw new Error("Ed25519 pubkey not found in COSEKey/CBOR");
    return pubkeyBuf.toString("hex");
  } catch (e) {
    throw new Error("Failed to decode COSEKey/CBOR public key: " + e.message);
  }
}

function verifyCardanoSignature({ pubkeyHex, signature, nonce }) {
  try {
    if (/^[0-9a-fA-F]{128}$/.test(signature)) {
      const pubKey = CardanoWasm.PublicKey.from_bytes(Buffer.from(pubkeyHex, "hex"));
      const sig = CardanoWasm.Ed25519Signature.from_bytes(Buffer.from(signature, "hex"));
      return pubKey.verify(Buffer.from(nonce, "utf8"), sig);
    }
    const buf = Buffer.from(signature, "hex");
    const decoded = cbor.decode(buf);
    if (Array.isArray(decoded) && decoded.length === 4) {
      const [protectedHeader, , payload, sigBuf] = decoded;
      const context = "Signature1";
      const body_protected = Buffer.isBuffer(protectedHeader) ? protectedHeader : Buffer.alloc(0);
      const external_aad = Buffer.alloc(0);
      const payloadBuf = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
      const sigStructure = [context, body_protected, external_aad, payloadBuf];
      const sigStructureCbor = cbor.encode(sigStructure);
      const pubKey = CardanoWasm.PublicKey.from_bytes(Buffer.from(pubkeyHex, "hex"));
      const sig = CardanoWasm.Ed25519Signature.from_bytes(sigBuf);
      return pubKey.verify(sigStructureCbor, sig);
    }
    return false;
  } catch (e) {
    console.error("[Cardano][Error] Signature verification (CIP-8) failed:", e);
    return false;
  }
}

const createAuthRouterCardano = (redisClient) => {
  const router = express.Router();

  router.post("/nonceCardano", authLimiter, async (req, res) => {
    try {
      const { address } = req.body;
      if (!address || typeof address !== "string" || !CARDANO_ADDR_REGEX.test(address)) {
        return res.status(400).json({ error: "Invalid Cardano address" });
      }
      const nonce = `CyberBet.Games - Login | Your ID: ${uuidv4()}`;
      await redisClient.setEx(address, NONCE_EXPIRATION, nonce);
      res.json({ nonce });
    } catch (err) {
      res.status(500).json({ error: "Internal error requesting nonce." });
    }
  });

  router.post("/verifyCardanoSignature", authLimiter, async (req, res) => {
    const { address, walletType, nonce, signature, key } = req.body;
    try {
      if (!address || !CARDANO_ADDR_REGEX.test(address)) {
        return res.status(400).json({ error: "Invalid Cardano address" });
      }
      if (!nonce || typeof nonce !== "string" || !signature || !key) {
        return res.status(400).json({ error: "Missing nonce, signature, or public key." });
      }
      const storedNonce = await redisClient.get(address);
      if (!storedNonce || storedNonce !== nonce) {
        return res.status(400).json({ error: "Nonce mismatch or expired." });
      }
      await redisClient.del(address);
      let paymentKeyMatches = false;
      try {
        const pubkeyHex = extractEd25519Pubkey(key);
        const pubKey = CardanoWasm.PublicKey.from_bytes(Buffer.from(pubkeyHex, "hex"));
        const keyHash = pubKey.hash();
        const addr = CardanoWasm.Address.from_bech32(address);
        if (addr.kind() === CardanoWasm.AddressKind.Base) {
          const baseAddr = CardanoWasm.BaseAddress.from_address(addr);
          const paymentCred = baseAddr.payment_cred();
          const paymentKeyHash = paymentCred.to_keyhash();
          if (paymentKeyHash && paymentKeyHash.to_bytes().toString("hex") === keyHash.to_bytes().toString("hex")) {
            paymentKeyMatches = true;
          }
        } else if (addr.kind() === CardanoWasm.AddressKind.Enterprise) {
          const entAddr = CardanoWasm.EnterpriseAddress.from_address(addr);
          const paymentCred = entAddr.payment_cred();
          const paymentKeyHash = paymentCred.to_keyhash();
          if (paymentKeyHash && paymentKeyHash.to_bytes().toString("hex") === keyHash.to_bytes().toString("hex")) {
            paymentKeyMatches = true;
          }
        }
      } catch (e) {
        return res.status(400).json({ error: "Unable to compare address and public key." });
      }
      if (!paymentKeyMatches) {
        return res.status(401).json({ error: "Public key does not match address." });
      }
      let verified = false;
      try {
        const pubkeyHex = extractEd25519Pubkey(key);
        verified = verifyCardanoSignature({ pubkeyHex, signature, nonce });
      } catch (e) {
        return res.status(401).json({ error: "Signature verification failed." });
      }
      if (!verified) {
        return res.status(401).json({ error: "Invalid signature. Authentication failed." });
      }
      const token = await generateJWT(address, "cardano");
      const refreshToken = await generateRefreshToken(address, "cardano");
      onAuthentication(address, walletType, "cardano", token);
      res.json({ token, refreshToken });
    } catch (err) {
      res.status(500).json({ error: "Internal signature verification error." });
    }
  });

  router.post("/refreshCardano", authLimiter, async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken || typeof refreshToken !== "string") {
        return res.status(400).json({ error: "Missing refresh token." });
      }
      let payload;
      try {
        payload = await verifyRefreshToken(refreshToken, "cardano");
      } catch {
        return res.status(401).json({ error: "Invalid or expired refresh token." });
      }
      const token = await generateJWT(payload, "cardano");
      const newRefreshToken = await generateRefreshToken(payload, "cardano");
      res.json({ token, refreshToken: newRefreshToken });
    } catch (err) {
      res.status(500).json({ error: "Internal refresh error." });
    }
  });

  router.post("/cardanoHex2bech32", authLimiter, (req, res) => {
    try {
      const { hex } = req.body;
      if (!hex || typeof hex !== "string") {
        return res.status(400).json({ error: "Missing or invalid hex address" });
      }
      const addr = CardanoWasm.Address.from_bytes(Buffer.from(hex, "hex"));
      const bech32 = addr.to_bech32();
      return res.json({ bech32 });
    } catch (err) {
      return res.status(400).json({ error: "Invalid hex address" });
    }
  });

  router.post('/updateCardanoBalance', async (req, res) => {
    const { balance, walletAddress } = req.body;

    try {
      const query = `
        UPDATE users
        SET crypto_last_amount = $1
        WHERE wallet_address = $2;
      `;
      await pool.query(query, [balance, walletAddress]);

      const query2 = `
        UPDATE wallets
        SET balance = $1
        WHERE wallet_address = $2;
      `;
      await pool.query(query2, [balance, walletAddress]);

      res.status(200).json({ message: 'Balance updated successfully' });
    } catch (error) {
      console.error('[CARDANO] Error updating balance:', error);
      res.status(500).json({ error: 'Failed to update balance' });
    }
  });

  return router;
};

export default createAuthRouterCardano;
