const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const walletTransactionController = require('../controllers/walletTransactionController');
const { protect } = require('../middleware/auth');
const razorpay = require("../config/razorpay");
const crypto = require("crypto");
const PaymentOrder = require('../models/PaymentOrder');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');

// UNUSED ENDPOINTS - commented out as not used in frontend
// Get current subscription (protected)
// router.get('/current', protect, subscriptionController.getCurrentSubscription);

// Get subscription plans (public)
// router.get('/plans', subscriptionController.getSubscriptionPlans);

// Create subscription order (protected)
// router.post('/create-order', protect, subscriptionController.createSubscriptionOrder);

// Activate subscription after payment (protected)
// router.post('/activate', protect, subscriptionController.activateSubscription);

// Check feature access (public)
// router.get('/check-access/:feature/:userId', subscriptionController.checkFeatureAccess);

// Get subscription history (protected)
// router.get('/history', protect, subscriptionController.getSubscriptionHistory);

// FRONTEND USED ENDPOINTS - added to match frontend expectations
// Get subscription status for a user
router.get('/status/:userId', async (req, res) => {
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
});

// Get subscription transactions for a user
router.get('/transactions/:userId', async (req, res) => {
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
});

// Create subscription order
router.post('/create-order', async (req, res) => {
  try {
    console.log('📦 Creating subscription order with data:', req.body);
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
      basic: { amount: 99, duration: 365, name: 'Basic Plan' },
      premium: { amount: 499, duration: 365, name: 'Premium Plan' },
      pro: { amount: 999, duration: 365, name: 'Pro Plan' }
    };

    const plan = plans[planId];
    if (!plan) {
      console.error('❌ Invalid plan ID:', planId);
      return res.status(400).json({ success: false, message: "Invalid plan" });
    }

    console.log('✅ Plan found:', plan);

    // Check if Razorpay is configured
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_SECRET) {
      console.error('❌ Razorpay configuration missing');
      return res.status(500).json({ success: false, message: "Payment gateway not configured" });
    }

    const options = {
      amount: plan.amount * 100, // paise
      currency: "INR",
      receipt: `subscription_${planId}_${Date.now()}`,
    };

    console.log('🔧 Creating Razorpay order with options:', options);

    const order = await razorpay.orders.create(options);
    console.log('✅ Razorpay order created:', order.id);
    
    // Save order details in DB
    const paymentOrder = new PaymentOrder({
      orderId: order.id,
      amount: (order.amount / 100),
      currency: order.currency,
      receipt: order.receipt,
      user: user._id,
      razorpayOrderId: order.id,
      planId: planId
    });

    await paymentOrder.save();
    console.log('✅ Payment order saved to database');

    res.status(200).json({
      ...order,
      key: process.env.RAZORPAY_KEY_ID,
      planId: planId
    });
  } catch (err) {
    console.error("❌ Subscription order creation error:", err);
    res.status(500).json({ success: false, message: "Failed to create subscription order", error: err.message });
  }
});

// Verify subscription payment
router.post('/verify', async (req, res) => {
  try {
    console.log('🔍 Payment verification request:', req.body);
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId, planId } = req.body;

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !userId || !planId) {
      console.error('❌ Missing required fields for verification:', { razorpay_order_id, razorpay_payment_id, userId, planId });
      return res.status(400).json({ success: false, message: "Missing required fields for payment verification" });
    }

    // Generate expected signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    console.log('🔐 Signature verification:', { 
      received: razorpay_signature, 
      generated: generatedSignature,
      matches: generatedSignature === razorpay_signature 
    });

    if (generatedSignature !== razorpay_signature) {
      console.error('❌ Invalid signature');
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }

    console.log('✅ Signature verified successfully');

    // Update payment order status
    console.log('🔍 Looking for payment order:', razorpay_order_id);
    const paymentOrder = await PaymentOrder.findOne({ orderId: razorpay_order_id });
    if (!paymentOrder) {
      console.error('❌ Payment order not found:', razorpay_order_id);
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    console.log('✅ Payment order found:', paymentOrder._id);

    paymentOrder.status = "paid";
    paymentOrder.razorpayPaymentId = razorpay_payment_id;
    await paymentOrder.save();
    console.log('✅ Payment order updated successfully');

    // Fetch user
    console.log('🔍 Looking for user:', userId);
    const user = await User.findById(userId);
    if (!user) {
      console.error('❌ User not found:', userId);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    console.log('✅ User found:', user.name);

    // Define subscription plans
    const plans = {
      basic: { amount: 99, duration: 365, name: 'Basic Plan' },
      premium: { amount: 499, duration: 365, name: 'Premium Plan' },
      pro: { amount: 999, duration: 365, name: 'Pro Plan' }
    };

    const plan = plans[planId];
    if (!plan) {
      console.error('❌ Invalid plan ID:', planId);
      return res.status(400).json({ success: false, message: "Invalid plan" });
    }

    console.log('✅ Plan found:', plan);

    // Calculate expiry date
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + plan.duration);
    console.log('📅 Expiry date calculated:', expiryDate);

    // Update user subscription
    user.subscriptionStatus = planId;
    user.subscriptionExpiry = expiryDate;
    await user.save();
    console.log('✅ User subscription updated successfully');

    // Log subscription transaction
    console.log('💰 Creating wallet transaction');
    await WalletTransaction.create({
      user: user._id,
      type: 'debit',
      amount: plan.amount,
      balance: 0,
      description: `${plan.name} subscription activated for ${plan.amount} INR`,
      category: 'subscription_payment'
    });
    console.log('✅ Wallet transaction created successfully');

    console.log('🎉 Payment verification completed successfully');
    return res.status(200).json({ 
      success: true, 
      message: "Subscription payment verified and activated",
      subscription: {
        status: user.subscriptionStatus,
        expiry: user.subscriptionExpiry
      }
    });
  } catch (error) {
    console.error("❌ Error in payment verification:", error);
    console.error("❌ Error stack:", error.stack);
    return res.status(500).json({ 
      success: false, 
      message: "Server error while updating order",
      error: error.message 
    });
  }
});

module.exports = router; 