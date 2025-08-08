////////////////////////////////////////////////////////////////

import { Pool } from 'pg';
import dotenv from 'dotenv';
import redis from 'redis';
import { disconnectAllSocketsForWallet } from './websocketServer.js';
import { v4 as uuidv4 } from 'uuid';
dotenv.config();

////////////////////////////////////////////////////////////////

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: process.env.POSTGRES_PASSWORD,
    port: process.env.POSTGRES_PORT,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
});

////////////////////////////////////////////////////////////////

let redisClient;
let redisConnected = false;

// Redis enabled by default for all environments
const useRedis = process.env.USE_REDIS !== 'false'; // Only disable if explicitly set to false

if (useRedis) {
    redisClient = redis.createClient({
        url: process.env.REDIS_URL,
        password: process.env.REDIS_PASSWORD,
    });

    redisClient.on('error', (error) => {
        console.error('[REDIS] Connection error:', error);
    });

    try {
        await redisClient.connect();
        redisConnected = true;
        console.log('[REDIS] Connected successfully');
    } catch (error) {
        console.error('[REDIS] Failed to connect:', error.message);
        console.log('[REDIS] Continuing without Redis for development...');
        redisConnected = false;
        redisClient = createMockRedisClient();
    }
} else {
    console.log('[REDIS] Explicitly disabled via USE_REDIS=false');
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

////////////////////////////////////////////////////////////////

async function createUserProfile(walletAddress, cryptoSelected) {
    try {

    } catch (error) {
        console.error('[DATA] Error creating user profile:', error);
    }
}

////////////////////////////////////////////////////////////////

async function onAuthentication(walletAddress, walletSelected, cryptoSelected, authToken) {
    try {
        if (redisConnected) {
            // Fetch all active sessions for the wallet from Redis
            const activeSessions = await redisClient.keys(`auth_token_${walletAddress}_*`);

            // Invalidate all previous sessions except the current one
            for (const sessionKey of activeSessions) {
                if (!sessionKey.endsWith(authToken)) {
                    await redisClient.del(sessionKey);
                }
            }

            // Log the new session in Redis
            const sessionKey = `auth_token_${walletAddress}_${authToken}`;
            await redisClient.set(sessionKey, JSON.stringify({ walletSelected, cryptoSelected }), {
                EX: 900 // Set expiration to 15 minutes (900 seconds)
            });
        } else {
            console.log('[AUTH] Redis not available, skipping session management');
        }

        // Disconnect all WebSocket connections for the wallet
        disconnectAllSocketsForWallet(walletAddress);

    } catch (error) {
        console.error('[AUTH] Error during authentication:', error);
        throw new Error('Authentication failed');
    }
}

////////////////////////////////////////////////////////////////

async function getUserData(walletAddress) {

}


async function setUserData(walletAddress, newData) {

}

async function logAuthentication(timestamp, walletAddress, walletBalance, userAgent, platform, language, ipAddress, geoLocation, fingerprint) {

}

async function updateWalletAndCrypto(walletAddress, walletBalance, cryptoSelected) {

}

async function setFlyingCoinYellow(value, walletAddress) {

}

async function getFlyingCoinYellow(walletAddress) {

}

async function addCoin(wallet_address, green, blue, red, yellow) {

}

async function subCoin(wallet_address, green, blue, red, yellow) {

}

async function getCoin(walletAddress) {

}

async function getRole(walletAddress) {

}

function randomFloat() {
    const typedArray = new Uint32Array(1);
    const randomValue = crypto.getRandomValues(typedArray)[0];
    const randomFloat = randomValue / Math.pow(2, 32);
    return randomFloat;
}

async function invalidateOtherSessions(walletAddress, currentAuthToken) {

}

async function setGameClickerToken(walletAddress, newEncryptionKey = uuidv4()) {

}

async function getGameClickerToken(walletAddress) {

}

async function setGameClickerData(walletAddress, saveData = '') {

}

async function getGameClickerData(walletAddress) {

}

////////////////////////////////////////////////////////////////

async function redeemCode(walletAddress, code) {

}

////////////////////////////////////////////////////////////////

export {
    getUserData,
    onAuthentication,
    createUserProfile,
    logAuthentication,
    redisClient,
    updateWalletAndCrypto,
    addCoin,
    subCoin,
    getCoin,
    getFlyingCoinYellow,
    setFlyingCoinYellow,
    pool,
    setUserData,
    getRole,
    randomFloat,
    invalidateOtherSessions,
    setGameClickerToken,
    getGameClickerToken,
    setGameClickerData,
    getGameClickerData,
    redeemCode,
};
