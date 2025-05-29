const mongoose = require('mongoose');

const paymentOrderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true }, // razorpay order id
  paymentId: { type: String, unique: true, default: "" }, // razorpay order id
  amount: { type: Number, required: true }, // amount in paise
  currency: { type: String, required: true, default: 'INR' },
  receipt: { type: String },
  status: { type: String, default: 'created' }, // created, paid, failed etc.
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // user who made payment (optional)
  liveQuizId: { type: mongoose.Schema.Types.ObjectId, ref: 'LiveQuiz' }, // associated quiz (optional)
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PaymentOrder', paymentOrderSchema);
