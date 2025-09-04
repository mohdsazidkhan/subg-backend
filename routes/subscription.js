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

// PayU return (success/failure) handler - redirect only (webhook handles DB update)
const handlePayuReturn = (req, res) => {
  console.log('🔁 PayU return hit', { 
    method: req.method, 
    query: req.query, 
    body: req.body, 
    headers: req.headers,
    url: req.url,
    originalUrl: req.originalUrl
  });
  
  // Set frontend URL based on environment
  const redirectBase = process.env.FRONTEND_URL || 
    (process.env.NODE_ENV === 'production' ? 'https://subgquiz.com' : 'https://subgquiz.com');
  
  const txnid = (req.body.txnid || req.query.txnid || '').toString();
  const status = (req.body.status || req.query.status || '').toString().toLowerCase();
  const path = status === 'success' ? '/subscription/payu-success' : '/subscription/payu-failure';
  const qs = new URLSearchParams({ txnid, status }).toString();
  const dest = `${redirectBase}${path}?${qs}`;
  
  console.log('🔁 PayU return data:', { txnid, status, redirectBase, path, dest });
  console.log('🔁 Redirecting to:', dest);
  
  // For debugging - also send a JSON response to see what we're getting
  if (req.query.debug === '1') {
    return res.json({
      method: req.method,
      query: req.query,
      body: req.body,
      txnid,
      status,
      redirectBase,
      path,
      dest
    });
  }
  
  return res.redirect(dest);
};

router.post('/payu-return', handlePayuReturn);
router.get('/payu-return', handlePayuReturn);

// PayU webhook
router.post('/payu-webhook', subscriptionController.payuWebhook);

module.exports = router; 