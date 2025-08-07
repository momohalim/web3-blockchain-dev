import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import { Pool } from 'pg';
import https from 'https';

import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Server } = require('socket.io');
import { verifyJWT, refreshJWT } from './jwt.js';
import {
  addCoin, getCoin, subCoin, setFlyingCoinYellow, getFlyingCoinYellow, redeemCode,
  setGameClickerToken, getGameClickerToken, getGameClickerData, setGameClickerData
} from './data.js'
import dotenv from 'dotenv';
dotenv.config();


////////////////////////////////////////////////////////////////////////////////////////


const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

// Use HTTP server for WS in development, HTTPS for WSS in production
const isProduction = process.env.NODE_ENV === 'production' || process.env.USE_WSS === 'true';
let server;
if (isProduction) {
  server = https.createServer({
    key: fs.readFileSync('src/server/certs/cyberbet.games-key.pem'),
    cert: fs.readFileSync('src/server/certs/cyberbet.games-crt.pem'),
  });
  console.log('[WS SERVER] Using HTTPS (WSS)');
} else {
  const http = require('http');

  server = http.createServer();
  console.log('[WS SERVER] Using HTTP (WS)');
}
const io = new Server(server, {
  cors: {
    origin: "http://localhost:666", // Update to your production domain in prod
    methods: ["GET", "POST"],
  },
});


////////////////////////////////////////////////////////////////////////////////////////


// Track the number of users in the global room
let globalRoomCount = 0;
// Helper to update and broadcast global room count
function updateGlobalRoomCount() {
  const room = io.sockets.adapter.rooms.get('global_room');
  globalRoomCount = room ? room.size : 0;
  // io.to('global_room').emit('global_room_count', globalRoomCount);
}

// Export a function to disconnect all sockets for a wallet address
function disconnectAllSocketsForWallet(address) {
  if (!address) return;
  const sockets = socketsByWallet.get(address);
  if (sockets) {
    for (const sock of sockets) {
      // Notify the client about session replacement
      sock.emit('session_replaced');
      sock.disconnect(true);
    }
    socketsByWallet.delete(address);
  }
}


////////////////////////////////////////////////////////////////////////////////////////


// Middleware to authenticate WebSocket connections
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  const refreshToken = socket.handshake.auth.refreshToken;
  // console.log('[WS SERVER] Received token:', token);
  // console.log('[WS SERVER] Received refresh token:', refreshToken);

  if (!token) {
    console.error('[WS AUTH] No token provided in handshake. Socket ID:', socket.id);
    return next(new Error('Authentication error: Missing token'));
  }

  try {
    const payload = await verifyJWT(token);
    // console.log('[WS SERVER] Token verified. Payload:', payload);
    socket.user = payload; // Attach user data to the socket
    next();
  } catch (err) {
    console.error('[WS AUTH] Token verification failed:', err);
    if (err.code === 'ERR_JWT_EXPIRED') {
      console.warn('[WS AUTH] JWT expired. Attempting to refresh token. Socket ID:', socket.id);

      if (!refreshToken) {
        console.error('[WS AUTH] No refresh token provided. Cannot refresh expired JWT. Socket ID:', socket.id);
        return next(new Error('Authentication error: Missing refresh token'));
      }

      try {
        const newToken = await refreshJWT(refreshToken);
        socket.handshake.auth.token = newToken;
        const payload = await verifyJWT(newToken);
        socket.user = payload;

        console.log('[WS AUTH] Token refreshed successfully. Socket ID:', socket.id);
        // socket.emit('new_token', newToken); // Send new token to the client
        next();
      } catch (refreshError) {
        console.error('[WS AUTH] Failed to refresh token. Socket ID:', socket.id, '| Error:', refreshError.message);
        socket.emit('auth_error', { message: 'JWT expired and refresh failed. Please reauthenticate.' });
        return next(new Error('Authentication error: Failed to refresh token'));
      }
    } else {
      console.error('[WS AUTH] Token verification failed:', err.message, '| Socket ID:', socket.id);
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  }
});

// Optionally, middleware to ensure every event is from an authenticated user
io.use((socket, next) => {
  if (!socket.user || !socket.user.address) {
    console.error('[WS AUTH] Event received from unauthenticated socket. Socket ID:', socket.id);
    return next(new Error('Not authenticated'));
  }
  next();
});


////////////////////////////////////////////////////////////////////////////////////////


// Track sockets by wallet address for forced disconnect on logout
const socketsByWallet = new Map();

