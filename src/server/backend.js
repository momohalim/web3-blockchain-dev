////////////////////////////////////////////////////////////////////////
//import { createRequire } from 'module';
//const require = createRequire(import.meta.url);
//
// const module = require('module');
////////////////////////////////////////////////////////////////////////

import dotenv from 'dotenv';
dotenv.config();

////////////////////////////////////////////////////////////////////////

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import redis from 'redis';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import path from 'path';

import createAuthRouterSui from './routes/authSui.js';
import createAuthRouterCardano from './routes/authCardano.js';
import createAuthRouterBitcoin from './routes/authBitcoin.js';
import createAuthRouterEthereum from './routes/authEthereum.js';
import createAuthRouterAptos from './routes/authAptos.js';
import createAuthRouterSolana from './routes/authSolana.js';
import CreateProtectedRoutes from './routes/protected.js';
import CreateUnprotectedRoutes from './routes/unprotected.js';
import CreateTransactionVerificationRoutes from './routes/transactionVerification.js';

import './scripts/data.js'; // Import the data module to initialize the database connection
import './scripts/websocketServer.js'; // Import the WebSocket server


// import './scripts/imagenAi.js'
// import './scripts/openAi.js';

////////////////////////////////////////////////////////////////////////

async function startServer() {
    const app = express();
    const PORT_EXPRESS = process.env.PORT_EXPRESS;

    // General limiter
    const generalLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 150,
        message: "Too many authentication attempts. Please try again later.",
        standardHeaders: true,
        legacyHeaders: false,
    });

    // Specific limiter for auth routes
    const speedLimiter = slowDown({
        windowMs: 60 * 1000,       // 1 minute
        delayAfter: 25,            // Allow 50 requests per window
        delayMs: (used, req) => {  // Fixed delay per request over limit
            const delayAfter = req.slowDown.limit;
            return (used - delayAfter) * 500;
        },
    });

    app.use(generalLimiter);
    app.use(speedLimiter);
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                objectSrc: ["'none'"],
                upgradeInsecureRequests: [],
            },
        },
    }));
    app.use(cors());
    app.use(express.json());
    // app.use((req, res, next) => {
    //     console.log(`[${req.method}] ${req.url} ${JSON.stringify(req.body)}`);
    //     next();
    // });
    // d:/Work/2025/CyberBet.Games/source/database-update/database_update/databases/mongodb/data
    // Redis enabled by default for all environments
    const useRedis = process.env.USE_REDIS !== 'false'; // Only disable if explicitly set to false

    let redisConnected = false;
    let effectiveRedisClient;

    if (useRedis) {
        const redisClient = redis.createClient({
            socket: {
                host: process.env.REDIS_HOST,
                port: process.env.REDIS_PORT,
            },
            password: process.env.REDIS_PASSWORD,
        });

        try {
            await redisClient.connect();
            redisConnected = true;
            effectiveRedisClient = redisClient;
            console.log('✅ Redis connected successfully');
        } catch (error) {
            console.error('❌ Redis connection failed:', error.message);
            redisConnected = false;
            effectiveRedisClient = createMockRedisClient();
        }
    } else {
        console.log('⚠️  Redis explicitly disabled via USE_REDIS=false');
        redisConnected = false;
        effectiveRedisClient = createMockRedisClient();
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
    if (redisConnected) {
        effectiveRedisClient.on('error', (err) => console.error('Redis Client Error |', err));
    }

    const unprotectedRoutes = CreateUnprotectedRoutes(effectiveRedisClient);
    const authRoutesSui = createAuthRouterSui(effectiveRedisClient);
    const authRoutesCardano = createAuthRouterCardano(effectiveRedisClient);
    const authRoutesBitcoin = createAuthRouterBitcoin(effectiveRedisClient);
    const authRoutesEthereum = createAuthRouterEthereum(effectiveRedisClient);
    const authRoutesAptos = createAuthRouterAptos(effectiveRedisClient);
    const authRoutesSolana = createAuthRouterSolana(effectiveRedisClient);
    app.use('/api', unprotectedRoutes);
    app.use('/api', authRoutesSui);
    app.use('/api', authRoutesCardano);
    app.use('/api', authRoutesBitcoin);
    app.use('/api', authRoutesEthereum);
    app.use('/api', authRoutesAptos);
    app.use('/api', authRoutesSolana);

    const protectedRoutes = CreateProtectedRoutes(effectiveRedisClient);
    const transactionVerificationRoutes = CreateTransactionVerificationRoutes(effectiveRedisClient);
    app.use('/api', protectedRoutes);
    app.use('/api/verify', transactionVerificationRoutes);

    // Serve static files from the dist folder
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));

    app.use((req, res) => res.status(404).json({ error: 'Not found' }));

    app.use((err, req, res, next) => {
        console.error('Unhandled backend error:', err);
        res.status(500).json({ error: 'Internal server error' });
    });

    const server = app.listen(PORT_EXPRESS, () => console.log(`Express running on port ${PORT_EXPRESS}`));

    // Graceful shutdown handling
    process.on('SIGINT', async () => {
        console.log('\n🛑 Shutdown signal received, closing server...');

        // Close Redis connections
        if (redisConnected && effectiveRedisClient) {
            try {
                await effectiveRedisClient.quit();
                console.log('✅ Redis connection closed gracefully');
            } catch (error) {
                console.error('❌ Error closing Redis connection:', error);
            }
        }

        // Close Express server
        server.close(() => {
            console.log('✅ Express server closed gracefully');
            process.exit(0);
        });
    });
}

startServer();

////////////////////////////////////////////////////////////////////////
