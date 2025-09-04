const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const { protect } = require('../middleware/auth');

// Get subscription status for a user
router.get('/status/:userId', subscriptionController.getSubscriptionStatus);

// Get subscription transactions for a user
router.get('/transactions/:userId', subscriptionController.getSubscriptionTransactions);

// Get user payment transactions with filtering (authenticated user only)
router.get('/payment-transactions', protect, subscriptionController.getUserPaymentTransactions);

// Get transaction filter options (months, years) (authenticated user only)
router.get('/transaction-filters', protect, subscriptionController.getTransactionFilterOptions);

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
    (process.env.NODE_ENV === 'production' ? 'https://subgquiz.com' : 'http://localhost:3000');
  
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
  
  // Determine the frontend path based on status
  const path = status === 'success' ? '/subscription/payu-success' : '/subscription/payu-failure';
  
  // Build query parameters for frontend redirect
  const queryParams = new URLSearchParams();
  if (txnid) queryParams.set('txnid', txnid);
  if (status) queryParams.set('status', status);
  
  // Add additional PayU parameters if available
  if (req.body) {
    if (req.body.amount) queryParams.set('amount', req.body.amount);
    if (req.body.productinfo) queryParams.set('productinfo', req.body.productinfo);
    if (req.body.firstname) queryParams.set('firstname', req.body.firstname);
    if (req.body.email) queryParams.set('email', req.body.email);
    if (req.body.phone) queryParams.set('phone', req.body.phone);
    if (req.body.hash) queryParams.set('hash', req.body.hash);
    if (req.body.udf1) queryParams.set('udf1', req.body.udf1);
    if (req.body.udf2) queryParams.set('udf2', req.body.udf2);
    if (req.body.udf3) queryParams.set('udf3', req.body.udf3);
    if (req.body.udf4) queryParams.set('udf4', req.body.udf4);
    if (req.body.udf5) queryParams.set('udf5', req.body.udf5);
  }
  
  const dest = `${redirectBase}${path}?${queryParams.toString()}`;
  
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

// Test route to verify API is working
router.get('/test-api', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API is working',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

module.exports = router; 