// Handle WebSocket connections
io.on('connection', (socket) => {
  console.log(`[WS AUTH] User connected: ${socket.user.address} | Socket ID: ${socket.id}`);


  const walletAddress = socket.user.address;


  const userRoom = `user_${socket.user.address}`;
  socket.join(userRoom);
  console.log(`[WS AUTH] User ${socket.user.address} joined private room: ${userRoom}`);


  ////////////////////////////////////////////////////////////////////////////////////////


  // Add the user to the global room
  const globalRoom = 'global_room';
  socket.join(globalRoom);
  updateGlobalRoomCount()


  //////////////////////////////////////////////////////////////////////////////////////////


  // Track socket by wallet address
  const address = socket.user.address;
  if (!socketsByWallet.has(address)) socketsByWallet.set(address, new Set());
  socketsByWallet.get(address).add(socket);


  ////////////////////////////////////////////////////////////////////////////////////////


  // Listen for messages sent to the user's private room
  socket.on('private_message', async (data) => {
    const token = data?.jwt || socket.handshake.auth.token;
    const payload = await validateJWTAndAddress(token, socket, 'private_message');
    if (!payload) return;

    if (typeof data.message !== 'string' || data.message.length > 500) {
      console.warn('[WS AUTH] Invalid message in private_message. Socket ID:', socket.id);
      socket.emit('error', 'Invalid message');
      return;
    }

    const userRoom = `user_${socket.user.address}`;
    io.to(userRoom).emit('private_message', {
      sender: socket.user.address,
      message: data.message,
    });
  });


  ////////////////////////////////////////////////////////////////////////////////////////


  // Listen for messages sent to the global room
  socket.on('global_message', async (data) => {
    const token = data?.jwt || socket.handshake.auth.token;
    const payload = await validateJWTAndAddress(token, socket, 'global_message');
    if (!payload) return;

    if (typeof data.message !== 'string' || data.message.length > 500) {
      console.warn('[WS AUTH] Invalid message in global_message. Socket ID:', socket.id);
      socket.emit('error', 'Invalid message');
      return;
    }
    const globalRoom = 'global_room';
    io.to(globalRoom).emit('global_message', {
      sender: socket.user.address,
      message: data.message,
    });
  });


  ////////////////////////////////////////////////////////////////////////////////////////


  // Handle disconnection
  socket.on('disconnect', () => {
    if (socketsByWallet.has(address)) {
      socketsByWallet.get(address).delete(socket);
      if (socketsByWallet.get(address).size === 0) {
        socketsByWallet.delete(address);
        //console.log('[WS AUTH] All sockets disconnected for', address);
      }
    }
    //console.log(`[WS AUTH] User disconnected: ${address} | Socket ID: ${socket.id}`);
    socket.leave(globalRoom);
  });


  ////////////////////////////////////////////////////////////////////////////////////////


  // Dynamic data retrieval handler
  socket.on('get_data', async (data) => {
    const token = data?.jwt || socket.handshake.auth.token;
    const payload = await validateJWTAndAddress(token, socket, 'get_data');
    if (!payload) return;

    try {
      const { event, requestData } = data.message;
      if (typeof event !== 'string' || !event) {
        console.error('[WS SERVER] Invalid event parameter in get_data.');
        socket.emit(`${event}_response`, { success: false, error: 'Invalid event parameter' });
        return;
      }

      // if (typeof eval(event) !== 'function') {
      //   console.error(`[WS SERVER] No function found for event: ${event}`);
      //   socket.emit('get_data_response', { success: false, error: `No function found for event: ${event}` });
      //   return;
      // }

      // const result = await eval(event)(requestData);
      const result = await eval("get" + String(event).charAt(0).toUpperCase() + String(event).slice(1))(requestData);
      socket.emit(`${event}_response`, { success: true, data: result });
    } catch (error) {
      console.error('[WS SERVER] Error executing event function:', error);
      socket.emit(`${event}_response`, { success: false, error: 'Failed to execute event function' });
    }
  });

});


////////////////////////////////////////////////////////////////////////////////////////


// Start the WebSocket server
server.listen(4004, 'localhost', () => {
  console.log(`[WebSocket Server] listening on port 4004 (${isProduction ? 'WSS' : 'WS'})`);
});

////////////////////////////////////////////////////////////////////////////////////////

async function validateJWTAndAddress(token, socket, eventName) {
  try {
    const payload = await verifyJWT(token);
    if (!payload || !payload.address || payload.address !== socket.user.address) {
      console.warn(`[WS AUTH] Invalid or missing JWT in ${eventName}. Socket ID:`, socket.id);
      socket.emit('error', `Invalid or missing JWT in ${eventName}.`);
      return null;
    }
    return payload;
  } catch (err) {
    console.error(`[WS AUTH] Invalid or expired JWT in ${eventName}. Socket ID:`, socket.id);
    socket.emit('error', `Invalid or expired JWT in ${eventName}.`);
    return null;
  }
}



export { server, io, disconnectAllSocketsForWallet, socketsByWallet, globalRoomCount };