////////////////////////////////////////////////////////////////////////

import express from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'fs';

import dotenv from 'dotenv';
dotenv.config();

////////////////////////////////////////////////////////////////////////

const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20, // Limit each IP to 20 requests per windowMs
  message: "Too many authentication attempts from this IP. Please wait 5 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
});

const CreateUnprotectedRoutes = (redisClient) => {
  const router = express.Router();

  router.get('/unprotected', authLimiter, (req, res) => {
    res.json({ success: true, user: req.user, address: req.user.address });
  });

  router.get('/maintenance', (req, res) => {
    try {
      const serverConfig = JSON.parse(fs.readFileSync('src/server/settings.json', 'utf8'));
      const isMaintenance = serverConfig.isMaintenance && process.env.NODE_ENV === 'production';
      res.json({ isMaintenance });
      //console.log('[BACKEND] Server status checked:', { isMaintenance });
    } catch (error) {
      console.error('[BACKEND] Error reading server.json:', error);
      res.status(500).json({ error: 'Failed to read server status' });
    }
  });

  router.post('/verifyRecaptcha', async (req, res) => {
    const { token } = req.body;
    const secret = process.env.RECAPTCHA_SECRET_KEY;
    if (!token) {
      return res.status(400).json({ success: false, error: 'No token provided' });
    }
    if (!secret) {
      return res.status(500).json({ success: false, error: 'Server misconfiguration' });
    }
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`
      });
      const data = await response.json();
      //console.log('[BACKEND] Google reCAPTCHA response:', data);
      if (data.success) {
        return res.json({ success: true, score: data.score, action: data.action });
      } else {
        return res.status(401).json({ success: false, error: 'reCAPTCHA failed', details: data });
      }
    } catch (err) {
      console.error('[BACKEND] Error verifying reCAPTCHA:', err);
      return res.status(500).json({ success: false, error: 'Server error' });
    }
  });

  router.get('/getAnkrRpc', authLimiter, (req, res) => {
    try {
      const rpcUrl = process.env.ANKR_RPC;
      if (!rpcUrl) {
        return res.status(500).json({ error: 'ANKR_RPC is not configured' });
      }
      res.json({ rpcUrl });
    } catch (error) {
      console.error('[BACKEND] Error fetching ANKR_RPC:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });


  return router;
}
////////////////////////////////////////////////////////////////////////

export default CreateUnprotectedRoutes;