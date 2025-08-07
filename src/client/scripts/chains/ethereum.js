////////////////////////////////////////////////////////////////////////

import axios from 'axios';
import { ethers, BrowserProvider, parseEther, isAddress, formatEther } from 'ethers';

import { ETHEREUM_PRIVATE_WALLET_ADDRESS } from "../env.js";
import { cryptobet } from "../cryptobet.js";
import { onFrontendAuthenticated } from "./shared.js";

/////////////////////////////////////////////////////////////////////////

setInterval(refreshJwtTokenEthereum, 14 * 60 * 1000); // every 14 minutes

////////////////////////////////////////////////////////////////////////

let authEthereumToken = null;

function setJwtToken(token) {
  authEthereumToken = token;
  sessionStorage.setItem('eth_token', token);
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

// On load, initialize JWT from sessionStorage if present
const storedToken = sessionStorage.getItem('eth_token');
if (storedToken) {
  setJwtToken(storedToken);
}

////////////////////////////////////////////////////////////////////////

const trustProvider = window?.trustwallet;
const exodusProvider = window?.exodus?.ethereum;
const enkryptProvider = window?.enkrypt?.providers?.ethereum;

cryptobet.ethereum = {
  coinbase: {
    installed: (!!window?.coinbaseWalletExtension?.isCoinbaseWallet || !!window?.ethereum?.providerMap?.get('CoinbaseWallet')),
    provider: window?.coinbaseWalletExtension || window?.ethereum?.providerMap?.get('CoinbaseWallet'),
  },
  metamask: {
    installed: ((!!window?.ethereum?.providerMap?.get('MetaMask') && !window?.ethereum?.providerMap?.get('MetaMask')?.isTrust) || !!window?.ethereum?.isMetaMask) && !window.ethereum.isEnkrypt,
    provider: window?.ethereum?.providerMap?.get('MetaMask') || window?.ethereum,
  },
  trust: {
    installed: (!!trustProvider),
    provider: trustProvider,
  },
  exodus: {
    installed: !!exodusProvider,
    provider: exodusProvider,
  },
  enkrypt: {
    installed: !!enkryptProvider,
    provider: enkryptProvider,
  },
  phantom: {
    installed: !!window?.phantom?.ethereum,
    provider: window?.phantom?.ethereum,
  },
};

////////////////////////////////////////////////////////////////////////

function updateEthereumWalletsAvailable() {

  const ethereumButtons = {
    coinbase: document.querySelectorAll('.ethereum.coinbase'),
    metamask: document.querySelectorAll('.ethereum.metamask'),
    trust: document.querySelectorAll('.ethereum.trust'),
    exodus: document.querySelectorAll('.ethereum.exodus'),
    enkrypt: document.querySelectorAll('.ethereum.enkrypt'),
    phantom: document.querySelectorAll('.ethereum.phantom'),
  };

  for (const walletKey in ethereumButtons) {
    const isInstalled = cryptobet.ethereum[walletKey].installed;
    if (!isInstalled) {
      const button = ethereumButtons[walletKey][0];
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

function selectWalletEthereum(wallet) {

  ethereumAuth(cryptobet.ethereum[wallet].provider, "ethereum", wallet);

}

////////////////////////////////////////////////////////////////////////

async function ethereumAuth(provider, crypto, wallet) {
  const { signer, address } = await connectEthereumWithProvidedWallet(provider);
  const nonce = await getNonceEthereum(address);
  const signature = await signNonceEthereum(signer, nonce);
  if (!sessionStorage.getItem("eth_token") || !sessionStorage.getItem("eth_refresh_token")) {
    const response = await axios.post('/api/initializeTokensEthereum', { address: address });
    const { token, refreshTokenEthereum } = response.data;
    sessionStorage.setItem("eth_token", token);
    sessionStorage.setItem("eth_refresh_token", refreshTokenEthereum);
  }
  const { success, token, refreshToken, balance } = await verifySignature({
    address,
    walletType: wallet,
    chainType: crypto,
    provider,
    signature
  });
  if (!success) throw new Error("Authentication failed");

  if (success) {
    sessionStorage.setItem("eth_token", token);
    sessionStorage.setItem("eth_refresh_token", refreshToken);
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    onFrontendAuthenticated(address, balance);
  }

}

async function sendTransactionsEthereum(walletProvider, amountInEth) {

  const { signer } = await connectEthereumWithProvidedWallet(walletProvider);
  const tx = await signer.sendTransaction({
    to: ETHEREUM_PRIVATE_WALLET_ADDRESS,
    value: parseEther(amountInEth)
  });
  await tx.wait();
  return tx.hash;

}

function disconnectWalletEthereum() {

  sessionStorage.removeItem('eth_token');
  sessionStorage.removeItem('eth_refresh_token');
  authEthereumToken = null;

}

////////////////////////////////////////////////////////////////////////

async function getProfileEthereum() {

  const token = authEthereumToken;
  if (!token) throw new Error('Ethereum wallet not authenticated');

  const { data } = await axios.get('/api/profile', {
    headers: { Authorization: `Bearer ${token}` }
  });

  return data;

}

////////////////////////////////////////////////////////////////////////

async function connectEthereumWithProvidedWallet(walletProvider) {

  if (!walletProvider || typeof walletProvider.request !== 'function') throw new Error('Invalid wallet provider');
  const provider = new BrowserProvider(walletProvider);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  if (!isAddress(address)) throw new Error('Invalid Ethereum address');
  return { provider, signer, address };

}

async function getAnkrRpc() {
  try {
    const token = sessionStorage.getItem('eth_token');
    if (!token) throw new Error('Missing authentication token');

    const response = await axios.get('/api/getAnkrRpc', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.data.rpcUrl) throw new Error('RPC URL not found in response');
    return response.data.rpcUrl;
  } catch (error) {
    console.error('Failed to fetch ANKR_RPC from backend:', error);
    throw error;
  }
}

async function verifySignature({ address, walletType, chainType, provider, signature }) {

  if (!provider) throw new Error('[FRONTEND] Wallet Provider is missing');

  try {
    const verifyResponse = await axios.post(`/api/verifyEthereum`, {
      address,
      signature,
      walletType,
      chainType,
    });
    const data = verifyResponse.data;

    if (data.success) {

      let balance = -1;
      if (walletType === 'metamask' || walletType === 'trust') {
        const ankrRpc = await getAnkrRpc();
        const ankrProvider = new ethers.JsonRpcProvider(ankrRpc);
        balance = await ankrProvider.getBalance(address);
      } else {
        balance = await provider.request({ method: 'eth_getBalance', params: [address, 'latest'], });
      }
      balance = formatEther(balance);

      await axios.post(`/api/eth-balance`, { address, balance, cryptoSelected: chainType });

      return {
        success: true,
        token: data.token,
        refreshToken: data.refreshToken,
        address,
        walletType,
        chainType,
        balance,
      };

    } else {
      console.error('No token received from backend');
      return { success: false };
    }
  } catch (err) {
    console.error('verifySignature failed:', err?.response?.data || err);
    return { success: false };
  }

}

async function getNonceEthereum(address) {
  const { data } = await axios.post(`/api/nonceEthereum`, { address });
  return data.nonce;
}

async function signNonceEthereum(signer, nonce) {
  const signature = await signer.signMessage(nonce);
  return signature;
}

function refreshJwtTokenEthereum() {
  let token = sessionStorage.getItem("eth_refresh_token");
  if (!token) return;
  axios.post('/api/refreshTokenEthereum', { refreshTokenEthereum: token })
    .then(res => {
      if (res.data?.token) {
        sessionStorage.setItem('eth_token', res.data.token);
        sessionStorage.setItem('eth_refresh_token', res.data.refreshTokenEthereum);
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
      }
    })
    .catch(err => {
      console.warn('[FRONTEND] Token refresh failed:', err);
    });
}

////////////////////////////////////////////////////////////////////////

export {
  updateEthereumWalletsAvailable,
  selectWalletEthereum,
  sendTransactionsEthereum,
  disconnectWalletEthereum,
  getProfileEthereum,
};
