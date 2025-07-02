const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const QuizAttemptSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  answers: [{ questionId: String, answer: String }],
  score: { type: Number, required: true },
  scorePercentage: { type: Number, required: true },
  isBestScore: { type: Boolean, default: true },
  rank: { type: Number, default: 0 },
  attemptedAt: { type: Date, default: Date.now }
});

// Compound index to ensure unique student-quiz combinations (single attempt per quiz)
QuizAttemptSchema.index({ user: 1, quiz: 1 }, { unique: true });

module.exports = mongoose.model('QuizAttempt', QuizAttemptSchema);
