const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');

// Get subscription status for a user
router.get('/status/:userId', subscriptionController.getSubscriptionStatus);

// Get subscription transactions for a user
router.get('/transactions/:userId', subscriptionController.getSubscriptionTransactions);

// (Razorpay removed)

// ===== PAYU PAYMENT ROUTES =====

// Create PayU subscription order
router.post('/create-payu-order', subscriptionController.createPayuSubscriptionOrder);

// Verify PayU subscription payment
router.post('/verify-payu', subscriptionController.verifyPayuSubscriptionPayment);

// PayU return (success/failure) handler - verifies then redirects
router.post('/payu-return', async (req, res, next) => {
  try {
    // Reuse verification logic
    req.body = req.body || {};
    const result = await subscriptionController.verifyPayuSubscriptionPayment(req, {
      status: (code) => ({ json: (payload) => ({ code, payload }) }),
      json: (payload) => ({ code: 200, payload })
    });
    const success = !result || result.code === 200 && result.payload && result.payload.success;
    const redirectBase = process.env.FRONTEND_URL || 'http://localhost:3000';
    const path = success ? '/subscription/payu-success' : '/subscription/payu-failure';
    // Propagate minimal info as query params
    const params = new URLSearchParams({ txnid: req.body.txnid || '', status: req.body.status || '' }).toString();
    return res.redirect(`${redirectBase}${path}?${params}`);
  } catch (e) {
    const redirectBase = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${redirectBase}/subscription/payu-failure`);
  }
});

// PayU webhook
router.post('/payu-webhook', subscriptionController.payuWebhook);

module.exports = router; 