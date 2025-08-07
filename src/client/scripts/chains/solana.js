import axios from 'axios';

import { SOLANA_PRIVATE_WALLET_ADDRESS } from "../env.js";
import { cryptobet } from "../cryptobet.js";
import { onFrontendAuthenticated } from "./shared.js";
import bs58 from 'bs58';

////////////////////////////////////////////////////////////////////////

setInterval(refreshJwtTokenSolana, 14 * 60 * 1000); // every 14 minutes

////////////////////////////////////////////////////////////////////////

let authSolanaToken = null;

function setJwtToken(token) {
  authSolanaToken = token;
  sessionStorage.setItem('sol_token', token);
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

// On load, initialize JWT from sessionStorage if present
const storedToken = sessionStorage.getItem('sol_token');
if (storedToken) {
  setJwtToken(storedToken);
}

////////////////////////////////////////////////////////////////////////

cryptobet.solana = {
  phantom: {
    installed: !!window?.isPhantomInstalled,
    provider: window?.phantom?.solana,
  },
  solflare: {
    installed: !!window?.solflare,
    provider: window?.solflare,
  },
  mathwallet: {
    installed: !!window?.solana?.isMathWallet && !window?.isPhantomInstalled,
    provider: window?.solana,
  },
  coin98: {
    installed: !!window?.coin98,
    provider: window?.coin98?.sol,
  },
  exodus: {
    installed: !!window?.exodus?.solana,
    provider: window?.exodus?.solana,
  },
  trust: {
    installed: !!window?.trustwallet?.solana,
    provider: window?.trustwallet?.solana,
  },
};

////////////////////////////////////////////////////////////////////////

function updateSolanaWalletsAvailable() {
  const solanaButtons = {
    phantom: document.querySelectorAll('.solana.phantom'),
    solflare: document.querySelectorAll('.solana.solflare'),
    mathwallet: document.querySelectorAll('.solana.mathwallet'),
    coin98: document.querySelectorAll('.solana.coin98'),
    exodus: document.querySelectorAll('.solana.exodus'),
    trust: document.querySelectorAll('.solana.trust'),
  };
  for (const walletKey in solanaButtons) {
    const isInstalled = cryptobet.solana[walletKey].installed;
    if (!isInstalled) {
      const button = solanaButtons[walletKey][0];
      if (button) {
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
}

////////////////////////////////////////////////////////////////////////

async function getNonceSolana(address, walletType) {
  const response = await axios.post('/api/nonceSolana', { address, walletType });
  return response.data.nonce;
}

async function verifySolanaSignature(address, signature, walletType) {
  const response = await axios.post('/api/verifySolana', { address, signature, walletType });
  return response.data;
}

async function initializeTokensSolana(address) {
  const response = await axios.post('/api/initializeTokensSolana', { address });
  return response.data;
}

////////////////////////////////////////////////////////////////////////

function selectWalletSolana(wallet) {

  solanaAuth(cryptobet.solana[wallet].provider, "solana", wallet);

}

////////////////////////////////////////////////////////////////////////

async function solanaAuth(provider, chainType, walletType) {
  try {
    if (!provider) throw new Error('No Solana wallet provider found');
    // Get address
    let address;
    if (provider.publicKey) {
      address = provider.publicKey.toString();
    } else if (provider.connect) {
      const connectRes = await provider.connect();
      address = connectRes.publicKey?.toString();
    } else {
      throw new Error('Unable to get Solana address');
    }
    if (!address) throw new Error('No Solana address found');
    // Get nonce
    const nonce = await getNonceSolana(address, walletType);
    // Sign nonce
    let signature;
    if (provider.signMessage) {
      const encoded = new TextEncoder().encode(nonce);
      const sigRes = await provider.signMessage(encoded, 'utf8');
      signature = sigRes.signature || sigRes; // Phantom returns {signature, publicKey}
      if (signature instanceof Uint8Array) {
        signature = bs58.encode(signature);
      }
    } else {
      throw new Error('Wallet does not support message signing');
    }
    // Verify signature
    const verify = await verifySolanaSignature(address, signature, walletType);
    if (!verify.success) throw new Error('Signature verification failed');
    // Store tokens
    setJwtToken(verify.token);
    if (verify.refreshTokenSolana) sessionStorage.setItem('sol_refresh_token', verify.refreshTokenSolana);
    // Fetch balance (optional, for parity)
    let balance = -1;
    try {
      const balRes = await axios.get(`/api/sol-balance/${address}`);
      balance = balRes.data.balance;
    } catch (e) { }
    onFrontendAuthenticated(address, balance);
    return verify;
  } catch (err) {
    console.error('[Solana Auth Error]', err);
    throw err;
  }
}

////////////////////////////////////////////////////////////////////////

function disconnectWalletSolana() {
  // For Solana, most wallets do not have a disconnect method, so just clear session
  sessionStorage.removeItem('sol_token');
  sessionStorage.removeItem('sol_refresh_token');
  authSolanaToken = null;
}

////////////////////////////////////////////////////////////////////////

async function refreshJwtTokenSolana() {
  const token = sessionStorage.getItem("sol_refresh_token");
  if (!token) {
    console.warn("[FRONTEND] No Solana refresh token found in sessionStorage.");
    return;
  }
  try {
    const res = await axios.post("/api/refreshTokenSolana", { refreshTokenSolana: token });
    if (res.data?.token) {
      sessionStorage.setItem("sol_token", res.data.token);
      sessionStorage.setItem("sol_refresh_token", res.data.refreshTokenSolana);
      axios.defaults.headers.common["Authorization"] = `Bearer ${res.data.token}`;
      //console.log("[FRONTEND] Attempting to refresh Solana JWT token...", res.data.token, res.data.refreshTokenSolana);
    } else {
      console.warn("[FRONTEND] No token received in refresh response.");
    }
  } catch (err) {
    console.error("[FRONTEND] Token refresh failed:", err);
  }
}

async function logoutSolana() {
  const token = sessionStorage.getItem("sol_token");
  if (!token) {
    console.warn("[FRONTEND] No Solana JWT found in sessionStorage.");
    return;
  }
  try {
    await axios.post("/api/logout", {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
    sessionStorage.removeItem("sol_token");
    sessionStorage.removeItem("sol_refresh_token");
    delete axios.defaults.headers.common["Authorization"];
    console.log("[FRONTEND] Successfully logged out of Solana.");
  } catch (err) {
    console.error("[FRONTEND] Logout failed:", err);
  }
}

////////////////////////////////////////////////////////////////////////

async function sendTransactionsSolana(walletProvider, amountInSol) {
  try {
    // Import Solana Web3.js modules dynamically
    const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = await import('@solana/web3.js');

    // Connect to Solana mainnet
    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

    // Get wallet's public key
    let fromPubkey;
    if (walletProvider.publicKey) {
      fromPubkey = walletProvider.publicKey;
    } else if (walletProvider.wallet?.account?.address) {
      fromPubkey = new PublicKey(walletProvider.wallet.account.address);
    } else {
      throw new Error('Unable to get wallet public key');
    }

    // Destination address
    const toPubkey = new PublicKey(SOLANA_PRIVATE_WALLET_ADDRESS);

    // Convert SOL to lamports
    const lamports = Math.floor(amountInSol * LAMPORTS_PER_SOL);

    // Create transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports,
      })
    );

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPubkey;

    // Sign and send transaction
    const signedTransaction = await walletProvider.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());

    // Confirm transaction
    await connection.confirmTransaction(signature, 'confirmed');

    return signature;
  } catch (error) {
    console.error('[SOLANA] Transaction failed:', error);
    throw error;
  }
}

////////////////////////////////////////////////////////////////////////

export {
  updateSolanaWalletsAvailable,
  disconnectWalletSolana,
  solanaAuth,
  selectWalletSolana,
  getNonceSolana,
  verifySolanaSignature,
  initializeTokensSolana,
  refreshJwtTokenSolana,
  logoutSolana,
  sendTransactionsSolana,
};
