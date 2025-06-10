const express = require('express');
const router = express.Router();
const walletTransactionController = require('../controllers/walletTransactionController');

// GET /api/wallet/transactions/:userId
router.get('/transactions/:userId', walletTransactionController.getUserWalletTransactions);

module.exports = router;
