const dotenv = require('dotenv');
const { getPayuConfig, payuHelpers } = require('../config/payu');
const crypto = require("crypto");
const PaymentOrder = require('../models/PaymentOrder');
const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');
const Subscription = require('../models/Subscription');

dotenv.config();

// Get subscription status for a user
exports.getSubscriptionStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const isActive = user.subscriptionStatus && user.subscriptionExpiry && new Date() < new Date(user.subscriptionExpiry);
    
    res.json({
      success: true,
      data: {
        planName: user.subscriptionStatus || 'Free',
        status: isActive ? 'active' : 'inactive',
        expiryDate: user.subscriptionExpiry,
        isActive: isActive
      }
    });
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Get subscription transactions for a user
exports.getSubscriptionTransactions = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const transactions = await WalletTransaction.find({ 
      user: user._id,
      type: { $in: ['subscription_payment', 'subscription_purchase', 'subscription_renewal'] }
    }).sort({ createdAt: -1 });

    // Transform transactions to match frontend expectations
    const transformedTransactions = transactions.map(transaction => ({
      planName: transaction.description?.includes('Basic') ? 'Basic' : 
                transaction.description?.includes('Premium') ? 'Premium' : 
                transaction.description?.includes('Pro') ? 'Pro' : 'Subscription',
      amount: transaction.amount,
      status: 'completed',
      createdAt: transaction.createdAt
    }));

    res.json({
      success: true,
      data: transformedTransactions
    });
  } catch (error) {
    console.error('Error fetching subscription transactions:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ===== PAYU PAYMENT METHODS =====

// Create PayU subscription order
exports.createPayuSubscriptionOrder = async (req, res) => {
  try {
    console.log('📦 Creating PayU subscription order with data:', req.body);
    const { planId, userId } = req.body;
    
    if (!planId || !userId) {
      console.error('❌ Missing required fields:', { planId, userId });
      return res.status(400).json({ success: false, message: "Missing required fields: planId and userId" });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      console.error('❌ User not found:', userId);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    console.log('✅ User found:', user.name);

    // Define subscription plans
    const plans = {
      basic: { amount: 9, duration: 30, name: 'Basic Plan' },
      premium: { amount: 49, duration: 30, name: 'Premium Plan' },
      pro: { amount: 99, duration: 30, name: 'Pro Plan' }
    };

    const plan = plans[planId];
    if (!plan) {
      console.error('❌ Invalid plan ID:', planId);
      return res.status(400).json({ success: false, message: "Invalid plan" });
    }

    console.log('✅ Plan found:', plan);

    // Check if PayU is configured
    const payuConfig = getPayuConfig();
    if (!payuConfig.merchantId || !payuConfig.merchantKey || !payuConfig.merchantSalt) {
      console.error('❌ PayU configuration missing');
      return res.status(500).json({ success: false, message: "PayU payment gateway not configured" });
    }

    // Generate transaction ID
    const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const receipt = `subscription_${planId}_${Date.now()}`;

    // Prepare PayU payment parameters
    const surl = payuHelpers.buildServerUrl(req, '/api/subscription/payu-return');
    const furl = payuHelpers.buildServerUrl(req, '/api/subscription/payu-return');
    
    console.log('🔗 PayU Return URLs:', { 
      surl: surl, 
      furl: furl,
      frontendUrl: process.env.FRONTEND_URL || 'https://subgquiz.com'
    });
    
    const payuParams = {
      key: payuConfig.merchantKey,
      txnid: transactionId,
      amount: payuHelpers.formatAmountForPayU(plan.amount),
      productinfo: `${plan.name} - 1 month subscription`,
      firstname: user.name || 'User',
      email: user.email,
      phone: user.phone || '9999999999',
      surl: surl,
      furl: furl,
      udf1: userId,
      udf2: planId,
      udf3: receipt,
      udf4: 'subscription',
      udf5: 'monthly'
    };

    // Generate hash
    const hash = payuHelpers.generateRequestHash(payuParams, payuConfig.merchantSalt);
    payuParams.hash = hash;
    // Mask sensitive fields for logs
    const masked = {
      ...payuParams,
      key: '[MASKED]'
    };
    masked.hash = `${hash.slice(0,8)}...${hash.slice(-6)}`;
    console.log('🔧 PayU order parameters:', masked);
    
    // Save order details in DB
    const paymentOrder = new PaymentOrder({
      orderId: transactionId,
      amount: plan.amount,
      currency: 'INR',
      receipt: receipt,
      user: userId,
      planId: planId,
      paymentMethod: 'payu',
      payuTransactionId: transactionId,
      status: 'created'
    });

    await paymentOrder.save();
    console.log('✅ PayU order saved to database:', paymentOrder._id);

    res.json({
      success: true,
      message: "PayU order created successfully",
      orderId: transactionId,
      amount: plan.amount,
      paymentUrl: payuConfig.paymentUrl,
      paymentParams: payuParams
    });

  } catch (error) {
    console.error('❌ Error creating PayU order:', error);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to create PayU order",
      error: error.message 
    });
  }
};

// Verify PayU subscription payment
exports.verifyPayuSubscriptionPayment = async (req, res) => {
  try {
    console.log('🔍 PayU payment verification request headers:', req.headers);
    console.log('🔍 PayU payment verification request body:', req.body);
    const { txnid, status, amount, productinfo, firstname, email, phone, hash, udf1, udf2, udf3, udf4, udf5 } = req.body;

    // Validate required fields
    if (!txnid || !status || !amount || !hash) {
      console.error('❌ Missing required fields for PayU verification:', { txnid, status, amount });
      return res.status(400).json({ success: false, message: "Missing required fields for payment verification" });
    }

    const payuConfig = getPayuConfig();
    
    // Validate hash
    const responseData = {
      status,
      udf1,
      udf2,
      udf3,
      udf4,
      udf5,
      email,
      firstname,
      productinfo,
      amount,
      txnid,
      key: payuConfig.merchantKey
    };

    const isValidHash = payuHelpers.validateResponse({ ...responseData, hash }, { merchantKey: payuConfig.merchantKey, merchantSalt: payuConfig.merchantSalt });
    const expectedHash = payuHelpers.generateResponseHash({ key: payuConfig.merchantKey, ...responseData }, payuConfig.merchantSalt);
    
    console.log('🔐 PayU hash verification:', { 
      received: hash ? `${hash.slice(0,8)}...${hash.slice(-6)}` : undefined, 
      expected: expectedHash ? `${expectedHash.slice(0,8)}...${expectedHash.slice(-6)}` : undefined,
      isValid: isValidHash 
    });

    if (!isValidHash) {
      console.error('❌ Invalid PayU hash');
      return res.status(400).json({ success: false, message: "Invalid hash" });
    }

    console.log('✅ PayU hash verified successfully');

    // Find payment order
    console.log('🔍 Looking for PayU payment order:', txnid);
    const paymentOrder = await PaymentOrder.findOne({ payuTransactionId: txnid });
    if (!paymentOrder) {
      console.error('❌ PayU payment order not found:', txnid);
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    console.log('✅ PayU payment order found:', paymentOrder._id);

    // Update payment order status
    paymentOrder.status = status === 'success' ? 'paid' : 'failed';
    paymentOrder.payuStatus = status;
    paymentOrder.payuResponse = req.body;
    
    if (status === 'success') {
      paymentOrder.payuPaymentId = txnid;
    }
    
    await paymentOrder.save();
    console.log('✅ PayU payment order updated successfully', { orderId: paymentOrder.orderId, status: paymentOrder.status });

    // If payment successful, create/update subscription
    if (status === 'success') {
      const userId = udf1;
      const planId = udf2;

    console.log('🔍 Looking for user:', userId);
    const user = await User.findById(userId);
    if (!user) {
      console.error('❌ User not found:', userId);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    console.log('✅ User found:', user.name);

    // Calculate subscription window
    const startDate = new Date();
      const endDate = new Date(startDate.getTime());
      endDate.setDate(endDate.getDate() + 30); // 30 days

      // Normalize plan to Subscription enum
      const normalizedPlan = (planId || '').toLowerCase(); // 'free' | 'basic' | 'premium' | 'pro'

      // Update or create subscription
      let subscription = await Subscription.findOne({ user: userId });
      if (subscription) {
        subscription.plan = normalizedPlan;
        subscription.status = 'active';
        subscription.startDate = startDate;
        subscription.endDate = endDate;
        await subscription.save();
        console.log('✅ Existing subscription updated', { id: subscription._id });
      } else {
        subscription = new Subscription({
          user: userId,
          plan: normalizedPlan,
          status: 'active',
          startDate,
          endDate
        });
        await subscription.save();
        console.log('✅ New subscription created', { id: subscription._id });
      }

      // Link order to subscription
      paymentOrder.subscriptionId = subscription._id;
      await paymentOrder.save();

      // Update user convenience fields for access checks
      user.currentSubscription = subscription._id;
      user.subscriptionStatus = normalizedPlan;
      user.subscriptionExpiry = endDate;
      await user.save();

      // Simplified: No wallet transaction record needed
      console.log('ℹ️ Skipping wallet transaction creation (simplified flow)');

      res.json({
      success: true, 
        message: "PayU payment verified and subscription activated successfully",
      subscription: {
          plan: subscription.plan,
          status: subscription.status,
          startDate: subscription.startDate,
          endDate: subscription.endDate
        }
      });
    } else {
      res.json({
        success: false,
        message: "PayU payment failed",
        status: status
      });
    }

  } catch (error) {
    console.error("❌ Error in PayU payment verification:", error);
    console.error("❌ Error stack:", error.stack);
    return res.status(500).json({ 
      success: false, 
      message: "Server error while verifying PayU payment",
      error: error.message 
    });
  }
};

// PayU webhook handler
exports.payuWebhook = async (req, res) => {
  try {
    console.log('🔔 PayU webhook received:', req.body);
    
    const { txnid, status, amount, hash } = req.body;
    
    if (!txnid || !status) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Find the payment order
    const paymentOrder = await PaymentOrder.findOne({ payuTransactionId: txnid });
    if (!paymentOrder) {
      console.error('❌ PayU webhook: Order not found:', txnid);
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Update payment status
    paymentOrder.payuStatus = status;
    paymentOrder.payuResponse = req.body;
    
    if (status === 'success') {
      paymentOrder.status = 'paid';
      paymentOrder.payuPaymentId = txnid;
    } else if (status === 'failure') {
      paymentOrder.status = 'failed';
    }
    
    await paymentOrder.save();
    console.log('✅ PayU webhook: Order updated successfully');

    res.json({ success: true, message: "Webhook processed successfully" });

  } catch (error) {
    console.error("❌ Error in PayU webhook:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Server error while processing webhook",
      error: error.message 
    });
  }
};
