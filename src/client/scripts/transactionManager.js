import axios from 'axios';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';

// Import wallet addresses from env
import {
  ETHEREUM_PRIVATE_WALLET_ADDRESS,
  BITCOIN_PRIVATE_WALLET_ADDRESS,
  SOLANA_PRIVATE_WALLET_ADDRESS,
  CARDANO_PRIVATE_WALLET_ADDRESS,
  APTOS_PRIVATE_WALLET_ADDRESS,
  SUI_PRIVATE_WALLET_ADDRESS,
} from './env.js';

// Import existing chain utilities
import { sendTransactionsEthereum } from './chains/ethereum.js';
import { sendTransactionsAptos } from './chains/aptos.js';
import { sendTransactionsSolana } from './chains/solana.js';
import { sendTransactionsBitcoin } from './chains/bitcoin.js';
import { sendTransactionsCardano } from './chains/cardano.js';
import { sendTransactionsSui } from './chains/sui.js';
import { useGlobalStore } from '../stores/global.js';
import { authChecker } from './authenticationChecker.js';
import { cryptobet } from './cryptobet.js';

// Transaction status constants
export const TRANSACTION_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

// Transaction logger
class TransactionLogger {
  constructor() {
    this.logs = [];
  }

  log(transactionData) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      ...transactionData
    };
    this.logs.push(logEntry);
    console.log('[TRANSACTION LOG]', logEntry);
    
    // Send to backend for persistence
    this.sendLogToBackend(logEntry);
  }

  async sendLogToBackend(logEntry) {
    try {
      await axios.post('/api/transaction-log', logEntry);
    } catch (error) {
      console.error('[TRANSACTION LOG] Failed to send log to backend:', error);
    }
  }

  getLogs() {
    return this.logs;
  }

  clearLogs() {
    this.logs = [];
  }
}

// Global transaction logger instance
export const transactionLogger = new TransactionLogger();

// Unified Transaction Manager
export class UnifiedTransactionManager {
  constructor() {
    this.activeTransactions = new Map();
    this.aptosClient = new Aptos(new AptosConfig({ network: Network.MAINNET }));
  }

