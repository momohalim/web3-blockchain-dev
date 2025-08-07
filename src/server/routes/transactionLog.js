import express from 'express';

const router = express.Router();

// In-memory storage for transaction logs (in production, use a database)
const transactionLogs = [];

// POST /api/transaction-log - Log transaction events
router.post('/transaction-log', (req, res) => {
  try {
    const logEntry = {
      ...req.body,
      serverTimestamp: new Date().toISOString(),
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    };

    // Add to logs
    transactionLogs.push(logEntry);

    // Keep only last 1000 logs to prevent memory issues
    if (transactionLogs.length > 1000) {
      transactionLogs.splice(0, transactionLogs.length - 1000);
    }

    console.log('[TRANSACTION LOG]', logEntry);

    res.json({ 
      success: true, 
      message: 'Transaction log saved',
      logId: logEntry.timestamp 
    });

  } catch (error) {
    console.error('[TRANSACTION LOG] Error saving log:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save transaction log' 
    });
  }
});

// GET /api/transaction-logs - Get transaction logs (admin endpoint)
router.get('/transaction-logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    
    const logs = transactionLogs
      .slice(-limit - offset, -offset || undefined)
      .reverse();

    res.json({ 
      success: true, 
      logs,
      total: transactionLogs.length 
    });

  } catch (error) {
    console.error('[TRANSACTION LOG] Error fetching logs:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch transaction logs' 
    });
  }
});

// GET /api/transaction-stats - Get transaction statistics
router.get('/transaction-stats', (req, res) => {
  try {
    const stats = {
      totalTransactions: transactionLogs.length,
      byChain: {},
      byStatus: {},
      last24Hours: 0
    };

    const last24Hours = Date.now() - (24 * 60 * 60 * 1000);

    transactionLogs.forEach(log => {
      // Count by chain
      if (log.chainType) {
        stats.byChain[log.chainType] = (stats.byChain[log.chainType] || 0) + 1;
      }

      // Count by status
      if (log.status) {
        stats.byStatus[log.status] = (stats.byStatus[log.status] || 0) + 1;
      }

      // Count last 24 hours
      if (new Date(log.timestamp).getTime() > last24Hours) {
        stats.last24Hours++;
      }
    });

    res.json({ success: true, stats });

  } catch (error) {
    console.error('[TRANSACTION LOG] Error calculating stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to calculate transaction stats' 
    });
  }
});

export default router;
