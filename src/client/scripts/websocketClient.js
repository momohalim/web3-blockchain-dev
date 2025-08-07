import { io } from "socket.io-client";
import { PORT_WEBSOCKET } from "./env.js";
import { useGlobalStore } from "@/client/stores/global";
import { storeToRefs } from "pinia";
import { onFrontendLogout } from "@/client/scripts/chains/shared.js";


let socket;

function getCurrentJwt() {
  // Always use the token for the currently selected wallet
  try {
    const store = useGlobalStore();
    const { crypto_selected } = storeToRefs(store);
    const selected = crypto_selected.value;
    if (selected === 'ethereum') return sessionStorage.getItem('eth_token');
    if (selected === 'bitcoin') return sessionStorage.getItem('btc_token');
    if (selected === 'solana') return sessionStorage.getItem('sol_token');
    if (selected === 'cardano') return sessionStorage.getItem('ada_token');
    if (selected === 'aptos') return sessionStorage.getItem('apt_token');
    if (selected === 'sui') return sessionStorage.getItem('sui_token');

  } catch (e) {
    console.error('[WS CLIENT] Error retrieving token:', e);
    // fallback to any available token
    return sessionStorage.getItem('eth_token') || sessionStorage.getItem('btc_token') || sessionStorage.getItem('sol_token') || sessionStorage.getItem('ada_token') || sessionStorage.getItem('apt_token') || sessionStorage.getItem('sui_token'); // Added Sui to fallback
  }
  return null;
}

function initializeWebSocket() {

  const token = getCurrentJwt();
  console.log('[WS CLIENT] Initializing WebSocket with token:', token);
  // Get wallet address from global store
  let walletAddress = '';
  try {
    const store = useGlobalStore();
    const { wallet_connected_address } = storeToRefs(store);
    // Dynamically import the global store and get the addressconst globalStore = window.__pinia?.global || (window.$pinia && window.$pinia.global) || null;
    walletAddress = wallet_connected_address.value;
    console.log('[WS CLIENT] Wallet address:', walletAddress);
  } catch (e) {
    console.error('[WS CLIENT] Error getting wallet address from global store:', e);
  }
  if (!token || !walletAddress) {
    console.error('[WS CLIENT] No token or wallet address found. WebSocket connection cannot be established.');
    return;
  }
  // Use wss:// in production (https), ws:// for localhost/dev
  const isProduction = window.location.protocol === 'https:';
  const protocol = isProduction ? 'wss' : 'ws';
  const host = window.location.hostname;
  const url = `${protocol}://${host}:${PORT_WEBSOCKET}`;

  socket = io(url, {
    auth: { token, wallet_address: walletAddress },
    secure: isProduction,
    transports: ['websocket'],
    rejectUnauthorized: !isProduction, // Allow self-signed certs in dev only
  });

  // Monkey-patch socket.emit for double security
  const originalEmit = socket.emit;
  socket.emit = function (event, ...args) {
    // Only patch for custom events (not built-in events)
    if (typeof event === 'string' && !event.startsWith('internal') && event !== 'disconnect' && event !== 'connect') {
      // Pinia global state checks
      try {
        const store = useGlobalStore();
        const refs = storeToRefs(store);
        const crypto_selected = refs.crypto_selected.value;
        const wallet_selected = refs.wallet_selected.value;
        const is_authenticated = refs.is_authenticated.value;
        const wallet_connected_address = refs.wallet_connected_address.value;
        if (!crypto_selected || !wallet_selected || !is_authenticated || !wallet_connected_address) {
          console.error('[WS CLIENT] Blocked emit: Required global state missing or invalid.');
          return; // Block sending
        }
      } catch (e) {
        console.error('[WS CLIENT] Error checking global state before emit:', e);
        return;
      }
      const jwt = getCurrentJwt();
      if (args.length > 0 && typeof args[0] === 'object' && args[0] !== null) {
        args[0].jwt = jwt;
      } else {
        // If first arg is not an object, wrap it
        args.unshift({ jwt });
      }
    }
    return originalEmit.apply(this, [event, ...args]);
  };

  socket.on("connect", async () => {
    sendAuthenticatedMessage("private_message", "Hello from the client!");
    sendAuthenticatedMessage("global_message", "Hello, everyone!");
  });

  // Listen for private messages
  socket.on("private_message", (data) => {
    console.log('[WS CLIENT] Private message received:', data);
  });

  // Listen for global messages
  socket.on("global_message", (data) => {
    console.log('[WS CLIENT] Global message received:', data);
  });

  socket.on("disconnect", () => {
    console.warn('[WS CLIENT] WebSocket disconnected');
  });

  socket.on("connect_error", (err) => {
    console.error('[WS CLIENT] WebSocket connection error:', err.message);
    onFrontendLogout(); // Handle logout on connection error
    const store = useGlobalStore();
    const { navigation_state_page, } = storeToRefs(store);
    navigation_state_page.value = 'server_offline'; // Reset to games page on error
  });

  socket.on("flying_chip_yellow_server", () => {
    const btn = spawnSpecialCoin();
    btn.addEventListener('click', () => {
      if (!socket || !socket.connected) {
        console.error('[WS CLIENT] WebSocket not connected. Cannot emit flying_chip_yellow_client.');
        return;
      }
      sendAuthenticatedMessage('flying_chip_yellow_client', {});
    });

  });

  socket.on('session_replaced', () => {
    const store = useGlobalStore();
    const { navigation_state_page, } = storeToRefs(store);
    navigation_state_page.value = 'games';
    onFrontendLogout();
  });

}

