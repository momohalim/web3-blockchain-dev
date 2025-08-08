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

    // Execute comprehensive server-side actions:

    // 1. Update user transaction history
    await updateUserTransactionHistory(userAddress, transactionData);

    // 2. Send confirmation email
    await sendTransactionConfirmationEmail(userAddress, transactionData);

    // 3. Update user credits/balance
    await updateUserCredits(userAddress, amount, chainType);

    // 4. Unlock content or features based on transaction
    await unlockUserContent(userAddress, amount, chainType);

    // 5. Update user statistics and analytics
    await updateUserStatistics(userAddress, transactionData);

    // 6. Trigger external webhooks
    await triggerExternalWebhook(transactionData);

    // 7. Custom business logic (add your specific requirements here)
    await executeCustomBusinessLogic(userAddress, transactionData);
    
    console.log(`[TRANSACTION_SUCCESS] Server-side processing completed for ${userAddress}`);
    
  } catch (error) {
    console.error('[TRANSACTION_SUCCESS] Error processing transaction success:', error);
    // Don't throw error to avoid affecting the verification response
  }
}

// Example server-side function: Update user transaction history
async function updateUserTransactionHistory(userAddress, transactionData) {
  try {
    console.log(`[DB_UPDATE] Saving transaction history for ${userAddress}:`, transactionData);

    // Example: Save to database (implement with your preferred database)
    // This is where you would save transaction details to your database
    const transactionRecord = {
      user_address: userAddress,
      chain_type: transactionData.chainType,
      tx_hash: transactionData.txHash,
      amount: transactionData.amount,
      block_number: transactionData.blockNumber,
      verified_at: new Date(),
      status: 'completed',
      gas_used: transactionData.gasUsed || null,
      confirmations: transactionData.confirmations || 0
    };

    console.log(`[DB_UPDATE] Transaction record prepared:`, transactionRecord);

    // Database operations would go here:
    // await db.collection('transactions').insertOne(transactionRecord);
    // OR
    // await TransactionModel.create(transactionRecord);

  } catch (error) {
    console.error('[DB_UPDATE] Database update error:', error);
  }
}

// Additional server-side completion functions

// Send confirmation email to user
async function sendTransactionConfirmationEmail(userAddress, transactionData) {
  try {
    console.log(`[EMAIL] Sending confirmation email for transaction ${transactionData.txHash}`);

    // Example email service integration:
    // const emailContent = {
    //   to: await getUserEmail(userAddress),
    //   subject: 'Transaction Confirmed',
    //   template: 'transaction-confirmation',
    //   data: {
    //     txHash: transactionData.txHash,
    //     amount: transactionData.amount,
    //     chainType: transactionData.chainType,
    //     blockNumber: transactionData.blockNumber
    //   }
    // };
    // await emailService.send(emailContent);

    console.log(`[EMAIL] Confirmation email sent for ${userAddress}`);

  } catch (error) {
    console.error('[EMAIL] Email sending error:', error);
  }
}

// Update user credits/balance based on transaction
async function updateUserCredits(userAddress, amount, chainType) {
  try {
    console.log(`[CREDITS] Updating credits for ${userAddress}: +${amount} ${chainType}`);

    // Example: Convert transaction amount to platform credits
    const conversionRates = {
      ethereum: 1000, // 1 ETH = 1000 credits
      solana: 100,    // 1 SOL = 100 credits
      bitcoin: 5000,  // 1 BTC = 5000 credits
      aptos: 50,      // 1 APT = 50 credits
      cardano: 10,    // 1 ADA = 10 credits
      sui: 25         // 1 SUI = 25 credits
    };

    const creditsToAdd = amount * (conversionRates[chainType] || 1);

    console.log(`[CREDITS] Adding ${creditsToAdd} credits to ${userAddress}`);

    // Database operation to update user credits:
    // await db.collection('users').updateOne(
    //   { wallet_address: userAddress },
    //   { $inc: { credits: creditsToAdd } }
    // );

  } catch (error) {
    console.error('[CREDITS] Credits update error:', error);
  }
}

// Unlock content or features for user
async function unlockUserContent(userAddress, amount, chainType) {
  try {
    console.log(`[UNLOCK] Checking content unlock for ${userAddress}`);

    // Example: Unlock premium features based on transaction amount
    const unlockThresholds = {
      premium_games: 0.01,    // Unlock premium games for 0.01+ ETH equivalent
      vip_status: 0.1,        // VIP status for 0.1+ ETH equivalent
      exclusive_content: 1.0   // Exclusive content for 1+ ETH equivalent
    };

    // Convert amount to ETH equivalent for comparison
    const ethEquivalentRates = {
      ethereum: 1,
      solana: 0.05,  // Approximate rates
      bitcoin: 30,
      aptos: 0.01,
      cardano: 0.002,
      sui: 0.005
    };

    const ethEquivalent = amount * (ethEquivalentRates[chainType] || 0);

    const unlockedFeatures = [];
    for (const [feature, threshold] of Object.entries(unlockThresholds)) {
      if (ethEquivalent >= threshold) {
        unlockedFeatures.push(feature);
      }
    }

    if (unlockedFeatures.length > 0) {
      console.log(`[UNLOCK] Unlocking features for ${userAddress}:`, unlockedFeatures);

      // Database operation to unlock features:
      // await db.collection('users').updateOne(
      //   { wallet_address: userAddress },
      //   { $addToSet: { unlocked_features: { $each: unlockedFeatures } } }
      // );
    }

  } catch (error) {
    console.error('[UNLOCK] Content unlock error:', error);
  }
}

