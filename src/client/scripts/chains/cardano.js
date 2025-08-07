import axios from "axios";
import { useGlobalStore } from '@/client/stores/global';
import { storeToRefs } from 'pinia';

import { CARDANO_PRIVATE_WALLET_ADDRESS } from "../env.js";
import { cryptobet } from "../cryptobet.js";
import { onFrontendAuthenticated } from "./shared.js";

cryptobet.cardano = {
  lace: {
    installed: !!window?.cardano?.lace,
    provider: window?.cardano?.lace,
  },
  eternl: {
    installed: !!window?.cardano?.eternl,
    provider: window?.cardano?.eternl,
  },
  yoroi: {
    installed: !!window?.cardano?.yoroi,
    provider: window?.cardano?.yoroi,
  },
  typhon: {
    installed: !!window?.cardano?.typhoncip30 || !!window?.cardano?.typhon,
    provider: window?.cardano?.typhoncip30 || window?.cardano?.typhon,
  },
};

const ADA_TOKEN_KEY = "ada_token";
const ADA_REFRESH_TOKEN_KEY = "ada_refresh_token";
let cardanoToken = sessionStorage.getItem(ADA_TOKEN_KEY) || null;
let cardanoRefreshToken = sessionStorage.getItem(ADA_REFRESH_TOKEN_KEY) || null;

function setCardanoToken(token) {
  // Defensive: if token is an object, extract .token property
  if (typeof token === 'object' && token !== null) {
    if (token.token && typeof token.token === 'string') {
      console.warn('[CARDANO] setCardanoToken received object, extracting .token:', token);
      token = token.token;
    } else {
      console.error('[CARDANO] setCardanoToken received invalid object, cannot extract JWT:', token);
      throw new Error('setCardanoToken: Invalid token object passed');
    }
  }
  if (typeof token !== 'string' || !/^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(token)) {
    console.error('[CARDANO] setCardanoToken called with non-JWT string:', token);
    throw new Error('setCardanoToken: Non-JWT string passed');
  }
  cardanoToken = token;
  sessionStorage.setItem(ADA_TOKEN_KEY, token);
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}
// AUDIT: All calls to setCardanoToken() must pass only the JWT string. This function will now throw if not.

function setCardanoRefreshToken(refreshToken) {
  cardanoRefreshToken = refreshToken;
  sessionStorage.setItem(ADA_REFRESH_TOKEN_KEY, refreshToken);
}
function clearCardanoSession() {
  cardanoToken = null;
  cardanoRefreshToken = null;
  sessionStorage.removeItem(ADA_TOKEN_KEY);
  sessionStorage.removeItem(ADA_REFRESH_TOKEN_KEY);
  delete axios.defaults.headers.common['Authorization'];
}

function isValidCardanoAddress(addr) {
  return typeof addr === 'string' && /^addr(_test)?1[0-9a-z]{20,150}$/.test(addr);
}

