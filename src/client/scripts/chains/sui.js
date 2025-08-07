import axios from 'axios';
import { reactive } from 'vue';
import { defineStore } from 'pinia';

import { SUI_PRIVATE_WALLET_ADDRESS } from "../env.js";
import { cryptobet } from "../cryptobet.js";
import { onFrontendAuthenticated } from "./shared.js";
import { WalletStandardAdapterProvider } from '@mysten/wallet-adapter-all-wallets'

////////////////////////////////////////////////////////////////////////

setInterval(refreshJwtTokenSui, 14 * 60 * 1000); // every 14 minutes

////////////////////////////////////////////////////////////////////////

let authSuiToken = null;

function setJwtToken(token) {
  authSuiToken = token;
  sessionStorage.setItem('sui_token', token);
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

const storedToken = sessionStorage.getItem('sui_token');
if (storedToken) {
  setJwtToken(storedToken);
}

////////////////////////////////////////////////////////////////////////

let adapters

cryptobet.sui = {
  suiet: {
    installed: false,
    provider: null,
  },
  slush: {
    installed: false,
    provider: null,
  },
  nightly: {
    installed: false,
    provider: null,
  },
  backpack: {
    installed: false,
    provider: null,
  },
  phantom: {
    installed: false,
    provider: null,
  },
  martian: {
    installed: false,
    provider: null,
  },
  surf: {
    installed: false,
    provider: null,
  },
  glass: {
    installed: false,
    provider: null,
  },

};

////////////////////////////////////////////////////////////////////////

const suiSelectors = {
  suiet: () => document.querySelectorAll('.sui.suiet'),
  slush: () => document.querySelectorAll('.sui.slush'),
  nightly: () => document.querySelectorAll('.sui.nightly'),
  backpack: () => document.querySelectorAll('.sui.backpack'),
  phantom: () => document.querySelectorAll('.sui.phantom'),
  martian: () => document.querySelectorAll('.sui.martian'),
  surf: () => document.querySelectorAll('.sui.surf'),
  glass: () => document.querySelectorAll('.sui.glass')
}

export const useSuiNewWalletStore = defineStore('suiNewWalletStore', {
  state: () => ({
    suiButtons: reactive({

    })
  })
});

async function mapWalletAdaptersToCryptobet(adapters) {
  const suiWalletStore = useSuiNewWalletStore();
  adapters.forEach(adapter => {
    const walletName = adapter.name.toLowerCase()
      .replace(/\s*wallets?\s*|\s*sui wallet\s*/gi, '');

    if (!cryptobet.sui[walletName]) {
      cryptobet.sui[walletName] = {
        installed: true,
        provider: null,
      };
    }
    cryptobet.sui[walletName].installed = true;
    cryptobet.sui[walletName].provider = adapter;

    if (!suiSelectors[walletName]) {
      suiWalletStore.suiButtons[walletName] = {
        name: walletName,
        icon: adapter.icon,
      };
      //console.log(`[SUI] Added new wallet: ${walletName}`, cryptobet.sui[walletName].installed, suiWalletStore.suiButtons[walletName]);
    }
  });
}

////////////////////////////////////////////////////////////////////////

function updateSuiWalletsAvailable() {
  const suiWalletSelectors = {};
  const WSAP = new WalletStandardAdapterProvider()
  adapters = WSAP.get();
  mapWalletAdaptersToCryptobet(adapters);

  const suiButtons = {
    suiet: document.querySelectorAll('.sui.suiet'),
    slush: document.querySelectorAll('.sui.slush'),
    nightly: document.querySelectorAll('.sui.nightly'),
    backpack: document.querySelectorAll('.sui.backpack'),
    phantom: document.querySelectorAll('.sui.phantom'),
    martian: document.querySelectorAll('.sui.martian'),
    surf: document.querySelectorAll('.sui.surf'),
    glass: document.querySelectorAll('.sui.glass'),
  };

  for (const walletKey in suiButtons) {
    //console.log(suiButtons, walletKey, cryptobet.sui);
    const isInstalled = cryptobet.sui[walletKey].installed;
    if (!isInstalled) {
      const button = suiButtons[walletKey][0];
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

async function getNonceSui(address) {
  try {
    if (!address || typeof address !== 'string' || address.trim() === '') {
      console.error('[SUI][AUTH] Invalid address provided to getNonceSui:', address);
      throw new Error('Invalid address');
    }
    //console.log('[SUI][AUTH] Fetching nonce for address:', address);
    const response = await axios.post('/api/nonceSui', { address });
    return response.data.nonce;
  } catch (error) {
    console.error('[SUI][AUTH] Error fetching nonce:', error);
    throw error;
  }
}

async function signNonceSui(provider, nonce) {
  try {
    const message = new TextEncoder().encode(nonce);
    let accounts;

    // Retrieve accounts dynamically
    if (provider?.wallet?.accounts) {
      accounts = provider?.wallet?.accounts;
    } else if (provider?.useCurrentAccount) {
      accounts = await provider.useCurrentAccount();
    } else if (provider?.getAccounts) {
      accounts = await provider.getAccounts();
    }

    // Validate accounts
    if (!accounts || accounts.length === 0 || !accounts[0]?.address) {
      throw new Error('No valid accounts found. Ensure the wallet is connected and authorized.');
    }

    const publicKey = accounts[0].publicKey;
    const address = accounts[0].address;

    if (!address) {
      throw new Error('Address is undefined.');
    }

    let signature = null;

    if (provider.signPersonalMessage) {
      signature = await provider.signPersonalMessage({ message, account: { address } });
    } else if (provider.signMessage) {
      signature = await provider.signMessage({ message });
    } else {
      throw new Error('No supported signing method found on the provider.');
    }

    if (!publicKey) {
      throw new Error('Public key not found.');
    }

    return { ...signature, publicKey: Array.from(publicKey) };
  } catch (error) {
    if (error.code === 4001) {
      console.error('[SUI][AUTH] User rejected the request to sign the nonce.');
      throw new Error('You canceled the request. Please try again if you want to proceed.');
    }
    console.error('[SUI][AUTH] Error signing nonce:', error);
    throw error;
  }
}

async function verifySuiSignature(address, signaturePayload, walletType) {
  try {
    const response = await axios.post('/api/verifySui', {
      address,
      signaturePayload,
      walletType
    });
    return response.data;
  } catch (error) {
    console.error('[SUI][AUTH] Error verifying signature:', error.response?.data || error);
    throw error;
  }
}

async function initializeTokensSui(address) {
  try {
    const response = await axios.post('/api/initializeTokensSui', { address });
    return response.data;
  } catch (error) {
    console.error('[SUI][AUTH] Error initializing tokens:', error);
    throw error;
  }
}

function selectWalletSui(wallet) {

  suiAuth(cryptobet.sui[wallet].provider, "sui", wallet);

}

async function suiAuth(provider, chainType, walletType) {
  try {
    let accounts;

    if (!provider.connected) {
      console.warn('[SUI][AUTH] Wallet is not connected. Attempting to connect...');
      try {
        await provider.connect();
        //console.log('[SUI][AUTH] Wallet connected successfully.');
      } catch (connectError) {
        console.error('[SUI][AUTH] Failed to connect wallet:', connectError);
        throw new Error('Failed to connect wallet. Please try again.');
      }
    }

    if (provider?.wallet?.accounts) {
      accounts = provider?.wallet?.accounts;
    } else if (provider?.useCurrentAccount) {
      accounts = await provider.useCurrentAccount();
    } else if (provider?.getAccounts) {
      accounts = await provider.getAccounts();
    } else if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found', accounts);
    }

    if (!accounts || accounts.length === 0) {
      console.error('[SUI][AUTH] No accounts found. Ensure the wallet is connected and authorized.');
      throw new Error('No accounts found');
    }
    const address = accounts[0].address;
    if (!address) {
      throw new Error('Invalid address');
    }
    const nonce = await getNonceSui(address);
    const signature = await signNonceSui(provider, nonce);
    const verification = await verifySuiSignature(address, signature, walletType);


    if (verification.success) {
      setJwtToken(verification.token);
      sessionStorage.setItem('sui_refresh_token', verification.refreshToken);

      let balance = -1;
      try {
        const response = await axios.get(`/api/sui-balance/${address}`);
        balance = response.data.balance;
      } catch (balanceError) {
        console.error('[SUI][AUTH] Failed to fetch balance:', balanceError);
      }
      await axios.post(`/api/sui-balance`, { address, balance, cryptoSelected: chainType });

      onFrontendAuthenticated(address, balance);
    } else {
      throw new Error('Signature verification failed');
    }
  } catch (error) {
    console.error('[SUI][AUTH] Error during authentication:', error);
    throw error;
  }
}

////////////////////////////////////////////////////////////////////////

function disconnectWalletSui() {
  sessionStorage.removeItem('sui_token');
  sessionStorage.removeItem('sui_refresh_token');
  authSuiToken = null;
}

////////////////////////////////////////////////////////////////////////

async function refreshJwtTokenSui() {
  const refreshToken = sessionStorage.getItem("sui_refresh_token");
  if (!refreshToken) {
    console.warn("[SUI][AUTH] No refresh token found in sessionStorage.");
    return;
  }

  try {
    const response = await axios.post("/api/refreshTokenSui", { refreshToken });
    const { token, refreshToken: newRefreshToken } = response.data;
    sessionStorage.setItem("sui_token", token);
    sessionStorage.setItem("sui_refresh_token", newRefreshToken);
    setJwtToken(token);
  } catch (error) {
    console.error("[SUI][AUTH] Error refreshing JWT token:", error);
  }
}

////////////////////////////////////////////////////////////////////////

async function logoutSui() {
  const token = sessionStorage.getItem("sui_token");
  if (!token) {
    consuie.warn("[FRONTEND] No Sui JWT found in sessionStorage.");
    return;
  }
  try {
    await axios.post("/api/logout", {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
    sessionStorage.removeItem("sui_token");
    sessionStorage.removeItem("sui_refresh_token");
    delete axios.defaults.headers.common["Authorization"];
    //console.log("[FRONTEND] Successfully logged out of Sui.");
  } catch (err) {
    consuie.error("[FRONTEND] Logout failed:", err);
  }
}

////////////////////////////////////////////////////////////////////////

async function sendTransactionsSui(walletProvider, amountInSui) {
  try {
    // Dynamic import to avoid bundling issues
    const { SuiClient, getFullnodeUrl } = await import('@mysten/sui.js/client');
    const { TransactionBlock } = await import('@mysten/sui.js/transactions');

    // Create Sui client
    const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

    // Get accounts
    let accounts;
    if (walletProvider?.wallet?.accounts) {
      accounts = walletProvider.wallet.accounts;
    } else if (walletProvider?.getAccounts) {
      accounts = await walletProvider.getAccounts();
    } else {
      throw new Error('Unable to get wallet accounts');
    }

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found in wallet');
    }

    const senderAddress = accounts[0].address;

    // Convert SUI to MIST (1 SUI = 1e9 MIST)
    const amountInMist = Math.floor(amountInSui * 1e9);

    // Create transaction block
    const txb = new TransactionBlock();
    const [coin] = txb.splitCoins(txb.gas, [txb.pure(amountInMist)]);
    txb.transferObjects([coin], txb.pure(SUI_PRIVATE_WALLET_ADDRESS));

    // Sign and execute transaction
    const result = await walletProvider.signAndExecuteTransactionBlock({
      transactionBlock: txb,
      account: accounts[0],
      requestType: 'WaitForLocalExecution',
      options: {
        showInput: true,
        showEffects: true,
      },
    });

    if (result.effects?.status?.status !== 'success') {
      throw new Error('Transaction execution failed');
    }

    return result.digest;
  } catch (error) {
    console.error('[SUI] Transaction failed:', error);
    throw error;
  }
}

////////////////////////////////////////////////////////////////////////

export {
  updateSuiWalletsAvailable,
  disconnectWalletSui,
  suiAuth,
  selectWalletSui,
  getNonceSui,
  verifySuiSignature,
  initializeTokensSui,
  refreshJwtTokenSui,
  logoutSui,
  signNonceSui,
  sendTransactionsSui,
};
