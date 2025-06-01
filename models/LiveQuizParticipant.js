// models/LiveQuizParticipant.js
const mongoose = require('mongoose');

const liveQuizParticipantSchema = new mongoose.Schema({
  liveQuiz: { type: mongoose.Schema.Types.ObjectId, ref: 'LiveQuiz', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  score: { type: Number, default: 0 },
  coinsEarned: { type: Number, default: 0 },
  currentQuestionIndex: { type: Number, default: 0 },
  completed: { type: Boolean, default: false },
  answers: [{
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
    answer: String
  }]
}, { timestamps: true });

module.exports = mongoose.model('LiveQuizParticipant', liveQuizParticipantSchema);
