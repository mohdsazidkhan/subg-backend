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
  console.log('🔁 PayU return hit - Method:', req.method);
  console.log('🔁 PayU return hit - Query:', JSON.stringify(req.query));
  console.log('🔁 PayU return hit - Body:', JSON.stringify(req.body));
  console.log('🔁 PayU return hit - Headers:', JSON.stringify(req.headers));
  console.log('🔁 PayU return hit - URL:', req.url);
  
  // Set frontend URL based on environment
  const redirectBase = process.env.FRONTEND_URL || 
    (process.env.NODE_ENV === 'production' ? 'https://subgquiz.com' : 'https://subgquiz.com');
  
  // Safely extract txnid and status from both body and query
  // PayU might send data in different formats
  let txnid = '';
  let status = '';
  
  if (req.body && typeof req.body === 'object') {
    txnid = req.body.txnid || req.body.txn_id || req.body.transaction_id || '';
    status = req.body.status || req.body.payment_status || '';
  }
  
  if (!txnid) {
    txnid = req.query.txnid || req.query.txn_id || req.query.transaction_id || '';
  }
  
  if (!status) {
    status = req.query.status || req.query.payment_status || '';
  }
  
  txnid = txnid.toString();
  status = status.toString().toLowerCase();
  
  console.log('🔁 Extracted data:', { txnid, status });
  
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

// Apply body parsing middleware specifically for PayU return
router.post('/payu-return', express.urlencoded({ extended: true }), handlePayuReturn);
router.get('/payu-return', handlePayuReturn);

// PayU webhook
router.post('/payu-webhook', subscriptionController.payuWebhook);

// Test route to verify frontend redirect
router.get('/test-redirect', (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 
    (process.env.NODE_ENV === 'production' ? 'https://subgquiz.com' : 'http://localhost:3000');
  
  const testUrl = `${frontendUrl}/subscription/payu-success?txnid=TEST123&status=success`;
  
  console.log('🧪 Test redirect to:', testUrl);
  res.redirect(testUrl);
});

module.exports = router; 