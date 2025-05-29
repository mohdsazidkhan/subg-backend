const dotenv = require('dotenv');
const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const razorpay = require("../config/razorpay");
dotenv.config();

// 1. Create order
const PaymentOrder = require('../models/PaymentOrder');

router.post("/create-order", async (req, res) => {
  const { amount, userId, liveQuizId } = req.body;

  const options = {
    amount: amount * 100, // paise
    currency: "INR",
    receipt: `quiz_order_${Date.now()}`,
  };

  try {
    const order = await razorpay.orders.create(options);
    // Save order details in DB
    const paymentOrder = new PaymentOrder({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      user: userId,
      liveQuizId: liveQuizId,
      paymentId: ""
    });

    await paymentOrder.save();

    res.status(200).json({
      ...order,
      key: process.env.RAZORPAY_KEY_ID  // <-- Include key here
    });
  } catch (err) {
    console.error("Order creation error:", err);
    res.status(500).send("Failed to create Razorpay order");
  }
});


// 2. Verify payment
router.post("/verify", async (req, res) => {

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  // Generate expected signature
  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_SECRET)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");

  if (generatedSignature === razorpay_signature) {
    try {
      // Update payment order status in DB
      const paymentOrder = await PaymentOrder.findOne({ orderId: razorpay_order_id });
      if (!paymentOrder) {
        return res.status(404).json({ success: false, message: "Order not found" });
      }

      paymentOrder.status = "paid";
      paymentOrder.paymentId = razorpay_payment_id;
      await paymentOrder.save();

      return res.status(200).json({ success: true, message: "Payment verified and order updated" });
    } catch (error) {
      console.error("Error updating payment order:", error);
      return res.status(500).json({ success: false, message: "Server error while updating order" });
    }
  } else {
    return res.status(400).json({ success: false, message: "Invalid signature" });
  }
});


module.exports = router;
