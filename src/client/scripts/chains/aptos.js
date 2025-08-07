////////////////////////////////////////////////////////////////////////

import axios from 'axios';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';

import { APTOS_PRIVATE_WALLET_ADDRESS } from "../env.js";
import { cryptobet } from "../cryptobet.js";
import { onFrontendAuthenticated } from "./shared.js";

////////////////////////////////////////////////////////////////////////

// Initialize Aptos client
const aptosConfig = new AptosConfig({ network: Network.MAINNET });
const aptosClient = new Aptos(aptosConfig);

// Token management
let authAptosToken = sessionStorage.getItem("apt_token") || null;
let aptosRefreshToken = sessionStorage.getItem("apt_refresh_token") || null;

function setAptosToken(token) {
  // Defensive: if token is an object, extract .token property
  if (typeof token === 'object' && token !== null) {
    if (token.token && typeof token.token === 'string') {
      console.warn('[APTOS] setAptosToken received object, extracting .token:', token);
      token = token.token;
    } else {
      console.error('[APTOS] setAptosToken received invalid object, cannot extract JWT:', token);
      throw new Error('setAptosToken: Invalid token object passed');
    }
  }
  if (typeof token !== 'string' || !/^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(token)) {
    console.error('[APTOS] setAptosToken called with non-JWT string:', token);
    throw new Error('setAptosToken: Non-JWT string passed');
  }
  authAptosToken = token;
  sessionStorage.setItem("apt_token", token);
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

function setAptosRefreshToken(refreshToken) {
  aptosRefreshToken = refreshToken;
  sessionStorage.setItem("apt_refresh_token", refreshToken);
}

// On load, initialize JWT from sessionStorage if present
if (authAptosToken) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${authAptosToken}`;
}

// Auto-refresh JWT token every 14 minutes
setInterval(refreshJwtTokenAptos, 14 * 60 * 1000);

////////////////////////////////////////////////////////////////////////

// Wallet provider detection and configuration
cryptobet.aptos = {
  martian: {
    installed: !!window?.martian,
    provider: window?.martian,
  },
  petra: {
    installed: !!window?.petra,
    provider: window?.petra,
  },
  pontem: {
    installed: !!window?.pontem,
    provider: window?.pontem,
  },
  rise: {
    installed: !!window?.rise,
    provider: window?.rise,
  },
};

////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////

function updateAptosWalletsAvailable() {
  const aptosButtons = {
    martian: document.querySelectorAll('.aptos.martian'),
    petra: document.querySelectorAll('.aptos.petra'),
    pontem: document.querySelectorAll('.aptos.pontem'),
    rise: document.querySelectorAll('.aptos.rise'),
  };

  for (const walletKey in aptosButtons) {
    const isInstalled = cryptobet.aptos[walletKey].installed;
    const buttons = aptosButtons[walletKey];

    buttons.forEach(button => {
      if (!isInstalled) {
        button.classList.add('locked');
        button.disabled = true;
        button.style.opacity = '0.25';
        const h2 = button.querySelector('h2');
        if (h2) {
          h2.classList.remove('glitched');
          h2.classList.remove('cyberpunk');
        }
      } else {
        button.classList.remove('locked');
        button.disabled = false;
        button.style.opacity = '1';
        const h2 = button.querySelector('h2');
        if (h2) {
          h2.classList.add('cyberpunk');
        }
      }
    });
  }
}

////////////////////////////////////////////////////////////////////////

async function getNonceAptos(address, walletType) {
  try {
    const response = await axios.post('/api/nonceAptos', { address, walletType });
    return response.data.nonce;
  } catch (error) {
    console.error('[APTOS] Failed to get nonce:', error);
    throw new Error('Failed to get authentication nonce');
  }
}

async function verifyAptosSignature(address, signature, nonce, publicKey, walletType) {
  try {
    const response = await axios.post('/api/verifyAptos', {
      address,
      signature,
      nonce,
      publicKey,
      walletType
    });
    return response.data;
  } catch (error) {
    console.error('[APTOS] Failed to verify signature:', error);
    throw new Error('Failed to verify signature');
  }
}

async function initializeTokensAptos(address) {
  try {
    const response = await axios.post('/api/initializeTokensAptos', { address });
    return response.data;
  } catch (error) {
    console.error('[APTOS] Failed to initialize tokens:', error);
    throw new Error('Failed to initialize authentication tokens');
  }
}

////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////

function selectWalletAptos(wallet) {
  if (!cryptobet.aptos[wallet] || !cryptobet.aptos[wallet].installed) {
    throw new Error(`${wallet} wallet is not installed`);
  }
  aptosAuth(cryptobet.aptos[wallet].provider, "aptos", wallet);
}

////////////////////////////////////////////////////////////////////////

async function aptosAuth(provider, chainType, walletType) {
  try {
    //console.log(`[APTOS] Starting authentication with ${walletType} wallet`);

    // Step 1: Connect to wallet
    const { account, address, publicKey } = await connectAptosWithProvidedWallet(provider, walletType);
    //console.log(`[APTOS] Connected to wallet, address: ${address}, publicKey: ${publicKey}`);

    // Step 2: Get nonce from server
    const nonceFromServer = await getNonceAptos(address, walletType); // Renamed for clarity
    //console.log(`[APTOS] Received nonce from server: "${nonceFromServer}"`);

    // Step 3: Sign nonce with wallet
    // signNonceAptos now returns an object { signature, fullMessage }
    const { signature, fullMessage } = await signNonceAptos(provider, nonceFromServer, walletType, address);
    //console.log(`[APTOS] Signed nonce with wallet. Signature: ${signature}, Full message signed: "${fullMessage}"`);

    // Step 4: Initialize tokens if not present
    if (!sessionStorage.getItem("apt_token") || !sessionStorage.getItem("apt_refresh_token")) {
      //console.log(`[APTOS] Initializing tokens for new session`);
      const response = await initializeTokensAptos(address);
      setAptosToken(response.token);
      setAptosRefreshToken(response.refreshTokenAptos);
    }

    // Step 5: Verify signature with server
    // Pass fullMessage as messageToVerify, remove original nonce and provider
    const { success, token, refreshTokenAptos, balance } = await verifySignature({
      address,
      walletType,
      chainType,
      signature,
      messageToVerify: fullMessage, // Use the fullMessage from the wallet
      publicKey
    });

    if (!success) {
      throw new Error("Signature verification failed");
    }

    // Step 6: Store tokens and complete authentication
    setAptosToken(token);
    setAptosRefreshToken(refreshTokenAptos);

    //console.log(`[APTOS] Authentication successful for ${walletType}`);
    await onFrontendAuthenticated(address, balance);

  } catch (error) {
    console.error('[APTOS] Authentication failed:', error);
    throw error;
  }
}

async function sendTransactionsAptos(walletProvider, amountInAptos) {
  try {
    const { account, address } = await connectAptosWithProvidedWallet(walletProvider);

    // Convert APT to octas (1 APT = 100,000,000 octas)
    const amountInOctas = Math.floor(amountInAptos * 100000000);

    // Create transaction payload for APT transfer
    const transaction = {
      sender: address,
      data: {
        function: "0x1::coin::transfer",
        typeArguments: ["0x1::aptos_coin::AptosCoin"],
        functionArguments: [APTOS_WALLET_ADDRESS, amountInOctas]
      }
    };

    //console.log(`[APTOS] Sending ${amountInAptos} APT (${amountInOctas} octas)`);
    const response = await walletProvider.signAndSubmitTransaction(transaction);

    // Wait for transaction confirmation
    if (response.hash) {
      await aptosClient.waitForTransaction({ transactionHash: response.hash });
      //console.log(`[APTOS] Transaction confirmed: ${response.hash}`);
    }

    return response.hash;
  } catch (error) {
    console.error('[APTOS] Transaction failed:', error);
    throw error;
  }
}

function disconnectWalletAptos() {
  try {
    // Clear session storage
    sessionStorage.removeItem("apt_token");
    sessionStorage.removeItem("apt_refresh_token");

    // Clear memory variables
    authAptosToken = null;
    aptosRefreshToken = null;

    // Remove authorization header
    delete axios.defaults.headers.common['Authorization'];

    //console.log('[APTOS] Wallet disconnected successfully');
  } catch (error) {
    console.error('[APTOS] Error during wallet disconnect:', error);
  }
}

////////////////////////////////////////////////////////////////////////

async function getProfileAptos() {
  const token = authAptosToken;
  if (!token) throw new Error('Aptos wallet not authenticated');

  try {
    const { data } = await axios.get('/api/profile', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return data;
  } catch (error) {
    console.error('[APTOS] Failed to get profile:', error);
    throw error;
  }
}

////////////////////////////////////////////////////////////////////////

async function connectAptosWithProvidedWallet(walletProvider, walletType) {
  if (!walletProvider) throw new Error('Invalid wallet provider');

  try {
    //console.log(`[APTOS] Connecting to ${walletType} wallet`);
    let account, address, publicKey;

    // Handle different wallet connection methods
    if (walletType === 'petra' && walletProvider.connect) {
      // Petra wallet connection
      const response = await walletProvider.connect();
      if (response.address) {
        address = response.address;
        account = response;
        publicKey = response.publicKey;
      } else {
        throw new Error('Petra wallet connection failed');
      }
    } else if (walletType === 'martian' && walletProvider.connect) {
      // Martian wallet connection
      const response = await walletProvider.connect();
      if (response.address) {
        address = response.address;
        account = response;
        publicKey = response.publicKey;
      } else {
        throw new Error('Martian wallet connection failed');
      }
    } else if (walletType === 'pontem' && walletProvider.connect) {
      // Pontem wallet connection
      const response = await walletProvider.connect();
      if (response.address) {
        address = response.address;
        account = response;
        publicKey = response.publicKey;
      } else {
        throw new Error('Pontem wallet connection failed');
      }
    } else if (walletType === 'rise' && walletProvider.connect) {
      // Rise wallet connection
      const response = await walletProvider.connect();
      if (response.address) {
        address = response.address;
        account = response;
        publicKey = response.publicKey;
      } else {
        throw new Error('Rise wallet connection failed');
      }
    } else if (walletProvider.account) {
      // Wallet already connected
      address = walletProvider.account.address;
      account = walletProvider.account;
      publicKey = walletProvider.account.publicKey;
    } else {
      throw new Error(`Unable to connect to ${walletType} wallet`);
    }

    if (!address) throw new Error('Unable to get wallet address');

    // Validate Aptos address format
    if (!isValidAptosAddress(address)) {
      throw new Error('Invalid Aptos address format');
    }

    //console.log(`[APTOS] Successfully connected to ${walletType}, address: ${address}`);
    return { account, address, publicKey };
  } catch (error) {
    console.error(`[APTOS] ${walletType} wallet connection failed:`, error);
    throw error;
  }
}

// Modified to accept messageToVerify instead of nonce, and remove provider
async function verifySignature({ address, walletType, chainType, signature, messageToVerify, publicKey }) {
  // if (!provider) throw new Error('[FRONTEND] Wallet Provider is missing'); // Provider no longer needed here

  try {
    const verifyResponse = await axios.post(`/api/verifyAptos`, {
      address,
      signature,
      message: messageToVerify, // Send fullMessage as 'message'
      publicKey,
      walletType,
      chainType,
    });
    const data = verifyResponse.data;

    if (data.success) {
      let balance = -1; // Default balance to 0
      try {
        //console.log(`[APTOS] Fetching balance for address: ${address} using aptosClient`);
        // Use aptosClient (from Aptos SDK) to get the balance
        const aptAmount = await aptosClient.getAccountAPTAmount({ accountAddress: address });
        balance = aptAmount / 100000000; // Convert Octas to APT
        //console.log(`[APTOS] Balance fetched from Aptos network: ${balance} APT`);
      } catch (aptosBalanceError) {
        // Log specific error details if possible
        if (aptosBalanceError.message && aptosBalanceError.message.includes("Resource not found")) {
          console.warn(`[APTOS] Account resource not found for address ${address}. Assuming balance is 0. Error:`, aptosBalanceError.message);
        } else {
          console.warn('[APTOS] Aptos network balance fetch failed directly:', aptosBalanceError);
        }
        // Keep balance as 0 if fetching fails (e.g., new account, no CoinStore)
      }

      // Always try to post the balance (0 or fetched value) to the backend
      try {
        await axios.post('/api/apt-balance', { address, balance, cryptoSelected: 'aptos' });
        //console.log(`[APTOS] Successfully updated backend with balance: ${balance}`);
      } catch (postBalanceError) {
        console.warn('[APTOS] Failed to post updated balance to API:', postBalanceError);
      }

      return {
        success: true,
        token: data.token,
        refreshTokenAptos: data.refreshTokenAptos,
        address,
        walletType,
        chainType,
        balance: balance, // Return the fetched or default balance
      };
    } else {
      console.error('[APTOS] No token received from backend after signature verification');
      return { success: false };
    }
  } catch (err) {
    console.error('[APTOS] verifySignature failed:', err?.response?.data || err);
    return { success: false };
  }
}

// Modified to accept address for constructing the signPayload if needed by specific wallets,
// and to return { signature, fullMessage }
async function signNonceAptos(provider, serverNonce, walletType, walletAddress) {
  try {
    //console.log(`[APTOS] Signing serverNonce: "${serverNonce}" with ${walletType} wallet for address ${walletAddress}`);
    let signature;
    let fullMessage; // This will store the exact message string signed by the wallet

    // Standard Aptos signMessage payload structure
    // The `nonce` field here is a client-generated string to ensure uniqueness of the signMessage request,
    // distinct from the `serverNonce` which is the actual message content we want signed.
    const clientNonceForSigning = Math.floor(Math.random() * 1000000000).toString();

    const signPayload = {
      message: serverNonce, // The actual content to be signed (obtained from server)
      nonce: clientNonceForSigning, // A client-side nonce for the signing operation itself
      // Per Aptos standard, these control what's included in the `fullMessage`
      address: true,    // Include the signer's address in the fullMessage
      application: true, // Include the DApp's domain in the fullMessage
      chainId: true,     // Include the chain ID in the fullMessage
    };

    //console.log(`[APTOS] signMessage payload for ${walletType}:`, JSON.stringify(signPayload, null, 2));

    if ((walletType === 'petra' || walletType === 'martian' || walletType === 'pontem' || walletType === 'rise') && provider.signMessage) {
      let response;
      if (walletType === 'pontem') {
        try {
          //console.log('[APTOS] Attempting Pontem signMessage with useNewFormat: true');
          response = await provider.signMessage(signPayload, { useNewFormat: true });
        } catch (pontemError) {
          console.warn('[APTOS] Pontem signMessage with useNewFormat: true failed, trying old format. Error:', pontemError);
          // Fallback to old format call if new one errors out (e.g. if option is not recognized by the wallet version)
          response = await provider.signMessage(signPayload);
        }
      } else {
        response = await provider.signMessage(signPayload);
      }

      //console.log(`[APTOS] ${walletType} signMessage raw response:`, response);

      let tempSignaturePayload = response; // Default to using the response object itself

      // For Pontem, the actual signature data is often in response.result
      // The logged response for Pontem with useNewFormat:true was {payload: {…}, result: {…}, success: true}
      // So, if response.result exists and is an object, it's a strong candidate for the actual payload.
      if (walletType === 'pontem' && response && typeof response.result === 'object' && response.result !== null) {
        //console.log('[APTOS] Pontem wallet detected. Assuming signature data is in response.result.');
        tempSignaturePayload = response.result;
      } else {
        //console.log(`[APTOS] For ${walletType}, assuming signature data is directly in the response object.`);
      }

      // Ensure tempSignaturePayload is an object before trying to access properties
      if (typeof tempSignaturePayload !== 'object' || tempSignaturePayload === null) {
        console.error(`[APTOS] tempSignaturePayload is not a valid object for ${walletType}. Original response:`, response);
        throw new Error(`Invalid response structure from ${walletType}: signature payload is not an object.`);
      }

      if ((typeof tempSignaturePayload.signature === 'string' || tempSignaturePayload.signature instanceof Uint8Array) && typeof tempSignaturePayload.fullMessage === 'string') {
        if (tempSignaturePayload.signature instanceof Uint8Array) {
          signature = '0x' + Array.from(tempSignaturePayload.signature, byte => byte.toString(16).padStart(2, '0')).join('');
          //console.log(`[APTOS] Converted Uint8Array signature to hex: ${signature}`);
        } else {
          signature = tempSignaturePayload.signature; // string
        }
        fullMessage = tempSignaturePayload.fullMessage;
      } else {
        const sigType = tempSignaturePayload ? typeof tempSignaturePayload.signature : 'undefined';
        const fmType = tempSignaturePayload ? typeof tempSignaturePayload.fullMessage : 'undefined';
        console.error(`[APTOS] Failed to extract signature/fullMessage from determined payload for ${walletType}.`);
        console.error(`[APTOS] Payload being checked:`, tempSignaturePayload);
        console.error(`[APTOS] typeof signature: ${sigType}, typeof fullMessage: ${fmType}. Expected string/Uint8Array and string.`);
        console.error(`[APTOS] Original full response object:`, response);
        throw new Error(`Invalid signature data in response from ${walletType}. Check console for details.`);
      }

    } else if (provider.sign) {
      // Fallback for wallets that might only support a simple `sign(message)`
      // This is less common for Aptos and might not follow the standard AIP for fullMessage construction.
      console.warn(`[APTOS] Wallet ${walletType} is using basic 'sign' method. The message signed will be the raw server nonce: "${serverNonce}". This may not be verifiable if the server expects a prefixed message.`);
      const signedResponse = await provider.sign(serverNonce);

      if (typeof signedResponse === 'string') {
        signature = signedResponse;
      } else if (signedResponse && typeof signedResponse.signature === 'string') {
        signature = signedResponse.signature;
      } else {
        console.error('[APTOS] Invalid response from basic sign method:', signedResponse);
        throw new Error('Failed to get signature using basic sign method.');
      }
      // IMPORTANT: For this fallback, the `fullMessage` is assumed to be just the `serverNonce`.
      // This might lead to verification failures if the server expects the AIP-formatted message.
      fullMessage = serverNonce;
      //console.log(`[APTOS] ${walletType} basic sign response - Signature: ${signature}. Assumed fullMessage: "${fullMessage}"`);
    } else {
      throw new Error(`${walletType} wallet does not support message signing (no signMessage or sign method found)`);
    }

    if (!signature) {
      throw new Error('Failed to get signature from wallet after attempting signing methods.');
    }
    if (typeof fullMessage !== 'string') { // Ensure fullMessage is a string
      console.error('[APTOS] fullMessage was not set correctly during signing:', fullMessage);
      throw new Error('Failed to construct/get fullMessage for verification.');
    }

    //console.log(`[APTOS] Successfully signed. Final Signature: ${signature}, Final FullMessage to verify: "${fullMessage}"`);
    return { signature, fullMessage }; // Return both
  } catch (error) {
    console.error(`[APTOS] ${walletType} message signing failed:`, error);
    if (error.message && (error.message.includes('User rejected') || error.message.includes('Cancelled'))) {
      throw new Error('User rejected the signing request.');
    }
    // Rethrow other errors
    throw error;
  }
}

function refreshJwtTokenAptos() {
  const token = sessionStorage.getItem("apt_refresh_token");
  if (!token) return;

  //console.log('[APTOS] Refreshing JWT token');

  axios.post('/api/refreshTokenAptos', { refreshTokenAptos: token })
    .then(res => {
      if (res.data?.token) {
        setAptosToken(res.data.token);
        setAptosRefreshToken(res.data.refreshTokenAptos);
        //console.log('[APTOS] JWT token refreshed successfully');
      }
    })
    .catch(err => {
      console.warn('[APTOS] Token refresh failed:', err);
      // If refresh fails, clear tokens to force re-authentication
      disconnectWalletAptos();
    });
}

async function logoutAptos() {
  const token = sessionStorage.getItem("apt_token");
  if (!token) {
    console.warn("[APTOS] No JWT found in sessionStorage.");
    return;
  }

  try {
    await axios.post("/api/logout", {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
    disconnectWalletAptos();
    //console.log("[APTOS] Successfully logged out.");
  } catch (err) {
    console.error("[APTOS] Logout failed:", err);
    // Even if logout fails on server, clear local tokens
    disconnectWalletAptos();
  }
}

////////////////////////////////////////////////////////////////////////

// Utility function to validate Aptos address
function isValidAptosAddress(address) {
  if (!address || typeof address !== 'string') return false;

  // Aptos addresses are 32-byte hex strings, can be with or without 0x prefix
  // Can be shorter than 64 chars if leading zeros are omitted
  const cleanAddress = address.startsWith('0x') ? address.slice(2) : address;

  // Check if it's a valid hex string with appropriate length
  if (!/^[a-fA-F0-9]{1,64}$/.test(cleanAddress)) return false;

  // Ensure it's not longer than 64 characters (32 bytes)
  if (cleanAddress.length > 64) return false;

  return true;
}

// Add private wallet address for transactions
const APTOS_WALLET_ADDRESS = APTOS_PRIVATE_WALLET_ADDRESS;

////////////////////////////////////////////////////////////////////////

export {
  updateAptosWalletsAvailable,
  selectWalletAptos,
  sendTransactionsAptos,
  disconnectWalletAptos,
  aptosAuth,
  getNonceAptos,
  verifyAptosSignature,
  initializeTokensAptos,
  refreshJwtTokenAptos,
  logoutAptos,
  getProfileAptos,
  connectAptosWithProvidedWallet,
  isValidAptosAddress,
};