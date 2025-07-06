const dotenv = require('dotenv');
const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const razorpay = require("../config/razorpay");
dotenv.config();

// 1. Create order
const PaymentOrder = require('../models/PaymentOrder');
const WalletTransaction = require('../models/WalletTransaction');
const User = require('../models/User');
const Subscription = require('../models/Subscription');

// Create wallet payment order (legacy - for backward compatibility)
router.post("/create-order", async (req, res) => {
  const { amount, userId } = req.body;
  const user = await User.findById(userId)
  const options = {
    amount: amount * 100, // paise
    currency: "INR",
    receipt: `user_order_${Date.now()}`,
  };

  try {
    const order = await razorpay.orders.create(options);
    // Save order details in DB
    const paymentOrder = new PaymentOrder({
      orderId: order.id,
      amount: (order.amount / 100),
      currency: order.currency,
      receipt: order.receipt,
      user: user?._id,
      razorpayOrderId: order.id
    });

    await paymentOrder.save();

    res.status(200).json({
      ...order,
      // Removed key for security - frontend should use environment variable
    });
  } catch (err) {
    console.error("Order creation error:", err);
    res.status(500).send("Failed to create Razorpay order");
  }
});



// 2. Verify payment
router.post("/verify", async (req, res) => {

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId, amount, subscriptionId } = req.body;

  // Generate expected signature
  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_SECRET)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");

  if (generatedSignature === razorpay_signature) {
    try {
      // Update payment order status
      const paymentOrder = await PaymentOrder.findOne({ orderId: razorpay_order_id });
      if (!paymentOrder) {
        return res.status(404).json({ success: false, message: "Order not found" });
      }

      paymentOrder.status = "paid";
      paymentOrder.razorpayPaymentId = razorpay_payment_id;
      await paymentOrder.save();

      // Fetch user by publicId
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      // Handle subscription payment
      if (subscriptionId) {
        const subscription = await Subscription.findById(subscriptionId);
        if (!subscription) {
          return res.status(404).json({ success: false, message: "Subscription not found" });
        }

        // Update subscription status
        subscription.status = 'active';
        subscription.paymentId = razorpay_payment_id;
        subscription.orderId = razorpay_order_id;
        await subscription.save();

        // Update user subscription
        user.currentSubscription = subscription._id;
        user.subscriptionStatus = subscription.plan;
        user.subscriptionExpiry = subscription.endDate;
        await user.save();

        // Log subscription transaction
        await WalletTransaction.create({
          user: user._id,
          type: 'debit',
          amount: subscription.amount,
          balance: 0,
          description: `${subscription.plan} subscription activated for ${subscription.amount} INR`,
          category: 'subscription_payment'
        });

        return res.status(200).json({ 
          success: true, 
          message: "Subscription payment verified and activated",
          subscriptionStatus: user.subscriptionStatus,
          subscriptionExpiry: user.subscriptionExpiry
        });
      } else {
        // Handle wallet payment (legacy)
        // Remove user.balance and user.coins logic
        return res.status(200).json({ success: true, message: "Payment verified and wallet updated" });
      }
    } catch (error) {
      console.error("Error updating payment order:", error);
      return res.status(500).json({ success: false, message: "Server error while updating order" });
    }
  } else {
    return res.status(400).json({ success: false, message: "Invalid signature" });
  }
});

module.exports = router;
