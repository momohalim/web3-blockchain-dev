////////////////////////////////////////////////////////////////////////

import { SignJWT, jwtVerify } from 'jose';
import dotenv from 'dotenv';
import redis from 'redis';
dotenv.config();

let redisClient;
let redisConnected = false;

// Redis enabled by default for all environments
const useRedis = process.env.USE_REDIS !== 'false'; // Only disable if explicitly set to false

if (useRedis) {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD,
  });

  try {
    await redisClient.connect();
    redisConnected = true;
    console.log('[JWT] Redis connected successfully');
  } catch (error) {
    console.error('[JWT] Redis connection failed:', error.message);
    console.log('[JWT] Continuing without Redis for development...');
    redisConnected = false;
    redisClient = createMockRedisClient();
  }
} else {
  console.log('[JWT] Redis explicitly disabled via USE_REDIS=false');
  redisConnected = false;
  redisClient = createMockRedisClient();
}

function createMockRedisClient() {
  return {
    get: async () => null,
    set: async () => 'OK',
    setEx: async () => 'OK',
    del: async () => 1,
    exists: async () => 0,
    expire: async () => 1,
    incr: async () => 1,
    keys: async () => [],
    flushAll: async () => 'OK',
    on: () => {},
    quit: async () => {},
    disconnect: async () => {},
    connect: async () => {},
    isOpen: true
  };
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
const REFRESH_SECRET = new TextEncoder().encode(process.env.REFRESH_SECRET);

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined');
}

async function generateJWT(address) {
  try {
    const token = await new SignJWT({ address })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15min')
      .sign(JWT_SECRET);
    return token;
  } catch (err) {
    console.error('[JWT] Error generating JWT for', address, ':', err);
    throw err;
  }
}

async function generateRefreshToken(address) {
  try {
    const token = await new SignJWT({ address })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(REFRESH_SECRET);
    return token;
  } catch (err) {
    console.error('[JWT] Error generating refresh token for', address, ':', err);
    throw err;
  }
}

async function verifyJWT(token) {
  try {
    if (redisConnected && await isTokenRevoked(token)) {
      console.warn('[JWT] Attempt to verify revoked token:', token.substring(0, 16) + '...');
      throw new Error('Token revoked');
    }
    const { payload } = await jwtVerify(token, JWT_SECRET);

    // Check if the token is expired
    const currentTime = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < currentTime) {
      const error = new Error('JWTExpired: "exp" claim timestamp check failed');
      error.code = 'ERR_JWT_EXPIRED';
      error.claim = 'exp';
      error.reason = 'check_failed';
      error.payload = payload;
      throw error;
    }

    return payload;
  } catch (err) {
    console.error('[JWT] Error verifying JWT:', err);
    throw err;
  }
}

async function authenticateJWT(req, res, next) {
  let token = req.cookies?.token;
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    console.warn('[JWT] Missing token in authenticateJWT');
    return res.status(401).json({ error: 'Missing token' });
  }
  try {
    const payload = await verifyJWT(token);
    req.user = payload;
    next();
  } catch (err) {
    console.error('[JWT] authenticateJWT error:', err);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

async function verifyRefreshToken(token) {
  try {
    const { payload } = await jwtVerify(token, REFRESH_SECRET);
    return payload;
  } catch (err) {
    console.error('[JWT] Error verifying refresh token:', err);
    throw err;
  }
}

async function revokeJWT(token) {
  try {
    if (redisConnected) {
      const { payload } = await jwtVerify(token, JWT_SECRET, { complete: true });
      const exp = payload.exp ? Math.floor(payload.exp - Date.now() / 1000) : 900;
      await redisClient.set(`revoked_jwt:${token}`, '1', 'EX', exp);
    } else {
      console.log('[JWT] Redis not available, skipping token revocation');
    }
  } catch (err) {
    console.error('[JWT] Error revoking JWT:', err);
    throw err;
  }
}

async function isTokenRevoked(token) {
  try {
    if (!redisConnected) {
      return false; // If Redis is not available, assume token is not revoked
    }
    if (!redisClient.isOpen) await redisClient.connect();
    const exists = await redisClient.exists(`revoked_jwt:${token}`);
    if (exists) console.warn('[JWT] Token is revoked:', token.substring(0, 16) + '...');
    return exists; // 1 if revoked, 0 if not
  } catch (err) {
    console.error('[JWT] Error checking if token is revoked:', err);
    return false; // If there's an error, assume token is not revoked
  }
}

async function refreshJWT(refreshToken) {
  try {
    const { payload } = await jwtVerify(refreshToken, REFRESH_SECRET);
    const newToken = await new SignJWT({ address: payload.address })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15min')
      .sign(JWT_SECRET);
    return newToken;
  } catch (err) {
    console.error('[JWT] Error refreshing JWT:', err);
    throw err;
  }
}

export { generateJWT, verifyJWT, authenticateJWT, generateRefreshToken, verifyRefreshToken, revokeJWT, refreshJWT };