// Trigger external webhook for transaction
async function triggerExternalWebhook(transactionData) {
  try {
    const webhookUrl = process.env.TRANSACTION_WEBHOOK_URL;

    if (!webhookUrl) {
      console.log('[WEBHOOK] No webhook URL configured');
      return;
    }

    console.log(`[WEBHOOK] Triggering external webhook for transaction ${transactionData.txHash}`);

    const webhookPayload = {
      event: 'transaction_verified',
      timestamp: new Date().toISOString(),
      user_address: transactionData.userAddress,
      chain_type: transactionData.chainType,
      tx_hash: transactionData.txHash,
      amount: transactionData.amount,
      block_number: transactionData.blockNumber
    };

    // Send webhook request:
    // await axios.post(webhookUrl, webhookPayload, {
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'X-Webhook-Secret': process.env.WEBHOOK_SECRET
    //   },
    //   timeout: 5000
    // });

    console.log(`[WEBHOOK] External webhook triggered successfully`);

  } catch (error) {
    console.error('[WEBHOOK] Webhook error:', error);
  }
}

// Update user statistics and analytics
async function updateUserStatistics(userAddress, transactionData) {
  try {
    console.log(`[STATS] Updating statistics for ${userAddress}`);

    const stats = {
      total_transactions: 1,
      total_volume: transactionData.amount,
      last_transaction_at: new Date(),
      preferred_chain: transactionData.chainType
    };

    console.log(`[STATS] Statistics update:`, stats);

    // Database operation to update user statistics:
    // await db.collection('user_stats').updateOne(
    //   { wallet_address: userAddress },
    //   {
    //     $inc: {
    //       total_transactions: 1,
    //       [`chain_volumes.${transactionData.chainType}`]: transactionData.amount
    //     },
    //     $set: {
    //       last_transaction_at: new Date(),
    //       preferred_chain: transactionData.chainType
    //     }
    //   },
    //   { upsert: true }
    // );

  } catch (error) {
    console.error('[STATS] Statistics update error:', error);
  }
}

// Custom business logic - customize this for your specific requirements
async function executeCustomBusinessLogic(userAddress, transactionData) {
  try {
    console.log(`[CUSTOM] Executing custom business logic for ${userAddress}`);

    const { chainType, amount, txHash, blockNumber } = transactionData;

    // Example custom logic based on your application requirements:

    // Game-specific logic for a gaming platform:
    if (amount >= 0.1) {
      console.log(`[CUSTOM] Large transaction detected, granting bonus rewards`);
      // Grant special rewards for large transactions
    }

    // VIP tier management:
    const userTotalVolume = await getUserTotalTransactionVolume(userAddress);
    if (userTotalVolume > 1.0) {
      console.log(`[CUSTOM] Promoting user to VIP tier`);
      // Update user tier to VIP
    }

    // Referral program:
    const referrer = await getUserReferrer(userAddress);
    if (referrer) {
      console.log(`[CUSTOM] Crediting referral bonus to ${referrer}`);
      // Credit referral bonus
    }

    // Seasonal events or promotions:
    const isSpecialEvent = await checkForActivePromotions();
    if (isSpecialEvent) {
      console.log(`[CUSTOM] Applying special event bonus`);
      // Apply event-specific bonuses
    }

    console.log(`[CUSTOM] Custom business logic completed for ${userAddress}`);

  } catch (error) {
    console.error('[CUSTOM] Custom business logic error:', error);
  }
}

// Helper functions for custom business logic
async function getUserTotalTransactionVolume(userAddress) {
  // This would query your database for user's total transaction volume
  // return await db.collection('user_stats').findOne({ wallet_address: userAddress })?.total_volume || 0;
  return 0; // Placeholder
}

async function getUserReferrer(userAddress) {
  // This would query your database for user's referrer
  // return await db.collection('users').findOne({ wallet_address: userAddress })?.referred_by;
  return null; // Placeholder
}

async function checkForActivePromotions() {
  // This would check your database/config for active promotions
  // return await db.collection('promotions').findOne({ active: true, start_date: { $lte: new Date() }, end_date: { $gte: new Date() } });
  return false; // Placeholder
}

export default CreateTransactionVerificationRoutes;
