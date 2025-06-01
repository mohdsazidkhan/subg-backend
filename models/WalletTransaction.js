const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const walletTransactionSchema = new mongoose.Schema({
  publicId: {
    type: String,
    unique: true,
    default: uuidv4,
  },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['add_money', 'convert_to_coins', 'spend_coins', 'earn_coins'],
    required: true
  },
  amount: { type: Number, required: true }, // INR or coins based on type
  currency: { type: String, enum: ['INR', 'COINS'], required: true },
  description: String,
  liveQuizId: { type: mongoose.Schema.Types.ObjectId, ref: 'LiveQuiz' }, // associated quiz (optional)
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
