const express = require('express');
const router = express.Router();
const walletTransactionController = require('../controllers/walletTransactionController');
const { protect } = require('../middleware/auth');

// GET /api/wallet/transactions/:userId - Protected route
router.get('/transactions/:userId', protect, walletTransactionController.getUserWalletTransactions);

module.exports = router;
