const express = require('express');
const router = express.Router();
const bankDetailController = require('../controllers/bankDetailController');
const { protect, adminOnly } = require('../middleware/auth');

// User routes - require authentication
router.post('/', protect, bankDetailController.saveBankDetails);
router.get('/my-details', protect, bankDetailController.getBankDetails);

// Admin routes - require admin privileges
router.get('/', protect, adminOnly, bankDetailController.getAllBankDetails);

module.exports = router;