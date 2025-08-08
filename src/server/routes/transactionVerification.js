////////////////////////////////////////////////////////////////////////
// Transaction Verification API - Server-side transaction confirmation
////////////////////////////////////////////////////////////////////////

import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateJWT } from '../scripts/jwt.js';
import { ethers } from 'ethers';
import axios from 'axios';

// Rate limiting for transaction verification
const verificationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each user to 10 verification requests per minute
  message: "Too many verification requests. Please wait.",
  standardHeaders: true,
  legacyHeaders: false,
});

const CreateTransactionVerificationRoutes = (redisClient) => {
  const router = express.Router();

  // Apply JWT authentication to all routes
  router.use(authenticateJWT);

  // Verify Ethereum transaction
  router.post('/verify-ethereum', verificationLimiter, async (req, res) => {
    try {
      const { txHash, expectedAmount, userAddress } = req.body;
      const authenticatedAddress = req.user?.address;

      // Validate required fields
      if (!txHash || !expectedAmount || !userAddress) {
        return res.status(400).json({ 
          error: 'Missing required fields: txHash, expectedAmount, userAddress' 
        });
      }

      // Ensure authenticated user matches transaction user
      if (authenticatedAddress.toLowerCase() !== userAddress.toLowerCase()) {
        return res.status(403).json({ 
          error: 'Transaction user does not match authenticated user' 
        });
      }

      // Verify transaction on blockchain
      const verification = await verifyEthereumTransaction(txHash, expectedAmount, userAddress);
      
      if (verification.success) {
        // Execute server-side completion logic
        await handleTransactionSuccess({
          userAddress: authenticatedAddress,
          chainType: 'ethereum',
          txHash,
          amount: verification.actualAmount,
          blockNumber: verification.blockNumber
        });

        res.json({
          success: true,
          verified: true,
          txHash,
          blockNumber: verification.blockNumber,
          actualAmount: verification.actualAmount,
          message: 'Transaction verified and processed successfully'
        });
      } else {
        res.json({
          success: false,
          verified: false,
          txHash,
          error: verification.error,
          message: 'Transaction verification failed'
        });
      }

    } catch (error) {
      console.error('[VERIFICATION] Ethereum verification error:', error);
      res.status(500).json({ 
        error: 'Transaction verification failed',
        message: error.message 
      });
    }
  });

  // Verify Solana transaction
  router.post('/verify-solana', verificationLimiter, async (req, res) => {
    try {
      const { txHash, expectedAmount, userAddress } = req.body;
      const authenticatedAddress = req.user?.address;

      if (!txHash || !expectedAmount || !userAddress) {
        return res.status(400).json({ 
          error: 'Missing required fields: txHash, expectedAmount, userAddress' 
        });
      }

      if (authenticatedAddress.toLowerCase() !== userAddress.toLowerCase()) {
        return res.status(403).json({ 
          error: 'Transaction user does not match authenticated user' 
        });
      }

      const verification = await verifySolanaTransaction(txHash, expectedAmount, userAddress);
      
      if (verification.success) {
        await handleTransactionSuccess({
          userAddress: authenticatedAddress,
          chainType: 'solana',
          txHash,
          amount: verification.actualAmount,
          slot: verification.slot
        });

        res.json({
          success: true,
          verified: true,
          txHash,
          slot: verification.slot,
          actualAmount: verification.actualAmount,
          message: 'Transaction verified and processed successfully'
        });
      } else {
        res.json({
          success: false,
          verified: false,
          txHash,
          error: verification.error,
          message: 'Transaction verification failed'
        });
      }

    } catch (error) {
      console.error('[VERIFICATION] Solana verification error:', error);
      res.status(500).json({ 
        error: 'Transaction verification failed',
        message: error.message 
      });
    }
  });

  // Generic transaction verification endpoint
  router.post('/verify-transaction', verificationLimiter, async (req, res) => {
    try {
      const { chainType, txHash, expectedAmount, userAddress } = req.body;
      const authenticatedAddress = req.user?.address;

      if (!chainType || !txHash || !expectedAmount || !userAddress) {
        return res.status(400).json({ 
          error: 'Missing required fields: chainType, txHash, expectedAmount, userAddress' 
        });
      }

      if (authenticatedAddress.toLowerCase() !== userAddress.toLowerCase()) {
        return res.status(403).json({ 
          error: 'Transaction user does not match authenticated user' 
        });
      }

      let verification;
      
      switch (chainType.toLowerCase()) {
        case 'ethereum':
          verification = await verifyEthereumTransaction(txHash, expectedAmount, userAddress);
          break;
        case 'solana':
          verification = await verifySolanaTransaction(txHash, expectedAmount, userAddress);
          break;
        case 'bitcoin':
          verification = await verifyBitcoinTransaction(txHash, expectedAmount, userAddress);
          break;
        case 'aptos':
          verification = await verifyAptosTransaction(txHash, expectedAmount, userAddress);
          break;
        case 'cardano':
          verification = await verifyCardanoTransaction(txHash, expectedAmount, userAddress);
          break;
        case 'sui':
          verification = await verifySuiTransaction(txHash, expectedAmount, userAddress);
          break;
        default:
          return res.status(400).json({ 
            error: `Unsupported blockchain: ${chainType}` 
          });
      }

      if (verification.success) {
        await handleTransactionSuccess({
          userAddress: authenticatedAddress,
          chainType,
          txHash,
          amount: verification.actualAmount,
          blockNumber: verification.blockNumber || verification.slot,
          confirmations: verification.confirmations
        });

        res.json({
          success: true,
          verified: true,
          chainType,
          txHash,
          actualAmount: verification.actualAmount,
          blockNumber: verification.blockNumber || verification.slot,
          confirmations: verification.confirmations,
          message: 'Transaction verified and processed successfully'
        });
      } else {
        res.json({
          success: false,
          verified: false,
          chainType,
          txHash,
          error: verification.error,
          message: 'Transaction verification failed'
        });
      }

    } catch (error) {
      console.error('[VERIFICATION] Generic verification error:', error);
      res.status(500).json({ 
        error: 'Transaction verification failed',
        message: error.message 
      });
    }
  });

  return router;
};