  // Main unified transaction function
  async executeTransaction(chainType, walletProvider, amount, options = {}) {
    const transactionId = this.generateTransactionId();
    const startTime = Date.now();
    
    try {
      // Validate inputs
      this.validateTransactionInputs(chainType, walletProvider, amount);
      
      // Initialize transaction status
      const transactionStatus = {
        id: transactionId,
        chainType,
        amount,
        status: TRANSACTION_STATUS.PENDING,
        txHash: null,
        error: null,
        startTime,
        endTime: null
      };

      this.activeTransactions.set(transactionId, transactionStatus);

      // Log transaction start
      transactionLogger.log({
        transactionId,
        chainType,
        amount,
        status: TRANSACTION_STATUS.PENDING,
        action: 'transaction_started'
      });

      // Execute callback for transaction start
      if (options.onStatusChange) {
        options.onStatusChange(transactionStatus);
      }

      let txHash;
      
      // Route to specific blockchain implementation
      switch (chainType.toLowerCase()) {
        case 'ethereum':
          txHash = await this.executeEthereumTransaction(walletProvider, amount);
          break;
        case 'solana':
          txHash = await this.executeSolanaTransaction(walletProvider, amount);
          break;
        case 'bitcoin':
          txHash = await this.executeBitcoinTransaction(walletProvider, amount);
          break;
        case 'aptos':
          txHash = await this.executeAptosTransaction(walletProvider, amount);
          break;
        case 'cardano':
          txHash = await this.executeCardanoTransaction(walletProvider, amount);
          break;
        case 'sui':
          txHash = await this.executeSuiTransaction(walletProvider, amount);
          break;
        default:
          throw new Error(`Unsupported blockchain: ${chainType}`);
      }

      // Update transaction status to pending verification
      transactionStatus.status = TRANSACTION_STATUS.PENDING;
      transactionStatus.txHash = txHash;
      transactionStatus.endTime = Date.now();

      this.activeTransactions.set(transactionId, transactionStatus);

      // Log transaction submitted for verification
      transactionLogger.log({
        transactionId,
        chainType,
        amount,
        txHash,
        status: TRANSACTION_STATUS.PENDING,
        action: 'transaction_submitted_for_verification',
        duration: transactionStatus.endTime - transactionStatus.startTime
      });

      // Execute callback for submission
      if (options.onStatusChange) {
        options.onStatusChange(transactionStatus);
      }

      // Send transaction to server for verification
      try {
        const verificationResult = await this.verifyTransactionOnServer({
          chainType,
          txHash,
          expectedAmount: amount,
          userAddress: this.getUserAddress()
        });

        if (verificationResult.verified) {
          // Update transaction status on server verification success
          transactionStatus.status = TRANSACTION_STATUS.SUCCESS;
          transactionStatus.verified = true;
          transactionStatus.blockNumber = verificationResult.blockNumber;

          this.activeTransactions.set(transactionId, transactionStatus);

          // Log verified transaction
          transactionLogger.log({
            transactionId,
            chainType,
            amount,
            txHash,
            status: TRANSACTION_STATUS.SUCCESS,
            action: 'transaction_verified_by_server',
            blockNumber: verificationResult.blockNumber
          });

          // Execute completion callback
          if (options.onComplete) {
            options.onComplete(transactionStatus);
          }

          return {
            success: true,
            transactionId,
            txHash,
            status: TRANSACTION_STATUS.SUCCESS,
            verified: true,
            blockNumber: verificationResult.blockNumber
          };
        } else {
          // Server verification failed
          throw new Error(`Server verification failed: ${verificationResult.error}`);
        }
      } catch (verificationError) {
        console.error('[VERIFICATION] Server verification failed:', verificationError);

        // Update transaction status to failed verification
        transactionStatus.status = TRANSACTION_STATUS.FAILED;
        transactionStatus.error = `Verification failed: ${verificationError.message}`;
        transactionStatus.verified = false;

        this.activeTransactions.set(transactionId, transactionStatus);

        // Log verification failure
        transactionLogger.log({
          transactionId,
          chainType,
          amount,
          txHash,
          status: TRANSACTION_STATUS.FAILED,
          action: 'transaction_verification_failed',
          error: verificationError.message
        });

        // Execute error callback
        if (options.onError) {
          options.onError(verificationError, transactionStatus);
        }

        throw verificationError;
      }

    } catch (error) {
      // Update transaction status on failure
      const transactionStatus = this.activeTransactions.get(transactionId) || {};
      transactionStatus.status = TRANSACTION_STATUS.FAILED;
      transactionStatus.error = error.message;
      transactionStatus.endTime = Date.now();
      
      this.activeTransactions.set(transactionId, transactionStatus);

      // Log failed transaction
      transactionLogger.log({
        transactionId,
        chainType,
        amount,
        status: TRANSACTION_STATUS.FAILED,
        error: error.message,
        action: 'transaction_failed',
        duration: (transactionStatus.endTime || Date.now()) - startTime
      });

      // Execute callback for failure
      if (options.onStatusChange) {
        options.onStatusChange(transactionStatus);
      }
      if (options.onError) {
        options.onError(error, transactionStatus);
      }

      throw error;
    }
  }

  // Ethereum transaction implementation
  async executeEthereumTransaction(walletProvider, amountInEth) {
    try {
      const txHash = await sendTransactionsEthereum(walletProvider, amountInEth.toString());
      return txHash;
    } catch (error) {
      console.error('[ETHEREUM] Transaction failed:', error);
      throw new Error(`Ethereum transaction failed: ${error.message}`);
    }
  }

  // Solana transaction implementation
  async executeSolanaTransaction(walletProvider, amountInSol) {
    try {
      const txHash = await sendTransactionsSolana(walletProvider, amountInSol);
      return txHash;
    } catch (error) {
      console.error('[SOLANA] Transaction failed:', error);
      throw new Error(`Solana transaction failed: ${error.message}`);
    }
  }

  // Bitcoin transaction implementation
  async executeBitcoinTransaction(walletProvider, amountInBtc) {
    try {
      // Determine wallet type based on provider
      let walletType = 'unknown';
      if (window.unisat && walletProvider === window.unisat) {
        walletType = 'unisat';
      } else if (window.XverseProviders?.BitcoinProvider) {
        walletType = 'xverse';
      } else if (window.LeatherProvider && walletProvider === window.LeatherProvider) {
        walletType = 'leather';
      }

      const txHash = await sendTransactionsBitcoin(walletProvider, amountInBtc, walletType);
      return txHash;
    } catch (error) {
      console.error('[BITCOIN] Transaction failed:', error);
      throw new Error(`Bitcoin transaction failed: ${error.message}`);
    }
  }

