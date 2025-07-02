const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { 
    type: String, 
    enum: ['credit', 'debit'], 
    required: true 
  },
  amount: { type: Number, required: true },
  balance: { type: Number, required: true }, // balance after transaction
  description: { type: String, required: true },
  category: { 
    type: String, 
    enum: ['quiz_reward', 'subscription_payment', 'refund', 'bonus', 'withdrawal', 'other'],
    default: 'other'
  },
  status: { 
    type: String, 
    enum: ['pending', 'completed', 'failed', 'cancelled'], 
    default: 'completed' 
  },
  reference: { type: String }, // external reference (payment ID, quiz ID, etc.)
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' }, // associated quiz (optional)
  subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' }, // associated subscription (optional)
  metadata: { type: mongoose.Schema.Types.Mixed }, // additional data
  processedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