// Ethereum transaction verification using providers
async function verifyEthereumTransaction(txHash, expectedAmount, userAddress) {
  try {
    // Get provider from environment (Infura, Alchemy, etc.)
    const rpcUrl = process.env.ETHEREUM_RPC_URL || process.env.ANKR_RPC;
    
    if (!rpcUrl) {
      throw new Error('No Ethereum RPC URL configured');
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!receipt) {
      return { 
        success: false, 
        error: 'Transaction not found or not yet confirmed' 
      };
    }

    // Check if transaction was successful
    if (receipt.status !== 1) {
      return { 
        success: false, 
        error: 'Transaction failed on blockchain' 
      };
    }

    // Get transaction details
    const transaction = await provider.getTransaction(txHash);
    
    if (!transaction) {
      return { 
        success: false, 
        error: 'Transaction details not found' 
      };
    }

    // Verify sender address
    if (transaction.from.toLowerCase() !== userAddress.toLowerCase()) {
      return { 
        success: false, 
        error: 'Transaction sender does not match user address' 
      };
    }

    // Verify destination address (should be our private wallet)
    const expectedToAddress = process.env.ETHEREUM_PRIVATE_WALLET_ADDRESS;
    if (transaction.to.toLowerCase() !== expectedToAddress.toLowerCase()) {
      return { 
        success: false, 
        error: 'Transaction destination address invalid' 
      };
    }

    // Verify amount (allow for small gas estimation differences)
    const actualAmount = parseFloat(ethers.formatEther(transaction.value));
    const expectedAmountFloat = parseFloat(expectedAmount);
    const tolerance = 0.001; // 0.1% tolerance

    if (Math.abs(actualAmount - expectedAmountFloat) > tolerance) {
      return { 
        success: false, 
        error: `Amount mismatch. Expected: ${expectedAmountFloat}, Actual: ${actualAmount}` 
      };
    }

    // Verify minimum confirmations (optional)
    const currentBlock = await provider.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber;

    return {
      success: true,
      actualAmount,
      blockNumber: receipt.blockNumber,
      confirmations,
      gasUsed: receipt.gasUsed.toString()
    };

  } catch (error) {
    console.error('[ETHEREUM_VERIFY] Verification error:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

// Solana transaction verification
async function verifySolanaTransaction(txHash, expectedAmount, userAddress) {
  try {
    const solanaRpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    
    const response = await axios.post(solanaRpcUrl, {
      jsonrpc: '2.0',
      id: 1,
      method: 'getTransaction',
      params: [
        txHash,
        { encoding: 'json', maxSupportedTransactionVersion: 0 }
      ]
    });

    const transaction = response.data.result;
    
    if (!transaction) {
      return { 
        success: false, 
        error: 'Transaction not found' 
      };
    }

    // Check if transaction was successful
    if (transaction.meta.err) {
      return { 
        success: false, 
        error: 'Transaction failed on blockchain' 
      };
    }

    // Verify transaction details (simplified)
    const actualAmount = Math.abs(transaction.meta.preBalances[0] - transaction.meta.postBalances[0]) / 1e9;
    const expectedAmountFloat = parseFloat(expectedAmount);
    const tolerance = 0.001;

    if (Math.abs(actualAmount - expectedAmountFloat) > tolerance) {
      return { 
        success: false, 
        error: `Amount mismatch. Expected: ${expectedAmountFloat}, Actual: ${actualAmount}` 
      };
    }

    return {
      success: true,
      actualAmount,
      slot: transaction.slot,
      confirmations: 'finalized' // Solana uses finalization instead of confirmations
    };

  } catch (error) {
    console.error('[SOLANA_VERIFY] Verification error:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

// Placeholder verification functions for other blockchains
async function verifyBitcoinTransaction(txHash, expectedAmount, userAddress) {
  // TODO: Implement Bitcoin verification using BlockCypher or similar API
  return { success: false, error: 'Bitcoin verification not implemented yet' };
}

async function verifyAptosTransaction(txHash, expectedAmount, userAddress) {
  // TODO: Implement Aptos verification
  return { success: false, error: 'Aptos verification not implemented yet' };
}

async function verifyCardanoTransaction(txHash, expectedAmount, userAddress) {
  // TODO: Implement Cardano verification
  return { success: false, error: 'Cardano verification not implemented yet' };
}

async function verifySuiTransaction(txHash, expectedAmount, userAddress) {
  // TODO: Implement Sui verification
  return { success: false, error: 'Sui verification not implemented yet' };
}

// Server-side transaction success handler
async function handleTransactionSuccess(transactionData) {
  try {
    const { userAddress, chainType, txHash, amount, blockNumber } = transactionData;
    
    console.log(`[TRANSACTION_SUCCESS] User ${userAddress} completed ${chainType} transaction:`, {
      txHash,
      amount,
      blockNumber
    });

    // Example server-side actions (customize as needed):
    
    // 1. Update user account status
    await updateUserTransactionHistory(userAddress, transactionData);
    
    // 2. Send confirmation email (if email is available)
    // await sendTransactionConfirmationEmail(userAddress, transactionData);
    
    // 3. Unlock content or features
    // await unlockUserContent(userAddress, amount);
    
    // 4. Update user balance or credits
    // await updateUserCredits(userAddress, amount);
    
    // 5. Trigger webhooks or external notifications
    // await triggerExternalWebhook(transactionData);
    
    console.log(`[TRANSACTION_SUCCESS] Server-side processing completed for ${userAddress}`);
    
  } catch (error) {
    console.error('[TRANSACTION_SUCCESS] Error processing transaction success:', error);
    // Don't throw error to avoid affecting the verification response
  }
}

// Example server-side function: Update user transaction history
async function updateUserTransactionHistory(userAddress, transactionData) {
  try {
    // This would typically save to your database
    console.log(`[DB_UPDATE] Saving transaction history for ${userAddress}:`, transactionData);
    
    // Example database operation:
    // await db.transactions.insert({
    //   user_address: userAddress,
    //   chain_type: transactionData.chainType,
    //   tx_hash: transactionData.txHash,
    //   amount: transactionData.amount,
    //   block_number: transactionData.blockNumber,
    //   verified_at: new Date(),
    //   status: 'completed'
    // });
    
  } catch (error) {
    console.error('[DB_UPDATE] Database update error:', error);
  }
}

export default CreateTransactionVerificationRoutes;
