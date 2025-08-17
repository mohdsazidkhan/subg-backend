const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');

// Get subscription status for a user
router.get('/status/:userId', subscriptionController.getSubscriptionStatus);

// Get subscription transactions for a user
router.get('/transactions/:userId', subscriptionController.getSubscriptionTransactions);

// Create subscription order
router.post('/create-order', subscriptionController.createSubscriptionOrder);

// Verify subscription payment
router.post('/verify', subscriptionController.verifySubscriptionPayment);

module.exports = router; 