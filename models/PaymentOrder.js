const mongoose = require('mongoose');

const paymentOrderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  receipt: { type: String, required: true },
  status: { type: String, enum: ['created', 'authorized', 'paid', 'failed', 'refunded'], default: 'created' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' }, // associated subscription (optional)
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' }, // associated quiz (optional)
  planId: { type: String }, // for subscription orders
  paymentMethod: { type: String, default: 'razorpay' },
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  razorpaySignature: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed },
  notes: { type: String },
  refundId: { type: String },
  refundAmount: { type: Number },
  refundReason: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('PaymentOrder', paymentOrderSchema);
