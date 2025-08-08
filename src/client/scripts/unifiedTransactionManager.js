import { ref, reactive } from 'vue';
import axios from 'axios';

// Import blockchain specific functions
import { sendTransactionsEthereum } from './chains/ethereum.js';
import { sendTransactionsAptos } from './chains/aptos.js';
import { sendTransactionsSolana } from './chains/solana.js';
import { sendTransactionsBitcoin } from './chains/bitcoin.js';
import { sendTransactionsCardano } from './chains/cardano.js';
import { sendTransactionsSui } from './chains/sui.js';
import { cryptobet } from './cryptobet.js';
import { authChecker } from './authenticationChecker.js';
import { useGlobalStore } from '../stores/global.js';

// Transaction status enum
export const TransactionStatus = {
  IDLE: 'idle',
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed'
};

// Transaction logger
class TransactionLogger {
  constructor() {
    this.logs = reactive([]);
  }

  log(entry) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      id: `${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp,
      ...entry
    };
    this.logs.unshift(logEntry);
    console.log(`[TRANSACTION LOG] ${logEntry.blockchain}: ${logEntry.message}`, logEntry);
  }

  getLogs() {
    return this.logs;
  }

  clearLogs() {
    this.logs.splice(0);
  }
}

// Global transaction logger instance
export const transactionLogger = new TransactionLogger();

// Transaction state manager
export const transactionState = reactive({
  isTransactionInProgress: false,
  currentBlockchain: null,
  currentStatus: TransactionStatus.IDLE,
  transactionHash: null,
  error: null,
  lastTransactionResult: null
});

// Blockchain-specific transaction handlers
const blockchainHandlers = {
  ethereum: {
    name: 'Ethereum',
    symbol: 'ETH',
    sendTransaction: async (amount, walletProvider) => {
      return await sendTransactionsEthereum(walletProvider, amount.toString());
    },
    getProvider: (walletType) => {
      return cryptobet.ethereum[walletType]?.provider;
    },
    validateAmount: (amount) => {
      if (typeof amount !== 'number' || amount <= 0) {
        throw new Error('Amount must be a positive number');
      }
      if (amount < 0.0001) {
        throw new Error('Minimum transaction amount is 0.0001 ETH');
      }
      return true;
    }
  },
  
  solana: {
    name: 'Solana',
    symbol: 'SOL',
    sendTransaction: async (amount, walletProvider) => {
      return await sendTransactionsSolana(walletProvider, amount);
    },
    getProvider: (walletType) => {
      return cryptobet.solana[walletType]?.provider;
    },
    validateAmount: (amount) => {
      if (typeof amount !== 'number' || amount <= 0) {
        throw new Error('Amount must be a positive number');
      }
      if (amount < 0.001) {
        throw new Error('Minimum transaction amount is 0.001 SOL');
      }
      return true;
    }
  },

  bitcoin: {
    name: 'Bitcoin',
    symbol: 'BTC',
    sendTransaction: async (amount, walletProvider, walletType) => {
      return await sendTransactionsBitcoin(walletProvider, amount, walletType);
    },
    getProvider: (walletType) => {
      return cryptobet.bitcoin[walletType]?.provider;
    },
    validateAmount: (amount) => {
      if (typeof amount !== 'number' || amount <= 0) {
        throw new Error('Amount must be a positive number');
      }
      if (amount < 0.00001) {
        throw new Error('Minimum transaction amount is 0.00001 BTC');
      }
      return true;
    }
  },

  aptos: {
    name: 'Aptos',
    symbol: 'APT',
    sendTransaction: async (amount, walletProvider) => {
      return await sendTransactionsAptos(walletProvider, amount);
    },
    getProvider: (walletType) => {
      return cryptobet.aptos[walletType]?.provider;
    },
    validateAmount: (amount) => {
      if (typeof amount !== 'number' || amount <= 0) {
        throw new Error('Amount must be a positive number');
      }
      if (amount < 0.001) {
        throw new Error('Minimum transaction amount is 0.001 APT');
      }
      return true;
    }
  },

  cardano: {
    name: 'Cardano',
    symbol: 'ADA',
    sendTransaction: async (amount, walletProvider, walletType) => {
      return await sendTransactionsCardano(walletProvider, amount, walletType);
    },
    getProvider: (walletType) => {
      return cryptobet.cardano[walletType]?.provider;
    },
    validateAmount: (amount) => {
      if (typeof amount !== 'number' || amount <= 0) {
        throw new Error('Amount must be a positive number');
      }
      if (amount < 1) {
        throw new Error('Minimum transaction amount is 1 ADA');
      }
      return true;
    }
  },

  sui: {
    name: 'Sui',
    symbol: 'SUI',
    sendTransaction: async (amount, walletProvider) => {
      return await sendTransactionsSui(walletProvider, amount);
    },
    getProvider: (walletType) => {
      return cryptobet.sui[walletType]?.provider;
    },
    validateAmount: (amount) => {
      if (typeof amount !== 'number' || amount <= 0) {
        throw new Error('Amount must be a positive number');
      }
      if (amount < 0.001) {
        throw new Error('Minimum transaction amount is 0.001 SUI');
      }
      return true;
    }
  }
};

// Unified transaction function - now uses global store values automatically
export async function executeUnifiedTransaction(amount, callback = null) {
  // Get current authenticated blockchain and wallet from global store
  const globalStore = useGlobalStore();
  const blockchain = globalStore.crypto_selected;
  const walletType = globalStore.wallet_selected;

  if (!blockchain || !walletType) {
    throw new Error('No authenticated blockchain or wallet found. Please connect your wallet first.');
  }
  // Check if we can skip authentication
  if (authChecker.shouldSkipAuthentication(blockchain)) {
    const authStatus = authChecker.getAuthenticationStatus();
    console.log('[TRANSACTION] Using existing authentication session:', authStatus);

    // Update activity to keep session alive
    authChecker.updateActivity();
  } else {
    console.log('[TRANSACTION] No valid session found, will require authentication');
  }

  // Reset transaction state
  transactionState.isTransactionInProgress = true;
  transactionState.currentBlockchain = blockchain;
  transactionState.currentStatus = TransactionStatus.PENDING;
  transactionState.transactionHash = null;
  transactionState.error = null;
  
  transactionLogger.log({
    blockchain,
    walletType,
    amount,
    message: `Starting transaction: ${amount} ${blockchainHandlers[blockchain]?.symbol || blockchain}`,
    status: TransactionStatus.PENDING
  });

  try {
    // Validate blockchain
    if (!blockchainHandlers[blockchain]) {
      throw new Error(`Unsupported blockchain: ${blockchain}`);
    }

    const handler = blockchainHandlers[blockchain];
    
    // Validate amount
    handler.validateAmount(amount);
    
    // Get wallet provider
    const walletProvider = handler.getProvider(walletType);
    if (!walletProvider) {
      // If no provider found and we don't have a valid session, we need authentication
      if (!authChecker.shouldSkipAuthentication(blockchain)) {
        throw new Error(`Wallet not connected. Please connect your ${walletType} wallet for ${blockchain}`);
      } else {
        throw new Error(`Wallet provider not found for ${walletType} on ${blockchain}`);
      }
    }

    transactionLogger.log({
      blockchain,
      walletType,
      amount,
      message: `Wallet provider found, initiating transaction...`,
      status: TransactionStatus.PENDING
    });

    // Execute transaction
    const transactionHash = await handler.sendTransaction(amount, walletProvider, walletType);
    
    // Update state on success
    transactionState.currentStatus = TransactionStatus.SUCCESS;
    transactionState.transactionHash = transactionHash;
    transactionState.lastTransactionResult = {
      blockchain,
      walletType,
      amount,
      hash: transactionHash,
      timestamp: new Date().toISOString(),
      status: TransactionStatus.SUCCESS
    };

    transactionLogger.log({
      blockchain,
      walletType,
      amount,
      transactionHash,
      message: `Transaction successful! Hash: ${transactionHash}`,
      status: TransactionStatus.SUCCESS
    });

    // Execute callback if provided
    if (callback && typeof callback === 'function') {
      try {
        await callback({
          success: true,
          blockchain,
          walletType,
          amount,
          transactionHash,
          status: TransactionStatus.SUCCESS
        });
      } catch (callbackError) {
        console.error('[TRANSACTION] Callback execution failed:', callbackError);
      }
    }

    return {
      success: true,
      blockchain,
      walletType,
      amount,
      transactionHash,
      status: TransactionStatus.SUCCESS
    };

  } catch (error) {
    // Update state on error
    transactionState.currentStatus = TransactionStatus.FAILED;
    transactionState.error = error.message;
    transactionState.lastTransactionResult = {
      blockchain,
      walletType,
      amount,
      error: error.message,
      timestamp: new Date().toISOString(),
      status: TransactionStatus.FAILED
    };

    transactionLogger.log({
      blockchain,
      walletType,
      amount,
      message: `Transaction failed: ${error.message}`,
      status: TransactionStatus.FAILED,
      error: error.message
    });

    // Execute callback if provided
    if (callback && typeof callback === 'function') {
      try {
        await callback({
          success: false,
          blockchain,
          walletType,
          amount,
          error: error.message,
          status: TransactionStatus.FAILED
        });
      } catch (callbackError) {
        console.error('[TRANSACTION] Callback execution failed:', callbackError);
      }
    }

    return {
      success: false,
      blockchain,
      walletType,
      amount,
      error: error.message,
      status: TransactionStatus.FAILED
    };

  } finally {
    // Always reset progress state
    transactionState.isTransactionInProgress = false;
  }
}

// Helper functions
export function getSupportedBlockchains() {
  return Object.keys(blockchainHandlers);
}

export function getBlockchainInfo(blockchain) {
  return blockchainHandlers[blockchain];
}

export function resetTransactionState() {
  transactionState.isTransactionInProgress = false;
  transactionState.currentBlockchain = null;
  transactionState.currentStatus = TransactionStatus.IDLE;
  transactionState.transactionHash = null;
  transactionState.error = null;
  transactionState.lastTransactionResult = null;
}

// Transaction history manager
export const transactionHistory = reactive([]);

export function addToHistory(transaction) {
  transactionHistory.unshift({
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ...transaction
  });
  
  // Keep only last 50 transactions
  if (transactionHistory.length > 50) {
    transactionHistory.splice(50);
  }
}

export function getTransactionHistory() {
  return transactionHistory;
}

export function clearTransactionHistory() {
  transactionHistory.splice(0);
}

// Test transaction function with small amounts - now uses global store
export async function testTransaction(callback = null) {
  const globalStore = useGlobalStore();
  const blockchain = globalStore.crypto_selected;

  if (!blockchain) {
    throw new Error('No authenticated blockchain found. Please connect your wallet first.');
  }

  const testAmounts = {
    ethereum: 0.0001,  // 0.0001 ETH
    solana: 0.001,     // 0.001 SOL
    bitcoin: 0.00001,  // 0.00001 BTC
    aptos: 0.001,      // 0.001 APT
    cardano: 1,        // 1 ADA
    sui: 0.001         // 0.001 SUI
  };

  const amount = testAmounts[blockchain];
  if (!amount) {
    throw new Error(`Test amount not defined for ${blockchain}`);
  }

  return await executeUnifiedTransaction(amount, callback);
}
