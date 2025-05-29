// models/LiveQuiz.js
const mongoose = require('mongoose');

const liveQuizSchema = new mongoose.Schema({
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isActive: { type: Boolean, default: false },
  currentQuestionIndex: { type: Number, default: 0 }, // global quiz progress (for live mode)
  participants: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    score: { type: Number, default: 0 },
    coinsEarned: { type: Number, default: 0 },
    currentQuestionIndex: { type: Number, default: 0 },
    completed: { type: Boolean, default: false }, // ✅ NEW
    answers: [{ questionId: mongoose.Schema.Types.ObjectId, answer: String }],
  }],
  accessType: {
    type: String,
    enum: ['free', 'pro'],
    default: 'free'
  },
  amount: {
    type: Number,
    default: 0, // default is 0
  }
}, { timestamps: true });

module.exports = mongoose.model('LiveQuiz', liveQuizSchema);
