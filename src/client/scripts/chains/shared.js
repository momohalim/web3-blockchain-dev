import axios from 'axios';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { useGlobalStore, } from '../../stores/global.js';
import { storeToRefs } from "pinia";
import { initializeWebSocket, disconnectWebSocket } from "@/client/scripts/websocketClient";
////////////////////////////////////////////////////////////////////////

async function onFrontendAuthenticated(walletAddress, walletBalance) {

  const store = useGlobalStore();
  const { is_authenticated, wallet_connected_address, coin_crypto, crypto_selected, wallet_selected, } = storeToRefs(store);


  await axios.post('/api/update_wallet_crypto', {
    walletAddress,
    walletBalance,
    cryptoSelected: crypto_selected.value
  });

  is_authenticated.value = true;
  wallet_connected_address.value = walletAddress;
  coin_crypto.value = walletBalance;

  //console.log('[onFrontendAuthenticated] Called with', walletAddress, walletBalance);
  initializeWebSocket();

  // Gather user session and connection details
  const userAgent = navigator.userAgent;
  const platform = navigator.userAgentData ? navigator.userAgentData.platform : navigator.platform;
  const language = navigator.language;
  const ipAddress = await fetch('https://api.ipify.org?format=json').then(res => res.json()).then(data => data.ip).catch(() => 'Unknown IP');
  const timestamp = new Date().toISOString();

  // Initialize FingerprintJS and get the visitor data
  const fp = await FingerprintJS.load();
  const result = await fp.get();
  const fingerprint = result.visitorId;

  // Attempt to get geolocation data
  let geoLocation = 'Unknown Location';
  try {
    const geoResponse = await fetch(`https://ipapi.co/${ipAddress}/json/`);
    if (geoResponse.ok) {
      const geoData = await geoResponse.json();
      geoLocation = `${geoData.city}, ${geoData.region}, ${geoData.country_name}`;
    }
  } catch (error) {
    console.warn('Failed to fetch geolocation data:', error);
  }

  // When logging authentication, always send crypto_selected
  const logEntry = {
    timestamp,
    walletAddress,
    walletBalance,
    userAgent,
    platform,
    language,
    ipAddress,
    geoLocation,
    fingerprint
  }; try {
    const adaToken = sessionStorage.getItem('ada_token');
    const ethToken = sessionStorage.getItem('eth_token');
    const btcToken = sessionStorage.getItem('btc_token');
    const solToken = sessionStorage.getItem('sol_token');
    const aptToken = sessionStorage.getItem('apt_token');
    const suiToken = sessionStorage.getItem('sui_token');
    const token = adaToken || ethToken || btcToken || solToken || aptToken || suiToken || '';

    // Ensure the Authorization header is always a string
    const authHeader = `Bearer ${token}`;

    await axios.post('/api/logAuthentication', {
      walletAddress,
      logEntry,
      cryptoSelected: crypto_selected.value,
    }, {
      headers: { Authorization: authHeader }
    });
  } catch (error) {
    console.error('Failed to send log entry to the server:', error);
  }

}

////////////////////////////////////////////////////////////////////////

function onFrontendLogout() {

  disconnectWebSocket();

  const store = useGlobalStore();
  const {
    navigation_state_page,
    navigation_state_overlay,
    navigation_state_dialog,
    game_playing_name,
    game_playing_input,
    game_playing_bet_type,
    game_playing_bet_amount,
    game_playing_waiting_result,
    showDropdownProfile,

    is_authenticated,
    wallet_connected_address,
    coin_crypto,
    crypto_selected,
    wallet_selected,

    chip_yellow,
    chip_red,
    chip_blue,
    chip_green
  } = storeToRefs(store);

  navigation_state_page.value = 'games';
  navigation_state_overlay.value = '';
  navigation_state_dialog.value = '';
  game_playing_name.value = '';
  game_playing_input.value = -1;
  game_playing_bet_type.value = 'red';
  game_playing_bet_amount.value = 1;
  game_playing_waiting_result.value = false;
  showDropdownProfile.value = false;

  is_authenticated.value = false;
  wallet_connected_address.value = '';
  coin_crypto.value = 0;
  crypto_selected.value = 'solana';
  wallet_selected.value = 'phantom';

  chip_yellow.value = 0;
  chip_red.value = 0;
  chip_blue.value = 0;
  chip_green.value = 0;

  axios.defaults.headers.common['Authorization'] = '';

  if (window.socket && typeof window.socket.disconnect === 'function') {
    window.socket.disconnect();
  }
  console.log('[FRONTEND] Wallet logout');
}

function isRedisConnected(redisClient) {
  // Node redis v4 exposes `.isOpen` property
  return redisClient && redisClient.isOpen;
}

////////////////////////////////////////////////////////////////////////

export { onFrontendAuthenticated, onFrontendLogout, isRedisConnected };

////////////////////////////////////////////////////////////////////////