function toHex(str) {
  return Array.from(str).map(c => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
}

async function loginWithCardano(walletType) {
  try {
    const provider = cryptobet.cardano[walletType]?.provider;
    if (!provider) throw new Error("Wallet not available");
    let api = provider;
    if (typeof provider.enable === "function") {
      api = await provider.enable();
    }
    let address = null;
    if (typeof api.getUsedAddresses === "function") {
      const usedAddresses = await api.getUsedAddresses();
      if (usedAddresses && usedAddresses.length > 0) {
        address = usedAddresses[0];
      }
    }
    if (!address && typeof api.getChangeAddress === "function") {
      const changeAddr = await api.getChangeAddress();
      address = changeAddr;
    }
    if (!address && typeof api.getRewardAddresses === "function") {
      const rewardAddresses = await api.getRewardAddresses();
      if (rewardAddresses && rewardAddresses.length > 0) {
        address = rewardAddresses[0];
      }
    }
    if (!address) throw new Error("No Cardano address found in wallet.");
    let bech32Address = address;
    if (!isValidCardanoAddress(bech32Address)) {
      const { data } = await axios.post("/api/cardanoHex2bech32", { hex: address });
      if (!data?.bech32) throw new Error("Backend could not convert address to bech32.");
      bech32Address = data.bech32;
    }
    if (!isValidCardanoAddress(bech32Address)) {
      throw new Error("This dApp requires a Cardano payment (addr1...) address.");
    }
    const { data: nonceResp } = await axios.post("/api/nonceCardano", {
      address: bech32Address,
      walletType,
    });
    if (!nonceResp?.nonce) throw new Error("Could not get authentication nonce.");
    const hexMessage = toHex(nonceResp.nonce);
    if (typeof api.signData !== "function")
      throw new Error("signData not supported by this wallet.");
    const signed = await api.signData(bech32Address, hexMessage);
    if (!signed || !signed.signature || !signed.key)
      throw new Error("Failed to sign authentication message.");
    const { data: authResp } = await axios.post("/api/verifyCardanoSignature", {
      address: bech32Address,
      walletType,
      nonce: nonceResp.nonce,
      signature: signed.signature,
      key: signed.key,
    });
    console.debug('[CARDANO] /api/verifyCardanoSignature response:', authResp);
    // Defensive: log the full response for debugging
    console.debug('[CARDANO] /api/verifyCardanoSignature response (raw):', authResp);
    // If token or refreshToken are objects, extract their string value if possible
    let jwtToken = authResp.token;
    let refreshToken = authResp.refreshToken;
    if (typeof jwtToken === 'object' && jwtToken !== null && jwtToken.token) {
      console.warn('[CARDANO] authResp.token is object, extracting .token:', jwtToken);
      jwtToken = jwtToken.token;
    }
    // Defensive: flatten nested token/refreshToken if needed (handle {token: {}})
    if (jwtToken && typeof jwtToken === 'object') {
      if (jwtToken.token && typeof jwtToken.token === 'string') {
        console.warn('[CARDANO] authResp.token is nested object, extracting .token.token:', jwtToken);
        jwtToken = jwtToken.token;
      } else {
        console.error('[CARDANO] authResp.token is invalid nested object:', jwtToken);
        jwtToken = '';
      }
    }
    if (refreshToken && typeof refreshToken === 'object') {
      if (refreshToken.refreshToken && typeof refreshToken.refreshToken === 'string') {
        console.warn('[CARDANO] authResp.refreshToken is nested object, extracting .refreshToken.refreshToken:', refreshToken);
        refreshToken = refreshToken.refreshToken;
      } else {
        console.error('[CARDANO] authResp.refreshToken is invalid nested object:', refreshToken);
        refreshToken = '';
      }
    }
    // Defensive: If token/refreshToken are not strings, throw and log error before calling setCardanoToken
    if (typeof jwtToken !== 'string' || !/^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(jwtToken)) {
      console.error('[CARDANO] loginWithCardano: JWT token is not a valid string:', jwtToken);
      clearCardanoSession();
      throw new Error('loginWithCardano: Invalid JWT token received from backend');
    }
    if (typeof refreshToken !== 'string' || !/^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(refreshToken)) {
      console.error('[CARDANO] loginWithCardano: Refresh token is not a valid string:', refreshToken);
      clearCardanoSession();
      throw new Error('loginWithCardano: Invalid refresh token received from backend');
    }
    setCardanoToken(jwtToken);
    setCardanoRefreshToken(refreshToken);

    // Set wallet address and balance in global store for WebSocket auth and dropdown
    let balance = -1;
    try {
      if (typeof api.getBalance === 'function') {
        // getBalance returns hex string (lovelace), convert to ADA
        const balanceHex = await api.getBalance();
        if (typeof balanceHex === 'string') {
          let lovelace = 0;
          if (/^0x[0-9a-fA-F]+$/.test(balanceHex)) {
            lovelace = parseInt(balanceHex, 16);
          } else if (/^[0-9]+$/.test(balanceHex)) {
            lovelace = parseInt(balanceHex, 10);
          }
          balance = isNaN(lovelace) ? -1 : (lovelace / 1_000_000);
        } else if (typeof balanceHex === 'number') {
          balance = balanceHex / 1_000_000;
        } else {
          balance = -1;
        }
      } else if (typeof api.getUtxos === 'function') {
        // Fallback: sum all UTXOs
        const utxos = await api.getUtxos();
        if (Array.isArray(utxos)) {
          let total = 0;
          for (const utxo of utxos) {
            if (utxo && utxo.amount && Array.isArray(utxo.amount)) {
              for (const amt of utxo.amount) {
                if (amt.unit === 'lovelace') {
                  total += parseInt(amt.quantity, 10);
                }
              }
            }
          }
          balance = isNaN(total) ? -1 : (total / 1_000_000);
        }
      }
    } catch (e) {
      console.error('[CARDANO] getBalance/getUtxos threw:', e);
      balance = -1;
    }



    //> here <

    try {
      const store = useGlobalStore();
      const { wallet_connected_address, coin_crypto } = storeToRefs(store);
      wallet_connected_address.value = bech32Address;
      coin_crypto.value = balance;

      await axios.post('/api/updateCardanoBalance', {
        balance,
        walletAddress: wallet_connected_address.value,
      });

    } catch (e) {
      console.error('[CARDANO] loginWithCardano: Failed to set wallet_connected_address or coin_crypto in global store:', e);
    }

    // Log after setting tokens
    onFrontendAuthenticated(bech32Address, balance);
    return {
      address: bech32Address,
      walletType,
      token: jwtToken,
      refreshToken: refreshToken,
      balance,
    };
  } catch (err) {
    clearCardanoSession();
    return { error: err?.message || "Cardano login failed" };
  }
}

async function logoutCardano() {
  try {
    for (const key in cryptobet.cardano) {
      const w = cryptobet.cardano[key];
      if (w?.provider?.disconnect instanceof Function) await w.provider.disconnect();
    }
  } catch { }
  clearCardanoSession();
}

async function refreshCardanoToken() {
  if (!cardanoRefreshToken) return false;
  try {
    const { data } = await axios.post("/api/refreshCardano", {
      refreshToken: cardanoRefreshToken,
    });
    if (data?.token && data?.refreshToken) {
      setCardanoToken(data.token);
      setCardanoRefreshToken(data.refreshToken);
      return true;
    }
    throw new Error("No new token returned.");
  } catch {
    clearCardanoSession();
    return false;
  }
}

function updateCardanoWalletsAvailable() {
  const cardanoButtons = {
    lace: document.querySelectorAll('.cardano.lace'),
    eternl: document.querySelectorAll('.cardano.eternl'),
    yoroi: document.querySelectorAll('.cardano.yoroi'),
    typhon: document.querySelectorAll('.cardano.typhon'),
  };
  for (const walletKey in cardanoButtons) {
    const isInstalled = cryptobet.cardano[walletKey].installed;
    if (!isInstalled) {
      const button = cardanoButtons[walletKey][0];
      button.classList.add('locked');
      button.disabled = true;
      button.style.opacity = 0.25;
      const h2 = button.querySelector('h2');
      if (h2) {
        h2.classList.remove('glitched');
        h2.classList.remove('cyberpunk');
      }
    }
  }
}

async function selectWalletCardano(walletType) {
  return await loginWithCardano(walletType);
}

async function disconnectWalletCardano() {
  await logoutCardano();
}

async function sendTransactionsCardano(walletProvider, amountInAda, walletType) {
  try {
    const lovelaceAmount = Math.floor(amountInAda * 1000000); // Convert ADA to Lovelace

    // Get wallet API
    let api = walletProvider;
    if (typeof walletProvider.enable === "function") {
      api = await walletProvider.enable();
    }

    // Get wallet address
    let address = null;
    if (typeof api.getUsedAddresses === "function") {
      const usedAddresses = await api.getUsedAddresses();
      if (usedAddresses && usedAddresses.length > 0) {
        address = usedAddresses[0];
      }
    }
    if (!address && typeof api.getChangeAddress === "function") {
      address = await api.getChangeAddress();
    }

    if (!address) {
      throw new Error('Unable to get wallet address');
    }

    // Convert to bech32 if needed
    let bech32Address = address;
    if (!isValidCardanoAddress(bech32Address)) {
      const { data } = await axios.post("/api/cardanoHex2bech32", { hex: address });
      if (!data?.bech32) throw new Error("Backend could not convert address to bech32.");
      bech32Address = data.bech32;
    }

    // Get UTXOs
    const utxos = await api.getUtxos();
    if (!utxos || utxos.length === 0) {
      throw new Error('No UTXOs available');
    }

    // Build transaction outputs
    const outputs = [{
      address: CARDANO_PRIVATE_WALLET_ADDRESS,
      amount: {
        coin: lovelaceAmount.toString()
      }
    }];

    // Build transaction
    // Note: This is a simplified implementation
    // In a production environment, you would need proper CBOR encoding,
    // fee calculation, UTXO selection, and change handling
    const txBuilder = {
      inputs: utxos.slice(0, 1), // Use first UTXO (simplified)
      outputs: outputs,
      fee: '200000', // 0.2 ADA fee (simplified)
      ttl: null
    };

    // Build, sign, and submit transaction
    let unsignedTx;
    if (typeof api.buildTx === 'function') {
      unsignedTx = await api.buildTx(txBuilder);
    } else {
      // Fallback for wallets that don't support buildTx
      throw new Error(`Transaction building not supported for ${walletType} wallet`);
    }

    const signedTx = await api.signTx(unsignedTx, true);
    const txHash = await api.submitTx(signedTx);

    return txHash;
  } catch (error) {
    console.error('[CARDANO] Transaction failed:', error);
    throw error;
  }
}

export {
  loginWithCardano,
  logoutCardano,
  refreshCardanoToken,
  isValidCardanoAddress,
  updateCardanoWalletsAvailable,
  selectWalletCardano,
  disconnectWalletCardano,
  sendTransactionsCardano,
};