function isWebSocketAuthenticated() { return !!(socket && socket.connected && getCurrentJwt()); };

function disconnectWebSocket() {
  if (socket && socket.connected) {
    socket.disconnect();
  }
}

function sendAuthenticatedMessage(event, message) {
  if (!isWebSocketAuthenticated()) {
    console.error('[WS CLIENT] WebSocket not authenticated. Cannot send message.');
    return;
  }
  const token = getCurrentJwt();
  if (!token) {
    console.error('[WS CLIENT] No JWT token found. Cannot send message.');
    return;
  }
  // Basic message validation
  if (typeof message !== 'string' && typeof message !== 'object') {
    console.error('[WS CLIENT] Invalid message.');
    return;
  }
  // if (typeof message === 'object') {
  //   message = JSON.stringify(message);
  // }
  if (!socket || !socket.connected) {
    console.error('[WS CLIENT] WebSocket not connected.');
    return;
  }
  // Send message with JWT attached (emit is already patched, but keep for clarity)
  socket.emit(event, { message, jwt: token });
}

function getSocket() {
  if (!socket) {
    console.error('[WS CLIENT] Socket not initialized. Call initializeWebSocket first.');
    return null;
  }
  return socket;
}


// Create an async function to replicate GET request functionality using WebSockets
async function websocketGet(event, requestData = {}) {
  // Send the request event
  sendAuthenticatedMessage("get_data", { event, requestData });
  return new Promise((resolve, reject) => {

    if (!isWebSocketAuthenticated()) {
      console.error('[WS CLIENT] WebSocket not authenticated. Cannot send request.');
      return reject('WebSocket not authenticated');
    }

    const token = getCurrentJwt();
    if (!token) {
      console.error('[WS CLIENT] No JWT token found. Cannot send request.');
      return reject('No JWT token found');
    }

    // Listen for the response event
    socket.once(`${event}_response`, (response) => {
      if (response.success) {
        resolve(response.data);
      } else {
        console.log(event, requestData)
        console.error(`[WS CLIENT] Error in ${event} response:`, response.error);
        reject(response.error);
      }
    });
  });
}


export { getSocket, initializeWebSocket, disconnectWebSocket, sendAuthenticatedMessage, websocketGet };