  // Aptos transaction implementation
  async executeAptosTransaction(walletProvider, amountInApt) {
    try {
      const txHash = await sendTransactionsAptos(walletProvider, amountInApt);
      return txHash;
    } catch (error) {
      console.error('[APTOS] Transaction failed:', error);
      throw new Error(`Aptos transaction failed: ${error.message}`);
    }
  }

  // Cardano transaction implementation
  async executeCardanoTransaction(walletProvider, amountInAda) {
    try {
      const txHash = await sendTransactionsCardano(walletProvider, amountInAda);
      return txHash;
    } catch (error) {
      console.error('[CARDANO] Transaction failed:', error);
      throw new Error(`Cardano transaction failed: ${error.message}`);
    }
  }

  // Sui transaction implementation
  async executeSuiTransaction(walletProvider, amountInSui) {
    try {
      const txHash = await sendTransactionsSui(walletProvider, amountInSui);
      return txHash;
    } catch (error) {
      console.error('[SUI] Transaction failed:', error);
      throw new Error(`Sui transaction failed: ${error.message}`);
    }
  }



  // Utility functions
  validateTransactionInputs(chainType, walletProvider, amount) {
    if (!chainType || typeof chainType !== 'string') {
      throw new Error('Invalid chain type');
    }
    
    if (!walletProvider) {
      throw new Error('Wallet provider is required');
    }
    
    if (!amount || isNaN(amount) || amount <= 0) {
      throw new Error('Invalid transaction amount');
    }
  }

  generateTransactionId() {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getTransactionStatus(transactionId) {
    return this.activeTransactions.get(transactionId);
  }

  getAllActiveTransactions() {
    return Array.from(this.activeTransactions.values());
  }

  clearCompletedTransactions() {
    for (const [id, tx] of this.activeTransactions) {
      if (tx.status !== TRANSACTION_STATUS.PENDING) {
        this.activeTransactions.delete(id);
      }
    }
  }

  // Send transaction to server for verification
  async verifyTransactionOnServer({ chainType, txHash, expectedAmount, userAddress }) {
    try {
      const response = await axios.post('/api/verify/verify-transaction', {
        chainType,
        txHash,
        expectedAmount,
        userAddress
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        return {
          verified: response.data.verified,
          blockNumber: response.data.blockNumber,
          actualAmount: response.data.actualAmount,
          confirmations: response.data.confirmations,
          error: response.data.error
        };
      } else {
        throw new Error(response.data.message || 'Server verification failed');
      }
    } catch (error) {
      console.error('[VERIFICATION] Server request failed:', error);
      throw new Error(`Server verification request failed: ${error.message}`);
    }
  }

  // Get current user address from global store
  getUserAddress() {
    try {
      // Import global store to get current user address
      if (typeof window !== 'undefined') {
        const globalStore = useGlobalStore();
        return globalStore.wallet_connected_address;
      }
      return null;
    } catch (error) {
      console.error('[USER_ADDRESS] Error getting user address:', error);
      return null;
    }
  }
}

// Global transaction manager instance
export const transactionManager = new UnifiedTransactionManager();

// Convenience function for executing transactions - now uses global store values automatically
export async function executeBlockchainTransaction(amount, callbacks = {}) {
  // Get values from global store
  const globalStore = useGlobalStore();
  const chainType = globalStore.crypto_selected;
  const walletType = globalStore.wallet_selected;

  if (!chainType || !walletType) {
    throw new Error('No authenticated blockchain or wallet found. Please connect your wallet first.');
  }

  // Get wallet provider from cryptobet
  const walletProvider = cryptobet[chainType] && cryptobet[chainType][walletType] ?
                         cryptobet[chainType][walletType].provider : null;

  if (!walletProvider && !authChecker.shouldSkipAuthentication(chainType)) {
    throw new Error(`Wallet provider not found for ${walletType} on ${chainType}`);
  }

  return await transactionManager.executeTransaction(chainType, walletProvider, amount, callbacks);
}

// Export for external use
export default {
  UnifiedTransactionManager,
  transactionManager,
  executeBlockchainTransaction,
  transactionLogger,
  TRANSACTION_STATUS
};
