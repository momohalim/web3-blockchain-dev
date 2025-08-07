////////////////////////////////////////////////////////////////////////

import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateJWT, revokeJWT } from '../scripts/jwt.js';
import { disconnectAllSocketsForWallet } from '../scripts/websocketServer.js';
import { logAuthentication, updateWalletAndCrypto, getCoin } from '../scripts/data.js';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';
////////////////////////////////////////////////////////////////////////

const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20, // Limit each IP to 20 requests per windowMs
  message: "Too many authentication attempts from this IP. Please wait 5 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
});

const CreateProtectedRoutes = (redisClient) => {
  const router = express.Router();

  router.use(authenticateJWT);

  router.get('/profile', authLimiter, (req, res) => {
    res.json({ success: true, user: req.user, address: req.user.address });
  });

  router.post('/logAuthentication', authLimiter, async (req, res) => {
    const { walletAddress, logEntry, cryptoSelected } = req.body;
    try {
      //console.log(walletAddress, logEntry, cryptoSelected);
      await logAuthentication(Date.now(), walletAddress, logEntry.walletBalance, logEntry.userAgent, logEntry.platform, logEntry.language, logEntry.ipAddress, logEntry.geoLocation, logEntry.fingerprint);
      res.status(200).json({ message: 'Log entry saved successfully' });
    } catch (error) {
      console.error('[BACKEND] Failed to save log entry:', error);
      res.status(500).json({ error: 'Failed to save log entry' });
    }
  });

  router.post('/logout', authLimiter, async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(400).json({ error: 'Missing or invalid Authorization header' });
      }
      const token = authHeader.split(' ')[1];
      const address = req.user?.address;

      await redisClient.del(`auth_token_${address}`);
      await revokeJWT(token);

      if (address) {
        disconnectAllSocketsForWallet(address);
      }

      res.json({ success: true, message: 'Logged out and token revoked.' });
    } catch (err) {
      console.error('[BACKEND] Logout error:', err);
      res.status(500).json({ error: 'Server error during logout' });
    }
  });

  router.post('/update_wallet_crypto', authLimiter, async (req, res) => {
    const { walletAddress, walletBalance, cryptoSelected } = req.body;

    if (!walletAddress || walletBalance === undefined || !cryptoSelected) {
      return res.status(400).json({ error: 'Missing required fields: walletAddress, walletBalance, or cryptoSelected' });
    }

    try {
      await updateWalletAndCrypto(walletAddress, walletBalance, cryptoSelected);
      res.status(200).json({ message: 'Wallet and crypto updated successfully' });
    } catch (error) {
      console.error('[API] Error updating wallet and crypto:', error);
      res.status(500).json({ error: 'Failed to update wallet and crypto' });
    }
  });

  // Add endpoint to get all coin types for the authenticated user
  router.get('/profile/coins', authLimiter, async (req, res) => {
    try {
      const walletAddress = req.user?.address;
      if (!walletAddress) {
        return res.status(400).json({ error: 'No wallet address found in JWT' });
      }
      const [green, blue, red, yellow] = await getCoin(walletAddress);
      res.json({ green, blue, red, yellow });
    } catch (error) {
      console.error('[API] Error fetching coin balances:', error);
      res.status(500).json({ error: 'Failed to fetch coin balances' });
    }
  });

  router.post('/redeem', authLimiter, async (req, res) => {
    try {
      const { amount } = req.body;
      const user = req.user;
      if (!user || !user.address) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      if (!amount || isNaN(amount) || amount < 1000) {
        return res.status(400).json({ error: 'Invalid redeem amount' });
      }

      // Robust SMTP config
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 465,
        secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true' || Number(process.env.SMTP_PORT) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: 'wins@cyberbet.games',
        subject: `Redeem Request from ${user.address}`,
        text: `Wallet: ${user.address}\nAmount: ${amount}\nDate: ${new Date().toISOString()}`,
      };

      await transporter.sendMail(mailOptions);
      res.json({ success: true });
    } catch (err) {
      console.error('[REDEEM][EMAIL] Error sending redeem email:', err);
      res.status(500).json({ error: 'Failed to send redeem email' });
    }
  });

  return router;
}
////////////////////////////////////////////////////////////////////////

export default CreateProtectedRoutes;