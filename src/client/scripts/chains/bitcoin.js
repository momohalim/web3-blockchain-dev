import axios from 'axios';
import { request } from 'sats-connect';

import { BITCOIN_PRIVATE_WALLET_ADDRESS } from "../env.js";
import { cryptobet } from "../cryptobet.js";
import { onFrontendAuthenticated } from "./shared.js";

////////////////////////////////////////////////////////////////////////

setInterval(refreshJwtTokenBitcoin, 14 * 60 * 1000); // every 14 minutes

////////////////////////////////////////////////////////////////////////

let authBitcoinToken = null;

function setJwtToken(token) {
  authBitcoinToken = token;
  sessionStorage.setItem('btc_token', token);
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

// On load, initialize JWT from sessionStorage if present
const storedToken = sessionStorage.getItem('btc_token');
if (storedToken) {
  setJwtToken(storedToken);
}

///////////////////////////////////////////////////////////////////////

cryptobet.bitcoin = {
  xverse: {
    installed: !!window?.XverseProviders?.BitcoinProvider,
    provider: window?.XverseProviders?.BitcoinProvider,
  },
  unisat: {
    installed: !!window?.unisat,
    provider: window?.unisat,
  },
  leather: {
    installed: (!!window?.LeatherProvider),
    provider: window?.LeatherProvider,
  },
};

////////////////////////////////////////////////////////////////////////

function updateBitcoinWalletsAvailable() {

  const bitcoinButtons = {
    xverse: document.querySelectorAll('.bitcoin.xverse'),
    unisat: document.querySelectorAll('.bitcoin.unisat'),
    leather: document.querySelectorAll('.bitcoin.leather'),
  };

  for (const walletKey in bitcoinButtons) {
    const isInstalled = cryptobet.bitcoin[walletKey].installed;
    if (!isInstalled) {
      const button = bitcoinButtons[walletKey][0];
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

////////////////////////////////////////////////////////////////////////

function disconnectWalletBitcoin() {

  sessionStorage.removeItem('btc_token');
  sessionStorage.removeItem('btc_refresh_token');
  authBitcoinToken = null;

}

////////////////////////////////////////////////////////////////////////

async function selectWalletBitcoin(walletType) {
  walletType = walletType.toLowerCase();
  if (walletType === 'xverse') return await loginWithXverse();
  if (walletType === 'unisat') return await loginWithUnisat();
  if (walletType === 'leather') return await loginWithLeather();
  throw new Error('Unsupported wallet type');
}

////////////////////////////////////////////////////////////////////////

async function loginWithXverse() {
  if (!cryptobet.bitcoin.xverse.installed) throw new Error('Xverse wallet not found');
  const network = 'Mainnet';
  const connectRes = await request('wallet_connect', {
    addresses: ['payment', 'ordinals'],
    message: 'Connect Xverse to CyberBet.Games',
    network,
  });
  if (connectRes.status !== 'success') throw new Error('Wallet connect failed');
  const address = connectRes.result.addresses.find(a => a.purpose === 'payment').address;
  const nonce = await getNonceBitcoin(address, 'xverse');
  const signRes = await request('signMessage', { address, message: nonce });
  if (signRes.status !== 'success') throw new Error('Message signing failed');
  const signature = signRes.result.signature;
  const verify = await verifyBitcoinSignature(address, signature, 'xverse');
  if (!verify.success) throw new Error(verify.error || 'Signature verification failed');
  // Fetch balance after successful signature
  let balance = -1;
  try {
    const res = await axios.get(`/api/btc-balance/${address}`);
    if (res.data && typeof res.data.balance === 'number') {
      balance = res.data.balance;
    }
  } catch (e) {
    // fallback: leave balance as -1
  }
  sessionStorage.setItem("btc_token", verify.token);
  axios.defaults.headers.common["Authorization"] = `Bearer ${verify.token}`;
  onFrontendAuthenticated(address, balance);
  return verify;
}

////////////////////////////////////////////////////////////////////////

async function loginWithUnisat() {
  if (!cryptobet.bitcoin.unisat.installed) throw new Error('Unisat wallet not found');
  const accounts = await window.unisat.requestAccounts();
  const address = accounts[0];
  const nonce = await getNonceBitcoin(address, 'unisat');
  const signature = await window.unisat.signMessage(nonce);
  const verify = await verifyBitcoinSignature(address, signature, 'unisat');
  if (!verify.success) {
    console.error('[DEBUG] verifyBitcoinSignature error:', verify);
    throw new Error(verify.error || 'Signature verification failed');
  }
  // Fetch balance after successful signature
  let balance = -1;
  try {
    const res = await axios.get(`/api/btc-balance/${address}`);
    if (res.data && typeof res.data.balance === 'number') {
      balance = res.data.balance;
    }
  } catch (e) {
    // fallback: leave balance as -1
  }
  sessionStorage.setItem("btc_token", verify.token);
  axios.defaults.headers.common["Authorization"] = `Bearer ${verify.token}`;
  onFrontendAuthenticated(address, balance);
  return verify;
}

////////////////////////////////////////////////////////////////////////

async function loginWithLeather() {
  if (!cryptobet.bitcoin.leather.installed) throw new Error('Leather wallet not found');
  const provider = cryptobet.bitcoin.leather.provider;
  if (!provider) throw new Error('Leather provider not found');
  const accounts = await provider.request('getAddresses');
  const address = accounts.result.addresses[0].address;
  const nonce = await getNonceBitcoin(address, 'leather');
  // Leather does not expose getPublicKey, so we skip publicKey for now
  const signature = await provider.request('signMessage', { address, message: nonce });
  // Send address, signature, walletType (no publicKey)
  const verify = await verifyBitcoinSignature(address, signature, 'leather');
  if (!verify.success) throw new Error(verify.error || 'Signature verification failed');
  // Fetch balance after successful signature
  let balance = -1;
  try {
    const res = await axios.get(`/api/btc-balance/${address}`);
    if (res.data && typeof res.data.balance === 'number') {
      balance = res.data.balance;
    }
  } catch (e) {
    // fallback: leave balance as -1
  }
  sessionStorage.setItem("btc_token", verify.token);
  axios.defaults.headers.common["Authorization"] = `Bearer ${verify.token}`;
  onFrontendAuthenticated(address, balance);
  return verify;
}

////////////////////////////////////////////////////////////////////////

async function getNonceBitcoin(address, walletType) {
  const response = await axios.post('/api/nonceBitcoin', { address, walletType });
  return response.data.nonce;
}

async function verifyBitcoinSignature(address, signature, walletType) {
  const response = await axios.post('/api/verifyBitcoin', { address, signature, walletType });
  return response.data;
}

async function initializeTokensBitcoin(address) {
  const response = await axios.post('/api/initializeTokensBitcoin', { address });
  return response.data;
}

function refreshJwtTokenBitcoin() {
  let token = sessionStorage.getItem("btc_refresh_token");
  if (!token) return;
  axios.post('/api/refreshTokenBitcoin', { refreshTokenBitcoin: token })
    .then(res => {
      if (res.data?.token) {
        sessionStorage.setItem('btc_token', res.data.token);
        sessionStorage.setItem('btc_refresh_token', res.data.refreshTokenBitcoin);
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
      }
    })
    .catch(err => {
      console.warn('[FRONTEND] Token refresh failed:', err);
    });
}

////////////////////////////////////////////////////////////////////////

async function sendTransactionsBitcoin(walletProvider, amountInBtc, walletType) {
  try {
    const satoshis = Math.floor(amountInBtc * 100000000); // Convert BTC to satoshis

    if (walletType === 'xverse') {
      const sendBtcOptions = {
        payload: {
          network: 'Mainnet',
          recipients: [
            {
              address: BITCOIN_PRIVATE_WALLET_ADDRESS,
              amountSats: satoshis,
            },
          ],
        },
        onFinish: (response) => {
          return response.txid;
        },
        onCancel: () => {
          throw new Error('Transaction cancelled by user');
        },
      };

      const result = await request('sendTransfer', sendBtcOptions);
      return result.txid;

    } else if (walletType === 'unisat') {
      const txid = await window.unisat.sendBitcoin(BITCOIN_PRIVATE_WALLET_ADDRESS, satoshis);
      return txid;

    } else if (walletType === 'leather') {
      // Leather wallet transaction implementation
      const provider = cryptobet.bitcoin.leather.provider;
      const sendRequest = {
        address: BITCOIN_PRIVATE_WALLET_ADDRESS,
        amount: satoshis,
      };

      const result = await provider.request('sendTransfer', sendRequest);
      return result.txid;

    } else {
      throw new Error(`Bitcoin transactions not yet implemented for ${walletType}`);
    }
  } catch (error) {
    console.error('[BITCOIN] Transaction failed:', error);
    throw error;
  }
}

////////////////////////////////////////////////////////////////////////

export {
  updateBitcoinWalletsAvailable,
  disconnectWalletBitcoin,
  selectWalletBitcoin,
  loginWithXverse,
  loginWithUnisat,
  loginWithLeather,
  getNonceBitcoin,
  verifyBitcoinSignature,
  initializeTokensBitcoin,
  sendTransactionsBitcoin,
};

////////////////////////////////////////////////////////////////////////
