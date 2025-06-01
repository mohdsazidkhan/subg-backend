const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const QuizAttemptSchema = new mongoose.Schema({
  publicId: {
    type: String,
    unique: true,
    default: uuidv4,
  },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  answers: [{ questionId: String, answer: String }],
  score: { type: Number, required: true },
  coinsEarned: { type: Number, default: 0 },
  rank: { type: Number, default: 0 }, // ✅ Add this
  attemptedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('QuizAttempt', QuizAttemptSchema);
